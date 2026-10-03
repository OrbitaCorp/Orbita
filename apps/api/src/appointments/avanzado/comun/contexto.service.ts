import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentSettings, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BusinessesService } from '../../../businesses/businesses.service';
import { MemberContext } from '../../../common/types/auth-context.type';
import type { AvanzadoTurnos, ConfigAvanzado, FuncionAvanzada } from '../../appointments.types';
import { HorarioNegocio, leerSemana, leerTramos } from '../../horarios/horarios';
import { NOMBRE_FUNCION, configDe } from './funciones';

/** El cliente de Prisma o el de una transacción en curso (la de la reserva). */
export type Db = PrismaService | Prisma.TransactionClient;

export interface NegocioTurnos {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  isPaused: boolean;
  isDemo: boolean;
  settings: AppointmentSettings;
}

export const NO_USA_TURNOS = 'Este negocio no usa Turnos';

/**
 * Lo que comparten todas las funciones de Avanzado: verificar que el negocio
 * sea de Turnos (CONTRATO § 0 "Vertical"), leer el interruptor y la config de
 * cada función (`settings.advanced`) y revalidar el add-on donde AddonGuard no
 * corre (rutas públicas y operaciones que se enchufan en la reserva).
 *
 * P1 va a tener su propio `settings.delNegocio`; este es el del paquete P4,
 * para no depender de código que todavía no existe en la rama.
 */
@Injectable()
export class AvanzadoContextoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  /** El negocio de turnos y su configuración. 404 si no es de Turnos (o está borrado). */
  async delNegocio(businessId: string, tx: Db = this.prisma): Promise<NegocioTurnos> {
    const b = await tx.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { id: true, name: true, subdomain: true, isActive: true, isPaused: true, isDemo: true, vertical: true, appointmentSettings: true },
    });
    if (!b || b.vertical !== 'APPOINTMENTS' || !b.appointmentSettings) throw new NotFoundException(NO_USA_TURNOS);
    const { appointmentSettings, vertical: _v, ...resto } = b;
    return { ...resto, settings: appointmentSettings };
  }

  /** Igual que delNegocio, pero para el sitio público: además exige sitio abierto (404 si no). */
  async delSitioAbierto(businessId: string): Promise<NegocioTurnos> {
    const n = await this.delNegocio(businessId);
    if (!n.isActive || n.isPaused) throw new NotFoundException('Este sitio no está disponible');
    return n;
  }

  hayAddon(businessId: string): Promise<boolean> {
    return this.businesses.hasActiveAddon(businessId, 'ADVANCED');
  }

  /** Interruptor y config (de fábrica + lo guardado) de una función. */
  funcion<F extends FuncionAvanzada>(settings: Pick<AppointmentSettings, 'advanced'>, f: F): { on: boolean; config: NonNullable<ConfigAvanzado[F]> } {
    const guardado = (leerAvanzado(settings.advanced)[f] ?? {}) as { on?: boolean; config?: unknown };
    return { on: guardado.on === true, config: configDe(f, guardado.config) };
  }

  /**
   * ¿La función actúa? Add-on activo Y interruptor prendido. Es la regla de las
   * rutas públicas y de lo que se enchufa en la reserva: sin add-on, la función
   * se comporta como si no existiera.
   */
  async activa<F extends FuncionAvanzada>(businessId: string, f: F, tx: Db = this.prisma): Promise<{ on: boolean; config: NonNullable<ConfigAvanzado[F]>; negocio: NegocioTurnos }> {
    const negocio = await this.delNegocio(businessId, tx);
    const { on, config } = this.funcion(negocio.settings, f);
    if (!on) return { on: false, config, negocio };
    return { on: await this.hayAddon(businessId), config, negocio };
  }

  /** Para las acciones del panel que hacen actuar a la función (vender, emitir, mandar): el interruptor tiene que estar prendido. */
  exigirPrendida(settings: Pick<AppointmentSettings, 'advanced'>, f: FuncionAvanzada): void {
    if (!this.funcion(settings, f).on) {
      throw new BadRequestException(`Prendé «${NOMBRE_FUNCION[f]}» en Avanzado para usarlo.`);
    }
  }
}

/** `settings.advanced` como objeto; lo que no se entiende, vacío. */
export function leerAvanzado(json: unknown): AvanzadoTurnos {
  return json && typeof json === 'object' && !Array.isArray(json) ? (json as AvanzadoTurnos) : {};
}

/** El dueño pasa por todo, como en PermissionsGuard. */
export function tienePermiso(member: Pick<MemberContext, 'roleName' | 'permissions'>, codigo: string): boolean {
  return member.roleName === 'owner' || member.permissions.includes(codigo);
}

/** Segundo permiso que pide el contrato además del del decorador (p. ej. cobrar al vender un pack). */
export function exigirPermiso(member: Pick<MemberContext, 'roleName' | 'permissions'>, codigo: string): void {
  if (!tienePermiso(member, codigo)) throw new ForbiddenException(`Permiso requerido: ${codigo}`);
}

/** El horario del negocio (semana, días especiales y vacaciones) para el motor puro. */
export async function horarioDelNegocioDb(tx: Db, businessId: string, settings: AppointmentSettings): Promise<HorarioNegocio> {
  const especiales = await tx.appointmentSpecialDay.findMany({ where: { businessId }, select: { date: true, kind: true, ranges: true } });
  return {
    semana: leerSemana(settings.weekSchedule),
    especiales: especiales.map((e) => ({ fecha: e.date, tipo: e.kind, tramos: leerTramos(e.ranges) })),
    vacaciones: settings.vacationEnabled && settings.vacationFrom && settings.vacationTo
      ? { desde: settings.vacationFrom, hasta: settings.vacationTo }
      : null,
  };
}
