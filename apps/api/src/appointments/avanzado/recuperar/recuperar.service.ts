import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppointmentWinbackCampaign } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import type { CampaniaRecuperarDto, Fecha } from '../../appointments.types';
import { nombreDe } from '../comun/clientes';
import { sitioDe } from '../comun/cobro-online';
import { LARGO_CUPON, codigoAleatorio, esUnicoRepetido, normalizarCodigo } from '../comun/codigos';
import { AvanzadoContextoService, Db } from '../comun/contexto.service';
import { MENSAJERIA_TURNOS, MensajeriaTurnos } from '../comun/mensajeria';
import { normalizarTelefonoBasico } from '../comun/telefono';
import { UpsertWinbackDto } from './dto/recuperar.dto';

const DIA_MS = 24 * 3600 * 1000;
const VARIABLES = ['nombre', 'negocio', 'servicio', 'link'];
/** Tope por corrida: una campaña no le escribe a miles de personas de un saque. */
const MAX_POR_ENVIO = 500;

export interface ClienteInactivo {
  customerId: string;
  name: string;
  phone: string;
  email: string | null;
  lastVisit: Date;
  visits: number;
  lastServiceName: string | null;
}

/** Variables entre llaves que no existen (el mismo criterio que UpdateMessagesDto). */
export function variablesDesconocidas(texto: string): string[] {
  return [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((v) => !VARIABLES.includes(v));
}

/**
 * Recuperar clientes (P4.7): campaña "te extrañamos". Una por negocio.
 *
 * A quién: clientes con alguna visita (turno COMPLETED), la última hace
 * `inactiveDays` o más, sin turnos por delante, con `acceptsPromos` y que
 * todavía no recibieron ESTA campaña. "No escribirle dos veces a nadie" lo
 * garantiza la base: `appointment_winback_sends` tiene `@@unique([campaignId,
 * customerId])` y la fila se crea ANTES de mandar; si dos corridas se cruzan,
 * la segunda choca (P2002) y no manda.
 */
@Injectable()
export class RecuperarService {
  private readonly logger = new Logger(RecuperarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: AvanzadoContextoService,
    private readonly audit: AuditService,
    @Inject(MENSAJERIA_TURNOS) private readonly mensajeria: MensajeriaTurnos,
  ) {}

  async obtener(businessId: string): Promise<CampaniaRecuperarDto | null> {
    await this.contexto.delNegocio(businessId);
    const c = await this.prisma.appointmentWinbackCampaign.findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' } });
    if (!c) return null;
    const audiencia = await this.clientesInactivos(businessId, c.inactiveDays, { campaignId: c.id });
    return aDto(c, audiencia.length);
  }

  async guardar(businessId: string, memberId: string, dto: UpsertWinbackDto): Promise<CampaniaRecuperarDto> {
    await this.contexto.delNegocio(businessId);
    const malas = variablesDesconocidas(dto.message);
    if (malas.length > 0) throw new BadRequestException(`La variable {${malas[0]}} no existe. Podés usar: {nombre}, {negocio}, {servicio}, {link}.`);
    const data = {
      inactiveDays: dto.inactiveDays, message: dto.message.trim(), couponEnabled: dto.couponEnabled, couponPercent: dto.couponPercent,
      couponValidDays: dto.couponValidDays, mode: dto.mode, isActive: dto.isActive,
    };
    const antes = await this.prisma.appointmentWinbackCampaign.findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' } });
    if (antes) {
      const { count } = await this.prisma.appointmentWinbackCampaign.updateMany({ where: { id: antes.id, businessId }, data });
      if (count === 0) throw new NotFoundException('La campaña no existe.');
      await this.audit.registrar({
        businessId, memberId, entityType: 'appointment_winback_campaign', entityId: antes.id, action: 'UPDATE',
        changes: AuditService.diferencias(antes, { ...antes, ...data }, ['inactiveDays', 'message', 'couponEnabled', 'couponPercent', 'couponValidDays', 'mode', 'isActive']),
      });
    } else {
      const c = await this.prisma.appointmentWinbackCampaign.create({ data: { businessId, ...data } });
      await this.audit.registrar({ businessId, memberId, entityType: 'appointment_winback_campaign', entityId: c.id, action: 'CREATE' });
    }
    return (await this.obtener(businessId))!;
  }

  async audiencia(businessId: string, inactiveDays: number): Promise<{ count: number; sample: { name: string; lastVisit: Fecha; visits: number }[] }> {
    await this.contexto.delNegocio(businessId);
    const c = await this.prisma.appointmentWinbackCampaign.findFirst({ where: { businessId }, select: { id: true }, orderBy: { createdAt: 'asc' } });
    const lista = await this.clientesInactivos(businessId, inactiveDays, { campaignId: c?.id });
    return {
      count: lista.length,
      sample: lista.slice(0, 5).map((x) => ({ name: x.name, lastVisit: fechaArgentina(x.lastVisit), visits: x.visits })),
    };
  }

  /** "Enviar ahora" (o la corrida automática): le escribe a la audiencia de hoy, una sola vez por persona. */
  async enviar(businessId: string, memberId: string | null): Promise<{ sent: number; skipped: number }> {
    const negocio = await this.contexto.delNegocio(businessId);
    this.contexto.exigirPrendida(negocio.settings, 'recuperar');
    const campania = await this.prisma.appointmentWinbackCampaign.findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' } });
    if (!campania) throw new BadRequestException('Primero configurá la campaña.');
    if (!campania.isActive) throw new BadRequestException('La campaña está apagada. Prendela para mandarla.');

    const destinatarios = (await this.clientesInactivos(businessId, campania.inactiveDays, { campaignId: campania.id })).slice(0, MAX_POR_ENVIO);
    let sent = 0;
    let skipped = 0;
    for (const d of destinatarios) {
      const ahora = new Date();
      const cupon = campania.couponEnabled ? codigoAleatorio(LARGO_CUPON) : null;
      const vence = campania.couponEnabled ? new Date(ahora.getTime() + campania.couponValidDays * DIA_MS) : null;
      try {
        await this.prisma.appointmentWinbackSend.create({
          data: { businessId, campaignId: campania.id, customerId: d.customerId, couponCode: cupon, couponExpiresAt: vence },
        });
      } catch (err) {
        // Otra corrida ya le escribió (unique campaignId + customerId): no se repite.
        if (esUnicoRepetido(err)) { skipped++; continue; }
        throw err;
      }
      const texto = cupon
        ? `${campania.message} Con el código ${cupon} tenés ${campania.couponPercent}% de descuento hasta el ${fechaArgentina(vence!)}.`
        : campania.message;
      await this.mensajeria.despachar('extranamos', {
        businessId, customerId: d.customerId, nombre: d.name, telefono: d.phone || null, email: d.email,
        variables: { nombre: d.name.split(' ')[0], negocio: negocio.name, servicio: d.lastServiceName ?? '', link: sitioDe(negocio.subdomain) },
        texto, clave: `${campania.id}:${d.customerId}`,
      });
      sent++;
    }
    await this.prisma.appointmentWinbackCampaign.updateMany({
      where: { id: campania.id, businessId },
      data: { sentCount: { increment: sent }, lastRunAt: new Date() },
    });
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_winback_campaign', entityId: campania.id, action: 'UPDATE', changes: [{ field: 'sent', before: null, after: sent }] });
    return { sent, skipped };
  }

  /**
   * Corrida automática (`mode = auto`) para el cron de las 22 h. Recorre las
   * campañas de TODOS los negocios (excepción declarada en
   * aislamiento-consultas.unit-spec) y corre cada una con su businessId. Un
   * negocio que falla no corta a los demás. Todavía no está colgada del cron:
   * ver el informe de P4.
   */
  async correrCampaniasAutomaticas(): Promise<{ negocios: number; sent: number }> {
    const campanias = await this.prisma.appointmentWinbackCampaign.findMany({
      where: { isActive: true, mode: 'auto', business: { vertical: 'APPOINTMENTS', isActive: true, isPaused: false, deletedAt: null } },
      select: { businessId: true },
    });
    let negocios = 0;
    let sent = 0;
    for (const { businessId } of campanias) {
      try {
        const { on } = await this.contexto.activa(businessId, 'recuperar');
        if (!on) continue;
        sent += (await this.enviar(businessId, null)).sent;
        negocios++;
      } catch (err) {
        this.logger.error(`Recuperar clientes falló en el negocio ${businessId}: ${(err as Error).message}`);
      }
    }
    return { negocios, sent };
  }

  // ── Para enchufar en la reserva ──────────────────────────────────────────

  /**
   * Los clientes que no vuelven hace `dias` días o más (CONTRATO § P4.7). Con
   * `campaignId`, saca a quienes ya recibieron esa campaña. Ordenados del que
   * hace más tiempo que no viene al que menos.
   */
  async clientesInactivos(businessId: string, dias: number, opciones: { campaignId?: string; ahora?: Date } = {}, tx: Db = this.prisma): Promise<ClienteInactivo[]> {
    const ahora = opciones.ahora ?? new Date();
    const limite = new Date(ahora.getTime() - dias * DIA_MS);
    const visitas = await tx.appointment.groupBy({
      by: ['customerId'],
      where: { businessId, status: 'COMPLETED', customerId: { not: null } },
      _max: { startsAt: true },
      _count: { _all: true },
    });
    const candidatos = visitas.filter((v) => v.customerId && v._max.startsAt && v._max.startsAt.getTime() <= limite.getTime());
    if (candidatos.length === 0) return [];
    const ids = candidatos.map((v) => v.customerId!);

    const [conTurno, conPromos, yaRecibieron, clientes, ultimos] = await Promise.all([
      tx.appointment.findMany({ where: { businessId, customerId: { in: ids }, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gt: ahora } }, select: { customerId: true }, distinct: ['customerId'] }),
      tx.appointmentCustomerProfile.findMany({ where: { businessId, customerId: { in: ids }, acceptsPromos: true }, select: { customerId: true } }),
      opciones.campaignId
        ? tx.appointmentWinbackSend.findMany({ where: { businessId, campaignId: opciones.campaignId, customerId: { in: ids } }, select: { customerId: true } })
        : Promise.resolve([] as { customerId: string }[]),
      tx.customer.findMany({ where: { businessId, id: { in: ids }, deletedAt: null }, select: { id: true, firstName: true, lastName: true, phone: true, email: true } }),
      tx.appointment.findMany({
        where: { businessId, customerId: { in: ids }, status: 'COMPLETED' },
        select: { customerId: true, serviceName: true }, orderBy: { startsAt: 'desc' }, distinct: ['customerId'],
      }),
    ]);
    const afuera = new Set([...conTurno.map((x) => x.customerId), ...yaRecibieron.map((x) => x.customerId)]);
    const aceptan = new Set(conPromos.map((x) => x.customerId));
    const fichas = new Map(clientes.map((c) => [c.id, c]));
    const servicio = new Map(ultimos.map((u) => [u.customerId, u.serviceName]));

    return candidatos
      .filter((v) => !afuera.has(v.customerId) && aceptan.has(v.customerId!) && fichas.has(v.customerId!))
      .map((v) => {
        const c = fichas.get(v.customerId!)!;
        return {
          customerId: c.id, name: nombreDe(c), phone: normalizarTelefonoBasico(c.phone), email: c.email,
          lastVisit: v._max.startsAt!, visits: v._count._all, lastServiceName: servicio.get(c.id) ?? null,
        };
      })
      .sort((a, b) => a.lastVisit.getTime() - b.lastVisit.getTime());
  }

  /**
   * Canje del cupón de la campaña al reservar (`CreateBookingDto.couponCode`).
   * Es personal: tiene que ser del mismo cliente. Marca `couponUsedAt` con un
   * update condicionado (dos reservas no usan el mismo cupón). Devuelve el %
   * de descuento; § 1.3 lo compara con la bienvenida y aplica el mayor.
   */
  async canjearCuponRecuperar(p: { businessId: string; code: string; customerId: string | null }, tx: Db = this.prisma): Promise<{ percent: number; sendId: string }> {
    const { on } = await this.contexto.activa(p.businessId, 'recuperar', tx);
    if (!on) throw new BadRequestException('Ese cupón no es válido.');
    const envio = await tx.appointmentWinbackSend.findFirst({
      where: { businessId: p.businessId, couponCode: normalizarCodigo(p.code) },
      include: { campaign: { select: { couponEnabled: true, couponPercent: true } } },
    });
    if (!envio || !p.customerId || envio.customerId !== p.customerId || !envio.campaign.couponEnabled) throw new BadRequestException('Ese cupón no es válido.');
    if (envio.couponExpiresAt && envio.couponExpiresAt.getTime() <= Date.now()) throw new BadRequestException(`Ese cupón venció el ${fechaArgentina(envio.couponExpiresAt)}.`);
    const { count } = await tx.appointmentWinbackSend.updateMany({ where: { id: envio.id, businessId: p.businessId, couponUsedAt: null }, data: { couponUsedAt: new Date() } });
    if (count === 0) throw new ConflictException('Ese cupón ya se usó.');
    return { percent: envio.campaign.couponPercent, sendId: envio.id };
  }

  /** Cancelación a tiempo de un turno que usó el cupón: vuelve a quedar disponible (si no venció). */
  async devolverCuponRecuperar(businessId: string, sendId: string, tx: Db = this.prisma): Promise<void> {
    await tx.appointmentWinbackSend.updateMany({ where: { id: sendId, businessId }, data: { couponUsedAt: null } });
  }
}

const aDto = (c: AppointmentWinbackCampaign, audience: number): CampaniaRecuperarDto => ({
  id: c.id, inactiveDays: c.inactiveDays, message: c.message, couponEnabled: c.couponEnabled, couponPercent: c.couponPercent,
  couponValidDays: c.couponValidDays, mode: c.mode === 'manual' ? 'manual' : 'auto', isActive: c.isActive, sentCount: c.sentCount,
  lastRunAt: c.lastRunAt?.toISOString() ?? null, audience,
});
