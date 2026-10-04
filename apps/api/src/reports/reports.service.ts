import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { pickPrimaryImageUrl } from '../common/utils/product-image.util';
import { diaYHoraArgentina, fechaArgentina, inicioDeDiaArgentina, inicioDeMesArgentina } from '../common/utils/hora-argentina';
import { redondear2, valorizarInventario } from '../common/utils/inventario';

const DIA_MS = 24 * 60 * 60 * 1000;
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RANGO_MAXIMO_DIAS = 400;

// (Fase 4 — Alex) Reglas del segmento de cliente. Nada se guarda en la base:
// el segmento se calcula al leer, mirando los pedidos reales de cada cliente.
// Prioridad de las reglas (la primera que aplica gana):
//   1. Sin pedidos → 'nuevo' si se registró hace <30 días, si no 'inactivo'.
//   2. Última compra hace >90 días → 'inactivo'.
//   3. Gastado en el percentil 85+ (entre compradores) y 2+ pedidos → 'vip'.
//   4. 2+ pedidos → 'recurrente'.
//   5. Resto (una compra reciente) → 'nuevo'.
const DIAS_CLIENTE_NUEVO = 30;
const DIAS_CLIENTE_INACTIVO = 90;
const PERCENTIL_VIP = 0.85;

export type SegmentoCliente = 'vip' | 'recurrente' | 'nuevo' | 'inactivo';

// Ventana por defecto del reporte, en días. El panel no expone todavía un
// selector de rango; cuando lo haga, alcanza con pasar `days` por query.
const DIAS_POR_DEFECTO = 30;

// Los pedidos cancelados no cuentan como venta. El resto de los estados sí:
// un pedido pendiente ya reservó la intención de compra y el panel lo muestra.
const ESTADOS_VENDIDOS: Prisma.EnumOrderStatusFilter = { not: 'CANCELLED' };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Reporte de productos ─────────────────────────────────────────────────
  // Alimenta la pestaña "Reportes de productos" del panel: qué se vende, qué no
  // rota, y qué está por quedarse sin stock.
  async products(businessId: string, days = DIAS_POR_DEFECTO) {
    const desde = new Date();
    desde.setDate(desde.getDate() - days);

    // Se agrupa por variante (es lo que guarda OrderItem) y después se sube a
    // producto, que es la unidad que le interesa al dueño.
    const vendidosPorVariante = await this.prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        isConcept: false,
        order: { businessId, deletedAt: null, status: ESTADOS_VENDIDOS, createdAt: { gte: desde } },
      },
      _sum: { quantity: true },
    });

    const variantIds = vendidosPorVariante.map((v) => v.variantId);

    // Importe: unitPrice ya viene congelado en el ítem, así que el total no se
    // recalcula contra el precio actual del producto (que pudo cambiar).
    const items = await this.prisma.orderItem.findMany({
      where: {
        isConcept: false,
        order: { businessId, deletedAt: null, status: ESTADOS_VENDIDOS, createdAt: { gte: desde } },
      },
      select: {
        variantId: true,
        quantity: true,
        unitPrice: true,
        discountAmount: true,
        // El costo vive en el producto (uno solo para todas sus variantes). OJO:
        // es el costo de HOY, no el de cuando se vendió — el pedido no guarda un
        // costo congelado, solo el precio. Si el dueño lo corrigió después, la
        // ganancia de ventas viejas se recalcula con el costo nuevo.
        variant: { select: { productId: true, product: { select: { cost: true } } } },
      },
    });

    const acumPorProducto = new Map<string, { unidades: number; importe: number; costo: number | null }>();
    for (const it of items) {
      const key = it.variant.productId;
      const costoUnitario = it.variant.product.cost !== null ? Number(it.variant.product.cost) : null;
      const previo = acumPorProducto.get(key) ?? { unidades: 0, importe: 0, costo: costoUnitario };
      previo.unidades += it.quantity;
      previo.importe += it.quantity * Number(it.unitPrice) - Number(it.discountAmount);
      acumPorProducto.set(key, previo);
    }

    const productos = await this.prisma.product.findMany({
      where: { businessId, deletedAt: null },
      select: {
        id: true,
        name: true,
        cost: true,
        basePrice: true,
        status: true,
        category: { select: { id: true, name: true } },
        // Todas (no filtrado por isPrimary): un producto puramente de
        // variantes sin foto marcada a mano igual necesita mostrar algo — ver
        // pickPrimaryImageUrl().
        images: { select: { url: true, isPrimary: true, optionValueId: true }, orderBy: { position: 'asc' } },
        variants: {
          select: {
            id: true,
            sku: true,
            price: true,
            stock: { select: { quantity: true, stockMin: true } },
            // Para poder distinguir en el listado de stock crítico qué talle o
            // color es el que se está quedando sin unidades.
            optionValues: { select: { optionValue: { select: { value: true } } } },
          },
        },
      },
    });

    // Más vendidos
    const masVendidos = productos
      .map((p) => {
        const acum = acumPorProducto.get(p.id) ?? { unidades: 0, importe: 0, costo: null };
        return {
          id: p.id,
          name: p.name,
          categoryName: p.category?.name ?? null,
          primaryImageUrl: pickPrimaryImageUrl(p.images),
          unidades: acum.unidades,
          importe: Math.round(acum.importe * 100) / 100,
          // Null cuando el producto no tiene costo cargado: no se inventa un
          // costo de cero, que mostraría una ganancia del 100%.
          ganancia: acum.costo !== null ? Math.round((acum.importe - acum.unidades * acum.costo) * 100) / 100 : null,
        };
      })
      .filter((p) => p.unidades > 0)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 10);

    // Sin rotación: publicados que no vendieron nada en la ventana pero tienen
    // stock disponible (si no hay stock, no vendió porque no había, no por falta
    // de demanda — ese caso ya lo cubre "sin stock" en las métricas de la lista).
    const sinRotacion = productos
      .filter((p) => {
        if (p.status !== 'PUBLISHED') return false;
        if ((acumPorProducto.get(p.id)?.unidades ?? 0) > 0) return false;
        const stock = p.variants.reduce((s, v) => s + v.stock.reduce((x, st) => x + st.quantity, 0), 0);
        return stock > 0;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        categoryName: p.category?.name ?? null,
        primaryImageUrl: pickPrimaryImageUrl(p.images),
        stock: p.variants.reduce((s, v) => s + v.stock.reduce((x, st) => x + st.quantity, 0), 0),
      }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10);

    // Stock crítico: alguna variante en o por debajo de su umbral de alerta.
    const stockCritico = productos
      .flatMap((p) =>
        p.variants
          .map((v) => {
            const cantidad = v.stock.reduce((s, st) => s + st.quantity, 0);
            const minimo = v.stock[0]?.stockMin ?? 0;
            return { v, cantidad, minimo };
          })
          .filter(({ cantidad, minimo }) => minimo > 0 && cantidad <= minimo)
          .map(({ v, cantidad, minimo }) => ({
            productId: p.id,
            productName: p.name,
            variantId: v.id,
            sku: v.sku,
            variantLabel:
              v.optionValues.length > 0 ? v.optionValues.map((ov) => ov.optionValue.value).join(' / ') : null,
            primaryImageUrl: pickPrimaryImageUrl(p.images),
            cantidad,
            stockMin: minimo,
          })),
      )
      .sort((a, b) => a.cantidad - b.cantidad)
      .slice(0, 20);

    // Distribución por categoría (productos + valor de inventario a costo).
    const porCategoriaMap = new Map<string, { name: string; productos: number; valor: number }>();
    for (const p of productos) {
      const key = p.category?.id ?? 'sin-categoria';
      const entrada = porCategoriaMap.get(key) ?? {
        name: p.category?.name ?? 'Sin categoría',
        productos: 0,
        valor: 0,
      };
      entrada.productos += 1;
      for (const v of p.variants) {
        const cantidad = v.stock.reduce((s, st) => s + st.quantity, 0);
        const unitario = p.cost !== null ? Number(p.cost) : Number(v.price);
        entrada.valor += cantidad * unitario;
      }
      porCategoriaMap.set(key, entrada);
    }
    const porCategoria = [...porCategoriaMap.entries()]
      .map(([id, c]) => ({ id, name: c.name, productos: c.productos, valor: Math.round(c.valor * 100) / 100 }))
      .sort((a, b) => b.productos - a.productos);

    const unidadesTotales = [...acumPorProducto.values()].reduce((s, a) => s + a.unidades, 0);
    const importeTotal = [...acumPorProducto.values()].reduce((s, a) => s + a.importe, 0);

    // Ganancia estimada de lo vendido: ingresos − costo, SOLO de los productos
    // con costo cargado. `importeSinCosto` es lo que quedó afuera, para que el
    // panel avise que el número no cubre todo.
    let gananciaVendida = 0;
    let importeConCosto = 0;
    let importeSinCosto = 0;
    for (const a of acumPorProducto.values()) {
      if (a.costo === null) {
        importeSinCosto += a.importe;
        continue;
      }
      importeConCosto += a.importe;
      gananciaVendida += a.importe - a.unidades * a.costo;
    }
    // Ganancia potencial del stock que hay hoy ((precio − costo) × unidades).
    const inventario = valorizarInventario(productos);

    return {
      periodoDias: days,
      resumen: {
        productosVendidos: acumPorProducto.size,
        unidadesVendidas: unidadesTotales,
        importeVendido: Math.round(importeTotal * 100) / 100,
        variantesConVenta: variantIds.length,
        gananciaVendida: redondear2(gananciaVendida),
        margenVendidoPct: importeConCosto > 0 ? Math.round((gananciaVendida / importeConCosto) * 1000) / 10 : null,
        importeSinCosto: redondear2(importeSinCosto),
        gananciaInventario: inventario.gananciaPotencial,
        margenInventarioPct: inventario.margenPct,
        productosSinCosto: inventario.sinCosto,
      },
      masVendidos,
      sinRotacion,
      stockCritico,
      porCategoria,
    };
  }

  // ── Reporte de ventas (historial de pedidos) ──────────────────────────────
  // Los cuatro numeros que encabezan el historial: ventas, pedidos, ticket
  // promedio y tasa de cancelacion del mes en curso, con la variacion contra
  // el mes pasado. Igual que los numeros de clientes, nada se guarda: se
  // calcula al leer, mirando los pedidos reales.
  async sales(businessId: string) {
    const ahora = new Date();
    // Meses de Argentina, no del servidor (ver rangoDe).
    const inicioMes = inicioDeMesArgentina(ahora);
    const inicioMesPasado = inicioDeMesArgentina(ahora, -1);

    // Un solo groupBy por periodo: cantidad y monto por estado, y de ahi salen
    // las cuatro metricas (los cancelados no suman venta, pero si cuentan para
    // la tasa de cancelacion).
    //
    // Las devoluciones APROBADAS restan de "ventas": esa plata se devolvio (en
    // nota de credito o reembolso), asi que mostrarla como vendida mentia. Se
    // fechan por su resolucion (updatedAt al aprobarse), que es cuando la
    // plata sale de verdad. El ticket promedio queda BRUTO a proposito: es
    // "cuanto gasta un cliente por compra", y una devolucion no cambia eso.
    const resumenDe = async (desde: Date, hasta: Date | null) => {
      const [grupos, devueltoAgg] = await Promise.all([
        this.prisma.order.groupBy({
          by: ['status'],
          where: {
            businessId,
            deletedAt: null,
            createdAt: { gte: desde, ...(hasta ? { lt: hasta } : {}) },
          },
          orderBy: { status: 'asc' },
          _count: true,
          _sum: { total: true },
        }),
        this.prisma.return.aggregate({
          _sum: { amount: true },
          where: { businessId, status: 'APPROVED', updatedAt: { gte: desde, ...(hasta ? { lt: hasta } : {}) } },
        }),
      ]);

      let pedidos = 0;
      let ventasBrutas = 0;
      let cancelados = 0;
      for (const g of grupos) {
        const n = typeof g._count === 'number' ? g._count : 0;
        if (g.status === 'CANCELLED') {
          cancelados += n;
          continue;
        }
        pedidos += n;
        ventasBrutas += g._sum.total != null ? Number(g._sum.total) : 0;
      }
      const devuelto = devueltoAgg._sum.amount != null ? Number(devueltoAgg._sum.amount) : 0;
      const ventas = ventasBrutas - devuelto;
      const creados = pedidos + cancelados;
      return {
        ventas: Math.round(ventas * 100) / 100,
        pedidos,
        ticketPromedio: pedidos > 0 ? Math.round((ventasBrutas / pedidos) * 100) / 100 : 0,
        tasaCancelacion: creados > 0 ? Math.round((cancelados / creados) * 1000) / 10 : 0,
      };
    };

    const [actual, anterior] = await Promise.all([
      resumenDe(inicioMes, null),
      resumenDe(inicioMesPasado, inicioMes),
    ]);

    // Variacion relativa en %. Si el mes pasado no hubo nada, cualquier numero
    // de este mes es nuevo: se informa 100 para arriba, o 0 si sigue en cero.
    const variacion = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : curr > 0 ? 100 : 0;

    return {
      mes: inicioMes.toISOString(),
      actual,
      anterior,
      deltas: {
        ventas: variacion(actual.ventas, anterior.ventas),
        pedidos: variacion(actual.pedidos, anterior.pedidos),
        ticketPromedio: variacion(actual.ticketPromedio, anterior.ticketPromedio),
        // La tasa ya es un %: aca va la diferencia en puntos, no otra division.
        tasaCancelacion: Math.round((actual.tasaCancelacion - anterior.tasaCancelacion) * 10) / 10,
      },
    };
  }

  // ── Dashboard (Fase 4 — Alex) ─────────────────────────────────────────────
  // Todo lo que muestra la pantalla de inicio en UNA sola respuesta: KPIs del
  // período elegido (con su variación contra el período anterior de igual
  // largo), las alertas accionables, la serie de ventas de la última semana,
  // los rankings del "Top" y la actividad reciente. Es agregación de datos que
  // ya existen — nada se persiste.
  async dashboard(businessId: string, fromISO?: string, toISO?: string) {
    // Rango pedido: por defecto, el día de hoy (de Argentina, ver rangoDe).
    const { inicioHoy, desde, hastaExcl } = this.rangoDe(fromISO, toISO);

    // Período anterior de igual duración, pegado al actual (para los deltas).
    const duracion = hastaExcl.getTime() - desde.getTime();
    const desdeAnterior = new Date(desde.getTime() - duracion);

    const kpisDe = async (gte: Date, lt: Date) => {
      const [grupos, clientesNuevos, devueltoAgg, comisionMpAgg, visitasPeriodo, visitasCustomPeriodo] = await Promise.all([
        this.prisma.order.groupBy({
          by: ['status'],
          where: { businessId, deletedAt: null, createdAt: { gte, lt } },
          orderBy: { status: 'asc' },
          _count: true,
          _sum: { total: true },
        }),
        this.prisma.customer.count({
          where: { businessId, deletedAt: null, createdAt: { gte, lt } },
        }),
        // Devoluciones aprobadas del periodo: esa plata se devolvio (nota de
        // credito o reembolso) y resta de "ventas" — mostrarla como vendida
        // mentia. Fechadas por su resolucion (updatedAt al aprobarse).
        this.prisma.return.aggregate({
          _sum: { amount: true },
          where: { businessId, status: 'APPROVED', updatedAt: { gte, lt } },
        }),
        // Comisión real que MP le cobró al negocio — no una tasa estimada,
        // sino la suma de `mpFeeAmount` capturado de cada pago aprobado (ver
        // mercadopago.service.ts, extractMpFee). Fechada por `paidAt`: el
        // momento en que la plata (y la comisión) efectivamente se movió.
        this.prisma.payment.aggregate({
          _sum: { mpFeeAmount: true },
          where: { businessId, method: 'MERCADOPAGO', status: 'APPROVED', paidAt: { gte, lt } },
        }),
        this.prisma.storeVisit.count({
          where: { businessId, createdAt: { gte, lt } },
        }),
        this.prisma.storeVisit.count({
          where: { businessId, isCustom: true, createdAt: { gte, lt } },
        }),
      ]);
      let pedidos = 0;
      let ventasBrutas = 0;
      let pendientes = 0;
      for (const g of grupos) {
        const n = typeof g._count === 'number' ? g._count : 0;
        if (g.status === 'CANCELLED') continue;
        if (g.status === 'PENDING') pendientes += n;
        pedidos += n;
        ventasBrutas += g._sum.total != null ? Number(g._sum.total) : 0;
      }
      const devuelto = devueltoAgg._sum.amount != null ? Number(devueltoAgg._sum.amount) : 0;
      const comisionMp = comisionMpAgg._sum.mpFeeAmount != null ? Number(comisionMpAgg._sum.mpFeeAmount) : 0;
      // El ticket promedio queda BRUTO a proposito: mide cuanto gasta un
      // cliente por compra, y una devolucion posterior no cambia eso.
      return {
        ventas: Math.round((ventasBrutas - devuelto) * 100) / 100,
        pedidos,
        ticketPromedio: pedidos > 0 ? Math.round((ventasBrutas / pedidos) * 100) / 100 : 0,
        clientesNuevos,
        pedidosPendientes: pendientes,
        comisionMp: Math.round(comisionMp * 100) / 100,
        visitas: visitasPeriodo,
        visitasDominio: visitasCustomPeriodo,
        visitasSubdominio: Math.max(0, visitasPeriodo - visitasCustomPeriodo),
      };
    };

    // Serie de la última semana (7 días hasta hoy) y la semana anterior para
    // el "vs semana anterior" del gráfico — independiente del rango elegido.
    const inicioSerie = new Date(inicioHoy.getTime() - 6 * 24 * 60 * 60 * 1000);
    const inicioSerieAnterior = new Date(inicioSerie.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [actual, anterior, ordenesSerie, devolucionesSerie, alertas, topProductosRaw, actividadRaw, visitasTotal, visitasTotalDominio] = await Promise.all([
      kpisDe(desde, hastaExcl),
      kpisDe(desdeAnterior, desde),
      this.prisma.order.findMany({
        where: {
          businessId,
          deletedAt: null,
          status: ESTADOS_VENDIDOS,
          createdAt: { gte: inicioSerieAnterior },
        },
        select: { total: true, createdAt: true, origin: true },
      }),
      // Para restar de la serie diaria: la plata devuelta sale del dia en que
      // se aprobo la devolucion.
      this.prisma.return.findMany({
        where: { businessId, status: 'APPROVED', updatedAt: { gte: inicioSerieAnterior } },
        select: { amount: true, updatedAt: true },
      }),
      this.alertas(businessId),
      // Top productos del rango elegido, agrupado por variante y subido a producto.
      this.prisma.orderItem.findMany({
        where: {
          isConcept: false,
          order: { businessId, deletedAt: null, status: ESTADOS_VENDIDOS, createdAt: { gte: desde, lt: hastaExcl } },
        },
        select: {
          quantity: true,
          unitPrice: true,
          discountAmount: true,
          variant: {
            select: {
              productId: true,
              product: {
                select: {
                  name: true,
                  categoryId: true,
                  category: { select: { name: true } },
                  // La foto principal, para que el "Top" del dashboard muestre
                  // el producto real y no un thumb de color.
                  images: { select: { url: true }, orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }], take: 1 },
                },
              },
            },
          },
        },
      }),
      this.prisma.order.findMany({
        where: { businessId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          createdAt: true,
          // Qué compró, para que "Actividad reciente" cuente algo útil
          // ("1× Remera Oversize") y no solo un monto con estado.
          items: { select: { quantity: true, productName: true }, take: 3 },
          customer: { select: { firstName: true, lastName: true } },
          // Los pedidos de compradores sin registrar no tienen customer: el
          // nombre vive en onlineOrderDetails.buyerName. Sin esto, el panel
          // mostraba "Sin cliente" en la actividad para pedidos que sí tienen
          // comprador (la lista de pedidos ya hacía este fallback).
          onlineOrderDetails: { select: { buyerName: true } },
        },
      }),
      this.prisma.storeVisit.count({ where: { businessId } }),
      this.prisma.storeVisit.count({ where: { businessId, isCustom: true } }),
    ]);

    // Serie diaria: los 7 días de esta semana y el total de la anterior.
    const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const labels: string[] = [];
    const valores: number[] = [];
    const valoresAnterior: number[] = [];
    for (let i = 0; i < 7; i++) {
      const dia = new Date(inicioSerie.getTime() + i * 24 * 60 * 60 * 1000);
      labels.push(dias[diaYHoraArgentina(dia).dia]);
      valores.push(0);
      valoresAnterior.push(0);
    }
    for (const o of ordenesSerie) {
      const offsetActual = Math.floor((o.createdAt.getTime() - inicioSerie.getTime()) / (24 * 60 * 60 * 1000));
      if (offsetActual >= 0 && offsetActual < 7) {
        valores[offsetActual] += Number(o.total);
        continue;
      }
      const offsetPrev = Math.floor((o.createdAt.getTime() - inicioSerieAnterior.getTime()) / (24 * 60 * 60 * 1000));
      if (offsetPrev >= 0 && offsetPrev < 7) valoresAnterior[offsetPrev] += Number(o.total);
    }
    // Las devoluciones aprobadas restan del dia en que se resolvieron: la
    // serie muestra plata que quedo, no plata que hubo que devolver. Si un
    // dia devolvio mas de lo que vendio, se corta en cero (una barra negativa
    // no se puede dibujar y "0 vendido" cuenta la historia igual).
    for (const d of devolucionesSerie) {
      const offsetActual = Math.floor((d.updatedAt.getTime() - inicioSerie.getTime()) / (24 * 60 * 60 * 1000));
      if (offsetActual >= 0 && offsetActual < 7) {
        valores[offsetActual] -= Number(d.amount);
        continue;
      }
      const offsetPrev = Math.floor((d.updatedAt.getTime() - inicioSerieAnterior.getTime()) / (24 * 60 * 60 * 1000));
      if (offsetPrev >= 0 && offsetPrev < 7) valoresAnterior[offsetPrev] -= Number(d.amount);
    }
    for (let i = 0; i < 7; i++) {
      valores[i] = Math.max(0, valores[i]);
      valoresAnterior[i] = Math.max(0, valoresAnterior[i]);
    }

    // Rankings del "Top": productos / categorías / canal, todos del rango elegido.
    const porProducto = new Map<string, { name: string; img: string | null; unidades: number; importe: number }>();
    const porCategoria = new Map<string, { label: string; value: number }>();
    for (const it of topProductosRaw) {
      const pid = it.variant.productId;
      const prev = porProducto.get(pid) ?? { name: it.variant.product.name, img: it.variant.product.images[0]?.url ?? null, unidades: 0, importe: 0 };
      prev.unidades += it.quantity;
      prev.importe += it.quantity * Number(it.unitPrice) - Number(it.discountAmount);
      porProducto.set(pid, prev);

      const catKey = it.variant.product.categoryId ?? 'sin-categoria';
      const cat = porCategoria.get(catKey) ?? { label: it.variant.product.category?.name ?? 'Sin categoría', value: 0 };
      cat.value += it.quantity;
      porCategoria.set(catKey, cat);
    }
    const topProductos = [...porProducto.entries()]
      .map(([id, p]) => ({ id, name: p.name, img: p.img, unidades: p.unidades, importe: Math.round(p.importe * 100) / 100 }))
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 5);
    const topCategorias = [...porCategoria.values()].sort((a, b) => b.value - a.value).slice(0, 5);

    // Canal del Top: montos por ORIGEN — cuánto vendió la tienda sola vs
    // cuánto cargó el negocio a mano. Antes comparaba por channel, pero todos
    // los pedidos son channel ONLINE (el flujo POS no existe) y la dona daba
    // siempre 100% online; el origen sí distingue lo que importa al dueño.
    let tienda = 0;
    let manual = 0;
    for (const o of ordenesSerie) {
      if (o.createdAt < desde || o.createdAt >= hastaExcl) continue;
      if (o.origin === 'MANUAL') manual += Number(o.total);
      else tienda += Number(o.total);
    }

    const variacion = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : curr > 0 ? 100 : 0;

    return {
      desde: desde.toISOString(),
      hasta: new Date(hastaExcl.getTime() - 1).toISOString(),
      kpis: {
        ...actual,
        visitasTotal,
        visitasTotalDominio,
        visitasTotalSubdominio: Math.max(0, visitasTotal - visitasTotalDominio),
        deltas: {
          ventas: variacion(actual.ventas, anterior.ventas),
          pedidos: variacion(actual.pedidos, anterior.pedidos),
          ticketPromedio: variacion(actual.ticketPromedio, anterior.ticketPromedio),
          clientesNuevos: variacion(actual.clientesNuevos, anterior.clientesNuevos),
          comisionMp: variacion(actual.comisionMp, anterior.comisionMp),
          visitas: variacion(actual.visitas, anterior.visitas),
        },
      },
      alertas,
      serieSemana: { labels, valores: valores.map((v) => Math.round(v * 100) / 100), totalAnterior: Math.round(valoresAnterior.reduce((s, v) => s + v, 0) * 100) / 100 },
      top: {
        productos: topProductos,
        categorias: topCategorias,
        canal: [
          { label: 'Tienda', value: Math.round(tienda * 100) / 100 },
          { label: 'Manual', value: Math.round(manual * 100) / 100 },
        ],
      },
      actividad: actividadRaw.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer
          ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ')
          : (o.onlineOrderDetails?.buyerName ?? null),
        total: Number(o.total),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        productos: o.items.map((it) => `${it.quantity}× ${it.productName}`).join(' · '),
      })),
    };
  }

  // ── Dashboard avanzado ────────────────────────────────────────────────────
  // Las métricas del desplegable "Métricas avanzadas" del inicio: rentabilidad,
  // conversión, cancelación, clientes que repiten, devoluciones y descuentos,
  // más las series para los gráficos (por franja, por hora y día de la semana,
  // por categoría). Va aparte de dashboard() a propósito: trae los renglones de
  // todos los pedidos de DOS períodos, así que el panel lo pide recién cuando el
  // dueño abre la sección, y el inicio no se vuelve más lento para quien no la usa.
  //
  // Cada métrica viene para el período elegido (`actual`) y para el anterior de
  // igual largo (`anterior`), así el panel calcula sus variaciones.
  //
  // La GANANCIA es una estimación:
  //   ingreso neto de productos − costo de lo vendido, solo de los productos con
  //   costo cargado. El ingreso neto es cantidad × precio de lista menos TODOS los
  //   descuentos del pedido (los de cada ítem y los del ticket); el envío y los
  //   ítems libres (sin costo) quedan afuera. No resta comisiones de cobro,
  //   devoluciones ni gastos fijos. Y el costo es el que el producto tiene HOY (el
  //   pedido no guarda un costo congelado).
  async dashboardAvanzado(businessId: string, fromISO?: string, toISO?: string) {
    const { desde, hastaExcl } = this.rangoDe(fromISO, toISO);
    const duracion = hastaExcl.getTime() - desde.getTime();
    const desdeAnterior = new Date(desde.getTime() - duracion);

    const devolucionesDe = (gte: Date, lt: Date) =>
      this.prisma.return.aggregate({
        _sum: { amount: true },
        where: { businessId, status: 'APPROVED', updatedAt: { gte, lt } },
      });

    const [ordenes, devueltoActual, devueltoAnterior, visitasActual, visitasAnterior, productos] = await Promise.all([
      this.prisma.order.findMany({
        where: { businessId, deletedAt: null, createdAt: { gte: desdeAnterior, lt: hastaExcl } },
        select: {
          status: true,
          createdAt: true,
          customerId: true,
          origin: true,
          total: true,
          discountTotal: true,
          items: {
            select: {
              quantity: true,
              unitPrice: true,
              isConcept: true,
              variant: { select: { product: { select: { cost: true, categoryId: true, category: { select: { name: true } } } } } },
            },
          },
        },
      }),
      devolucionesDe(desde, hastaExcl),
      devolucionesDe(desdeAnterior, desde),
      this.prisma.storeVisit.count({ where: { businessId, createdAt: { gte: desde, lt: hastaExcl } } }),
      this.prisma.storeVisit.count({ where: { businessId, createdAt: { gte: desdeAnterior, lt: desde } } }),
      this.prisma.product.findMany({
        where: { businessId, deletedAt: null },
        select: { cost: true, variants: { select: { price: true, stock: { select: { quantity: true } } } } },
      }),
    ]);

    type OrdenAv = (typeof ordenes)[number];
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

    // Los renglones de un pedido ya con su ingreso neto (el descuento del pedido
    // repartido en proporción al precio de cada ítem) y su costo, si lo tiene.
    const renglonesNetos = (o: OrdenAv) => {
      const bruto = o.items.reduce((s, it) => s + it.quantity * Number(it.unitPrice), 0);
      const factor = bruto > 0 ? Math.min(1, Math.max(0, 1 - Number(o.discountTotal) / bruto)) : 1;
      return o.items
        .filter((it) => !it.isConcept)
        .map((it) => {
          const costoUnitario = it.variant.product.cost;
          return {
            unidades: it.quantity,
            neto: it.quantity * Number(it.unitPrice) * factor,
            costo: costoUnitario !== null ? it.quantity * Number(costoUnitario) : null,
            categoriaId: it.variant.product.categoryId ?? 'sin-categoria',
            categoriaNombre: it.variant.product.category?.name ?? 'Sin categoría',
          };
        });
    };

    // Compradores identificados del período y cuántos de ellos ya habían comprado
    // antes (o compraron más de una vez dentro del período).
    const compradoresDe = async (ords: OrdenAv[], antesDe: Date) => {
      const vendidas = ords.filter((o) => o.status !== 'CANCELLED' && o.customerId);
      const enPeriodo = new Map<string, number>();
      for (const o of vendidas) enPeriodo.set(o.customerId!, (enPeriodo.get(o.customerId!) ?? 0) + 1);
      const ids = [...enPeriodo.keys()];
      if (ids.length === 0) return { total: 0, recurrentes: 0 };
      const previos = await this.prisma.order.groupBy({
        by: ['customerId'],
        where: { businessId, deletedAt: null, status: ESTADOS_VENDIDOS, customerId: { in: ids }, createdAt: { lt: antesDe } },
        orderBy: { customerId: 'asc' },
        _count: true,
      });
      const previosPorCliente = new Map(previos.map((g) => [g.customerId, typeof g._count === 'number' ? g._count : 0]));
      const recurrentes = ids.filter((id) => (previosPorCliente.get(id) ?? 0) + (enPeriodo.get(id) ?? 0) >= 2).length;
      return { total: ids.length, recurrentes };
    };

    const metricasDe = (ords: OrdenAv[], visitas: number, devuelto: number, comp: { total: number; recurrentes: number }) => {
      let pedidos = 0;
      let cancelados = 0;
      let pedidosTienda = 0;
      let ventas = 0;
      let descuentos = 0;
      let unidades = 0;
      let ingresosConCosto = 0;
      let ingresosSinCosto = 0;
      let costo = 0;
      for (const o of ords) {
        if (o.status === 'CANCELLED') {
          cancelados++;
          continue;
        }
        pedidos++;
        if (o.origin !== 'MANUAL') pedidosTienda++;
        ventas += Number(o.total);
        descuentos += Number(o.discountTotal);
        for (const r of renglonesNetos(o)) {
          unidades += r.unidades;
          if (r.costo === null) ingresosSinCosto += r.neto;
          else {
            ingresosConCosto += r.neto;
            costo += r.costo;
          }
        }
      }
      const ganancia = ingresosConCosto - costo;
      const ingresos = ingresosConCosto + ingresosSinCosto;
      return {
        pedidos,
        cancelados,
        tasaCancelacionPct: pct(cancelados, pedidos + cancelados),
        ventas: redondear2(ventas),
        ingresos: redondear2(ingresos),
        costo: redondear2(costo),
        ganancia: redondear2(ganancia),
        margenPct: pct(ganancia, ingresosConCosto),
        // Qué parte de los ingresos entra en la ganancia (la que tiene costo cargado).
        coberturaCostoPct: pct(ingresosConCosto, ingresos),
        unidades,
        unidadesPorPedido: pedidos > 0 ? Math.round((unidades / pedidos) * 10) / 10 : 0,
        descuentos: redondear2(descuentos),
        visitas,
        // Solo los pedidos que hizo el cliente por la tienda: los que carga el
        // negocio a mano no vinieron de una visita.
        conversionPct: visitas > 0 ? Math.min(100, pct(pedidosTienda, visitas) ?? 0) : null,
        devuelto: redondear2(devuelto),
        tasaDevolucionPct: pct(devuelto, ventas),
        compradores: comp.total,
        recurrentes: comp.recurrentes,
        recurrentesPct: pct(comp.recurrentes, comp.total),
      };
    };

    const ordActual = ordenes.filter((o) => o.createdAt >= desde);
    const ordAnterior = ordenes.filter((o) => o.createdAt < desde);
    const [compActual, compAnterior] = await Promise.all([compradoresDe(ordActual, desde), compradoresDe(ordAnterior, desdeAnterior)]);
    const num = (v: { _sum: { amount: unknown } }) => (v._sum.amount != null ? Number(v._sum.amount) : 0);
    const actual = metricasDe(ordActual, visitasActual, num(devueltoActual), compActual);
    const anterior = metricasDe(ordAnterior, visitasAnterior, num(devueltoAnterior), compAnterior);

    // Pedidos sin cliente registrado (compra como invitado o carga manual).
    const sinRegistrar = ordActual.filter((o) => o.status !== 'CANCELLED' && !o.customerId).length;

    // ── Serie de ventas y ganancia: por hora si el rango es un día, por día hasta
    // ~un mes, y por semana si es más largo (400 días daban 400 barras ilegibles).
    const dias = Math.round(duracion / DIA_MS);
    const granularidad: 'hora' | 'dia' | 'semana' = dias <= 1 ? 'hora' : dias <= 31 ? 'dia' : 'semana';
    const tamanoBucket = granularidad === 'hora' ? 60 * 60 * 1000 : granularidad === 'dia' ? DIA_MS : 7 * DIA_MS;
    const cantBuckets = Math.max(1, Math.ceil(duracion / tamanoBucket));
    const ventasSerie = new Array<number>(cantBuckets).fill(0);
    const gananciaSerie = new Array<number>(cantBuckets).fill(0);
    const labels = Array.from({ length: cantBuckets }, (_, i) => {
      const inicio = new Date(desde.getTime() + i * tamanoBucket);
      if (granularidad === 'hora') return `${diaYHoraArgentina(inicio).hhmm.slice(0, 2)}h`;
      const [, m, d] = fechaArgentina(inicio).split('-');
      return `${d}/${m}`;
    });

    const porHora = new Array<number>(24).fill(0);
    const porDiaSemana = new Array<number>(7).fill(0);
    const porCategoriaMap = new Map<string, { label: string; ingresos: number; ingresosConCosto: number; ganancia: number }>();

    for (const o of ordActual) {
      if (o.status === 'CANCELLED') continue;
      const { dia, hhmm } = diaYHoraArgentina(o.createdAt);
      porHora[Number(hhmm.slice(0, 2))]++;
      porDiaSemana[dia]++;
      const idx = Math.min(cantBuckets - 1, Math.floor((o.createdAt.getTime() - desde.getTime()) / tamanoBucket));
      ventasSerie[idx] += Number(o.total);
      for (const r of renglonesNetos(o)) {
        if (r.costo !== null) gananciaSerie[idx] += r.neto - r.costo;
        const cat = porCategoriaMap.get(r.categoriaId) ?? { label: r.categoriaNombre, ingresos: 0, ingresosConCosto: 0, ganancia: 0 };
        cat.ingresos += r.neto;
        if (r.costo !== null) {
          cat.ingresosConCosto += r.neto;
          cat.ganancia += r.neto - r.costo;
        }
        porCategoriaMap.set(r.categoriaId, cat);
      }
    }

    const porCategoria = [...porCategoriaMap.values()]
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 6)
      .map((c) => ({
        label: c.label,
        ingresos: redondear2(c.ingresos),
        // Null = ningún producto de la categoría tiene costo cargado.
        ganancia: c.ingresosConCosto > 0 ? redondear2(c.ganancia) : null,
        margenPct: pct(c.ganancia, c.ingresosConCosto),
      }));

    const inventario = valorizarInventario(productos);

    return {
      desde: desde.toISOString(),
      hasta: new Date(hastaExcl.getTime() - 1).toISOString(),
      actual,
      anterior,
      clientes: {
        compradores: compActual.total,
        recurrentes: compActual.recurrentes,
        nuevos: compActual.total - compActual.recurrentes,
        sinRegistrar,
      },
      porFranja: {
        granularidad,
        labels,
        ventas: ventasSerie.map(redondear2),
        ganancia: gananciaSerie.map(redondear2),
      },
      porHora,
      porDiaSemana,
      porCategoria,
      inventario,
    };
  }

  // ── Reporte de ingresos por medio de pago ────────────────────────────────
  // Posible desde que cada pedido deja un Payment real sin importar el medio
  // (RBT-619, resuelto) — antes de eso, CASH/TRANSFER/DEBIT_CARD/CREDIT_CARD
  // nunca dejaban ninguna fila y este reporte no tenía con qué construirse.
  // Mismo criterio de rango que dashboard(): `to` inclusivo a nivel día, sin
  // rango pedido = el día de hoy.
  async payments(businessId: string, fromISO?: string, toISO?: string) {
    const { desde, hastaExcl } = this.rangoDe(fromISO, toISO);

    // Solo pagos APROBADOS (plata que efectivamente entró), fechados por
    // paidAt (cuándo se confirmó de verdad, no cuándo se creó el pedido).
    const grupos = await this.prisma.payment.groupBy({
      by: ['method'],
      where: { businessId, status: 'APPROVED', paidAt: { gte: desde, lt: hastaExcl } },
      _sum: { amount: true, mpFeeAmount: true },
      _count: true,
    });

    const porMedio = grupos
      .map((g) => ({
        method: g.method,
        monto: Math.round((g._sum.amount != null ? Number(g._sum.amount) : 0) * 100) / 100,
        comision: Math.round((g._sum.mpFeeAmount != null ? Number(g._sum.mpFeeAmount) : 0) * 100) / 100,
        cantidad: typeof g._count === 'number' ? g._count : 0,
      }))
      .sort((a, b) => b.monto - a.monto);

    const total = Math.round(porMedio.reduce((s, m) => s + m.monto, 0) * 100) / 100;

    return {
      desde: desde.toISOString(),
      hasta: new Date(hastaExcl.getTime() - 1).toISOString(),
      porMedio,
      total,
    };
  }

  // Rango que pide el panel: "YYYY-MM-DD" como días de Argentina (o un
  // instante ISO completo, que se respeta), `to` inclusivo a nivel día: se
  // corre al comienzo del día siguiente y se compara con `lt`. Sin rango, el
  // día de hoy de Argentina. Antes todo se cortaba en la hora del servidor
  // (UTC en Cloud Run): el "hoy" iba de las 21 h de ayer a las 21 h de hoy
  // (auditoría interna 10/09, ítem api.reports). Con tope: un rango de años
  // traía a memoria todos los renglones de todos los pedidos.
  private rangoDe(fromISO?: string, toISO?: string): { inicioHoy: Date; desde: Date; hastaExcl: Date } {
    const inicioHoy = inicioDeDiaArgentina(fechaArgentina(new Date()));
    const dia = (s: string) => (SOLO_DIA.test(s) ? inicioDeDiaArgentina(s) : new Date(s));
    const desde = fromISO ? dia(fromISO) : inicioHoy;
    const hastaExcl = new Date((toISO ? dia(toISO) : inicioHoy).getTime() + DIA_MS);
    if (isNaN(desde.getTime()) || isNaN(hastaExcl.getTime()) || desde >= hastaExcl) {
      throw new BadRequestException('Rango de fechas inválido');
    }
    if (hastaExcl.getTime() - desde.getTime() > RANGO_MAXIMO_DIAS * DIA_MS) {
      throw new BadRequestException(`El rango puede ser de hasta ${RANGO_MAXIMO_DIAS} días`);
    }
    return { inicioHoy, desde, hastaExcl };
  }

  // Las alertas accionables del dashboard. Cada número tiene su link directo
  // en el frontend a la sección donde se resuelve.
  private async alertas(businessId: string) {
    const hace2h = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const [stocks, pagosPorConfirmar, pedidosPendientes, pedidosSinAtender] = await Promise.all([
      // Stock crítico: variantes activas en o por debajo de su mínimo (mínimo > 0).
      this.prisma.variantStock.findMany({
        where: {
          stockMin: { gt: 0 },
          variant: { isActive: true, product: { businessId, deletedAt: null, status: 'PUBLISHED' } },
        },
        select: { quantity: true, stockMin: true },
      }),
      // Transferencias esperando confirmación manual.
      this.prisma.payment.count({
        where: { businessId, status: 'PENDING', method: 'TRANSFER', order: { deletedAt: null, status: { not: 'CANCELLED' } } },
      }),
      this.prisma.order.count({
        where: { businessId, deletedAt: null, status: 'PENDING' },
      }),
      this.prisma.order.count({
        where: { businessId, deletedAt: null, status: 'PENDING', createdAt: { lt: hace2h } },
      }),
    ]);
    return {
      stockCritico: stocks.filter((s) => s.quantity <= s.stockMin).length,
      pagosPorConfirmar,
      pedidosPendientes,
      pedidosSinAtender,
    };
  }

  // ── Reporte de clientes (Fase 4 — Alex) ──────────────────────────────────
  // Los números de la cartera: activos, nuevos, recurrentes, LTV, el gráfico
  // de altas por semana, la torta de segmentos y el top por gasto. El segmento
  // se calcula acá (ver las reglas arriba de SegmentoCliente) — el modelo de
  // datos no guarda ningún campo `segment`.
  async customers(businessId: string) {
    const ahora = new Date();
    const inicioMes = inicioDeMesArgentina(ahora);
    const inicioMesPasado = inicioDeMesArgentina(ahora, -1);
    const hace30d = new Date(ahora.getTime() - DIAS_CLIENTE_NUEVO * 24 * 60 * 60 * 1000);
    const hace90d = new Date(ahora.getTime() - DIAS_CLIENTE_INACTIVO * 24 * 60 * 60 * 1000);

    const [clientes, pedidosPorCliente] = await Promise.all([
      this.prisma.customer.findMany({
        where: { businessId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, createdAt: true },
      }),
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: { businessId, deletedAt: null, status: ESTADOS_VENDIDOS, customerId: { not: null } },
        orderBy: { customerId: 'asc' },
        _count: true,
        _sum: { total: true },
        _max: { createdAt: true },
      }),
    ]);

    const resumenPorCliente = new Map<string, { pedidos: number; gastado: number; ultima: Date | null }>();
    for (const g of pedidosPorCliente) {
      if (!g.customerId) continue;
      resumenPorCliente.set(g.customerId, {
        pedidos: typeof g._count === 'number' ? g._count : 0,
        gastado: g._sum.total != null ? Number(g._sum.total) : 0,
        ultima: g._max.createdAt,
      });
    }

    // Umbral VIP: percentil 85 del gasto entre los clientes que compraron algo.
    const gastos = [...resumenPorCliente.values()].map((r) => r.gastado).sort((a, b) => a - b);
    const umbralVip = gastos.length > 0 ? gastos[Math.min(gastos.length - 1, Math.floor(gastos.length * PERCENTIL_VIP))] : Infinity;

    const segmentoDe = (c: { createdAt: Date }, r?: { pedidos: number; gastado: number; ultima: Date | null }): SegmentoCliente => {
      if (!r || r.pedidos === 0) return c.createdAt >= hace30d ? 'nuevo' : 'inactivo';
      if (r.ultima && r.ultima < hace90d) return 'inactivo';
      if (r.pedidos >= 2 && r.gastado >= umbralVip && umbralVip > 0) return 'vip';
      if (r.pedidos >= 2) return 'recurrente';
      // Una sola compra y dentro de los 90 días: cliente nuevo en la práctica.
      return 'nuevo';
    };

    const segmentacion: Record<SegmentoCliente, number> = { vip: 0, recurrente: 0, nuevo: 0, inactivo: 0 };
    const filas = clientes.map((c) => {
      const r = resumenPorCliente.get(c.id);
      const segmento = segmentoDe(c, r);
      segmentacion[segmento] += 1;
      return {
        id: c.id,
        nombre: [c.firstName, c.lastName].filter(Boolean).join(' '),
        pedidos: r?.pedidos ?? 0,
        gastado: Math.round((r?.gastado ?? 0) * 100) / 100,
        ultimaCompra: r?.ultima ? r.ultima.toISOString() : null,
        creadoEl: c.createdAt.toISOString(),
        segmento,
      };
    });

    // Activos: compraron en los últimos 90 días.
    const activos = filas.filter((f) => f.ultimaCompra && new Date(f.ultimaCompra) >= hace90d).length;
    const compradores = filas.filter((f) => f.pedidos > 0);
    const recurrentes = compradores.filter((f) => f.pedidos >= 2).length;
    const ltvPromedio = compradores.length > 0
      ? Math.round((compradores.reduce((s, f) => s + f.gastado, 0) / compradores.length) * 100) / 100
      : 0;

    const [nuevosMes, nuevosMesPasado] = await Promise.all([
      this.prisma.customer.count({ where: { businessId, deletedAt: null, createdAt: { gte: inicioMes } } }),
      this.prisma.customer.count({ where: { businessId, deletedAt: null, createdAt: { gte: inicioMesPasado, lt: inicioMes } } }),
    ]);

    // Altas por semana: las últimas 4 semanas (la 4 es la que corre).
    const nuevosPorSemana: { label: string; value: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const desde = new Date(ahora.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const hasta = new Date(ahora.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      nuevosPorSemana.push({
        label: `Sem ${4 - i}`,
        value: clientes.filter((c) => c.createdAt >= desde && c.createdAt < hasta).length,
      });
    }

    const topClientes = [...filas].sort((a, b) => b.gastado - a.gastado).slice(0, 5);

    return {
      metricas: {
        activos,
        nuevosMes,
        deltaNuevosMes: nuevosMes - nuevosMesPasado,
        recurrentesPct: compradores.length > 0 ? Math.round((recurrentes / compradores.length) * 1000) / 10 : 0,
        ltvPromedio,
        totalClientes: clientes.length,
      },
      nuevosPorSemana,
      segmentacion: [
        { segmento: 'vip' as const, cantidad: segmentacion.vip },
        { segmento: 'recurrente' as const, cantidad: segmentacion.recurrente },
        { segmento: 'nuevo' as const, cantidad: segmentacion.nuevo },
        { segmento: 'inactivo' as const, cantidad: segmentacion.inactivo },
      ],
      topClientes,
      // Para el export: todas las filas con su segmento calculado.
      clientes: filas,
    };
  }
}
