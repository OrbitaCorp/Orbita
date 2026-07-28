import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { PrismaService } from '../prisma/prisma.service';

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

type PlanConfig = {
  amount: number;
  frequency: number;
  frequencyType: 'days' | 'months';
  currency: string;
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private _preapproval: PreApproval | undefined;
  private _payment: Payment | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

  private periodEnd(from: Date): Date {
    const { frequency, frequencyType } = this.plan;
    const end = new Date(from);
    if (frequencyType === 'days') end.setDate(end.getDate() + frequency);
    else end.setMonth(end.getMonth() + frequency);
    return end;
  }

  // ── Alta de la suscripción ───────────────────────────────────────────────

  // Devuelve el link de MP al que hay que mandar al dueño para que autorice el
  // débito. No crea la Subscription todavía: recién existe cuando MP confirma
  // que quedó autorizada (ver activateFromPreapproval).
  async startCheckout(businessId: string, memberId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    // El pagador es el dueño que está haciendo el alta: MP le manda a ese mail
    // el comprobante de cada cobro.
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    const payerEmail = member.email;

    const { amount, frequency, frequencyType, currency } = this.plan;
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    let response;
    try {
      response = await this.preapproval.create({
        body: {
          reason: `Órbita — ${business.name}`,
          // Nos permite reconocer a qué negocio corresponde cuando MP nos avisa
          // por webhook, sin depender de que el navegador vuelva.
          external_reference: businessId,
          payer_email: payerEmail,
          back_url: `${frontendUrl}/onboarding/pago-retorno`,
          status: 'pending',
          auto_recurring: {
            frequency,
            frequency_type: frequencyType,
            transaction_amount: amount,
            currency_id: currency,
          },
        },
      });
    } catch (err) {
      // El SDK de MP tira un objeto propio { message, status } — NO una
      // instancia real de Error (confirmado probándolo contra MP real), así
      // que `err instanceof Error` es falso y se perdía el mensaje real
      // (ej: "Cannot pay an amount lower than $ 15.00") detrás de un fallback
      // genérico. Se chequea la forma del objeto en vez del tipo.
      const motivo =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'MercadoPago rechazó la solicitud';
      this.logger.warn(`MP rechazó la creación del preapproval: ${motivo}`);
      throw new BadRequestException(`MercadoPago rechazó el alta: ${motivo}`);
    }

    if (!response.id || !response.init_point) {
      throw new BadRequestException('MercadoPago no devolvió un link de pago válido');
    }
    return { preapprovalId: response.id, initPoint: response.init_point };
  }

  // ── Confirmación ─────────────────────────────────────────────────────────

  // Le pregunta a MP el estado real de la suscripción y, si quedó autorizada,
  // crea/actualiza la Subscription y publica el negocio. Es idempotente: se
  // llama tanto desde el webhook como desde la vuelta del navegador, y las dos
  // rutas pueden llegar (o no) en cualquier orden.
  async activateFromPreapproval(preapprovalId: string) {
    const mp = await this.preapproval.get({ id: preapprovalId });
    const businessId = mp.external_reference;
    if (!businessId) {
      this.logger.warn(`Preapproval ${preapprovalId} sin external_reference — se ignora`);
      return { status: mp.status ?? 'unknown', activated: false };
    }

    // MP usa 'authorized' cuando el dueño confirmó y el débito quedó activo.
    if (mp.status !== 'authorized') {
      return { status: mp.status ?? 'unknown', activated: false };
    }

    const now = new Date();
    const periodEnd = this.periodEnd(now);
    const { amount, currency } = this.plan;

    const subscription = await this.prisma.subscription.upsert({
      where: { businessId },
      update: {
        status: 'ACTIVE',
        mpPreapprovalId: preapprovalId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      create: {
        businessId,
        origin: 'PAID',
        status: 'ACTIVE',
        plan: 'starter',
        amount,
        currency,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        mpPreapprovalId: preapprovalId,
      },
    });

    // El negocio se publica recién acá: hasta que el pago no queda autorizado,
    // la tienda no sale al aire (ver PENDIENTES.md).
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: { isActive: true },
    });

    return {
      status: mp.status,
      activated: true,
      subscriptionId: subscription.id,
      subdomain: business.subdomain,
    };
  }

  // ── Registro de cada cobro (historial de facturación) ─────────────────────

  // Registra en subscription_payments el resultado de un débito automático y,
  // si fue aprobado, renueva el período y saca al negocio de la mora. Es
  // idempotente por mpPaymentId: si MP reenvía el mismo pago, no se duplica.
  async recordPayment(mpPaymentId: string) {
    const pago = await this.payment.get({ id: mpPaymentId });

    // MP propaga el external_reference del preapproval (= businessId) a cada
    // cobro recurrente. Es nuestro anclaje para saber de qué negocio es.
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
          toleranceSeconds: 300,
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
        // subscription_preapproval y afines: reconciliar estado de la suscripción.
        const result = await this.activateFromPreapproval(String(id));
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
    if (!this.mpConfigured) return; // dev sin MP: no hay nada que reconciliar.
    const now = new Date();

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

  // Barrido de negocios abandonados: los que quedaron en borrador (isActive
  // false, sin suscripción) más de N días son intentos de onboarding que nunca
  // se pagaron. Ocupan su subdominio y su email, bloqueando reintentos.
  //
  // OPERACIÓN DESTRUCTIVA: por defecto solo LOGUEA lo que borraría (dry-run).
  // Recién borra de verdad si SUBSCRIPTION_SWEEP_DELETE=true. Ver PENDIENTES.md.
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async sweepAbandonedBusinesses() {
    const days = Number(this.config.get<string>('SUBSCRIPTION_ABANDONED_DAYS') ?? 7);
    const reallyDelete = this.config.get<string>('SUBSCRIPTION_SWEEP_DELETE') === 'true';
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const candidatos = await this.prisma.business.findMany({
      where: { isActive: false, subscription: { is: null }, createdAt: { lt: cutoff } },
      select: { id: true, subdomain: true, _count: { select: { orders: true, products: true, customers: true } } },
    });

    for (const b of candidatos) {
      // Salvaguarda: si de algún modo tiene datos reales, no lo tocamos.
      if (b._count.orders > 0 || b._count.products > 0 || b._count.customers > 0) {
        this.logger.warn(`Draft ${b.subdomain} tiene datos reales — se saltea del barrido`);
        continue;
      }
      if (!reallyDelete) {
        this.logger.log(`[dry-run] borraría el draft abandonado ${b.subdomain} (${b.id})`);
        continue;
      }
      try {
        await this.deleteDraftBusiness(b.id);
        this.logger.log(`Draft abandonado borrado: ${b.subdomain} (${b.id})`);
      } catch (err) {
        this.logger.error(`No se pudo borrar el draft ${b.subdomain}`, err as Error);
      }
    }
  }

  // Borra un negocio en borrador y sus hijos en orden de FK (Business no
  // cascadea). Solo pensado para drafts vacíos — no borra productos/pedidos.
  private deleteDraftBusiness(businessId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { businessId } });
      await tx.passwordResetToken.deleteMany({ where: { businessId } });
      await tx.member.deleteMany({ where: { businessId } });      // antes que roles (FK roleId)
      await tx.role.deleteMany({ where: { businessId } });         // cascadea rolePermission
      await tx.businessConfig.deleteMany({ where: { businessId } });
      await tx.storefrontConfig.deleteMany({ where: { businessId } });
      await tx.notificationConfig.deleteMany({ where: { businessId } });
      await tx.branch.deleteMany({ where: { businessId } });
      await tx.business.delete({ where: { id: businessId } });
    });
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
