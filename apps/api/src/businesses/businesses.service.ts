import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { BackgroundRemovalService } from '../background-removal/background-removal.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessConfigDto, CARRIERS } from './dto/update-business-config.dto';
import { UpdateStorefrontConfigDto } from './dto/update-storefront-config.dto';
import { UpdateNotificationConfigDto } from './dto/update-notification-config.dto';

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

  async publish(businessId: string) {
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: { isActive: true },
    });
    return { url: `https://${business.subdomain}.orbita.site`, published: business.isActive };
  }

  async pause(businessId: string, paused: boolean) {
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: { isPaused: paused },
    });
    return { isPaused: business.isPaused };
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
        if (typeof costo !== 'number' || Number.isNaN(costo) || costo < 0) {
          throw new BadRequestException(`El costo de envío de "${carrier}" tiene que ser un número mayor o igual a 0`);
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
    if (uploadError) {
      throw new BadRequestException(`${errorPrefix}: ${uploadError.message}`);
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

    const { showReviews, heroSlides, headerLinks, statsBar, ...rest } = dto;
    const config = await this.prisma.storefrontConfig.update({
      where: { businessId },
      data: {
        ...rest,
        ...(showReviews !== undefined ? { showRating: showReviews } : {}),
        ...(heroSlides !== undefined ? { heroSlides: heroSlides as object[] } : {}),
        ...(headerLinks !== undefined ? { headerLinks: headerLinks as object[] } : {}),
        ...(statsBar !== undefined ? { statsBar: statsBar as object[] } : {}),
      },
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
    const advanced = await this.prisma.businessAddon.findFirst({
      where: {
        businessId,
        type: 'ADVANCED',
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { expiresAt: true },
    });
    return { advanced: !!advanced, advancedExpiresAt: advanced?.expiresAt ?? null };
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
