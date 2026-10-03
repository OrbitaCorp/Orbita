import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { MemberContext } from '../../../common/types/auth-context.type';
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import type { MembresiaDto, Paginado, PlanMembresiaDto } from '../../appointments.types';
import { diasEntre, esFecha } from '../../horarios/horarios';
import { resolverCliente } from '../comun/clientes';
import { AvanzadoContextoService, Db, exigirPermiso } from '../comun/contexto.service';
import { aNumero } from '../comun/dinero';
import { paginacion } from '../comun/paginado';
import { bloquear, enTransaccion } from '../comun/transacciones';
import { CreateMembershipDto, ListMembershipsQuery, PauseMembershipDto, UpsertMembershipPlanDto } from './dto/membresias.dto';
import { pausadaEn, proximoDiaDeCobro, semanaDe, venceElDia } from './membresias.puro';

const DIA_MS = 24 * 3600 * 1000;
/** Membresías que "siguen": un cliente tiene una sola de estas a la vez. */
const VIGENTES = ['ACTIVE', 'PAUSED', 'PAST_DUE'] as const;

type MembresiaConPlan = Prisma.AppointmentMembershipGetPayload<{ include: { plan: { select: { name: true } } } }>;

const membresiaADto = (m: MembresiaConPlan): MembresiaDto => ({
  id: m.id, planId: m.planId, planName: m.plan.name, customerName: m.customerName, status: m.status,
  startedAt: m.startedAt.toISOString(), pausedUntil: m.pausedUntil?.toISOString() ?? null, nextChargeAt: m.nextChargeAt?.toISOString() ?? null,
});

export interface CoberturaMembresia {
  membershipId: string;
  /** 0 = pase libre. */
  perWeek: number;
  /** Turnos/clases de esa semana que ya usó, SIN contar este. */
  usadasEnLaSemana: number;
}

/**
 * Membresías y abonos (P4.2). La cuota se registra a mano (no hay débito
 * automático: CONTRATO § Pendientes 4); `nextChargeAt` marca el vencimiento y,
 * pasado sin pago, la membresía queda PAST_DUE (perezoso: al leer).
 *
 * Para la reserva exporta `turnoCubiertoPorMembresia`: una ACTIVE cubre el
 * turno (aPagar = 0) hasta `perWeek` por semana, de lunes a domingo.
 */
@Injectable()
export class MembresiasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: AvanzadoContextoService,
    private readonly audit: AuditService,
  ) {}

  // ── Planes ───────────────────────────────────────────────────────────────

  async listarPlanes(businessId: string): Promise<PlanMembresiaDto[]> {
    await this.contexto.delNegocio(businessId);
    const [planes, socios] = await Promise.all([
      this.prisma.appointmentMembershipPlan.findMany({ where: { businessId, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.appointmentMembership.groupBy({ by: ['planId'], where: { businessId, status: { in: [...VIGENTES] } }, _count: { _all: true } }),
    ]);
    const porPlan = new Map(socios.map((s) => [s.planId, s._count._all]));
    return planes.map((p) => ({
      id: p.id, name: p.name, perWeek: p.perWeek, price: aNumero(p.price), isFeatured: p.isFeatured, isActive: p.isActive, members: porPlan.get(p.id) ?? 0,
    }));
  }

  async crearPlan(businessId: string, memberId: string, dto: UpsertMembershipPlanDto): Promise<PlanMembresiaDto> {
    await this.contexto.delNegocio(businessId);
    const p = await this.prisma.appointmentMembershipPlan.create({
      data: { businessId, name: dto.name.trim(), perWeek: dto.perWeek, price: dto.price, isFeatured: dto.isFeatured ?? false, isActive: dto.isActive ?? true },
    });
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_membership_plan', entityId: p.id, action: 'CREATE' });
    return { id: p.id, name: p.name, perWeek: p.perWeek, price: aNumero(p.price), isFeatured: p.isFeatured, isActive: p.isActive, members: 0 };
  }

  async editarPlan(businessId: string, memberId: string, id: string, dto: UpsertMembershipPlanDto): Promise<PlanMembresiaDto> {
    await this.contexto.delNegocio(businessId);
    const antes = await this.prisma.appointmentMembershipPlan.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!antes) throw new NotFoundException('Ese plan no existe.');
    const data = { name: dto.name.trim(), perWeek: dto.perWeek, price: new Prisma.Decimal(dto.price), isFeatured: dto.isFeatured ?? antes.isFeatured, isActive: dto.isActive ?? antes.isActive };
    const { count } = await this.prisma.appointmentMembershipPlan.updateMany({ where: { id, businessId, deletedAt: null }, data });
    if (count === 0) throw new NotFoundException('Ese plan no existe.');
    await this.audit.registrar({
      businessId, memberId, entityType: 'appointment_membership_plan', entityId: id, action: 'UPDATE',
      changes: AuditService.diferencias(antes, { ...antes, ...data }, ['name', 'perWeek', 'price', 'isFeatured', 'isActive']),
    });
    return (await this.listarPlanes(businessId)).find((p) => p.id === id)!;
  }

  async borrarPlan(businessId: string, memberId: string, id: string): Promise<{ ok: true }> {
    await this.contexto.delNegocio(businessId);
    const socios = await this.prisma.appointmentMembership.count({ where: { businessId, planId: id, status: { in: [...VIGENTES] } } });
    if (socios > 0) throw new BadRequestException(`Hay ${socios} ${socios === 1 ? 'persona' : 'personas'} con este plan. Cancelá esas membresías antes de borrarlo.`);
    const { count } = await this.prisma.appointmentMembershipPlan.updateMany({ where: { id, businessId, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } });
    if (count === 0) throw new NotFoundException('Ese plan no existe.');
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_membership_plan', entityId: id, action: 'DELETE' });
    return { ok: true };
  }

  async listarPlanesPublicos(businessId: string): Promise<Omit<PlanMembresiaDto, 'members'>[]> {
    const { on } = await this.contexto.activa(businessId, 'membresias');
    if (!on) return [];
    const planes = await this.prisma.appointmentMembershipPlan.findMany({
      where: { businessId, deletedAt: null, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return planes.map((p) => ({ id: p.id, name: p.name, perWeek: p.perWeek, price: aNumero(p.price), isFeatured: p.isFeatured, isActive: true }));
  }

  // ── Membresías ───────────────────────────────────────────────────────────

  async listar(businessId: string, q: ListMembershipsQuery): Promise<Paginado<MembresiaDto>> {
    await this.contexto.delNegocio(businessId);
    await this.refrescarEstados(businessId);
    const { page, limit, skip } = paginacion(q);
    const where: Prisma.AppointmentMembershipWhereInput = { businessId, ...(q.status ? { status: q.status } : {}) };
    const [total, filas] = await Promise.all([
      this.prisma.appointmentMembership.count({ where }),
      this.prisma.appointmentMembership.findMany({ where, include: { plan: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    ]);
    return { data: filas.map(membresiaADto), total, page, limit };
  }

  /** Alta en el local: cobra la primera cuota (+ matrícula si hay) y queda ACTIVE hasta el próximo día de cobro. */
  async crear(member: MemberContext, dto: CreateMembershipDto): Promise<MembresiaDto> {
    const { businessId, memberId } = member;
    exigirPermiso(member, 'appointments.cash.charge');
    const negocio = await this.contexto.delNegocio(businessId);
    this.contexto.exigirPrendida(negocio.settings, 'membresias');
    const { config } = this.contexto.funcion(negocio.settings, 'membresias');
    const plan = await this.prisma.appointmentMembershipPlan.findFirst({ where: { id: dto.planId, businessId, deletedAt: null, isActive: true } });
    if (!plan) throw new NotFoundException('Ese plan no existe.');

    const creada = await this.prisma.$transaction(async (tx) => {
      const cliente = await resolverCliente(tx, businessId, dto);
      await bloquear(tx, `appt-membresia-cliente:${cliente.id}`);
      const otra = await tx.appointmentMembership.findFirst({ where: { businessId, customerId: cliente.id, status: { in: [...VIGENTES] } }, select: { id: true } });
      if (otra) throw new BadRequestException('Ese cliente ya tiene una membresía. Cancelala antes de darle otra.');
      const ahora = new Date();
      const m = await tx.appointmentMembership.create({
        data: {
          businessId, planId: plan.id, customerId: cliente.id, customerName: cliente.name.slice(0, 120), customerPhone: cliente.phone.slice(0, 40),
          status: 'ACTIVE', startedAt: ahora, lastPaidAt: ahora, nextChargeAt: venceElDia(proximoDiaDeCobro(fechaArgentina(ahora), config.diaCobro)),
        },
        include: { plan: { select: { name: true } } },
      });
      const matricula = config.matricula > 0 ? config.matricula : 0;
      await tx.appointmentPayment.create({
        data: { businessId, kind: 'MEMBERSHIP', membershipId: m.id, method: dto.method, status: 'APPROVED', amount: aNumero(plan.price) + matricula, paidAt: ahora, registeredByMemberId: memberId },
      });
      return m;
    });
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_membership', entityId: creada.id, action: 'CREATE', changes: [{ field: 'planId', before: null, after: plan.id }] });
    return membresiaADto(creada);
  }

  async pausar(businessId: string, memberId: string, id: string, dto: PauseMembershipDto): Promise<MembresiaDto> {
    const negocio = await this.contexto.delNegocio(businessId);
    const { config } = this.contexto.funcion(negocio.settings, 'membresias');
    if (!config.pausa) throw new BadRequestException('Este negocio no permite pausar membresías.');
    if (!esFecha(dto.until)) throw new BadRequestException('Esa fecha no existe.');
    const hoy = fechaArgentina(new Date());
    const dias = diasEntre(hoy, dto.until);
    if (dias < 1) throw new BadRequestException('La pausa tiene que terminar después de hoy.');
    if (dias > config.diasPausa) throw new BadRequestException(`Se puede pausar hasta ${config.diasPausa} días.`);
    const m = await this.buscar(businessId, id);
    if (m.status !== 'ACTIVE') throw new BadRequestException('Solo se puede pausar una membresía activa.');
    const ahora = new Date();
    const pausedUntil = venceElDia(dto.until);
    // Los días pausados corren el vencimiento de la cuota.
    const nextChargeAt = m.nextChargeAt ? new Date(m.nextChargeAt.getTime() + dias * DIA_MS) : null;
    await this.actualizar(businessId, id, { status: 'ACTIVE' }, { status: 'PAUSED', pausedFrom: ahora, pausedUntil, nextChargeAt });
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_membership', entityId: id, action: 'DEACTIVATE', changes: [{ field: 'pausedUntil', before: m.pausedUntil, after: pausedUntil }] });
    return this.dto(businessId, id);
  }

  async reanudar(businessId: string, memberId: string, id: string): Promise<MembresiaDto> {
    await this.contexto.delNegocio(businessId);
    const m = await this.buscar(businessId, id);
    if (m.status !== 'PAUSED') throw new BadRequestException('Esa membresía no está pausada.');
    const ahora = new Date();
    // Vuelve antes: se devuelven al vencimiento los días de pausa que no usó.
    const sobrantes = m.pausedUntil ? Math.max(0, Math.floor((m.pausedUntil.getTime() - ahora.getTime()) / DIA_MS)) : 0;
    const nextChargeAt = m.nextChargeAt ? new Date(m.nextChargeAt.getTime() - sobrantes * DIA_MS) : null;
    await this.actualizar(businessId, id, { status: 'PAUSED' }, { status: 'ACTIVE', pausedUntil: ahora, nextChargeAt });
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_membership', entityId: id, action: 'ACTIVATE' });
    return this.dto(businessId, id);
  }

  async cancelar(businessId: string, memberId: string, id: string): Promise<MembresiaDto> {
    await this.contexto.delNegocio(businessId);
    const m = await this.buscar(businessId, id);
    if (m.status === 'CANCELLED') return this.dto(businessId, id);
    await this.actualizar(businessId, id, { status: { in: [...VIGENTES] } }, { status: 'CANCELLED', cancelledAt: new Date() });
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_membership', entityId: id, action: 'DEACTIVATE', changes: [{ field: 'status', before: m.status, after: 'CANCELLED' }] });
    return this.dto(businessId, id);
  }

  /** Registrar la cuota a mano: corre el vencimiento un mes y saca la membresía de PAST_DUE. */
  async registrarCuota(businessId: string, memberId: string, id: string, method: CreateMembershipDto['method']): Promise<MembresiaDto> {
    const negocio = await this.contexto.delNegocio(businessId);
    const { config } = this.contexto.funcion(negocio.settings, 'membresias');
    await this.prisma.$transaction(async (tx) => {
      await bloquear(tx, `appt-membresia:${id}`);
      const m = await tx.appointmentMembership.findFirst({ where: { id, businessId }, include: { plan: { select: { price: true } } } });
      if (!m) throw new NotFoundException('Esa membresía no existe.');
      if (m.status === 'CANCELLED') throw new BadRequestException('Esa membresía está cancelada.');
      const ahora = new Date();
      // La cuota paga cubre el período que vence en nextChargeAt; si ya estaba vencida hace más de un mes, arranca de nuevo desde hoy.
      const base = m.nextChargeAt && m.nextChargeAt.getTime() > ahora.getTime() - 31 * DIA_MS ? fechaArgentina(m.nextChargeAt) : fechaArgentina(ahora);
      const nextChargeAt = venceElDia(proximoDiaDeCobro(base, config.diaCobro));
      await tx.appointmentPayment.create({
        data: { businessId, kind: 'MEMBERSHIP', membershipId: m.id, method, status: 'APPROVED', amount: m.plan.price, paidAt: ahora, registeredByMemberId: memberId },
      });
      const { count } = await tx.appointmentMembership.updateMany({
        where: { id, businessId },
        data: { lastPaidAt: ahora, nextChargeAt, ...(m.status === 'PAST_DUE' ? { status: 'ACTIVE' as const } : {}) },
      });
      if (count === 0) throw new NotFoundException('Esa membresía no existe.');
    });
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_membership', entityId: id, action: 'UPDATE', changes: [{ field: 'lastPaidAt', before: null, after: new Date() }] });
    return this.dto(businessId, id);
  }

  // ── Para enchufar en la reserva ──────────────────────────────────────────

  /**
   * ¿La membresía del cliente cubre un turno/clase que empieza en `startsAt`?
   * null = no tiene, no está activa ese día (pausada, vencida) o ya usó las de
   * esa semana: se paga suelto. Si cubre, guardar `membershipId` en el turno
   * (o la inscripción) DENTRO de la misma transacción: el cupo semanal se
   * cuenta con esas filas, y el lock por membresía serializa dos reservas a la vez.
   */
  async turnoCubiertoPorMembresia(
    p: { businessId: string; customerId: string | null; startsAt: Date },
    tx?: Db,
  ): Promise<CoberturaMembresia | null> {
    if (!p.customerId) return null;
    return enTransaccion(this.prisma, tx, async (t) => {
      const { on } = await this.contexto.activa(p.businessId, 'membresias', t);
      if (!on) return null;
      const m = await t.appointmentMembership.findFirst({
        where: { businessId: p.businessId, customerId: p.customerId!, status: { in: ['ACTIVE', 'PAUSED'] } },
        include: { plan: { select: { perWeek: true } } },
        orderBy: { createdAt: 'desc' },
      });
      if (!m) return null;
      const ahora = new Date();
      if (m.nextChargeAt && m.nextChargeAt.getTime() < ahora.getTime()) return null; // cuota vencida
      if (pausadaEn(m, p.startsAt) || (m.status === 'PAUSED' && pausadaEn(m, ahora))) return null;
      await bloquear(t, `appt-membresia:${m.id}`);
      const { desde, hasta } = semanaDe(p.startsAt);
      const [turnos, clases] = await Promise.all([
        t.appointment.count({ where: { businessId: p.businessId, membershipId: m.id, status: { not: 'CANCELLED' }, startsAt: { gte: desde, lt: hasta } } }),
        t.appointmentClassEnrollment.count({ where: { businessId: p.businessId, membershipId: m.id, status: 'ENROLLED', session: { startsAt: { gte: desde, lt: hasta } } } }),
      ]);
      const usadas = turnos + clases;
      if (m.plan.perWeek > 0 && usadas >= m.plan.perWeek) return null;
      return { membershipId: m.id, perWeek: m.plan.perWeek, usadasEnLaSemana: usadas };
    });
  }

  /** La membresía vigente de un cliente (para "Mis turnos" y la ficha). */
  async membresiaDelCliente(businessId: string, customerId: string, tx: Db = this.prisma): Promise<MembresiaDto | null> {
    const m = await tx.appointmentMembership.findFirst({
      where: { businessId, customerId, status: { in: [...VIGENTES] } }, include: { plan: { select: { name: true } } }, orderBy: { createdAt: 'desc' },
    });
    return m ? membresiaADto(m) : null;
  }

  // ── Internos ─────────────────────────────────────────────────────────────

  /** Perezoso (no hay cron frecuente): cuotas vencidas → PAST_DUE; pausas terminadas → ACTIVE. */
  async refrescarEstados(businessId: string, tx: Db = this.prisma): Promise<void> {
    const ahora = new Date();
    await tx.appointmentMembership.updateMany({ where: { businessId, status: 'PAUSED', pausedUntil: { lt: ahora } }, data: { status: 'ACTIVE' } });
    await tx.appointmentMembership.updateMany({ where: { businessId, status: 'ACTIVE', nextChargeAt: { lt: ahora } }, data: { status: 'PAST_DUE' } });
  }

  private async buscar(businessId: string, id: string) {
    await this.refrescarEstados(businessId);
    const m = await this.prisma.appointmentMembership.findFirst({ where: { id, businessId } });
    if (!m) throw new NotFoundException('Esa membresía no existe.');
    return m;
  }

  private async actualizar(businessId: string, id: string, condicion: Prisma.AppointmentMembershipWhereInput, data: Prisma.AppointmentMembershipUpdateManyMutationInput) {
    const { count } = await this.prisma.appointmentMembership.updateMany({ where: { id, businessId, ...condicion }, data });
    // Otro request la cambió en el medio.
    if (count === 0) throw new BadRequestException('La membresía cambió mientras la editabas. Volvé a intentar.');
  }

  private async dto(businessId: string, id: string): Promise<MembresiaDto> {
    const m = await this.prisma.appointmentMembership.findFirst({ where: { id, businessId }, include: { plan: { select: { name: true } } } });
    if (!m) throw new NotFoundException('Esa membresía no existe.');
    return membresiaADto(m);
  }
}

