import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MercadoPagoConfig,
  PreApproval,
  Payment,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { BusinessesService } from '../businesses/businesses.service';
import { BranchesService } from '../branches/branches.service';
import { AuthService } from '../auth/auth.service';
import { RegisterBusinessDto } from '../onboarding/dto/register-business.dto';
import { StartPendingCheckoutDto, PendingWizardDto } from './dto/start-pending-checkout.dto';

// Suscripción del negocio hacia Órbita (no confundir con los pagos de los
// clientes hacia el negocio, que viven en el módulo mercadopago/).
//
// Se usa "preapproval" (Suscripciones de MP) en vez de un pago único porque el
// cobro es recurrente: MP guarda la tarjeta del dueño y le vuelve a cobrar solo
// cada período, sin que tenga que volver a cargar nada. El dueño autoriza el
// débito en una pantalla alojada por MP — nosotros nunca vemos la tarjeta.
//
// El precio y la periodicidad salen de variables de entorno para poder probar
// con montos y ciclos cortos ($1 cada 3 días) sin tocar código. Ver .env.example.
//
// DISEÑO: nada se crea en Business/Member hasta que MP confirma el pago. Los
// datos de la cuenta + el wizard viajan en `PendingSignup` (tabla temporal,
// ver schema.prisma) desde que se pide el checkout hasta que se confirma —
// así un pago que nunca se completa no deja ningún negocio/email/subdominio
// "ocupado" esperando que alguien lo borre a mano. Ver PENDIENTES.md.

// Prefijo del id de alta para los códigos del 100%, que no pasan por MP. Es lo
// único que distingue un alta gratis de una paga en confirmAndCreate(), y no
// puede colisionar con un id real de MercadoPago (los suyos son numéricos o
// hexadecimales, nunca empiezan con esto).
const FREE_SIGNUP_PREFIX = 'FREE-';

type PlanConfig = {
  amount: number;
  frequency: number;
  frequencyType: 'days' | 'months';
  currency: string;
};

// Lo que se guarda en PendingSignup.payload. La contraseña viaja en texto
// plano acá (trade-off documentado en PENDIENTES.md) porque registerBusiness()
// la hashea internamente y no vale la pena tocar su firma para esto — la fila
// vive minutos/horas como mucho, en la misma base que ya guarda passwordHash.
type PendingPayload = {
  account: RegisterBusinessDto;
  wizard: PendingWizardDto;
  // Descuento de plataforma aplicado en el checkout. Se resuelve UNA vez, al
  // pedir el link de pago, y viaja acá hasta la confirmación: así el monto que
  // se guarda en Subscription es exactamente el que autorizó el cliente en MP,
  // aunque mientras tanto alguien haya editado o desactivado el código.
  discount?: { codeId: string; code: string; percentOff: number; amountBase: number; amountFinal: number };
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private _preapproval: PreApproval | undefined;
  private _payment: Payment | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly onboardingService: OnboardingService,
    private readonly businessesService: BusinessesService,
    private readonly branchesService: BranchesService,
    private readonly authService: AuthService,
  ) {}

  // true si hay token de MP configurado. Los crons lo usan para no romper en
  // entornos sin MP (dev sin credenciales).
  private get mpConfigured(): boolean {
    return !!this.config.get<string>('MP_ACCESS_TOKEN');
  }

  private mpConfig(): MercadoPagoConfig {
    const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) {
      throw new BadRequestException(
        'MercadoPago no está configurado en este entorno (falta MP_ACCESS_TOKEN)',
      );
    }
    return new MercadoPagoConfig({ accessToken });
  }

  // Clientes perezosos: si el token no está configurado, la app tiene que poder
  // arrancar igual (el resto del backend no depende de MP).
  private get preapproval(): PreApproval {
    if (!this._preapproval) this._preapproval = new PreApproval(this.mpConfig());
    return this._preapproval;
  }

  private get payment(): Payment {
    if (!this._payment) this._payment = new Payment(this.mpConfig());
    return this._payment;
  }

  private get plan(): PlanConfig {
    const frequencyType = this.config.get<string>('MP_SUBSCRIPTION_FREQUENCY_TYPE') ?? 'months';
    if (frequencyType !== 'days' && frequencyType !== 'months') {
      throw new BadRequestException('MP_SUBSCRIPTION_FREQUENCY_TYPE debe ser "days" o "months"');
    }
    return {
      amount: Number(this.config.get<string>('MP_SUBSCRIPTION_AMOUNT') ?? 5000),
      frequency: Number(this.config.get<string>('MP_SUBSCRIPTION_FREQUENCY') ?? 3),
      frequencyType,
      currency: this.config.get<string>('MP_SUBSCRIPTION_CURRENCY') ?? 'ARS',
    };
  }

  // Monto mínimo que acepta MP por cobro, configurable porque depende del país
  // y de la moneda y MP lo cambia sin avisar. Si algún día sube, se ajusta acá
  // sin tocar código.
  private get montoMinimo(): number {
    return Number(this.config.get<string>('MP_MIN_TRANSACTION_AMOUNT') ?? 15);
  }

  // Hasta que porcentaje se puede descontar sin que el cobro caiga por debajo
  // del minimo de MP. Lo usa el panel para no dejar crear un codigo que despues
  // va a reventar recien al pagar.
  //
  // El 100% NO entra en este limite y siempre esta permitido: ese camino no
  // habla con MP (ver startCheckoutPending), asi que ningun minimo lo afecta.
  //
  // Si el plan cuesta lo mismo que el minimo, maxPercentOff da 0: ahi no existe
  // ningun descuento parcial posible y el 100% es la unica opcion.
  limitesDescuento(): { amountBase: number; minAmount: number; maxPercentOff: number } {
    const { amount } = this.plan;
    const minAmount = this.montoMinimo;
    const maxPercentOff = amount <= minAmount ? 0 : Math.floor((1 - minAmount / amount) * 100);
    return { amountBase: amount, minAmount, maxPercentOff };
  }

  private periodEnd(from: Date): Date {
    const { frequency, frequencyType } = this.plan;
    const end = new Date(from);
    if (frequencyType === 'days') end.setDate(end.getDate() + frequency);
    else end.setMonth(end.getMonth() + frequency);
    return end;
  }

  private mpErrorMessage(err: unknown): string {
    // El SDK de MP tira un objeto propio { message, status, cause } — NO una
    // instancia real de Error (confirmado probándolo contra MP real).
    //
    // `message` sola no alcanza para diagnosticar: MP devuelve genericos como
    // "User bad request" y mete el motivo REAL en `cause`. Sin esto, un alta
    // rechazada no dice si el problema fue el monto, el email del pagador o la
    // URL de retorno, y hay que adivinar.
    if (!err || typeof err !== 'object') return 'MercadoPago rechazó la solicitud';
    const e = err as { message?: unknown; cause?: unknown; error?: unknown };
    const base = typeof e.message === 'string' && e.message ? e.message : 'MercadoPago rechazó la solicitud';

    const causas = Array.isArray(e.cause) ? e.cause : e.cause ? [e.cause] : [];
    const detalles = causas
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object') {
          const { code, description } = c as { code?: unknown; description?: unknown };
          const desc = typeof description === 'string' ? description : '';
          const cod = code === undefined || code === null ? '' : String(code);
          return [desc, cod && `(${cod})`].filter(Boolean).join(' ');
        }
        return '';
      })
      .filter(Boolean);

    return detalles.length ? `${base}: ${detalles.join('; ')}` : base;
  }

  // ── Alta pendiente (todavía sin cuenta creada) ───────────────────────────

  // Pide el link de MP para autorizar el débito, SIN crear nada en Business ni
  // Member — los datos de la cuenta y el wizard quedan en PendingSignup hasta
  // que MP confirma (ver confirmAndCreate). Rechaza temprano si el email ya
  // está en uso, para no crear un preapproval que después no se puede usar.
  async startCheckoutPending(dto: StartPendingCheckoutDto) {
    const { available } = await this.onboardingService.checkEmail(dto.account.email);
    if (!available) {
      throw new ConflictException('Este email ya tiene un negocio registrado en Orbita');
    }

    const { amount, frequency, frequencyType, currency } = this.plan;
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    // El descuento se resuelve ANTES de hablar con MP: lo que se le manda a
    // cobrar tiene que ser exactamente el precio con descuento, no el de lista.
    const discount = await this.resolverDescuento(dto.discountCode, amount);
    const montoACobrar = discount ? discount.amountFinal : amount;

    // Código del 100%: no hay nada que cobrar, así que no se habla con MP —
    // un preapproval con transaction_amount 0 lo rechaza. Se guarda el mismo
    // PendingSignup de siempre pero con un id sintético, y se manda al dueño a
    // la MISMA pantalla de vuelta que usa el pago real: ahí
    // confirmAndCreate() crea la cuenta y devuelve la sesión por el BFF, sin
    // ningún camino paralelo que pueda divergir del probado.
    // Se exige el descuento explicito y no solo `montoACobrar === 0`: si algun
    // dia el precio del plan quedara en 0 por un .env mal cargado, esa version
    // regalaria TODAS las altas en silencio. Asi, sin un codigo del 100% de por
    // medio, un precio invalido sigue fallando contra MP y se nota.
    if (discount && discount.amountFinal === 0) {
      const preapprovalId = `${FREE_SIGNUP_PREFIX}${randomUUID()}`;
      const payload: PendingPayload = { account: dto.account, wizard: dto.wizard, ...(discount ? { discount } : {}) };
      await this.prisma.pendingSignup.create({
        data: { preapprovalId, payload: payload as unknown as Prisma.InputJsonValue },
      });
      return {
        preapprovalId,
        initPoint: `${frontendUrl}/onboarding/pago-retorno?preapproval_id=${preapprovalId}`,
        free: true,
      };
    }

    let response;
    try {
      response = await this.preapproval.create({
        body: {
          reason: `Órbita: ${dto.account.businessName}`,
          payer_email: dto.account.email,
          back_url: `${frontendUrl}/onboarding/pago-retorno`,
          status: 'pending',
          auto_recurring: {
            frequency,
            frequency_type: frequencyType,
            transaction_amount: montoACobrar,
            currency_id: currency,
          },
        },
      });
    } catch (err) {
      const motivo = this.mpErrorMessage(err);
      // Crudo y completo: `mpErrorMessage` resume, pero si MP suma un campo
      // nuevo esto es lo unico que lo deja ver sin volver a desplegar.
      this.logger.warn(
        `MP rechazó la creación del preapproval (monto ${montoACobrar} ${currency}, payer ${dto.account.email}): ${motivo} — crudo: ${JSON.stringify(err, Object.getOwnPropertyNames(Object(err))).slice(0, 1500)}`,
      );
      throw new BadRequestException(`MercadoPago rechazó el alta: ${motivo}`);
    }

    if (!response.id || !response.init_point) {
      throw new BadRequestException('MercadoPago no devolvió un link de pago válido');
    }

    const payload: PendingPayload = { account: dto.account, wizard: dto.wizard, ...(discount ? { discount } : {}) };
    await this.prisma.pendingSignup.create({
      data: { preapprovalId: response.id, payload: payload as unknown as Prisma.InputJsonValue },
    });

    return { preapprovalId: response.id, initPoint: response.init_point, free: false };
  }

  // Valida un código de descuento de plataforma y devuelve el monto ya
  // calculado. Devuelve undefined si no vino código; tira 400 si vino uno que
  // no sirve — cobrar el precio lleno callado sería peor que fallar.
  private async resolverDescuento(codigo: string | undefined, amountBase: number) {
    const code = codigo?.trim().toUpperCase();
    if (!code) return undefined;

    const dc = await this.prisma.platformDiscountCode.findUnique({ where: { code } });
    if (!dc) throw new BadRequestException('El código de descuento no existe');
    if (!dc.isActive) throw new BadRequestException('Ese código de descuento está desactivado');
    if (dc.expiresAt && dc.expiresAt <= new Date()) throw new BadRequestException('Ese código de descuento venció');
    if (dc.maxUses !== null && dc.usedCount >= dc.maxUses) {
      throw new BadRequestException('Ese código de descuento ya se usó todas las veces permitidas');
    }

    // Se redondea a 2 decimales: MP rechaza montos con más precisión.
    const amountFinal = Math.round(amountBase * (1 - dc.percentOff / 100) * 100) / 100;

    // MP tiene un monto mínimo por cobro y rechaza cualquier cosa por debajo
    // ("Cannot pay an amount lower than $ 15.00"). Sin este chequeo el dueño
    // aplicaba el código, veía un precio rebajado lindo en pantalla y recién
    // se enteraba al apretar Pagar, con un error de MP que no explica nada.
    // Mejor decírselo acá, que es donde todavía puede hacer algo.
    // El cero no cuenta: ese camino ni siquiera habla con MP.
    const minimo = this.montoMinimo;
    if (amountFinal > 0 && amountFinal < minimo) {
      throw new BadRequestException(
        `Con ese código el plan queda en $${amountFinal} y Mercado Pago no cobra menos de $${minimo}`,
      );
    }
    // Cero es válido y significa alta gratis: startCheckoutPending() ni siquiera
    // llama a MP en ese caso. Negativo sí sería un porcentaje corrupto en la
    // base (el DTO topea en 100), y ahí conviene fallar antes que regalar plata.
    if (amountFinal < 0) {
      throw new BadRequestException('Ese código de descuento tiene un porcentaje inválido');
    }

    return { codeId: dc.id, code: dc.code, percentOff: dc.percentOff, amountBase, amountFinal };
  }

  // Previsualización para el wizard: mismo criterio de validez que el cobro
  // real, pero sin efectos. Reusa resolverDescuento para que no puedan
  // divergir (que la preview diga una cosa y el cobro haga otra).
  async previewDiscount(code: string) {
    const { amount, currency } = this.plan;
    const d = await this.resolverDescuento(code, amount);
    if (!d) throw new BadRequestException('Falta el código');
    return {
      code: d.code,
      percentOff: d.percentOff,
      amountBase: d.amountBase,
      amountFinal: d.amountFinal,
      currency,
    };
  }

  // Consume un uso del código de forma ATÓMICA: el chequeo del tope y el
  // incremento van en la misma sentencia, así dos altas simultáneas con el
  // último uso disponible no pueden pasar las dos. Devuelve false si el código
  // se agotó, se venció o se desactivó entre el checkout y la confirmación.
  private async consumirDescuento(
    tx: Prisma.TransactionClient,
    codeId: string,
  ): Promise<boolean> {
    const filas = await tx.$executeRaw`
      UPDATE platform_discount_codes
         SET used_count = used_count + 1, updated_at = NOW()
       WHERE id = ${codeId}
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)
    `;
    return filas > 0;
  }

  // ── Confirmación: acá recién se crea la cuenta real ──────────────────────

  // Idempotente: la llaman tanto el webhook como la vuelta del navegador, en
  // cualquier orden, y puede que ninguna de las dos llegue nunca (el cron de
  // limpieza se encarga de esos). Si el PendingSignup ya no existe, alguien ya
  // lo consumió — no es un error, es el caso normal de la carrera webhook vs
  // browser.
  async confirmAndCreate(preapprovalId: string) {
    const pending = await this.prisma.pendingSignup.findUnique({ where: { preapprovalId } });
    if (!pending) {
      return { activated: false, status: 'already_consumed_or_unknown' };
    }

    // Alta gratis por código del 100%: no existe preapproval que consultar. El
    // permiso ya se validó al pedir el checkout (el código estaba activo, no
    // vencido y con usos disponibles) y quedó registrado en el PendingSignup,
    // que es de un solo uso — así que llegar acá con este id ES la autorización.
    const esGratis = preapprovalId.startsWith(FREE_SIGNUP_PREFIX);
    if (!esGratis) {
      const mp = await this.preapproval.get({ id: preapprovalId });
      if (mp.status !== 'authorized') {
        // Todavía no autorizó — no se borra el PendingSignup, puede confirmar
        // más tarde (reintento manual o el webhook cuando MP avise).
        return { activated: false, status: mp.status ?? 'unknown' };
      }
    }

    const { account, wizard } = pending.payload as unknown as PendingPayload;

    let business: { id: string; subdomain: string };
    let memberId: string;
    let branchId: string;
    try {
      const result = await this.onboardingService.registerBusiness(account);
      business = result.business;
      memberId = result.member.id;
      branchId = result.branch.id;
    } catch (err) {
      // Carrera: el webhook y la vuelta del browser llegaron casi juntos y los
      // dos pasaron el check de PendingSignup antes de que el primero borrara
      // la fila. registerBusiness() ya rechazó el segundo por email duplicado
      // — buscamos el negocio que YA se creó y devolvemos éxito igual, en vez
      // de mostrarle un error a alguien que en realidad ya tiene su cuenta.
      if (err instanceof ConflictException) {
        const existente = await this.prisma.member.findFirst({
          where: { email: { equals: account.email, mode: 'insensitive' } },
          include: { business: { select: { id: true, subdomain: true } } },
        });
        if (existente) {
          await this.prisma.pendingSignup.deleteMany({ where: { preapprovalId } });
          return { activated: true, subdomain: existente.business.subdomain, free: esGratis };
        }
      }
      throw err;
    }

    // Aplica el resto de los datos del wizard. Ninguno de estos pasos revierte
    // la cuenta si falla — mismo criterio que ya usaba completeOnboarding() en
    // el frontend: el negocio ya existe, el dueño puede completar lo que faltó
    // desde el panel. Son independientes entre sí (todos solo necesitan el
    // businessId/branchId que ya tenemos) así que corren en paralelo — antes
    // iban secuenciales y sumaban varios segundos al tiempo de confirmación,
    // que el usuario ve como "tarda mucho" en /onboarding/pago-retorno.
    const pagos = wizard.pagos ?? [];
    const tareas: Promise<unknown>[] = [
      this.onboardingService.updateDraft(business.id, {
        industry: wizard.rubro,
        description: wizard.descripcion,
        subrubros: wizard.subrubros,
        subdomain: wizard.subdominio || undefined,
        mode: wizard.modoVenta ? (wizard.modoVenta === 'vidriera' ? 'SHOWCASE' : 'FULL') : undefined,
        teamSize: wizard.teamSize || undefined,
        operatesPhysical: wizard.operatesPhysical,
        operatesOnline: wizard.operatesOnline,
      }),
      this.businessesService.updateConfig(business.id, {
        email: account.email,
        whatsapp: wizard.telefono || undefined,
        acceptsCash: pagos.includes('efectivo'),
        acceptsTransfer: pagos.includes('transferencia'),
        acceptsMercadopago: pagos.includes('mercadopago'),
        acceptsCard: pagos.includes('tarjeta'),
        ...(pagos.includes('transferencia') ? { transferAlias: wizard.transferAlias } : {}),
      }),
    ];
    if (wizard.operatesPhysical) {
      tareas.push(
        this.branchesService.update(business.id, branchId, {
          address: wizard.direccion || undefined,
          latitude: wizard.latitude,
          longitude: wizard.longitude,
        }),
      );
    }
    if (wizard.logoDataUrl) {
      tareas.push(this.businessesService.uploadLogo(business.id, this.decodeDataUrl(wizard.logoDataUrl)));
    }
    const nombres = ['updateDraft', 'updateConfig', 'branch.update', 'uploadLogo'];
    const resultados = await Promise.allSettled(tareas);
    resultados.forEach((r, i) => {
      if (r.status === 'rejected') {
        // El subdominio elegido, por ejemplo, pudo habérselo llevado otro
        // mientras el pago estaba pendiente (ventana de minutos, no segundos)
        // — el negocio se queda con el subdominio auto-generado por
        // registerBusiness(). No es ideal, pero no vale la pena una
        // reserva/lock para esto todavía.
        this.logger.warn(`confirmAndCreate — ${nombres[i]} falló para ${business.id}: ${(r.reason as Error)?.message}`);
      }
    });

    await this.businessesService.publish(business.id);

    const now = new Date();
    const periodEnd = this.periodEnd(now);
    const { amount, currency } = this.plan;
    // El monto que se guarda es el que MP realmente autorizó, no el de lista:
    // si hubo descuento, se cobra el rebajado todos los meses.
    const { discount } = pending.payload as unknown as PendingPayload;
    const montoSuscripcion = discount ? discount.amountFinal : amount;
    // Un alta gratis se guarda como cortesía (origin COMP), no como paga: no
    // hay preapproval en MP, así que dejarla en PAID haría que el cron de mora
    // la persiguiera buscando cobros que nunca van a existir y terminara
    // suspendiéndola. Como toda cortesía, vence al final del período y se
    // renueva desde la ficha del negocio.
    const subscription = await this.prisma.subscription.upsert({
      where: { businessId: business.id },
      update: { status: 'ACTIVE', ...(esGratis ? {} : { mpPreapprovalId: preapprovalId }), currentPeriodStart: now, currentPeriodEnd: periodEnd },
      create: {
        businessId: business.id,
        origin: esGratis ? 'COMP' : 'PAID',
        status: 'ACTIVE',
        plan: 'starter',
        amount: montoSuscripcion,
        currency,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        mpPreapprovalId: esGratis ? null : preapprovalId,
      },
    });
    void subscription;

    // Recién acá se consume el uso del código: si se contara al pedir el link
    // de pago, cada checkout abandonado quemaría un uso. No bloqueante — el
    // negocio ya está activo y ya se le cobró el precio con descuento, así que
    // si esto falla se registra y sigue, en vez de dejar el alta a medio hacer.
    if (discount) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const consumido = await this.consumirDescuento(tx, discount.codeId);
          if (!consumido) {
            this.logger.warn(
              `El código ${discount.code} ya no estaba disponible al confirmar ${business.id}; se respeta el precio autorizado en MP igual`,
            );
          }
          await tx.platformDiscountRedemption.create({
            data: {
              codeId: discount.codeId,
              businessId: business.id,
              email: account.email,
              amountBase: new Prisma.Decimal(discount.amountBase),
              amountFinal: new Prisma.Decimal(discount.amountFinal),
            },
          });
        });
      } catch (err) {
        this.logger.error(`No se pudo registrar el uso del código ${discount.code} para ${business.id}: ${(err as Error)?.message}`);
      }
    }

    // Sin external_reference, recordPayment() no va a poder resolver a qué
    // negocio corresponde cada cobro recurrente futuro — se lo seteamos recién
    // ahora que existe el businessId. No bloqueante: si esto falla, el negocio
    // ya está activo, solo se pierde el anclaje del historial de cobros (y
    // reconcileOverdueSubscriptions igual reconcilia por mpPreapprovalId).
    if (!esGratis) {
      try {
        await this.preapproval.update({ id: preapprovalId, body: { external_reference: business.id } });
      } catch (err) {
        this.logger.warn(`No se pudo actualizar external_reference en MP para ${preapprovalId}: ${this.mpErrorMessage(err)}`);
      }
    }

    const session = await this.authService.issueSession(memberId, 'member', business.id);
    await this.prisma.pendingSignup.deleteMany({ where: { preapprovalId } });

    return {
      activated: true,
      subdomain: business.subdomain,
      // La pantalla de vuelta habla de "débito automático configurado", que en
      // un alta gratis sería mentira: no hay nada agendado en MP.
      free: esGratis,
      accessToken: session.token,
      refreshToken: session.refreshToken,
    };
  }

  private decodeDataUrl(dataUrl: string): { buffer: Buffer; mimetype: string; originalname: string } {
    const [header, base64] = dataUrl.split(',');
    const mimetype = header.match(/data:(.*);base64/)?.[1] ?? 'image/png';
    const ext = mimetype.split('/')[1] ?? 'png';
    return { buffer: Buffer.from(base64, 'base64'), mimetype, originalname: `logo.${ext}` };
  }

  // ── Registro de cada cobro (historial de facturación) ─────────────────────

  // Registra en subscription_payments el resultado de un débito automático y,
  // si fue aprobado, renueva el período y saca al negocio de la mora. Es
  // idempotente por mpPaymentId: si MP reenvía el mismo pago, no se duplica.
  async recordPayment(mpPaymentId: string) {
    const pago = await this.payment.get({ id: mpPaymentId });

    // MP propaga el external_reference del preapproval (= businessId, seteado
    // en confirmAndCreate) a cada cobro recurrente. Es nuestro anclaje para
    // saber de qué negocio es.
    const businessId = pago.external_reference;
    if (!businessId) {
      this.logger.warn(`Pago ${mpPaymentId} sin external_reference — se ignora`);
      return { recorded: false };
    }

    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub) {
      this.logger.warn(`Pago ${mpPaymentId}: no hay suscripción para business ${businessId}`);
      return { recorded: false };
    }

    // Idempotencia: si ya registramos este pago de MP, no lo duplicamos.
    const yaRegistrado = await this.prisma.subscriptionPayment.findFirst({
      where: { subscriptionId: sub.id, mpPaymentId },
    });
    if (yaRegistrado) return { recorded: false, duplicated: true };

    const aprobado = pago.status === 'approved';
    const now = new Date();
    // El cobro paga el período que arranca cuando vencía el anterior.
    const periodStart = sub.currentPeriodEnd < now ? sub.currentPeriodEnd : now;
    const periodEnd = this.periodEnd(periodStart);

    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionPayment.create({
        data: {
          subscriptionId: sub.id,
          amount: new Prisma.Decimal(pago.transaction_amount ?? Number(sub.amount)),
          status: aprobado ? 'APPROVED' : 'FAILED',
          periodStart,
          periodEnd,
          mpPaymentId,
          paidAt: aprobado ? (pago.date_approved ? new Date(pago.date_approved) : now) : null,
          failedReason: aprobado ? null : (pago.status_detail ?? pago.status ?? 'rechazado'),
        },
      });

      // Un cobro aprobado renueva el período y reactiva si estaba en mora.
      if (aprobado) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
        });
        // Si había sido despublicado por falta de pago, vuelve al aire.
        await tx.business.update({ where: { id: businessId }, data: { isActive: true, isPaused: false } });
      }
    });

    return { recorded: true, approved: aprobado };
  }

  // ── Webhook ──────────────────────────────────────────────────────────────

  // MP avisa acá cada vez que la suscripción cambia de estado o se cobra un
  // período. Nunca confiamos en el contenido del webhook como fuente de verdad:
  // sacamos el id y volvemos a preguntarle a MP el estado real.
  //
  // `headers`/`query` se usan para validar la firma HMAC de MP (si hay secret
  // configurado). El validador reconstruye el manifiesto con esos datos, no
  // necesita el body crudo.
  async handleWebhook(
    body: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined> = {},
    query: Record<string, string | string[] | undefined> = {},
  ) {
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (secret) {
      try {
        WebhookSignatureValidator.validate({
          xSignature: headers['x-signature'],
          xRequestId: headers['x-request-id'],
          dataId: query['data.id'] ?? (body?.data as { id?: string })?.id,
          secret,
          // (2026-08-18) SIN `toleranceSeconds` — mismo bug real del SDK
          // oficial (mercadopago@3.2.0) documentado en
          // mercadopago.service.ts `handlePaymentsWebhookRequest()`: compara
          // el `ts` del header (segundos) contra `Date.now()` (milisegundos)
          // sin convertir unidades, así que con ese chequeo prendido
          // CUALQUIER webhook real tira "TimestampOutOfTolerance" siempre.
          // Seguro sacarlo: este handler nunca confía en el contenido del
          // webhook, siempre vuelve a preguntarle a MP el estado real antes
          // de tocar la suscripción (ver comentario arriba de este método).
        });
      } catch (err) {
        if (err instanceof InvalidWebhookSignatureError) {
          this.logger.warn(`Webhook con firma inválida (${err.reason}) — se ignora`);
          // 200 igual: no le damos pistas a un atacante ni gatillamos reintentos.
          return { received: true };
        }
        throw err;
      }
    }

    // El tipo distingue un cambio de la suscripción de un cobro concreto.
    const type = (body?.type ?? body?.action ?? '') as string;
    const data = body?.data as { id?: string } | undefined;
    const id = data?.id ?? (body?.id as string | undefined);
    if (!id) {
      this.logger.warn('Webhook de MP sin id — se ignora');
      return { received: true };
    }

    try {
      if (type.includes('payment')) {
        const result = await this.recordPayment(String(id));
        this.logger.log(`Webhook pago ${id}: ${JSON.stringify(result)}`);
      } else {
        // subscription_preapproval y afines: confirmar (crea la cuenta si
        // corresponde) o reconciliar estado.
        const result = await this.confirmAndCreate(String(id));
        this.logger.log(`Webhook preapproval ${id}: ${JSON.stringify(result)}`);
      }
    } catch (err) {
      // Nunca devolvemos error a MP: si respondemos != 2xx reintenta en loop.
      // Queda logueado para revisarlo a mano.
      this.logger.error(`Webhook de MP ${id} (${type}) falló`, err as Error);
    }
    return { received: true };
  }

  // ── Crons: ciclo de vida de la suscripción ────────────────────────────────

  // Mora: reconcilia las suscripciones cuyo período venció. NO decide la mora
  // solo por la fecha: le vuelve a preguntar a MP el estado real del preapproval
  // (MP reintenta los cobros fallidos por su cuenta), así evitamos suspender a
  // alguien solo porque no nos llegó el webhook. La fecha + gracia es el
  // backstop cuando MP ya no considera activa la suscripción.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async reconcileOverdueSubscriptions() {
    const now = new Date();

    // ── Pagas: reconciliar contra MP (gracia → suspensión) ───────────────────
    if (this.mpConfigured) {
      // Candidatas: pagas, vigentes o ya en mora, con el período vencido.
      const vencidas = await this.prisma.subscription.findMany({
        where: {
          origin: 'PAID',
          status: { in: ['ACTIVE', 'PAST_DUE'] },
          currentPeriodEnd: { lt: now },
        },
      });

      for (const sub of vencidas) {
        try {
          if (sub.mpPreapprovalId) {
            const mp = await this.preapproval.get({ id: sub.mpPreapprovalId });
            // MP la sigue considerando activa → el cobro está al día por su lado,
            // probablemente nos perdimos el webhook del pago. No la penalizamos.
            if (mp.status === 'authorized') continue;
          }

          const graceEnd = new Date(sub.currentPeriodEnd);
          graceEnd.setDate(graceEnd.getDate() + sub.gracePeriodDays);

          if (now < graceEnd) {
            // Dentro de la gracia: marcar PAST_DUE pero seguir publicado.
            if (sub.status !== 'PAST_DUE') {
              await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'PAST_DUE' } });
              this.logger.log(`Suscripción ${sub.id} → PAST_DUE (gracia hasta ${graceEnd.toISOString()})`);
            }
          } else {
            // Gracia agotada: suspender y bajar la tienda (mismo criterio que la
            // suspensión manual del superadmin en platform.service.ts).
            await this.prisma.$transaction([
              this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'SUSPENDED' } }),
              this.prisma.business.update({ where: { id: sub.businessId }, data: { isPaused: true } }),
            ]);
            this.logger.log(`Suscripción ${sub.id} → SUSPENDED (gracia vencida)`);
          }
        } catch (err) {
          this.logger.error(`No se pudo reconciliar la suscripción ${sub.id}`, err as Error);
        }
      }
    }

    // ── Cortesías (RBT-651): no dependen de MP, corren siempre ───────────────
    // No hay gracia: una comp es un regalo con fecha de fin fija que el admin
    // ya conocía al otorgarla — vencida sin que nadie la haya renovado pasa
    // directo a SUSPENDED, mismo destino final que documenta el comentario del
    // modelo (`schema.prisma`, campo `currentPeriodEnd` de `Subscription`).
    const compsVencidas = await this.prisma.subscription.findMany({
      where: { origin: 'COMP', status: 'ACTIVE', currentPeriodEnd: { lt: now } },
    });
    for (const sub of compsVencidas) {
      try {
        await this.prisma.$transaction([
          this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'SUSPENDED' } }),
          this.prisma.business.update({ where: { id: sub.businessId }, data: { isPaused: true } }),
        ]);
        this.logger.log(`Suscripción comp ${sub.id} → SUSPENDED (licencia de cortesía vencida)`);
      } catch (err) {
        this.logger.error(`No se pudo reconciliar la comp ${sub.id}`, err as Error);
      }
    }
  }

  // Limpieza de altas pendientes vencidas: si nunca se confirmó el pago (el
  // usuario abandonó en MP y nunca volvió, y el webhook tampoco llegó nunca),
  // el PendingSignup queda huérfano. A diferencia del viejo barrido de
  // negocios draft, esto es de bajo riesgo: la tabla no tiene ninguna relación
  // ni cascada, borrar una fila vieja no afecta nada más.
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupExpiredPendingSignups() {
    const hours = Number(this.config.get<string>('PENDING_SIGNUP_TTL_HOURS') ?? 48);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const { count } = await this.prisma.pendingSignup.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) this.logger.log(`Altas pendientes vencidas borradas: ${count}`);
  }

  // ── Lectura ──────────────────────────────────────────────────────────────

  async getForBusiness(businessId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub) throw new NotFoundException('Este negocio no tiene una suscripción');
    return {
      id: sub.id,
      origin: sub.origin,
      status: sub.status,
      plan: sub.plan,
      amount: Number(sub.amount),
      currency: sub.currency,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      gracePeriodDays: sub.gracePeriodDays,
      grantReason: sub.grantReason,
    };
  }

  async getPayments(businessId: string, page = 1, limit = 20) {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub) throw new NotFoundException('Este negocio no tiene una suscripción');

    const [items, total] = await Promise.all([
      this.prisma.subscriptionPayment.findMany({
        where: { subscriptionId: sub.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.subscriptionPayment.count({ where: { subscriptionId: sub.id } }),
    ]);

    return {
      data: items.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paidAt: p.paidAt,
        failedReason: p.failedReason,
      })),
      total,
      page,
      limit,
    };
  }
}
