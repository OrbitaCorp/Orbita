import { Injectable, Logger } from '@nestjs/common';
import { Reserva, ReservaModulo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { escaparHtml } from '../common/utils/html';
import { fmtPesos } from '../common/utils/pesos';
import { describeError } from '../common/utils/describe-error.util';
import { fechaYMinutos, hhmm } from './dominio/tiempo';

// Los avisos por email de una reserva: confirmada, pendiente, cancelada,
// reprogramada, y el lugar que se liberó para alguien de la lista de espera.
// Nunca tiran: un mail que no sale se registra y la reserva sigue. Sin email
// del cliente no hay nada que mandar (el teléfono queda para WhatsApp manual
// desde el panel).
//
// El enlace personal lleva al sitio del negocio, a la ruta de "mi reserva" de
// su módulo. Esa ruta la sirve el frontend de cada módulo (ver README.md).
export const RUTA_MI_RESERVA: Record<ReservaModulo, string> = {
  TURNOS: '/mi-turno',
  ALQUILERES: '/mi-reserva',
  GIMNASIO: '/mi-clase',
};

const QUE: Record<ReservaModulo, string> = { TURNOS: 'turno', ALQUILERES: 'reserva', GIMNASIO: 'lugar' };

const fechaLarga = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long' });

interface Negocio { id: string; name: string; subdomain: string }

@Injectable()
export class ReservasAvisosService {
  private readonly logger = new Logger(ReservasAvisosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  urlMiReserva(negocio: Negocio, modulo: ReservaModulo, token: string): string {
    return `https://${negocio.subdomain}.orbita.site${RUTA_MI_RESERVA[modulo]}/${token}`;
  }

  /** "lunes 10 de noviembre de 09:30 a 10:00" */
  static cuando(r: Pick<Reserva, 'inicio' | 'fin'>): string {
    const dia = fechaLarga.format(r.inicio);
    const ini = fechaYMinutos(r.inicio).minutos;
    const fin = ini + Math.round((r.fin.getTime() - r.inicio.getTime()) / 60_000);
    // Más de un día (un alojamiento): se dice por días.
    if (fin - ini >= 24 * 60) return `del ${dia} al ${fechaLarga.format(r.fin)}`;
    return `${dia} de ${hhmm(ini)} a ${hhmm(fin)}`;
  }

  private async negocio(businessId: string): Promise<Negocio | null> {
    return this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, subdomain: true } });
  }

  private queEs(r: Reserva, recursoNombre: string): string {
    const servicio = r.servicio && typeof r.servicio === 'object' ? (r.servicio as { nombre?: string }).nombre : undefined;
    return servicio ? `${servicio} con ${recursoNombre}` : recursoNombre;
  }

  private async mandar(r: Reserva, asunto: (n: Negocio) => string, cuerpo: (n: Negocio, link: string) => string): Promise<void> {
    if (!r.clienteEmail) return;
    try {
      const negocio = await this.negocio(r.businessId);
      if (!negocio) return;
      const link = this.urlMiReserva(negocio, r.modulo, r.tokenAcceso);
      await this.mail.sendCustomEmail(r.clienteEmail, asunto(negocio), cuerpo(negocio, link), { businessId: r.businessId, customerId: r.clienteId ?? undefined });
    } catch (e) {
      this.logger.error(`No se pudo avisar por email la reserva ${r.id}: ${describeError(e)}`);
    }
  }

  private pie(link: string, codigo: string): string {
    return `<p>Tu código es <strong>${escaparHtml(codigo)}</strong>.</p>` +
      `<p><a href="${escaparHtml(link)}">Ver, cancelar o reprogramar</a></p>`;
  }

  async confirmada(r: Reserva, recursoNombre: string): Promise<void> {
    const que = QUE[r.modulo];
    await this.mandar(r,
      (n) => `Tu ${que} en ${n.name} está confirmado`,
      (n, link) =>
        `<p>Hola ${escaparHtml(r.clienteNombre)}, te esperamos en <strong>${escaparHtml(n.name)}</strong>.</p>` +
        `<p><strong>${escaparHtml(this.queEs(r, recursoNombre))}</strong><br>${escaparHtml(ReservasAvisosService.cuando(r))}</p>` +
        (Number(r.precio) > 0 ? `<p>Total: ${fmtPesos(Number(r.precio))}${Number(r.sena) > 0 ? ` · Seña: ${fmtPesos(Number(r.sena))}` : ''}</p>` : '') +
        this.pie(link, r.codigo),
    );
  }

  async pendiente(r: Reserva, recursoNombre: string): Promise<void> {
    await this.mandar(r,
      (n) => `Recibimos tu pedido en ${n.name}`,
      (n, link) =>
        `<p>Hola ${escaparHtml(r.clienteNombre)}, <strong>${escaparHtml(n.name)}</strong> tiene que confirmar tu ${QUE[r.modulo]}. Te avisamos por acá.</p>` +
        `<p><strong>${escaparHtml(this.queEs(r, recursoNombre))}</strong><br>${escaparHtml(ReservasAvisosService.cuando(r))}</p>` +
        this.pie(link, r.codigo),
    );
  }

  async cancelada(r: Reserva, recursoNombre: string, sena: 'DEVUELTA' | 'PERDIDA' | 'SIN_SENA'): Promise<void> {
    const porElNegocio = r.canceladaPor === 'NEGOCIO';
    await this.mandar(r,
      (n) => `Tu ${QUE[r.modulo]} en ${n.name} fue cancelado`,
      (n) =>
        `<p>Hola ${escaparHtml(r.clienteNombre)}, ${porElNegocio ? `<strong>${escaparHtml(n.name)}</strong> canceló` : 'cancelaste'} tu ${QUE[r.modulo]}: ` +
        `<strong>${escaparHtml(this.queEs(r, recursoNombre))}</strong>, ${escaparHtml(ReservasAvisosService.cuando(r))}.</p>` +
        (r.motivoCancelacion ? `<p>${escaparHtml(r.motivoCancelacion)}</p>` : '') +
        (sena === 'DEVUELTA' ? `<p>Lo que pagaste (${fmtPesos(Number(r.pagado))}) se te devuelve: el negocio se comunica con vos para hacerlo.</p>` : '') +
        (sena === 'PERDIDA' ? `<p>Por las reglas del negocio, la seña no se devuelve.</p>` : ''),
    );
  }

  async reprogramada(r: Reserva, recursoNombre: string, antes: { inicio: Date; fin: Date }): Promise<void> {
    await this.mandar(r,
      (n) => `Tu ${QUE[r.modulo]} en ${n.name} cambió de horario`,
      (n, link) =>
        `<p>Hola ${escaparHtml(r.clienteNombre)}, tu ${QUE[r.modulo]} en <strong>${escaparHtml(n.name)}</strong> pasó de ` +
        `${escaparHtml(ReservasAvisosService.cuando(antes))} a <strong>${escaparHtml(ReservasAvisosService.cuando(r))}</strong>.</p>` +
        `<p>${escaparHtml(this.queEs(r, recursoNombre))}</p>` +
        this.pie(link, r.codigo),
    );
  }

  /** Alguien de la lista de espera tomó el lugar que se liberó. */
  async lugarTomado(r: Reserva, recursoNombre: string): Promise<void> {
    await this.mandar(r,
      (n) => `Se liberó un lugar en ${n.name}: es tuyo`,
      (n, link) =>
        `<p>Hola ${escaparHtml(r.clienteNombre)}, estabas en la lista de espera y se liberó un lugar: ya es tuyo.</p>` +
        `<p><strong>${escaparHtml(this.queEs(r, recursoNombre))}</strong><br>${escaparHtml(ReservasAvisosService.cuando(r))} en ${escaparHtml(n.name)}</p>` +
        `<p>Si no podés ir, cancelalo para que pase al siguiente.</p>` +
        this.pie(link, r.codigo),
    );
  }
}
