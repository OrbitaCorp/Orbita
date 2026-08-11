// src/modules/ventas/panel/pedidos/PedidoDetalle.tsx — Vista 03
// Detalle de un pedido: productos, línea de tiempo de estado, notas y cliente.
//
// (Fase 2 — Alex) Esta pantalla ya trabaja con el pedido REAL: carga el detalle
// del backend, la línea de tiempo sale del historial guardado (con fecha y hora
// de cada paso), y los botones de estado hacen el cambio de verdad — con las
// mismas reglas del backend: avanzar de a un paso, cancelar solo antes del
// envío. Si el backend rechaza un cambio, el motivo se muestra acá abajo.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ChevronRight, Printer, Mail, Check, ChevronDown } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Badge } from '@/design-system/components/Badge'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Toast } from '@/design-system/components/Toast'
import { Skeleton, SkeletonText, SkeletonCircle } from '@/design-system/components/Skeleton'
import { fmtMoney } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, getOrder, sendOrderEmail, updateOrderStatus, type ApiOrderDetail, type ApiOrderStatus } from '@/lib/api'
import type { VistaPedido } from './components/PedidoTabs'
import { ProductoThumb } from './components/ProductoThumb'
import { ModalComprobante } from './components/ModalComprobante'
import { ModalEmail } from './components/ModalEmail'
import type { EstadoPedido } from './types/pedidos.types'

// Traducción backend ↔ pantalla (mismo criterio que la lista).
const API_A_UI: Record<ApiOrderStatus, EstadoPedido> = {
    PENDING: 'pendiente', CONFIRMED: 'confirmado', PREPARING: 'preparacion',
    SHIPPED: 'enviado', DELIVERED: 'entregado', COMPLETED: 'entregado', CANCELLED: 'cancelado',
}
const UI_A_API: Record<EstadoPedido, ApiOrderStatus> = {
    pendiente: 'PENDING', confirmado: 'CONFIRMED', preparacion: 'PREPARING',
    enviado: 'SHIPPED', entregado: 'DELIVERED', cancelado: 'CANCELLED',
}

// Las mismas reglas del backend, para mostrar solo los botones que tienen sentido.
const PERMITIDAS: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
    pendiente:   ['confirmado', 'cancelado'],
    confirmado:  ['preparacion', 'cancelado'],
    preparacion: ['enviado', 'cancelado'],
    enviado:     ['entregado'],
}

const ESTADO_LABEL: Record<EstadoPedido, string> = {
    pendiente:   'Pendiente',
    confirmado:  'Confirmado',
    preparacion: 'En preparación',
    enviado:     'Enviado',
    entregado:   'Entregado',
    cancelado:   'Cancelado',
}

const ACCION_LABEL: Partial<Record<EstadoPedido, string>> = {
    pendiente:   'Confirmar pedido',
    confirmado:  'Iniciar preparación',
    preparacion: 'Marcar como enviado',
    enviado:     'Marcar como entregado',
}

const ESTADO_COLOR: Record<EstadoPedido, string> = {
    pendiente:   '#F59E0B',
    confirmado:  '#10B981',
    preparacion: '#8B5CF6',
    enviado:     '#3B82F6',
    entregado:   '#94A3B8',
    cancelado:   '#EF4444',
}

const METODO_PAGO: Record<string, string> = {
    MERCADOPAGO: 'MercadoPago', CASH: 'Efectivo', DEBIT_CARD: 'Tarjeta de débito',
    CREDIT_CARD: 'Tarjeta de crédito', TRANSFER: 'Transferencia', QR: 'QR',
}

const hueDe = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

function fmtFecha(iso: string): string {
    const d = new Date(iso)
    const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${d.getDate()} ${m[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

interface PedidoDetalleProps {
    id: string
    ir: (vista: VistaPedido, id?: string) => void
}

export default function PedidoDetalle({ id, ir }: PedidoDetalleProps) {
    const router = useRouter()
    const { user } = useAuth()
    // Solo quien puede gestionar pedidos ve los botones de cambiar estado.
    const puedeGestionar = user?.type === 'member' && user.permissions.includes('orders.manage')

    const [pedido,      setPedido]      = useState<ApiOrderDetail | null>(null)
    const [cargando,    setCargando]    = useState(true)
    const [errorCarga,  setErrorCarga]  = useState<string | null>(null)
    const [modal,       setModal]       = useState<null | 'comprobante' | 'email'>(null)
    const [menuAbierto, setMenuAbierto] = useState(false)
    const [guardando,   setGuardando]   = useState(false)
    const [errorCambio, setErrorCambio] = useState<string | null>(null)
    const [toast,       setToast]       = useState<string | null>(null)
    const [recarga,     setRecarga]     = useState(0)

    // Carga el pedido real al entrar (o si cambia el id, o al reintentar).
    useEffect(() => {
        let cancelado = false
        setCargando(true)
        getOrder(id)
            .then(o => {
                if (cancelado) return
                // Guardia de forma: si el backend responde con otra forma (versión
                // vieja o a medio desplegar), mejor el cartel de error que una
                // pantalla rota a mitad de render.
                if (!o || !o.items || !o.payments) {
                    throw new ApiError(0, 'La respuesta del servidor llegó incompleta. Reintentá en un momento.')
                }
                setPedido(o); setErrorCarga(null)
            })
            .catch(e => {
                if (cancelado) return
                if (e instanceof ApiError && e.status === 401) setErrorCarga('No hay sesión activa. Entrá con tu cuenta para ver el pedido.')
                else if (e instanceof ApiError && e.status === 404) setErrorCarga('No encontramos este pedido.')
                else setErrorCarga('No se pudo cargar el pedido.')
            })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [id, recarga])

    // El cambio de estado de verdad: si el backend lo rechaza, mostramos su motivo.
    const cambiarEstado = async (nuevo: EstadoPedido) => {
        if (!pedido || guardando) return
        setGuardando(true)
        setErrorCambio(null)
        setMenuAbierto(false)
        try {
            const actualizado = await updateOrderStatus(pedido.id, UI_A_API[nuevo])
            setPedido(actualizado)
            setToast(`Estado actualizado a "${ESTADO_LABEL[nuevo]}"`)
            setTimeout(() => setToast(null), 3000)
        } catch (e) {
            setErrorCambio(e instanceof ApiError ? e.message : 'No se pudo cambiar el estado.')
        } finally {
            setGuardando(false)
        }
    }

    const negocioId = router.query.negocioId as string

    // ── Estados de la vista ──
    // Silueta con la forma del detalle: migas + header con estado, la línea de
    // tiempo, la tabla de ítems y la tarjeta lateral del cliente/totales.
    if (cargando) {
        return (
            <div style={pageWrap} aria-hidden="true">
                <SkeletonText width={200} height={12} style={{ marginBottom: 18 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                    <SkeletonText width={160} height={24} />
                    <Skeleton width={96} height={24} radius={9999} delay={60} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                    {[0, 1, 2, 3].map(i => <Skeleton key={i} width="100%" height={40} radius={8} delay={i * 70} />)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: 16 }}>
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--color-border)' : 'none' }}>
                                <SkeletonCircle size={40} delay={i * 90} />
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    <SkeletonText width={`${[55, 42, 60][i]}%`} height={12} delay={i * 90 + 40} />
                                    <SkeletonText width="30%" height={9} delay={i * 90 + 70} />
                                </div>
                                <SkeletonText width={70} height={13} delay={i * 90 + 100} />
                            </div>
                        ))}
                    </div>
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <SkeletonText width="50%" height={12} />
                        <SkeletonText width="80%" height={11} delay={40} />
                        <SkeletonText width="65%" height={11} delay={70} />
                        <Skeleton width="100%" height={38} radius={8} delay={120} style={{ marginTop: 8 }} />
                    </div>
                </div>
            </div>
        )
    }
    if (errorCarga || !pedido) {
        return (
            <div style={pageWrap}>
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, maxWidth: 520 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Ups</div>
                    <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 14 }}>{errorCarga ?? 'No se pudo cargar el pedido.'}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="primary" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>
                        <Button variant="outline" onClick={() => ir('lista')}>← Volver a la lista</Button>
                    </div>
                </div>
            </div>
        )
    }

    const estadoActual = API_A_UI[pedido.status]
    const esPOS        = pedido.channel === 'POS'
    const cliente      = pedido.customer
        ? `${pedido.customer.firstName}${pedido.customer.lastName ? ' ' + pedido.customer.lastName : ''}`
        : pedido.onlineOrderDetails?.buyerName ?? 'Sin cliente'
    const emailCliente = pedido.customer?.email ?? pedido.onlineOrderDetails?.buyerEmail ?? ''
    const telefono     = pedido.onlineOrderDetails?.buyerPhone ?? null

    // La línea de tiempo real: para cada paso busco su fecha en el historial guardado.
    const fechaDe = (st: ApiOrderStatus) => pedido.statusHistory.find(hh => hh.status === st)?.createdAt
    const PASOS: { st: ApiOrderStatus; label: string }[] = [
        { st: 'PENDING',   label: 'Pedido recibido' },
        { st: 'CONFIRMED', label: 'Confirmado' },
        { st: 'PREPARING', label: 'En preparación' },
        { st: 'SHIPPED',   label: 'Enviado' },
        { st: 'DELIVERED', label: 'Entregado' },
    ]
    const cancelado = estadoActual === 'cancelado'
    const pasos = PASOS.map(pp => ({ label: pp.label, fecha: fechaDe(pp.st), done: !!fechaDe(pp.st) }))

    const permitidas   = PERMITIDAS[estadoActual] ?? []
    const siguiente    = permitidas.find(e => e !== 'cancelado') ?? null
    const puedeCancelar = permitidas.includes('cancelado')
    const accionLabel  = siguiente ? ACCION_LABEL[estadoActual] : null
    const finalizado   = permitidas.length === 0

    const pagoResumen = pedido.payments.length
        ? pedido.payments.map(pg => METODO_PAGO[pg.method] ?? pg.method).join(' + ')
        : 'Sin pago registrado'

    return (
        <div style={pageWrap}>
            <style>{`
                .det-header  { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
                .det-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
                .det-grid    { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:16px; align-items:start; }
                .det-estado-menu { position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:300;
                    background:var(--color-bg); border:1px solid var(--color-border); border-radius:10px;
                    box-shadow:0 8px 24px rgba(15,23,42,.14); overflow:hidden; }
                @media (max-width:900px) {
                    .det-grid { grid-template-columns:1fr !important; }
                }
                @media (max-width:640px) {
                    .det-header  { flex-direction:column; align-items:flex-start; }
                    .det-actions { width:100%; }
                    .det-actions > * { flex:1; }
                }
            `}</style>

            {/* Breadcrumb */}
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--color-muted)', marginBottom:14 }}>
                <button onClick={() => ir('lista')} style={{ background:'none', border:'none', color:'var(--color-muted)', cursor:'pointer', fontFamily:'inherit', fontSize:13, padding:0 }}>Lista</button>
                <ChevronRight size={12} />
                <span style={{ color:'var(--color-text)', fontWeight:500, fontFamily:'"Geist Mono", monospace' }}>#{pedido.orderNumber}</span>
            </div>

            {/* Header */}
            <div className="det-header">
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                    <h1 style={{ fontSize:26, fontWeight:700, fontFamily:'"Geist Mono", monospace', color:'var(--color-text)', margin:0 }}>#{pedido.orderNumber}</h1>
                    <Badge status={estadoActual} />
                    <span style={{ fontSize:14, color:'var(--color-muted)' }}>{cliente}</span>
                </div>
                <div className="det-actions">
                    <Button variant="outline" icon={<Printer size={15} />} onClick={() => setModal('comprobante')}>Imprimir</Button>
                    <Button variant="outline" icon={<Mail size={15} />} onClick={() => setModal('email')}>Email</Button>
                </div>
            </div>

            <div className="det-grid">

                {/* Columna principal */}
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    <Card>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', marginBottom:14 }}>Productos del pedido</div>
                        {pedido.items.map((it, i) => (
                            <div key={it.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < pedido.items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <ProductoThumb hue={hueDe(it.productName)} size={44} />
                                <div style={{ flex:1 }}>
                                    <div style={{ fontSize:13, fontWeight:500, color:'var(--color-text)' }}>
                                        {it.productName}{it.variantLabel ? ` · ${it.variantLabel}` : ''}
                                    </div>
                                    <div style={{ fontSize:12, color:'var(--color-muted)', fontFamily:'"Geist Mono", monospace' }}>{it.quantity} × {fmtMoney(it.editedPrice ?? it.unitPrice)}</div>
                                </div>
                                <span style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{fmtMoney(it.quantity * (it.editedPrice ?? it.unitPrice))}</span>
                            </div>
                        ))}
                        {pedido.onlineOrderDetails?.shippingCost != null && (
                            <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, fontSize:13 }}>
                                <span style={{ color:'var(--color-muted)' }}>Envío</span>
                                <span style={{ color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{fmtMoney(pedido.onlineOrderDetails.shippingCost)}</span>
                            </div>
                        )}
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:14, paddingTop:14, borderTop:'1px solid var(--color-border)' }}>
                            <span style={{ fontSize:15, fontWeight:600, color:'var(--color-text)' }}>Total</span>
                            <span style={{ fontSize:18, fontWeight:800, color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{fmtMoney(pedido.total)}</span>
                        </div>
                    </Card>

                    <Card>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                            <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)' }}>Estado del pedido</div>
                            {cancelado && (
                                <span style={{ fontSize:12, fontWeight:600, color:'var(--color-error)', background:'var(--color-error-bg)', padding:'3px 10px', borderRadius:9999 }}>
                                    Cancelado{fechaDe('CANCELLED') ? ` · ${fmtFecha(fechaDe('CANCELLED')!)}` : ''}
                                </span>
                            )}
                        </div>
                        {esPOS ? (
                            <div style={{ fontSize:13, color:'var(--color-body)', lineHeight:1.6 }}>
                                Venta de mostrador: se cobró y entregó en el momento.
                            </div>
                        ) : pasos.map((paso, i) => (
                            <div key={i} style={{ display:'flex', gap:12 }}>
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                                    <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background: paso.done && !cancelado ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: paso.done && !cancelado ? '#fff' : 'var(--color-muted)', display:'grid', placeItems:'center' }}>
                                        {paso.done && !cancelado ? <Check size={13} strokeWidth={2.6} /> : <span style={{ fontSize:11, fontWeight:700 }}>{i+1}</span>}
                                    </div>
                                    {i < pasos.length - 1 && <div style={{ width:2, flex:1, minHeight:24, background: paso.done && !cancelado ? 'var(--color-primary)' : 'var(--color-border)', marginTop:2 }} />}
                                </div>
                                <div style={{ paddingBottom: i < pasos.length - 1 ? 16 : 0 }}>
                                    <div style={{ fontSize:13, fontWeight: paso.done ? 600 : 500, color: paso.done && !cancelado ? 'var(--color-text)' : 'var(--color-muted)' }}>{paso.label}</div>
                                    {paso.done && paso.fecha && <div style={{ fontSize:11, color:'var(--color-muted)', fontFamily:'"Geist Mono", monospace', marginTop:2 }}>{fmtFecha(paso.fecha)}</div>}
                                </div>
                            </div>
                        ))}
                    </Card>

                    {pedido.notes && (
                        <Card>
                            <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', marginBottom:10 }}>Notas del pedido</div>
                            <div style={{ fontSize:13, color:'var(--color-body)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{pedido.notes}</div>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                    {/* ── Cambiar estado ── */}
                    <Card>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', marginBottom:14 }}>Cambiar estado</div>

                        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--color-surface)', borderRadius:8, marginBottom:12 }}>
                            <span style={{ width:10, height:10, borderRadius:'50%', background: ESTADO_COLOR[estadoActual], flexShrink:0 }} />
                            <span style={{ fontSize:13, fontWeight:600, color:'var(--color-text)', flex:1 }}>{ESTADO_LABEL[estadoActual]}</span>
                            <span style={{ fontSize:11, color:'var(--color-muted)' }}>actual</span>
                        </div>

                        {!puedeGestionar && !finalizado && (
                            <div style={{ fontSize:12.5, color:'var(--color-muted)', lineHeight:1.5 }}>
                                Tu rol puede ver los pedidos pero no cambiarles el estado.
                            </div>
                        )}

                        {puedeGestionar && accionLabel && siguiente && (
                            <button
                                onClick={() => cambiarEstado(siguiente)}
                                disabled={guardando}
                                style={{ width:'100%', height:38, borderRadius:8, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:600, cursor: guardando ? 'wait' : 'pointer', fontFamily:'inherit', marginBottom:10, opacity: guardando ? 0.7 : 1 }}
                            >
                                {guardando ? 'Guardando…' : accionLabel}
                            </button>
                        )}

                        {puedeGestionar && !finalizado && (
                            <div style={{ position:'relative' }}>
                                <button
                                    onClick={() => setMenuAbierto(o => !o)}
                                    style={{ width:'100%', height:34, borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-body)', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px' }}
                                >
                                    <span>Cambiar a otro estado</span>
                                    <ChevronDown size={14} style={{ opacity:0.6, transform: menuAbierto ? 'rotate(180deg)' : 'none', transition:'transform 180ms' }} />
                                </button>

                                {menuAbierto && (
                                    <div className="det-estado-menu">
                                        {permitidas.filter(e => e !== 'cancelado').map(e => (
                                            <button
                                                key={e}
                                                onClick={() => cambiarEstado(e)}
                                                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 14px', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:'var(--color-text)', textAlign:'left' }}
                                            >
                                                <span style={{ width:8, height:8, borderRadius:'50%', background: ESTADO_COLOR[e], flexShrink:0 }} />
                                                <span style={{ flex:1 }}>{ESTADO_LABEL[e]}</span>
                                            </button>
                                        ))}
                                        {puedeCancelar && (
                                            <div style={{ borderTop:'1px solid var(--color-border)' }}>
                                                <button
                                                    onClick={() => cambiarEstado('cancelado')}
                                                    style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 14px', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:'var(--color-error)', textAlign:'left' }}
                                                >
                                                    <span style={{ width:8, height:8, borderRadius:'50%', background: ESTADO_COLOR.cancelado, flexShrink:0 }} />
                                                    Cancelar pedido
                                                </button>
                                            </div>
                                        )}
                                        {permitidas.filter(e => e !== 'cancelado').length === 0 && !puedeCancelar && (
                                            <div style={{ padding:'9px 14px', fontSize:12.5, color:'var(--color-muted)' }}>No hay más cambios posibles.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {finalizado && (
                            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, background: cancelado ? 'var(--color-error-bg)' : 'var(--color-success-bg)', color: cancelado ? 'var(--color-error)' : 'var(--color-success)', fontSize:12, fontWeight:600 }}>
                                {cancelado ? '✕ Pedido cancelado' : '✓ Pedido completado'}
                            </div>
                        )}

                        {/* Un pedido enviado ya no se puede cancelar — lo aclaramos para que no se busque el botón. */}
                        {estadoActual === 'enviado' && (
                            <div style={{ marginTop:10, fontSize:12, color:'var(--color-muted)', lineHeight:1.5 }}>
                                Un pedido enviado ya no se puede cancelar: cualquier problema se resuelve como devolución.
                            </div>
                        )}

                        {errorCambio && (
                            <div style={{ marginTop:10, fontSize:12.5, color:'var(--color-error)', lineHeight:1.5 }}>{errorCambio}</div>
                        )}
                    </Card>

                    {/* ── Cliente ── */}
                    <Card>
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: pedido.customerId ? 12 : 0 }}>
                            <Avatar name={cliente} size={44} />
                            <div style={{ minWidth:0 }}>
                                <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)' }}>{cliente}</div>
                                <div style={{ fontSize:12, color:'var(--color-muted)', fontFamily:'"Geist Mono", monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emailCliente || 'Sin email'}</div>
                            </div>
                        </div>
                        {pedido.customerId && (
                            <Button
                                variant="outline" size="sm"
                                style={{ width:'100%', justifyContent:'center' }}
                                onClick={() => router.push(`/admin/${negocioId}/ventas/clientes?vista=detalle&id=${pedido.customerId}`)}
                            >
                                Ver perfil completo →
                            </Button>
                        )}
                    </Card>

                    <Card>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', marginBottom:12 }}>Datos del pedido</div>
                        {([
                            ['Canal', pedido.channel === 'ONLINE' ? 'Online' : 'Presencial'],
                            ['Fecha', fmtFecha(pedido.createdAt)],
                            ['# Pedido', '#' + pedido.orderNumber],
                            ['Método de pago', pagoResumen],
                        ] as [string, string][]).map(([k, v]) => (
                            <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:12, fontSize:13, padding:'5px 0' }}>
                                <span style={{ color:'var(--color-muted)', flexShrink:0 }}>{k}</span>
                                <span style={{ color:'var(--color-text)', textAlign:'right', fontFamily:/Fecha|Pedido/.test(k) ? '"Geist Mono", monospace' : 'inherit' }}>{v}</span>
                            </div>
                        ))}
                    </Card>

                    <Card>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', marginBottom:8 }}>Entrega</div>
                        <div style={{ fontSize:13, color:'var(--color-muted)', marginBottom:12 }}>{telefono ? 'Coordinar por WhatsApp' : 'Sin datos de entrega'}</div>
                        {telefono && (
                            <a
                                href={`https://wa.me/${telefono.replace(/\D/g, '')}`}
                                target="_blank" rel="noreferrer"
                                style={{ width:'100%', height:40, borderRadius:8, border:'none', background:'var(--color-success-bg)', color:'var(--color-success)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, textDecoration:'none', boxSizing:'border-box' }}
                            >
                                💬 WhatsApp
                            </a>
                        )}
                    </Card>
                </div>
            </div>

            {/* "Imprimir" va directo al diálogo de impresión del navegador,
                sin pasar por el resumen intermedio. */}
            <ModalComprobante isOpen={modal === 'comprobante'} onClose={() => setModal(null)} id={pedido.id} onToast={setToast} abrirDirecto autoImprimir />
            <ModalEmail isOpen={modal === 'email'} onClose={() => setModal(null)} cliente={{ nombre: cliente, email: emailCliente }} onToast={setToast} onEnviar={async (a, c) => { await sendOrderEmail(pedido.id, a, c) }} />

            {toast && (
                <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:9000 }}>
                    <Toast variant="success" title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding:'24px 32px 64px', maxWidth:1280, width:'100%', margin:'0 auto', boxSizing:'border-box' }
