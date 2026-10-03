import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AppointmentClassEnrollment, type AppointmentClassSession, type AppointmentSettings } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { StorefrontService } from '../../../storefront/storefront.service';
import type { AuthContext, MemberContext } from '../../../common/types/auth-context.type';
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import type { AnotadoDto, ClaseDelDiaDto, ClaseDetalleDto, PlantillaClaseDto, ReservaCreadaDto } from '../../appointments.types';
import { diaDeSemana, horarioDelNegocio, instanteDe, leerSemana, sumarDias, tramosDelDia } from '../../horarios/horarios';
import { contactoSegun, pesos } from '../comun/alcance';
import { codigoLibre, esUnicoRepetido, nuevoAccessToken } from '../comun/codigos';
import { GestionContextoService } from '../comun/contexto.service';
import { buscarOCrearCliente, nombreDe } from '../comun/ficha-cliente';
import { fechaCorta } from '../comun/mapeos';
import { exigirFecha, exigirRango } from '../comun/rango';
import { normalizarTelefono } from '../comun/telefono';
import {
  aperturaDeReserva, armarClases, cabeEnTramos, calcularSena, decidirInscripcion, descuentoBienvenida, horarioTxt, lugaresLibres, seCruzan,
  type Conteo, type PlantillaArmable, type SesionArmable,
} from './clases.reglas';
import type { EnrollDto, PublicEnrollDto, UpdateClassSessionDto, UpsertClassTemplateDto } from './dto/clases.dto';
import { miTurnoDeClase } from './mi-turno';

const plantillaInclude = {
  service: { select: { name: true, price: true } },
  instructor: { select: { name: true } },
  room: { select: { name: true } },
} satisfies Prisma.AppointmentClassTemplateInclude;

type PlantillaFila = Prisma.AppointmentClassTemplateGetPayload<{ include: typeof plantillaInclude }>;
type Tx = Prisma.TransactionClient;

const ACTIVAS = ['ENROLLED', 'WAITLIST'] as const;
const VER_TODO = 'appointments.agenda.view_all';
const EDITAR_TODO = 'appointments.agenda.manage_all';
const NO_EXISTE = 'Esa clase no existe.';

const aArmable = (t: PlantillaFila): PlantillaArmable => ({
  id: t.id, serviceId: t.serviceId, serviceName: t.service.name, price: pesos(t.service.price), weekday: t.weekday, startMin: t.startMin,
  durationMin: t.durationMin, instructorName: t.instructor?.name ?? null, roomName: t.room?.name ?? null, capacity: t.capacity,
  isActive: t.isActive, deletedAt: t.deletedAt,
});

const aPlantillaDto = (t: PlantillaFila): PlantillaClaseDto => ({
  id: t.id, serviceId: t.serviceId, serviceName: t.service.name, weekday: t.weekday, startMin: t.startMin, durationMin: t.durationMin,
  instructorResourceId: t.instructorResourceId, instructorName: t.instructor?.name ?? null,
  roomResourceId: t.roomResourceId, roomName: t.room?.name ?? null, capacity: t.capacity, isActive: t.isActive,
});

const alcanceDePlantilla = (propias: string[] | null): Prisma.AppointmentClassTemplateWhereInput =>
  propias ? { OR: [{ instructorResourceId: { in: propias } }, { roomResourceId: { in: propias } }] } : {};

interface Inscribir {
  businessId: string;
  plantilla: PlantillaFila;
  sesion: AppointmentClassSession;
  settings: AppointmentSettings;
  cliente: { id: string; name: string; phone: string; email: string | null };
  note?: string | null;
  wantsReminder?: boolean;
  origin: 'PANEL' | 'STOREFRONT';
  createdByMemberId?: string;
  /** Descuento de bienvenida ya calculado (solo si entra a la clase). */
  descuento?: number;
  yaAnotado: string;
  ahora: Date;
}

/**
 * Clases con cupo (CONTRATO § P3.1): la grilla semanal (plantillas), las
 * clases con fecha (sesiones que se materializan al tocarlas), anotar y
 * sacar gente, la lista de espera y la suspensión.
 *
 * Todo lo que mueve el cupo de una clase pasa por `conLock`: una transacción
 * con `pg_advisory_xact_lock` por clase (plantilla + fecha). Dos personas que
 * se anotan a la vez al último lugar quedan en fila: la segunda ve la clase
 * completa (lista de espera o 409).
 *
 * Fuera de alcance de P3 (dependen de P2): el mensaje `espera` al ofrecer un
 * lugar, el mensaje `cancelacion` y el reembolso de señas al suspender, el
 * cobro online de la seña y crear la cuenta al anotarse desde el sitio.
 */
@Injectable()
export class ClasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: GestionContextoService,
    private readonly storefront: StorefrontService,
    private readonly audit?: AuditService,
  ) {}

  // ── Plantillas ────────────────────────────────────────────────────────────

  async plantillas(member: MemberContext): Promise<PlantillaClaseDto[]> {
    await this.ctx.delNegocio(member.businessId);
    const propias = await this.ctx.propias(member, VER_TODO);
    const filas = await this.prisma.appointmentClassTemplate.findMany({
      where: { businessId: member.businessId, deletedAt: null, ...alcanceDePlantilla(propias) },
      include: plantillaInclude,
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }, { createdAt: 'asc' }],
    });
    return filas.map(aPlantillaDto);
  }

  async crearPlantilla(member: MemberContext, dto: UpsertClassTemplateDto): Promise<PlantillaClaseDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    await this.validarPlantilla(member.businessId, settings, dto);
    const t = await this.prisma.appointmentClassTemplate.create({
      data: {
        businessId: member.businessId, serviceId: dto.serviceId, weekday: dto.weekday, startMin: dto.startMin, durationMin: dto.durationMin,
        instructorResourceId: dto.instructorResourceId ?? null, roomResourceId: dto.roomResourceId ?? null, capacity: dto.capacity, isActive: dto.isActive ?? true,
      },
      include: plantillaInclude,
    });
    await this.audit?.registrar({
      businessId: member.businessId, memberId: member.memberId, entityType: 'appointment_class_template', entityId: t.id, action: 'CREATE',
      changes: [{ field: 'clase', before: null, after: `${t.service.name} · día ${t.weekday} · ${t.startMin}` }, { field: 'capacity', before: null, after: t.capacity }],
    });
    return aPlantillaDto(t);
  }

  async editarPlantilla(member: MemberContext, id: string, dto: UpsertClassTemplateDto, ahora = new Date()): Promise<PlantillaClaseDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const antes = await this.prisma.appointmentClassTemplate.findFirst({ where: { id, businessId, deletedAt: null }, include: plantillaInclude });
    if (!antes) throw new NotFoundException(NO_EXISTE);
    await this.validarPlantilla(businessId, settings, dto, id);
    const cambiaHorario = antes.weekday !== dto.weekday || antes.startMin !== dto.startMin || antes.durationMin !== dto.durationMin;
    if (cambiaHorario) {
      const anotados = await this.anotadosPorVenir(businessId, id, ahora);
      if (anotados > 0) {
        throw new BadRequestException(`Hay ${anotados} ${anotados === 1 ? 'persona anotada' : 'personas anotadas'} en clases que vienen. Suspendé esas clases antes de cambiar el día o el horario.`);
      }
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.appointmentClassTemplate.updateMany({
        where: { id, businessId, deletedAt: null },
        data: {
          serviceId: dto.serviceId, weekday: dto.weekday, startMin: dto.startMin, durationMin: dto.durationMin,
          instructorResourceId: dto.instructorResourceId ?? null, roomResourceId: dto.roomResourceId ?? null, capacity: dto.capacity, isActive: dto.isActive ?? true,
        },
      });
      if (count === 0) throw new NotFoundException(NO_EXISTE);
      if (cambiaHorario) {
        // Las sesiones que vienen (sin nadie anotado: se chequeó arriba) siguen el horario nuevo.
        const futuras = await tx.appointmentClassSession.findMany({ where: { businessId, templateId: id, startsAt: { gt: ahora } }, select: { id: true, date: true } });
        for (const s of futuras) {
          await tx.appointmentClassSession.updateMany({
            where: { id: s.id, businessId },
            data: { startsAt: instanteDe(s.date, dto.startMin), endsAt: instanteDe(s.date, dto.startMin + dto.durationMin) },
          });
        }
      }
    });
    const despues = await this.prisma.appointmentClassTemplate.findFirst({ where: { id, businessId }, include: plantillaInclude });
    const campos = ['serviceId', 'weekday', 'startMin', 'durationMin', 'instructorResourceId', 'roomResourceId', 'capacity', 'isActive'];
    const cambios = AuditService.diferencias(antes as unknown as Record<string, unknown>, despues as unknown as Record<string, unknown>, campos);
    if (cambios.length > 0) {
      await this.audit?.registrar({ businessId, memberId: member.memberId, entityType: 'appointment_class_template', entityId: id, action: 'UPDATE', changes: cambios });
    }
    return aPlantillaDto(despues!);
  }

  async borrarPlantilla(member: MemberContext, id: string, ahora = new Date()): Promise<{ ok: true }> {
    await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const t = await this.prisma.appointmentClassTemplate.findFirst({ where: { id, businessId, deletedAt: null }, include: plantillaInclude });
    if (!t) throw new NotFoundException(NO_EXISTE);
    const anotados = await this.anotadosPorVenir(businessId, id, ahora);
    if (anotados > 0) {
      throw new BadRequestException(`Hay ${anotados} ${anotados === 1 ? 'persona anotada' : 'personas anotadas'} en clases que vienen. Suspendé esas clases primero.`);
    }
    const { count } = await this.prisma.appointmentClassTemplate.updateMany({ where: { id, businessId, deletedAt: null }, data: { deletedAt: ahora, isActive: false } });
    if (count === 0) throw new NotFoundException(NO_EXISTE);
    await this.audit?.registrar({
      businessId, memberId: member.memberId, entityType: 'appointment_class_template', entityId: id, action: 'DELETE',
      changes: [{ field: 'clase', before: `${t.service.name} · día ${t.weekday} · ${t.startMin}`, after: null }],
    });
    return { ok: true };
  }

  // ── Clases con fecha ──────────────────────────────────────────────────────

  async clases(member: MemberContext, q: { from?: string; to?: string }, ahora = new Date()): Promise<ClaseDelDiaDto[]> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const hoy = fechaArgentina(ahora);
    const rango = exigirRango(q.from, q.to, 14, { from: hoy, to: sumarDias(hoy, 6) });
    const propias = await this.ctx.propias(member, VER_TODO);
    const { clases } = await this.armarRango(member.businessId, settings, rango, propias, ahora);
    return clases;
  }

  async detalle(member: MemberContext, templateId: string, date: string, ahora = new Date()): Promise<ClaseDetalleDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    exigirFecha(date);
    const propias = await this.ctx.propias(member, VER_TODO);
    return this.detalleDe(member, settings, templateId, date, propias, ahora);
  }

  async actualizarSesion(member: MemberContext, templateId: string, date: string, dto: UpdateClassSessionDto, ahora = new Date()): Promise<ClaseDetalleDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    exigirFecha(date);
    if (dto.capacity === undefined && dto.cancelled === undefined) throw new BadRequestException('No hay nada para cambiar.');
    const t = await this.plantillaOperable(member, templateId, date);

    const cambios = await this.conLock(templateId, date, async (tx) => {
      let s = await this.materializar(tx, businessId, t, date);
      const registro: { field: string; before: unknown; after: unknown }[] = [];
      if (dto.cancelled !== undefined && dto.cancelled !== s.isCancelled) {
        if (s.startsAt.getTime() <= ahora.getTime()) throw new BadRequestException('Esa clase ya empezó: no se puede suspender ni reactivar.');
        if (dto.cancelled) {
          await tx.appointmentClassSession.updateMany({ where: { id: s.id, businessId }, data: { isCancelled: true, cancelReason: dto.cancelReason ?? null, cancelledAt: ahora } });
          // Las inscripciones se cancelan (SYSTEM). Reembolso de señas y mensaje `cancelacion`: P2.
          const { count } = await tx.appointmentClassEnrollment.updateMany({
            where: { businessId, sessionId: s.id, status: { in: [...ACTIVAS] } },
            data: { status: 'CANCELLED', cancelledAt: ahora, cancelledBy: 'SYSTEM', waitlistPosition: null, offerExpiresAt: null },
          });
          registro.push({ field: 'suspendida', before: false, after: true }, { field: 'inscripciones_canceladas', before: null, after: count });
        } else {
          await tx.appointmentClassSession.updateMany({ where: { id: s.id, businessId }, data: { isCancelled: false, cancelReason: null, cancelledAt: null } });
          registro.push({ field: 'suspendida', before: true, after: false });
        }
      }
      if (dto.capacity !== undefined) {
        const nuevo = dto.capacity ?? t.capacity;
        const anotados = await tx.appointmentClassEnrollment.count({ where: { businessId, sessionId: s.id, status: 'ENROLLED' } });
        if (nuevo < anotados) throw new BadRequestException(`Ya hay ${anotados} anotados: el cupo no puede ser menor.`);
        await tx.appointmentClassSession.updateMany({ where: { id: s.id, businessId }, data: { capacity: dto.capacity } });
        registro.push({ field: 'capacity', before: s.capacity ?? t.capacity, after: nuevo });
      }
      s = (await tx.appointmentClassSession.findFirst({ where: { id: s.id, businessId } }))!;
      await this.vencerYOfrecer(tx, businessId, s, s.capacity ?? t.capacity, settings.waitlistAcceptMin, ahora);
      return { sessionId: s.id, registro };
    });
    if (cambios.registro.length > 0) {
      await this.audit?.registrar({
        businessId, memberId: member.memberId, entityType: 'appointment_class_session', entityId: cambios.sessionId, action: 'UPDATE', changes: cambios.registro,
      });
    }
    return this.detalleDe(member, settings, templateId, date, await this.ctx.propias(member, VER_TODO), ahora);
  }

  /** Anotar a alguien desde el panel: un cliente que existe o uno nuevo. */
  async anotar(member: MemberContext, templateId: string, date: string, dto: EnrollDto, ahora = new Date()): Promise<ClaseDetalleDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    exigirFecha(date);
    if (!!dto.customerId === !!dto.customer) throw new BadRequestException('Elegí un cliente o cargá uno nuevo.');
    const t = await this.plantillaOperable(member, templateId, date);
    await this.assertAbre(businessId, settings, date);
    if (instanteDe(date, t.startMin + t.durationMin).getTime() <= ahora.getTime()) throw new BadRequestException('Esa clase ya terminó.');

    let existente: { id: string; name: string; phone: string; email: string | null } | null = null;
    if (dto.customerId) {
      const c = await this.prisma.customer.findFirst({ where: { id: dto.customerId, businessId, deletedAt: null } });
      if (!c) throw new NotFoundException('Cliente no encontrado');
      existente = { id: c.id, name: nombreDe(c), phone: c.phone ? normalizarTelefono(c.phone) : '', email: c.email };
    }
    const nuevo = dto.customer;
    const phoneNuevo = nuevo?.phone ? normalizarTelefono(nuevo.phone) : '';
    if (nuevo?.phone && phoneNuevo.length < 8) throw new BadRequestException('El teléfono tiene que tener al menos 8 dígitos.');

    const inscripcion = await this.reintentar(() => this.conLock(templateId, date, async (tx) => {
      const sesion = await this.materializar(tx, businessId, t, date);
      if (sesion.isCancelled) throw new BadRequestException('Esta clase está suspendida.');
      await this.vencerYOfrecer(tx, businessId, sesion, sesion.capacity ?? t.capacity, settings.waitlistAcceptMin, ahora);
      const cliente = existente ?? await (async () => {
        const c = await buscarOCrearCliente(tx, businessId, { name: nuevo!.name, phone: phoneNuevo, email: nuevo!.email ?? null });
        return { id: c.id, name: nuevo!.name, phone: phoneNuevo, email: nuevo!.email ?? c.email };
      })();
      return this.inscribir(tx, {
        businessId, plantilla: t, sesion, settings, cliente, origin: 'PANEL', createdByMemberId: member.memberId,
        yaAnotado: 'Esa persona ya está anotada en esta clase.', ahora,
      });
    }));
    await this.audit?.registrar({
      businessId, memberId: member.memberId, entityType: 'appointment_enrollment', entityId: inscripcion.id, action: 'CREATE',
      changes: [{ field: 'clase', before: null, after: `${t.service.name} ${date}` }, { field: 'cliente', before: null, after: inscripcion.customerName }, { field: 'status', before: null, after: inscripcion.status }],
    });
    return this.detalleDe(member, settings, templateId, date, await this.ctx.propias(member, VER_TODO), ahora);
  }

  /** Sacar a alguien (o cancelar su lugar en la lista de espera). Si deja un lugar, se le ofrece al primero en espera. */
  async sacar(member: MemberContext, enrollmentId: string, ahora = new Date()): Promise<ClaseDetalleDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const e = await this.inscripcionOperable(member, enrollmentId);
    const { session } = e;
    if (e.status !== 'CANCELLED') {
      if (session.startsAt.getTime() <= ahora.getTime()) throw new BadRequestException('Esa clase ya empezó: no se puede sacar a nadie.');
      const cancelada = await this.conLock(session.templateId, session.date, async (tx) => {
        const actual = await tx.appointmentClassEnrollment.findFirst({ where: { id: enrollmentId, businessId } });
        if (!actual || actual.status === 'CANCELLED') return false;
        await tx.appointmentClassEnrollment.updateMany({
          where: { id: enrollmentId, businessId, status: actual.status },
          data: { status: 'CANCELLED', cancelledAt: ahora, cancelledBy: 'BUSINESS', waitlistPosition: null, offerExpiresAt: null },
        });
        const s = (await tx.appointmentClassSession.findFirst({ where: { id: session.id, businessId } }))!;
        if (actual.status === 'WAITLIST') await this.renumerar(tx, businessId, s.id);
        await this.vencerYOfrecer(tx, businessId, s, s.capacity ?? session.template.capacity, settings.waitlistAcceptMin, ahora);
        return true;
      });
      if (cancelada) {
        await this.audit?.registrar({
          businessId, memberId: member.memberId, entityType: 'appointment_enrollment', entityId: enrollmentId, action: 'DELETE',
          changes: [{ field: 'cliente', before: e.customerName, after: null }, { field: 'status', before: e.status, after: 'CANCELLED' }],
        });
      }
    }
    return this.detalleDe(member, settings, session.templateId, session.date, await this.ctx.propias(member, VER_TODO), ahora);
  }

  async asistencia(member: MemberContext, enrollmentId: string, attended: boolean | null, ahora = new Date()): Promise<AnotadoDto> {
    await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const e = await this.inscripcionOperable(member, enrollmentId);
    if (e.status !== 'ENROLLED') throw new BadRequestException('Solo se toma asistencia de quien está anotado.');
    if (e.session.startsAt.getTime() > ahora.getTime()) throw new BadRequestException('Todavía no empezó la clase: no se puede tomar asistencia.');
    const { count } = await this.prisma.appointmentClassEnrollment.updateMany({ where: { id: enrollmentId, businessId, status: 'ENROLLED' }, data: { attended } });
    if (count === 0) throw new NotFoundException('Inscripción no encontrada');
    if (e.attended !== attended) {
      await this.audit?.registrar({
        businessId, memberId: member.memberId, entityType: 'appointment_enrollment', entityId: enrollmentId, action: 'UPDATE',
        changes: [{ field: 'attended', before: e.attended, after: attended }],
      });
    }
    return this.aAnotado(member, { ...e, attended });
  }

  /**
   * Aceptar el lugar ofrecido a alguien de la lista de espera. Lo expone P3
   * para que el "mi turno" de P2 (`POST mine/:token/accept`) lo llame con la
   * inscripción que encontró por su token.
   */
  async aceptarOferta(businessId: string, enrollmentId: string, ahora = new Date()): Promise<AppointmentClassEnrollment> {
    const { settings } = await this.ctx.delNegocio(businessId);
    const e = await this.prisma.appointmentClassEnrollment.findFirst({
      where: { id: enrollmentId, businessId },
      include: { session: { include: { template: { include: plantillaInclude } } } },
    });
    if (!e) throw new NotFoundException('Inscripción no encontrada');
    return this.conLock(e.session.templateId, e.session.date, async (tx) => {
      const actual = await tx.appointmentClassEnrollment.findFirst({ where: { id: enrollmentId, businessId } });
      if (actual?.status === 'ENROLLED') return actual;
      const s = (await tx.appointmentClassSession.findFirst({ where: { id: e.sessionId, businessId } }))!;
      const vigente = actual?.status === 'WAITLIST' && !!actual.offerExpiresAt && actual.offerExpiresAt.getTime() > ahora.getTime();
      const capacidad = s.capacity ?? e.session.template.capacity;
      const anotados = await tx.appointmentClassEnrollment.count({ where: { businessId, sessionId: s.id, status: 'ENROLLED' } });
      if (!actual || !vigente || s.isCancelled || s.startsAt.getTime() <= ahora.getTime() || anotados >= capacidad) {
        throw new BadRequestException('El lugar ya se ocupó.');
      }
      const perfil = actual.customerId ? await tx.appointmentCustomerProfile.findFirst({ where: { businessId, customerId: actual.customerId } }) : null;
      const sena = await this.senaConCredito(tx, businessId, actual.customerId, Number(actual.price) - Number(actual.discountAmount), settings, perfil);
      await tx.appointmentClassEnrollment.updateMany({
        where: { id: enrollmentId, businessId, status: 'WAITLIST' },
        data: { status: 'ENROLLED', waitlistPosition: null, offerExpiresAt: null, depositAmount: sena },
      });
      await this.renumerar(tx, businessId, s.id);
      return (await tx.appointmentClassEnrollment.findFirst({ where: { id: enrollmentId, businessId } }))!;
    });
  }

  // ── Público ───────────────────────────────────────────────────────────────

  async clasesPublicas(slug: string, q: { from?: string; to?: string }, ahora = new Date()): Promise<ClaseDelDiaDto[]> {
    const { businessId, settings } = await this.negocioPublico(slug);
    if (settings.agendaMode !== 'CLASS') return [];
    const hoy = fechaArgentina(ahora);
    const rango = exigirRango(q.from, q.to, 14, { from: hoy, to: sumarDias(hoy, 6) });
    const { clases, plantillas } = await this.armarRango(businessId, settings, { from: rango.from < hoy ? hoy : rango.from, to: rango.to }, null, ahora);
    // En el sitio no se muestran las clases que ya no están en la grilla.
    const vigentes = new Set(plantillas.filter((t) => t.isActive && !t.deletedAt).map((t) => t.id));
    return clases.filter((c) => vigentes.has(c.templateId));
  }

  async anotarPublico(slug: string, dto: PublicEnrollDto, auth: AuthContext | undefined, ahora = new Date()): Promise<ReservaCreadaDto> {
    const { businessId, settings } = await this.negocioPublico(slug);
    if (settings.agendaMode !== 'CLASS') throw new NotFoundException(NO_EXISTE);
    exigirFecha(dto.date);
    const phone = normalizarTelefono(dto.phone);
    if (phone.length < 10) throw new BadRequestException('Faltan dígitos: son 10 con el código de área.');
    if (phone.length > 10) throw new BadRequestException('Sobran dígitos: son 10 con el código de área.');

    const t = await this.prisma.appointmentClassTemplate.findFirst({ where: { id: dto.templateId, businessId, deletedAt: null, isActive: true }, include: plantillaInclude });
    if (!t || diaDeSemana(dto.date) !== t.weekday) throw new NotFoundException(NO_EXISTE);
    await this.assertAbre(businessId, settings, dto.date);
    const startsAt = instanteDe(dto.date, t.startMin);
    if (startsAt.getTime() <= ahora.getTime()) throw new BadRequestException('Esa clase ya empezó.');
    const apertura = aperturaDeReserva(dto.date, settings.classOpenDays);
    if (fechaArgentina(ahora) < apertura) throw new BadRequestException(`La reserva de esta clase se abre el ${fechaCorta(apertura)}.`);

    // Un JWT de cliente de OTRO negocio se ignora: se trata como anónimo.
    const customerId = auth?.type === 'customer' && auth.businessId === businessId ? auth.customerId : null;
    await this.assertLimiteActivos(businessId, settings, phone, customerId, ahora);

    let descuento = 0;
    if (customerId && settings.accountEnabled && settings.welcomeDiscountPercent > 0) {
      const perfil = await this.prisma.appointmentCustomerProfile.findFirst({ where: { businessId, customerId }, select: { welcomeUsedAt: true } });
      if (!perfil?.welcomeUsedAt) descuento = descuentoBienvenida(pesos(t.service.price), settings.welcomeDiscountPercent);
    }

    const e = await this.reintentar(() => this.conLock(t.id, dto.date, async (tx) => {
      const sesion = await this.materializar(tx, businessId, t, dto.date);
      if (sesion.isCancelled) throw new BadRequestException('Esta clase está suspendida.');
      await this.vencerYOfrecer(tx, businessId, sesion, sesion.capacity ?? t.capacity, settings.waitlistAcceptMin, ahora);
      const ficha = customerId
        ? await tx.customer.findFirst({ where: { id: customerId, businessId, deletedAt: null } })
        : await buscarOCrearCliente(tx, businessId, { name: dto.name, phone, email: dto.email ?? null });
      if (!ficha) throw new NotFoundException('Cliente no encontrado');
      const creada = await this.inscribir(tx, {
        businessId, plantilla: t, sesion, settings, origin: 'STOREFRONT',
        cliente: { id: ficha.id, name: dto.name, phone, email: dto.email ?? null },
        note: dto.note ?? null, wantsReminder: dto.wantsReminder ?? true, descuento, yaAnotado: 'Ya estás anotado en esta clase.', ahora,
      });
      if (creada.status === 'ENROLLED' && Number(creada.discountAmount) > 0) {
        await tx.appointmentCustomerProfile.upsert({
          where: { customerId: ficha.id },
          create: { businessId, customerId: ficha.id, welcomeUsedAt: ahora },
          update: { welcomeUsedAt: ahora },
        });
      }
      return { creada, sesion };
    }));

    const config = settings.showTransferData && Number(e.creada.depositAmount) > 0
      ? await this.prisma.businessConfig.findFirst({ where: { businessId }, select: { transferAlias: true, transferCbu: true, transferHolder: true } })
      : null;
    return {
      // Se devuelve UNA vez, acá. No va al registro de auditoría ni a ningún endpoint del panel.
      accessToken: e.creada.accessToken,
      booking: miTurnoDeClase(e.creada, { serviceName: t.service.name, resourceName: t.instructor?.name ?? t.room?.name ?? null, startsAt: e.sesion.startsAt, endsAt: e.sesion.endsAt }, settings, ahora),
      // El cobro online de la seña (preferencia de Mercado Pago del negocio) es de P2: hasta entonces
      // la seña queda pendiente y se registra a mano, como "sin Mercado Pago conectado" (CONTRATO § 1.3).
      payment: null,
      transfer: config ? { alias: config.transferAlias, cbu: config.transferCbu, holder: config.transferHolder } : null,
    };
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /** Transacción con lock por clase (plantilla + fecha): serializa todo lo que mueve su cupo. */
  private conLock<T>(templateId: string, date: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`clase:${templateId}:${date}`}))`;
      return fn(tx);
    }, { timeout: 20_000, maxWait: 15_000 });
  }

  /** Un código repetido (P2002) aborta la transacción: se reintenta entera, hasta 3 veces. */
  private async reintentar<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i >= 2 || !esUnicoRepetido(err)) throw err;
      }
    }
  }

  private materializar(tx: Tx, businessId: string, t: { id: string; startMin: number; durationMin: number }, date: string): Promise<AppointmentClassSession> {
    return tx.appointmentClassSession.upsert({
      where: { templateId_date: { templateId: t.id, date } },
      create: { businessId, templateId: t.id, date, startsAt: instanteDe(date, t.startMin), endsAt: instanteDe(date, t.startMin + t.durationMin) },
      update: {},
    });
  }

  /** Vence las ofertas de la lista de espera que no se aceptaron a tiempo y ofrece los lugares libres. */
  private async vencerYOfrecer(tx: Tx, businessId: string, s: AppointmentClassSession, capacidad: number, minutosParaAceptar: number, ahora: Date): Promise<string[]> {
    const { count } = await tx.appointmentClassEnrollment.updateMany({
      where: { businessId, sessionId: s.id, status: 'WAITLIST', offerExpiresAt: { lte: ahora } },
      data: { status: 'CANCELLED', cancelledAt: ahora, cancelledBy: 'SYSTEM', waitlistPosition: null, offerExpiresAt: null },
    });
    if (count > 0) await this.renumerar(tx, businessId, s.id);
    if (s.isCancelled || s.startsAt.getTime() <= ahora.getTime()) return [];
    const [anotados, ofertas] = await Promise.all([
      tx.appointmentClassEnrollment.count({ where: { businessId, sessionId: s.id, status: 'ENROLLED' } }),
      tx.appointmentClassEnrollment.count({ where: { businessId, sessionId: s.id, status: 'WAITLIST', offerExpiresAt: { gt: ahora } } }),
    ]);
    const libres = lugaresLibres(capacidad, anotados, ofertas);
    if (libres === 0) return [];
    const candidatos = await tx.appointmentClassEnrollment.findMany({
      where: { businessId, sessionId: s.id, status: 'WAITLIST', offerExpiresAt: null },
      orderBy: [{ waitlistPosition: 'asc' }, { createdAt: 'asc' }],
      take: libres,
      select: { id: true },
    });
    if (candidatos.length === 0) return [];
    const ids = candidatos.map((c) => c.id);
    // El mensaje `espera` con el enlace personal lo manda AppointmentMessagingService (P2).
    await tx.appointmentClassEnrollment.updateMany({
      where: { businessId, id: { in: ids }, status: 'WAITLIST' },
      data: { offerExpiresAt: new Date(ahora.getTime() + minutosParaAceptar * 60_000) },
    });
    return ids;
  }

  /** Deja las posiciones de la lista de espera en 1, 2, 3… sin huecos. */
  private async renumerar(tx: Tx, businessId: string, sessionId: string): Promise<void> {
    const espera = await tx.appointmentClassEnrollment.findMany({
      where: { businessId, sessionId, status: 'WAITLIST' },
      orderBy: [{ waitlistPosition: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, waitlistPosition: true },
    });
    for (let i = 0; i < espera.length; i++) {
      if (espera[i].waitlistPosition !== i + 1) {
        await tx.appointmentClassEnrollment.updateMany({ where: { id: espera[i].id, businessId }, data: { waitlistPosition: i + 1 } });
      }
    }
  }

  /** El alta de una inscripción, ya dentro del lock de la clase. */
  private async inscribir(tx: Tx, a: Inscribir): Promise<AppointmentClassEnrollment> {
    const { businessId, sesion, cliente } = a;
    const repetida = await tx.appointmentClassEnrollment.findFirst({
      where: {
        businessId, sessionId: sesion.id, status: { in: [...ACTIVAS] },
        OR: [{ customerId: cliente.id }, ...(cliente.phone ? [{ customerPhone: cliente.phone }] : [])],
      },
      select: { id: true },
    });
    if (repetida) throw new BadRequestException(a.yaAnotado);

    const capacidad = sesion.capacity ?? a.plantilla.capacity;
    const [anotados, ofertas] = await Promise.all([
      tx.appointmentClassEnrollment.count({ where: { businessId, sessionId: sesion.id, status: 'ENROLLED' } }),
      tx.appointmentClassEnrollment.count({ where: { businessId, sessionId: sesion.id, status: 'WAITLIST', offerExpiresAt: { gt: a.ahora } } }),
    ]);
    const estado = decidirInscripcion(lugaresLibres(capacidad, anotados, ofertas), a.settings.waitlistEnabled);
    if (estado === 'FULL') throw new ConflictException('La clase está completa.');

    const precio = pesos(a.plantilla.service.price);
    const descuento = estado === 'ENROLLED' ? Math.min(a.descuento ?? 0, precio) : 0;
    let deposit = 0;
    if (estado === 'ENROLLED') {
      const perfil = await tx.appointmentCustomerProfile.findFirst({ where: { businessId, customerId: cliente.id } });
      deposit = await this.senaConCredito(tx, businessId, cliente.id, precio - descuento, a.settings, perfil);
    }
    let waitlistPosition: number | null = null;
    if (estado === 'WAITLIST') {
      const max = await tx.appointmentClassEnrollment.aggregate({ where: { businessId, sessionId: sesion.id, status: 'WAITLIST' }, _max: { waitlistPosition: true } });
      waitlistPosition = (max._max.waitlistPosition ?? 0) + 1;
    }
    return tx.appointmentClassEnrollment.create({
      data: {
        businessId,
        sessionId: sesion.id,
        code: await codigoLibre(tx, businessId),
        accessToken: nuevoAccessToken(),
        customerId: cliente.id,
        customerName: cliente.name,
        customerPhone: cliente.phone,
        customerEmail: cliente.email,
        customerNote: a.note ?? null,
        status: estado,
        waitlistPosition,
        origin: a.origin,
        price: precio,
        discountAmount: descuento,
        depositAmount: deposit,
        wantsReminder: a.wantsReminder ?? true,
        createdByMemberId: a.createdByMemberId ?? null,
      },
    });
  }

  /** La seña (§ 1.3) menos el crédito a favor; el crédito usado se descuenta del perfil. */
  private async senaConCredito(
    tx: Tx, businessId: string, customerId: string | null, aPagar: number, settings: AppointmentSettings,
    perfil: { noShowCount: number; depositCredit: unknown } | null,
  ): Promise<number> {
    const { deposit, creditoUsado } = calcularSena(aPagar, {
      depositEnabled: settings.depositEnabled,
      depositType: settings.depositType === 'fixed' ? 'fixed' : 'percent',
      depositPercent: settings.depositPercent,
      depositFixed: Number(settings.depositFixed),
      depositForNoShows: settings.depositForNoShows,
    }, perfil?.noShowCount ?? 0, Number(perfil?.depositCredit ?? 0));
    if (creditoUsado > 0 && customerId) {
      const { count } = await tx.appointmentCustomerProfile.updateMany({
        where: { businessId, customerId, depositCredit: { gte: creditoUsado } },
        data: { depositCredit: { decrement: creditoUsado } },
      });
      if (count === 0) return deposit + creditoUsado;
    }
    return deposit;
  }

  private async anotadosPorVenir(businessId: string, templateId: string, ahora: Date): Promise<number> {
    return this.prisma.appointmentClassEnrollment.count({
      where: { businessId, status: { in: [...ACTIVAS] }, session: { templateId, startsAt: { gt: ahora } } },
    });
  }

  private async validarPlantilla(businessId: string, settings: AppointmentSettings, dto: UpsertClassTemplateDto, exceptoId?: string) {
    if (settings.agendaMode !== 'CLASS') throw new BadRequestException('Las clases con cupo son para negocios que trabajan con clases.');
    const [servicio, profe, sala] = await Promise.all([
      this.prisma.appointmentService.findFirst({ where: { id: dto.serviceId, businessId, deletedAt: null }, select: { name: true } }),
      dto.instructorResourceId
        ? this.prisma.appointmentResource.findFirst({ where: { id: dto.instructorResourceId, businessId, kind: 'PERSON', deletedAt: null }, select: { name: true } })
        : null,
      dto.roomResourceId
        ? this.prisma.appointmentResource.findFirst({ where: { id: dto.roomResourceId, businessId, kind: 'SPACE', deletedAt: null }, select: { name: true } })
        : null,
    ]);
    if (!servicio) throw new BadRequestException('Esa actividad no existe.');
    if (dto.instructorResourceId && !profe) throw new BadRequestException('Esa persona no está en el equipo.');
    if (dto.roomResourceId && !sala) throw new BadRequestException('Esa sala no existe.');

    const tramos = tramosDelDia(leerSemana(settings.weekSchedule), dto.weekday);
    if (tramos.length === 0) throw new BadRequestException('Ese día el negocio no abre. Elegí otro día.');
    if (!cabeEnTramos(tramos, dto.startMin, dto.durationMin)) {
      throw new BadRequestException(`Ese día el negocio atiende ${horarioTxt(tramos)}. La clase tiene que entrar ahí.`);
    }
    if (dto.isActive === false) return;
    const otras = await this.prisma.appointmentClassTemplate.findMany({
      where: {
        businessId, deletedAt: null, isActive: true, weekday: dto.weekday, ...(exceptoId ? { id: { not: exceptoId } } : {}),
        OR: [
          ...(dto.roomResourceId ? [{ roomResourceId: dto.roomResourceId }] : []),
          ...(dto.instructorResourceId ? [{ instructorResourceId: dto.instructorResourceId }] : []),
        ],
      },
      include: plantillaInclude,
    });
    for (const o of otras) {
      if (!seCruzan(o, dto)) continue;
      if (dto.roomResourceId && o.roomResourceId === dto.roomResourceId) {
        throw new BadRequestException(`A esa hora la ${sala!.name} ya tiene ${o.service.name}.`);
      }
      throw new BadRequestException(`A esa hora ${profe!.name} ya da ${o.service.name}.`);
    }
  }

  /** La plantilla (activa, no borrada) de una clase que quien mira puede tocar, en una fecha en la que cae. */
  private async plantillaOperable(member: MemberContext, templateId: string, date: string): Promise<PlantillaFila> {
    const propias = await this.ctx.propias(member, EDITAR_TODO);
    const t = await this.prisma.appointmentClassTemplate.findFirst({
      where: { id: templateId, businessId: member.businessId, deletedAt: null, ...alcanceDePlantilla(propias) },
      include: plantillaInclude,
    });
    if (!t || diaDeSemana(date) !== t.weekday) throw new NotFoundException(NO_EXISTE);
    if (!t.isActive) throw new BadRequestException('Esa clase no está activa en la grilla.');
    return t;
  }

  private async inscripcionOperable(member: MemberContext, enrollmentId: string) {
    const propias = await this.ctx.propias(member, EDITAR_TODO);
    const e = await this.prisma.appointmentClassEnrollment.findFirst({
      where: { id: enrollmentId, businessId: member.businessId, ...(propias ? { session: { template: alcanceDePlantilla(propias) } } : {}) },
      include: { session: { include: { template: { select: { capacity: true } } } } },
    });
    if (!e) throw new NotFoundException('Inscripción no encontrada');
    return e;
  }

  private async assertAbre(businessId: string, settings: AppointmentSettings, date: string) {
    const horario = await this.ctx.horario(businessId, settings, { from: date, to: date });
    if (horarioDelNegocio(horario, date).tramos.length === 0) throw new BadRequestException('Ese día el negocio no abre.');
  }

  /** CONTRATO § P2.2 regla 3, también para clases: turnos y clases activos por venir con ese teléfono (o cuenta). */
  private async assertLimiteActivos(businessId: string, settings: AppointmentSettings, phone: string, customerId: string | null, ahora: Date) {
    const max = settings.maxActivePerCustomer;
    if (max <= 0) return;
    const quien = [{ customerPhone: phone }, ...(customerId ? [{ customerId }] : [])];
    const [turnos, clases] = await Promise.all([
      this.prisma.appointment.count({ where: { businessId, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gt: ahora }, OR: quien } }),
      this.prisma.appointmentClassEnrollment.count({ where: { businessId, status: { in: [...ACTIVAS] }, session: { startsAt: { gt: ahora } }, OR: quien } }),
    ]);
    const n = turnos + clases;
    if (n >= max) throw new BadRequestException(`Ya tenés ${n} turnos reservados. Cuando uses o canceles alguno vas a poder sacar otro.`);
  }

  private async negocioPublico(slug: string): Promise<{ businessId: string; settings: AppointmentSettings }> {
    const businessId = await this.storefront.resolveBusinessId(slug);
    const abierto = await this.prisma.business.findFirst({ where: { id: businessId, isActive: true, isPaused: false, deletedAt: null }, select: { id: true } });
    if (!abierto) throw new NotFoundException('Negocio no encontrado');
    const { settings } = await this.ctx.delNegocio(businessId);
    return { businessId, settings };
  }

  /** Arma las clases de un rango (venciendo antes las ofertas de lista de espera que ya corrieron). */
  private async armarRango(
    businessId: string, settings: AppointmentSettings, rango: { from: string; to: string }, propias: string[] | null, ahora: Date,
  ): Promise<{ clases: ClaseDelDiaDto[]; plantillas: PlantillaFila[] }> {
    const scope = alcanceDePlantilla(propias);
    const [activas, sesiones] = await Promise.all([
      this.prisma.appointmentClassTemplate.findMany({ where: { businessId, deletedAt: null, isActive: true, ...scope }, include: plantillaInclude }),
      this.prisma.appointmentClassSession.findMany({
        where: { businessId, date: { gte: rango.from, lte: rango.to }, ...(propias ? { template: scope } : {}) },
        include: { template: { include: plantillaInclude } },
      }),
    ]);
    await this.vencerPendientes(businessId, settings, sesiones, ahora);
    const plantillas = new Map(activas.map((t) => [t.id, t]));
    for (const s of sesiones) if (!plantillas.has(s.templateId)) plantillas.set(s.templateId, s.template);
    const conteos = await this.conteos(businessId, sesiones.map((s) => s.id));
    const horario = await this.ctx.horario(businessId, settings, rango);
    const lista = [...plantillas.values()];
    const clases = armarClases(lista.map(aArmable), sesiones as SesionArmable[], conteos, horario, { ...rango, ahora, classOpenDays: settings.classOpenDays });
    return { clases, plantillas: lista };
  }

  /** Evaluación perezosa de las ofertas vencidas (no hay un cron frecuente: CONTRATO § Pendientes 1). */
  private async vencerPendientes(businessId: string, settings: AppointmentSettings, sesiones: (AppointmentClassSession & { template: PlantillaFila })[], ahora: Date) {
    if (sesiones.length === 0) return;
    const conVencidas = await this.prisma.appointmentClassEnrollment.findMany({
      where: { businessId, sessionId: { in: sesiones.map((s) => s.id) }, status: 'WAITLIST', offerExpiresAt: { lte: ahora } },
      select: { sessionId: true },
      distinct: ['sessionId'],
    });
    for (const { sessionId } of conVencidas) {
      const s = sesiones.find((x) => x.id === sessionId)!;
      await this.conLock(s.templateId, s.date, async (tx) => {
        const actual = (await tx.appointmentClassSession.findFirst({ where: { id: s.id, businessId } }))!;
        await this.vencerYOfrecer(tx, businessId, actual, actual.capacity ?? s.template.capacity, settings.waitlistAcceptMin, ahora);
      });
    }
  }

  private async conteos(businessId: string, sessionIds: string[]): Promise<Map<string, Conteo>> {
    const m = new Map<string, Conteo>();
    if (sessionIds.length === 0) return m;
    const filas = await this.prisma.appointmentClassEnrollment.groupBy({
      by: ['sessionId', 'status'],
      where: { businessId, sessionId: { in: sessionIds }, status: { in: [...ACTIVAS] } },
      _count: { _all: true },
    });
    for (const f of filas) {
      const c = m.get(f.sessionId) ?? { enrolled: 0, waitlist: 0 };
      if (f.status === 'ENROLLED') c.enrolled += f._count._all;
      else c.waitlist += f._count._all;
      m.set(f.sessionId, c);
    }
    return m;
  }

  private async detalleDe(member: MemberContext, settings: AppointmentSettings, templateId: string, date: string, propias: string[] | null, ahora: Date): Promise<ClaseDetalleDto> {
    const businessId = member.businessId;
    const t = await this.prisma.appointmentClassTemplate.findFirst({ where: { id: templateId, businessId, ...alcanceDePlantilla(propias) }, include: plantillaInclude });
    if (!t) throw new NotFoundException(NO_EXISTE);
    let s = await this.prisma.appointmentClassSession.findFirst({ where: { businessId, templateId, date } });
    if (s) {
      const vencidas = await this.prisma.appointmentClassEnrollment.count({ where: { businessId, sessionId: s.id, status: 'WAITLIST', offerExpiresAt: { lte: ahora } } });
      if (vencidas > 0) {
        await this.vencerPendientes(businessId, settings, [{ ...s, template: t }], ahora);
        s = await this.prisma.appointmentClassSession.findFirst({ where: { businessId, templateId, date } });
      }
    }
    const conteos = await this.conteos(businessId, s ? [s.id] : []);
    const horario = await this.ctx.horario(businessId, settings, { from: date, to: date });
    const [clase] = armarClases([aArmable(t)], s ? [s] : [], conteos, horario, { from: date, to: date, ahora, classOpenDays: settings.classOpenDays });
    if (!clase) throw new NotFoundException(NO_EXISTE);
    const inscripciones = s
      ? await this.prisma.appointmentClassEnrollment.findMany({ where: { businessId, sessionId: s.id, status: { in: [...ACTIVAS] } }, orderBy: { createdAt: 'asc' } })
      : [];
    inscripciones.sort((a, b) => (a.status === b.status ? (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0) : a.status === 'ENROLLED' ? -1 : 1));
    return { ...clase, enrollments: inscripciones.map((e) => this.aAnotado(member, e)) };
  }

  /** Nunca lleva el accessToken. */
  private aAnotado(member: MemberContext, e: AppointmentClassEnrollment): AnotadoDto {
    return {
      id: e.id,
      code: e.code,
      status: e.status,
      waitlistPosition: e.waitlistPosition,
      customer: { id: e.customerId, name: e.customerName, ...contactoSegun(member, e.customerPhone, e.customerEmail) },
      attended: e.attended,
      depositAmount: pesos(e.depositAmount),
      depositPaid: e.depositPaidAt !== null,
      createdAt: e.createdAt.toISOString(),
    };
  }
}
