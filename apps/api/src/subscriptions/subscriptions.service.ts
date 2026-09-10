import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoConfig,
  PreApproval,
  Payment,
  Preference,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { BusinessesService } from '../businesses/businesses.service';
import { suspendidoPorPlataforma } from '../businesses/suspension';
import { BranchesService } from '../branches/branches.service';
import { AuthService } from '../auth/auth.service';
import { RegisterBusinessDto } from '../onboarding/dto/register-business.dto';
import { StartPendingCheckoutDto, PendingWizardDto } from './dto/start-pending-checkout.dto';

// Suscripción del negocio hacia Órbita (no confundir con los pagos de los
// clientes hacia el negocio, que viven en el módulo mercadopago/).
//
// DISEÑO GENERAL (planes múltiples + beneficio de bienvenida, RBT — 2026-09):
//
//   1. TODA cuenta paga arranca con el "beneficio de bienvenida": 3 meses a
//      un precio fijo, cobrado con un PAGO ÚNICO (Preference/Checkout Pro),
//      no con una preapproval. Elegir "no preapproval acá" fue deliberado:
//      una preapproval con frequency=3 meses seguiría cobrando ese monto de
//      bienvenida cada 3 meses PARA SIEMPRE si no se cancelara a tiempo — un
//      pago único no tiene ese riesgo, simplemente no vuelve a cobrar solo.
//   2. El plan elegido (mensual/semestral/anual) NO se factura todavía en
//      ese momento — queda anotado (`Subscription.plan`) pero
//      `planActive=false`. Recién se activa cuando el beneficio termina: el
//      dueño entra al panel, ve que terminó y autoriza SU preapproval real
//      (ver activatePlan/confirmPlanActivation). Por qué no queda
//      automatizado desde el día 1 con un `start_date` futuro: se investigó
//      (2026-09-07) y la documentación de MP dice que, al autorizar CUALQUIER
//      preapproval, se hace una cobranza de validación de tarjeta aparte —
//      sin relación clara con el `start_date` pedido. Eso es un cargo
//      inesperado en la tarjeta del dueño el día del alta, que no vale la
//      pena arriesgar sin poder confirmarlo primero contra un vendedor de
//      test real (el sandbox de MP exige que comprador Y vendedor sean los
//      dos de test o los dos reales para crear una preapproval; las
//      credenciales de test disponibles están atadas a una cuenta real).
//   3. Cambiar de plan (panel → Configuración → Suscripción) tampoco puede
//      aplicarse al toque: confirmado en el SDK que una preapproval ya
//      autorizada solo permite cambiar el MONTO, nunca la frecuencia — y los
//      3 planes tienen frecuencias distintas entre sí (1/6/12 meses). Un
//      cambio de plan se anota en `Subscription.nextPlan` y se activa recién
//      cuando termina el período actual, mismo mecanismo que el punto 2.
//
// DISEÑO (heredado, sin cambios): nada se crea en Business/Member hasta que
// MP confirma el pago. Los datos de la cuenta + el wizard viajan en
// `PendingSignup` (tabla temporal, ver schema.prisma) desde que se pide el
// checkout hasta que se confirma — así un pago que nunca se completa no deja
// ningún negocio/email/subdominio "ocupado" esperando que alguien lo borre a
// mano.

// Prefijo del id de alta para los códigos del 100%, que no pasan por MP. Es lo
// único que distingue un alta gratis de una paga en confirmAndCreate(), y no
// puede colisionar con un id real de MercadoPago (los suyos son numéricos o
// hexadecimales, nunca empiezan con esto).
const FREE_SIGNUP_PREFIX = 'FREE-';

// Prefijo de la referencia sintética de un PendingSignup PAGO (no gratis)
// mientras cursa el beneficio de bienvenida. No es un id de MP: es lo que
// este backend le pone como `external_reference` a la Preference de pago
// único, para poder encontrar el PendingSignup correspondiente cuando llega
// el webhook del pago — el negocio todavía no existe en ese momento, así que
// no hay businessId para usar como referencia (a diferencia de los cobros
// recurrentes de un plan ya activo, que sí usan el businessId).
const PENDING_REF_PREFIX = 'PEND-';

// Exportados (no solo de uso interno): subscriptions.controller.ts los
// necesita para validar el `?plan=` de GET /discount/:code sin duplicar la
// lista de keys ahí también.
export type PlanKey = 'mensual' | 'semestral' | 'anual' | 'mensualAvanzado';
const PLAN_KEYS: readonly PlanKey[] = ['mensual', 'semestral', 'anual', 'mensualAvanzado'];

export function esPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && (PLAN_KEYS as readonly string[]).includes(v);
}

// Único punto de verdad para "esta key incluye el paquete Avanzado" — lo usan
// tanto la elección de tier de bienvenida como el sync de BusinessAddon (ver
// syncAddonAvanzado). Hoy solo 'mensualAvanzado' lo incluye; si algún día
// existiera un 'semestralAvanzado', se suma acá y todo lo demás lo hereda.
function incluyeAvanzado(plan: PlanKey): boolean {
  return plan === 'mensualAvanzado';
}

type CicloConfig = { amount: number; frequency: number; frequencyType: 'days' | 'months' };

// Beneficio de bienvenida — ver punto 1 del comentario de arriba. Dos tiers
// desde 2026-09 (RBT — rediseño "Base"/"Base + Avanzado"): antes había una
// sola bienvenida fija sin relación con el plan elegido, que era justamente
// la fuente de la confusión reportada en el checkout ("elegís un plan pero no
// ves su costo reflejado"). Ahora la tarjeta elegida determina el monto.
//
// $5.500 en vez de $5.000, $10.900 en vez de $10.000: MP cobra una comisión
// real de 6,29% + IVA "al instante" sobre Suscripciones en la mayoría de las
// provincias, incluida Misiones (confirmado contra la documentación oficial
// de MP el 2026-09-07, *no* contra el simulador genérico de "cobrar/recibir
// dinero", que es un producto distinto) — 7,61% efectivo sobre el monto
// cobrado. Fórmula: bruto = neto_objetivo / 0.9239, redondeado HACIA ARRIBA
// al centenar más cercano (nunca hacia abajo, para no cobrar de menos por
// redondeo) — así $5.500 hace que Órbita reciba al menos $5.000 limpios, y
// $10.900 que reciba al menos $10.000 limpios.
const BIENVENIDA_TIERS: { base: CicloConfig; avanzado: CicloConfig } = {
  base: { amount: 5500, frequency: 3, frequencyType: 'months' },
  avanzado: { amount: 10900, frequency: 3, frequencyType: 'months' },
};

// Los planes reales. Igual que BIENVENIDA_TIERS, ya incluyen la comisión real
// de MP: el monto de lista es lo que Órbita recibe LIMPIO, no lo que se cobra.
//   Mensual:            $15.000 netos/mes  -> $16.500/mes
//   Semestral:          $13.500 netos/mes  -> $88.000 cada 6 meses (~$14.667/mes)
//   Anual:               $12.000 netos/mes  -> $156.000/año ($13.000/mes)
//   Mensual + Avanzado: $20.000 netos/mes  -> $21.700/mes (mismo redondeo que
//     arriba: 20000/0.9239=21647.36 -> $21.700). UN SOLO cargo combinado —
//     el paquete Avanzado nunca se factura aparte, ver syncAddonAvanzado.
const PLANES: Record<PlanKey, CicloConfig> = {
  mensual: { amount: 16500, frequency: 1, frequencyType: 'months' },
  semestral: { amount: 88000, frequency: 6, frequencyType: 'months' },
  anual: { amount: 156000, frequency: 12, frequencyType: 'months' },
  mensualAvanzado: { amount: 21700, frequency: 1, frequencyType: 'months' },
};

// Lo que se guarda en PendingSignup.payload. La contraseña viaja en texto
// plano acá (trade-off documentado en PENDIENTES.md) porque registerBusiness()
// la hashea internamente y no vale la pena tocar su firma para esto — la fila
// vive minutos/horas como mucho, en la misma base que ya guarda passwordHash.
type PendingPayload = {
  account: RegisterBusinessDto;
  wizard: PendingWizardDto;
  // Plan elegido en el checkout — no se factura todavía (ver comentario de
  // arriba), pero queda guardado desde el día 1 para saber qué activar
  // cuando termine el beneficio de bienvenida.
  plan: PlanKey;
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
  private _preference: Preference | undefined;

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

  private get preference(): Preference {
    if (!this._preference) this._preference = new Preference(this.mpConfig());
    return this._preference;
  }

  private get currency(): string {
    return this.config.get<string>('MP_SUBSCRIPTION_CURRENCY') ?? 'ARS';
  }

  // El precio de verdad NO sale de env, sale de BIENVENIDA_TIERS/PLANES.
  //
  // Antes salía de MP_SUBSCRIPTION_AMOUNT/FREQUENCY/FREQUENCY_TYPE, y un valor
  // de prueba olvidado en el hosting (15 cada 3 días, que es el minimo que
  // acepta MP) estuvo cobrandole eso a los negocios reales en vez de $5.000
  // cada 3 meses. Un precio que se puede pisar sin querer desde un panel, y sin
  // que nada avise, no puede ser la fuente de verdad de lo que se le cobra a la
  // gente.
  //
  // Las env siguen sirviendo para probar el beneficio de bienvenida con
  // montos y ciclos cortos, pero hay que pedirlo EXPRESAMENTE con
  // MP_PLAN_OVERRIDE=true. Así el override es una decisión explícita y no
  // algo que quedó prendido. El override es GENÉRICO, no por tier: pisa el
  // monto/ciclo de la tier que hubiese correspondido según el plan, para
  // poder probar cualquiera de las dos con montos cortos sin tocar código.
  // Los planes reales (recurrentes) no tienen override — son precios fijos,
  // probar su activación se hace con el flujo real.
  private bienvenidaParaPlan(plan: PlanKey): CicloConfig & { currency: string } {
    const currency = this.currency;
    const tier = incluyeAvanzado(plan) ? BIENVENIDA_TIERS.avanzado : BIENVENIDA_TIERS.base;
    if (this.config.get<string>('MP_PLAN_OVERRIDE') !== 'true') {
      return { ...tier, currency };
    }

    const frequencyType = this.config.get<string>('MP_SUBSCRIPTION_FREQUENCY_TYPE') ?? tier.frequencyType;
    if (frequencyType !== 'days' && frequencyType !== 'months') {
      throw new BadRequestException('MP_SUBSCRIPTION_FREQUENCY_TYPE debe ser "days" o "months"');
    }
    const ciclo: CicloConfig & { currency: string } = {
      amount: Number(this.config.get<string>('MP_SUBSCRIPTION_AMOUNT') ?? tier.amount),
      frequency: Number(this.config.get<string>('MP_SUBSCRIPTION_FREQUENCY') ?? tier.frequency),
      frequencyType,
      currency,
    };
    this.logger.warn(
      `MP_PLAN_OVERRIDE activo: el beneficio de bienvenida (tier ${incluyeAvanzado(plan) ? 'avanzado' : 'base'}) cobra ${ciclo.amount} ${ciclo.currency} cada ${ciclo.frequency} ${ciclo.frequencyType} en vez del monto real. Que esto NO quede prendido en produccion.`,
    );
    return ciclo;
  }

  // Conveniencia para lugares que necesitan "la bienvenida" sin tener un plan
  // concreto a mano (ej. limitesDescuento(), que calcula un tope de % válido
  // para un código genérico, no para un checkout puntual) — siempre resuelve
  // a la tier base, la más barata y por lo tanto la más conservadora.
  private get bienvenidaBase(): CicloConfig & { currency: string } {
    return this.bienvenidaParaPlan('mensual');
  }

  private cicloDelPlan(plan: string): CicloConfig {
    const ciclo = PLANES[plan as PlanKey];
    if (!ciclo) throw new BadRequestException(`Plan desconocido: ${plan}`);
    return ciclo;
  }

  // Monto mínimo que acepta MP por cobro, configurable porque depende del país
  // y de la moneda y MP lo cambia sin avisar. Si algún día sube, se ajusta acá
  // sin tocar código.
  private get montoMinimo(): number {
    return Number(this.config.get<string>('MP_MIN_TRANSACTION_AMOUNT') ?? 15);
  }

  // Hasta que porcentaje se puede descontar sin que el cobro caiga por debajo
  // del minimo de MP. Lo usa el panel para no dejar crear un codigo que despues
  // va a reventar recien al pagar. Solo aplica al beneficio de bienvenida: es
  // lo único que se paga en el checkout, los 3 planes se activan después y no
  // pasan por códigos de descuento.
  //
  // El 100% NO entra en este limite y siempre esta permitido: ese camino no
  // habla con MP (ver startCheckoutPending), asi que ningun minimo lo afecta.
  //
  // Si el plan cuesta lo mismo que el minimo, maxPercentOff da 0: ahi no existe
  // ningun descuento parcial posible y el 100% es la unica opcion.
  limitesDescuento(): { amountBase: number; minAmount: number; maxPercentOff: number } {
    const { amount } = this.bienvenidaBase;
    const minAmount = this.montoMinimo;
    const maxPercentOff = amount <= minAmount ? 0 : Math.floor((1 - minAmount / amount) * 100);
    return { amountBase: amount, minAmount, maxPercentOff };
  }

  private periodEnd(from: Date, ciclo: { frequency: number; frequencyType: 'days' | 'months' }): Date {
    const end = new Date(from);
    if (ciclo.frequencyType === 'days') end.setDate(end.getDate() + ciclo.frequency);
    else end.setMonth(end.getMonth() + ciclo.frequency);
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

  // Pide el link de MP para pagar el beneficio de bienvenida, SIN crear nada
  // en Business ni Member — los datos de la cuenta y el wizard quedan en
  // PendingSignup hasta que MP confirma (ver confirmAndCreate). Rechaza
  // temprano si el email ya está en uso, para no generar un link que después
  // no se puede usar.
  async startCheckoutPending(dto: StartPendingCheckoutDto) {
    const { available } = await this.onboardingService.checkEmail(dto.account.email);
    if (!available) {
      throw new ConflictException('Este email ya tiene un negocio registrado en Orbita');
    }

    const { amount, currency } = this.bienvenidaParaPlan(dto.plan);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    // El descuento se resuelve ANTES de hablar con MP: lo que se le manda a
    // cobrar tiene que ser exactamente el precio con descuento, no el de lista.
    const discount = await this.resolverDescuento(dto.discountCode, amount);
    const montoACobrar = discount ? discount.amountFinal : amount;

    // Código del 100%: no hay nada que cobrar, así que no se habla con MP —
    // una Preference con unit_price 0 la rechaza. Se guarda el mismo
    // PendingSignup de siempre pero con un id sintético, y se manda al dueño a
    // la MISMA pantalla de vuelta que usa el pago real: ahí
    // confirmAndCreate() crea la cuenta y devuelve la sesión por el BFF, sin
    // ningún camino paralelo que pueda divergir del probado.
    // Se exige el descuento explicito y no solo `montoACobrar === 0`: si algun
    // dia el precio del beneficio quedara en 0 por un .env mal cargado, esa
    // version regalaria TODAS las altas en silencio. Asi, sin un codigo del
    // 100% de por medio, un precio invalido sigue fallando contra MP y se nota.
    if (discount && discount.amountFinal === 0) {
      const ref = `${FREE_SIGNUP_PREFIX}${randomUUID()}`;
      const payload: PendingPayload = { account: dto.account, wizard: dto.wizard, plan: dto.plan, ...(discount ? { discount } : {}) };
      await this.prisma.pendingSignup.create({
        data: { preapprovalId: ref, payload: payload as unknown as Prisma.InputJsonValue },
      });
      return {
        preapprovalId: ref,
        initPoint: `${frontendUrl}/onboarding/pago-retorno?preapproval_id=${ref}`,
        free: true,
      };
    }

    // Pago único (Preference/Checkout Pro), no preapproval — ver el comentario
    // de diseño al principio del archivo (punto 1). `ref` es nuestra propia
    // referencia sintética: el negocio todavía no existe, así que no hay
    // businessId que usar como external_reference todavía.
    const ref = `${PENDING_REF_PREFIX}${randomUUID()}`;
    let response;
    try {
      response = await this.preference.create({
        body: {
          items: [
            {
              id: 'bienvenida',
              title: 'Órbita — beneficio de bienvenida (3 meses)',
              quantity: 1,
              unit_price: montoACobrar,
              currency_id: currency,
            },
          ],
          payer: { email: dto.account.email },
          external_reference: ref,
          back_urls: {
            success: `${frontendUrl}/onboarding/pago-retorno`,
            pending: `${frontendUrl}/onboarding/pago-retorno`,
            failure: `${frontendUrl}/onboarding/pago-retorno`,
          },
          auto_return: 'approved',
        },
      });
    } catch (err) {
      const motivo = this.mpErrorMessage(err);
      // Crudo y completo: `mpErrorMessage` resume, pero si MP suma un campo
      // nuevo esto es lo unico que lo deja ver sin volver a desplegar.
      this.logger.warn(
        `MP rechazó la creación de la preference de bienvenida (monto ${montoACobrar} ${currency}, payer ${dto.account.email}): ${motivo} — crudo: ${JSON.stringify(err, Object.getOwnPropertyNames(Object(err))).slice(0, 1500)}`,
      );
      throw new BadRequestException(`MercadoPago rechazó el alta: ${motivo}`);
    }

    if (!response.id || !response.init_point) {
      throw new BadRequestException('MercadoPago no devolvió un link de pago válido');
    }

    const payload: PendingPayload = { account: dto.account, wizard: dto.wizard, plan: dto.plan, ...(discount ? { discount } : {}) };
    await this.prisma.pendingSignup.create({
      data: { preapprovalId: ref, payload: payload as unknown as Prisma.InputJsonValue },
    });

    // El campo se sigue llamando `preapprovalId` en la respuesta (y en
    // ConfirmSubscriptionDto/pago-retorno.tsx) por compatibilidad con esas dos
    // capas — dejó de ser literalmente un id de preapproval, ahora es esta
    // referencia sintética (`ref`), pero el contrato externo no cambió.
    return { preapprovalId: ref, initPoint: response.init_point, free: false };
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
  // divergir (que la preview diga una cosa y el cobro haga otra). Necesita
  // `plan` desde 2026-09 (rediseño "Base"/"Base + Avanzado"): cada tarjeta
  // tiene su propio monto de bienvenida, así que el código se previsualiza
  // contra la que esté eligiendo el usuario en ese momento, no una fija.
  async previewDiscount(code: string, plan: PlanKey) {
    const { amount, currency } = this.bienvenidaParaPlan(plan);
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
  //
  // `ref` es el `preapprovalId` sintético de startCheckoutPending: para un
  // alta gratis, el id con prefijo FREE-; para una paga, la referencia PEND-
  // que se le puso como external_reference a la Preference del beneficio de
  // bienvenida.
  async confirmAndCreate(ref: string) {
    const pending = await this.prisma.pendingSignup.findUnique({ where: { preapprovalId: ref } });
    if (!pending) {
      return { activated: false, status: 'already_consumed_or_unknown' };
    }

    // Alta gratis por código del 100%: no existe pago que consultar. El
    // permiso ya se validó al pedir el checkout (el código estaba activo, no
    // vencido y con usos disponibles) y quedó registrado en el PendingSignup,
    // que es de un solo uso — así que llegar acá con este id ES la autorización.
    const esGratis = ref.startsWith(FREE_SIGNUP_PREFIX);
    if (!esGratis) {
      // A diferencia de la preapproval vieja (un GET por id alcanzaba), acá no
      // tenemos el id del pago — solo nuestra propia referencia. Se busca por
      // external_reference, que es lo que se le puso a la Preference al
      // crearla.
      let busqueda;
      try {
        busqueda = await this.payment.search({ options: { external_reference: ref } });
      } catch (err) {
        this.logger.warn(`No se pudo buscar el pago de bienvenida para ${ref}: ${this.mpErrorMessage(err)}`);
        return { activated: false, status: 'search_failed' };
      }
      const aprobado = (busqueda.results ?? []).find((p) => p.status === 'approved');
      if (!aprobado?.id) {
        // Todavía no pagó (o MP no lo confirmó todavía) — no se borra el
        // PendingSignup, puede confirmar más tarde (reintento manual o el
        // webhook cuando MP avise).
        const estado = (busqueda.results ?? [])[0]?.status ?? 'unknown';
        return { activated: false, status: estado };
      }
    }

    const { account, wizard, plan, discount } = pending.payload as unknown as PendingPayload;

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
          await this.prisma.pendingSignup.deleteMany({ where: { preapprovalId: ref } });
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

    const now = new Date();
    const { frequency, frequencyType, amount: montoBienvenida, currency } = this.bienvenidaParaPlan(plan);
    const periodEnd = this.periodEnd(now, { frequency, frequencyType });
    // El monto que se guarda es el que MP realmente autorizó, no el de lista:
    // si hubo descuento, se cobra el rebajado.
    const montoSuscripcion = discount ? discount.amountFinal : montoBienvenida;
    // Un alta gratis se guarda como cortesía (origin COMP), no como paga: no
    // hay pago ni preapproval en MP, así que dejarla en PAID haría que el cron
    // de mora la persiguiera buscando cobros que nunca van a existir y
    // terminara suspendiéndola. Como toda cortesía, vence al final del período
    // y se renueva desde la ficha del negocio — el plan elegido no se factura
    // nunca (`planActive: true` de entrada para que el flujo de activación no
    // la toque).
    //
    // Se crea ANTES de publish() a propósito (auditoría de seguridad,
    // 2026-09-08): BusinessesService.publish() exige que exista una fila de
    // Subscription antes de dejar `isActive: true` — es el único gate real
    // contra activar una tienda sin haber pasado por acá (ver publish()).
    const subscription = await this.prisma.subscription.upsert({
      where: { businessId: business.id },
      update: { status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd },
      create: {
        businessId: business.id,
        origin: esGratis ? 'COMP' : 'PAID',
        status: 'ACTIVE',
        plan,
        planActive: esGratis,
        amount: montoSuscripcion,
        currency,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        mpPreapprovalId: null,
      },
    });
    void subscription;

    // Sin condicionar a esGratis: una cortesía con plan 'mensualAvanzado'
    // también recibe el addon — ver el comentario de syncAddonAvanzado.
    await this.syncAddonAvanzado(this.prisma, business.id, plan, periodEnd);

    await this.businessesService.publish(business.id);

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

    const session = await this.authService.issueSession(memberId, 'member', business.id);
    await this.prisma.pendingSignup.deleteMany({ where: { preapprovalId: ref } });

    return {
      activated: true,
      subdomain: business.subdomain,
      // Lo necesita la pantalla de vuelta para entrar al panel por la ruta
      // legacy (/admin/{id}/...) en los entornos donde la sesion no viaja al
      // subdominio — en dev, con ROOT_DOMAIN=localhost, la cookie es host-only.
      businessId: business.id,
      // La pantalla de vuelta habla de "beneficio de bienvenida activo", que en
      // un alta gratis sería mentira: no hay nada cobrado ni agendado en MP.
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

  // ── Paquete Avanzado (RBT — rediseño "Base"/"Base + Avanzado", 2026-09) ──

  // Mantiene BusinessAddon('ADVANCED') en espejo EXACTO del período de la
  // suscripción: se reescribe explícitamente en cada lugar que toca
  // `currentPeriodEnd` (confirmAndCreate, confirmPlanActivation,
  // recordPayment) — nunca se asume que un `expiresAt` viejo sigue vigente.
  // `grantedBy` queda null a propósito: distingue esto (otorgado por el
  // sistema vía la suscripción) de un otorgamiento manual de un
  // platform_admin, que sigue siendo un camino válido aparte (ver
  // BusinessesService.getAddons/hasActiveAddon).
  //
  // Efecto secundario deliberado: como `expiresAt` nunca se extiende sin
  // pasar por uno de esos 3 puntos, el acceso a las funciones de Avanzado
  // (AddonGuard) se apaga apenas vence el período — incluso antes que
  // arranque la gracia de la tienda (reconcileOverdueSubscriptions). No hace
  // falta ningún revoke explícito ahí: alcanza con no volver a extender.
  private async syncAddonAvanzado(
    tx: Prisma.TransactionClient | PrismaService,
    businessId: string,
    plan: PlanKey,
    periodEnd: Date,
  ): Promise<void> {
    const activo = incluyeAvanzado(plan);
    await tx.businessAddon.upsert({
      where: { businessId_type: { businessId, type: 'ADVANCED' } },
      create: { businessId, type: 'ADVANCED', isActive: activo, expiresAt: activo ? periodEnd : new Date(), grantedBy: null },
      update: { isActive: activo, expiresAt: activo ? periodEnd : new Date() },
    });
  }

  // ── Activación del plan elegido (fin del beneficio / cambio de plan) ─────

  // Arma el link de MP para que el dueño autorice la preapproval de SU plan
  // real — se llama desde el panel una vez que `currentPeriodEnd` ya pasó
  // (el beneficio de bienvenida terminó, o el período del plan anterior si
  // esto es un cambio de plan con `nextPlan` seteado). No toca la base
  // todavía: recién se aplica cuando MP confirma la autorización (ver
  // confirmPlanActivation, idéntico criterio que confirmAndCreate — nunca se
  // confía en que el dueño "ya volvió", siempre se le vuelve a preguntar a MP).
  async activatePlan(businessId: string, memberId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub) throw new NotFoundException('Este negocio no tiene una suscripción');
    // El email de quien está pidiendo la activación (siempre owner/admin, ver
    // el guard del controller) — no hay un "email de cuenta" separado en
    // Subscription, es el mismo Member autenticado.
    const member = await this.prisma.member.findUnique({ where: { id: memberId }, select: { email: true } });
    if (!member) throw new NotFoundException('No se encontró tu usuario');
    if (sub.origin !== 'PAID') {
      throw new BadRequestException('Las cuentas de cortesía no activan un plan pago');
    }
    if (sub.currentPeriodEnd > new Date()) {
      throw new BadRequestException(
        `Todavía no terminó tu período actual (vence el ${sub.currentPeriodEnd.toISOString().slice(0, 10)}) — no hay nada para activar todavía`,
      );
    }

    const plan = sub.nextPlan ?? sub.plan;
    if (!esPlanKey(plan)) throw new BadRequestException(`Plan desconocido: ${plan}`);
    const { amount, frequency, frequencyType } = this.cicloDelPlan(plan);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    // Si ya había una preapproval activa (esto es un cambio de plan, no la
    // primera activación tras el beneficio de bienvenida), se cancela antes
    // de crear la nueva: MP no permite cambiarle la frecuencia a una ya
    // autorizada, así que conviven las dos hasta que ésta se cancele.
    if (sub.mpPreapprovalId) {
      try {
        await this.preapproval.update({ id: sub.mpPreapprovalId, body: { status: 'cancelled' } });
      } catch (err) {
        this.logger.warn(`No se pudo cancelar la preapproval vieja ${sub.mpPreapprovalId} de ${businessId}: ${this.mpErrorMessage(err)}`);
      }
    }

    let response;
    try {
      response = await this.preapproval.create({
        body: {
          reason: `Órbita — plan ${plan}`,
          payer_email: member.email,
          // Pantalla propia, NO /onboarding/pago-retorno: esa es para el alta
          // nueva (confirma un PendingSignup que acá no existe — el negocio ya
          // existe). Ver pages/onboarding/plan-activado.tsx.
          back_url: `${frontendUrl}/onboarding/plan-activado`,
          status: 'pending',
          external_reference: businessId,
          auto_recurring: { frequency, frequency_type: frequencyType, transaction_amount: amount, currency_id: this.currency },
        },
      });
    } catch (err) {
      const motivo = this.mpErrorMessage(err);
      this.logger.warn(`MP rechazó la creación de la preapproval del plan ${plan} para ${businessId}: ${motivo}`);
      throw new BadRequestException(`MercadoPago rechazó la activación: ${motivo}`);
    }
    if (!response.id || !response.init_point) {
      throw new BadRequestException('MercadoPago no devolvió un link de pago válido');
    }
    return { initPoint: response.init_point, plan };
  }

  // Idempotente y con la misma desconfianza de siempre: vuelve a preguntarle
  // a MP el estado real antes de tocar la suscripción.
  async confirmPlanActivation(mpPreapprovalId: string) {
    const mp = await this.preapproval.get({ id: mpPreapprovalId });
    if (mp.status !== 'authorized') return { activated: false, status: mp.status ?? 'unknown' };

    const businessId = mp.external_reference;
    if (!businessId) return { activated: false, status: 'sin_external_reference' };

    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub) return { activated: false, status: 'sin_suscripcion' };

    // La pantalla de vuelta necesita el subdominio para poder mandar al dueño
    // de nuevo a SU panel (mismo criterio que confirmAndCreate/pago-retorno).
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { subdomain: true } });

    // Ya aplicado (reintento del webhook, o browser + webhook casi juntos).
    if (sub.mpPreapprovalId === mpPreapprovalId && sub.planActive) {
      return { activated: true, status: 'ya_aplicado', subdomain: business?.subdomain, businessId };
    }

    const plan = sub.nextPlan ?? sub.plan;
    if (!esPlanKey(plan)) return { activated: false, status: 'plan_desconocido' };
    const ciclo = this.cicloDelPlan(plan);
    const now = new Date();
    const periodEnd = this.periodEnd(now, ciclo);

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        plan,
        nextPlan: null,
        planActive: true,
        mpPreapprovalId,
        amount: ciclo.amount,
        currency: this.currency,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
    await this.syncAddonAvanzado(this.prisma, businessId, plan, periodEnd);
    await this.businessesService.publish(businessId).catch(() => undefined); // por si venía suspendida por mora

    return { activated: true, plan, subdomain: business?.subdomain, businessId };
  }

  // ── Cambio de plan (panel → Configuración → Suscripción) ────────────────

  // Ver el punto 3 del comentario de diseño al principio del archivo: nunca
  // aplica al toque, porque MP no deja cambiarle la frecuencia a una
  // preapproval ya autorizada. Dos casos:
  //   - Todavía cursando el beneficio de bienvenida (planActive=false): no
  //     hay ninguna preapproval que tocar, así que el plan elegido
  //     simplemente se reemplaza — se va a activar ESE cuando termine el
  //     beneficio.
  //   - Ya con un plan activo: se anota en `nextPlan` y se aplica recién en
  //     la próxima renovación (mismo mecanismo de activatePlan de arriba).
  async changePlan(businessId: string, nuevoPlan: PlanKey) {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub) throw new NotFoundException('Este negocio no tiene una suscripción');
    if (sub.origin !== 'PAID') throw new BadRequestException('Las cuentas de cortesía no cambian de plan');

    if (!sub.planActive) {
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { plan: nuevoPlan, nextPlan: null } });
      return { appliesNow: true, plan: nuevoPlan, effectiveFrom: sub.currentPeriodEnd };
    }

    if (sub.plan === nuevoPlan) {
      // Deshace un cambio pendiente si pidió volver al plan actual.
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { nextPlan: null } });
      return { appliesNow: false, plan: nuevoPlan, effectiveFrom: null };
    }

    await this.prisma.subscription.update({ where: { id: sub.id }, data: { nextPlan: nuevoPlan } });
    return { appliesNow: false, plan: nuevoPlan, effectiveFrom: sub.currentPeriodEnd };
  }

  // ── Registro de cada cobro (historial de facturación) ─────────────────────

  // Registra en subscription_payments el resultado de un débito automático de
  // un plan YA ACTIVO y, si fue aprobado, renueva el período y saca al
  // negocio de la mora. Es idempotente por mpPaymentId: si MP reenvía el
  // mismo pago, no se duplica. No se usa para el cobro único del beneficio de
  // bienvenida (ver confirmAndCreate): a esa altura el negocio todavía no
  // existe, no hay `Subscription` contra la cual buscar.
  async recordPayment(mpPaymentId: string) {
    const pago = await this.payment.get({ id: mpPaymentId });

    // MP propaga el external_reference de la preapproval (= businessId,
    // seteado en activatePlan/confirmPlanActivation) a cada cobro recurrente.
    // Es nuestro anclaje para saber de qué negocio es.
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
    if (!esPlanKey(sub.plan)) {
      this.logger.warn(`Pago ${mpPaymentId}: la suscripción de ${businessId} tiene un plan desconocido (${sub.plan}) — se ignora`);
      return { recorded: false };
    }
    const plan = sub.plan; // ya angostado a PlanKey por el esPlanKey de arriba

    // Idempotencia: si ya registramos este pago de MP, no lo duplicamos.
    const yaRegistrado = await this.prisma.subscriptionPayment.findFirst({
      where: { subscriptionId: sub.id, mpPaymentId },
    });
    if (yaRegistrado) return { recorded: false, duplicated: true };

    const aprobado = pago.status === 'approved';
    const now = new Date();
    const ciclo = this.cicloDelPlan(plan);
    // El cobro paga el período que arranca cuando vencía el anterior.
    const periodStart = sub.currentPeriodEnd < now ? sub.currentPeriodEnd : now;
    const periodEnd = this.periodEnd(periodStart, ciclo);

    // Un cobro aprobado vuelve a poner en línea SOLO una tienda que estaba
    // suspendida por mora. Antes despausaba siempre: si el dueño la había
    // pausado a mano (vacaciones), el cobro del mes la reabría sola, y si la
    // había suspendido el super admin, el cobro automático levantaba la
    // suspensión (auditoría interna 10/09, ítem `api.businesses`).
    const reactivar = aprobado && sub.status === 'SUSPENDED' && !(await suspendidoPorPlataforma(this.prisma, businessId));

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
        await this.syncAddonAvanzado(tx, businessId, plan, periodEnd);
        // Si había sido suspendido por falta de pago, vuelve al aire.
        if (reactivar) {
          await tx.business.update({ where: { id: businessId }, data: { isActive: true, isPaused: false } });
        }
      }
    });

    return { recorded: true, approved: aprobado };
  }

  // ── Webhook ──────────────────────────────────────────────────────────────

  // MP avisa acá cada vez que un pago o una preapproval cambia de estado.
  // Nunca confiamos en el contenido del webhook como fuente de verdad: sacamos
  // el id y volvemos a preguntarle a MP el estado real.
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
        // Un pago puede ser el beneficio de bienvenida de un alta que
        // todavía no existe como negocio (external_reference = nuestra
        // referencia PEND-, ver startCheckoutPending) o un cobro recurrente
        // de un plan ya activo (external_reference = businessId). Se mira UNA
        // vez para decidir a cuál de los dos flujos mandarlo — cada uno
        // vuelve a pedir el estado real por su cuenta igual, así que este
        // fetch extra no relaja la desconfianza de siempre.
        const pago = await this.payment.get({ id: String(id) });
        const ref = pago.external_reference ?? '';
        if (ref.startsWith(PENDING_REF_PREFIX) || ref.startsWith(FREE_SIGNUP_PREFIX)) {
          const result = await this.confirmAndCreate(ref);
          this.logger.log(`Webhook pago de bienvenida ${id} (ref ${ref}): ${JSON.stringify(result)}`);
        } else {
          const result = await this.recordPayment(String(id));
          this.logger.log(`Webhook pago ${id}: ${JSON.stringify(result)}`);
        }
      } else {
        // subscription_preapproval y afines: siempre son la activación de un
        // plan (mensual/semestral/anual) — el beneficio de bienvenida no usa
        // preapproval (ver comentario de diseño al principio del archivo).
        const result = await this.confirmPlanActivation(String(id));
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

  // Mora: reconcilia las suscripciones cuyo período venció. Cubre DOS
  // situaciones con el mismo criterio de gracia → suspensión:
  //   - Un plan ya activo cuyo cobro automático falló o no llegó.
  //   - Un beneficio de bienvenida (o un plan) que terminó y el dueño
  //     todavía no activó el siguiente desde el panel (`planActive=false` o
  //     `mpPreapprovalId` nulo) — mismo destino que no pagar: unos días de
  //     gracia y, si no hizo nada, se suspende.
  // NO decide la mora solo por la fecha: si hay una preapproval, le vuelve a
  // preguntar a MP el estado real (MP reintenta los cobros fallidos por su
  // cuenta), así evitamos suspender a alguien solo porque no nos llegó el
  // webhook. La fecha + gracia es el backstop cuando MP ya no considera
  // activa la suscripción, o cuando no hay ninguna preapproval que consultar.
  // Ya NO es @Cron: Cloud Run escala a 0 entre requests (para no pagar una
  // instancia siempre prendida), así que un cron in-process no es confiable
  // ahí. Lo dispara Cloud Scheduler pegándole a un endpoint HTTP — ver
  // internal-cron/internal-cron.controller.ts y DEPLOYMENT.md § Cron jobs.
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
  // Ya NO es @Cron — mismo motivo que reconcileOverdueSubscriptions() arriba.
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
      nextPlan: sub.nextPlan,
      // false mientras se cursa el beneficio de bienvenida (o el período
      // anterior a un cambio de plan): el panel usa esto para saber si tiene
      // que ofrecer "activá tu plan" en vez de mostrarlo como ya facturando.
      planActive: sub.planActive,
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
