// src/modules/ventas/panel/pedidos/Devoluciones.tsx — Vista 06
// Gestión de devoluciones + drawer de alta en 3 pasos (pedido, productos, reembolso).
//
// (Fase 3 — Ale, 01/08) Antes era 100% maqueta. Ahora todo el circuito es real:
// - La lista sale de GET /returns (con pestañas por estado y paginación).
// - El wizard busca pedidos reales, deja elegir renglones con su cantidad, y
//   registra una devolución por cada producto elegido. Como las devoluciones
//   del panel nacen aprobadas (regla del backlog), el alta las aprueba al
//   toque: el backend reingresa el stock, emite la nota de crédito (si esa es
//   la resolución) y le avisa al cliente por email.
// - Aprobar/Rechazar (para las que lleguen pendientes desde el storefront)
//   pegan al PATCH real; el rechazo pide el motivo que se le explica al
//   cliente en el email.

import { useEffect, useState } from 'react'
import { Truck, Search, X, Check, Minus, Plus, Eye, Mail } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Modal } from '@/design-system/components/Modal'
import { SkeletonFilas, SkeletonText } from '@/design-system/components/Skeleton'
import { fmtMoney } from '@/lib/utils'
import type { VistaPedido } from './components/PedidoTabs'
import { ModalComprobante } from './components/ModalComprobante'
import { ModalEmail, type ClienteEmail } from './components/ModalEmail'
import {
    ApiError, createReturn, getOrder, getOrders, getReturns, sendOrderEmail, updateReturn,
    type ApiOrderDetail, type ApiOrderSummary, type ApiReturn, type ApiReturnsPage, type ApiReturnStatus,
} from '@/lib/api'

// Motivos de devolución según el RUBRO del negocio: "Talle incorrecto" tiene
// todo el sentido para ropa y ninguno para un iPhone. Los genéricos sirven
// para cualquier producto; si el rubro se conoce (viene en la sesión, del
// onboarding), sus motivos específicos van primero. Rubro desconocido o
// nuevo → solo los genéricos, nunca uno que quede ridículo.
const MOTIVOS_GENERICOS = ['No era lo esperado', 'Producto defectuoso', 'Llegó dañado', 'Llegó distinto a lo publicado', 'Me arrepentí', 'Otro']
function motivosPorRubro(industry?: string | null): string[] {
    const r = (industry ?? '').toLowerCase()
    if (/indument|ropa|calzado|moda|textil|zapat/.test(r)) return ['Talle incorrecto', 'Color distinto al pedido', ...MOTIVOS_GENERICOS]
    if (/electr|tecno|celular|comput|gamer|gadget/.test(r)) return ['No enciende / falla técnica', 'Incompatible con lo que necesitaba', ...MOTIVOS_GENERICOS]
    if (/muebl|deco|hogar|bazar/.test(r)) return ['No entra en el espacio / medidas', ...MOTIVOS_GENERICOS]
    if (/librer|papel|jugue/.test(r)) return ['Vino incompleto / le faltan partes', ...MOTIVOS_GENERICOS]
    return MOTIVOS_GENERICOS
}

// Chip de estado propio: los labels de pedidos ("Confirmado") no aplican acá.
const ESTADO_CHIP: Record<ApiReturnStatus, { label: string; bg: string; fg: string }> = {
    PENDING:    { label: 'Pendiente',  bg: 'var(--color-warning-bg)', fg: 'var(--chip-warning-fg)' },
    IN_PROCESS: { label: 'En proceso', bg: 'var(--color-primary-bg)', fg: 'var(--chip-primary-fg)' },
    APPROVED:   { label: 'Aprobada',   bg: 'var(--color-success-bg)', fg: 'var(--chip-success-fg)' },
    REJECTED:   { label: 'Rechazada',  bg: 'var(--color-error-bg)',   fg: 'var(--chip-error-fg)' },
}

const TABS: { id: ApiReturnStatus | 'todas'; label: string }[] = [
    { id: 'todas',      label: 'Todas' },
    { id: 'PENDING',    label: 'Pendientes' },
    { id: 'IN_PROCESS', label: 'En proceso' },
    { id: 'APPROVED',   label: 'Aprobadas' },
    { id: 'REJECTED',   label: 'Rechazadas' },
]

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(iso: string) {
    const d = new Date(iso)
    return `${d.getDate()} ${MESES[d.getMonth()]}`
}

interface DevolucionesProps {
    ir:      (vista: VistaPedido, id?: string) => void
    onToast: (msg: string) => void
}

export default function Devoluciones({ ir, onToast }: DevolucionesProps) {
    // Gestionar devoluciones (registrar, aprobar, rechazar) reingresa stock y
    // emite notas de crédito: es acción de gestión, no de solo lectura.
    const { user } = useAuth()
    const puedeGestionar = user?.type === 'member' && user.permissions.includes('orders.manage')

    // ── Lista real ──
    const [tab, setTab]               = useState<ApiReturnStatus | 'todas'>('todas')
    const [page, setPage]             = useState(1)
    const [datos, setDatos]           = useState<ApiReturnsPage | null>(null)
    const [cargando, setCargando]     = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [recarga, setRecarga]       = useState(0)

    // ── Acciones sobre una devolución ──
    const [procesando, setProcesando]   = useState<string | null>(null) // id con un PATCH en curso
    const [rechazar, setRechazar]       = useState<ApiReturn | null>(null)
    const [motivoRechazo, setMotivoRechazo] = useState('')
    // Aprobar reingresa stock y emite una nota de crédito real — sin este
    // paso, un click apuraba la nota antes de que el producto físicamente
    // hubiera vuelto (esta devolución la pidió el cliente por el storefront,
    // nadie del negocio la tiene todavía en la mano, a diferencia del alta
    // manual del wizard, que nace aprobada porque el producto ya está ahí).
    const [confirmarAprobar, setConfirmarAprobar] = useState<ApiReturn | null>(null)
    const [confirmoRecepcion, setConfirmoRecepcion] = useState(false)
    const [comprobante, setComprobante] = useState<string | null>(null)
    const [email, setEmail]             = useState<(ClienteEmail & { pedidoId: string }) | null>(null)

    // ── Drawer de alta ──
    const [drawer, setDrawer]   = useState(false)
    const [step, setStep]       = useState(1)
    const [q, setQ]             = useState('')
    const [qLista, setQLista]   = useState('')
    const [resultados, setResultados] = useState<ApiOrderSummary[]>([])
    const [buscando, setBuscando]     = useState(false)
    const [ped, setPed]         = useState<ApiOrderDetail | null>(null)
    const [cargandoPed, setCargandoPed] = useState(false)
    // Renglones elegidos: itemId → cantidad a devolver
    const [sel, setSel]         = useState<Record<string, number>>({})
    const [motivo, setMotivo]   = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [metodo, setMetodo]   = useState<'CREDIT_NOTE' | 'REFUND'>('CREDIT_NOTE')
    const [registrando, setRegistrando] = useState(false)
    // El error del alta se muestra ADENTRO del drawer (paso 3): el toast del
    // pie de página queda tapado por el drawer y parecía que "no pasaba nada".
    const [errorRegistro, setErrorRegistro] = useState<string | null>(null)

    useEffect(() => {
        let cancelado = false
        setCargando(true)
        getReturns({ status: tab === 'todas' ? undefined : tab, page, limit: 10 })
            .then(r => { if (!cancelado) { setDatos(r); setErrorCarga(null) } })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudieron cargar las devoluciones') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [tab, page, recarga])

    // Búsqueda de pedidos del wizard, con espera de 350ms desde la última tecla.
    useEffect(() => {
        const t = setTimeout(() => setQLista(q), 350)
        return () => clearTimeout(t)
    }, [q])
    useEffect(() => {
        if (!drawer) return
        let cancelado = false
        setBuscando(true)
        // Solo pedidos devolvibles: entregados/completados y con unidades sin
        // devolver — los demás no tienen nada que hacer en este wizard.
        getOrders({ search: qLista || undefined, limit: 10, returnable: true })
            .then(r => { if (!cancelado) setResultados(r?.data ?? []) })
            .catch(() => { if (!cancelado) setResultados([]) })
            .finally(() => { if (!cancelado) setBuscando(false) })
        return () => { cancelado = true }
    }, [drawer, qLista])

    const lista = datos?.data ?? []
    const counts = datos?.counts ?? {}
    const totalTab = (id: ApiReturnStatus | 'todas') =>
        id === 'todas'
            ? (Object.values(counts) as number[]).reduce((s, n) => s + (n ?? 0), 0)
            : counts[id] ?? 0
    const pendientes = (counts.PENDING ?? 0) + (counts.IN_PROCESS ?? 0)
    const total  = datos?.total ?? 0
    const limite = datos?.limit ?? 10
    const desde  = total === 0 ? 0 : (page - 1) * limite + 1
    const hasta  = Math.min(page * limite, total)

    const reset = () => { setStep(1); setPed(null); setSel({}); setMotivo(''); setDescripcion(''); setMetodo('CREDIT_NOTE'); setQ(''); setQLista(''); setErrorRegistro(null) }
    const abrir = () => { reset(); setDrawer(true) }

    // Al elegir un pedido en el paso 1 se trae el detalle completo (los
    // renglones con su id real, que es lo que necesita la devolución).
    const elegirPedido = async (p: ApiOrderSummary) => {
        setCargandoPed(true)
        try {
            const det = await getOrder(p.id)
            // Sin esto, volver atrás y elegir OTRO pedido dejaba tildados los
            // renglones del anterior: el resumen mostraba productos que no
            // existían en el pedido nuevo y "Registrar" no llamaba al backend.
            setSel({})
            setPed(det)
            setStep(2)
        } catch {
            onToast('No se pudo cargar el pedido elegido.')
        } finally {
            setCargandoPed(false)
        }
    }

    const renglones = (ped?.items ?? []).filter(it => !it.isConcept)
    const precioDe = (it: ApiOrderDetail['items'][number]) => it.editedPrice ?? it.unitPrice
    const totalDev = renglones.reduce((s, it) => s + (sel[it.id] ? sel[it.id] * precioDe(it) : 0), 0)
    const nSel = Object.keys(sel).length

    const toggleItem = (it: ApiOrderDetail['items'][number]) => {
        setSel(s => {
            const n = { ...s }
            if (n[it.id]) delete n[it.id]
            else n[it.id] = it.quantity
            return n
        })
    }
    const cambiarCantidad = (it: ApiOrderDetail['items'][number], delta: number) => {
        setSel(s => {
            const actual = s[it.id] ?? it.quantity
            const nueva = Math.min(it.quantity, Math.max(1, actual + delta))
            return { ...s, [it.id]: nueva }
        })
    }

    // El alta real: una devolución por renglón elegido, y como nacen aprobadas
    // desde el panel, se aprueban al toque (ahí el backend hace los efectos).
    const registrar = async () => {
        if (!ped || registrando || nSel === 0) return
        setRegistrando(true)
        setErrorRegistro(null)
        const razon = `${motivo || 'Otro'}${descripcion.trim() ? ` — ${descripcion.trim()}` : ''}`
        let ok = 0
        let creadas = 0
        let falla: string | null = null
        for (const it of renglones) {
            const cantidad = sel[it.id]
            if (!cantidad) continue
            try {
                const dev = await createReturn({
                    orderId: ped.id,
                    orderItemId: it.id,
                    quantity: cantidad,
                    amount: Math.round(cantidad * precioDe(it) * 100) / 100,
                    reason: razon,
                    refundMethod: metodo,
                })
                creadas++
                await updateReturn(dev.id, { status: 'APPROVED' })
                ok++
            } catch (e) {
                falla = e instanceof ApiError ? e.message : 'No se pudo registrar la devolución.'
            }
        }
        setRegistrando(false)
        // Se cuenta por CREADAS, no por aprobadas: si el alta anduvo pero la
        // aprobación falló, la devolución ya existe en la base. Cerrar y
        // recargar evita que el usuario apriete de nuevo y la duplique.
        if (creadas > 0) {
            setDrawer(false)
            reset()
            setRecarga(n => n + 1)
            onToast(ok === creadas
                ? `${ok} devolución${ok === 1 ? '' : 'es'} registrada${ok === 1 ? '' : 's'} y aprobada${ok === 1 ? '' : 's'}`
                : `${creadas} devolución(es) registrada(s) · ${creadas - ok} quedó pendiente de aprobar: ${falla ?? 'error al aprobar'}`)
        } else {
            setErrorRegistro(falla ?? 'No se pudo registrar la devolución.')
        }
    }

    // Aprobar directo (las pendientes del storefront). El backend hace el
    // resto: stock, nota de crédito y email.
    const aprobar = async (d: ApiReturn) => {
        if (procesando) return
        setProcesando(d.id)
        try {
            await updateReturn(d.id, { status: 'APPROVED' })
            onToast(`Devolución del pedido #${d.orderNumber} aprobada`)
            setRecarga(n => n + 1)
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo aprobar la devolución.')
        } finally {
            setProcesando(null)
        }
    }

    const confirmarRechazo = async () => {
        if (!rechazar || procesando) return
        setProcesando(rechazar.id)
        try {
            await updateReturn(rechazar.id, { status: 'REJECTED', rejectionMessage: motivoRechazo.trim() || undefined })
            onToast(`Devolución del pedido #${rechazar.orderNumber} rechazada`)
            setRechazar(null)
            setMotivoRechazo('')
            setRecarga(n => n + 1)
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo rechazar la devolución.')
        } finally {
            setProcesando(null)
        }
    }

    return (
        <div className="dev-page" style={pageWrap}>
            <style>{`
                /* Foco visible: los campos llevan outline:none y el proyecto no
                   define ningún :focus global, así que sin esto navegar con Tab
                   por el drawer es a ciegas. */
                .dev-field:focus-visible {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.28);
                }
                .dev-tab:focus-visible, .dev-rowbtn:focus-visible, .dev-iconbtn:focus-visible {
                    outline: 2px solid var(--color-primary);
                    outline-offset: 2px;
                }
                .dev-tab:hover     { background: var(--color-surface-alt); }
                .dev-rowbtn:hover  { border-color: var(--color-primary); background: var(--color-primary-bg); }
                .dev-iconbtn:hover { background: var(--color-surface-alt); color: var(--color-text); }
                .dev-drawer { animation: slideInRight 280ms cubic-bezier(0.2,0.8,0.2,1); }
                @media (prefers-reduced-motion: reduce) {
                    .dev-drawer { animation: none; }
                }
                @media (max-width: 768px) {
                    .dev-page { padding: 16px 14px 48px !important; }
                    /* iOS Safari hace zoom en cualquier campo con menos de 16px,
                       y ese zoom genera scroll horizontal. */
                    .dev-field { font-size: 16px !important; }
                }
            `}</style>

            {/* Header — la sección unificada: devoluciones y notas de crédito
                viven bajo el mismo techo ("Postventa"), con un switch arriba. */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Postventa</h1>
                        {pendientes > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)', fontSize: 12, fontWeight: 600 }}>{pendientes} por resolver</span>
                        )}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Devoluciones y notas de crédito, en un solo lugar.</div>
                </div>
                {puedeGestionar && <Button variant="primary" icon={<Truck size={16} />} onClick={abrir}>Nueva devolución</Button>}
            </div>

            {/* Switch de sub-sección (Devoluciones ↔ Notas de crédito) */}
            <div role="tablist" aria-label="Sección de postventa" style={{ display: 'inline-flex', gap: 2, padding: 4, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16 }}>
                <button className="dev-tab" role="tab" aria-selected style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'default', fontFamily: 'inherit' }}>Devoluciones</button>
                <button className="dev-tab" role="tab" aria-selected={false} onClick={() => ir('notas')} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Notas de crédito</button>
                <button className="dev-tab" role="tab" aria-selected={false} onClick={() => ir('cancelaciones')} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelaciones</button>
            </div>

            {/* Pestañas por estado */}
            <div role="tablist" aria-label="Estado de las devoluciones" style={{ display: 'flex', gap: 2, padding: '6px 8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 16, overflowX: 'auto' }}>
                {TABS.map(({ id, label }) => {
                    const a = tab === id
                    return (
                        <button key={id} onClick={() => { setTab(id); setPage(1) }} className="dev-tab" role="tab" aria-selected={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', minHeight: 44, borderRadius: 8, border: 'none', background: a ? 'var(--color-primary-bg)' : 'transparent', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                            {label}
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 9999, fontFamily: '"Geist Mono", monospace', background: a ? 'var(--color-primary-bg)' : 'var(--color-surface-alt)', color: a ? 'var(--chip-primary-fg)' : 'var(--color-body)' }}>{totalTab(id)}</span>
                        </button>
                    )
                })}
            </div>

            {/* Error con reintento */}
            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            {/* Lista (la silueta acompaña la tabla compacta de filas, no tarjetas) */}
            {cargando && !datos ? (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                    <SkeletonFilas filas={5} />
                </div>
            ) : lista.length === 0 && !errorCarga ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-alt)', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
                        <Truck size={26} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
                        {tab === 'todas' ? 'Sin devoluciones todavía' : 'Nada en este estado'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6, maxWidth: '62ch', margin: '0 auto' }}>
                        Las devoluciones aparecen acá cuando las registrás desde el panel o cuando un cliente las pide desde la tienda.
                    </div>
                </div>
            ) : (
                /* Tabla compacta: una fila por devolución (chau tarjetas
                   gigantes) — scrollea horizontal en pantallas chicas, como
                   la tabla de notas de crédito. Al refetchear con datos en
                   pantalla (cambio de tab) se atenúa y avisa "Actualizando…"
                   para que el click no parezca muerto. */
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflowX: 'auto', position: 'relative', opacity: cargando ? 0.45 : 1, pointerEvents: cargando ? 'none' : 'auto', transition: 'opacity 180ms ease' }} aria-busy={cargando}>
                    {cargando && (
                        /* Con fondo propio: flotando pelado se pisaba con el encabezado de la tabla. */
                        <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 5, fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '3px 10px', borderRadius: 9999, boxShadow: '0 2px 8px rgba(15,23,42,0.10)' }}>Actualizando…</div>
                    )}
                    <div style={{ minWidth: 880 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: COLS_DEV, alignItems: 'center', gap: 10, padding: '0 16px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <span>Pedido</span><span>Cliente</span><span>Producto</span><span>Resolución</span><span>Fecha</span><span style={{ textAlign: 'right' }}>Acciones</span>
                        </div>
                        {lista.map((d, i) => {
                            const resoluble = d.status === 'PENDING' || d.status === 'IN_PROCESS'
                            return (
                                <div key={d.id} style={{ display: 'grid', gridTemplateColumns: COLS_DEV, alignItems: 'center', gap: 10, padding: '10px 16px', minHeight: 64, borderBottom: i < lista.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>#{d.orderNumber}</div>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', marginTop: 3, borderRadius: 9999, fontSize: 10.5, fontWeight: 600, background: ESTADO_CHIP[d.status].bg, color: ESTADO_CHIP[d.status].fg }}>{ESTADO_CHIP[d.status].label}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                        <Avatar name={d.customerName ?? 'Sin cliente'} size={28} />
                                        <span style={{ fontSize: 13, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.customerName ?? 'Sin cliente'}</span>
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.productName ?? 'Pedido completo'}</div>
                                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <span style={{ fontFamily: '"Geist Mono", monospace' }}>{d.quantity} u · {fmtMoney(d.amount)}</span> · {d.reason}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 12, color: 'var(--color-body)' }}>{d.refundMethod === 'CREDIT_NOTE' ? 'Nota de crédito' : 'Reembolso'}</span>
                                    <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fechaCorta(d.createdAt)}</span>
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                        {resoluble && puedeGestionar && (
                                            <>
                                                <Button variant="outline" size="sm" disabled={procesando !== null} onClick={() => { setConfirmarAprobar(d); setConfirmoRecepcion(false) }}>Aprobar</Button>
                                                <Button variant="danger" size="sm" disabled={procesando !== null} onClick={() => { setRechazar(d); setMotivoRechazo('') }}>Rechazar</Button>
                                            </>
                                        )}
                                        <button className="dev-iconbtn" aria-label={`Ver pedido #${d.orderNumber}`} title="Ver pedido" onClick={() => setComprobante(d.orderId)} style={iconBtnDev}><Eye size={15} strokeWidth={1.8} /></button>
                                        <button className="dev-iconbtn" aria-label={`Email a ${d.customerName ?? 'cliente'}`} title="Enviar email" onClick={() => setEmail({ nombre: d.customerName ?? 'Cliente', email: d.customerEmail ?? '', pedidoId: d.orderId })} style={iconBtnDev}><Mail size={15} strokeWidth={1.8} /></button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Paginación */}
            {total > limite && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 4px', flexWrap: 'wrap', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                        Mostrando <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{desde}–{hasta}</strong> de <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{total}</strong>
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Anterior</Button>
                        <Button variant="outline" size="sm" disabled={hasta >= total} onClick={() => setPage(p => p + 1)}>Siguiente →</Button>
                    </div>
                </div>
            )}

            {/* Modal de rechazo: pide el motivo que se le explica al cliente */}
            <Modal
                isOpen={rechazar !== null}
                onClose={() => setRechazar(null)}
                title={rechazar ? `Rechazar devolución del pedido #${rechazar.orderNumber}` : ''}
                maxWidth={480}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setRechazar(null)} disabled={procesando !== null}>Cancelar</Button>
                        <Button variant="danger" loading={procesando !== null} onClick={() => void confirmarRechazo()}>Rechazar y avisar</Button>
                    </>
                }
            >
                <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 12 }}>
                    El cliente recibe un email con el motivo. Si lo dejás vacío, va el texto estándar de políticas.
                </div>
                <label htmlFor="dev-motivo-rechazo" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Motivo del rechazo (se le envía al cliente)</label>
                <textarea
                    id="dev-motivo-rechazo"
                    className="dev-field"
                    value={motivoRechazo}
                    onChange={e => setMotivoRechazo(e.target.value)}
                    placeholder="Ej: el producto vino usado y con la etiqueta cortada, no entra en la política de cambios…"
                    rows={4}
                    style={{ ...inputBase, resize: 'vertical', minHeight: 96, padding: '10px 12px', fontSize: 13, lineHeight: 1.6 }}
                />
            </Modal>

            {/* Modal de confirmación antes de aprobar: aprobar reingresa
                stock y emite la nota de crédito de una — sin esto, un click
                de más adelantaba la nota antes de que el producto físico
                hubiera vuelto. Solo aplica a las que llegan del storefront
                (el alta manual del wizard nace aprobada aparte, porque ahí
                el producto ya está en la mano de quien la carga). */}
            <Modal
                isOpen={confirmarAprobar !== null}
                onClose={() => setConfirmarAprobar(null)}
                title={confirmarAprobar ? `Aprobar devolución del pedido #${confirmarAprobar.orderNumber}` : ''}
                maxWidth={440}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setConfirmarAprobar(null)} disabled={procesando !== null}>Cancelar</Button>
                        <Button
                            variant="primary"
                            loading={procesando !== null}
                            disabled={!confirmoRecepcion}
                            onClick={async () => { if (confirmarAprobar) { await aprobar(confirmarAprobar); setConfirmarAprobar(null) } }}
                        >
                            Aprobar y emitir nota
                        </Button>
                    </>
                }
            >
                {confirmarAprobar && (
                    <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, background: 'var(--color-surface)', fontSize: 13, color: 'var(--color-body)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{confirmarAprobar.productName ?? 'Pedido completo'}</div>
                        <div>{confirmarAprobar.quantity} u · {fmtMoney(confirmarAprobar.amount)} · {confirmarAprobar.refundMethod === 'CREDIT_NOTE' ? 'Nota de crédito' : 'Reembolso'}</div>
                    </div>
                )}
                <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 14 }}>
                    Al aprobar, el stock reingresa al inventario y se emite la nota de crédito ya mismo — hacelo recién cuando tengas el producto físico de vuelta, no antes. Si todavía no coordinaste con el cliente cómo te lo devuelve, escribile por WhatsApp o email desde el ícono de la fila.
                </div>
                <label
                    htmlFor="dev-confirmo-recepcion"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 8, border: `1px solid ${confirmoRecepcion ? 'var(--color-primary)' : 'var(--color-border)'}`, background: confirmoRecepcion ? 'var(--color-primary-bg)' : 'var(--color-bg)', cursor: 'pointer' }}
                >
                    <span style={{ width: 18, height: 18, marginTop: 1, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${confirmoRecepcion ? 'var(--color-primary)' : 'var(--color-border)'}`, background: confirmoRecepcion ? 'var(--color-primary)' : 'transparent', display: 'grid', placeItems: 'center' }}>
                        {confirmoRecepcion && <Check size={11} strokeWidth={3} color="#fff" />}
                    </span>
                    <input id="dev-confirmo-recepcion" type="checkbox" checked={confirmoRecepcion} onChange={e => setConfirmoRecepcion(e.target.checked)} style={{ display: 'none' }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>Confirmo que ya recibí el producto físico.</span>
                </label>
            </Modal>

            {/* Drawer de alta */}
            {drawer && (
                <>
                    <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 319 }} />
                    <div className="dev-drawer" style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 480, maxWidth: '100%', background: 'var(--color-bg)', borderLeft: '1px solid var(--color-border)', boxShadow: '-8px 0 24px rgba(15,23,42,0.12)', zIndex: 320, display: 'flex', flexDirection: 'column' }}>

                        {/* Drawer header */}
                        <div style={{ height: 60, padding: '0 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>Nueva devolución</span>
                            <button onClick={() => setDrawer(false)} aria-label="Cerrar" className="dev-iconbtn" style={{ width: 44, height: 44, marginRight: -10, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'background 150ms ease, color 150ms ease' }}><X size={18} strokeWidth={1.8} /></button>
                        </div>

                        {/* Stepper */}
                        <div style={{ padding: '20px 24px 0', display: 'flex' }}>
                            {[['1', 'Pedido'], ['2', 'Productos'], ['3', 'Resolución']].map(([n, l], i) => {
                                const a = step === i + 1, dn = step > i + 1
                                return (
                                    <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ width: 26, height: 26, borderRadius: '50%', background: dn ? 'var(--color-success)' : a ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: dn || a ? 'var(--color-on-primary)' : 'var(--color-muted)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, fontFamily: '"Geist Mono", monospace' }}>{dn ? <Check size={12} strokeWidth={2.6} /> : n}</span>
                                            <span style={{ fontSize: 12, fontWeight: a || dn ? 600 : 500, color: a || dn ? 'var(--color-text)' : 'var(--color-muted)' }}>{l}</span>
                                        </div>
                                        {i < 2 && <div style={{ flex: 1, height: 2, background: dn ? 'var(--color-success)' : 'var(--color-border)', margin: '0 10px' }} />}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Drawer body */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                            {step === 1 && (
                                <div>
                                    <div style={{ position: 'relative', marginBottom: 14 }}>
                                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                                        <input className="dev-field" aria-label="Buscar pedido por número o cliente" value={q} onChange={e => setQ(e.target.value)} placeholder="# Pedido o nombre del cliente…" style={{ ...inputBase, height: 44, paddingLeft: 38, paddingRight: 12, fontSize: 13 }} />
                                    </div>
                                    {buscando || cargandoPed ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {Array.from({ length: 3 }).map((_, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                                                    <SkeletonText width={34} height={13} delay={i * 90} />
                                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        <SkeletonText width={['56%', '40%', '64%'][i % 3]} height={12} delay={i * 90 + 40} />
                                                        <SkeletonText width="34%" height={9} delay={i * 90 + 70} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : resultados.length === 0 ? (
                                        <div style={{ padding: '20px 8px', fontSize: 13, color: 'var(--color-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                                            {qLista
                                                ? 'No hay pedidos devolvibles que coincidan con esa búsqueda.'
                                                : 'No hay pedidos con productos por devolver. Acá aparecen solo los pedidos entregados que todavía tienen unidades sin devolver.'}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {resultados.map(p => (
                                                <button key={p.id} onClick={() => void elegirPedido(p)} className="dev-rowbtn" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, minHeight: 44, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color 150ms ease, background 150ms ease' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>#{p.orderNumber}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, color: 'var(--color-text)' }}>{p.customerName ?? 'Sin cliente'}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.total)}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 2 && ped && (
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', marginBottom: 12 }}>Seleccioná los productos a devolver</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                        {renglones.map(it => {
                                            const on = !!sel[it.id]
                                            return (
                                                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, background: on ? 'var(--color-primary-bg)' : 'var(--color-surface)' }}>
                                                    <button onClick={() => toggleItem(it)} className="dev-iconbtn" role="checkbox" aria-checked={on} aria-label={`Devolver ${it.productName}`} style={{ width: 44, height: 44, margin: -13, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'pointer', padding: 0, borderRadius: 8 }}>
                                                        <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`, background: on ? 'var(--color-primary)' : 'transparent', display: 'grid', placeItems: 'center', transition: 'background 150ms ease, border-color 150ms ease' }}>{on && <Check size={11} strokeWidth={3} color="#fff" />}</span>
                                                    </button>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{it.productName}{it.variantLabel ? ` · ${it.variantLabel}` : ''}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>lleva {it.quantity} u · {fmtMoney(precioDe(it))} c/u</div>
                                                    </div>
                                                    {on && it.quantity > 1 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <button onClick={() => cambiarCantidad(it, -1)} aria-label="Menos" style={btnCantidad}><Minus size={12} /></button>
                                                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', minWidth: 18, textAlign: 'center' }}>{sel[it.id]}</span>
                                                            <button onClick={() => cambiarCantidad(it, +1)} aria-label="Más" style={btnCantidad}><Plus size={12} /></button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <label htmlFor="dev-motivo" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>Motivo de la devolución</label>
                                    <select id="dev-motivo" className="dev-field" value={motivo} onChange={e => setMotivo(e.target.value)} style={{ ...inputBase, height: 44, padding: '0 12px', fontSize: 13, marginBottom: 14, cursor: 'pointer' }}>
                                        <option value="">Elegí un motivo…</option>
                                        {motivosPorRubro(user?.type === 'member' ? user.business.industry : undefined).map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <label htmlFor="dev-descripcion" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>Detalle (opcional)</label>
                                    <textarea id="dev-descripcion" className="dev-field" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: la costura del hombro vino abierta…" rows={3} style={{ ...inputBase, resize: 'vertical', minHeight: 64, padding: '10px 12px', fontSize: 13 }} />
                                </div>
                            )}

                            {step === 3 && ped && (
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', marginBottom: 12 }}>¿Cómo se resuelve?</div>
                                    <div role="radiogroup" aria-label="Resolución de la devolución" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                                        {([['CREDIT_NOTE', 'Nota de crédito', 'Saldo a favor para su próxima compra (se emite sola al registrar)', true], ['REFUND', 'Reembolso', 'Devolver el dinero por el medio que corresponda', false]] as ['CREDIT_NOTE' | 'REFUND', string, string, boolean][]).map(([id, l, d, rec]) => {
                                            const a = metodo === id
                                            return (
                                                <button key={id} onClick={() => setMetodo(id)} className="dev-rowbtn" role="radio" aria-checked={a} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, border: `${a ? 2 : 1}px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 10, background: a ? 'var(--color-primary-bg)' : 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                                                    <span style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2 }}>{a && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-primary)' }} />}</span>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{l}</span>
                                                            {rec && <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 8px', borderRadius: 9999, background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: 10, fontWeight: 600 }}>Más rápido</span>}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{d}</div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{nSel} producto{nSel === 1 ? '' : 's'} · monto a devolver</span>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(totalDev)}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.6, marginTop: 12 }}>
                                        Al registrar, la devolución queda aprobada: el stock reingresa al inventario
                                        {metodo === 'CREDIT_NOTE' ? ', se emite la nota de crédito' : ''} y el cliente recibe el aviso por email.
                                    </div>
                                    {errorRegistro && (
                                        <div role="alert" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-error)', lineHeight: 1.55 }}>
                                            {errorRegistro}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Drawer footer */}
                        <div style={{ height: 72, padding: '0 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                            <Button variant="outline" style={{ flex: 1, justifyContent: 'center' }} disabled={registrando} onClick={() => step > 1 ? setStep(step - 1) : setDrawer(false)}>{step > 1 ? '← Volver' : 'Cancelar'}</Button>
                            {step < 3
                                ? <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }} disabled={step === 1 ? !ped : nSel === 0 || !motivo} onClick={() => setStep(step + 1)}>Continuar →</Button>
                                : <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }} loading={registrando} disabled={nSel === 0} onClick={() => void registrar()}>Registrar devolución</Button>}
                        </div>
                    </div>
                </>
            )}

            {/* El ojito "Ver pedido" abre directo el comprobante real con su botón
                de Imprimir — sin el resumen intermedio que pedía otro click. */}
            <ModalComprobante isOpen={comprobante !== null} onClose={() => setComprobante(null)} id={comprobante ?? undefined} onToast={onToast} abrirDirecto />
            {email && <ModalEmail isOpen onClose={() => setEmail(null)} cliente={email} onToast={onToast} onEnviar={async (a, c) => { await sendOrderEmail(email.pedidoId, a, c) }} />}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
// Pedido · Cliente · Producto · Resolución · Fecha · Acciones
const COLS_DEV = '90px minmax(150px,1.1fr) minmax(200px,1.6fr) 120px 70px 230px'
const iconBtnDev: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 6, border: '1px solid var(--color-border)',
    background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer',
    display: 'grid', placeItems: 'center', padding: 0,
    transition: 'background 150ms ease, color 150ms ease',
}
const inputBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)',
    border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)',
    fontFamily: 'inherit', outline: 'none',
}
const btnCantidad: React.CSSProperties = {
    width: 32, height: 32, minWidth: 44, minHeight: 44, borderRadius: 6,
    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
    color: 'var(--color-text)', cursor: 'pointer',
    display: 'grid', placeItems: 'center', padding: 0,
    transition: 'border-color 150ms ease, color 150ms ease',
}
