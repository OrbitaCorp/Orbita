import type { LlmToolDefinition } from '../orbi/llm/llm-adapter.interface';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorefrontService } from '../storefront/storefront.service';

// Las herramientas de Orbi cuando atiende al público por WhatsApp. TODAS son de solo lectura y devuelven lo mismo que ve un
// comprador en la tienda (el catálogo sale del mismo servicio que la tienda pública: precios con descuento y stock real,
// nunca costos) más los pedidos de la propia persona. Nada de acá escribe.

export interface ContextoDelBot {
  businessId: string;
  /** Subdominio de la tienda (así se resuelve el catálogo público). */
  slug: string;
  /** La persona que escribe: sus pedidos son los únicos que se pueden consultar. */
  customerId: string;
}

export type ResultadoDeHerramienta = { ok: true; datos: unknown } | { ok: false; error: string };

export const HERRAMIENTAS_DEL_BOT: LlmToolDefinition[] = [
  {
    name: 'buscar_productos',
    description:
      'Busca productos de la tienda por nombre o descripción (ej. "zapatillas", "remera negra"). Devuelve hasta 6 con precio, oferta, variantes, si hay stock y su link. Con consulta vacía devuelve los más nuevos.',
    parameters: {
      type: 'object',
      properties: { consulta: { type: 'string', description: 'Qué busca la persona, en pocas palabras.' } },
    },
  },
  {
    name: 'detalle_producto',
    description: 'Detalle de UN producto: descripción, precio, cada variante (talle/color) con su stock y características. Usá el id que devolvió buscar_productos.',
    parameters: {
      type: 'object',
      properties: { producto_id: { type: 'string', description: 'El id del producto.' } },
      required: ['producto_id'],
    },
  },
  {
    name: 'datos_de_la_tienda',
    description: 'Datos de la tienda: horarios, contacto, redes, formas de pago, retiro en local, envíos, y cambios y devoluciones.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'cupones_y_descuentos',
    description:
      'Cupones públicos vigentes (con su código, cuánto descuentan, desde qué monto y hasta cuándo) y descuentos por medio de pago. Los descuentos automáticos, ofertas y promos 2x1 / 3x2 NO están acá: ya vienen en el precio y la oferta de cada producto (buscar_productos y detalle_producto).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'estado_de_mi_pedido',
    description: 'Estado de los pedidos de la persona que escribe (los últimos 3, o uno puntual por su número). Solo ve los suyos.',
    parameters: {
      type: 'object',
      properties: { numero_de_pedido: { type: 'integer', description: 'Número del pedido, si lo dijo.' } },
    },
  },
  {
    name: 'derivar_a_una_persona',
    description:
      'Pasa el chat a una persona del equipo y Orbi deja de contestar acá. Usalo ante un reclamo, un problema de pago o pedido, si la persona lo pide, o si no podés resolver algo con certeza.',
    parameters: {
      type: 'object',
      properties: { motivo: { type: 'string', description: 'En una frase, por qué hace falta una persona (lo lee el dueño).' } },
      required: ['motivo'],
    },
  },
];

const ESTADOS_DE_PEDIDO: Record<string, string> = {
  PENDING: 'Pendiente de pago o de confirmación',
  CONFIRMED: 'Confirmado (pago recibido)',
  PREPARING: 'En preparación',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const recortar = (t: string | null | undefined, max: number): string | null => {
  const s = (t ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const enlaceDeProducto = (slug: string, id: string) => `https://${slug}.orbita.site/p/${id.slice(0, 8)}`;

export class HerramientasDelBot {
  constructor(
    private readonly prisma: Pick<PrismaService, 'order'>,
    private readonly tienda: Pick<StorefrontService, 'listProducts' | 'getProduct' | 'getConfig' | 'listCoupons'>,
  ) {}

  /** Corre una herramienta de lectura. `derivar_a_una_persona` no pasa por acá: la maneja el servicio. */
  async ejecutar(nombre: string, args: Record<string, unknown>, ctx: ContextoDelBot): Promise<ResultadoDeHerramienta> {
    try {
      switch (nombre) {
        case 'buscar_productos':
          return { ok: true, datos: await this.buscarProductos(ctx, typeof args.consulta === 'string' ? args.consulta : '') };
        case 'detalle_producto':
          return await this.detalleProducto(ctx, typeof args.producto_id === 'string' ? args.producto_id : '');
        case 'datos_de_la_tienda':
          return { ok: true, datos: await this.datosDeLaTienda(ctx) };
        case 'cupones_y_descuentos':
          return { ok: true, datos: await this.cuponesYDescuentos(ctx) };
        case 'estado_de_mi_pedido':
          return { ok: true, datos: await this.estadoDePedidos(ctx, Number.isInteger(args.numero_de_pedido) ? (args.numero_de_pedido as number) : undefined) };
        default:
          return { ok: false, error: `La herramienta ${nombre} no existe.` };
      }
    } catch {
      // Nada del error interno vuelve al modelo (podría terminar en el chat de un cliente).
      return { ok: false, error: 'No se pudo consultar eso ahora. Ofrecé que lo vea una persona.' };
    }
  }

  private async buscarProductos(ctx: ContextoDelBot, consulta: string) {
    const r = await this.tienda.listProducts(ctx.slug, { search: consulta.trim().slice(0, 100) || undefined, limit: 6, page: 1 } as never);
    return {
      total: r.total,
      productos: r.data.map((p) => ({
        id: p.id,
        nombre: p.name,
        categoria: p.categoryName,
        precio: p.price,
        precio_antes: p.comparePrice && p.comparePrice > p.price ? p.comparePrice : null,
        precio_hasta: p.priceTo,
        oferta: p.promoLabel,
        oferta_hasta: p.offerEndsAt,
        hay_stock: p.inStock,
        se_hace_por_pedido: p.byOrder,
        variantes: p.variantOptions.map((o) => ({ opcion: o.name, valores: o.values.map((v) => v.value) })),
        link: enlaceDeProducto(ctx.slug, p.id),
      })),
    };
  }

  private async detalleProducto(ctx: ContextoDelBot, id: string): Promise<ResultadoDeHerramienta> {
    if (!/^[0-9a-f-]{8,36}$/i.test(id)) return { ok: false, error: 'Ese id de producto no es válido: buscalo de nuevo con buscar_productos.' };
    const p = await this.tienda.getProduct(ctx.slug, id);
    const opciones = new Map(p.options.flatMap((o) => o.values.map((v) => [v.id, o.name] as const)));
    return {
      ok: true,
      datos: {
        id: p.id,
        nombre: p.name,
        descripcion: recortar(p.description, 600),
        categoria: p.categoryName,
        precio: p.price,
        precio_antes: p.comparePrice && p.comparePrice > p.price ? p.comparePrice : null,
        oferta: p.promoLabel,
        // Promo tipo 2x1 / 3x2: lleva X y paga Y, y a qué alcanza (este producto, una categoría, o varios productos).
        promocion: p.promo
          ? {
              descripcion: p.promo.label,
              lleva: p.promo.llevaCantidad,
              paga: p.promo.pagaCantidad,
              aplica_a: p.promo.scope === 'CATEGORY' ? `toda la categoría ${p.promo.categoryName ?? ''}`.trim() : 'este producto y otros elegidos por la tienda',
              tambien_incluye: p.promo.otherProducts.slice(0, 5).map((o) => o.name),
            }
          : null,
        se_hace_por_pedido: p.byOrder,
        caracteristicas: (p.specs ?? []).slice(0, 12).map((s) => `${s.label}: ${s.value}`),
        variantes: p.variants.map((v) => ({
          opciones: v.optionValues.map((ov) => `${opciones.get(ov.optionValueId) ?? 'Opción'}: ${ov.value}`).join(', ') || 'Única',
          precio: v.price,
          hay_stock: v.inStock,
          // La cantidad exacta solo si queda poco (es lo que ve un comprador en la tienda).
          quedan: v.stockVisible && v.inStock && v.lowStock ? v.maxQty : null,
        })),
        link: enlaceDeProducto(ctx.slug, p.id),
      },
    };
  }

  private async datosDeLaTienda(ctx: ContextoDelBot) {
    const c = await this.tienda.getConfig(ctx.slug);
    const pago = c.payment;
    const metodos = pago
      ? [
          pago.mercadopagoAvailable && 'Mercado Pago (tarjetas y QR)',
          pago.acceptsCash && 'Efectivo',
          pago.acceptsTransfer && 'Se coordina el pago por WhatsApp con el equipo',
          pago.acceptsPickup && 'Retiro en el local',
        ].filter(Boolean)
      : [];
    const envio = c.shipping;
    return {
      tienda: c.business.name,
      link: `https://${ctx.slug}.orbita.site`,
      solo_vidriera_sin_compra_online: c.business.mode === 'SHOWCASE',
      horarios: c.contact?.scheduleText ?? null,
      contacto: { email: c.contact?.email ?? null, instagram: c.contact?.instagram ?? null, tiktok: c.contact?.tiktok ?? null, facebook: c.contact?.facebook ?? null },
      formas_de_pago: metodos,
      descuentos_por_medio_de_pago: pago
        ? { efectivo: pago.cashDiscountPercent, mercado_pago: pago.mercadopagoDiscountPercent }
        : null,
      retiro_en_local: pago?.acceptsPickup ? { local: pago.pickupBranchName, direccion: pago.pickupAddress } : null,
      envios: envio
        ? {
            politica: recortar(envio.shippingPolicy, 400),
            demora_estimada: envio.shippingEstimateText,
            gratis_desde: envio.freeShippingFrom,
            costos_por_transportista: envio.carrierShippingCosts,
          }
        : null,
      cambios_y_devoluciones: pago ? { se_aceptan: pago.returnsEnabled, plazo: pago.returnsWindowText } : null,
      cancelaciones_de_pedidos: pago ? { se_aceptan: pago.cancellationsEnabled } : null,
    };
  }

  /**
   * La respuesta fija de una opción de fábrica del menú (modalidad "solo menú"): texto armado con los mismos datos que
   * usan las herramientas, sin pasar por la IA.
   */
  async respuestaFija(opcion: string, ctx: ContextoDelBot): Promise<string> {
    const plata = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
    const tienda = `https://${ctx.slug}.orbita.site`;
    try {
      switch (opcion) {
        case 'catalogo': {
          const r = await this.buscarProductos(ctx, '');
          if (r.productos.length === 0) return `Mirá todo lo que tenemos en nuestra tienda: ${tienda}`;
          const lineas = r.productos
            .slice(0, 5)
            .map((p) => `• *${p.nombre}* — ${plata(p.precio)}${p.oferta ? ` (${p.oferta})` : ''}${p.hay_stock ? '' : ' · sin stock'}\n${p.link}`)
            .join('\n\n');
          return `Algunos de nuestros productos:\n\n${lineas}\n\nCatálogo completo: ${tienda}`;
        }
        case 'pedidos': {
          const r = await this.estadoDePedidos(ctx);
          if (r.pedidos.length === 0) return ('aviso' in r && r.aviso) || 'No encontré pedidos a tu nombre.';
          const lineas = r.pedidos.map((o) => `*Pedido #${o.numero}* — ${o.estado}\n${o.productos.join(', ')} · ${plata(o.total)}`).join('\n\n');
          return `Tus últimos pedidos:\n\n${lineas}`;
        }
        case 'promos': {
          const r = await this.cuponesYDescuentos(ctx);
          const cupones = r.cupones.map((c) => `• Cupón *${c.codigo}*: ${c.descuento}${c.compra_minima ? `, compra mínima ${plata(c.compra_minima)}` : ''}${c.vence ? `, hasta el ${c.vence}` : ''}${c.solo_en ? ` (solo ${c.solo_en.join(', ')})` : ''}`);
          const pago = r.descuentos_por_medio_de_pago;
          const medios = [pago?.efectivo_porcentaje ? `• Pagando en efectivo: ${pago.efectivo_porcentaje}% de descuento` : '', pago?.mercado_pago_porcentaje ? `• Pagando con Mercado Pago: ${pago.mercado_pago_porcentaje}% de descuento` : ''].filter(Boolean);
          const todo = [...cupones, ...medios];
          if (todo.length === 0) return `Ahora no hay cupones vigentes, pero mirá las ofertas en el catálogo: ${tienda}`;
          return `Promos vigentes:\n\n${todo.join('\n')}${cupones.length ? '\n\nLos cupones se escriben en el checkout de la tienda, al pagar.' : ''}`;
        }
        case 'envios': {
          const d = (await this.datosDeLaTienda(ctx)) as Record<string, any>;
          const pagos = ((d.formas_de_pago ?? []) as string[]).filter(Boolean);
          const e = d.envios as { politica?: string | null; demora_estimada?: string | null; gratis_desde?: number | null } | null;
          const partes = [
            pagos.length ? `*Formas de pago*\n${pagos.map((p) => `• ${p}`).join('\n')}` : '',
            e?.politica || e?.demora_estimada || e?.gratis_desde
              ? `*Envíos*\n${[e?.politica, e?.demora_estimada ? `Demora estimada: ${e.demora_estimada}` : '', e?.gratis_desde ? `Envío gratis desde ${plata(e.gratis_desde)}` : ''].filter(Boolean).join('\n')}`
              : '',
            d.retiro_en_local ? `*Retiro en local*\n${[d.retiro_en_local.local, d.retiro_en_local.direccion].filter(Boolean).join(' · ')}` : '',
          ].filter(Boolean);
          return partes.length ? partes.join('\n\n') : `Todos los detalles de envíos y pagos están en nuestra tienda: ${tienda}`;
        }
        case 'horarios': {
          const d = (await this.datosDeLaTienda(ctx)) as Record<string, any>;
          const c = (d.contacto ?? {}) as Record<string, string | null>;
          const redes = [c.instagram && `Instagram: ${c.instagram}`, c.tiktok && `TikTok: ${c.tiktok}`, c.facebook && `Facebook: ${c.facebook}`, c.email && `Email: ${c.email}`].filter(Boolean);
          const partes = [d.horarios ? `*Horarios*\n${d.horarios}` : '', redes.length ? `*Contacto*\n${redes.join('\n')}` : ''].filter(Boolean);
          return partes.length ? partes.join('\n\n') : `Escribinos por acá o visitá nuestra tienda: ${tienda}`;
        }
        default:
          return `Visitá nuestra tienda: ${tienda}`;
      }
    } catch {
      return 'No pude consultar eso ahora. Escribí *menú* y elegí "Hablar con alguien".';
    }
  }

  private async cuponesYDescuentos(ctx: ContextoDelBot) {
    const [cupones, c] = await Promise.all([this.tienda.listCoupons(ctx.slug), this.tienda.getConfig(ctx.slug)]);
    const pago = c.payment;
    const descripcion = (tipo: string, valor: number): string => {
      if (tipo === 'PERCENT_PRODUCT' || tipo === 'PERCENT_TICKET') return `${valor}% de descuento`;
      if (tipo === 'AMOUNT_PRODUCT' || tipo === 'AMOUNT_TICKET') return `$${valor} de descuento`;
      return 'promoción especial';
    };
    return {
      cupones: cupones.slice(0, 8).map((d) => ({
        codigo: d.code,
        nombre: d.name,
        descuento: descripcion(d.type, d.value),
        compra_minima: d.minAmount,
        vence: d.endDate ? d.endDate.slice(0, 10) : null,
        solo_en: d.categories.length > 0 ? d.categories : null,
      })),
      como_se_usa: 'El cupón se escribe en el checkout de la tienda, al pagar: no se aplica por este chat.',
      descuentos_por_medio_de_pago: pago
        ? { efectivo_porcentaje: pago.cashDiscountPercent, mercado_pago_porcentaje: pago.mercadopagoDiscountPercent }
        : null,
    };
  }

  private async estadoDePedidos(ctx: ContextoDelBot, numero?: number) {
    const pedidos = await this.prisma.order.findMany({
      where: { businessId: ctx.businessId, customerId: ctx.customerId, deletedAt: null, ...(numero ? { orderNumber: numero } : {}) },
      orderBy: { createdAt: 'desc' },
      take: numero ? 1 : 3,
      select: {
        orderNumber: true, status: true, total: true, createdAt: true,
        items: { select: { productName: true, variantLabel: true, quantity: true }, take: 10 },
      },
    });
    if (pedidos.length === 0) return { pedidos: [], aviso: numero ? 'No hay un pedido con ese número a nombre de esta persona.' : 'Esta persona no tiene pedidos.' };
    return {
      pedidos: pedidos.map((o) => ({
        numero: o.orderNumber,
        estado: ESTADOS_DE_PEDIDO[o.status] ?? o.status,
        total: Number(o.total),
        fecha: o.createdAt.toISOString().slice(0, 10),
        productos: o.items.map((i) => `${i.quantity} × ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ''}`),
      })),
    };
  }
}
