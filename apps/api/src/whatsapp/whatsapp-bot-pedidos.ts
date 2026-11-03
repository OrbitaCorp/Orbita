import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { describeError } from '../common/utils/describe-error.util';
import type { ContextoDelBot, ResultadoDeHerramienta } from './whatsapp-bot-tools';

// Orbi toma pedidos por WhatsApp (función que el dueño enciende). El cliente dice qué quiere; Orbi arma un BORRADOR con los
// datos reales de la tienda (precio con descuentos y stock, nunca lo que diga el modelo), se lo muestra con botones para
// confirmar y recién cuando el cliente confirma se crea el pedido: PENDIENTE y con "coordinar por WhatsApp" como medio de
// pago, igual que el checkout de la tienda. Orbi no cobra ni toma datos de pago; el pedido lo cierra una persona.

export const ID_CONFIRMAR = 'pedido-confirmar';
export const ID_CAMBIAR = 'pedido-cambiar';
/** El borrador se vence a los 30 minutos: pasado ese tiempo hay que armarlo de nuevo. */
export const VIGENCIA_BORRADOR_MS = 30 * 60 * 1000;
const MAX_LINEAS = 10;
const MAX_LINEAS_EN_EL_RESUMEN = 8;

export interface LineaBorrador {
  variantId: string;
  nombre: string;
  variante: string | null;
  cantidad: number;
  /** Precio por unidad con los descuentos automáticos de la tienda. */
  precio: number;
}
export interface Borrador {
  lineas: LineaBorrador[];
  subtotal: number;
  descuento: number;
  total: number;
  creadoEn: string;
}
export interface TopesDelPedido {
  maxUnidades: number;
  maxMonto: number;
}

const plata = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

/** El resumen que ve el cliente. Lo arma el sistema (no el modelo): los números son los de la base. */
export function textoDelResumen(b: Borrador): string {
  const lineas = b.lineas.slice(0, MAX_LINEAS_EN_EL_RESUMEN).map((l) => `• ${l.cantidad} × ${l.nombre}${l.variante ? ` (${l.variante})` : ''} — ${plata(l.precio * l.cantidad)}`);
  const resto = b.lineas.length - MAX_LINEAS_EN_EL_RESUMEN;
  return [
    '*Resumen de tu pedido*',
    '',
    ...lineas,
    ...(resto > 0 ? [`…y ${resto} producto${resto === 1 ? '' : 's'} más`] : []),
    '',
    ...(b.descuento > 0 ? [`Subtotal: ${plata(b.subtotal)}`, `Descuento: -${plata(b.descuento)}`] : []),
    `*Total estimado: ${plata(b.total)}*`,
    '',
    'La entrega (retiro o envío) y el pago se coordinan con el equipo por este chat. El monto final te lo confirman ellos.',
    '¿Confirmo el pedido?',
  ].join('\n');
}

/** "sí", "dale", "confirmo"… solos (con un borrador pendiente equivalen a tocar "Confirmar pedido"). */
export function esAfirmativo(t: string): boolean {
  const limpio = t.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¡!¿?.,]/g, '').replace(/\s+/g, ' ');
  return /^(si|dale|ok|okey|oka|confirmo|confirmar|confirmado|listo|perfecto|de una|si confirmo|si dale|si por favor|si quiero)$/.test(limpio);
}

/** "cambiar", "no", "cancelar"… solos (equivalen a tocar "Cambiar"). */
export function esNegativo(t: string): boolean {
  const limpio = t.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¡!¿?.,]/g, '').replace(/\s+/g, ' ');
  return /^(no|cambiar|cambio|modificar|cancelar|cancelo|quiero cambiar|no gracias)$/.test(limpio);
}

export function borradorVigente(crudo: unknown, ahora = Date.now()): Borrador | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const b = crudo as Partial<Borrador>;
  if (!Array.isArray(b.lineas) || b.lineas.length === 0 || typeof b.total !== 'number' || typeof b.creadoEn !== 'string') return null;
  if (ahora - Date.parse(b.creadoEn) > VIGENCIA_BORRADOR_MS) return null;
  return b as Borrador;
}

export type ResultadoDeConfirmar =
  | { ok: true; texto: string; pedido: { id: string; numero: number; total: number } }
  | { ok: false; texto: string; derivar: string };

@Injectable()
export class WhatsappBotPedidosService {
  private readonly logger = new Logger(WhatsappBotPedidosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storefront: StorefrontService,
    private readonly orders: OrdersService,
    private readonly notificaciones: NotificationsService,
  ) {}

  /** ¿Esta tienda puede tomar pedidos por chat? Necesita ventas online y "coordinar por WhatsApp" (o coordinar el pago después). */
  async disponibilidad(businessId: string): Promise<{ ok: boolean; motivo?: string }> {
    const [pago, negocio] = await Promise.all([
      this.prisma.businessConfig.findUnique({ where: { businessId } }),
      this.prisma.business.findFirst({ where: { id: businessId }, select: { mode: true } }),
    ]);
    if (!negocio || negocio.mode !== 'FULL') return { ok: false, motivo: 'Tu tienda está en modo vidriera: no recibe pedidos online, así que Orbi tampoco puede tomarlos.' };
    if (!pago || !(pago.acceptsTransfer || pago.acceptsCoordinateLater)) {
      return { ok: false, motivo: 'Para que Orbi tome pedidos activá "Coordinar por WhatsApp" en Configuración → Pagos: así quedan pendientes hasta que coordines el pago.' };
    }
    return { ok: true };
  }

  /**
   * Herramienta `preparar_pedido`: valida lo que pidió el cliente contra la tienda y deja el borrador guardado en el chat.
   * No crea nada: el pedido recién existe cuando el cliente confirma.
   */
  async preparar(ctx: ContextoDelBot & { conversationId: string }, topes: TopesDelPedido, crudos: unknown): Promise<ResultadoDeHerramienta> {
    const disp = await this.disponibilidad(ctx.businessId);
    if (!disp.ok) return { ok: false, error: 'Esta tienda no toma pedidos por el chat. Pasale el link de la tienda para que compre ahí.' };

    // Se juntan los renglones repetidos y se descartan los inválidos: nada de lo que llega del modelo se da por bueno.
    const porVariante = new Map<string, number>();
    for (const r of Array.isArray(crudos) ? crudos : []) {
      const item = r as { variante_id?: unknown; producto_id?: unknown; cantidad?: unknown };
      const id = [item.variante_id, item.producto_id].find((x): x is string => typeof x === 'string' && /^[0-9a-f-]{8,36}$/i.test(x));
      if (!id) return { ok: false, error: 'Falta el id de la variante: consultá detalle_producto para elegir talle/color y usá ese id.' };
      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 1) return { ok: false, error: 'La cantidad tiene que ser un número entero de 1 en adelante.' };
      porVariante.set(id.toLowerCase(), (porVariante.get(id.toLowerCase()) ?? 0) + cantidad);
    }
    if (porVariante.size === 0) return { ok: false, error: 'Falta saber qué productos quiere el cliente.' };
    if (porVariante.size > MAX_LINEAS) return { ok: false, error: `Un pedido por chat puede tener hasta ${MAX_LINEAS} productos distintos.` };
    const unidades = [...porVariante.values()].reduce((a, b) => a + b, 0);
    if (unidades > topes.maxUnidades) return { ok: false, error: `Por chat se pueden pedir hasta ${topes.maxUnidades} unidades. Para más cantidad, ofrecé que lo vea una persona.` };

    // El modelo a veces manda el id del producto (o su código corto) donde va el de la variante: se corrige si el producto tiene una sola.
    const corregido = await this.variantesReales(ctx.businessId, porVariante);
    if (typeof corregido === 'string') return { ok: false, error: corregido };
    porVariante.clear();
    for (const [id, cantidad] of corregido) porVariante.set(id, cantidad);

    let validado: Awaited<ReturnType<StorefrontService['validateCart']>>;
    try {
      validado = await this.storefront.validateCart(ctx.slug, [...porVariante].map(([variantId, quantity]) => ({ variantId, quantity })), { customerId: ctx.customerId });
    } catch {
      return { ok: false, error: 'No se pudo revisar el stock ahora. Ofrecé que lo vea una persona.' };
    }
    const problemas = validado.items
      .filter((i) => !i.ok)
      .map((i) => `${i.nombre ?? 'Un producto'}${i.variante ? ` (${i.variante})` : ''}: ${i.motivo === 'SIN_STOCK' ? 'sin stock' : i.motivo === 'STOCK_INSUFICIENTE' ? `solo quedan ${i.maxQty}` : 'ya no está disponible'}`);
    if (problemas.length > 0) return { ok: false, error: `No se puede armar el pedido: ${problemas.join('; ')}. Contale al cliente y ofrecele alternativas.` };

    const lineas: LineaBorrador[] = validado.items.map((i) => ({
      variantId: i.variantId, nombre: i.nombre ?? 'Producto', variante: i.variante, cantidad: porVariante.get(i.variantId) ?? 1, precio: Number(i.precio ?? 0),
    }));
    const subtotal = lineas.reduce((a, l) => a + l.precio * l.cantidad, 0);
    const descuento = Math.min(subtotal, validado.ticketDiscount?.monto ?? 0);
    const total = Math.max(0, subtotal - descuento);
    if (total > topes.maxMonto) return { ok: false, error: `El pedido supera el tope de ${plata(topes.maxMonto)} por chat. Ofrecé que lo vea una persona.` };

    const borrador: Borrador = { lineas, subtotal, descuento, total, creadoEn: new Date().toISOString() };
    await this.prisma.conversation.updateMany({ where: { id: ctx.conversationId, businessId: ctx.businessId }, data: { botBorrador: borrador as unknown as Prisma.InputJsonValue } });
    return {
      ok: true,
      datos: {
        listo: true,
        total_estimado: Math.round(total),
        aviso: 'El sistema le va a mostrar el resumen al cliente con los botones para confirmar. NO escribas tu propio resumen ni le preguntes si confirma.',
      },
    };
  }

  /**
   * Cada id del pedido tiene que ser de una variante de ESTE negocio. Si no lo es pero es el id de un producto publicado con una
   * sola variante, se usa esa; si tiene varias, se le dice al modelo que elija. Devuelve los renglones corregidos o el error.
   */
  private async variantesReales(businessId: string, pedidas: Map<string, number>): Promise<Map<string, number> | string> {
    const ids = [...pedidas.keys()];
    const esVariante = new Set(
      (await this.prisma.productVariant.findMany({ where: { id: { in: ids.filter((i) => i.length === 36) }, isActive: true, product: { businessId } }, select: { id: true } })).map((v) => v.id),
    );
    const otros = ids.filter((i) => !esVariante.has(i));
    const productos = otros.length === 0 ? [] : await this.prisma.product.findMany({
      where: { businessId, deletedAt: null, status: 'PUBLISHED', OR: otros.map((i) => (i.length === 36 ? { id: i } : { id: { startsWith: i } })) },
      select: { id: true, name: true, variants: { where: { isActive: true }, select: { id: true } } },
    });
    const resultado = new Map<string, number>();
    for (const [id, cantidad] of pedidas) {
      let real = id;
      if (!esVariante.has(id)) {
        const producto = productos.find((p) => p.id === id || p.id.startsWith(id));
        if (!producto) return 'Ese id no es de una variante ni de un producto de la tienda: buscalo con buscar_productos y detalle_producto, y usá el variante_id.';
        if (producto.variants.length !== 1) return `${producto.name} tiene varias variantes (talle/color): consultá detalle_producto y usá el variante_id de la que eligió el cliente.`;
        real = producto.variants[0].id;
      }
      resultado.set(real, (resultado.get(real) ?? 0) + cantidad);
    }
    return resultado;
  }

  async descartar(businessId: string, conversationId: string): Promise<void> {
    await this.prisma.conversation.updateMany({ where: { id: conversationId, businessId }, data: { botBorrador: Prisma.DbNull } });
  }

  /**
   * El cliente confirmó. Se "reclama" el borrador (así tocar dos veces el botón no crea dos pedidos), se vuelve a validar contra
   * la tienda y se crea el pedido pendiente. Avisa al dueño por el motor de notificaciones.
   */
  async confirmar(p: { businessId: string; conversationId: string; customerId: string; waId: string; slug: string; tienda: string; borrador: unknown }): Promise<ResultadoDeConfirmar> {
    const borrador = borradorVigente(p.borrador);
    if (!borrador) {
      await this.descartar(p.businessId, p.conversationId);
      return { ok: false, texto: 'El resumen venció o ya no está. Contame de nuevo qué querés pedir y lo armamos.', derivar: '' };
    }
    const reclamado = await this.prisma.conversation.updateMany({
      where: { id: p.conversationId, businessId: p.businessId, botBorrador: { not: Prisma.DbNull } },
      data: { botBorrador: Prisma.DbNull },
    });
    if (reclamado.count === 0) return { ok: false, texto: 'Ese pedido ya se confirmó o se canceló.', derivar: '' };

    try {
      const [pago, cliente] = await Promise.all([
        this.prisma.businessConfig.findUnique({ where: { businessId: p.businessId } }),
        this.prisma.customer.findFirst({ where: { id: p.customerId, businessId: p.businessId }, select: { firstName: true, lastName: true, email: true, phone: true } }),
      ]);
      if (!pago || !cliente) throw new Error('faltan datos de la tienda o del cliente');
      const coordinarDespues = pago.acceptsCoordinateLater;
      const metodo = coordinarDespues ? 'COORDINATE_LATER' : 'TRANSFER';
      const descuento = !coordinarDespues && pago.acceptsTransfer && pago.transferDiscountPercent != null ? Number(pago.transferDiscountPercent) : undefined;
      const nombre = `${cliente.firstName}${cliente.lastName ? ` ${cliente.lastName}` : ''}`;
      const creado = await this.orders.create(
        p.businessId,
        {
          channel: 'ONLINE',
          customerId: p.customerId,
          items: borrador.lineas.map((l) => ({ variantId: l.variantId, quantity: l.cantidad })),
          buyer: { name: nombre, phone: cliente.phone ?? p.waId, ...(cliente.email ? { email: cliente.email } : {}) },
          ...(!coordinarDespues ? { paymentMethod: 'TRANSFER' as const } : {}),
          ...(descuento !== undefined ? { manualDiscountPercent: descuento } : {}),
          notes: `Pedido tomado por Orbi por WhatsApp. Método de pago: ${metodo === 'TRANSFER' ? 'Coordinar por WhatsApp' : 'A coordinar con el vendedor'}. Entrega: a coordinar con el equipo (retiro o envío).`,
        },
        { publicCheckout: true, paymentMethodChosen: true, porWhatsapp: true },
      );
      const numero = Number(creado.orderNumber);
      const total = Number(creado.total);
      await this.avisarPedidoPendiente({ businessId: p.businessId, orderId: creado.id, numero, total, cliente: nombre, lineas: borrador.lineas });
      return {
        ok: true,
        pedido: { id: creado.id, numero, total },
        texto: `¡Listo, ${cliente.firstName}! Tu pedido *#${numero}* quedó registrado ✅\n\nTotal: ${plata(total)}\n\nEl equipo de ${p.tienda} te escribe por acá para coordinar el pago y la entrega.`,
      };
    } catch (e) {
      this.logger.warn(`Orbi no pudo crear el pedido del chat ${p.conversationId}: ${describeError(e)}`);
      // Lo que dice la tienda ("no hay stock suficiente…") sirve; un error interno no se le cuenta al cliente.
      const motivo = e instanceof HttpException && e.getStatus() < 500 ? ` ${e.message}` : '';
      return { ok: false, texto: `No pude cargar tu pedido.${motivo} Ya le avisé al equipo para que te ayude.`, derivar: 'Orbi no pudo cargar un pedido que el cliente confirmó: revisalo.' };
    }
  }

  private async avisarPedidoPendiente(p: { businessId: string; orderId: string; numero: number; total: number; cliente: string; lineas: LineaBorrador[] }): Promise<void> {
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const link = `${frontend}/admin/${p.businessId}/ventas/pedidos?vista=detalle&id=${p.orderId}`;
    const detalle = p.lineas.map((l) => `· ${l.cantidad} × ${l.nombre}${l.variante ? ` (${l.variante})` : ''}`).join('\n');
    try {
      await this.notificaciones.dispatch('orbi_pedido_pendiente', p.businessId, {
        title: `Orbi tomó el pedido #${p.numero}`,
        body: `${p.cliente}: ${plata(p.total)}. Falta coordinar el pago y la entrega.`,
        emailSubject: `Orbi tomó un pedido por WhatsApp (#${p.numero}): falta coordinar el pago`,
        emailBody: `Orbi tomó un pedido por WhatsApp. Quedó pendiente: hay que coordinar el pago y la entrega con el cliente.\n\nCliente: ${p.cliente}\nPedido #${p.numero} — total estimado ${plata(p.total)}\n\n${detalle}\n\nVer el pedido: ${link}`,
        resourceType: 'order',
        resourceId: p.orderId,
      });
    } catch (e) {
      this.logger.warn(`No se pudo avisar del pedido pendiente #${p.numero}: ${describeError(e)}`);
    }
  }
}
