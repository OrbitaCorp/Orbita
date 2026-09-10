import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { suspendidoPorPlataforma } from './suspension';
import { SupabaseService } from '../supabase/supabase.service';
import { BackgroundRemovalService } from '../background-removal/background-removal.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessConfigDto, CARRIERS, MAX_MONTO } from './dto/update-business-config.dto';
import { UpdateStorefrontConfigDto } from './dto/update-storefront-config.dto';
import { HOME_TEMPLATES_DISPONIBLES, SetHomeTemplateDto } from './dto/set-home-template.dto';
import { UpdateNotificationConfigDto } from './dto/update-notification-config.dto';
import { TutorialStateDto, UpdateTutorialDto } from './dto/update-tutorial.dto';

const BUSINESS_LOGOS_BUCKET = 'business-logos';

// Set cerrado de eventos y canales válidos para notification_config.matrix.
// No están enumerados como tabla en MODELO_DATOS_DEFINITIVO.md (es un JSON libre),
// así que este catálogo es una decisión tomada acá — ver resumen final.
const NOTIFICATION_EVENTS = [
  'nuevo_pedido',
  'pedido_cancelado',
  'stock_critico',
  'devolucion',
  'cancelacion_pedida', // el cliente PIDE cancelar (no la cancela sola) — ver CancellationsService
  'pago_confirmado',
  'resumen_diario',
  'cliente_nuevo',
  'reporte_semanal',
] as const;

// Canales vivos. WhatsApp se sacó (19/08): los avisos nunca llegaban de
// verdad — el despacho era un stub que solo logueaba — y tener el toggle
// prometía algo que el producto no hace. Sigue aceptándose en la ENTRADA por
// compatibilidad (matrices viejas guardadas con la clave), pero se ignora.
const NOTIFICATION_CHANNELS = ['panel', 'email'] as const;
const NOTIFICATION_CHANNELS_LEGACY = ['whatsapp'] as const;

@Injectable()
export class BusinessesService {
  private readonly logger = new Logger(BusinessesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly backgroundRemoval: BackgroundRemovalService,
  ) {}

  // ── Negocio ──────────────────────────────────────────────────────────────

  async getMe(businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    return this.toBusinessResponse(business);
  }

  // ── Tutorial de primeros pasos ─────────────────────────────────────────

  async getTutorial(businessId: string): Promise<{ tutorial: TutorialStateDto | null; cumplidas: string[] }> {
    const [business, config, mp, nCategorias, nProductos, sucursalConDireccion] = await Promise.all([
      this.prisma.business.findUnique({
        where: { id: businessId },
        select: { tutorial: true, name: true, industry: true, isActive: true, isPaused: true },
      }),
      this.prisma.businessConfig.findUnique({
        where: { businessId },
        select: { enabledCarriers: true, carrierShippingCosts: true, freeShippingFrom: true, shippingPolicy: true },
      }),
      this.prisma.mpCredentials.findUnique({ where: { businessId }, select: { id: true } }),
      this.prisma.category.count({ where: { businessId } }),
      // deletedAt: null — si borró todos sus productos, la tarea deja de
      // estar cumplida (auditoría interna 09/09, ítem `api.prisma`).
      this.prisma.product.count({ where: { businessId, deletedAt: null } }),
      this.prisma.branch.findFirst({ where: { businessId, address: { not: null } }, select: { address: true } }),
    ]);
    if (!business) throw new NotFoundException('Negocio no encontrado');

    // Tareas de la Checklist cumplidas DE VERDAD, deducidas del estado del
    // negocio (ids = TAREAS_CHECKLIST en apps/web .../tutoriales/copy.ts).
    // El panel las tilda solo; el tilde manual sigue existiendo para el resto.
    const costos = (config?.carrierShippingCosts ?? {}) as Record<string, unknown>;
    const algunCosto = Object.values(costos).some((v) => typeof v === 'number' && v > 0);
    const cumplidas: string[] = [];
    if (business.name.trim() && business.industry.trim() && sucursalConDireccion?.address?.trim()) cumplidas.push('negocio');
    if (mp) cumplidas.push('mp');
    if (nCategorias > 0) cumplidas.push('categorias');
    if (nProductos > 0) cumplidas.push('producto');
    if ((config?.enabledCarriers.length ?? 0) > 0 || algunCosto || config?.freeShippingFrom != null || config?.shippingPolicy?.trim()) {
      cumplidas.push('envios');
    }
    if (business.isActive && !business.isPaused) cumplidas.push('publicar');

    // NULL = nunca se tocó: el panel lo interpreta como "arrancar desde cero".
    return { tutorial: (business.tutorial as TutorialStateDto | null) ?? null, cumplidas };
  }

  async updateTutorial(businessId: string, dto: UpdateTutorialDto): Promise<{ tutorial: TutorialStateDto }> {
    const { variante, fase, paso, hechas, minimizado, seccionesVistas } = dto.tutorial;
    // Se copia campo por campo: que a la base solo llegue el shape validado.
    const tutorial: TutorialStateDto = { variante, fase, paso, hechas, minimizado, seccionesVistas };
    await this.prisma.business.update({ where: { id: businessId }, data: { tutorial: { ...tutorial } } });
    return { tutorial };
  }

  async updateMe(businessId: string, dto: UpdateBusinessDto) {
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        name: dto.name,
        industry: dto.industry,
        description: dto.description,
      },
    });
    return this.toBusinessResponse(business);
  }

  // Incluye los campos del wizard (RBT-293) para que el frontend pueda
  // rehidratar el estado si el usuario abandona y retoma el onboarding.
  private toBusinessResponse(business: {
    id: string;
    name: string;
    industry: string;
    description: string | null;
    subdomain: string;
    mode: string;
    isActive: boolean;
    isPaused: boolean;
    subrubros: string[];
    teamSize: string | null;
    operatesPhysical: boolean;
    operatesOnline: boolean;
  }) {
    return {
      id: business.id,
      name: business.name,
      industry: business.industry,
      description: business.description,
      subdomain: business.subdomain,
      mode: business.mode,
      isActive: business.isActive,
      isPaused: business.isPaused,
      subrubros: business.subrubros,
      teamSize: business.teamSize,
      operatesPhysical: business.operatesPhysical,
      operatesOnline: business.operatesOnline,
    };
  }

  // Auditoría de seguridad (2026-09-08): antes esto solo hacía `isActive:
  // true` sin mirar nada más. Como `register-business` (RBT-291) es un
  // endpoint público que crea la cuenta SIN pasar por pago (el pago real pasa
  // por SubscriptionsService.confirmAndCreate/confirmPlanActivation), quien
  // fuera podía llamar register-business + publish directo y quedarse con una
  // tienda operativa gratis para siempre, sin ninguna fila en `Subscription`
  // (así que el cron de mora tampoco la alcanzaba nunca). El gate real de
  // "¿pagó o tiene una licencia de cortesía?" es la EXISTENCIA de la fila de
  // Subscription — la crea únicamente confirmAndCreate/confirmPlanActivation,
  // después de verificar el pago contra MercadoPago (o un código de descuento
  // del 100% ya validado). No se exige un `status` particular acá: un negocio
  // en PAST_DUE (mora, período de gracia) sigue pudiendo estar publicado —
  // eso lo maneja aparte el cron de mora vía `isPaused`, no `isActive`.
  async publish(businessId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
      select: { id: true },
    });
    if (!subscription) {
      throw new ForbiddenException(
        'No se puede publicar la tienda: todavía no hay una suscripción activa para este negocio. Completá el pago (o la alta de cortesía) antes de publicar.',
      );
    }

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: { isActive: true },
    });
    return { url: `https://${business.subdomain}.orbita.site`, published: business.isActive };
  }

  // Pausar la tienda es del dueño; levantar una SUSPENSIÓN no. Las dos cosas
  // usan el mismo `isPaused`, y antes este endpoint lo ponía en false sin
  // mirar nada más: una tienda suspendida por mora (cron) o por el super admin
  // volvía a estar en línea con un POST /business/pause { paused: false }, sin
  // pagar y sin que nadie la reactivara (auditoría interna 10/09, ítem
  // `api.businesses`). Pausar (paused: true) sigue permitido siempre.
  async pause(businessId: string, paused: boolean) {
    if (!paused) {
      const suspension = await this.suspensionVigente(businessId);
      if (suspension === 'PLATAFORMA') {
        throw new ForbiddenException('Tu tienda está suspendida por Órbita. Escribinos desde Soporte para reactivarla.');
      }
      if (suspension === 'MORA') {
        throw new ForbiddenException(
          'Tu tienda está suspendida por falta de pago. Cuando se regularice la suscripción vuelve a estar en línea sola.',
        );
      }
    }

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: { isPaused: paused },
    });
    return { isPaused: business.isPaused };
  }

  // PLATAFORMA = el super admin la suspendió y no la reactivó (ver
  // suspension.ts). MORA = la suscripción está SUSPENDED (gracia vencida o
  // cortesía vencida, lo pone el cron) o dada de baja. La primera gana: una
  // suspensión de la plataforma no se levanta pagando.
  async suspensionVigente(businessId: string): Promise<'PLATAFORMA' | 'MORA' | null> {
    if (await suspendidoPorPlataforma(this.prisma, businessId)) return 'PLATAFORMA';
    const sub = await this.prisma.subscription.findUnique({ where: { businessId }, select: { status: true } });
    if (sub && (sub.status === 'SUSPENDED' || sub.status === 'CANCELLED')) return 'MORA';
    return null;
  }

  // (Fase 1 — Alex) Acá se cambia el modo de verdad. Reglas: si ya está en ese
  // modo no hace nada, y no te deja pasar a solo catálogo si hay pedidos online
  // sin terminar (para no dejar clientes colgados con la compra hecha). Hoy la
  // base no tiene pedidos así que pasa siempre, pero la regla ya queda lista
  // para cuando exista el módulo de pedidos.
  async changeMode(businessId: string, mode: 'FULL' | 'SHOWCASE') {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    if (business.mode === mode) return this.toBusinessResponse(business); // idempotente

    if (mode === 'SHOWCASE') {
      const enCurso = await this.prisma.order.count({
        where: {
          businessId,
          channel: 'ONLINE',
          status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED'] },
          deletedAt: null,
        },
      });
      if (enCurso > 0) {
        throw new UnprocessableEntityException(
          `No se puede pasar a vidriera: hay ${enCurso} pedido(s) online sin resolver. Entregalos o cancelalos primero.`,
        );
      }
    }

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { mode },
    });
    return this.toBusinessResponse(updated);
  }

  // ── Config operativa (contacto, pagos, envíos, redes) ───────────────────

  async getConfig(businessId: string) {
    const config = await this.prisma.businessConfig.findUnique({ where: { businessId } });
    if (!config) throw new NotFoundException('Configuración no encontrada');
    return config;
  }

  async updateConfig(businessId: string, dto: UpdateBusinessConfigDto) {
    const current = await this.prisma.businessConfig.findUnique({ where: { businessId } });
    if (!current) throw new NotFoundException('Configuración no encontrada');

    // `acceptsTransfer` ("Coordinar por WhatsApp" en el checkout, antes
    // "Transferencia") ya NO exige transferAlias/transferCbu/transferHolder:
    // el negocio no muestra ningún dato bancario en el checkout, coordina el
    // pago directo por WhatsApp después de confirmado el pedido. Esos tres
    // campos siguen existiendo en el modelo (por si algún negocio los tenía
    // cargados de antes) pero ya no se piden ni se validan acá.

    // Mismo criterio: si devoluciones/cancelaciones están habilitadas, tiene
    // que haber al menos un método de reembolso posible — si no, el cliente
    // llega hasta pedirla y no hay nada que ofrecerle.
    const returnsEnabled = dto.returnsEnabled ?? current.returnsEnabled;
    const returnsCreditNoteEnabled = dto.returnsCreditNoteEnabled ?? current.returnsCreditNoteEnabled;
    const returnsMpRefundEnabled = dto.returnsMpRefundEnabled ?? current.returnsMpRefundEnabled;
    if (returnsEnabled && !returnsCreditNoteEnabled && !returnsMpRefundEnabled) {
      throw new BadRequestException(
        'Si las devoluciones están habilitadas, tiene que haber al menos un método de reembolso activo (nota de crédito o Mercado Pago)',
      );
    }
    const cancellationsEnabled = dto.cancellationsEnabled ?? current.cancellationsEnabled;
    const cancellationsCreditNoteEnabled = dto.cancellationsCreditNoteEnabled ?? current.cancellationsCreditNoteEnabled;
    const cancellationsMpRefundEnabled = dto.cancellationsMpRefundEnabled ?? current.cancellationsMpRefundEnabled;
    if (cancellationsEnabled && !cancellationsCreditNoteEnabled && !cancellationsMpRefundEnabled) {
      throw new BadRequestException(
        'Si las cancelaciones están habilitadas, tiene que haber al menos un método de reembolso activo (nota de crédito o Mercado Pago)',
      );
    }

    // `carrierShippingCosts` es un objeto de forma libre (Json) — class-validator
    // no puede validar claves/valores dinámicos con decoradores solos, así que
    // se valida acá a mano: claves dentro de la lista cerrada de transportistas,
    // valores numéricos y no negativos (mismo criterio que freeShippingFrom).
    if (dto.carrierShippingCosts) {
      for (const [carrier, costo] of Object.entries(dto.carrierShippingCosts)) {
        if (!(CARRIERS as readonly string[]).includes(carrier)) {
          throw new BadRequestException(`"${carrier}" no es un transportista válido`);
        }
        if (typeof costo !== 'number' || !Number.isFinite(costo) || costo < 0 || costo > MAX_MONTO) {
          throw new BadRequestException(`El costo de envío de "${carrier}" tiene que ser un número entre 0 y ${MAX_MONTO}`);
        }
      }
    }

    return this.prisma.businessConfig.update({
      where: { businessId },
      data: dto,
    });
  }

  // ── Apariencia del storefront ────────────────────────────────────────────

  async uploadLogo(businessId: string, file: { buffer: Buffer; mimetype: string; originalname: string }) {
    const url = await this.uploadToStorage(businessId, file, 'No se pudo subir el logo');
    const config = await this.prisma.storefrontConfig.update({
      where: { businessId },
      data: { logoUrl: url },
    });
    return { logoUrl: config.logoUrl };
  }

  // Genérico: sube a Storage y devuelve la URL sin escribir en ningún campo
  // — el frontend decide si es el logo, el favicon, o la imagen de un slide
  // del hero (Apariencia guarda esa URL como parte de `heroSlides` JSON, no
  // hay una columna dedicada por slide). Mismo bucket que uploadLogo().
  //
  // removeBackground: solo lo usa el editor de slides del hero — corre el
  // modelo local ANTES de la conversión a webp de uploadToStorage(), nunca
  // codifica el resultado dos veces.
  async uploadStorefrontImage(
    businessId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    removeBackground?: boolean,
  ) {
    const buffer = removeBackground
      ? await this.backgroundRemoval.removeBackground(file.buffer)
      : file.buffer;
    const url = await this.uploadToStorage(businessId, { ...file, buffer }, 'No se pudo subir la imagen');
    return { url };
  }

  // Todas las imágenes de Apariencia (logo, favicon, slides del hero) se
  // convierten a webp acá — nunca se persiste el formato original, mismo
  // criterio que ProductsService.addImage() para fotos de producto. webp
  // soporta canal alfa, así que no rompe transparencia si la imagen ya viene
  // sin fondo (ver BackgroundRemovalService).
  private async uploadToStorage(
    businessId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    errorPrefix: string,
  ): Promise<string> {
    let webpBuffer: Buffer;
    try {
      webpBuffer = await sharp(file.buffer).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new BadRequestException(`${errorPrefix}: el archivo no es una imagen válida o está corrupto`);
    }

    const path = `${businessId}/${randomUUID()}.webp`;

    const { error: uploadError } = await this.supabase.adminClient.storage
      .from(BUSINESS_LOGOS_BUCKET)
      .upload(path, webpBuffer, { contentType: 'image/webp', upsert: false });
    // El mensaje de Supabase (nombre del bucket, políticas, cuotas) va al log,
    // no a la respuesta: antes viajaba tal cual al panel (auditoría interna
    // 10/09, ítem `api.businesses`, verificación 7).
    if (uploadError) {
      this.logger.error(`Subida a ${BUSINESS_LOGOS_BUCKET} falló para ${businessId}: ${uploadError.message}`);
      throw new ServiceUnavailableException(`${errorPrefix}: el almacenamiento no respondió, probá de nuevo en un rato`);
    }

    const { data: publicUrl } = this.supabase.adminClient.storage
      .from(BUSINESS_LOGOS_BUCKET)
      .getPublicUrl(path);
    return publicUrl.publicUrl;
  }

  async getAppearance(businessId: string) {
    const config = await this.prisma.storefrontConfig.findUnique({ where: { businessId } });
    if (!config) throw new NotFoundException('Configuración de apariencia no encontrada');
    return this.toAppearanceResponse(config);
  }

  async updateAppearance(businessId: string, dto: UpdateStorefrontConfigDto) {
    const current = await this.prisma.storefrontConfig.findUnique({ where: { businessId } });
    if (!current) throw new NotFoundException('Configuración de apariencia no encontrada');

    const { showReviews, heroSlides, headerLinks, statsBar, homeTemplateData, ...rest } = dto;
    const config = await this.prisma.storefrontConfig.update({
      where: { businessId },
      data: {
        ...rest,
        ...(showReviews !== undefined ? { showRating: showReviews } : {}),
        ...(heroSlides !== undefined ? { heroSlides: heroSlides as object[] } : {}),
        ...(headerLinks !== undefined ? { headerLinks: headerLinks as object[] } : {}),
        ...(statsBar !== undefined ? { statsBar: statsBar as object[] } : {}),
        // Mismo casteo que los de arriba: Prisma pide un JSON indexable y una
        // clase DTO no lo es (ya validada por class-validator a esta altura).
        ...(homeTemplateData !== undefined ? { homeTemplateData: homeTemplateData as object } : {}),
      },
    });
    return this.toAppearanceResponse(config);
  }

  // Enganche real de una plantilla de Home (paquete Avanzado) — separado del
  // PUT general a propósito: es un cambio de MODO (qué layout dibuja el
  // storefront), no una edición de contenido. Lo COMÚN a todas las plantillas
  // (heroSlides/statsBar/shippingText) se sigue leyendo de los mismos campos
  // de storefrontConfig, así que activar/desactivar acá no los toca: solo
  // mueve el puntero de cuál layout los dibuja. Lo que es propio de UNA
  // plantilla (el cupón de Vidriera) vive aparte, en homeTemplateData, y
  // tampoco se borra al cambiar de plantilla — si el dueño vuelve a la
  // anterior, se lo encuentra como lo había dejado.
  async setHomeTemplate(businessId: string, dto: SetHomeTemplateDto) {
    const current = await this.prisma.storefrontConfig.findUnique({ where: { businessId } });
    if (!current) throw new NotFoundException('Configuración de apariencia no encontrada');
    if (dto.template !== null && !HOME_TEMPLATES_DISPONIBLES.includes(dto.template as (typeof HOME_TEMPLATES_DISPONIBLES)[number])) {
      throw new BadRequestException(`Plantilla desconocida: ${dto.template}`);
    }
    const config = await this.prisma.storefrontConfig.update({
      where: { businessId },
      data: { homeTemplate: dto.template },
    });
    return this.toAppearanceResponse(config);
  }

  // El schema mapea el toggle como `showRating`; la API lo expone como `showReviews`
  // (ver nota en CONTRATO_API.md sobre el renombre showRating → showReviews).
  private toAppearanceResponse(config: {
    showRating: boolean;
    [key: string]: unknown;
  }) {
    const { showRating, ...rest } = config;
    return { ...rest, showReviews: showRating };
  }

  // ── Add-ons (paquete "Avanzado") ─────────────────────────────────────────
  // Lectura simple para que el panel sepa si mostrar el módulo desbloqueado
  // o con overlay de upgrade — el gate real de cada endpoint vive en
  // AddonGuard (ver requires-addon.decorator.ts), esto es solo para la UI.
  async getAddons(businessId: string) {
    const [advanced, business] = await Promise.all([
      this.prisma.businessAddon.findFirst({
        where: {
          businessId,
          type: 'ADVANCED',
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { expiresAt: true },
      }),
      this.prisma.business.findUnique({ where: { id: businessId }, select: { flashSaleEnabled: true } }),
    ]);
    return {
      advanced: !!advanced,
      advancedExpiresAt: advanced?.expiresAt ?? null,
      // Interruptor de "Oferta relámpago" (tarjeta de Avanzado): viaja acá
      // porque el formulario de Descuentos ya pide esto para saber si
      // ofrecer el tipo, y así lo resuelve en una sola consulta.
      flashSaleEnabled: business?.flashSaleEnabled ?? false,
    };
  }

  async hasActiveAddon(businessId: string, type: string): Promise<boolean> {
    const addon = await this.prisma.businessAddon.findFirst({
      where: {
        businessId,
        type,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    return !!addon;
  }

  // ── Notificaciones ───────────────────────────────────────────────────────

  async getNotifications(businessId: string) {
    const config = await this.prisma.notificationConfig.findUnique({ where: { businessId } });
    if (!config) throw new NotFoundException('Configuración de notificaciones no encontrada');
    return { matrix: config.matrix };
  }

  async updateNotifications(businessId: string, dto: UpdateNotificationConfigDto) {
    this.validateNotificationMatrix(dto.matrix);

    const config = await this.prisma.notificationConfig.update({
      where: { businessId },
      data: { matrix: dto.matrix },
    });
    return { matrix: config.matrix };
  }

  private validateNotificationMatrix(
    matrix: Record<string, { panel: boolean; email: boolean; whatsapp?: boolean }>,
  ) {
    for (const [event, channels] of Object.entries(matrix)) {
      if (!NOTIFICATION_EVENTS.includes(event as (typeof NOTIFICATION_EVENTS)[number])) {
        throw new BadRequestException(
          `Evento de notificación desconocido: "${event}". Eventos válidos: ${NOTIFICATION_EVENTS.join(', ')}`,
        );
      }
      if (typeof channels !== 'object' || channels === null) {
        throw new BadRequestException(`El evento "${event}" debe mapear a un objeto de canales`);
      }
      for (const channel of NOTIFICATION_CHANNELS) {
        if (typeof channels[channel] !== 'boolean') {
          throw new BadRequestException(
            `El evento "${event}" requiere el canal "${channel}" como booleano`,
          );
        }
      }
      const extraKeys = Object.keys(channels).filter(
        (k) =>
          !NOTIFICATION_CHANNELS.includes(k as (typeof NOTIFICATION_CHANNELS)[number]) &&
          !NOTIFICATION_CHANNELS_LEGACY.includes(k as (typeof NOTIFICATION_CHANNELS_LEGACY)[number]),
      );
      if (extraKeys.length > 0) {
        throw new BadRequestException(
          `Canal(es) desconocido(s) en "${event}": ${extraKeys.join(', ')}. Canales válidos: ${NOTIFICATION_CHANNELS.join(', ')}`,
        );
      }
    }
  }
}
