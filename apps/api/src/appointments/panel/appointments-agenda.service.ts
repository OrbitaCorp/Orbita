import { BadRequestException, Injectable } from '@nestjs/common';
import type { MemberContext } from '../../common/types/auth-context.type';
import { fechaArgentina } from '../../common/utils/hora-argentina';
import { PrismaService } from '../../prisma/prisma.service';
import type { AgendaDiaDto, AgendaRangoDto, ResumenDelDiaDto, TurnoDto } from '../appointments.types';
import { horariosLibres } from '../disponibilidad/disponibilidad';
import {
  diasEntre, esFecha, estadoA, fechaYMinutos, horarioDelNegocio, instanteDe, minutosAbiertos, sumarDias, tramosDelRecurso,
} from '../horarios/horarios';
import { AppointmentsSettingsService } from './appointments-settings.service';
import { AppointmentsService, kindsDeModo } from './appointments.service';
import { agendasPropias, tiene } from './lib/permisos';
import { SELECT_TURNO, horarioNegocioDe, num, recursoDto, turnoDto } from './lib/serializar';

/** La grilla del mes: hasta 6 semanas. */
const MAX_DIAS_AGENDA = 42;

/**
 * Agenda del día, semana/mes y resumen (CONTRATO.md § P1.5). Sin
 * `agenda.view_all`, solo las agendas propias.
 *
 * Las clases (modo CLASS) son de P3: `classes` viaja vacío hasta que P3 lo llene.
 */
@Injectable()
export class AppointmentsAgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppointmentsSettingsService,
    private readonly nucleo: AppointmentsService,
  ) {}

  /** Las agendas que se dibujan: reservables, activas, del tipo del modo, dentro del alcance. */
  private async agendas(member: MemberContext) {
    const settings = await this.settings.delNegocio(member.businessId);
    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.view_all');
    const recursos = await this.prisma.appointmentResource.findMany({
      where: {
        businessId: member.businessId, isBookable: true, isActive: true, deletedAt: null, kind: { in: kindsDeModo(settings.agendaMode) },
        ...(propias ? { id: { in: propias } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { settings, recursos };
  }

  private async turnosEntre(businessId: string, ids: string[], desde: string, hasta: string) {
    if (ids.length === 0) return [];
    return this.prisma.appointment.findMany({
      where: { businessId, resourceId: { in: ids }, startsAt: { gte: instanteDe(desde, 0), lt: instanteDe(sumarDias(hasta, 1), 0) } },
      select: SELECT_TURNO,
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async dia(member: MemberContext, fecha?: string, ahora = new Date()): Promise<AgendaDiaDto> {
    const date = fecha ?? fechaArgentina(ahora);
    if (!esFecha(date)) throw new BadRequestException('La fecha no es válida.');
    const { settings, recursos } = await this.agendas(member);
    const especiales = await this.prisma.appointmentSpecialDay.findMany({ where: { businessId: member.businessId, date } });
    const negocio = horarioDelNegocio(horarioNegocioDe(settings, especiales), date);
    const turnos = await this.turnosEntre(member.businessId, recursos.map((r) => r.id), date, date);
    const contacto = tiene(member, 'appointments.clients.contact');

    return {
      date,
      businessRanges: negocio.tramos,
      closedReason: negocio.motivo,
      resources: recursos.map((r) => {
        const dto = recursoDto(r);
        return {
          resource: dto,
          ranges: tramosDelRecurso(dto, negocio.tramos, date),
          // Incluye los cancelados: la demo los muestra tachados.
          appointments: turnos.filter((t) => t.resourceId === r.id).map((t) => turnoDto(t, contacto, ahora)),
        };
      }),
      classes: [],
    };
  }

  async rango(member: MemberContext, desde: string, hasta: string, ahora = new Date()): Promise<AgendaRangoDto> {
    if (!esFecha(desde) || !esFecha(hasta)) throw new BadRequestException('Las fechas no son válidas.');
    if (hasta < desde) throw new BadRequestException('La fecha "hasta" tiene que ser igual o posterior a "desde".');
    if (diasEntre(desde, hasta) >= MAX_DIAS_AGENDA) throw new BadRequestException(`El rango puede ser de hasta ${MAX_DIAS_AGENDA} días.`);
    const { settings, recursos } = await this.agendas(member);
    const especiales = await this.prisma.appointmentSpecialDay.findMany({ where: { businessId: member.businessId, date: { gte: desde, lte: hasta } } });
    const horario = horarioNegocioDe(settings, especiales);
    const turnos = await this.turnosEntre(member.businessId, recursos.map((r) => r.id), desde, hasta);
    const contacto = tiene(member, 'appointments.clients.contact');

    const porDia = new Map<string, TurnoDto[]>();
    for (const t of turnos) {
      const dto = turnoDto(t, contacto, ahora);
      porDia.set(dto.date, [...(porDia.get(dto.date) ?? []), dto]);
    }
    const days = Array.from({ length: diasEntre(desde, hasta) + 1 }, (_, i) => {
      const date = sumarDias(desde, i);
      // Los cancelados viajan (el front decide si los cuenta).
      return { date, businessRanges: horarioDelNegocio(horario, date).tramos, appointments: porDia.get(date) ?? [], classes: [] };
    });
    return { from: desde, to: hasta, days };
  }

  async resumen(member: MemberContext, fecha?: string, ahora = new Date()): Promise<ResumenDelDiaDto> {
    const date = fecha ?? fechaArgentina(ahora);
    if (!esFecha(date)) throw new BadRequestException('La fecha no es válida.');
    const businessId = member.businessId;
    const { settings, recursos } = await this.agendas(member);
    const ids = recursos.map((r) => r.id);
    const especiales = await this.prisma.appointmentSpecialDay.findMany({ where: { businessId, date } });
    const negocio = horarioDelNegocio(horarioNegocioDe(settings, especiales), date);
    const turnos = await this.turnosEntre(businessId, ids, date, date);
    const contacto = tiene(member, 'appointments.clients.contact');
    const montos = tiene(member, 'appointments.reports.view');

    const activos = turnos.filter((t) => t.status !== 'CANCELLED');
    // Minutos tomados / minutos que atienden las agendas ese día (el corte del mediodía no cuenta).
    const atienden = recursos.reduce((suma, r) => suma + minutosAbiertos(tramosDelRecurso(recursoDto(r), negocio.tramos, date)), 0);
    const tomados = activos.reduce((suma, t) => suma + t.durationMin, 0);
    const occupancyPercent = atienden > 0 ? Math.min(100, Math.round((tomados / atienden) * 100)) : 0;

    let collectedRevenue: number | null = null;
    if (montos) {
      const cobrado = ids.length === 0 ? null : await this.prisma.appointmentPayment.aggregate({
        where: {
          businessId, status: 'APPROVED', paidAt: { gte: instanteDe(date, 0), lt: instanteDe(sumarDias(date, 1), 0) },
          appointment: { resourceId: { in: ids } },
        },
        _sum: { amount: true },
      });
      collectedRevenue = num(cobrado?._sum.amount);
    }

    const hoy = fechaArgentina(ahora);
    const ahoraMin = fechaYMinutos(ahora).minutos;
    const estado = date === hoy ? estadoA(negocio.tramos, ahoraMin) : { abierto: false, cierraMin: null, abreMin: negocio.tramos[0]?.[0] ?? null };

    const ctx = await this.nucleo.contexto({ businessId, settings, recursos, desde: date, hasta: date, modo: 'panel', ahora });
    const dtos = turnos.map((t) => turnoDto(t, contacto, ahora));

    return {
      date,
      now: ahora.toISOString(),
      open: { isOpen: estado.abierto, closesAtMin: estado.cierraMin, opensAtMin: estado.abreMin },
      kpis: {
        appointments: activos.length,
        pending: turnos.filter((t) => t.status === 'PENDING').length,
        completed: turnos.filter((t) => t.status === 'COMPLETED').length,
        noShow: turnos.filter((t) => t.status === 'NO_SHOW').length,
        cancelled: turnos.filter((t) => t.status === 'CANCELLED').length,
        occupancyPercent,
        expectedRevenue: montos ? activos.reduce((suma, t) => suma + num(t.price) - num(t.discountAmount), 0) : null,
        collectedRevenue,
      },
      inProgress: dtos.filter((t) => t.visibleStatus === 'IN_PROGRESS'),
      upcoming: dtos.filter((t) => (t.status === 'PENDING' || t.status === 'CONFIRMED') && Date.parse(t.startsAt) > ahora.getTime()).slice(0, 8),
      gaps: recursos.map((r) => ({
        resourceId: r.id,
        resourceName: r.name,
        startMins: horariosLibres(ctx, date, settings.slotMin, r.id).map((h) => h.inicioMin),
      })),
    };
  }
}
