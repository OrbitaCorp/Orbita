import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailSendStatus, PlatformMailSender } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { normalizarWhatsapp, type BotonWhatsapp } from '../../mail/correo-directo';
import { CorreoPlataformaService } from '../correo/correo.service';
import { ETAPAS, etapaDe, type Etapa } from './etapas';
import { nombreDePila, PLANTILLAS, rellenar, type VariablesSeguimiento } from './plantillas';
import { BorradorSeguimientoDto, EnviarSeguimientoDto, VistaPreviaSeguimientoDto } from './seguimiento.dto';

const DIA_MS = 24 * 60 * 60 * 1000;
// Un seguimiento por la misma etapa en este tiempo deja a la tienda "al día":
// no vuelve a aparecer como pendiente hasta que cambie de etapa o pase el plazo.
const DIAS_AL_DIA = 30;

type NegocioConDatos = Awaited<ReturnType<SeguimientoService['negocios']>>[number];

// Superadmin → Seguimiento: en qué etapa está cada tienda, a quién le falta un
// correo y el correo en sí (plantilla de la etapa + botón de WhatsApp al
// número de la casilla). El envío pasa por Correo: mismo tope diario y mismo
// historial en Enviados.
@Injectable()
export class SeguimientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly correo: CorreoPlataformaService,
  ) {}

  plantillas() {
    return ETAPAS.map((e) => PLANTILLAS[e]);
  }

  async listar() {
    const ahora = new Date();
    const negocios = await this.negocios();
    const correos = await this.prisma.platformOutboundMail.findMany({
      where: { businessId: { in: negocios.map((n) => n.id) }, followUpStage: { not: null }, status: { not: EmailSendStatus.FAILED } },
      orderBy: { createdAt: 'desc' },
      select: { businessId: true, followUpStage: true, subject: true, createdAt: true, fromName: true },
    });
    const porNegocio = new Map<string, typeof correos>();
    for (const c of correos) {
      const lista = porNegocio.get(c.businessId!) ?? [];
      lista.push(c);
      porNegocio.set(c.businessId!, lista);
    }

    const filas = negocios.map((n) => {
      const etapa = this.etapa(n, ahora);
      const enviados = porNegocio.get(n.id) ?? [];
      const ultimo = enviados[0] ?? null;
      const alDia = enviados.some((c) => c.followUpStage === etapa && ahora.getTime() - c.createdAt.getTime() < DIAS_AL_DIA * DIA_MS);
      const dueno = n.members[0] ?? null;
      return {
        id: n.id,
        name: n.name,
        subdomain: n.subdomain,
        etapa,
        pendiente: !alDia && !!dueno?.email,
        createdAt: n.createdAt.toISOString(),
        publicada: n.isActive,
        productos: n._count.products,
        pedidos: n._count.orders,
        owner: dueno ? { name: dueno.name, email: dueno.email, lastAccessAt: dueno.lastAccessAt?.toISOString() ?? null } : null,
        suscripcion: n.subscription ? { status: n.subscription.status, currentPeriodEnd: n.subscription.currentPeriodEnd.toISOString() } : null,
        ultimoSeguimiento: ultimo
          ? { etapa: ultimo.followUpStage, asunto: ultimo.subject, enviadoPor: ultimo.fromName, fecha: ultimo.createdAt.toISOString(), cantidad: enviados.length }
          : null,
      };
    });
    // Primero lo pendiente, y adentro en el orden de las etapas (lo urgente arriba).
    const orden = (e: Etapa) => ETAPAS.indexOf(e);
    return filas.sort((a, b) => Number(b.pendiente) - Number(a.pendiente) || orden(a.etapa) - orden(b.etapa) || b.createdAt.localeCompare(a.createdAt));
  }

  // El correo listo para editar: la plantilla de la etapa con los datos del
  // negocio. La etapa la elige el panel (por defecto, la actual), así se puede
  // mandar otra a propósito.
  async borrador(dto: BorradorSeguimientoDto) {
    const { negocio, casilla } = await this.contexto(dto.businessId, dto.senderId);
    const p = PLANTILLAS[dto.etapa];
    const v = this.variables(negocio, casilla);
    const whatsapp = this.boton(casilla, dto.etapa, v);
    return {
      to: negocio.members[0]?.email ?? null,
      subject: rellenar(p.asunto, v),
      body: rellenar(p.cuerpo, v),
      whatsapp: whatsapp ? { numero: whatsapp.numero, texto: whatsapp.texto, mensaje: whatsapp.mensaje } : null,
    };
  }

  async vistaPrevia(dto: VistaPreviaSeguimientoDto) {
    const { negocio, casilla } = await this.contexto(dto.businessId, dto.senderId);
    const whatsapp = this.boton(casilla, dto.etapa, this.variables(negocio, casilla)) ?? undefined;
    return { html: this.mail.directoHtml(dto.body, this.correo.firma(casilla), whatsapp) };
  }

  async enviar(adminId: string, dto: EnviarSeguimientoDto) {
    const { negocio, casilla } = await this.contexto(dto.businessId, dto.senderId);
    const to = negocio.members[0]?.email;
    if (!to) throw new BadRequestException('Este negocio no tiene un dueño con email: no hay a quién escribirle');
    const whatsapp = this.boton(casilla, dto.etapa, this.variables(negocio, casilla));
    if (!whatsapp) {
      throw new BadRequestException(`La casilla ${casilla.email} no tiene un número de WhatsApp ni un teléfono con código de país: cargalo en Correo → Casillas para que el correo lleve el botón`);
    }
    return this.correo.enviarDesde(adminId, casilla, {
      to, subject: dto.subject, body: dto.body, whatsapp, businessId: negocio.id, followUpStage: dto.etapa,
    });
  }

  // ── Datos ─────────────────────────────────────────────────────────────────

  private negocios(where: { id?: string } = {}) {
    return this.prisma.business.findMany({
      // La demo pública no es un cliente; un borrado definitivo, tampoco.
      where: { ...where, isDemo: false, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, subdomain: true, createdAt: true, isActive: true, isPaused: true, cancelledAt: true,
        subscription: { select: { status: true, currentPeriodEnd: true, mpPreapprovalId: true } },
        members: { where: { role: { name: 'owner' } }, select: { name: true, email: true, lastAccessAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        _count: { select: { products: { where: { deletedAt: null } }, orders: { where: { deletedAt: null } } } },
      },
    });
  }

  private etapa(n: NegocioConDatos, ahora: Date): Etapa {
    return etapaDe(
      {
        creadoEl: n.createdAt,
        publicada: n.isActive,
        pausada: n.isPaused,
        dadaDeBaja: !!n.cancelledAt,
        productos: n._count.products,
        pedidos: n._count.orders,
        ultimoAccesoDueno: n.members[0]?.lastAccessAt ?? null,
        suscripcion: n.subscription
          ? { status: n.subscription.status, currentPeriodEnd: n.subscription.currentPeriodEnd, renuevaSolo: !!n.subscription.mpPreapprovalId }
          : null,
      },
      ahora,
    );
  }

  private async contexto(businessId: string, senderId: string) {
    const [negocio] = await this.negocios({ id: businessId });
    if (!negocio) throw new NotFoundException('Negocio no encontrado');
    const casilla = await this.correo.casilla(senderId);
    return { negocio, casilla };
  }

  private variables(n: NegocioConDatos, casilla: PlatformMailSender): VariablesSeguimiento {
    const vence = n.subscription?.currentPeriodEnd;
    return {
      // Sin nombre del dueño, el saludo va al negocio ("Hola Kiosco Sol:").
      nombre: nombreDePila(n.members[0]?.name) || n.name,
      negocio: n.name,
      tienda: `https://${n.subdomain}.orbita.site`,
      remitente: nombreDePila(casilla.name) || casilla.name,
      vence: vence ? vence.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }) : 'fin de mes',
    };
  }

  private boton(casilla: PlatformMailSender, etapa: Etapa, v: VariablesSeguimiento): BotonWhatsapp | null {
    // Sin WhatsApp propio, el teléfono de la firma (si tiene código de país):
    // casi siempre es el mismo número y es el campo que se completa primero.
    const numero = normalizarWhatsapp(casilla.whatsapp) ?? normalizarWhatsapp(casilla.phone);
    if (!numero) return null;
    const p = PLANTILLAS[etapa];
    return { numero, texto: p.botonWhatsapp, mensaje: rellenar(p.mensajeWhatsapp, v) };
  }
}
