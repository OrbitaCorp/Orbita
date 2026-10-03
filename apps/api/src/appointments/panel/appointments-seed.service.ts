import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentModality, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rolesDeFabrica } from '../catalogo/roles';
import {
  RubroTurnos, etiquetaDeAgenda, modalidadesInicialesDe, modalidadesPosibles, nombresDeEspacios, reglasInicialesDe, rubroTurnosPorKey, semanaInicialDe,
} from '../catalogo/rubros';
import { SemanaTurnos, diasAbiertos, errorSemana, leerSemana } from '../horarios/horarios';
import { normalizarNombre } from './lib/serializar';

/** Lo que el alta de un negocio de turnos puede traer elegido (todo opcional: lo que falta sale del rubro). */
export interface DatosAltaTurnos {
  /** Los servicios que cargó; sin esto, los típicos del rubro. */
  servicios?: { nombre: string; duracion: number; precio: number }[];
  /** Seña en % del precio (0 = no pide seña). Sin esto, la sugerida del rubro. */
  sena?: number;
  /** Horario semanal (0 = lunes). Sin esto, el de fábrica del rubro. */
  semana?: SemanaTurnos;
  /** ON_SITE / HOME. Lo que no se puede en el rubro se descarta. */
  modalidades?: AppointmentModality[];
  /** Sitio completo o página simple. */
  formaDeSitio?: 'web' | 'simple';
  /** Cuenta del cliente y beneficios. */
  beneficios?: { cuenta?: boolean; bienvenidaPercent?: number; sellos?: number; promos?: boolean };
}

export interface ResultadoSembrado {
  /** false = ya estaba sembrado: no se tocó la configuración. */
  settingsCreadas: boolean;
  servicios: number;
  agendas: number;
  roles: number;
}

const COLORES = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const BIENVENIDA = [0, 5, 10, 15, 20];
const SELLOS = [0, 5, 6, 8, 10];

/**
 * Siembra un negocio de Turnos: configuración, roles de fábrica del rubro,
 * servicios y agendas iniciales. IDEMPOTENTE: lo que ya existe no se toca
 * (settings si ya hay; servicios y agendas solo si el negocio no tiene
 * ninguno; cada rol de fábrica solo si falta su key). Lo usa el alta (otra
 * sesión: hoy los rubros de turnos siguen `disponible: false`).
 */
@Injectable()
export class AppointmentsSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async sembrar(businessId: string, rubroKey: string, datos: DatosAltaTurnos = {}): Promise<ResultadoSembrado> {
    const rubro = rubroTurnosPorKey(rubroKey);
    if (!rubro) throw new BadRequestException('Ese rubro no existe.');
    const semana = this.semana(rubro, datos.semana);
    const servicios = this.servicios(rubro, datos.servicios);

    return this.prisma.$transaction(async (tx) => {
      const negocio = await tx.business.findUnique({ where: { id: businessId }, select: { id: true, deletedAt: true } });
      if (!negocio || negocio.deletedAt) throw new NotFoundException('Ese negocio no existe.');
      await tx.business.update({ where: { id: businessId }, data: { vertical: 'APPOINTMENTS', industry: rubro.key } });

      let settingsCreadas = false;
      const existentes = await tx.appointmentSettings.findFirst({ where: { businessId }, select: { id: true } });
      if (!existentes) {
        await tx.appointmentSettings.create({ data: this.settingsIniciales(businessId, rubro, semana, datos) });
        settingsCreadas = true;
      }

      const roles = await this.sembrarRoles(tx, businessId, rubro);

      let serviciosCreados = 0;
      if ((await tx.appointmentService.count({ where: { businessId, deletedAt: null } })) === 0) {
        const r = await tx.appointmentService.createMany({
          data: servicios.map((s, i) => ({ businessId, name: s.nombre, durationMin: s.duracion, price: s.precio, sortOrder: i })),
        });
        serviciosCreados = r.count;
      }

      let agendas = 0;
      if ((await tx.appointmentResource.count({ where: { businessId, deletedAt: null } })) === 0) {
        agendas = await this.sembrarAgendas(tx, businessId, rubro, semana);
      }

      return { settingsCreadas, servicios: serviciosCreados, agendas, roles };
    });
  }

  private semana(rubro: RubroTurnos, semana?: SemanaTurnos): SemanaTurnos {
    if (!semana) return semanaInicialDe(rubro);
    const error = errorSemana(semana, { exigirUnDiaAbierto: true });
    if (error) throw new BadRequestException(error);
    return leerSemana(semana);
  }

  private servicios(rubro: RubroTurnos, propios?: DatosAltaTurnos['servicios']) {
    if (!propios || propios.length === 0) return rubro.servicios;
    const vistos = new Set<string>();
    return propios.map((s) => {
      const nombre = s.nombre?.trim() ?? '';
      if (nombre.length < 1 || nombre.length > 120) throw new BadRequestException('El nombre del servicio tiene entre 1 y 120 caracteres.');
      if (!Number.isInteger(s.duracion) || s.duracion < 5 || s.duracion > 600) throw new BadRequestException('Un servicio dura entre 5 minutos y 10 horas.');
      if (typeof s.precio !== 'number' || !(s.precio >= 0) || s.precio > 100_000_000) throw new BadRequestException('El precio de un servicio va de 0 a 100.000.000.');
      const clave = normalizarNombre(nombre);
      if (vistos.has(clave)) throw new BadRequestException('Ya tenés un servicio con ese nombre.');
      vistos.add(clave);
      return { nombre, duracion: s.duracion, precio: Math.round(s.precio * 100) / 100 };
    });
  }

  private settingsIniciales(businessId: string, rubro: RubroTurnos, semana: SemanaTurnos, datos: DatosAltaTurnos): Prisma.AppointmentSettingsUncheckedCreateInput {
    const r = reglasInicialesDe(rubro);
    const posibles = modalidadesPosibles(rubro);
    const elegidas = (datos.modalidades ?? []).filter((m, i, todas) => posibles.includes(m) && todas.indexOf(m) === i);
    // La seña elegida se lleva al múltiplo de 5 válido más cercano (10 a 100).
    const sena = datos.sena === undefined ? rubro.sena : Math.max(0, Math.min(100, datos.sena));
    const b = datos.beneficios ?? {};
    return {
      businessId,
      rubroKey: rubro.key,
      agendaMode: rubro.modo,
      siteForm: datos.formaDeSitio ?? 'web',
      weekSchedule: semana as unknown as Prisma.InputJsonValue,
      modalities: elegidas.length > 0 ? elegidas : modalidadesInicialesDe(rubro),
      ...r,
      depositEnabled: sena > 0,
      depositPercent: sena > 0 ? Math.min(100, Math.max(10, Math.round(sena / 5) * 5)) : r.depositPercent,
      accountEnabled: b.cuenta ?? r.accountEnabled,
      welcomeDiscountPercent: b.bienvenidaPercent !== undefined && BIENVENIDA.includes(b.bienvenidaPercent) ? b.bienvenidaPercent : r.welcomeDiscountPercent,
      loyaltyStamps: b.sellos !== undefined && SELLOS.includes(b.sellos) ? b.sellos : r.loyaltyStamps,
      promosEnabled: b.promos ?? r.promosEnabled,
    };
  }

  /** Los roles de fábrica del rubro que falten (por key; tampoco se pisa un rol con el mismo nombre). */
  private async sembrarRoles(tx: Prisma.TransactionClient, businessId: string, rubro: RubroTurnos): Promise<number> {
    const actuales = await tx.role.findMany({ where: { businessId }, select: { name: true, appointmentsRoleKey: true } });
    const faltan = rolesDeFabrica(rubro).filter(
      (f) => !actuales.some((a) => a.appointmentsRoleKey === f.key || normalizarNombre(a.name) === normalizarNombre(f.nombre)),
    );
    if (faltan.length === 0) return 0;
    const permisos = await tx.permission.findMany({ where: { code: { in: [...new Set(faltan.flatMap((f) => f.permisos))] } }, select: { id: true, code: true } });
    for (const f of faltan) {
      await tx.role.create({
        data: {
          businessId,
          name: f.nombre,
          description: f.descripcion,
          appointmentsRoleKey: f.key,
          takesAppointments: f.atiende,
          rolePermissions: { create: permisos.filter((p) => f.permisos.includes(p.code)).map((p) => ({ permissionId: p.id })) },
        },
      });
    }
    return faltan.length;
  }

  /**
   * Las agendas de ejemplo: los espacios del rubro (canchas, cabinas, salas…)
   * y la ficha del dueño como persona del equipo (atiende en modo PROFESSIONAL;
   * `payForm` null: lo que factura queda para el negocio).
   */
  private async sembrarAgendas(tx: Prisma.TransactionClient, businessId: string, rubro: RubroTurnos, semana: SemanaTurnos): Promise<number> {
    const dias = diasAbiertos(semana);
    const espacios = nombresDeEspacios(rubro).map((name, i) => ({
      businessId, kind: 'SPACE' as const, name, roleLabel: etiquetaDeAgenda(rubro), color: COLORES[i % COLORES.length], workDays: dias, sortOrder: i,
    }));
    if (espacios.length > 0) await tx.appointmentResource.createMany({ data: espacios });

    const dueno = await tx.member.findFirst({
      where: { businessId, role: { name: 'owner' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    const yaTieneFicha = dueno ? await tx.appointmentResource.findFirst({ where: { businessId, memberId: dueno.id }, select: { id: true } }) : null;
    if (dueno && !yaTieneFicha) {
      await tx.appointmentResource.create({
        data: {
          businessId, kind: 'PERSON', name: dueno.name, roleLabel: rubro.profesional, memberId: dueno.id,
          isBookable: rubro.modo === 'PROFESSIONAL', workDays: dias, color: COLORES[espacios.length % COLORES.length], sortOrder: espacios.length,
        },
      });
      return espacios.length + 1;
    }
    return espacios.length;
  }
}
