import { Injectable, NotFoundException } from '@nestjs/common';
import type { AppointmentSettings } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { MemberContext } from '../../../common/types/auth-context.type';
import { rubroTurnosPorKey, type RubroTurnos } from '../../catalogo/rubros';
import { leerSemana, leerTramos, type HorarioNegocio } from '../../horarios/horarios';
import { tiene } from './alcance';

export interface NegocioTurnos {
  settings: AppointmentSettings;
  /** undefined si la key guardada no está en el catálogo (no debería pasar). */
  rubro: RubroTurnos | undefined;
}

/**
 * Lo que comparten los services de P3: verificar que el negocio sea de turnos,
 * su horario y las agendas propias de quien mira.
 *
 * El contrato pide UN helper (`this.settings.delNegocio(businessId)`). P1 arma
 * el suyo en paralelo; cuando exista, este service tiene que delegar en ese.
 */
@Injectable()
export class GestionContextoService {
  constructor(private readonly prisma: PrismaService) {}

  /** 404 "Este negocio no usa Turnos" si no es APPOINTMENTS o no tiene settings. */
  async delNegocio(businessId: string): Promise<NegocioTurnos> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { vertical: true, appointmentSettings: true },
    });
    if (!business || business.vertical !== 'APPOINTMENTS' || !business.appointmentSettings) {
      throw new NotFoundException('Este negocio no usa Turnos');
    }
    return { settings: business.appointmentSettings, rubro: rubroTurnosPorKey(business.appointmentSettings.rubroKey) };
  }

  /** El horario del negocio (semana, días especiales y vacaciones) para el motor de horarios. */
  async horario(businessId: string, settings: AppointmentSettings, rango?: { from: string; to: string }): Promise<HorarioNegocio> {
    const especiales = await this.prisma.appointmentSpecialDay.findMany({
      where: { businessId, ...(rango ? { date: { gte: rango.from, lte: rango.to } } : {}) },
      select: { date: true, kind: true, ranges: true },
    });
    return {
      semana: leerSemana(settings.weekSchedule),
      especiales: especiales.map((e) => ({ fecha: e.date, tipo: e.kind, tramos: leerTramos(e.ranges) })),
      vacaciones: settings.vacationEnabled && settings.vacationFrom && settings.vacationTo
        ? { desde: settings.vacationFrom, hasta: settings.vacationTo }
        : null,
    };
  }

  /** La agenda (persona) de quien mira, si tiene. */
  async miRecurso(member: MemberContext) {
    return this.prisma.appointmentResource.findFirst({
      where: { businessId: member.businessId, memberId: member.memberId, deletedAt: null },
      select: { id: true, assignedSpaceId: true },
    });
  }

  /**
   * Las agendas "propias" (CONTRATO § 0): la persona y el espacio que tiene
   * asignado. null = ve todo (dueño o tiene el código `_all`).
   */
  async propias(member: MemberContext, codigoTodo: string): Promise<string[] | null> {
    if (tiene(member, codigoTodo)) return null;
    const r = await this.miRecurso(member);
    return r ? [r.id, ...(r.assignedSpaceId ? [r.assignedSpaceId] : [])] : [];
  }
}
