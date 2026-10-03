import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AppointmentSettings } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import type { MemberContext } from '../../../common/types/auth-context.type';
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import type { GananciasDto, GananciasPersonaDto, LiquidacionTurnos, PagoEquipoDto, Paginado } from '../../appointments.types';
import { esFecha, instanteDe, sumarDias, type HorarioNegocio } from '../../horarios/horarios';
import { tiene } from '../comun/alcance';
import { GestionContextoService } from '../comun/contexto.service';
import { fechaCorta } from '../comun/mapeos';
import { exigirRango } from '../comun/rango';
import type { PaginaQueryDto, RegisterPayoutDto } from './dto/ganancias.dto';
import {
  aCobrar, aPagar, claveSesion, clasesDadasEntre, desdePendiente, formaDePagoDto, liquidarEntre, totalesDelPeriodo,
  type PersonaLiquidable, type PlantillaLiquidable, type TurnoLiquidable,
} from './liquidacion';

const VER_TODO = 'appointments.earnings.view_all';

type Db = PrismaService | Prisma.TransactionClient;

const personaSelect = {
  id: true, name: true, color: true, roleLabel: true, assignedSpaceId: true, createdAt: true,
  payForm: true, commissionPercent: true, salary: true, rent: true, perClass: true, payEvery: true,
  member: { select: { role: { select: { name: true } } } },
} satisfies Prisma.AppointmentResourceSelect;

type PersonaFila = Prisma.AppointmentResourceGetPayload<{ select: typeof personaSelect }>;

interface Datos {
  turnos: TurnoLiquidable[];
  plantillas: PlantillaLiquidable[];
  suspendidas: Set<string>;
}

/**
 * Ganancias y liquidaciones del equipo (CONTRATO § P3.4). La cuenta en sí son
 * funciones puras (liquidacion.ts); acá se trae de la base lo que necesitan
 * y se arma la respuesta según el alcance de quien mira.
 */
@Injectable()
export class GananciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: GestionContextoService,
    private readonly audit?: AuditService,
  ) {}

  async resumen(member: MemberContext, q: { from?: string; to?: string }, ahora = new Date()): Promise<GananciasDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const hoy = fechaArgentina(ahora);
    const rango = exigirRango(q.from, q.to, 366, { from: `${hoy.slice(0, 8)}01`, to: hoy });
    const todo = tiene(member, VER_TODO);

    const propio = todo ? null : await this.ctx.miRecurso(member);
    const personas = todo || propio
      ? await this.prisma.appointmentResource.findMany({
          where: { businessId: member.businessId, kind: 'PERSON', deletedAt: null, ...(todo ? {} : { id: propio!.id }) },
          select: personaSelect,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        })
      : [];

    const filas = await this.armar(this.prisma, member.businessId, settings, personas, rango, hoy, ahora);
    let totals: GananciasDto['totals'] = null;
    if (todo) {
      const agg = await this.prisma.appointment.aggregate({
        where: { businessId: member.businessId, status: 'COMPLETED', startsAt: { gte: instanteDe(rango.from, 0), lt: instanteDe(sumarDias(rango.to, 1), 0) } },
        _sum: { price: true, discountAmount: true },
        _count: { _all: true },
      });
      const billed = Number(agg._sum.price ?? 0) - Number(agg._sum.discountAmount ?? 0);
      totals = totalesDelPeriodo(filas.map((f) => ({ forma: f.person.pay?.payForm ?? null, period: f.period })), billed, agg._count._all);
    }
    return { from: rango.from, to: rango.to, totals, people: filas };
  }

  async persona(member: MemberContext, resourceId: string, q: { from?: string; to?: string }, ahora = new Date()): Promise<GananciasPersonaDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const hoy = fechaArgentina(ahora);
    const rango = exigirRango(q.from, q.to, 366, { from: `${hoy.slice(0, 8)}01`, to: hoy });
    const p = await this.personaVisible(member, resourceId);
    const [fila] = await this.armar(this.prisma, member.businessId, settings, [p], rango, hoy, ahora);
    return fila;
  }

  async pagos(member: MemberContext, resourceId: string, q: PaginaQueryDto): Promise<Paginado<PagoEquipoDto>> {
    await this.ctx.delNegocio(member.businessId);
    await this.personaVisible(member, resourceId);
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where = { businessId: member.businessId, resourceId };
    const [total, filas] = await Promise.all([
      this.prisma.appointmentStaffPayout.count({ where }),
      this.prisma.appointmentStaffPayout.findMany({
        where,
        orderBy: [{ periodTo: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { registeredByMember: { select: { name: true } } },
      }),
    ]);
    return {
      data: filas.map((f) => ({
        id: f.id, resourceId: f.resourceId, periodFrom: f.periodFrom, periodTo: f.periodTo, amount: Number(f.amount),
        direction: f.direction, note: f.note, paidAt: f.paidAt.toISOString(), registeredByMemberName: f.registeredByMember?.name ?? null,
      })),
      total, page, limit,
    };
  }

  /**
   * Registrar un pago: cierra el período desde el día siguiente al último pago
   * hasta `periodTo`. En una transacción con lock por persona: dos pagos
   * simultáneos no pueden cerrar el mismo período dos veces.
   */
  async registrarPago(member: MemberContext, resourceId: string, dto: RegisterPayoutDto, ahora = new Date()): Promise<GananciasPersonaDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    if (!tiene(member, VER_TODO)) throw new NotFoundException('Persona no encontrada');
    const hoy = fechaArgentina(ahora);
    const periodTo = dto.periodTo ?? hoy;
    if (!esFecha(periodTo)) throw new BadRequestException('La fecha no es válida.');
    if (periodTo > hoy) throw new BadRequestException('No se puede pagar un período que todavía no llegó.');
    const p = await this.personaVisible(member, resourceId);
    if (!p.payForm) throw new BadRequestException('El dueño no se liquida: lo que factura queda para el negocio.');
    const horario = await this.ctx.horario(member.businessId, settings);

    const pago = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'payout:' + resourceId}))`;
      const ultimo = await tx.appointmentStaffPayout.findFirst({
        where: { businessId: member.businessId, resourceId },
        orderBy: { periodTo: 'desc' },
        select: { periodTo: true },
      });
      const paidUntil = ultimo?.periodTo ?? null;
      if (paidUntil && periodTo <= paidUntil) throw new BadRequestException(`Ya está pagado hasta el ${fechaCorta(paidUntil)}.`);
      const periodFrom = desdePendiente(paidUntil, fechaArgentina(p.createdAt));
      const datos = await this.cargar(tx, member.businessId, [p], periodFrom, periodTo);
      const liq = this.liquidar(p, periodFrom, periodTo, datos, horario, ahora);
      const debe = p.payForm === 'RENT' ? aCobrar(p.payForm, liq) : aPagar(p.payForm, liq);
      const amount = dto.amount ?? debe;
      if (!(amount > 0)) throw new BadRequestException('No hay nada pendiente para liquidar.');
      return tx.appointmentStaffPayout.create({
        data: {
          businessId: member.businessId,
          resourceId,
          periodFrom,
          periodTo,
          amount,
          direction: p.payForm === 'RENT' ? 'PERSON_TO_BUSINESS' : 'BUSINESS_TO_PERSON',
          breakdown: liq as unknown as Prisma.InputJsonValue,
          note: dto.note ?? null,
          registeredByMemberId: member.memberId,
        },
      });
    }, { timeout: 15_000 });

    await this.audit?.registrar({
      businessId: member.businessId, memberId: member.memberId, entityType: 'appointment_payout', entityId: pago.id, action: 'CREATE',
      changes: [
        { field: 'persona', before: null, after: p.name },
        { field: 'periodo', before: null, after: `${pago.periodFrom} a ${pago.periodTo}` },
        { field: 'amount', before: null, after: Number(pago.amount) },
        { field: 'direction', before: null, after: pago.direction },
      ],
    });
    return this.persona(member, resourceId, {}, ahora);
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /** Una persona del equipo que quien mira puede ver; si no, 404 (no se revela que existe). */
  private async personaVisible(member: MemberContext, resourceId: string): Promise<PersonaFila> {
    if (!tiene(member, VER_TODO)) {
      const propio = await this.ctx.miRecurso(member);
      if (!propio || propio.id !== resourceId) throw new NotFoundException('Persona no encontrada');
    }
    const p = await this.prisma.appointmentResource.findFirst({
      where: { id: resourceId, businessId: member.businessId, kind: 'PERSON', deletedAt: null },
      select: personaSelect,
    });
    if (!p) throw new NotFoundException('Persona no encontrada');
    return p;
  }

  private async armar(
    db: Db, businessId: string, settings: AppointmentSettings, personas: PersonaFila[], rango: { from: string; to: string }, hoy: string, ahora: Date,
  ): Promise<GananciasPersonaDto[]> {
    if (personas.length === 0) return [];
    const ultimos = await db.appointmentStaffPayout.groupBy({
      by: ['resourceId'],
      where: { businessId, resourceId: { in: personas.map((p) => p.id) } },
      _max: { periodTo: true },
    });
    const pagadoHasta = new Map(ultimos.filter((u) => u._max.periodTo).map((u) => [u.resourceId, u._max.periodTo as string]));
    const desdes = personas.map((p) => desdePendiente(pagadoHasta.get(p.id) ?? null, fechaArgentina(p.createdAt)));
    const desde = [rango.from, ...desdes].sort()[0];
    const hasta = [rango.to, hoy].sort()[1];
    const datos = await this.cargar(db, businessId, personas, desde, hasta);
    const horario = await this.ctx.horario(businessId, settings, { from: desde, to: hasta });

    return personas.map((p, i) => {
      const pay = formaDePagoDto(p);
      const period = this.liquidar(p, rango.from, rango.to, datos, horario, ahora);
      const pending = this.liquidar(p, desdes[i], hoy, datos, horario, ahora);
      return {
        person: { resourceId: p.id, name: p.name, color: p.color, roleName: p.member?.role.name ?? p.roleLabel, pay },
        period,
        pending,
        paidUntil: pagadoHasta.get(p.id) ?? null,
        toPay: aPagar(p.payForm, pending),
        toCollect: aCobrar(p.payForm, pending),
      };
    });
  }

  /** Turnos atendidos, plantillas y clases suspendidas de esas personas en el rango. */
  private async cargar(db: Db, businessId: string, personas: PersonaFila[], desde: string, hasta: string): Promise<Datos> {
    const agendas = [...new Set(personas.flatMap((p) => [p.id, ...(p.assignedSpaceId ? [p.assignedSpaceId] : [])]))];
    const ids = personas.map((p) => p.id);
    const [turnos, plantillas] = await Promise.all([
      db.appointment.findMany({
        where: {
          businessId, status: 'COMPLETED', resourceId: { in: agendas },
          startsAt: { gte: instanteDe(desde, 0), lt: instanteDe(sumarDias(hasta, 1), 0) },
        },
        select: { id: true, resourceId: true, status: true, startsAt: true, price: true, discountAmount: true, customerName: true, serviceName: true },
      }),
      db.appointmentClassTemplate.findMany({
        where: { businessId, instructorResourceId: { in: ids } },
        select: { id: true, instructorResourceId: true, weekday: true, startMin: true, durationMin: true, isActive: true, createdAt: true, deletedAt: true },
      }),
    ]);
    const suspendidas = plantillas.length === 0 ? [] : await db.appointmentClassSession.findMany({
      where: { businessId, isCancelled: true, templateId: { in: plantillas.map((t) => t.id) }, date: { gte: desde, lte: hasta } },
      select: { templateId: true, date: true },
    });
    return {
      turnos: turnos.map((t) => ({ ...t, price: Number(t.price), discountAmount: Number(t.discountAmount) })),
      plantillas,
      suspendidas: new Set(suspendidas.map((s) => claveSesion(s.templateId, s.date))),
    };
  }

  private liquidar(p: PersonaFila, from: string, to: string, datos: Datos, horario: HorarioNegocio, ahora: Date): LiquidacionTurnos {
    const persona: PersonaLiquidable = {
      resourceId: p.id,
      assignedSpaceId: p.assignedSpaceId,
      payForm: p.payForm,
      commissionPercent: Number(p.commissionPercent ?? 0),
      salary: Number(p.salary ?? 0),
      rent: Number(p.rent ?? 0),
      perClass: Number(p.perClass ?? 0),
    };
    const clases = to < from ? 0 : clasesDadasEntre(p.id, datos.plantillas, datos.suspendidas, horario, from, to, ahora);
    return liquidarEntre(persona, from, to, datos.turnos, clases);
  }
}
