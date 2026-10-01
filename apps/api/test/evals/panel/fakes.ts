/**
 * Services falsos y ESTRICTOS sobre el negocio de prueba, y el armado de las
 * piezas reales de Orbi (registry de tools, ContextBuilderService) encima de
 * ellos.
 *
 * Las tools son las de verdad (spec 2026-10-01-orbi-fase-2, §2): lo que se
 * mide es lo que el modelo ve en producción — descripciones, parámetros, el
 * mapeo de resultados, la tarjeta de las escrituras y su validación con el DTO.
 * Lo único falso es de dónde salen los datos.
 *
 * Estricto quiere decir: si una tool llama un método que el fake no
 * implementa, no recibe `undefined` en silencio. Se anota el método en
 * `faltasDelFake` y el runner reporta el caso como error de INFRAESTRUCTURA,
 * no como falla del modelo. Un fake que devuelve basura mide un Orbi que
 * recibe basura.
 *
 * Las escrituras nunca se ejecutan: el runner solo propone (igual que el chat
 * del panel) y los métodos que escribirían ni siquiera existen acá.
 *
 * Los snapshots copian la semántica de ModuleDataService tal cual está hoy,
 * con sus diferencias contra los reportes de la pantalla (VIP = 10% de arriba,
 * inactivo = 60 días, pendientes solo del mes). Se mide el Orbi que hay, no
 * uno corregido. La única diferencia: los meses se cortan en hora de Argentina
 * (ModuleDataService usa la hora del servidor, que en Cloud Run es UTC).
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ToolRegistryService } from '../../../src/orbi/tools/tool-registry.service';
import { ContextBuilderService } from '../../../src/orbi/context/context-builder.service';
import { permisosDeOrbi } from '../../../src/orbi/permisos-orbi';
import { NavigationTool } from '../../../src/orbi/tools/definitions/navigation.tool';
import { ListProductsTool, CreateProductTool, GenerateDescriptionTool } from '../../../src/orbi/tools/definitions/product.tools';
import { ListDiscountsTool, CreateDiscountTool, CreateCouponTool } from '../../../src/orbi/tools/definitions/discount.tools';
import { ListOrdersTool, GetOrderDetailTool, UpdateOrderStatusTool } from '../../../src/orbi/tools/definitions/order.tools';
import { ListCustomersTool, GetCustomerDetailTool } from '../../../src/orbi/tools/definitions/customer.tools';
import { UpdateBusinessInfoTool, UpdatePaymentMethodsTool, UpdateShippingTool } from '../../../src/orbi/tools/definitions/config.tools';
import { GetSalesReportTool, GetProductReportTool, GetCustomerReportTool } from '../../../src/orbi/tools/definitions/report.tools';
import { LeerTemaDelManualTool } from '../../../src/orbi/tools/definitions/manual.tools';
import { EstadoPrimerosPasosTool, AccesoDelEquipoTool } from '../../../src/orbi/tools/definitions/estado.tools';
import type {
  ModuleSnapshot,
  DashboardSnapshot,
  PedidosSnapshot,
  ClientesSnapshot,
  CatalogoSnapshot,
  MensajesSnapshot,
} from '../../../src/orbi/context/module-data.types';
import { fechaArgentina, inicioDeDiaArgentina, inicioDeMesArgentina } from '../../../src/common/utils/hora-argentina';
import {
  BUSINESS_ID,
  EQUIPO,
  ESTADO_DEL_ALTA,
  MIEMBRO_DUENO_ID,
  MIEMBRO_EMPLEADO_ID,
  esVenta,
  nombreDeCliente,
  precioDe,
  redondear,
  type NegocioDePrueba,
  type PedidoConFecha,
} from './negocio-de-prueba';

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

// ─── Estricto ────────────────────────────────────────────────────────────────

export class FaltaEnElFake extends Error {}

/** Métodos que alguna tool pidió y el fake no tiene. El runner lo vacía antes de cada caso. */
export const faltasDelFake: string[] = [];

/**
 * Envuelve un objeto para que acceder a una propiedad que no tiene tire y
 * quede anotado. `then` y los símbolos pasan: `await fake` y la inspección de
 * Node los piden sin que sea un error de nadie.
 */
export function estricto<T extends object>(nombre: string, impl: T): T {
  return new Proxy(impl, {
    get(objetivo, prop, receptor) {
      if (typeof prop === 'symbol' || prop === 'then' || prop in objetivo) {
        return Reflect.get(objetivo, prop, receptor);
      }
      const faltante = `${nombre}.${prop}`;
      faltasDelFake.push(faltante);
      throw new FaltaEnElFake(`${faltante} no está implementado en el fake de las evals`);
    },
  });
}

// ─── Roles ───────────────────────────────────────────────────────────────────

/**
 * Los permisos del rol Empleado por defecto. ESPEJO de ROLE_PERMISSIONS en
 * src/onboarding/onboarding.service.ts (no está exportado); el unit test de
 * las evals compara las dos listas leyendo ese archivo.
 */
export const PERMISOS_EMPLEADO = [
  'orders.view', 'customers.view', 'inventory.view', 'catalog.view', 'config.team.view',
  'messages.view', 'messages.manage',
];

export type Rol = 'dueno' | 'empleado';

export function usuarioDelRol(rol: Rol): { memberId: string; roleName: string; permissions: string[] } {
  return rol === 'dueno'
    ? { memberId: MIEMBRO_DUENO_ID, roleName: 'owner', permissions: [] }
    : { memberId: MIEMBRO_EMPLEADO_ID, roleName: 'empleado', permissions: PERMISOS_EMPLEADO };
}

/** Los permisos EFECTIVOS, con la misma función que usa el chat (el dueño pasa siempre). */
export function permisosDelRol(rol: Rol): string[] {
  return permisosDeOrbi(usuarioDelRol(rol));
}

// ─── Snapshots (semántica de ModuleDataService) ──────────────────────────────

export function snapshotsDe(d: NegocioDePrueba): Record<string, ModuleSnapshot> {
  const inicioMes = inicioDeMesArgentina(d.ahora);
  const inicioMesAnterior = inicioDeMesArgentina(d.ahora, -1);
  const delMes = d.pedidos.filter((p) => p.creadoEl >= inicioMes);
  const delMesAnterior = d.pedidos.filter((p) => p.creadoEl >= inicioMesAnterior && p.creadoEl < inicioMes);

  const resumir = (ps: PedidoConFecha[]) => {
    const ventas = ps.filter(esVenta);
    return {
      total: redondear(ventas.reduce((s, p) => s + p.total, 0)),
      count: ventas.length,
      cancelled: ps.length - ventas.length,
    };
  };
  const mes = resumir(delMes);
  const anterior = resumir(delMesAnterior);

  const dashboard: DashboardSnapshot = {
    salesThisMonth: { total: mes.total, count: mes.count, avgTicket: mes.count > 0 ? redondear(mes.total / mes.count) : 0 },
    salesLastMonth: { total: anterior.total, count: anterior.count },
    pendingOrders: delMes.filter((p) => p.estado === 'PENDING').length,
    cancelledThisMonth: mes.cancelled,
    totalProducts: d.productos.length,
    // ESPEJO de un bug real: ModuleDataService cuenta status OUT_OF_STOCK, que
    // la API nunca escribe, así que en producción esto da 0 aunque haya
    // productos con stock 0. Se mide lo que hay (caso datos-sin-stock).
    outOfStockProducts: 0,
    totalCustomers: d.clientes.length,
    newCustomersThisMonth: d.clientes.filter((c) => c.creadoEl >= inicioMes).length,
    unreadMessages: d.conversaciones.sinLeer,
  };

  const countByStatus: Record<string, number> = {};
  for (const p of d.pedidos) countByStatus[p.estado] = (countByStatus[p.estado] ?? 0) + 1;
  const pendientes = d.pedidos.filter((p) => p.estado === 'PENDING');
  const masViejo = pendientes.reduce<PedidoConFecha | null>((a, p) => (!a || p.creadoEl < a.creadoEl ? p : a), null);
  const ultimo = d.pedidos.reduce((a, p) => (p.creadoEl > a.creadoEl ? p : a));
  const porMedio = new Map<string, number>();
  for (const p of d.pedidos) porMedio.set(p.pago.medio, (porMedio.get(p.pago.medio) ?? 0) + 1);
  const pedidos: PedidosSnapshot = {
    countByStatus,
    oldestPendingHours: masViejo ? Math.round((d.ahora.getTime() - masViejo.creadoEl.getTime()) / HORA_MS) : null,
    avgTicketThisMonth: mes.count > 0 ? redondear(mes.total / mes.count) : 0,
    lastOrderDate: ultimo.creadoEl.toISOString().split('T')[0],
    topPaymentMethod: [...porMedio.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };

  // Agrupado por cliente con TODOS sus pedidos, cancelados incluidos (así lo
  // hace el groupBy de ModuleDataService).
  const porCliente = new Map<string, { n: number; total: number }>();
  for (const p of d.pedidos) {
    if (!p.clienteId) continue;
    const a = porCliente.get(p.clienteId) ?? { n: 0, total: 0 };
    porCliente.set(p.clienteId, { n: a.n + 1, total: a.total + p.total });
  }
  const ordenados = [...porCliente.entries()].sort((a, b) => b[1].total - a[1].total);
  const vipCut = Math.ceil(ordenados.length * 0.1);
  let vip = 0;
  let recurrent = 0;
  let nuevos = 0;
  ordenados.forEach(([, r], i) => {
    if (i < vipCut) vip++;
    else if (r.n >= 2) recurrent++;
    else nuevos++;
  });
  const hace60 = new Date(d.ahora.getTime() - 60 * DIA_MS);
  const inactivos = d.clientes.filter((c) => {
    const suyos = d.pedidos.filter((p) => p.clienteId === c.id);
    return suyos.length > 0 && !suyos.some((p) => p.creadoEl >= hace60);
  }).length;
  const top = ordenados[0] ? d.clientes.find((c) => c.id === ordenados[0][0]) : undefined;
  const clientes: ClientesSnapshot = {
    totalCustomers: d.clientes.length,
    newThisMonth: dashboard.newCustomersThisMonth,
    segmentation: { vip, recurrent, new: nuevos, inactive: inactivos },
    topCustomerName: top ? nombreDeCliente(top) : null,
  };

  const catalogo: CatalogoSnapshot = {
    totalProducts: d.productos.length,
    publishedProducts: d.productos.filter((p) => p.estado === 'PUBLISHED').length,
    draftProducts: d.productos.filter((p) => p.estado === 'DRAFT').length,
    outOfStock: 0, // mismo bug que outOfStockProducts, arriba
    totalCategories: d.categorias.length,
    emptyCategories: d.categorias.filter((c) => !d.productos.some((p) => p.categoriaId === c.id)).length,
    avgPrice: redondear(d.productos.reduce((s, p) => s + p.precio, 0) / d.productos.length),
  };

  const mensajes: MensajesSnapshot = {
    unreadCount: d.conversaciones.sinLeer,
    totalConversations: d.conversaciones.total,
    avgResponseTimeHours: null,
  };

  return { dashboard, pedidos, clientes, catalogo, mensajes };
}

// ─── Reportes (semántica de ReportsService) ──────────────────────────────────

const variacion = (curr: number, prev: number) =>
  prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : curr > 0 ? 100 : 0;

function reportes(d: NegocioDePrueba) {
  const nombreCategoria = (id: string) => d.categorias.find((c) => c.id === id)?.nombre ?? null;

  const resumenDe = (desde: Date, hasta: Date | null) => {
    const ps = d.pedidos.filter((p) => p.creadoEl >= desde && (hasta === null || p.creadoEl < hasta));
    const ventas = ps.filter(esVenta);
    const bruto = ventas.reduce((s, p) => s + p.total, 0);
    return {
      ventas: redondear(bruto),
      pedidos: ventas.length,
      ticketPromedio: ventas.length > 0 ? redondear(bruto / ventas.length) : 0,
      tasaCancelacion: ps.length > 0 ? Math.round(((ps.length - ventas.length) / ps.length) * 1000) / 10 : 0,
    };
  };

  /** Unidades e importe por producto de los pedidos vendidos en [desde, hasta). */
  const vendidos = (desde: Date, hasta: Date | null) => {
    const acum = new Map<string, { unidades: number; importe: number }>();
    for (const p of d.pedidos.filter((x) => esVenta(x) && x.creadoEl >= desde && (hasta === null || x.creadoEl < hasta))) {
      for (const it of p.items) {
        const a = acum.get(it.productoId) ?? { unidades: 0, importe: 0 };
        acum.set(it.productoId, { unidades: a.unidades + it.cantidad, importe: a.importe + it.cantidad * precioDe(it.productoId) });
      }
    }
    return acum;
  };

  return {
    async sales(_businessId: string) {
      const inicioMes = inicioDeMesArgentina(d.ahora);
      const inicioMesPasado = inicioDeMesArgentina(d.ahora, -1);
      const actual = resumenDe(inicioMes, null);
      const anterior = resumenDe(inicioMesPasado, inicioMes);
      return {
        mes: inicioMes.toISOString(),
        actual,
        anterior,
        deltas: {
          ventas: variacion(actual.ventas, anterior.ventas),
          pedidos: variacion(actual.pedidos, anterior.pedidos),
          ticketPromedio: variacion(actual.ticketPromedio, anterior.ticketPromedio),
          tasaCancelacion: Math.round((actual.tasaCancelacion - anterior.tasaCancelacion) * 10) / 10,
        },
      };
    },

    async products(_businessId: string, days = 30) {
      const acum = vendidos(new Date(d.ahora.getTime() - days * DIA_MS), null);
      const masVendidos = d.productos
        .map((p) => ({ id: p.id, name: p.nombre, categoryName: nombreCategoria(p.categoriaId), primaryImageUrl: null, unidades: acum.get(p.id)?.unidades ?? 0, importe: redondear(acum.get(p.id)?.importe ?? 0) }))
        .filter((p) => p.unidades > 0)
        .sort((a, b) => b.unidades - a.unidades)
        .slice(0, 10);
      const sinRotacion = d.productos
        .filter((p) => p.estado === 'PUBLISHED' && !acum.has(p.id) && p.stock > 0)
        .map((p) => ({ id: p.id, name: p.nombre, categoryName: nombreCategoria(p.categoriaId), primaryImageUrl: null, stock: p.stock }))
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 10);
      // Forma y filtro de ReportsService#products: cualquier estado, stock
      // mínimo 5 para todos (el dataset no modela variantes ni costo), de menor
      // a mayor, hasta 20.
      const stockCritico = d.productos
        .filter((p) => p.stock <= 5)
        .map((p) => ({ productId: p.id, productName: p.nombre, variantId: p.id, sku: null, variantLabel: null, primaryImageUrl: null, cantidad: p.stock, stockMin: 5 }))
        .sort((a, b) => a.cantidad - b.cantidad)
        .slice(0, 20);
      // Solo categorías con productos, con su id (el real lo devuelve: es una
      // de las formas que tiene el modelo de conseguir el id de una categoría).
      // Sin costo cargado, el valor es a precio de venta, como el real.
      const porCategoria = d.categorias
        .map((c) => {
          const suyos = d.productos.filter((p) => p.categoriaId === c.id);
          return { id: c.id, name: c.nombre, productos: suyos.length, valor: suyos.reduce((s, p) => s + p.precio * p.stock, 0) };
        })
        .filter((c) => c.productos > 0)
        .sort((a, b) => b.productos - a.productos);
      const unidadesVendidas = [...acum.values()].reduce((s, a) => s + a.unidades, 0);
      return {
        periodoDias: days,
        resumen: {
          productosVendidos: acum.size,
          unidadesVendidas,
          importeVendido: redondear([...acum.values()].reduce((s, a) => s + a.importe, 0)),
          variantesConVenta: acum.size,
        },
        masVendidos,
        sinRotacion,
        stockCritico,
        porCategoria,
      };
    },

    async customers(_businessId: string) {
      const inicioMes = inicioDeMesArgentina(d.ahora);
      const inicioMesPasado = inicioDeMesArgentina(d.ahora, -1);
      const hace30 = new Date(d.ahora.getTime() - 30 * DIA_MS);
      const hace90 = new Date(d.ahora.getTime() - 90 * DIA_MS);
      const resumen = new Map<string, { pedidos: number; gastado: number; ultima: Date }>();
      for (const p of d.pedidos.filter(esVenta)) {
        if (!p.clienteId) continue;
        const a = resumen.get(p.clienteId);
        resumen.set(p.clienteId, {
          pedidos: (a?.pedidos ?? 0) + 1,
          gastado: (a?.gastado ?? 0) + p.total,
          ultima: !a || p.creadoEl > a.ultima ? p.creadoEl : a.ultima,
        });
      }
      const gastos = [...resumen.values()].map((r) => r.gastado).sort((a, b) => a - b);
      const umbralVip = gastos.length > 0 ? gastos[Math.min(gastos.length - 1, Math.floor(gastos.length * 0.85))] : Infinity;
      const segmentoDe = (creadoEl: Date, r?: { pedidos: number; gastado: number; ultima: Date }) => {
        if (!r || r.pedidos === 0) return creadoEl >= hace30 ? 'nuevo' : 'inactivo';
        if (r.ultima < hace90) return 'inactivo';
        if (r.pedidos >= 2 && r.gastado >= umbralVip && umbralVip > 0) return 'vip';
        if (r.pedidos >= 2) return 'recurrente';
        return 'nuevo';
      };
      const segmentacion = { vip: 0, recurrente: 0, nuevo: 0, inactivo: 0 };
      const filas = d.clientes.map((c) => {
        const r = resumen.get(c.id);
        const segmento = segmentoDe(c.creadoEl, r);
        segmentacion[segmento]++;
        return {
          id: c.id,
          nombre: nombreDeCliente(c),
          pedidos: r?.pedidos ?? 0,
          gastado: redondear(r?.gastado ?? 0),
          ultimaCompra: r ? r.ultima.toISOString() : null,
          creadoEl: c.creadoEl.toISOString(),
          segmento,
        };
      });
      const compradores = [...resumen.values()];
      const nuevosMes = d.clientes.filter((c) => c.creadoEl >= inicioMes).length;
      const nuevosMesPasado = d.clientes.filter((c) => c.creadoEl >= inicioMesPasado && c.creadoEl < inicioMes).length;
      return {
        metricas: {
          activos: compradores.filter((r) => r.ultima >= hace90).length,
          nuevosMes,
          deltaNuevosMes: nuevosMes - nuevosMesPasado,
          recurrentesPct: compradores.length > 0 ? Math.round((compradores.filter((r) => r.pedidos >= 2).length / compradores.length) * 1000) / 10 : 0,
          ltvPromedio: compradores.length > 0 ? redondear(compradores.reduce((s, r) => s + r.gastado, 0) / compradores.length) : 0,
          totalClientes: d.clientes.length,
        },
        nuevosPorSemana: [],
        segmentacion: (['vip', 'recurrente', 'nuevo', 'inactivo'] as const).map((s) => ({ segmento: s, cantidad: segmentacion[s] })),
        topClientes: [...filas].sort((a, b) => b.gastado - a.gastado).slice(0, 5),
        clientes: filas,
      };
    },

    /**
     * El dashboard del Inicio para un rango (mismo contrato que
     * ReportsService.dashboard: `to` inclusivo a nivel día, sin rango = hoy,
     * días de Argentina). Lo usa la tool de período.
     */
    async dashboard(_businessId: string, fromISO?: string, toISO?: string) {
      const soloDia = /^\d{4}-\d{2}-\d{2}$/;
      const inicioHoy = inicioDeDiaArgentina(fechaArgentina(d.ahora));
      const dia = (s: string) => (soloDia.test(s) ? inicioDeDiaArgentina(s) : new Date(s));
      const desde = fromISO ? dia(fromISO) : inicioHoy;
      const hastaExcl = new Date((toISO ? dia(toISO) : inicioHoy).getTime() + DIA_MS);
      if (isNaN(desde.getTime()) || isNaN(hastaExcl.getTime()) || desde >= hastaExcl) {
        throw new BadRequestException('Rango de fechas inválido');
      }
      if (hastaExcl.getTime() - desde.getTime() > 400 * DIA_MS) {
        throw new BadRequestException('El rango puede ser de hasta 400 días');
      }
      const desdeAnterior = new Date(desde.getTime() - (hastaExcl.getTime() - desde.getTime()));
      const kpisDe = (gte: Date, lt: Date) => {
        const ps = d.pedidos.filter((p) => p.creadoEl >= gte && p.creadoEl < lt);
        const ventas = ps.filter(esVenta);
        const bruto = ventas.reduce((s, p) => s + p.total, 0);
        return {
          ventas: redondear(bruto),
          pedidos: ventas.length,
          ticketPromedio: ventas.length > 0 ? redondear(bruto / ventas.length) : 0,
          clientesNuevos: d.clientes.filter((c) => c.creadoEl >= gte && c.creadoEl < lt).length,
          pedidosPendientes: ventas.filter((p) => p.estado === 'PENDING').length,
          comisionMp: 0,
          visitas: 0,
          visitasDominio: 0,
          visitasSubdominio: 0,
        };
      };
      const actual = kpisDe(desde, hastaExcl);
      const anterior = kpisDe(desdeAnterior, desde);
      const acum = vendidos(desde, hastaExcl);
      const topProductos = [...acum.entries()]
        .map(([id, a]) => ({ id, name: d.productos.find((p) => p.id === id)!.nombre, img: null, unidades: a.unidades, importe: redondear(a.importe) }))
        .sort((a, b) => b.unidades - a.unidades)
        .slice(0, 5);
      const porCategoria = new Map<string, number>();
      for (const [id, a] of acum) {
        const nombre = nombreCategoria(d.productos.find((p) => p.id === id)!.categoriaId) ?? 'Sin categoría';
        porCategoria.set(nombre, (porCategoria.get(nombre) ?? 0) + a.unidades);
      }
      // ESPEJO de ReportsService: el canal suma solo los pedidos de la serie
      // de dos semanas (desde hoy − 13 días), aunque el rango sea más largo.
      const inicioSerieAnterior = new Date(inicioHoy.getTime() - 13 * DIA_MS);
      const enRango = d.pedidos.filter((p) => esVenta(p) && p.creadoEl >= inicioSerieAnterior && p.creadoEl >= desde && p.creadoEl < hastaExcl);
      return {
        desde: desde.toISOString(),
        hasta: new Date(hastaExcl.getTime() - 1).toISOString(),
        kpis: {
          ...actual,
          visitasTotal: 0,
          visitasTotalDominio: 0,
          visitasTotalSubdominio: 0,
          deltas: {
            ventas: variacion(actual.ventas, anterior.ventas),
            pedidos: variacion(actual.pedidos, anterior.pedidos),
            ticketPromedio: variacion(actual.ticketPromedio, anterior.ticketPromedio),
            clientesNuevos: variacion(actual.clientesNuevos, anterior.clientesNuevos),
            comisionMp: 0,
            visitas: 0,
          },
        },
        alertas: {
          stockCritico: d.productos.filter((p) => p.estado === 'PUBLISHED' && p.stock <= 5).length,
          pagosPorConfirmar: d.pedidos.filter((p) => p.estado !== 'CANCELLED' && p.pago.medio === 'TRANSFER' && p.pago.estado === 'PENDING').length,
          pedidosPendientes: d.pedidos.filter((p) => p.estado === 'PENDING').length,
          pedidosSinAtender: d.pedidos.filter((p) => p.estado === 'PENDING' && p.creadoEl < new Date(d.ahora.getTime() - 2 * HORA_MS)).length,
        },
        serieSemana: { labels: [], valores: [], totalAnterior: 0 },
        top: {
          productos: topProductos,
          categorias: [...porCategoria.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5),
          canal: [
            { label: 'Tienda', value: redondear(enRango.filter((p) => p.origen !== 'MANUAL').reduce((s, p) => s + p.total, 0)) },
            { label: 'Manual', value: redondear(enRango.filter((p) => p.origen === 'MANUAL').reduce((s, p) => s + p.total, 0)) },
          ],
        },
        // Los últimos 5 pedidos, con el nombre del cliente: texto de terceros.
        actividad: [...d.pedidos]
          .sort((a, b) => b.creadoEl.getTime() - a.creadoEl.getTime())
          .slice(0, 5)
          .map((p) => ({
            id: p.id,
            orderNumber: p.numero,
            customerName: p.nombreCliente,
            total: p.total,
            status: p.estado,
            createdAt: p.creadoEl.toISOString(),
            productos: p.items.map((it) => `${it.cantidad}× ${d.productos.find((x) => x.id === it.productoId)!.nombre}`).join(' · '),
          })),
      };
    },
  };
}

// ─── Los demás services ──────────────────────────────────────────────────────

const contiene = (texto: string | null | undefined, busqueda: string) =>
  !!texto && texto.toLowerCase().includes(busqueda.toLowerCase());

function noEncontrado(que: string): never {
  throw new NotFoundException(`${que} no encontrado`);
}

export type Fakes = ReturnType<typeof armarFakes>;

export function armarFakes(d: NegocioDePrueba) {
  const nombreCategoria = (id: string) => d.categorias.find((c) => c.id === id)?.nombre ?? null;
  const metricasDe = (clienteId: string) => {
    const suyos = d.pedidos.filter((p) => p.clienteId === clienteId && esVenta(p));
    const gastado = suyos.reduce((s, p) => s + p.total, 0);
    const ultima = suyos.reduce<Date | null>((a, p) => (!a || p.creadoEl > a ? p.creadoEl : a), null);
    return {
      orderCount: suyos.length,
      totalSpent: redondear(gastado),
      avgTicket: suyos.length > 0 ? redondear(gastado / suyos.length) : 0,
      lastOrderAt: ultima,
    };
  };

  const products = estricto('ProductsService', {
    async findAll(_businessId: string, q: { search?: string; limit?: number; page?: number }) {
      // Más nuevos primero, como ProductsService#findAll (createdAt desc).
      const filtrados = d.productos
        .filter((p) => !q.search || contiene(p.nombre, q.search))
        .sort((a, b) => a.creadoHaceHoras - b.creadoHaceHoras);
      return {
        data: filtrados.slice(0, q.limit ?? 20).map((p) => ({
          id: p.id,
          name: p.nombre,
          basePrice: p.precio,
          totalStock: p.stock,
          status: p.estado,
          categoryName: nombreCategoria(p.categoriaId),
        })),
        total: filtrados.length,
      };
    },
  });

  const orders = estricto('OrdersService', {
    async findAll(_businessId: string, q: { status?: string; search?: string; page?: number; limit?: number }) {
      // La búsqueda de OrdersService#findAll: nombre, apellido o email de la
      // ficha del cliente, o el nombre del comprador sin cuenta, o el número
      // EXACTO de pedido (hasta 9 dígitos). El # del principio se ignora.
      const s = q.search?.trim().replace(/^#/, '');
      const coincide = (p: PedidoConFecha) => {
        if (!s) return true;
        const cliente = p.clienteId ? d.clientes.find((c) => c.id === p.clienteId) : undefined;
        if (cliente && (contiene(cliente.nombre, s) || contiene(cliente.apellido, s) || contiene(cliente.email, s))) return true;
        if (p.comprador && contiene(p.comprador, s)) return true;
        return /^\d{1,9}$/.test(s) && p.numero === Number(s);
      };
      const filtrados = [...d.pedidos]
        .filter((p) => !q.status || p.estado === q.status)
        .filter(coincide)
        .sort((a, b) => b.creadoEl.getTime() - a.creadoEl.getTime());
      return {
        data: filtrados.slice(0, q.limit ?? 20).map((p) => ({
          id: p.id,
          orderNumber: p.numero,
          status: p.estado,
          customerName: p.nombreCliente,
          total: p.total,
          createdAt: p.creadoEl,
        })),
        total: filtrados.length,
      };
    },
    async findOne(_businessId: string, id: string) {
      const p = d.pedidos.find((x) => x.id === id) ?? noEncontrado('Pedido');
      const cliente = p.clienteId ? d.clientes.find((c) => c.id === p.clienteId) : undefined;
      return {
        id: p.id,
        orderNumber: p.numero,
        status: p.estado,
        channel: 'ONLINE',
        // lastName puede ser null, como en la base.
        customer: cliente ? { firstName: cliente.nombre, lastName: cliente.apellido } : null,
        total: p.total,
        createdAt: p.creadoEl,
        items: p.items.map((it) => ({
          productName: d.productos.find((x) => x.id === it.productoId)!.nombre,
          quantity: it.cantidad,
          unitPrice: precioDe(it.productoId),
          editedPrice: null,
        })),
        payments: [{ method: p.pago.medio, status: p.pago.estado, amount: p.total }],
        returns: [],
        cancellationRequests: [],
      };
    },
  });

  const customers = estricto('CustomersService', {
    async findAll(_businessId: string, q: { search?: string; page?: number; limit?: number }) {
      // Más nuevos primero, como CustomersService#findAll (createdAt desc): el
      // cliente con la inyección (el más reciente) sale primero, como en la base.
      const filtrados = d.clientes
        .filter((c) => !q.search || contiene(c.nombre, q.search) || contiene(c.apellido, q.search) || contiene(c.email, q.search))
        .sort((a, b) => b.creadoEl.getTime() - a.creadoEl.getTime());
      return {
        data: filtrados.slice(0, q.limit ?? 20).map((c) => ({
          id: c.id,
          firstName: c.nombre,
          lastName: c.apellido,
          email: c.email,
          phone: c.telefono,
          dni: undefined,
          hasAccount: c.tieneCuenta,
          ...metricasDe(c.id),
          createdAt: c.creadoEl,
        })),
        total: filtrados.length,
      };
    },
    async findOne(_businessId: string, id: string) {
      const c = d.clientes.find((x) => x.id === id) ?? noEncontrado('Cliente');
      return {
        id: c.id,
        firstName: c.nombre,
        lastName: c.apellido,
        hasAccount: c.tieneCuenta,
        ...metricasDe(c.id),
        createdAt: c.creadoEl,
        orders: d.pedidos
          .filter((p) => p.clienteId === c.id)
          .sort((a, b) => b.creadoEl.getTime() - a.creadoEl.getTime())
          .slice(0, 10)
          .map((p) => ({
            id: p.id,
            orderNumber: p.numero,
            channel: 'ONLINE',
            status: p.estado,
            total: p.total,
            itemCount: p.items.reduce((s, it) => s + it.cantidad, 0),
            createdAt: p.creadoEl,
          })),
        addresses: c.localidad ? [{ city: c.localidad }] : [],
      };
    },
  });

  const discounts = estricto('DiscountsService', {
    async findAll(_businessId: string, q: { search?: string; page?: number; limit?: number }) {
      const filtrados = d.descuentos.filter((x) => !q.search || contiene(x.nombre, q.search));
      return {
        data: filtrados.slice(0, q.limit ?? 10).map((x) => ({ id: x.id, name: x.nombre, type: x.tipo, value: x.valor, estado: x.estado })),
        total: filtrados.length,
      };
    },
  });

  const reports = estricto('ReportsService', reportes(d));

  const productAi = estricto('ProductAiService', {
    // El real sugiere el id de una categoría del negocio que matchee el
    // producto (validado contra las categorías): acá, la que aparece en el
    // nombre ("Bombilla de Caña" → Bombillas).
    async assist(_businessId: string, dto: { name: string }) {
      const nombre = dto.name.toLowerCase();
      const categoria = d.categorias.find((c) => nombre.includes(c.nombre.toLowerCase().replace(/s$/, '')));
      return {
        description: `${dto.name}: descripción generada para la eval.`,
        suggestedTags: [],
        suggestedSpecs: [],
        suggestedCategoryId: categoria?.id ?? null,
      };
    },
  });

  const cuota = estricto('CuotaService', {
    async consumir() {
      return true;
    },
  });

  // Solo lo que leen ContextBuilderService y los describirAccion de las
  // escrituras. Siempre acotado al negocio, como la base.
  const prisma = estricto('PrismaService', {
    business: estricto('prisma.business', {
      async findUnique(args: { where: { id: string } }) {
        return args.where.id === BUSINESS_ID
          ? { name: d.negocio.nombre, industry: d.negocio.rubro, mode: d.negocio.modo, isActive: ESTADO_DEL_ALTA.publicada, isPaused: false }
          : null;
      },
    }),
    subscription: estricto('prisma.subscription', {
      async findUnique(args: { where: { businessId: string } }) {
        return args.where.businessId === BUSINESS_ID && ESTADO_DEL_ALTA.suscripcion ? { id: 'sub-1' } : null;
      },
    }),
    member: estricto('prisma.member', {
      async findFirst(args: { where: { id: string; businessId: string } }) {
        return args.where.businessId === BUSINESS_ID ? { emailVerified: ESTADO_DEL_ALTA.emailVerificado } : null;
      },
      // accesoDelEquipo: búsqueda por nombre o email, SIEMPRE dentro del negocio.
      async findMany(args: { where: { businessId: string; OR: { name?: { contains: string }; email?: { contains: string } }[] } }) {
        if (args.where.businessId !== BUSINESS_ID) return [];
        const q = (args.where.OR[0]?.name?.contains ?? '').toLowerCase();
        return EQUIPO
          .filter((m) => m.nombre.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
          .map((m) => ({
            name: m.nombre,
            status: m.estado,
            role: {
              name: m.rol,
              rolePermissions: (m.rol === 'owner' ? [] : PERMISOS_EMPLEADO).map((code) => ({ permission: { code } })),
            },
          }));
      },
    }),
    order: estricto('prisma.order', {
      async findFirst(args: { where: { id: string; businessId: string } }) {
        if (args.where.businessId !== BUSINESS_ID) return null;
        const p = d.pedidos.find((x) => x.id === args.where.id);
        if (!p) return null;
        const cliente = p.clienteId ? d.clientes.find((c) => c.id === p.clienteId) : undefined;
        return {
          orderNumber: p.numero,
          status: p.estado,
          customer: cliente ? { firstName: cliente.nombre, lastName: cliente.apellido, email: cliente.email } : null,
          onlineOrderDetails: p.comprador ? { buyerName: p.comprador, buyerEmail: null } : null,
          payments: [{ method: p.pago.medio, status: p.pago.estado }],
        };
      },
    }),
    category: estricto('prisma.category', {
      async findFirst(args: { where: { id: string; businessId: string } }) {
        if (args.where.businessId !== BUSINESS_ID) return null;
        const c = d.categorias.find((x) => x.id === args.where.id);
        return c ? { name: c.nombre } : null;
      },
    }),
  });

  const snapshots = snapshotsDe(d);
  const moduleData = estricto('ModuleDataService', {
    async getSnapshot(_businessId: string, modulo: string): Promise<ModuleSnapshot> {
      return snapshots[modulo] ?? {};
    },
  });

  const businesses = estricto('BusinessesService', {
    async getTutorial(_businessId: string) {
      return { tutorial: null, cumplidas: [...ESTADO_DEL_ALTA.cumplidas] };
    },
  });
  const coupons = estricto('CouponsService', {});

  return { products, orders, customers, discounts, coupons, reports, productAi, cuota, prisma, moduleData, businesses, snapshots };
}

// ─── Armado de las piezas reales ─────────────────────────────────────────────

/**
 * Las clases de tools del panel que registra OrbiModule, en el MISMO orden
 * (el orden de las tools en el request puede cambiar lo que elige el modelo).
 * El unit test lo compara contra orbi.module.ts: si se suma una tool al panel y
 * no acá, la eval mediría un Orbi con menos herramientas.
 */
export const TOOLS_DEL_PANEL = [
  'NavigationTool', 'LeerTemaDelManualTool',
  'ListProductsTool', 'CreateProductTool', 'GenerateDescriptionTool',
  'ListDiscountsTool', 'CreateDiscountTool', 'CreateCouponTool',
  'ListOrdersTool', 'GetOrderDetailTool', 'UpdateOrderStatusTool',
  'ListCustomersTool', 'GetCustomerDetailTool',
  'UpdateBusinessInfoTool', 'UpdatePaymentMethodsTool', 'UpdateShippingTool',
  'GetSalesReportTool', 'GetProductReportTool', 'GetCustomerReportTool',
  'EstadoPrimerosPasosTool', 'AccesoDelEquipoTool',
] as const;

export function armarRegistry(f: Fakes): ToolRegistryService {
  // `never`: los fakes implementan solo lo que la tool usa, no la clase entera.
  const n = <T>(x: unknown) => x as T as never;
  const registry = new ToolRegistryService();
  // El logger de Nest anuncia cada tool registrada: ruido en el reporte.
  (registry as unknown as { logger: { log: () => void } }).logger.log = () => undefined;

  registry.register(new NavigationTool());
  registry.register(new LeerTemaDelManualTool());

  registry.register(new ListProductsTool(n(f.products)));
  registry.register(new CreateProductTool(n(f.products), n(f.prisma)));
  registry.register(new GenerateDescriptionTool(n(f.productAi), n(f.cuota)));

  registry.register(new ListDiscountsTool(n(f.discounts)));
  registry.register(new CreateDiscountTool(n(f.discounts)));
  registry.register(new CreateCouponTool(n(f.coupons)));

  registry.register(new ListOrdersTool(n(f.orders)));
  registry.register(new GetOrderDetailTool(n(f.orders)));
  registry.register(new UpdateOrderStatusTool(n(f.orders), n(f.prisma)));

  registry.register(new ListCustomersTool(n(f.customers)));
  registry.register(new GetCustomerDetailTool(n(f.customers)));

  registry.register(new UpdateBusinessInfoTool(n(f.businesses)));
  registry.register(new UpdatePaymentMethodsTool(n(f.businesses)));
  registry.register(new UpdateShippingTool(n(f.businesses)));

  registry.register(new GetSalesReportTool(n(f.reports)));
  registry.register(new GetProductReportTool(n(f.reports)));
  registry.register(new GetCustomerReportTool(n(f.reports)));

  registry.register(new EstadoPrimerosPasosTool(n(f.businesses), n(f.prisma)));
  registry.register(new AccesoDelEquipoTool(n(f.prisma)));

  return registry;
}

export function armarContextBuilder(f: Fakes): ContextBuilderService {
  return new ContextBuilderService(f.prisma as never, f.moduleData as never);
}
