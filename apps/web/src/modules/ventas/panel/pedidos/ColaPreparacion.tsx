// src/modules/ventas/panel/pedidos/ColaPreparacion.tsx — Vista 08
// Tablero kanban del flujo de preparación: a preparar → listo → despachado.
//
// (Fase 3 — Ale, 31/07) Antes era 100% maqueta (datos mock, el "mover" solo
// cambiaba estado local de React). Ahora trabaja con los pedidos reales: cada
// columna se arma con GET /orders filtrado por estado, y los botones de acción
// llaman al mismo PATCH /orders/:id/status que ya usa PedidoDetalle — mismas
// reglas del backend (por eso acá solo se ofrecen los 2 saltos que tienen
// sentido en este tablero; el resto del ciclo de vida vive en Detalle/Lista).
//
// Se muestran solo 3 columnas operativas, no los 7 estados posibles: Pendiente
// (sin pagar) no tiene nada para preparar todavía, y Cancelado/Completado (venta
// de mostrador) no aportan en un tablero de trabajo activo — se verían acá como
// ruido. "Despachado / Entregado" junta Enviado + Entregado en una sola
// columna (con una etiqueta chica por tarjeta para distinguir cuál de los dos),
// porque operativamente ya no hay nada para hacer con el pedido en ninguno de
// los dos casos.
//
// El ícono del ojito abre directo la vista previa real del comprobante
// (mismo componente que en Lista) en vez de navegar a la página de detalle:
// las acciones de estado ya están en la propia tarjeta, así que lo único que
// hace falta desde acá es poder ver rápido qué pidió el cliente.

import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Loader } from '@/design-system/components/Loader'
import { fmtMoney } from '@/lib/utils'
import { ApiError, getOrders, updateOrderStatus, type ApiOrderStatus, type ApiOrderSummary } from '@/lib/api'
import { ModalComprobante } from './components/ModalComprobante'

type ColumnaId = 'preparar' | 'listo' | 'despachado'

// Qué estados reales alimentan cada columna del tablero.
const ESTADOS_POR_COLUMNA: Record<ColumnaId, ApiOrderStatus[]> = {
    preparar:   ['CONFIRMED'],
    listo:      ['PREPARING'],
    despachado: ['SHIPPED', 'DELIVERED'],
}
const TODOS_LOS_ESTADOS = ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const satisfies readonly ApiOrderStatus[]

const COLUMNAS: { id: ColumnaId; label: string; color: string; next: ApiOrderStatus | null; btn: string | null }[] = [
    { id: 'preparar',   label: 'A preparar',             color: '#F59E0B', next: 'PREPARING', btn: 'Marcar como listo'      },
    { id: 'listo',      label: 'Listo para despachar',   color: '#3B82F6', next: 'SHIPPED',   btn: 'Marcar como despachado' },
    { id: 'despachado', label: 'Despachado / Entregado', color: '#10B981', next: null,         btn: null                     },
]

const ETIQUETA_ESTADO: Partial<Record<ApiOrderStatus, string>> = { SHIPPED: 'Enviado', DELIVERED: 'Entregado' }

function horaCorta(iso: string) {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface ColaPreparacionProps {
    ir:      (vista: 'detalle', id?: string) => void
    onToast: (msg: string) => void
}

export default function ColaPreparacion({ onToast }: ColaPreparacionProps) {
    const [porEstado, setPorEstado]   = useState<Partial<Record<ApiOrderStatus, ApiOrderSummary[]>>>({})
    const [cargando, setCargando]     = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [recarga, setRecarga]       = useState(0)
    const [moviendo, setMoviendo]     = useState<string | null>(null) // id del pedido con un cambio de estado en curso
    const [comprobante, setComprobante] = useState<string | null>(null)

    useEffect(() => {
        let cancelado = false
        setCargando(true)
        setErrorCarga(null)
        Promise.all(
            TODOS_LOS_ESTADOS.map(status =>
                getOrders({ status, channel: 'ONLINE', limit: 100 }).then(r => [status, r.data] as const),
            ),
        )
            .then(entries => { if (!cancelado) setPorEstado(Object.fromEntries(entries)) })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la cola de preparación.') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [recarga])

    const cols: Record<ColumnaId, ApiOrderSummary[]> = {
        preparar:   porEstado.CONFIRMED ?? [],
        listo:      porEstado.PREPARING ?? [],
        despachado: [...(porEstado.SHIPPED ?? []), ...(porEstado.DELIVERED ?? [])]
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    }

    // Aplica el cambio de estado real y recarga las columnas. Si el backend lo
    // rechaza (p.ej. otra persona ya lo movió, o pasó algo con el stock), el
    // motivo real del error queda en el toast en vez de fallar en silencio.
    const avanzar = async (p: ApiOrderSummary, nuevo: ApiOrderStatus) => {
        if (moviendo) return
        setMoviendo(p.id)
        try {
            await updateOrderStatus(p.id, nuevo)
            onToast(`Pedido #${p.orderNumber} ${nuevo === 'PREPARING' ? 'en preparación' : 'despachado'}.`)
            setRecarga(n => n + 1)
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo actualizar el pedido.')
        } finally {
            setMoviendo(null)
        }
    }

    return (
        <div style={pageWrap}>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }}>Cola de preparación</h1>

            {cargando && !Object.keys(porEstado).length ? (
                <Loader message="Cargando pedidos…" style={{ padding: '64px 0' }} />
            ) : errorCarga ? (
                <div style={{ border: '1px dashed var(--color-error)', borderRadius: 12, padding: '32px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--color-error)', marginBottom: 12 }}>{errorCarga}</div>
                    <Button variant="outline" size="sm" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, alignItems: 'start' }}>
                    {COLUMNAS.map(col => {
                        const list = cols[col.id]
                        const subtotal = list.reduce((s, p) => s + p.total, 0)
                        return (
                            <section key={col.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${col.color}`, borderRadius: 12, padding: 12, minHeight: 400 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '2px 4px' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{col.label}</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 9999, background: 'var(--color-bg)', color: 'var(--color-muted)', border: '1px solid var(--color-border)', fontFamily: '"Geist Mono", monospace' }}>{list.length}</span>
                                </div>
                                <div style={{ padding: '0 4px 10px', fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>Total: {fmtMoney(subtotal)}</div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {list.length === 0 ? (
                                        <div style={{ border: '1px dashed var(--color-border)', borderRadius: 8, padding: '24px 12px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)' }}>Sin pedidos en esta etapa</div>
                                    ) : list.map(p => (
                                        <div key={p.id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>#{p.orderNumber}</span>
                                                {col.id === 'despachado' && ETIQUETA_ESTADO[p.status] && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 7px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 10, fontWeight: 600 }}>{ETIQUETA_ESTADO[p.status]}</span>
                                                )}
                                                <div style={{ flex: 1 }} />
                                                <span style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{horaCorta(p.createdAt)}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <Avatar name={p.customerName ?? 'Sin cliente'} size={24} />
                                                <span style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.customerName ?? 'Sin cliente'}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--color-body)', marginBottom: 10 }}>
                                                {p.items.map((x, j) => (
                                                    <div key={j}><span style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-muted)' }}>{x.quantity}×</span> {x.productName}</div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--color-border)', marginBottom: 10 }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 10, fontWeight: 600 }}>{p.channel === 'ONLINE' ? 'Online' : 'Presencial'}</span>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.total)}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                {col.next && col.btn && (
                                                    <Button
                                                        variant="primary" size="sm" style={{ flex: 1, justifyContent: 'center' }}
                                                        loading={moviendo === p.id}
                                                        disabled={moviendo !== null && moviendo !== p.id}
                                                        onClick={() => void avanzar(p, col.next!)}
                                                    >
                                                        {col.btn}
                                                    </Button>
                                                )}
                                                <button
                                                    title="Ver comprobante"
                                                    onClick={() => setComprobante(p.id)}
                                                    style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                                                >
                                                    <Eye size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )
                    })}
                </div>
            )}

            <ModalComprobante isOpen={comprobante !== null} onClose={() => setComprobante(null)} id={comprobante ?? undefined} abrirDirecto onToast={onToast} />
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
