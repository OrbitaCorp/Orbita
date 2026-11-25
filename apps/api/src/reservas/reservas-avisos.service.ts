import { Injectable, Logger } from '@nestjs/common';
import { Reserva, ReservaModulo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { escaparHtml } from '../common/utils/html';
import { fmtPesos } from '../common/utils/pesos';
import { describeError } from '../common/utils/describe-error.util';
import { cuandoEs } from './dominio/tiempo';

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
/** "confirmado" o "confirmada", según lo que se reservó: "tu reserva está confirmada", "tu turno está confirmado". */
const FEMENINO: Record<ReservaModulo, boolean> = { TURNOS: false, ALQUILERES: true, GIMNASIO: false };
const concordar = (modulo: ReservaModulo, masculino: string) => (FEMENINO[modulo] ? `${masculino.slice(0, -1)}a` : masculino);

/**
 * Subrubros de Turnos en los que el email no dice qué servicio es: tener turno
 * ya dice algo de la persona (alcance de Turnos en salud, decisión del 15/11:
 * en psicología, ni el nombre del servicio). Va el profesional, el día y el lugar.
 */
const SERVICIO_RESERVADO: ReadonlySet<string> = new Set(['psico']);

interface Negocio {
  id: string; name: string; subdomain: string; industry: string; subrubros: string[];
  /** De la config del módulo de la reserva: si la seña se devuelve al cancelar a tiempo y hasta cuántas horas antes. */
  config: { senaReembolsable: boolean; cancelacionHastaHoras: number } | null
}

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
    return cuandoEs(r);
  }

  private async negocio(r: Pick<Reserva, 'businessId' | 'modulo'>): Promise<Negocio | null> {
    const [b, config] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: r.businessId }, select: { id: true, name: true, subdomain: true, industry: true, subrubros: true } }),
      this.prisma.reservaConfig.findUnique({ where: { businessId_modulo: { businessId: r.businessId, modulo: r.modulo } }, select: { senaReembolsable: true, cancelacionHastaHoras: true } }),
    ]);
    return b ? { ...b, subrubros: b.subrubros ?? [], config } : null;
  }

  /** Qué se reservó: el servicio con quién atiende, o solo quién atiende donde el servicio no se nombra. */
  private queEs(r: Reserva, recursoNombre: string, n: Negocio): string {
    const servicio = r.servicio && typeof r.servicio === 'object' ? (r.servicio as { nombre?: string }).nombre : undefined;
    const reservado = r.modulo === 'TURNOS' && n.subrubros.some((s) => SERVICIO_RESERVADO.has(s));
    if (reservado) return recursoNombre ? `Turno con ${recursoNombre}` : 'Tu turno';
    return servicio ? `${servicio} con ${recursoNombre}` : recursoNombre;
  }

  /** El total y la seña: si ya se pagó o falta, y si se devuelve al cancelar a tiempo (lo que dice la config). */
  private plata(r: Reserva, n: Negocio): string {
    const total = Number(r.precio);
    const sena = Number(r.sena);
    if (total <= 0) return '';
    if (sena <= 0) return `<p>Total: ${fmtPesos(total)}</p>`;
    const pagada = Number(r.pagado) >= sena;
    const devolucion = !n.config ? ''
      : !n.config.senaReembolsable ? ' La seña no se devuelve si cancelás.'
        : n.config.cancelacionHastaHoras > 0 ? ` Si cancelás hasta ${n.config.cancelacionHastaHoras} ${n.config.cancelacionHastaHoras === 1 ? 'hora' : 'horas'} antes, la seña se devuelve.`
          : ' Si cancelás, la seña se devuelve.';
    return `<p>Total: ${fmtPesos(total)} · Seña: ${fmtPesos(sena)} (${pagada ? 'pagada' : 'a pagar: la coordinás con el negocio'}).${devolucion}</p>`;
  }

  private async mandar(r: Reserva, asunto: (n: Negocio) => string, cuerpo: (n: Negocio, link: string) => string): Promise<void> {
    if (!r.clienteEmail) return;
    try {
      const negocio = await this.negocio(r);
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
      (n) => `Tu ${que} en ${n.name} está ${concordar(r.modulo, 'confirmado')}`,
      (n, link) =>
        `<p>Hola ${escaparHtml(r.clienteNombre)}, te esperamos en <strong>${escaparHtml(n.name)}</strong>.</p>` +
        `<p><strong>${escaparHtml(this.queEs(r, recursoNombre, n))}</strong><br>${escaparHtml(ReservasAvisosService.cuando(r))}</p>` +
        this.plata(r, n) +
        this.pie(link, r.codigo),
    );
  }

  async pendiente(r: Reserva, recursoNombre: string): Promise<void> {
    await this.mandar(r,
      (n) => `Recibimos tu pedido en ${n.name}`,
      (n, link) =>
        `<p>Hola ${escaparHtml(r.clienteNombre)}, <strong>${escaparHtml(n.name)}</strong> tiene que confirmar tu ${QUE[r.modulo]}. Te avisamos por acá.</p>` +
        `<p><strong>${escaparHtml(this.queEs(r, recursoNombre, n))}</strong><br>${escaparHtml(ReservasAvisosService.cuando(r))}</p>` +
        this.plata(r, n) +
        this.pie(link, r.codigo),
    );
  }

  async cancelada(r: Reserva, recursoNombre: string, sena: 'DEVUELTA' | 'PERDIDA' | 'SIN_SENA'): Promise<void> {
    const porElNegocio = r.canceladaPor === 'NEGOCIO';
    await this.mandar(r,
      (n) => `Tu ${QUE[r.modulo]} en ${n.name} fue ${concordar(r.modulo, 'cancelado')}`,
      (n) =>
        `<p>Hola ${escaparHtml(r.clienteNombre)}, ${porElNegocio ? `<strong>${escaparHtml(n.name)}</strong> canceló` : 'cancelaste'} tu ${QUE[r.modulo]}: ` +
        `<strong>${escaparHtml(this.queEs(r, recursoNombre, n))}</strong>, ${escaparHtml(ReservasAvisosService.cuando(r))}.</p>` +
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
        `<p>${escaparHtml(this.queEs(r, recursoNombre, n))}</p>` +
        this.pie(link, r.codigo),
    );
  }

  /** Alguien de la lista de espera tomó el lugar que se liberó. */
  async lugarTomado(r: Reserva, recursoNombre: string): Promise<void> {
    await this.mandar(r,
      (n) => `Se liberó un lugar en ${n.name}: es tuyo`,
      (n, link) =>
        `<p>Hola ${escaparHtml(r.clienteNombre)}, estabas en la lista de espera y se liberó un lugar: ya es tuyo.</p>` +
        `<p><strong>${escaparHtml(this.queEs(r, recursoNombre, n))}</strong><br>${escaparHtml(ReservasAvisosService.cuando(r))} en ${escaparHtml(n.name)}</p>` +
        `<p>Si no podés ir, cancelalo para que pase al siguiente.</p>` +
        this.pie(link, r.codigo),
    );
  }
}
