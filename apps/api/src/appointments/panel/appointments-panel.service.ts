import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { MemberContext } from '../../common/types/auth-context.type';
import { fechaArgentina } from '../../common/utils/hora-argentina';
import { escaparHtml } from '../../common/utils/html';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DisponibilidadDiaDto, DisponibilidadRangoDto, MensajeEnviadoDto, MensajeId, MensajeRenderizadoDto, Paginado, TurnoDetalleDto, TurnoDto,
} from '../appointments.types';
import { TRANSICIONES, puedePasarA } from '../appointments.types';
import { CUALQUIERA, MAX_DIAS_RANGO, disponibilidadDelDia, disponibilidadPorRango } from '../disponibilidad/disponibilidad';
import { diasEntre, esFecha, fechaYMinutos, instanteDe, sumarDias } from '../horarios/horarios';
import { AppointmentsSettingsService } from './appointments-settings.service';
import { AppointmentsService } from './appointments.service';
import {
  AvailabilityQueryDto, AvailabilityRangeQueryDto, ChangeStatusDto, CreateAppointmentDto, ListAppointmentsQueryDto, MoveAppointmentDto,
  NoteDto, RegisterDepositDto,
} from './dto/appointments.dto';
import { armarTexto, canalesActivos, fechaParaMensaje, horaParaMensaje, leerMensajes } from './lib/mensajes';
import { agendasPropias, dentroDelAlcance, tiene } from './lib/permisos';
import { SELECT_TURNO, num, turnoDto } from './lib/serializar';
import { normalizarTelefono, taparTelefono } from './lib/telefono';

const ESTADOS: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];
const MAX_DIAS_LISTA = 92;

const SELECT_DETALLE = {
  ...SELECT_TURNO,
  customerAddress: true, customerDni: true, insuranceName: true, insuranceNumber: true, reason: true,
  confirmedAt: true, completedAt: true, cancelledAt: true, cancelledBy: true, cancelReason: true,
  wantsReminder: true, reminderSentAt: true, packagePurchaseId: true, giftCardId: true, membershipId: true, createdAt: true,
  createdByMember: { select: { name: true } },
} satisfies Prisma.AppointmentSelect;

/** Un email tapado: la primera letra y el dominio ("a•••@gmail.com"). */
const taparEmail = (email: string): string => email.replace(/^(.)[^@]*(@.*)$/, '$1•••$2');

/**
 * Turnos del panel (CONTRATO.md § P1.4): lecturas, disponibilidad y las
 * acciones del mostrador. Las escrituras pasan por el núcleo
 * (AppointmentsService), que es el que aplica las reglas de § 1.
 */
@Injectable()
export class AppointmentsPanelService {
  private readonly logger = new Logger(AppointmentsPanelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppointmentsSettingsService,
    private readonly nucleo: AppointmentsService,
    private readonly mail: MailService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  // ── Listado ────────────────────────────────────────────────────────────────

  async listar(member: MemberContext, q: ListAppointmentsQueryDto, ahora = new Date()): Promise<Paginado<TurnoDto>> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const hoy = fechaArgentina(ahora);
    const desde = q.from ?? q.to ?? hoy;
    const hasta = q.to ?? q.from ?? hoy;
    if (!esFecha(desde) || !esFecha(hasta)) throw new BadRequestException('Las fechas no son válidas.');
    if (hasta < desde) throw new BadRequestException('La fecha "hasta" tiene que ser igual o posterior a "desde".');
    if (diasEntre(desde, hasta) >= MAX_DIAS_LISTA) throw new BadRequestException(`El rango puede ser de hasta ${MAX_DIAS_LISTA} días.`);

    const estados = q.status ? q.status.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
    if (estados.some((s) => !ESTADOS.includes(s as AppointmentStatus))) throw new BadRequestException(`Los estados posibles son: ${ESTADOS.join(', ')}.`);

    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.view_all');
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const inicio = instanteDe(desde, 0);
    const fin = instanteDe(sumarDias(hasta, 1), 0);

    const where: Prisma.AppointmentWhereInput = {
      businessId,
      startsAt: { gte: inicio, lt: fin },
      ...(estados.length ? { status: { in: estados as AppointmentStatus[] } } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
    };
    const filtroAgenda = q.resourceId ? (dentroDelAlcance(propias, q.resourceId) ? [q.resourceId] : []) : propias;
    if (filtroAgenda) where.resourceId = { in: filtroAgenda };
    if (q.q?.trim()) where.id = { in: await this.idsQueCoinciden(businessId, q.q, inicio, fin) };

    const [filas, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({ where, select: SELECT_TURNO, orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.appointment.count({ where }),
    ]);
    const contacto = tiene(member, 'appointments.clients.contact');
    return { data: filas.map((t) => turnoDto(t, contacto, ahora)), total, page, limit };
  }

  /** Búsqueda por nombre (sin acentos ni mayúsculas) o teléfono del snapshot. */
  private async idsQueCoinciden(businessId: string, q: string, inicio: Date, fin: Date): Promise<string[]> {
    // starts_at es timestamp SIN zona guardado en UTC: se compara contra el ISO en UTC (el cast ignora la Z).
    const escapar = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
    const nombre = `%${escapar(q.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase())}%`;
    const digitos = q.replace(/\D/g, '');
    const telefono = digitos.length >= 3 ? `%${digitos}%` : null;
    const filas = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM appointments
      WHERE business_id = ${businessId}
        AND starts_at >= ${inicio.toISOString()}::timestamp AND starts_at < ${fin.toISOString()}::timestamp
        AND (translate(lower(customer_name), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc') LIKE ${nombre}
             OR (${telefono}::text IS NOT NULL AND customer_phone LIKE ${telefono}))`;
    return filas.map((f) => f.id);
  }

  // ── Detalle ────────────────────────────────────────────────────────────────

  async detalle(member: MemberContext, id: string, ahora = new Date()): Promise<TurnoDetalleDto> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.view_all');
    const t = await this.prisma.appointment.findFirst({
      where: { id, businessId, ...(propias ? { resourceId: { in: propias } } : {}) },
      select: {
        ...SELECT_DETALLE,
        payments: { where: { businessId }, orderBy: { createdAt: 'asc' }, select: { id: true, kind: true, method: true, status: true, amount: true, paidAt: true, reference: true, registeredByMember: { select: { name: true } } } },
        messageLogs: { where: { businessId }, orderBy: { createdAt: 'asc' }, select: { id: true, channel: true, template: true, recipient: true, status: true, error: true, createdAt: true } },
      },
    });
    if (!t) throw new NotFoundException('Ese turno no existe.');

    const contacto = tiene(member, 'appointments.clients.contact');
    const editables = tiene(member, 'appointments.agenda.manage') ? await agendasPropias(this.prisma, member, 'appointments.agenda.manage_all') : [];
    const edit = tiene(member, 'appointments.agenda.manage') && dentroDelAlcance(editables, t.resourceId);

    return {
      ...turnoDto(t, contacto, ahora),
      customerAddress: t.customerAddress,
      customerDni: t.customerDni,
      insuranceName: t.insuranceName,
      insuranceNumber: t.insuranceNumber,
      reason: t.reason,
      confirmedAt: t.confirmedAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      cancelledAt: t.cancelledAt?.toISOString() ?? null,
      cancelledBy: t.cancelledBy,
      cancelReason: t.cancelReason,
      wantsReminder: t.wantsReminder,
      reminderSentAt: t.reminderSentAt?.toISOString() ?? null,
      packagePurchaseId: t.packagePurchaseId,
      giftCardId: t.giftCardId,
      membershipId: t.membershipId,
      createdByMemberName: t.createdByMember?.name ?? null,
      createdAt: t.createdAt.toISOString(),
      payments: t.payments.map((p) => ({
        id: p.id, kind: p.kind, method: p.method, status: p.status, amount: num(p.amount), paidAt: p.paidAt?.toISOString() ?? null,
        reference: p.reference, registeredByMemberName: p.registeredByMember?.name ?? null,
      })),
      messages: t.messageLogs.map((m) => this.mensajeDto(m, contacto)),
      can: {
        edit,
        charge: tiene(member, 'appointments.cash.charge'),
        contact: contacto,
        transitions: edit ? TRANSICIONES[t.status].filter((n) => puedePasarA(t, n, ahora)) : [],
      },
    };
  }

  private mensajeDto(
    m: { id: string; channel: MensajeEnviadoDto['channel']; template: string; recipient: string; status: MensajeEnviadoDto['status']; error: string | null; createdAt: Date },
    contacto: boolean,
  ): MensajeEnviadoDto {
    const recipient = contacto ? m.recipient : m.recipient.includes('@') ? taparEmail(m.recipient) : taparTelefono(m.recipient);
    return { id: m.id, channel: m.channel, template: m.template as MensajeId, recipient, status: m.status, error: m.error, createdAt: m.createdAt.toISOString() };
  }

  // ── Disponibilidad (modo panel) ────────────────────────────────────────────

  async disponibilidad(member: MemberContext, q: AvailabilityQueryDto, ahora = new Date()): Promise<DisponibilidadDiaDto> {
    if (!esFecha(q.date)) throw new BadRequestException('La fecha no es válida.');
    const { settings, servicio, recursos, agenda, salvo } = await this.prepararDisponibilidad(member, q.serviceId, q.resourceId, q.except);
    const ctx = await this.nucleo.contexto({ businessId: member.businessId, settings, recursos, desde: q.date, hasta: q.date, modo: 'panel', salvo, ahora });
    const dia = disponibilidadDelDia(ctx, q.date, servicio.durationMin, agenda);
    const slots = await Promise.all(dia.horarios.map(async (h) => ({
      startMin: h.inicioMin,
      startsAt: h.startsAt.toISOString(),
      endsAt: h.endsAt.toISOString(),
      resourceId: h.resourceId,
      ...(await this.nucleo.precioA(member.businessId, servicio, q.date, h.inicioMin)),
    })));
    return {
      date: dia.fecha,
      closed: dia.cerrado,
      reason: dia.motivo,
      message: dia.motivo === 'vacaciones' ? settings.vacationMessage : null,
      slots,
    };
  }

  async disponibilidadRango(member: MemberContext, q: AvailabilityRangeQueryDto, ahora = new Date()): Promise<DisponibilidadRangoDto> {
    if (!esFecha(q.from) || !esFecha(q.to)) throw new BadRequestException('Las fechas no son válidas.');
    if (q.to < q.from) throw new BadRequestException('La fecha "hasta" tiene que ser igual o posterior a "desde".');
    if (diasEntre(q.from, q.to) >= MAX_DIAS_RANGO) throw new BadRequestException(`El rango puede ser de hasta ${MAX_DIAS_RANGO} días.`);
    const { settings, servicio, recursos, agenda, salvo } = await this.prepararDisponibilidad(member, q.serviceId, q.resourceId, q.except);
    const ctx = await this.nucleo.contexto({ businessId: member.businessId, settings, recursos, desde: q.from, hasta: q.to, modo: 'panel', salvo, ahora });
    return {
      days: disponibilidadPorRango(ctx, q.from, q.to, servicio.durationMin, agenda).map((d) => ({
        date: d.fecha, closed: d.cerrado, reason: d.motivo, free: d.libres, firstStartMin: d.primeroMin,
      })),
    };
  }

  private async prepararDisponibilidad(member: MemberContext, serviceId: string, resourceId: string | undefined, except: string | undefined) {
    const businessId = member.businessId;
    const settings = await this.settings.delNegocio(businessId);
    const servicio = await this.prisma.appointmentService.findFirst({ where: { id: serviceId, businessId, deletedAt: null } });
    if (!servicio) throw new NotFoundException('Ese servicio no existe.');
    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.manage_all');
    const candidatas = await this.nucleo.candidatas(businessId, settings, propias);
    const agenda = await this.nucleo.agendaReal(businessId, settings, resourceId ?? CUALQUIERA);
    if (agenda !== CUALQUIERA && !candidatas.some((r) => r.id === agenda)) throw new NotFoundException('Esa agenda no existe.');
    if (except) await this.nucleo.buscar(businessId, except, propias);
    const recursos = agenda === CUALQUIERA ? candidatas : candidatas.filter((r) => r.id === agenda);
    return { settings, servicio, recursos, agenda, salvo: except };
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  async crear(member: MemberContext, dto: CreateAppointmentDto): Promise<TurnoDetalleDto> {
    const businessId = member.businessId;
    if (!!dto.customerId === !!dto.customer) throw new BadRequestException('Elegí un cliente o cargá uno nuevo.');
    if (dto.priceOverride !== undefined && !tiene(member, 'appointments.services.manage')) {
      throw new ForbiddenException('Permiso requerido: appointments.services.manage');
    }
    await this.settings.delNegocio(businessId);
    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.manage_all');

    let cliente: { customerId?: string; name: string; phone: string; email: string | null };
    let obraSocial: string | null = null;
    if (dto.customerId) {
      const c = await this.prisma.customer.findFirst({ where: { id: dto.customerId, businessId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, phone: true, email: true } });
      if (!c) throw new NotFoundException('Ese cliente no existe.');
      cliente = { customerId: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' '), phone: c.phone ? normalizarTelefono(c.phone) : '', email: c.email };
    } else {
      const nuevo = dto.customer!;
      const phone = nuevo.phone ? normalizarTelefono(nuevo.phone) : '';
      if (nuevo.phone && (phone.length < 8 || phone.length > 15)) throw new BadRequestException('El teléfono tiene que tener entre 8 y 15 dígitos.');
      cliente = { name: nuevo.name.trim(), phone, email: nuevo.email?.trim().toLowerCase() || null };
      obraSocial = nuevo.insuranceName?.trim() || null;
    }

    const { turno } = await this.nucleo.crear({
      businessId,
      modo: 'panel',
      serviceId: dto.serviceId,
      resourceId: dto.resourceId.toLowerCase() === CUALQUIERA ? CUALQUIERA : dto.resourceId,
      date: dto.date,
      startMin: dto.startMin,
      cliente,
      modality: dto.modality,
      detalles: { internalNote: dto.internalNote?.trim() || null, insuranceName: obraSocial },
      createdByMemberId: member.memberId,
      agendasPermitidas: propias,
      precioManual: dto.priceOverride,
    });
    return this.detalle(member, turno.id);
  }

  async cambiarEstado(member: MemberContext, id: string, dto: ChangeStatusDto): Promise<TurnoDetalleDto> {
    await this.settings.delNegocio(member.businessId);
    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.manage_all');
    await this.nucleo.cambiarEstado(member.businessId, id, dto.status, {
      reason: dto.reason,
      sena: dto.keepDeposit ? 'retener' : 'reembolsar',
      cancelledBy: 'BUSINESS',
      memberId: member.memberId,
      agendasPermitidas: propias,
    });
    return this.detalle(member, id);
  }

  async mover(member: MemberContext, id: string, dto: MoveAppointmentDto): Promise<TurnoDetalleDto> {
    await this.settings.delNegocio(member.businessId);
    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.manage_all');
    const resourceId = dto.resourceId === undefined ? undefined : dto.resourceId.toLowerCase() === CUALQUIERA ? CUALQUIERA : dto.resourceId;
    await this.nucleo.mover(member.businessId, id, { date: dto.date, startMin: dto.startMin, resourceId }, { modo: 'panel', memberId: member.memberId, agendasPermitidas: propias });
    return this.detalle(member, id);
  }

  /** Registrar una seña o un cobro hecho en el local (o por transferencia). */
  async registrarPago(member: MemberContext, id: string, dto: RegisterDepositDto): Promise<TurnoDetalleDto> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.view_all');
    const turno = await this.nucleo.buscar(businessId, id, propias);
    if (turno.status === 'CANCELLED') throw new BadRequestException('Ese turno está cancelado: no se puede cobrar.');
    const kind = dto.kind ?? 'DEPOSIT';
    if (kind === 'DEPOSIT' && turno.depositPaidAt) throw new BadRequestException('La seña de este turno ya está registrada.');

    const total = num(turno.price) - num(turno.discountAmount);
    const yaCobrado = await this.prisma.appointmentPayment.aggregate({ where: { businessId, appointmentId: id, status: 'APPROVED' }, _sum: { amount: true } });
    const porDefecto = kind === 'DEPOSIT' ? num(turno.depositAmount) : kind === 'FULL' ? total : total - num(yaCobrado._sum.amount);
    const monto = dto.amount ?? porDefecto;
    if (!(monto > 0) || monto > total) throw new BadRequestException('El monto tiene que ser mayor a 0 y no puede pasar el total del turno.');

    const ahora = new Date();
    const pago = await this.prisma.$transaction(async (tx) => {
      // La seña (o el pago total) deja el turno con la seña paga; una sola vez.
      if (kind === 'DEPOSIT' || (kind === 'FULL' && !turno.depositPaidAt)) {
        const n = await tx.appointment.updateMany({ where: { id, businessId, depositPaidAt: null }, data: { depositPaidAt: ahora, depositMethod: dto.method } });
        if (n.count === 0 && kind === 'DEPOSIT') throw new BadRequestException('La seña de este turno ya está registrada.');
      }
      return tx.appointmentPayment.create({
        data: {
          businessId, appointmentId: id, kind, method: dto.method, status: 'APPROVED', amount: monto,
          reference: dto.reference?.trim() || null, paidAt: ahora, registeredByMemberId: member.memberId,
        },
      });
    });
    await this.audit?.registrar({
      businessId, memberId: member.memberId, entityType: 'appointment_payment', entityId: pago.id, action: 'CREATE',
      changes: [
        { field: 'appointmentCode', before: null, after: turno.code },
        { field: 'kind', before: null, after: kind },
        { field: 'method', before: null, after: dto.method },
        { field: 'amount', before: null, after: monto },
      ],
    });
    return this.detalle(member, id);
  }

  async nota(member: MemberContext, id: string, dto: NoteDto): Promise<TurnoDetalleDto> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.manage_all');
    const turno = await this.nucleo.buscar(businessId, id, propias);
    const nota = dto.internalNote?.trim() || null;
    const n = await this.prisma.appointment.updateMany({ where: { id, businessId }, data: { internalNote: nota } });
    if (n.count === 0) throw new NotFoundException('Ese turno no existe.');
    if (nota !== turno.internalNote) {
      await this.audit?.registrar({ businessId, memberId: member.memberId, entityType: 'appointment', entityId: id, action: 'UPDATE', changes: [{ field: 'internalNote', before: turno.internalNote, after: nota }] });
    }
    return this.detalle(member, id);
  }

  // ── Mensajes ───────────────────────────────────────────────────────────────

  /** El texto de una plantilla para este turno, SIN enviarlo, con el link a wa.me para mandarlo a mano. */
  async mensaje(member: MemberContext, id: string, plantillaId: MensajeId): Promise<MensajeRenderizadoDto> {
    const { texto, telefono } = await this.armarMensaje(member, id, plantillaId);
    return { template: plantillaId, text: texto, phone: telefono, waLink: telefono ? `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}` : null };
  }

  /**
   * Reenvío manual explícito por los canales activos. PROVISORIO hasta que
   * exista AppointmentMessagingService (P2, § 1.6): mail con MailService y
   * WhatsApp con el STUB (SIMULATED). Cuando esté, delegar en él.
   */
  async enviarMensaje(member: MemberContext, id: string, plantillaId: MensajeId): Promise<MensajeEnviadoDto[]> {
    const businessId = member.businessId;
    const { texto, config, plantilla, turno, negocio } = await this.armarMensaje(member, id, plantillaId);
    if (!plantilla.on) throw new BadRequestException('Ese mensaje está apagado en Configuración → Mensajes.');
    const ahora = new Date();
    const enviados: MensajeEnviadoDto[] = [];

    for (const canal of canalesActivos(config, plantilla)) {
      const destino = canal === 'email' ? turno.customerEmail : turno.customerPhone;
      if (!destino) continue;
      let estado: 'SENT' | 'FAILED' | 'SIMULATED';
      let error: string | null = null;
      if (canal === 'email') {
        try {
          const html = escaparHtml(texto).replace(/\n/g, '<br>');
          estado = (await this.mail.sendCustomEmail(destino, `${negocio}: tu ${plantillaId === 'cancelacion' ? 'turno cancelado' : 'turno'}`, html, { businessId })) ? 'SENT' : 'FAILED';
        } catch (err) {
          estado = 'FAILED';
          error = (err instanceof Error ? err.message : String(err)).slice(0, 500);
        }
      } else {
        // Sin proveedor real: se registra y no sale (ni el teléfono ni el texto van al log).
        this.logger.log(`[WHATSAPP STUB] plantilla ${plantillaId}, turno ${turno.id}`);
        estado = 'SIMULATED';
      }
      const fila = await this.prisma.appointmentMessageLog.create({
        data: {
          businessId, appointmentId: turno.id, customerId: turno.customerId, channel: canal === 'email' ? 'EMAIL' : 'WHATSAPP',
          template: plantillaId, recipient: destino, status: estado, error,
          dedupeKey: `${plantillaId}:${canal}:${turno.id}:${turno.startsAt.toISOString()}:manual-${ahora.getTime()}`,
        },
      });
      enviados.push(this.mensajeDto(fila, true));
    }
    if (enviados.length === 0) throw new BadRequestException('No hay por dónde mandarlo: el cliente no tiene email ni teléfono para los canales prendidos.');
    return enviados;
  }

  private async armarMensaje(member: MemberContext, id: string, plantillaId: MensajeId) {
    const businessId = member.businessId;
    const settings = await this.settings.delNegocio(businessId);
    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.view_all');
    const turno = await this.prisma.appointment.findFirst({
      where: { id, businessId, ...(propias ? { resourceId: { in: propias } } : {}) },
      select: { id: true, accessToken: true, customerId: true, customerName: true, customerPhone: true, customerEmail: true, serviceName: true, startsAt: true, resource: { select: { name: true } } },
    });
    if (!turno) throw new NotFoundException('Ese turno no existe.');
    const [negocio, dominio] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true, subdomain: true } }),
      this.prisma.customDomain.findFirst({ where: { businessId, status: 'ACTIVE' }, select: { domain: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    const config = leerMensajes(settings.messages, settings.agendaMode);
    const plantilla = config.mensajes.find((m) => m.id === plantillaId);
    if (!plantilla) throw new NotFoundException('Ese mensaje no existe para este negocio.');
    const nombreNegocio = negocio?.name ?? '';
    const host = dominio?.domain ?? `${negocio?.subdomain ?? ''}.orbita.site`;
    const { fecha, minutos } = fechaYMinutos(turno.startsAt);
    const texto = armarTexto(plantilla.texto, {
      nombre: turno.customerName.split(/\s+/)[0] ?? '',
      servicio: turno.serviceName,
      fecha: fechaParaMensaje(fecha),
      hora: horaParaMensaje(minutos),
      profesional: turno.resource.name,
      negocio: nombreNegocio,
      link: `https://${host}/mi-turno/${turno.accessToken}`,
    }, config.firma ? nombreNegocio : null);
    const digitos = turno.customerPhone.replace(/\D/g, '');
    const telefono = !digitos ? null : digitos.length === 10 ? `54${digitos}` : digitos;
    return { texto, telefono, config, plantilla, turno, negocio: nombreNegocio };
  }
}
