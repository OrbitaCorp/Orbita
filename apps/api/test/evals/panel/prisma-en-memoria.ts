/**
 * Una Prisma en memoria sobre el negocio de prueba, con lo justo para correr
 * el código REAL que lee la base en un turno de Orbi: ModuleDataService (el
 * snapshot que va al prompt), los describirAccion de las escrituras y las
 * tools de estado.
 *
 * Por qué no un fake por service: un fake reimplementa la lógica y se
 * desactualiza (la revisión de la fase 2 encontró varios). Con esto la lógica
 * es la de producción y lo único emulado son las consultas. Y mide la versión
 * del código que esté en el checkout: corriendo estas evals sobre main se
 * obtiene la línea de base de verdad, no una con los arreglos de la rama.
 *
 * Soporta: findMany, findFirst, findUnique, count, aggregate (_sum, _avg,
 * _max, _count) y groupBy (by de un campo, _count, _sum, _max, orderBy, take);
 * where con igualdad, null, not, in, notIn, gt/gte/lt/lte, equals y contains
 * (con mode insensitive), OR/AND/NOT, y relaciones (a uno: objeto o null; a muchos:
 * some/none/every); select anidado con where/orderBy/take en las relaciones.
 * Lo que no soporta se anota en faltasDelFake (error de infraestructura).
 */

import {
  BUSINESS_ID,
  CONVERSACIONES,
  EQUIPO,
  ESTADO_DEL_ALTA,
  MIEMBRO_DUENO_ID,
  MIEMBRO_EMPLEADO_ID,
  precioDe,
  type NegocioDePrueba,
} from './negocio-de-prueba';

type Fila = Record<string, unknown>;
type Relacion = { tabla: string; tipo: 'uno' | 'muchos'; local: string; remoto: string };

const RELACIONES: Record<string, Record<string, Relacion>> = {
  order: {
    customer: { tabla: 'customer', tipo: 'uno', local: 'customerId', remoto: 'id' },
    payments: { tabla: 'payment', tipo: 'muchos', local: 'id', remoto: 'orderId' },
    onlineOrderDetails: { tabla: 'onlineOrderDetails', tipo: 'uno', local: 'id', remoto: 'orderId' },
  },
  customer: { orders: { tabla: 'order', tipo: 'muchos', local: 'id', remoto: 'customerId' } },
  category: { products: { tabla: 'product', tipo: 'muchos', local: 'id', remoto: 'categoryId' } },
  product: { variants: { tabla: 'variant', tipo: 'muchos', local: 'id', remoto: 'productId' } },
  variant: { stock: { tabla: 'variantStock', tipo: 'muchos', local: 'id', remoto: 'variantId' } },
  member: { role: { tabla: 'role', tipo: 'uno', local: 'roleId', remoto: 'id' } },
  role: { rolePermissions: { tabla: 'rolePermission', tipo: 'muchos', local: 'id', remoto: 'roleId' } },
  rolePermission: { permission: { tabla: 'permission', tipo: 'uno', local: 'permissionId', remoto: 'id' } },
};

export class ConsultaNoSoportada extends Error {}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !(v instanceof Date) && !Array.isArray(v);
const valor = (v: unknown) => (v instanceof Date ? v.getTime() : v);

export function crearTablas(d: NegocioDePrueba): Record<string, Fila[]> {
  const order = d.pedidos.map((p) => ({
    id: p.id, businessId: BUSINESS_ID, orderNumber: p.numero, status: p.estado, total: p.total,
    createdAt: p.creadoEl, deletedAt: null, customerId: p.clienteId, origin: p.origen, channel: 'ONLINE',
  }));
  const productos = d.productos.map((p) => ({
    id: p.id, businessId: BUSINESS_ID, name: p.nombre, status: p.estado, basePrice: p.precio, cost: null,
    deletedAt: null, categoryId: p.categoriaId, createdAt: new Date(d.ahora.getTime() - p.creadoHaceHoras * 3_600_000),
  }));
  const roles = [{ id: 'rol-owner', businessId: BUSINESS_ID, name: 'owner' }, { id: 'rol-empleado', businessId: BUSINESS_ID, name: 'empleado' }];
  // Los dos miembros del equipo son también los que preguntan en los casos (dueño y empleado).
  const idDe = (rol: string) => (rol === 'owner' ? MIEMBRO_DUENO_ID : MIEMBRO_EMPLEADO_ID);
  return {
    business: [{
      id: BUSINESS_ID, name: d.negocio.nombre, industry: d.negocio.rubro, mode: d.negocio.modo,
      isActive: ESTADO_DEL_ALTA.publicada, isPaused: false, cancelledAt: null,
    }],
    order,
    onlineOrderDetails: d.pedidos.filter((p) => p.comprador).map((p) => ({ orderId: p.id, buyerName: p.comprador, buyerEmail: null })),
    payment: d.pedidos.map((p) => ({
      id: `pago-${p.numero}`, businessId: BUSINESS_ID, orderId: p.id, method: p.pago.medio, status: p.pago.estado,
      amount: p.total, mpFeeAmount: null, paidAt: p.pago.estado === 'APPROVED' ? p.creadoEl : null,
    })),
    customer: d.clientes.map((c) => ({
      id: c.id, businessId: BUSINESS_ID, firstName: c.nombre, lastName: c.apellido, email: c.email, phone: c.telefono,
      deletedAt: null, createdAt: c.creadoEl, passwordHash: c.tieneCuenta ? 'hash' : null,
    })),
    product: productos,
    variant: d.productos.map((p) => ({ id: `var-${p.id}`, productId: p.id, isActive: true, price: precioDe(p.id) })),
    variantStock: d.productos.map((p) => ({ variantId: `var-${p.id}`, quantity: p.stock, stockMin: 5 })),
    category: d.categorias.map((c) => ({ id: c.id, businessId: BUSINESS_ID, name: c.nombre })),
    // El negocio de prueba no usa etiquetas: createProduct las resuelve contra esta lista vacía.
    tag: [],
    conversation: Array.from({ length: CONVERSACIONES.total }, (_, i) => ({
      id: `conv-${i}`, businessId: BUSINESS_ID, isUnread: i < CONVERSACIONES.sinLeer, isArchived: false,
    })),
    return: [],
    subscription: ESTADO_DEL_ALTA.suscripcion ? [{ id: 'sub-1', businessId: BUSINESS_ID }] : [],
    member: EQUIPO.map((m) => ({
      id: idDe(m.rol), businessId: BUSINESS_ID, name: m.nombre, email: m.email, status: m.estado,
      roleId: `rol-${m.rol}`, emailVerified: ESTADO_DEL_ALTA.emailVerificado,
    })),
    role: roles,
    rolePermission: EQUIPO_PERMISOS.map((code) => ({ roleId: 'rol-empleado', permissionId: code })),
    permission: EQUIPO_PERMISOS.map((code) => ({ id: code, code })),
  };
}

// Los del rol Empleado por defecto (los mismos que PERMISOS_EMPLEADO de fakes.ts;
// el unit test compara las dos listas con onboarding.service.ts).
const EQUIPO_PERMISOS = [
  'orders.view', 'customers.view', 'inventory.view', 'catalog.view', 'config.team.view',
  'messages.view', 'messages.manage',
];

export function crearPrismaEnMemoria(tablas: Record<string, Fila[]>, anotarFalta: (que: string) => void) {
  const falta = (que: string): never => {
    anotarFalta(`prisma.${que}`);
    throw new ConsultaNoSoportada(`prisma.${que} no está soportado en la Prisma en memoria de las evals`);
  };

  const filasDe = (tabla: string) => tablas[tabla] ?? falta(tabla);

  const relacionadas = (tabla: string, fila: Fila, rel: Relacion): Fila[] =>
    filasDe(rel.tabla).filter((r) => fila[rel.local] != null && r[rel.remoto] === fila[rel.local]);

  function cumpleCampo(v: unknown, cond: unknown): boolean {
    if (cond === null) return v === null || v === undefined;
    if (!esObjeto(cond)) return valor(v) === valor(cond);
    for (const [op, x] of Object.entries(cond)) {
      switch (op) {
        case 'equals': {
          // Como Postgres: con mode 'insensitive', "ana" es igual a "Ana".
          const insensible = (cond as { mode?: string }).mode === 'insensitive' && typeof v === 'string' && typeof x === 'string';
          if (insensible ? (v as string).toLowerCase() !== (x as string).toLowerCase() : valor(v) !== valor(x)) return false;
          break;
        }
        case 'not': if (esObjeto(x) ? cumpleCampo(v, x) : (x === null ? v === null || v === undefined : valor(v) === valor(x))) return false; break;
        case 'in': if (!(x as unknown[]).map(valor).includes(valor(v))) return false; break;
        case 'notIn': if ((x as unknown[]).map(valor).includes(valor(v))) return false; break;
        case 'gt': if (!(v != null && (valor(v) as number) > (valor(x) as number))) return false; break;
        case 'gte': if (!(v != null && (valor(v) as number) >= (valor(x) as number))) return false; break;
        case 'lt': if (!(v != null && (valor(v) as number) < (valor(x) as number))) return false; break;
        case 'lte': if (!(v != null && (valor(v) as number) <= (valor(x) as number))) return false; break;
        case 'contains': {
          const insensible = (cond as { mode?: string }).mode === 'insensitive';
          const a = String(v ?? ''); const b = String(x);
          if (!(insensible ? a.toLowerCase().includes(b.toLowerCase()) : a.includes(b))) return false;
          break;
        }
        case 'mode': break;
        default: falta(`where.${op}`);
      }
    }
    return true;
  }

  function cumple(tabla: string, fila: Fila, where: unknown): boolean {
    if (!where) return true;
    for (const [k, cond] of Object.entries(where as Record<string, unknown>)) {
      if (k === 'OR') { if (!(cond as unknown[]).some((w) => cumple(tabla, fila, w))) return false; continue; }
      if (k === 'AND') { if (!(Array.isArray(cond) ? cond : [cond]).every((w) => cumple(tabla, fila, w))) return false; continue; }
      if (k === 'NOT') { if (cumple(tabla, fila, cond)) return false; continue; }
      const rel = RELACIONES[tabla]?.[k];
      if (rel) {
        const otras = relacionadas(tabla, fila, rel);
        if (rel.tipo === 'uno') {
          if (cond === null) { if (otras.length) return false; continue; }
          if (!otras.length || !cumple(rel.tabla, otras[0], cond)) return false;
          continue;
        }
        const c = cond as { some?: unknown; none?: unknown; every?: unknown };
        if (c.some !== undefined && !otras.some((o) => cumple(rel.tabla, o, c.some))) return false;
        if (c.none !== undefined && otras.some((o) => cumple(rel.tabla, o, c.none))) return false;
        if (c.every !== undefined && !otras.every((o) => cumple(rel.tabla, o, c.every))) return false;
        continue;
      }
      if (!cumpleCampo(fila[k], cond)) return false;
    }
    return true;
  }

  function ordenar(filas: Fila[], orderBy: unknown): Fila[] {
    if (!orderBy) return filas;
    const [campo, dir] = Object.entries(Array.isArray(orderBy) ? orderBy[0] : (orderBy as object))[0] as [string, string];
    return [...filas].sort((a, b) => {
      const x = valor(a[campo]) as number; const y = valor(b[campo]) as number;
      return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1);
    });
  }

  function proyectar(tabla: string, fila: Fila, select?: Record<string, unknown>): Fila {
    if (!select) return { ...fila };
    const out: Fila = {};
    for (const [k, s] of Object.entries(select)) {
      if (!s) continue;
      const rel = RELACIONES[tabla]?.[k];
      if (!rel) { out[k] = fila[k]; continue; }
      const opciones = (s === true ? {} : s) as { select?: Record<string, unknown>; where?: unknown; orderBy?: unknown; take?: number };
      let otras = relacionadas(tabla, fila, rel).filter((o) => cumple(rel.tabla, o, opciones.where));
      if (rel.tipo === 'uno') { out[k] = otras[0] ? proyectar(rel.tabla, otras[0], opciones.select) : null; continue; }
      otras = ordenar(otras, opciones.orderBy);
      if (opciones.take !== undefined) otras = otras.slice(0, opciones.take);
      out[k] = otras.map((o) => proyectar(rel.tabla, o, opciones.select));
    }
    return out;
  }

  type Args = { where?: unknown; select?: Record<string, unknown>; orderBy?: unknown; take?: number; skip?: number };

  function modelo(tabla: string) {
    const buscar = (a: Args = {}) => {
      let filas = filasDe(tabla).filter((f) => cumple(tabla, f, a.where));
      filas = ordenar(filas, a.orderBy);
      if (a.skip) filas = filas.slice(a.skip);
      if (a.take !== undefined) filas = filas.slice(0, a.take);
      return filas;
    };
    const metodos = {
      async findMany(a: Args = {}) { return buscar(a).map((f) => proyectar(tabla, f, a.select)); },
      async findFirst(a: Args = {}) { const f = buscar({ ...a, take: 1 })[0]; return f ? proyectar(tabla, f, a.select) : null; },
      async findUnique(a: Args = {}) { const f = buscar({ ...a, take: 1 })[0]; return f ? proyectar(tabla, f, a.select) : null; },
      async count(a: Args = {}) { return buscar({ where: a.where }).length; },
      async aggregate(a: { where?: unknown; _sum?: Record<string, true>; _avg?: Record<string, true>; _max?: Record<string, true>; _count?: unknown }) {
        const filas = buscar({ where: a.where });
        const res: Record<string, unknown> = {};
        const num = (f: Fila, c: string) => (f[c] == null ? null : Number(valor(f[c])));
        if (a._sum) res._sum = Object.fromEntries(Object.keys(a._sum).map((c) => [c, filas.length ? filas.reduce((s, f) => s + (num(f, c) ?? 0), 0) : null]));
        if (a._avg) res._avg = Object.fromEntries(Object.keys(a._avg).map((c) => [c, filas.length ? filas.reduce((s, f) => s + (num(f, c) ?? 0), 0) / filas.length : null]));
        if (a._max) res._max = Object.fromEntries(Object.keys(a._max).map((c) => [c, filas.reduce<unknown>((m, f) => (m == null || (valor(f[c]) as number) > (valor(m) as number) ? f[c] : m), null)]));
        if (a._count) res._count = filas.length;
        return res;
      },
      async groupBy(a: { by: string[]; where?: unknown; _count?: unknown; _sum?: Record<string, true>; _max?: Record<string, true>; orderBy?: unknown; take?: number }) {
        if (a.by.length !== 1) falta(`${tabla}.groupBy con más de un campo`);
        const campo = a.by[0];
        const grupos = new Map<unknown, Fila[]>();
        for (const f of buscar({ where: a.where })) {
          const k = f[campo];
          grupos.set(k, [...(grupos.get(k) ?? []), f]);
        }
        let res = [...grupos.entries()].map(([k, filas]) => {
          const g: Record<string, unknown> = { [campo]: k };
          if (a._count) g._count = a._count === true ? filas.length : Object.fromEntries(Object.keys(a._count as object).map((c) => [c, filas.length]));
          if (a._sum) g._sum = Object.fromEntries(Object.keys(a._sum).map((c) => [c, filas.reduce((s, f) => s + Number(valor(f[c]) ?? 0), 0)]));
          if (a._max) g._max = Object.fromEntries(Object.keys(a._max).map((c) => [c, filas.reduce<unknown>((m, f) => (m == null || (valor(f[c]) as number) > (valor(m) as number) ? f[c] : m), null)]));
          return g;
        });
        // orderBy por el conteo ({ _count: { campo: 'desc' } }) o por el campo agrupado.
        const ob = (Array.isArray(a.orderBy) ? a.orderBy[0] : a.orderBy) as Record<string, unknown> | undefined;
        if (ob?._count) {
          const dir = Object.values(ob._count as object)[0];
          const n = (g: Record<string, unknown>) => (typeof g._count === 'number' ? g._count : Object.values(g._count as object)[0] as number);
          res = res.sort((x, y) => (n(x) - n(y)) * (dir === 'desc' ? -1 : 1));
        } else if (ob) {
          res = ordenar(res, ob) as typeof res;
        }
        if (a.take !== undefined) res = res.slice(0, a.take);
        return res;
      },
    };
    return new Proxy(metodos, {
      get(objetivo, prop, receptor) {
        if (typeof prop === 'symbol' || prop === 'then' || prop in objetivo) return Reflect.get(objetivo, prop, receptor);
        return falta(`${tabla}.${String(prop)}`);
      },
    });
  }

  const modelos = new Map<string, ReturnType<typeof modelo>>();
  return new Proxy({}, {
    get(_o, prop) {
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      if (!(prop in tablas)) return falta(String(prop));
      if (!modelos.has(prop)) modelos.set(prop, modelo(prop));
      return modelos.get(prop);
    },
  }) as Record<string, ReturnType<typeof modelo>>;
}
