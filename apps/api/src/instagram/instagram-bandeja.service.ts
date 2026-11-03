import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InstagramMediosService } from './instagram-medios.service';
import { InstagramService } from './instagram.service';

// Bandeja de mensajes directos de Instagram del módulo Difusión.
//
// Las charlas de Instagram viven en las mismas tablas que el resto de los mensajes (Conversation / Message):
// una charla de Instagram es la de un cliente que tiene `instagramId`. Acá se listan solo esas, con la forma
// que necesita una pantalla estilo Instagram (fotos incluidas), y se responde con texto o con una foto.
// Instagram solo deja contestar dentro de las 24 horas del último mensaje del cliente: la bandeja avisa hasta
// cuándo y el envío se rechaza pasado ese plazo (lo valida InstagramService).

const VENTANA_MS = 24 * 60 * 60 * 1000;
const MAX_CHARLAS = 100;
const MAX_MENSAJES = 200;

/** Instagram no manda texto con una foto: el texto de un mensaje solo con adjunto es una etiqueta entre corchetes. */
const ETIQUETA = /^\[[^\]]+\]$/;

export interface AdjuntoVista {
  tipo: 'image' | 'video' | 'audio' | 'file';
  url: string;
}

export interface CharlaVista {
  id: string;
  nombre: string;
  /** Lo último que se dijo, ya resumido para la lista. */
  ultimo: string;
  /** Quién lo dijo: 'cliente' o 'negocio' (null si la charla está vacía). */
  ultimoDe: 'cliente' | 'negocio' | null;
  fecha: string;
  noLeida: boolean;
  /** Hasta cuándo se puede contestar (24 h desde el último mensaje del cliente), o null si ya venció. */
  puedeResponderHasta: string | null;
}

export interface FichaDelCliente {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  desde: string;
  pedidos: {
    cantidad: number;
    total: number;
    ultimos: { id: string; numero: number; estado: string; total: number; fecha: string }[];
  };
}

export interface MensajeVista {
  id: string;
  de: 'cliente' | 'negocio';
  texto: string;
  adjuntos: AdjuntoVista[];
  /** 'sent' / 'failed'… cuando se sabe; null en los que mandó el cliente. */
  estado: string | null;
  creado: string;
}

const adjuntosDe = (valor: Prisma.JsonValue | null | undefined): AdjuntoVista[] => {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((a) => {
    const x = a as { tipo?: string; url?: string } | null;
    if (!x?.url || (x.tipo !== 'image' && x.tipo !== 'video' && x.tipo !== 'audio' && x.tipo !== 'file')) return [];
    return [{ tipo: x.tipo, url: x.url }];
  });
};

const ROTULO: Record<AdjuntoVista['tipo'], string> = { image: 'Foto', video: 'Video', audio: 'Audio', file: 'Archivo' };

/** El texto que se ve en la burbuja: sin la etiqueta "[Imagen]" cuando hay un adjunto que la reemplaza. */
const textoVisible = (texto: string, adjuntos: AdjuntoVista[]): string => (adjuntos.length > 0 && ETIQUETA.test(texto) ? '' : texto);

@Injectable()
export class InstagramBandejaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly instagram: InstagramService,
    private readonly medios: InstagramMediosService,
  ) {}

  /** Las charlas de Instagram del negocio, la más reciente primero. */
  async listar(businessId: string): Promise<CharlaVista[]> {
    const filas = await this.prisma.conversation.findMany({
      where: { businessId, isArchived: false, messages: { some: { channel: 'INSTAGRAM' } }, customer: { instagramId: { not: null }, deletedAt: null } },
      orderBy: { updatedAt: 'desc' },
      take: MAX_CHARLAS,
      select: {
        id: true,
        isUnread: true,
        updatedAt: true,
        customer: { select: { firstName: true, lastName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { sender: true, text: true, attachments: true, createdAt: true } },
      },
    });
    if (filas.length === 0) return [];

    // Último mensaje de CADA cliente: de ahí sale hasta cuándo se le puede contestar.
    const ultimosDelCliente = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: { conversationId: { in: filas.map((f) => f.id) }, channel: 'INSTAGRAM', sender: 'CUSTOMER' },
      _max: { createdAt: true },
    });
    const ventana = new Map(ultimosDelCliente.map((u) => [u.conversationId, u._max.createdAt]));

    return filas.map((f) => {
      const m = f.messages[0];
      const adjuntos = adjuntosDe(m?.attachments);
      const texto = m ? textoVisible(m.text, adjuntos) : '';
      return {
        id: f.id,
        nombre: `${f.customer.firstName}${f.customer.lastName ? ` ${f.customer.lastName}` : ''}`,
        ultimo: m ? (texto || (adjuntos[0] ? ROTULO[adjuntos[0].tipo] : '')) : '',
        ultimoDe: m ? (m.sender === 'CUSTOMER' ? 'cliente' : 'negocio') : null,
        fecha: (m?.createdAt ?? f.updatedAt).toISOString(),
        noLeida: f.isUnread,
        puedeResponderHasta: this.hastaCuando(ventana.get(f.id)),
      };
    });
  }

  async noLeidas(businessId: string): Promise<{ count: number }> {
    const count = await this.prisma.conversation.count({
      where: { businessId, isUnread: true, isArchived: false, messages: { some: { channel: 'INSTAGRAM' } }, customer: { instagramId: { not: null }, deletedAt: null } },
    });
    return { count };
  }

  /** Los mensajes de una charla (y la marca como leída). */
  async mensajes(businessId: string, conversationId: string): Promise<{ mensajes: MensajeVista[]; puedeResponderHasta: string | null }> {
    const conv = await this.charla(businessId, conversationId);
    const filas = await this.prisma.message.findMany({
      where: { conversationId, channel: 'INSTAGRAM' },
      orderBy: { createdAt: 'desc' },
      take: MAX_MENSAJES,
      select: { id: true, sender: true, text: true, attachments: true, deliveryStatus: true, createdAt: true },
    });
    if (conv.isUnread) {
      // Raw UPDATE a propósito (igual que en Mensajes): update() de Prisma toca updatedAt y abrir una charla
      // para leerla la subiría al tope de la lista.
      await this.prisma.$executeRaw`UPDATE "conversations" SET "is_unread" = false WHERE "id" = ${conversationId} AND "business_id" = ${businessId}`;
    }
    const ultimoDelCliente = filas.find((f) => f.sender === 'CUSTOMER');
    return {
      mensajes: filas.reverse().map((f) => this.aVista(f)),
      puedeResponderHasta: this.hastaCuando(ultimoDelCliente?.createdAt),
    };
  }

  /**
   * Responde con texto, con una foto o con las dos cosas (salen como dos mensajes, igual que en Instagram).
   * Primero se manda y recién después se guarda: si Instagram lo rechaza (plazo vencido) no queda en la charla
   * un mensaje que el cliente nunca recibió.
   */
  async responder(businessId: string, conversationId: string, texto: string | undefined, foto: Express.Multer.File | undefined): Promise<MensajeVista[]> {
    const limpio = texto?.trim() ?? '';
    if (!limpio && !foto) throw new BadRequestException('Escribí un mensaje o elegí una foto.');
    const conv = await this.charla(businessId, conversationId);
    const igsid = conv.customer.instagramId as string;

    const creados: MensajeVista[] = [];
    if (foto) {
      // La foto se prepara antes de mandar nada: si es inválida no sale tampoco el texto.
      const url = await this.medios.subirFotoDeMensaje(businessId, foto);
      const externalId = await this.instagram.enviarImagen(businessId, conversationId, igsid, url);
      const m = await this.prisma.message.create({
        data: {
          conversationId, sender: 'STORE', text: '[Imagen]', channel: 'INSTAGRAM', externalId, deliveryStatus: 'sent',
          attachments: [{ tipo: 'image', url }],
        },
        select: { id: true, sender: true, text: true, attachments: true, deliveryStatus: true, createdAt: true },
      });
      creados.push(this.aVista(m));
    }
    if (limpio) {
      const externalId = await this.instagram.enviarTexto(businessId, conversationId, igsid, limpio);
      const m = await this.prisma.message.create({
        data: { conversationId, sender: 'STORE', text: limpio, channel: 'INSTAGRAM', externalId, deliveryStatus: 'sent' },
        select: { id: true, sender: true, text: true, attachments: true, deliveryStatus: true, createdAt: true },
      });
      creados.push(this.aVista(m));
    }
    // El staff acaba de contestar: la charla queda al día y sube al tope de la lista.
    await this.prisma.conversation.updateMany({ where: { id: conversationId, businessId }, data: { isUnread: false, updatedAt: new Date() } });
    return creados;
  }

  /** Marcar la charla como sin leer (para volver a ella después) o como leída. */
  async marcarLeida(businessId: string, conversationId: string, leida: boolean): Promise<{ ok: true }> {
    const r = await this.prisma.conversation.updateMany({
      where: { id: conversationId, businessId, messages: { some: { channel: 'INSTAGRAM' } }, customer: { instagramId: { not: null } } },
      data: { isUnread: !leida },
    });
    if (r.count === 0) throw new NotFoundException('Conversación no encontrada');
    return { ok: true };
  }

  /**
   * Manda la ficha de un producto: su foto y, en otro mensaje, el nombre, el precio y el enlace corto a la tienda
   * (en los mensajes directos los enlaces sí se pueden tocar). Si el producto no tiene foto, sale solo el texto.
   */
  async enviarProducto(businessId: string, conversationId: string, productId: string): Promise<MensajeVista[]> {
    const conv = await this.charla(businessId, conversationId);
    const igsid = conv.customer.instagramId as string;
    const producto = await this.prisma.product.findFirst({
      where: { id: productId, businessId, status: 'PUBLISHED' },
      select: {
        id: true, name: true, basePrice: true,
        business: { select: { subdomain: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }], take: 1, select: { url: true } },
      },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const precio = Number(producto.basePrice) > 0 ? `\n$${Number(producto.basePrice).toLocaleString('es-AR')}` : '';
    const texto = `${producto.name}${precio}\nhttps://${producto.business.subdomain}.orbita.site/p/${producto.id.slice(0, 8)}`;

    const creados: MensajeVista[] = [];
    const foto = producto.images[0]?.url;
    if (foto) {
      const url = await this.medios.fotoDeProductoParaMensaje(businessId, foto);
      const externalId = await this.instagram.enviarImagen(businessId, conversationId, igsid, url);
      creados.push(await this.guardarSaliente(conversationId, { text: '[Imagen]', externalId, attachments: [{ tipo: 'image', url }] }));
    }
    const externalId = await this.instagram.enviarTexto(businessId, conversationId, igsid, texto);
    creados.push(await this.guardarSaliente(conversationId, { text: texto, externalId }));
    await this.prisma.conversation.updateMany({ where: { id: conversationId, businessId }, data: { isUnread: false, updatedAt: new Date() } });
    return creados;
  }

  /** Lo que se sabe de la persona de una charla: sus datos y sus pedidos, para pasar de la charla a la venta. */
  async cliente(businessId: string, conversationId: string): Promise<FichaDelCliente> {
    const conv = await this.charla(businessId, conversationId);
    const c = await this.prisma.customer.findFirst({
      where: { id: conv.customerId, businessId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true },
    });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    const pedidosDelCliente = { businessId, customerId: c.id, status: { not: 'CANCELLED' as const } };
    const [resumen, ultimos] = await Promise.all([
      this.prisma.order.aggregate({ where: pedidosDelCliente, _count: { _all: true }, _sum: { total: true } }),
      this.prisma.order.findMany({
        where: { businessId, customerId: c.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
      }),
    ]);
    return {
      id: c.id,
      nombre: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}`,
      email: c.email,
      telefono: c.phone,
      desde: c.createdAt.toISOString(),
      pedidos: {
        cantidad: resumen._count._all,
        total: Number(resumen._sum.total ?? 0),
        ultimos: ultimos.map((o) => ({ id: o.id, numero: o.orderNumber, estado: o.status, total: Number(o.total), fecha: o.createdAt.toISOString() })),
      },
    };
  }

  /**
   * Une la persona de Instagram con un cliente que el negocio ya tenía (el que compró en la tienda, por ejemplo):
   * el cliente existente pasa a tener su cuenta de Instagram, la charla se suma a la suya y el cliente "Instagram
   * 1234" que se había creado solo se da de baja. Los pedidos que tuviera ese cliente pasan al existente.
   */
  async vincular(businessId: string, conversationId: string, clienteId: string): Promise<{ conversationId: string }> {
    const conv = await this.charla(businessId, conversationId);
    const igsid = conv.customer.instagramId as string;
    if (clienteId === conv.customerId) throw new BadRequestException('Elegí un cliente distinto.');
    const destino = await this.prisma.customer.findFirst({ where: { id: clienteId, businessId, deletedAt: null }, select: { id: true, instagramId: true } });
    if (!destino) throw new NotFoundException('Cliente no encontrado');
    if (destino.instagramId) throw new ConflictException('Ese cliente ya tiene otra cuenta de Instagram vinculada.');

    const charlaDestino = await this.prisma.conversation.findFirst({ where: { businessId, customerId: destino.id }, select: { id: true } });
    const final = await this.prisma.$transaction(async (tx) => {
      // Primero se libera el id de Instagram (es único por negocio) y se da de baja el cliente automático.
      await tx.customer.updateMany({ where: { id: conv.customerId, businessId }, data: { instagramId: null, deletedAt: new Date() } });
      await tx.order.updateMany({ where: { businessId, customerId: conv.customerId }, data: { customerId: destino.id } });
      await tx.customer.updateMany({ where: { id: destino.id, businessId }, data: { instagramId: igsid } });
      if (charlaDestino) {
        await tx.message.updateMany({ where: { conversationId: conv.id }, data: { conversationId: charlaDestino.id } });
        await tx.conversation.deleteMany({ where: { id: conv.id, businessId } });
        await tx.conversation.updateMany({ where: { id: charlaDestino.id, businessId }, data: { isUnread: conv.isUnread, updatedAt: new Date() } });
        return charlaDestino.id;
      }
      await tx.conversation.updateMany({ where: { id: conv.id, businessId }, data: { customerId: destino.id } });
      return conv.id;
    });
    return { conversationId: final };
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  private async guardarSaliente(
    conversationId: string,
    d: { text: string; externalId: string; attachments?: { tipo: string; url: string }[] },
  ): Promise<MensajeVista> {
    const m = await this.prisma.message.create({
      data: {
        conversationId, sender: 'STORE', text: d.text, channel: 'INSTAGRAM', externalId: d.externalId, deliveryStatus: 'sent',
        ...(d.attachments ? { attachments: d.attachments } : {}),
      },
      select: { id: true, sender: true, text: true, attachments: true, deliveryStatus: true, createdAt: true },
    });
    return this.aVista(m);
  }

  private async charla(businessId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId, messages: { some: { channel: 'INSTAGRAM' } }, customer: { instagramId: { not: null } } },
      select: { id: true, isUnread: true, customerId: true, customer: { select: { instagramId: true } } },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv;
  }

  private hastaCuando(ultimoDelCliente: Date | null | undefined): string | null {
    if (!ultimoDelCliente) return null;
    const vence = ultimoDelCliente.getTime() + VENTANA_MS;
    return vence > Date.now() ? new Date(vence).toISOString() : null;
  }

  private aVista(f: { id: string; sender: 'CUSTOMER' | 'STORE'; text: string; attachments: Prisma.JsonValue | null; deliveryStatus: string | null; createdAt: Date }): MensajeVista {
    const adjuntos = adjuntosDe(f.attachments);
    return {
      id: f.id,
      de: f.sender === 'CUSTOMER' ? 'cliente' : 'negocio',
      texto: textoVisible(f.text, adjuntos),
      adjuntos,
      estado: f.sender === 'STORE' ? f.deliveryStatus : null,
      creado: f.createdAt.toISOString(),
    };
  }
}
