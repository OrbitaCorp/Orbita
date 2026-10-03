import { BadRequestException, ConflictException, HttpException, Inject, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentWaitlistEntry, Prisma } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { MemberContext } from '../../../common/types/auth-context.type';
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import type { EsperaDto } from '../../appointments.types';
import { CUALQUIERA, disponibilidadDelDia, horarioSiEstaLibre } from '../../disponibilidad/disponibilidad';
import { diasEntre, esFecha, fechaYMinutos, hhmm, instanteDe } from '../../horarios/horarios';
import { resolverCliente } from '../comun/clientes';
import { sitioDe } from '../comun/cobro-online';
import { AvanzadoContextoService, Db, NegocioTurnos, tienePermiso } from '../comun/contexto.service';
import { contextoDelDia } from '../comun/disponibilidad-db';
import { MENSAJERIA_TURNOS, MensajeriaTurnos } from '../comun/mensajeria';
import { NUCLEO_TURNOS, NucleoTurnos } from '../comun/nucleo-turnos';
import { normalizarTelefonoBasico, taparTelefono } from '../comun/telefono';
import { enTransaccion } from '../comun/transacciones';
import { JoinWaitlistDto, ListWaitlistQuery, OfferWaitlistDto } from './dto/lista-espera.dto';

export const AUDIENCIA_OFERTA = 'appointments-waitlist';
const OFERTA_INVALIDA = 'Esa oferta no existe.';

type EntradaConServicio = AppointmentWaitlistEntry & { service: { name: string; durationMin: number } };

interface PayloadOferta {
  sub: string;
  /** Agenda del lugar ofrecido (null = cualquiera). */
  rid: string | null;
  /** Inicio ofrecido (ISO): ata el token a ESA oferta; si se le ofrece otro horario, el enlace viejo deja de servir. */
  st: string;
}

/**
 * Lista de espera de TURNOS (P4.8). No es una función con interruptor de
 * Avanzado: depende de `rules.waitlistEnabled`.
 *
 * La oferta viaja como un token FIRMADO (JWT HS256 con JWT_SECRET, `aud:
 * 'appointments-waitlist'`, `sub: <entryId>`, `exp = offerExpiresAt`): no hay
 * columna para guardarlo. No sirve como sesión (AuthGuard exige `type`) y un
 * token de sesión no sirve como oferta (no tiene `aud`).
 *
 * Exporta para el núcleo: `ofrecerLugarLiberado` (al cancelar un turno) y
 * `vencerOfertas` (perezoso: al leer la lista y en el cron).
 */
@Injectable()
export class ListaEsperaService {
  private readonly logger = new Logger(ListaEsperaService.name);
  private readonly secreto: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: AvanzadoContextoService,
    private readonly audit: AuditService,
    config: ConfigService,
    @Inject(MENSAJERIA_TURNOS) private readonly mensajeria: MensajeriaTurnos,
    @Optional() @Inject(NUCLEO_TURNOS) private readonly nucleo?: NucleoTurnos,
  ) {
    this.secreto = config.getOrThrow<string>('JWT_SECRET');
  }

  // ── Panel ────────────────────────────────────────────────────────────────

  async listar(member: MemberContext, q: ListWaitlistQuery): Promise<EsperaDto[]> {
    const { businessId } = member;
    await this.contexto.delNegocio(businessId);
    if (q.date && !esFecha(q.date)) throw new BadRequestException('Esa fecha no existe.');
    await this.vencerOfertas(businessId);
    const where: Prisma.AppointmentWaitlistEntryWhereInput = {
      businessId, ...(q.date ? { date: q.date } : {}), ...(q.status ? { status: q.status } : { status: { in: ['WAITING', 'OFFERED'] } }),
    };
    // Sin view_all: lo pedido para una agenda propia, o para "cualquiera" (CONTRATO § 0 "alcance").
    if (!tienePermiso(member, 'appointments.agenda.view_all')) {
      where.OR = [{ resourceId: null }, { resourceId: { in: await this.misAgendas(member) } }];
    }
    const filas = await this.prisma.appointmentWaitlistEntry.findMany({
      where, include: { service: { select: { name: true, durationMin: true } } }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], take: 500,
    });
    const contacto = tienePermiso(member, 'appointments.clients.contact');
    return filas.map((e) => aDto(e, contacto));
  }

  /** Ofrecer a mano un horario a alguien de la lista (el dueño ve un hueco y se lo pasa). */
  async ofrecerAMano(member: MemberContext, id: string, dto: OfferWaitlistDto): Promise<EsperaDto> {
    const { businessId } = member;
    const negocio = await this.contexto.delNegocio(businessId);
    if (!esFecha(dto.date)) throw new BadRequestException('Esa fecha no existe.');
    const entrada = await this.prisma.appointmentWaitlistEntry.findFirst({ where: { id, businessId }, include: { service: { select: { name: true, durationMin: true } } } });
    if (!entrada || !(await this.alcanza(member, entrada.resourceId))) throw new NotFoundException('Esa persona no está en la lista de espera.');
    if (entrada.status !== 'WAITING' && entrada.status !== 'EXPIRED') throw new BadRequestException('A esa persona ya se le ofreció un lugar o ya tiene turno.');
    if (!(await this.alcanza(member, dto.resourceId))) throw new NotFoundException('Esa agenda no existe.');
    const ctx = await contextoDelDia(this.prisma, businessId, negocio.settings, dto.date, 'panel');
    if (!horarioSiEstaLibre(ctx, dto.date, dto.startMin, entrada.service.durationMin, dto.resourceId)) {
      throw new ConflictException('Ese horario no está libre para ese servicio.');
    }
    await this.ofrecer(negocio, entrada, { resourceId: dto.resourceId, startsAt: instanteDe(dto.date, dto.startMin) }, this.prisma, ['WAITING', 'EXPIRED']);
    await this.audit.registrar({ businessId, memberId: member.memberId, entityType: 'appointment_waitlist_entry', entityId: id, action: 'UPDATE', changes: [{ field: 'status', before: entrada.status, after: 'OFFERED' }] });
    const e = await this.prisma.appointmentWaitlistEntry.findFirst({ where: { id, businessId }, include: { service: { select: { name: true, durationMin: true } } } });
    return aDto(e!, tienePermiso(member, 'appointments.clients.contact'));
  }

  async sacar(member: MemberContext, id: string): Promise<{ ok: true }> {
    const { businessId } = member;
    await this.contexto.delNegocio(businessId);
    const e = await this.prisma.appointmentWaitlistEntry.findFirst({ where: { id, businessId }, select: { resourceId: true } });
    if (!e || !(await this.alcanza(member, e.resourceId))) throw new NotFoundException('Esa persona no está en la lista de espera.');
    const { count } = await this.prisma.appointmentWaitlistEntry.updateMany({ where: { id, businessId, status: { in: ['WAITING', 'OFFERED', 'EXPIRED'] } }, data: { status: 'CANCELLED' } });
    if (count > 0) await this.audit.registrar({ businessId, memberId: member.memberId, entityType: 'appointment_waitlist_entry', entityId: id, action: 'DELETE' });
    return { ok: true };
  }

  // ── Sitio público ────────────────────────────────────────────────────────

  /** Anotarse: solo si ese día no tiene horarios libres para lo que pide (CONTRATO § P4.8). */
  async anotarse(businessId: string, dto: JoinWaitlistDto, customerIdSesion: string | null): Promise<{ id: string; date: string; status: 'WAITING' }> {
    const negocio = await this.contexto.delSitioAbierto(businessId);
    const s = negocio.settings;
    if (!s.waitlistEnabled) throw new NotFoundException('Este negocio no tiene lista de espera.');
    if (!esFecha(dto.date)) throw new BadRequestException('Esa fecha no existe.');
    const hoy = fechaArgentina(new Date());
    if (dto.date < hoy) throw new BadRequestException('Esa fecha ya pasó.');
    if (diasEntre(hoy, dto.date) > s.maxAdvanceDays) throw new BadRequestException(`Se puede reservar hasta ${s.maxAdvanceDays} días adelante.`);
    if ((dto.fromMin === undefined) !== (dto.toMin === undefined)) throw new BadRequestException('Elegí desde y hasta qué hora te sirve.');
    if (dto.fromMin !== undefined && dto.toMin! <= dto.fromMin) throw new BadRequestException('La franja tiene que terminar después de empezar.');
    const phone = normalizarTelefonoBasico(dto.phone);
    if (phone.length !== 10) throw new BadRequestException(phone.length < 10 ? 'Faltan dígitos: son 10 con el código de área.' : 'Sobran dígitos: son 10 con el código de área.');

    const servicio = await this.prisma.appointmentService.findFirst({ where: { id: dto.serviceId, businessId, deletedAt: null, isActive: true, bookableOnline: true }, select: { id: true, durationMin: true } });
    if (!servicio) throw new NotFoundException('Ese servicio no existe.');
    const resourceId = s.letChooseResource && dto.resourceId && dto.resourceId !== CUALQUIERA ? dto.resourceId : null;
    const ctx = await contextoDelDia(this.prisma, businessId, s, dto.date, 'publico');
    if (resourceId && !ctx.recursos.some((r) => r.id === resourceId)) throw new NotFoundException('Esa agenda no existe.');

    const libres = disponibilidadDelDia(ctx, dto.date, servicio.durationMin, resourceId ?? CUALQUIERA).horarios
      .filter((h) => dto.fromMin === undefined || (h.inicioMin >= dto.fromMin && h.inicioMin < dto.toMin!));
    if (libres.length > 0) throw new BadRequestException('Ese día todavía tiene horarios.');

    const repetida = await this.prisma.appointmentWaitlistEntry.findFirst({
      where: { businessId, customerPhone: phone, date: dto.date, serviceId: servicio.id, status: { in: ['WAITING', 'OFFERED'] } }, select: { id: true },
    });
    if (repetida) throw new BadRequestException('Ya estás en la lista de espera de ese día.');

    const e = await this.prisma.$transaction(async (tx) => {
      const cliente = customerIdSesion
        ? await resolverCliente(tx, businessId, { customerId: customerIdSesion })
        : await resolverCliente(tx, businessId, { customer: { name: dto.name, phone, email: dto.email } });
      return tx.appointmentWaitlistEntry.create({
        data: {
          businessId, customerId: cliente.id, customerName: dto.name.trim().slice(0, 120), customerPhone: phone, customerEmail: dto.email?.toLowerCase() ?? null,
          serviceId: servicio.id, resourceId, date: dto.date, fromMin: dto.fromMin ?? null, toMin: dto.toMin ?? null,
        },
      });
    });
    return { id: e.id, date: e.date, status: 'WAITING' };
  }

  /** Tomar el lugar ofrecido: valida el token, crea el turno con el núcleo (§ 1.1) y marca ACCEPTED. */
  async aceptar(businessId: string, token: string): Promise<{ appointmentId: string; startsAt: string }> {
    const negocio = await this.contexto.delSitioAbierto(businessId);
    let payload: PayloadOferta;
    try {
      payload = jwt.verify(token, this.secreto, { audience: AUDIENCIA_OFERTA, algorithms: ['HS256'] }) as unknown as PayloadOferta;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        const vencido = jwt.decode(token) as PayloadOferta | null;
        if (vencido?.sub) await this.vencerOfertas(businessId);
        throw new BadRequestException('La oferta venció: el lugar pasó al siguiente de la lista.');
      }
      throw new NotFoundException(OFERTA_INVALIDA);
    }
    const entrada = typeof payload.sub === 'string'
      ? await this.prisma.appointmentWaitlistEntry.findFirst({ where: { id: payload.sub, businessId }, include: { service: { select: { name: true, durationMin: true } } } })
      : null;
    if (!entrada || !entrada.offeredStartsAt || entrada.offeredStartsAt.toISOString() !== payload.st) throw new NotFoundException(OFERTA_INVALIDA);
    if (entrada.status === 'ACCEPTED' && entrada.appointmentId) return { appointmentId: entrada.appointmentId, startsAt: entrada.offeredStartsAt.toISOString() };
    if (entrada.status !== 'OFFERED') throw new BadRequestException('Esa oferta ya no está vigente.');
    if (!entrada.offerExpiresAt || entrada.offerExpiresAt.getTime() <= Date.now()) {
      await this.vencerOfertas(businessId);
      throw new BadRequestException('La oferta venció: el lugar pasó al siguiente de la lista.');
    }
    if (!this.nucleo) throw new ServiceUnavailableException('Todavía no se puede tomar el lugar desde acá. Escribile al negocio.');

    const { fecha, minutos } = fechaYMinutos(entrada.offeredStartsAt);
    try {
      const turno = await this.prisma.$transaction(async (tx) => {
        const t = await this.nucleo!.crearTurno({
          businessId, serviceId: entrada.serviceId, resourceId: payload.rid ?? CUALQUIERA, date: fecha, startMin: minutos,
          customerId: entrada.customerId, customerName: entrada.customerName, customerPhone: entrada.customerPhone, customerEmail: entrada.customerEmail,
          origin: 'STOREFRONT', createdByMemberId: null,
        }, tx);
        const { count } = await tx.appointmentWaitlistEntry.updateMany({
          where: { id: entrada.id, businessId, status: 'OFFERED' },
          data: { status: 'ACCEPTED', appointmentId: t.id },
        });
        if (count === 0) throw new ConflictException('Esa oferta ya no está vigente.');
        return t;
      });
      return { appointmentId: turno.id, startsAt: turno.startsAt.toISOString() };
    } catch (err) {
      // El horario se ocupó: la persona sigue esperando otro lugar.
      if (err instanceof HttpException && err.getStatus() === 409) {
        await this.prisma.appointmentWaitlistEntry.updateMany({ where: { id: entrada.id, businessId, status: 'OFFERED' }, data: { status: 'WAITING', offerExpiresAt: null } });
        this.logger.log(`Oferta de lista de espera ${entrada.id} sin lugar al aceptar (negocio ${negocio.id})`);
      }
      throw err;
    }
  }

  // ── Para enchufar en el núcleo ───────────────────────────────────────────

  /**
   * Se liberó un horario (cancelación, CONTRATO § 1.2): se le ofrece al
   * primero en WAITING cuyo pedido lo contenga (mismo día, misma agenda o
   * "cualquiera", la franja pedida y un servicio que entre en el hueco). Con
   * `tx` corre adentro de la transacción de la cancelación (el turno
   * cancelado ya no ocupa). null = nadie esperaba eso, o la lista está apagada.
   */
  async ofrecerLugarLiberado(
    p: { businessId: string; resourceId: string | null; startsAt: Date; excluir?: string[] },
    tx: Db = this.prisma,
  ): Promise<{ entryId: string; offerExpiresAt: Date } | null> {
    const negocio = await this.contexto.delNegocio(p.businessId, tx);
    if (!negocio.settings.waitlistEnabled) return null;
    if (p.startsAt.getTime() <= Date.now()) return null;
    const { fecha, minutos } = fechaYMinutos(p.startsAt);
    const candidatos = await tx.appointmentWaitlistEntry.findMany({
      where: {
        businessId: p.businessId, date: fecha, status: 'WAITING', ...(p.excluir?.length ? { id: { notIn: p.excluir } } : {}),
        ...(p.resourceId ? { OR: [{ resourceId: null }, { resourceId: p.resourceId }] } : {}),
      },
      include: { service: { select: { name: true, durationMin: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const ctx = await contextoDelDia(tx, p.businessId, negocio.settings, fecha, 'publico');
    for (const e of candidatos) {
      if (e.fromMin !== null && e.toMin !== null && (minutos < e.fromMin || minutos >= e.toMin)) continue;
      const agenda = e.resourceId ?? p.resourceId ?? CUALQUIERA;
      const libre = horarioSiEstaLibre(ctx, fecha, minutos, e.service.durationMin, agenda);
      if (!libre) continue;
      const oferta = await this.ofrecer(negocio, e, { resourceId: e.resourceId ?? p.resourceId, startsAt: p.startsAt }, tx, ['WAITING']);
      if (oferta) return { entryId: e.id, offerExpiresAt: oferta.offerExpiresAt };
    }
    return null;
  }

  /** Ofertas vencidas → EXPIRED, y el mismo lugar pasa al siguiente (perezoso: al leer, al aceptar y en el cron). */
  async vencerOfertas(businessId: string, tx?: Db): Promise<number> {
    return enTransaccion(this.prisma, tx, async (t) => {
      const ahora = new Date();
      const vencidas = await t.appointmentWaitlistEntry.findMany({ where: { businessId, status: 'OFFERED', offerExpiresAt: { lt: ahora } } });
      let n = 0;
      for (const e of vencidas) {
        const { count } = await t.appointmentWaitlistEntry.updateMany({ where: { id: e.id, businessId, status: 'OFFERED' }, data: { status: 'EXPIRED' } });
        if (count === 0) continue;
        n++;
        if (e.offeredStartsAt && e.offeredStartsAt.getTime() > ahora.getTime()) {
          await this.ofrecerLugarLiberado({ businessId, resourceId: e.resourceId, startsAt: e.offeredStartsAt, excluir: [e.id] }, t);
        }
      }
      return n;
    });
  }

  /** El token de una oferta (lo que va en el enlace del mensaje). */
  firmarOferta(entryId: string, resourceId: string | null, startsAt: Date, venceA: Date): string {
    const segundos = Math.max(1, Math.floor((venceA.getTime() - Date.now()) / 1000));
    return jwt.sign({ rid: resourceId, st: startsAt.toISOString() }, this.secreto, { audience: AUDIENCIA_OFERTA, subject: entryId, expiresIn: segundos, algorithm: 'HS256' });
  }

  // ── Internos ─────────────────────────────────────────────────────────────

  private async ofrecer(
    negocio: NegocioTurnos,
    e: EntradaConServicio,
    lugar: { resourceId: string | null; startsAt: Date },
    tx: Db,
    desde: ('WAITING' | 'EXPIRED')[],
  ): Promise<{ offerExpiresAt: Date } | null> {
    const ahora = new Date();
    const offerExpiresAt = new Date(ahora.getTime() + negocio.settings.waitlistAcceptMin * 60_000);
    const { count } = await tx.appointmentWaitlistEntry.updateMany({
      where: { id: e.id, businessId: negocio.id, status: { in: desde } },
      data: { status: 'OFFERED', offeredAt: ahora, offerExpiresAt, offeredStartsAt: lugar.startsAt },
    });
    if (count === 0) return null;
    const token = this.firmarOferta(e.id, lugar.resourceId, lugar.startsAt, offerExpiresAt);
    const { fecha, minutos } = fechaYMinutos(lugar.startsAt);
    const [, mes, dia] = fecha.split('-');
    await this.mensajeria.despachar('espera', {
      businessId: negocio.id, customerId: e.customerId, nombre: e.customerName, telefono: e.customerPhone, email: e.customerEmail,
      variables: {
        nombre: e.customerName.split(' ')[0], servicio: e.service.name, fecha: `${dia}/${mes}`, hora: hhmm(minutos), negocio: negocio.name,
        profesional: '', link: `${sitioDe(negocio.subdomain)}/lista-de-espera?oferta=${encodeURIComponent(token)}`,
      },
      clave: `${e.id}:${lugar.startsAt.toISOString()}`,
    });
    return { offerExpiresAt };
  }

  private async misAgendas(member: MemberContext): Promise<string[]> {
    const propias = await this.prisma.appointmentResource.findMany({
      where: { businessId: member.businessId, memberId: member.memberId, deletedAt: null }, select: { id: true, assignedSpaceId: true },
    });
    return propias.flatMap((r) => (r.assignedSpaceId ? [r.id, r.assignedSpaceId] : [r.id]));
  }

  /** ¿Quien mira alcanza esa agenda? (null = "cualquiera": todos). */
  private async alcanza(member: MemberContext, resourceId: string | null): Promise<boolean> {
    if (!resourceId || tienePermiso(member, 'appointments.agenda.manage_all')) return true;
    return (await this.misAgendas(member)).includes(resourceId);
  }
}

const aDto = (e: EntradaConServicio, contacto: boolean): EsperaDto => ({
  id: e.id,
  customer: { id: e.customerId, name: e.customerName, phone: contacto ? e.customerPhone : taparTelefono(e.customerPhone), email: contacto ? e.customerEmail : null },
  serviceId: e.serviceId, serviceName: e.service.name, resourceId: e.resourceId, date: e.date, fromMin: e.fromMin, toMin: e.toMin,
  status: e.status, offerExpiresAt: e.offerExpiresAt?.toISOString() ?? null, createdAt: e.createdAt.toISOString(),
});
