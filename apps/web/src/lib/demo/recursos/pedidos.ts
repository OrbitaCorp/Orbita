// ─── Pedidos del panel demo: estado y envío, solo en el navegador ───────────
//
// El visitante puede mover un pedido de estado (Pendiente → Confirmado →
// Enviado…) y cargarle transportista y seguimiento: se guarda como parche en
// localStorage (recurso "orders") y se aplica sobre lo que devuelve la API, en
// el detalle, en la lista y en los contadores de las pestañas. Los efectos
// reales de un cambio de estado (stock, mails, reembolsos) no se simulan.
import type { ApiOrderDetail, ApiOrderStatus, ApiOrderSummary, ApiOrdersPage } from '@/lib/api'
import { apiReal, json, leerJson, registrar, type Pedido } from '../interceptor'
import { aplicarARegistro, editar, leerCapa } from '../almacen'

const RECURSO = 'orders'

type Parche = Partial<ApiOrderDetail> & {
  /** Estado que tenía en la base antes del primer cambio: para corregir los contadores. */
  estadoOriginal?: ApiOrderStatus
  /** Fila de la lista, para mostrarlo en la pestaña de su estado nuevo. */
  resumen?: ApiOrderSummary
}

// Filas vistas en la lista, para armar el `resumen` al cambiar el estado desde el detalle.
const filasVistas = new Map<string, ApiOrderSummary>()

async function detalleReal(p: Pedido, id: string): Promise<ApiOrderDetail | null> {
  const res = await apiReal(`/orders/${encodeURIComponent(id)}`, { headers: p.headers }).catch(() => null)
  return res ? leerJson<ApiOrderDetail>(res) : null
}

function resumenDe(d: ApiOrderDetail): ApiOrderSummary {
  const nombreCliente = d.customer ? [d.customer.firstName, d.customer.lastName].filter(Boolean).join(' ') : d.onlineOrderDetails?.buyerName ?? null
  return {
    id: d.id, orderNumber: d.orderNumber, channel: d.channel, origin: d.origin, status: d.status,
    customerId: d.customerId, customerName: nombreCliente,
    customerEmail: d.customer?.email ?? d.onlineOrderDetails?.buyerEmail ?? null,
    total: d.total, itemCount: d.items.reduce((a, i) => a + i.quantity, 0),
    items: d.items.map((i) => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice })),
    createdAt: d.createdAt,
    devolucionPendiente: false, devolucionAprobada: false, cancelacionPendiente: false, cancelacionMetodo: null,
  }
}

function sinInternos(d: ApiOrderDetail & Parche): ApiOrderDetail {
  const { estadoOriginal: _e, resumen: _r, ...resto } = d
  return resto
}

async function parchear(p: Pedido, id: string, cambios: (d: ApiOrderDetail) => Partial<ApiOrderDetail>): Promise<Response | ApiOrderDetail> {
  const real = await detalleReal(p, id)
  if (!real) return json({ message: 'Pedido no encontrado' }, 404)
  const actual = aplicarARegistro<ApiOrderDetail & Parche>(RECURSO, id, real as ApiOrderDetail & Parche)!
  const nuevos = cambios(actual)
  const parche: Parche = {
    ...nuevos,
    estadoOriginal: actual.estadoOriginal ?? real.status,
    resumen: { ...(actual.resumen ?? filasVistas.get(id) ?? resumenDe(real)), ...(nuevos.status ? { status: nuevos.status } : {}) },
  }
  editar<ApiOrderDetail & Parche>(RECURSO, id, parche)
  return sinInternos({ ...actual, ...parche })
}

registrar({
  metodo: 'PATCH',
  ruta: /^\/orders\/([^/]+)\/status$/,
  lado: 'panel',
  responder: async (p, m) => {
    const status = (p.body as { status?: ApiOrderStatus } | null)?.status
    if (!status) return json({ message: 'Falta el estado' }, 400)
    return parchear(p, decodeURIComponent(m[1]), (d) =>
      d.status === status ? {} : { status, statusHistory: [...d.statusHistory, { status, createdAt: new Date().toISOString() }] },
    )
  },
})

registrar({
  metodo: 'PATCH',
  ruta: /^\/orders\/([^/]+)\/shipping$/,
  lado: 'panel',
  responder: async (p, m) => {
    const b = (p.body ?? {}) as { carrier?: string; tracking?: string }
    return parchear(p, decodeURIComponent(m[1]), (d) => {
      if (!d.onlineOrderDetails) return {}
      const od = { ...d.onlineOrderDetails }
      if (b.carrier !== undefined) od.carrier = (b.carrier || null) as typeof od.carrier
      if (b.tracking !== undefined) od.tracking = b.tracking || null
      return { onlineOrderDetails: od }
    })
  },
})

registrar({
  metodo: 'GET',
  ruta: /^\/orders\/([^/]+)$/,
  lado: 'panel',
  responder: async (p, m) => {
    const res = await p.real()
    const real = await leerJson<ApiOrderDetail>(res.clone())
    if (!real) return res
    const visto = aplicarARegistro<ApiOrderDetail & Parche>(RECURSO, decodeURIComponent(m[1]), real as ApiOrderDetail & Parche)
    return visto ? sinInternos(visto) : json({ message: 'Pedido no encontrado' }, 404)
  },
})

registrar({
  metodo: 'GET',
  ruta: /^\/orders$/,
  lado: 'panel',
  responder: async (p) => {
    const res = await p.real()
    const pagina = await leerJson<ApiOrdersPage>(res.clone())
    if (!pagina) return res
    pagina.data.forEach((f) => filasVistas.set(f.id, f))

    const editados = Object.entries(leerCapa<ApiOrderDetail & Parche>(RECURSO).editados)
      .filter(([, e]) => e.status && e.estadoOriginal && e.status !== e.estadoOriginal)
    if (editados.length === 0) return pagina

    const counts = { ...pagina.counts }
    for (const [, e] of editados) {
      counts[e.estadoOriginal!] = Math.max(0, (counts[e.estadoOriginal!] ?? 0) - 1)
      counts[e.status!] = (counts[e.status!] ?? 0) + 1
    }
    const porId = new Map(editados)
    let data = pagina.data.map((f) => (porId.get(f.id)?.status ? { ...f, status: porId.get(f.id)!.status! } : f))

    const filtro = p.query.get('status') as ApiOrderStatus | null
    let total = pagina.total
    if (filtro) {
      const antes = data.length
      data = data.filter((f) => f.status === filtro)
      total -= antes - data.length
      // Los que el visitante movió A este estado, arriba de todo en la primera página.
      const entrantes = editados
        .filter(([id, e]) => e.status === filtro && e.resumen && !data.some((f) => f.id === id))
        .map(([, e]) => ({ ...e.resumen!, status: filtro }))
      if (pagina.page === 1) data = [...entrantes, ...data]
      total += entrantes.length
    }
    return { ...pagina, data, total, counts }
  },
})
