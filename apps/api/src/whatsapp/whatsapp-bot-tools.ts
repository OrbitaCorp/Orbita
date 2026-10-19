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
    private readonly tienda: Pick<StorefrontService, 'listProducts' | 'getProduct' | 'getConfig'>,
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
