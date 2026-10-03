import {
  BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException, Optional,
} from '@nestjs/common';
import {
  Appointment, AppointmentCancelledBy, AppointmentModality, AppointmentResourceKind, AppointmentSettings, AppointmentStatus, Prisma,
} from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SOLO_SI_YA_EMPEZO, TRANSICIONES } from '../appointments.types';
import {
  CUALQUIERA, ContextoDisponibilidad, HorarioLibre, RecursoDisponibilidad, TurnoOcupado, horarioSiEstaLibre,
} from '../disponibilidad/disponibilidad';
import { esFecha, instanteDe, leerSemana } from '../horarios/horarios';
import { AppointmentsSettingsService } from './appointments-settings.service';
import { ResultadoCobro, calcularCobro } from './lib/cobro';
import { generarAccessToken, generarCodigo } from './lib/codigos';
import { esChoqueDeHorario, esCodigoRepetido } from './lib/errores';
import { NOMBRE_ESTADO, horarioNegocioDe, num } from './lib/serializar';

type Tx = Prisma.TransactionClient;

// ─── Interfaz pública del núcleo (la reutilizan P2, P3 y P4) ─────────────────

/**
 * Quién reserva. El turno guarda SIEMPRE este snapshot, además del
 * `customerId` (CONTRATO.md § 0, "Cliente").
 */
export interface ClienteDelAlta {
  /** Ficha ya conocida: la elegida en el panel o la de la sesión del cliente. */
  customerId?: string | null;
  /** Nombre completo, como se muestra. */
  name: string;
  /** Normalizado (solo dígitos, ver lib/telefono.ts). '' si no hay. */
  phone: string;
  email?: string | null;
  /**
   * Sin `customerId`: buscar la ficha por teléfono (y si no, por email) y,
   * si no existe, crearla. Por defecto true.
   */
  buscarOCrearFicha?: boolean;
}

/** Lo que pide quien reserva para pagar con algo que no es plata (P4). */
export interface PedidoDeCanje {
  packagePurchaseId?: string;
  giftCardCode?: string;
  couponCode?: string;
}

/** Lo que resolvió el canje: cuánto cubre y con qué. */
export interface ResultadoCanje {
  /** Pesos que cubre (pack / membresía: todo; gift card de monto: hasta su saldo). */
  cubierto: number;
  /** Descuento de un cupón de "Recuperar clientes" (no se acumula con la bienvenida: gana el mayor). */
  descuentoCupon?: number;
  packagePurchaseId?: string | null;
  giftCardId?: string | null;
  membershipId?: string | null;
}

/**
 * Puntos de extensión del núcleo. Hoy no hay ninguno registrado: los registra
 * el paquete que los implementa (P4 en su `onModuleInit`, con
 * `AppointmentsService.registrarExtensiones`). Todos corren DENTRO de la
 * transacción del turno; si tiran, el turno no se guarda.
 */
export interface ExtensionesTurnos {
  /** "Precios por horario" (P4.4): % de ajuste para ese inicio. 0 = sin ajuste. */
  ajustePorFranja?(p: { tx: Tx; businessId: string; serviceId: string; date: string; startMin: number }): Promise<number>;
  /** Canje de pack, gift card, membresía o cupón (P4). null = no aplica. */
  canjear?(p: { tx: Tx; businessId: string; customerId: string | null; serviceId: string; aPagar: number; pedido: PedidoDeCanje; date: string }): Promise<ResultadoCanje | null>;
  /** Efectos extra de un cambio de estado: sellos, sesiones del pack, lista de espera (P3/P4). */
  alCambiarEstado?(p: { tx: Tx; businessId: string; turno: Appointment; de: AppointmentStatus; a: AppointmentStatus }): Promise<void>;
  /** Reembolso por Mercado Pago de una seña paga online (P2). Corre DESPUÉS de la transacción; si falla, se registra y la cancelación sigue. */
  reembolsarMercadoPago?(p: { businessId: string; appointmentPaymentId: string }): Promise<void>;
}

export interface CrearTurnoEntrada {
  businessId: string;
  /** 'panel': sin anticipación mínima/máxima, nace CONFIRMED. 'publico': el sitio. */
  modo: 'panel' | 'publico';
  serviceId: string;
  /** Una agenda o CUALQUIERA ('cualquiera'). */
  resourceId: string;
  date: string;
  startMin: number;
  cliente: ClienteDelAlta;
  /** Por defecto la primera de `settings.modalities`. Tiene que estar ahí. */
  modality?: AppointmentModality;
  detalles?: {
    customerNote?: string | null; customerAddress?: string | null; customerDni?: string | null;
    insuranceName?: string | null; insuranceNumber?: string | null; reason?: string | null;
    internalNote?: string | null; wantsReminder?: boolean;
  };
  /** Quién lo dio desde el panel. Con esto además se registra en audit_logs. */
  createdByMemberId?: string | null;
  /** Alcance del panel: solo estas agendas (null/undefined = todas). Fuera de alcance = 404. */
  agendasPermitidas?: string[] | null;
  /** Precio puesto a mano en el panel (exige appointments.services.manage: lo chequea quien llama). */
  precioManual?: number;
  /** La reserva viene con la cuenta del cliente (habilita el descuento de bienvenida). */
  conCuenta?: boolean;
  /** onlineCharge = customer_choice: lo que eligió el cliente. */
  pay?: 'deposit' | 'total';
  /** P2: hay un cobro online que todavía no se pagó → el turno nace PENDING. */
  cobroOnlinePendiente?: boolean;
  /** P4: pagar con pack, gift card, membresía o cupón. Sin extensión registrada se ignora. */
  canje?: PedidoDeCanje;
  /** P2: algo más que guardar en la MISMA transacción (el AppointmentPayment PENDING, etc.). */
  enTransaccion?(tx: Tx, turno: Appointment, cobro: ResultadoCobro): Promise<void>;
}

export interface TurnoCreado {
  /** La fila completa, CON accessToken: quien llama decide qué devuelve (el panel nunca lo devuelve). */
  turno: Appointment;
  cobro: ResultadoCobro;
}

export interface OpcionesCambioDeEstado {
  reason?: string | null;
  /** Al cancelar: qué pasa con la seña paga. Por defecto 'reembolsar' (canceló el negocio). */
  sena?: 'reembolsar' | 'retener' | 'credito';
  cancelledBy?: AppointmentCancelledBy;
  memberId?: string | null;
  agendasPermitidas?: string[] | null;
  ahora?: Date;
}

export interface OpcionesMover {
  modo: 'panel' | 'publico';
  memberId?: string | null;
  agendasPermitidas?: string[] | null;
  /** Reprogramación del cliente (P2): suma `rescheduleCount`. El panel no. */
  porCliente?: boolean;
  ahora?: Date;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

export const MSJ_OCUPADO = 'Ese horario se acaba de ocupar. Elegí otro.';
export const MSJ_NO_DISPONIBLE = 'Ese horario no está disponible.';
const MSJ_CAMBIO_CONCURRENTE = 'El turno cambió mientras lo editabas. Volvé a cargarlo.';
const INTENTOS_CODIGO = 4;
/** Para calcular solo el precio de lista (sin seña ni beneficios). */
const SIN_SENA = {
  depositEnabled: false, depositForNoShows: false, depositType: 'percent', depositPercent: 0, depositFixed: 0,
  accountEnabled: false, welcomeDiscountPercent: 0, onlineCharge: 'deposit',
};

/** Qué agendas pueden recibir un turno según el modo del negocio. */
export function kindsDeModo(modo: AppointmentSettings['agendaMode']): AppointmentResourceKind[] {
  if (modo === 'PROFESSIONAL') return ['PERSON'];
  if (modo === 'CLASS') return ['PERSON', 'SPACE'];
  return ['SPACE'];
}

/**
 * Núcleo de turnos (CONTRATO.md § 1): la ÚNICA forma correcta de crear,
 * mover y cambiar de estado un turno. Lo usa el panel (P1) y lo reutilizan el
 * sitio (P2), las clases (P3) y Avanzado (P4) — ver las interfaces de arriba.
 *
 * - `crear()`: § 1.1 (transacción + lock por negocio y día + motor de
 *   disponibilidad + precio/seña § 1.3 + 23P01 → 409).
 * - `cambiarEstado()`: § 1.2 (transiciones y efectos).
 * - `mover()`: § 1.4 (mover del panel / reprogramar del cliente).
 * - `contexto()`: arma el ContextoDisponibilidad para las lecturas.
 */
@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  private extensiones: ExtensionesTurnos = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppointmentsSettingsService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  /** Lo llama el paquete que implementa una extensión (se suman a las ya registradas). */
  registrarExtensiones(ext: ExtensionesTurnos): void {
    this.extensiones = { ...this.extensiones, ...ext };
  }

  // ── Agendas candidatas y contexto del motor ────────────────────────────────

  /**
   * Las agendas donde se puede dar un turno: reservables, activas, no borradas,
   * del tipo que corresponde al modo, en el orden en que se muestran.
   */
  async candidatas(businessId: string, settings: AppointmentSettings, agendasPermitidas?: string[] | null, db: Tx | PrismaService = this.prisma) {
    const filas = await db.appointmentResource.findMany({
      where: {
        businessId, isBookable: true, isActive: true, deletedAt: null, kind: { in: kindsDeModo(settings.agendaMode) },
        ...(agendasPermitidas ? { id: { in: agendasPermitidas } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, kind: true, workDays: true, ownSchedule: true },
    });
    return filas;
  }

  /**
   * En modo RESOURCE una persona trabaja en un espacio: "darle un turno" es
   * darlo en su espacio. Devuelve el id de agenda que corresponde.
   */
  async agendaReal(businessId: string, settings: AppointmentSettings, resourceId: string, db: Tx | PrismaService = this.prisma): Promise<string> {
    if (resourceId === CUALQUIERA || settings.agendaMode !== 'RESOURCE') return resourceId;
    const r = await db.appointmentResource.findFirst({ where: { id: resourceId, businessId, deletedAt: null }, select: { kind: true, assignedSpaceId: true } });
    return r?.kind === 'PERSON' && r.assignedSpaceId ? r.assignedSpaceId : resourceId;
  }

  /** El contexto del motor para `[desde, hasta]` (fechas inclusive). */
  async contexto(p: {
    businessId: string; settings: AppointmentSettings; recursos: { id: string; workDays: number[]; ownSchedule: unknown }[];
    desde: string; hasta: string; modo: 'panel' | 'publico'; salvo?: string; ahora?: Date; db?: Tx | PrismaService;
  }): Promise<ContextoDisponibilidad> {
    const db = p.db ?? this.prisma;
    const margen = p.settings.bufferMin;
    const ids = p.recursos.map((r) => r.id);
    const [especiales, turnos] = await Promise.all([
      db.appointmentSpecialDay.findMany({ where: { businessId: p.businessId, date: { gte: p.desde, lte: p.hasta } }, select: { date: true, kind: true, ranges: true } }),
      ids.length === 0
        ? Promise.resolve([] as TurnoOcupado[])
        : db.appointment.findMany({
            where: {
              businessId: p.businessId, resourceId: { in: ids }, status: { not: 'CANCELLED' },
              startsAt: { lt: instanteDe(p.hasta, 24 * 60 + margen) }, endsAt: { gt: instanteDe(p.desde, -margen) },
            },
            select: { id: true, resourceId: true, startsAt: true, endsAt: true },
          }),
    ]);
    const recursos: RecursoDisponibilidad[] = p.recursos.map((r) => ({
      id: r.id, workDays: r.workDays, ownSchedule: r.ownSchedule === null || r.ownSchedule === undefined ? null : leerSemana(r.ownSchedule),
    }));
    return {
      reglas: { slotMin: p.settings.slotMin, bufferMin: margen, minAdvanceMin: p.settings.minAdvanceMin, maxAdvanceDays: p.settings.maxAdvanceDays },
      horario: horarioNegocioDe(p.settings, especiales),
      recursos,
      turnos,
      ahora: p.ahora ?? new Date(),
      modo: p.modo,
      salvo: p.salvo,
    };
  }

  /** Precio de lista de un servicio a esa hora, con "Precios por horario" si hay extensión (lo que muestra cada slot). */
  async precioA(businessId: string, servicio: { id: string; price: Prisma.Decimal | number }, date: string, startMin: number): Promise<{ price: number; adjustPercent: number }> {
    const adjustPercent = this.extensiones.ajustePorFranja
      ? await this.extensiones.ajustePorFranja({ tx: this.prisma, businessId, serviceId: servicio.id, date, startMin })
      : 0;
    return { price: calcularCobro({ precioServicio: num(servicio.price), ajustePercent: adjustPercent, reglas: SIN_SENA, perfil: null, conCuenta: false }).precio, adjustPercent };
  }

  // ── § 1.1 Crear ────────────────────────────────────────────────────────────

  async crear(e: CrearTurnoEntrada): Promise<TurnoCreado> {
    if (!esFecha(e.date)) throw new BadRequestException('La fecha no es válida.');
    if (!Number.isInteger(e.startMin) || e.startMin < 0 || e.startMin > 1439) throw new BadRequestException('La hora no es válida.');
    const settings = await this.settings.delNegocio(e.businessId);

    const servicio = await this.prisma.appointmentService.findFirst({
      where: { id: e.serviceId, businessId: e.businessId, isActive: true, deletedAt: null, ...(e.modo === 'publico' ? { bookableOnline: true } : {}) },
    });
    if (!servicio) throw new NotFoundException('Ese servicio no existe.');

    const modalidad = e.modality ?? settings.modalities[0] ?? 'ON_SITE';
    if (!settings.modalities.includes(modalidad)) throw new BadRequestException('Este negocio no atiende de esa forma.');

    const pedida = await this.agendaReal(e.businessId, settings, e.resourceId);
    const candidatas = await this.candidatas(e.businessId, settings, e.agendasPermitidas);
    if (pedida !== CUALQUIERA && !candidatas.some((r) => r.id === pedida)) throw new NotFoundException('Esa agenda no existe.');
    if (candidatas.length === 0) throw new BadRequestException(MSJ_NO_DISPONIBLE);
    const enJuego = pedida === CUALQUIERA ? candidatas : candidatas.filter((r) => r.id === pedida);

    for (let intento = 1; ; intento++) {
      try {
        const creado = await this.prisma.$transaction(async (tx) => {
          await this.bloquearDia(tx, e.businessId, e.date);
          const ctx = await this.contexto({ businessId: e.businessId, settings, recursos: enJuego, desde: e.date, hasta: e.date, modo: e.modo, db: tx });
          const libre = this.exigirLibre(ctx, e.date, e.startMin, servicio.durationMin, pedida);

          const customerId = await this.resolverCliente(tx, e.businessId, e.cliente);
          const perfil = customerId
            ? await tx.appointmentCustomerProfile.findFirst({ where: { businessId: e.businessId, customerId }, select: { noShowCount: true, depositCredit: true, welcomeUsedAt: true } })
            : null;

          const ajuste = e.precioManual === undefined && this.extensiones.ajustePorFranja
            ? await this.extensiones.ajustePorFranja({ tx, businessId: e.businessId, serviceId: servicio.id, date: e.date, startMin: e.startMin })
            : 0;
          const reglas = {
            depositEnabled: settings.depositEnabled, depositForNoShows: settings.depositForNoShows, depositType: settings.depositType,
            depositPercent: settings.depositPercent, depositFixed: num(settings.depositFixed), accountEnabled: settings.accountEnabled,
            welcomeDiscountPercent: settings.welcomeDiscountPercent, onlineCharge: settings.onlineCharge,
          };
          const perfilCobro = perfil ? { noShowCount: perfil.noShowCount, depositCredit: num(perfil.depositCredit), welcomeUsedAt: perfil.welcomeUsedAt } : null;
          const base = { precioServicio: num(servicio.price), ajustePercent: ajuste, precioManual: e.precioManual, reglas, perfil: perfilCobro, conCuenta: !!e.conCuenta, pay: e.pay };
          let cobro = calcularCobro(base);
          let canje: ResultadoCanje | null = null;
          if (e.canje && this.extensiones.canjear) {
            canje = await this.extensiones.canjear({ tx, businessId: e.businessId, customerId, serviceId: servicio.id, aPagar: cobro.aPagar, pedido: e.canje, date: e.date });
            if (canje) cobro = calcularCobro({ ...base, cubierto: canje.cubierto, descuentoCupon: canje.descuentoCupon });
          }

          const confirmado = e.modo === 'panel' || (settings.confirmation !== 'manual' && !e.cobroOnlinePendiente);
          const ahora = new Date();
          const d = e.detalles ?? {};
          const turno = await tx.appointment.create({
            data: {
              businessId: e.businessId,
              code: await this.codigoLibre(tx, e.businessId),
              accessToken: generarAccessToken(),
              resourceId: libre.resourceId,
              serviceId: servicio.id,
              customerId,
              customerName: e.cliente.name.trim(),
              customerPhone: e.cliente.phone,
              customerEmail: e.cliente.email?.trim().toLowerCase() || null,
              customerNote: d.customerNote ?? null,
              customerAddress: d.customerAddress ?? null,
              customerDni: d.customerDni ?? null,
              insuranceName: d.insuranceName ?? null,
              insuranceNumber: d.insuranceNumber ?? null,
              reason: d.reason ?? null,
              internalNote: d.internalNote ?? null,
              serviceName: servicio.name,
              startsAt: libre.startsAt,
              endsAt: libre.endsAt,
              durationMin: servicio.durationMin,
              price: cobro.precio,
              discountAmount: cobro.descuento,
              depositAmount: cobro.sena,
              status: confirmado ? 'CONFIRMED' : 'PENDING',
              confirmedAt: confirmado ? ahora : null,
              origin: e.modo === 'panel' ? 'PANEL' : 'STOREFRONT',
              modality: modalidad,
              wantsReminder: d.wantsReminder ?? true,
              createdByMemberId: e.createdByMemberId ?? null,
              packagePurchaseId: canje?.packagePurchaseId ?? null,
              giftCardId: canje?.giftCardId ?? null,
              membershipId: canje?.membershipId ?? null,
            },
          });

          if (customerId && (cobro.usaBienvenida || cobro.creditoUsado > 0)) {
            await this.consumirBeneficios(tx, e.businessId, customerId, cobro, ahora);
          }
          if (e.enTransaccion) await e.enTransaccion(tx, turno, cobro);
          return { turno, cobro };
        });

        if (e.modo === 'panel' && e.createdByMemberId !== undefined) {
          const t = creado.turno;
          await this.audit?.registrar({
            businessId: e.businessId, memberId: e.createdByMemberId, entityType: 'appointment', entityId: t.id, action: 'CREATE',
            changes: [
              { field: 'code', before: null, after: t.code },
              { field: 'serviceName', before: null, after: t.serviceName },
              { field: 'resourceId', before: null, after: t.resourceId },
              { field: 'startsAt', before: null, after: t.startsAt },
              { field: 'customerName', before: null, after: t.customerName },
              { field: 'price', before: null, after: num(t.price) },
            ],
          });
        }
        return creado;
      } catch (err) {
        if (err instanceof HttpException) throw err;
        if (esChoqueDeHorario(err)) throw new ConflictException(MSJ_OCUPADO);
        if (esCodigoRepetido(err) && intento < INTENTOS_CODIGO) continue;
        throw err;
      }
    }
  }

  // ── § 1.2 Estados ──────────────────────────────────────────────────────────

  async cambiarEstado(businessId: string, id: string, nuevo: AppointmentStatus, op: OpcionesCambioDeEstado = {}): Promise<Appointment> {
    const settings = await this.settings.delNegocio(businessId);
    const ahora = op.ahora ?? new Date();
    const turno = await this.buscar(businessId, id, op.agendasPermitidas);

    if (!TRANSICIONES[turno.status].includes(nuevo)) {
      throw new BadRequestException(`Un turno ${NOMBRE_ESTADO[turno.status]} no puede pasar a ${NOMBRE_ESTADO[nuevo]}.`);
    }
    if (SOLO_SI_YA_EMPEZO.includes(nuevo) && turno.startsAt.getTime() > ahora.getTime()) {
      throw new BadRequestException('Todavía no es la hora del turno: no se puede marcar como atendido ni ausente.');
    }

    const data: Prisma.AppointmentUpdateManyMutationInput = { status: nuevo };
    if (nuevo === 'CONFIRMED') data.confirmedAt = ahora;
    if (nuevo === 'COMPLETED') data.completedAt = ahora;
    if (nuevo === 'CANCELLED') {
      data.cancelledAt = ahora;
      data.cancelledBy = op.cancelledBy ?? 'BUSINESS';
      data.cancelReason = op.reason?.trim() || null;
    }
    const senaPaga = turno.depositPaidAt !== null;
    const aReembolsarPorMp: string[] = [];

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const n = await tx.appointment.updateMany({ where: { id, businessId, status: turno.status }, data });
      if (n.count === 0) throw new ConflictException(MSJ_CAMBIO_CONCURRENTE);

      if (nuevo === 'NO_SHOW' && turno.customerId) {
        const credito = senaPaga && settings.depositOutOfWindow === 'credit' ? await this.senaCobrada(tx, turno) : 0;
        await this.sumarAlPerfil(tx, businessId, turno.customerId, { noShows: 1, credito });
      }
      if (nuevo === 'CANCELLED' && senaPaga) {
        const destino = op.sena ?? 'reembolsar';
        if (destino === 'credito' && turno.customerId) {
          await this.sumarAlPerfil(tx, businessId, turno.customerId, { noShows: 0, credito: await this.senaCobrada(tx, turno) });
        } else if (destino === 'reembolsar') {
          const pagos = await tx.appointmentPayment.findMany({
            where: { businessId, appointmentId: id, status: 'APPROVED', kind: { in: ['DEPOSIT', 'FULL'] } },
            select: { id: true, method: true },
          });
          // Lo cobrado en el local lo devuelve el negocio en mano: queda REFUNDED.
          // Lo de Mercado Pago se reembolsa por API después de la transacción (P2).
          const enMano = pagos.filter((p) => p.method !== 'MERCADOPAGO').map((p) => p.id);
          if (enMano.length > 0) {
            await tx.appointmentPayment.updateMany({ where: { businessId, id: { in: enMano } }, data: { status: 'REFUNDED', refundedAt: ahora } });
          }
          aReembolsarPorMp.push(...pagos.filter((p) => p.method === 'MERCADOPAGO').map((p) => p.id));
        }
      }

      const fila = await tx.appointment.findFirst({ where: { id, businessId } });
      if (!fila) throw new NotFoundException('Ese turno no existe.');
      if (this.extensiones.alCambiarEstado) await this.extensiones.alCambiarEstado({ tx, businessId, turno: fila, de: turno.status, a: nuevo });
      return fila;
    });

    for (const appointmentPaymentId of aReembolsarPorMp) {
      if (!this.extensiones.reembolsarMercadoPago) {
        this.logger.warn(`Seña por Mercado Pago sin reembolsar (no hay reembolso registrado): pago ${appointmentPaymentId} del negocio ${businessId}`);
        continue;
      }
      try {
        await this.extensiones.reembolsarMercadoPago({ businessId, appointmentPaymentId });
      } catch (err) {
        this.logger.error(`No se pudo reembolsar la seña ${appointmentPaymentId} (negocio ${businessId}): ${err instanceof Error ? err.message : err}`);
      }
    }

    if (op.memberId !== undefined) {
      await this.audit?.registrar({
        businessId, memberId: op.memberId, entityType: 'appointment', entityId: id,
        action: nuevo === 'CANCELLED' ? 'DEACTIVATE' : 'UPDATE',
        changes: [
          { field: 'code', before: turno.code, after: turno.code },
          { field: 'status', before: turno.status, after: nuevo },
          ...(nuevo === 'CANCELLED' && op.reason ? [{ field: 'cancelReason', before: null, after: op.reason }] : []),
        ],
      });
    }
    return actualizado;
  }

  // ── § 1.4 Mover / reprogramar ──────────────────────────────────────────────

  async mover(businessId: string, id: string, destino: { date: string; startMin: number; resourceId?: string }, op: OpcionesMover): Promise<Appointment> {
    if (!esFecha(destino.date)) throw new BadRequestException('La fecha no es válida.');
    if (!Number.isInteger(destino.startMin) || destino.startMin < 0 || destino.startMin > 1439) throw new BadRequestException('La hora no es válida.');
    const settings = await this.settings.delNegocio(businessId);
    const turno = await this.buscar(businessId, id, op.agendasPermitidas);
    if (!TRANSICIONES[turno.status].length) throw new BadRequestException('Ese turno ya está cerrado: no se puede mover.');

    const pedida = await this.agendaReal(businessId, settings, destino.resourceId ?? turno.resourceId);
    const candidatas = await this.candidatas(businessId, settings, op.agendasPermitidas);
    if (pedida !== CUALQUIERA && !candidatas.some((r) => r.id === pedida)) throw new NotFoundException('Esa agenda no existe.');
    const enJuego = pedida === CUALQUIERA ? candidatas : candidatas.filter((r) => r.id === pedida);
    if (enJuego.length === 0) throw new BadRequestException(MSJ_NO_DISPONIBLE);
    const ahora = op.ahora ?? new Date();

    try {
      const movido = await this.prisma.$transaction(async (tx) => {
        await this.bloquearDia(tx, businessId, destino.date);
        const ctx = await this.contexto({ businessId, settings, recursos: enJuego, desde: destino.date, hasta: destino.date, modo: op.modo, salvo: id, ahora, db: tx });
        const libre = this.exigirLibre(ctx, destino.date, destino.startMin, turno.durationMin, pedida);
        const data: Prisma.AppointmentUncheckedUpdateManyInput = {
          startsAt: libre.startsAt,
          endsAt: libre.endsAt,
          resourceId: libre.resourceId,
          reminderSentAt: null,
          secondReminderSentAt: null,
          ...(op.porCliente ? { rescheduleCount: { increment: 1 } } : {}),
          // Mover desde el panel deja el turno confirmado (como la demo).
          ...(op.modo === 'panel' && turno.status === 'PENDING' ? { status: 'CONFIRMED', confirmedAt: ahora } : {}),
        };
        const n = await tx.appointment.updateMany({ where: { id, businessId, status: turno.status, startsAt: turno.startsAt }, data });
        if (n.count === 0) throw new ConflictException(MSJ_CAMBIO_CONCURRENTE);
        const fila = await tx.appointment.findFirst({ where: { id, businessId } });
        if (!fila) throw new NotFoundException('Ese turno no existe.');
        return fila;
      });

      if (op.memberId !== undefined) {
        await this.audit?.registrar({
          businessId, memberId: op.memberId, entityType: 'appointment', entityId: id, action: 'UPDATE',
          changes: AuditService.diferencias(
            { code: turno.code, startsAt: turno.startsAt, resourceId: turno.resourceId, status: turno.status },
            { code: turno.code, startsAt: movido.startsAt, resourceId: movido.resourceId, status: movido.status },
            ['startsAt', 'resourceId', 'status'],
          ).concat([{ field: 'code', before: turno.code, after: turno.code }]),
        });
      }
      return movido;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      if (esChoqueDeHorario(err)) throw new ConflictException(MSJ_OCUPADO);
      throw err;
    }
  }

  // ── Internos ───────────────────────────────────────────────────────────────

  /** Un turno del negocio, dentro del alcance (fuera = 404, no 403). */
  async buscar(businessId: string, id: string, agendasPermitidas?: string[] | null): Promise<Appointment> {
    const turno = await this.prisma.appointment.findFirst({
      where: { id, businessId, ...(agendasPermitidas ? { resourceId: { in: agendasPermitidas } } : {}) },
    });
    if (!turno) throw new NotFoundException('Ese turno no existe.');
    return turno;
  }

  /** Serializa las reservas simultáneas del mismo negocio y día (§ 1.1 a). */
  private async bloquearDia(tx: Tx, businessId: string, fecha: string): Promise<void> {
    const clave = `${businessId}:${fecha}`;
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${clave}))`;
  }

  /**
   * El horario tiene que estar entre los que ofrecería el motor. Si no está:
   * 409 si se ocupó (sin los turnos existentes estaría libre), 400 si nunca
   * fue válido (fuera de horario, de la grilla o de la ventana).
   */
  private exigirLibre(ctx: ContextoDisponibilidad, fecha: string, inicioMin: number, duracionMin: number, resourceId: string): HorarioLibre {
    const libre = horarioSiEstaLibre(ctx, fecha, inicioMin, duracionMin, resourceId);
    if (libre) return libre;
    const vacio = horarioSiEstaLibre({ ...ctx, turnos: [] }, fecha, inicioMin, duracionMin, resourceId);
    if (vacio) throw new ConflictException(MSJ_OCUPADO);
    throw new BadRequestException(MSJ_NO_DISPONIBLE);
  }

  /** Un código que no esté usado en el negocio, ni en turnos ni en inscripciones a clases (§ 1.5). */
  private async codigoLibre(tx: Tx, businessId: string): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = generarCodigo();
      const [turno, inscripcion] = await Promise.all([
        tx.appointment.findFirst({ where: { businessId, code }, select: { id: true } }),
        tx.appointmentClassEnrollment.findFirst({ where: { businessId, code }, select: { id: true } }),
      ]);
      if (!turno && !inscripcion) return code;
    }
    // Con 32^6 combinaciones no debería pasar nunca: el P2002 de la base reintenta la transacción.
    return generarCodigo();
  }

  /**
   * La ficha del cliente (CONTRATO.md § 0, "Cliente"): la que viene, o la que
   * tenga ese teléfono, o ese email; si no hay, se crea (sin contraseña).
   */
  private async resolverCliente(tx: Tx, businessId: string, c: ClienteDelAlta): Promise<string | null> {
    if (c.customerId) {
      const existe = await tx.customer.findFirst({ where: { id: c.customerId, businessId, deletedAt: null }, select: { id: true } });
      if (!existe) throw new NotFoundException('Ese cliente no existe.');
      return existe.id;
    }
    if (c.buscarOCrearFicha === false) return null;
    const email = c.email?.trim().toLowerCase() || null;
    if (c.phone) {
      const porTelefono = await tx.customer.findFirst({ where: { businessId, phone: c.phone, deletedAt: null }, select: { id: true }, orderBy: { createdAt: 'asc' } });
      if (porTelefono) return porTelefono.id;
    }
    if (email) {
      const porEmail = await tx.customer.findFirst({ where: { businessId, email, deletedAt: null }, select: { id: true } });
      if (porEmail) return porEmail.id;
    }
    const [firstName, ...resto] = c.name.trim().split(/\s+/);
    // El email solo si ningún otro cliente del negocio lo tiene (único por negocio, borrados incluidos).
    const emailLibre = email ? !(await tx.customer.findFirst({ where: { businessId, email }, select: { id: true } })) : false;
    const nuevo = await tx.customer.create({
      data: { businessId, firstName: firstName || c.name.trim(), lastName: resto.join(' ') || null, phone: c.phone || null, email: emailLibre ? email : null },
      select: { id: true },
    });
    return nuevo.id;
  }

  /** Marca la bienvenida como usada y descuenta el crédito de señas aplicado. */
  private async consumirBeneficios(tx: Tx, businessId: string, customerId: string, cobro: ResultadoCobro, ahora: Date): Promise<void> {
    const perfil = await tx.appointmentCustomerProfile.findFirst({ where: { businessId, customerId }, select: { id: true } });
    if (!perfil) {
      // Sin perfil no hay crédito: solo puede ser la bienvenida.
      await tx.appointmentCustomerProfile.create({ data: { businessId, customerId, welcomeUsedAt: cobro.usaBienvenida ? ahora : null } });
      return;
    }
    if (cobro.usaBienvenida) {
      const n = await tx.appointmentCustomerProfile.updateMany({ where: { businessId, customerId, welcomeUsedAt: null }, data: { welcomeUsedAt: ahora } });
      if (n.count === 0) throw new ConflictException('El descuento de bienvenida ya se usó. Probá de nuevo.');
    }
    if (cobro.creditoUsado > 0) {
      const n = await tx.appointmentCustomerProfile.updateMany({
        where: { businessId, customerId, depositCredit: { gte: cobro.creditoUsado } },
        data: { depositCredit: { decrement: cobro.creditoUsado } },
      });
      if (n.count === 0) throw new ConflictException('El crédito a favor cambió. Probá de nuevo.');
    }
  }

  /** Lo que se cobró de seña: los pagos DEPOSIT aprobados; sin filas de pago, el monto pedido. */
  private async senaCobrada(tx: Tx, turno: Appointment): Promise<number> {
    const pagos = await tx.appointmentPayment.aggregate({
      where: { businessId: turno.businessId, appointmentId: turno.id, status: 'APPROVED', kind: 'DEPOSIT' },
      _sum: { amount: true },
    });
    return pagos._sum.amount === null ? num(turno.depositAmount) : num(pagos._sum.amount);
  }

  private async sumarAlPerfil(tx: Tx, businessId: string, customerId: string, suma: { noShows: number; credito: number }): Promise<void> {
    const n = await tx.appointmentCustomerProfile.updateMany({
      where: { businessId, customerId },
      data: { noShowCount: { increment: suma.noShows }, depositCredit: { increment: suma.credito } },
    });
    if (n.count === 0) {
      await tx.appointmentCustomerProfile.create({ data: { businessId, customerId, noShowCount: suma.noShows, depositCredit: suma.credito } });
    }
  }
}
