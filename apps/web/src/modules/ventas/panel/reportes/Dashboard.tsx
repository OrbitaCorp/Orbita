// src/modules/ventas/panel/reportes/Dashboard.tsx — Vista 01
//
// (Fase 4 — Ale) Antes era 100% maqueta: KPIs escritos a mano, alertas
// inventadas, el gráfico con una serie de muestra y la actividad con pedidos
// falsos. Ahora todo sale del nuevo GET /reports/dashboard: los KPIs del
// período elegido (hoy / semana / mes / personalizado) con su variación contra
// el período anterior, las alertas reales con link a la sección donde se
// resuelven, la serie de ventas de la semana, los rankings del Top y los
// últimos pedidos. El saludo usa el nombre real del usuario logueado y el
// botón "Publicar tienda" publica de verdad (POST /business/publish).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Banknote, ShoppingBag, BarChart3, Users, Globe, Bell, X, Check, Maximize2, CalendarDays, ChevronDown } from 'lucide-react'
import { DateRangePicker, fmtChip } from './components/DateRangePicker'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Badge } from '@/design-system/components/Badge'
import { Modal } from '@/design-system/components/Modal'
import { Toast } from '@/design-system/components/Toast'
import { KpiCard } from '@/design-system/components/KpiCard'
import { Skeleton, SkeletonFilas, SkeletonBarras } from '@/design-system/components/Skeleton'
import { LineChart, BarChart, DonutChart } from '@/design-system/components/Chart'
import { fmtMoney, saludoHora, fechaLarga, toastEsError } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
    ApiError, panelGetDashboardReport, panelGetBusiness, publishBusiness,
    type ApiDashboardReport, type ApiOrderStatus,
} from '@/lib/api'

import { TopProductos } from './components/TopProductos'
import type { Pedido } from '../pedidos/types/pedidos.types'

// Misma traducción de estados que usan las pantallas de pedidos.
const API_A_UI: Record<ApiOrderStatus, Pedido['estado']> = {
    PENDING: 'pendiente', CONFIRMED: 'confirmado', PREPARING: 'preparacion',
    SHIPPED: 'enviado', DELIVERED: 'entregado', COMPLETED: 'entregado', CANCELLED: 'cancelado',
}

interface Alerta { id: string; nivel: 'danger' | 'warning'; titulo: string; desc?: string; seccion: string; extra?: Record<string, string> }

const PERIODOS = ['Hoy', 'Semana', 'Mes']
const money = (v: number) => fmtMoney(v)

// Fecha local → YYYY-MM-DD (sin pasar por UTC, que corre el día).
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Colorcito estable para el ranking de productos, calculado del nombre.
const hueDe = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

export default function Dashboard() {
    const router = useRouter()
    const { user } = useAuth()
    const nombreUsuario = user?.type === 'member' ? user.member.name.split(' ')[0] : ''

    const [periodo, setPeriodo] = useState(0)
    const [topView, setTopView] = useState<'productos' | 'categorias' | 'canal'>('productos')
    const [descartadas, setDescartadas] = useState<string[]>([])
    const [publicada, setPublicada] = useState(false)
    const [publicando, setPublicando] = useState(false)
    const [expand, setExpand] = useState<null | 'ventas' | 'top'>(null)
    const [toast, setToast] = useState<string | null>(null)
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [customRange, setCustomRange] = useState<{ start: Date; end: Date | null } | null>(null)
    const calendarRef = useRef<HTMLDivElement>(null)

    const [datos, setDatos] = useState<ApiDashboardReport | null>(null)
    const [cargando, setCargando] = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [reintento, setReintento] = useState(0)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
                setCalendarOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    // El rango que se le pide al backend según el período elegido.
    const rango = useMemo(() => {
        const hoy = new Date()
        if (periodo === 0) return { from: ymd(hoy), to: ymd(hoy) }
        if (periodo === 1) return { from: ymd(new Date(hoy.getTime() - 6 * 24 * 60 * 60 * 1000)), to: ymd(hoy) }
        if (periodo === 2) return { from: ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), to: ymd(hoy) }
        if (customRange) return { from: ymd(customRange.start), to: ymd(customRange.end ?? customRange.start) }
        return { from: ymd(hoy), to: ymd(hoy) }
    }, [periodo, customRange])

    // Los datos del dashboard: cada cambio de período vuelve a pedirlos.
    useEffect(() => {
        let cancelado = false
        setCargando(true)
        panelGetDashboardReport(rango.from, rango.to)
            .then(r => {
                if (cancelado) return
                // Guardia de forma: si la API responde algo incompleto (típico
                // cuando el backend está caído/desincronizado y devuelve un
                // cuerpo raro), no renderizamos con datos a medias — pasa al
                // estado de error con "Reintentar" en vez de romper la pantalla.
                if (!r || !r.kpis || !r.alertas || !r.serieSemana || !r.top || !r.actividad) {
                    throw new ApiError(0, 'La respuesta del servidor llegó incompleta. Reintentá en un momento.')
                }
                setDatos(r); setErrorCarga(null); setDescartadas([])
            })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar el dashboard') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [rango, reintento])

    // Estado real de publicación de la tienda (para el botón de arriba).
    useEffect(() => {
        let cancelado = false
        panelGetBusiness()
            .then(b => { if (!cancelado) setPublicada(b.isActive && !b.isPaused) })
            .catch(() => { /* sin dato: el botón queda en "Publicar tienda" */ })
        return () => { cancelado = true }
    }, [])

    const goSeccion = (seccion: string, extra?: Record<string, string>) => {
        const { negocioId, moduloPadre } = router.query
        router.push({ query: { negocioId: negocioId as string, moduloPadre: moduloPadre as string, seccion, ...extra } })
    }

    const publicar = async () => {
        if (publicada || publicando) return
        setPublicando(true)
        try {
            const r = await publishBusiness()
            setPublicada(true)
            setToast(`¡Tu tienda está online en ${r.url}!`)
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo publicar la tienda')
        } finally {
            setPublicando(false)
        }
    }

    // Las alertas del backend, convertidas a tarjetas accionables. Descartar
    // una alerta es solo visual (vuelve si el problema sigue al recargar).
    const alertas = useMemo<Alerta[]>(() => {
        if (!datos) return []
        const a = datos.alertas
        const lista: Alerta[] = []
        if (a.pedidosPendientes > 0) lista.push({ id: 'atencion', nivel: 'danger', titulo: `${a.pedidosPendientes} pedido${a.pedidosPendientes === 1 ? ' necesita' : 's necesitan'} tu atención`, desc: 'Confirmá pagos y movelos a preparación', seccion: 'pedidos' })
        if (a.pedidosSinAtender > 0) lista.push({ id: 'sin-atender', nivel: 'danger', titulo: `${a.pedidosSinAtender} pedido${a.pedidosSinAtender === 1 ? '' : 's'} sin atender +2hs`, seccion: 'pedidos' })
        if (a.stockCritico > 0) lista.push({ id: 'stock', nivel: 'warning', titulo: `${a.stockCritico} producto${a.stockCritico === 1 ? '' : 's'} con stock crítico`, seccion: 'catalogo' })
        if (a.pagosPorConfirmar > 0) lista.push({ id: 'pagos', nivel: 'warning', titulo: `${a.pagosPorConfirmar} pago${a.pagosPorConfirmar === 1 ? '' : 's'} por confirmar`, desc: 'Transferencias pendientes de validación', seccion: 'pedidos' })
        return lista.filter(x => !descartadas.includes(x.id))
    }, [datos, descartadas])

    const k = datos?.kpis
    const d = datos?.kpis.deltas
    const cargandoKpis = cargando && !datos

    // Ranking de productos en el formato que dibuja TopProductos.
    const topProductos = useMemo(() =>
        (datos?.top.productos ?? []).map(p => ({ sku: p.id, nombre: p.name, img: p.img ?? null, unidades: p.unidades, monto: p.importe, hue: hueDe(p.name) })),
    [datos])

    // Comparación de la semana contra la anterior (para el subtítulo del gráfico).
    const totalSemana = useMemo(() => (datos?.serieSemana.valores ?? []).reduce((s, v) => s + v, 0), [datos])
    const deltaSemana = datos && datos.serieSemana.totalAnterior > 0
        ? Math.round(((totalSemana - datos.serieSemana.totalAnterior) / datos.serieSemana.totalAnterior) * 100)
        : null

    const sinVentasEnCanal = (datos?.top.canal ?? []).every(c => c.value === 0)

    // El dashboard es facturación: sin reports.view (empleado raso) no se
    // muestra la plata — aviso amable con el camino a su trabajo real. El
    // backend igual rechaza el pedido (autoridad); esto evita el cartel de
    // error crudo para quien entra por URL directa o aterriza acá al loguear.
    // El dueño NUNCA entra acá: su acceso no depende de ticks en la base.
    if (user?.type === 'member' && user.role !== 'owner' && !user.permissions.includes('reports.dashboard')) {
        return (
            <div style={{ ...pageWrap, display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center', maxWidth: 420 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>Hola{user.member.name ? `, ${user.member.name.split(' ')[0]}` : ''} 👋</div>
                    <div style={{ fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                        Tu rol no tiene acceso a los números del negocio. Tu trabajo vive en Pedidos, Clientes y Productos.
                    </div>
                    <button onClick={() => goSeccion('pedidos')} style={{ height: 44, padding: '0 22px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                        Ir a Pedidos →
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="dash-page" style={pageWrap}>
            <style>{`
                @media (max-width: 960px) {
                    .dash-charts { grid-template-columns: 1fr !important; }
                }
                @media (max-width: 760px) {
                    .dash-page   { padding: 16px 14px 48px !important; }
                    .dash-kpis   { grid-template-columns: repeat(2,1fr) !important; }
                    .dash-alerts { grid-template-columns: repeat(2, 1fr) !important; }
                    .dash-act-hide { display: none !important; }
                    .dash-act-row  { grid-template-columns: 90px 1fr auto !important; gap: 8px !important; }
                }
                @media (max-width: 460px) {
                    .dash-kpis { grid-template-columns: 1fr !important; }
                }
            `}</style>

            {/* 1. Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--color-text)' }}>
                        {saludoHora()}{nombreUsuario ? <>, <span style={{ color: 'var(--color-primary)' }}>{nombreUsuario}</span></> : ''}
                    </h1>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{fechaLarga()}</span>
                        {/* Al cambiar de período con datos ya en pantalla, avisa que se
                            están actualizando (si no, se veían los números viejos sin señal). */}
                        {cargando && datos && <span style={{ fontSize: 12, color: 'var(--color-primary)' }}>· actualizando…</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Segmented: Hoy / Semana / Mes */}
                    <div style={{ display: 'inline-flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 3 }}>
                        {PERIODOS.map((p, i) => (
                            <button key={p} onClick={() => { setPeriodo(i); setCalendarOpen(false) }} style={{ height: 30, padding: '0 12px', borderRadius: 6, border: 'none', background: i === periodo ? 'var(--color-bg)' : 'transparent', color: i === periodo ? 'var(--color-text)' : 'var(--color-muted)', fontSize: 13, fontWeight: i === periodo ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: i === periodo ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>{p}</button>
                        ))}
                    </div>

                    {/* Personalizado con calendario */}
                    <div style={{ position: 'relative' }} ref={calendarRef}>
                        <button
                            onClick={() => { setPeriodo(-1); setCalendarOpen(o => !o) }}
                            style={{
                                height: 36, padding: '0 12px', borderRadius: 8,
                                border: `1px solid ${periodo === -1 ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                background: periodo === -1 ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                                color: periodo === -1 ? 'var(--color-primary)' : 'var(--color-muted)',
                                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                            }}
                        >
                            <CalendarDays size={14} />
                            {customRange && periodo === -1
                                ? `${fmtChip(customRange.start)}${customRange.end ? ` – ${fmtChip(customRange.end)}` : ''}`
                                : 'Personalizado'
                            }
                            <ChevronDown size={12} style={{ transform: calendarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
                        </button>

                        {calendarOpen && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 500 }}>
                                <DateRangePicker
                                    onApply={(start, end) => {
                                        setCustomRange({ start, end })
                                        setPeriodo(-1)
                                        setCalendarOpen(false)
                                    }}
                                    onClose={() => setCalendarOpen(false)}
                                    initStart={customRange?.start}
                                    initEnd={customRange?.end ?? null}
                                />
                            </div>
                        )}
                    </div>

                    <Button variant={publicada ? 'secondary' : 'outline'} icon={<Globe size={15} />} loading={publicando} onClick={() => void publicar()} style={publicada ? { color: 'var(--color-success)' } : undefined}>
                        {publicada ? '✓ Tienda online' : 'Publicar tienda'}
                    </Button>
                </div>
            </div>

            {/* Error de carga, con reintento */}
            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            {/* 2. KPIs */}
            <div className="dash-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                {/* "Ventas" es plata que quedó: el backend le resta las devoluciones aprobadas del período. */}
                <KpiCard label="Ventas" value={k?.ventas ?? 0} delta={d?.ventas ?? 0} prefix="$" accent="#3B82F6" icon={Banknote} loading={cargandoKpis} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>neto de devoluciones</span>} />
                <KpiCard label="Pedidos" value={k?.pedidos ?? 0} delta={d?.pedidos ?? 0} accent="#10B981" icon={ShoppingBag} loading={cargandoKpis} footnote={k && k.pedidosPendientes > 0 ? <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{k.pedidosPendientes} pendiente{k.pedidosPendientes === 1 ? '' : 's'}</span> : undefined} />
                <KpiCard label="Ticket promedio" value={k?.ticketPromedio ?? 0} delta={d?.ticketPromedio ?? 0} prefix="$" accent="#8B5CF6" icon={BarChart3} loading={cargandoKpis} />
                <KpiCard label="Clientes nuevos" value={k?.clientesNuevos ?? 0} delta={d?.clientesNuevos ?? 0} accent="#F59E0B" icon={Users} loading={cargandoKpis} />
            </div>

            {/* 3. Alertas */}
            {cargandoKpis ? (
                <Card padding="sm" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Skeleton width={16} height={16} radius={5} />
                        <Skeleton width={120} height={12} delay={60} />
                    </div>
                </Card>
            ) : alertas.length > 0 ? (
                <Card padding="sm" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Bell size={15} style={{ color: 'var(--color-warning)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{alertas.length} alerta{alertas.length === 1 ? '' : 's'}</span>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => setDescartadas(alertas.map(a => a.id))} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Limpiar todas</button>
                    </div>
                    <div className="dash-alerts" style={{ display: 'grid', gridTemplateColumns: `repeat(${alertas.length}, 1fr)`, gap: 10 }}>
                        {alertas.map(a => {
                            const col = a.nivel === 'danger' ? 'var(--color-error)' : 'var(--color-warning)'
                            const bg  = a.nivel === 'danger' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)'
                            return (
                                <div key={a.id} style={{ background: bg, borderLeft: `3px solid ${col}`, borderRadius: 8, padding: '10px 12px 10px 14px', display: 'flex', flexDirection: 'column', gap: 0, minHeight: 80 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.4 }}>{a.titulo}</div>
                                            {a.desc && <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 2, lineHeight: 1.35 }}>{a.desc}</div>}
                                        </div>
                                        <button onClick={() => setDescartadas(ds => [...ds, a.id])} style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}><X size={12} strokeWidth={2} /></button>
                                    </div>
                                    <div style={{ flex: 1 }} />
                                    <button onClick={() => goSeccion(a.seccion, a.extra)} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left' }}>Ir →</button>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            ) : (
                <Card padding="sm" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-success)', fontSize: 13, fontWeight: 600 }}>
                        <Check size={16} strokeWidth={2.2} /> Sin alertas activas
                    </div>
                </Card>
            )}

            {/* 4. Ventas semana + Top */}
            <div className="dash-charts" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: 16, marginBottom: 16 }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Ventas de la semana</div>
                            <div style={{ fontSize: 12, color: deltaSemana === null ? 'var(--color-muted)' : deltaSemana >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                                {deltaSemana === null ? 'vs semana anterior' : `${deltaSemana >= 0 ? '▲ +' : '▼ '}${deltaSemana}% vs semana anterior`}
                            </div>
                        </div>
                        <button onClick={() => setExpand('ventas')} style={iconBtn}><Maximize2 size={15} /></button>
                    </div>
                    {cargandoKpis ? (
                        <SkeletonBarras height={280} />
                    ) : (
                        <LineChart data={datos?.serieSemana.valores ?? []} labels={datos?.serieSemana.labels ?? []} height={280} formatValue={money} />
                    )}
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Top</div>
                        <button onClick={() => setExpand('top')} style={iconBtn}><Maximize2 size={15} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                        {([['productos', 'Productos'], ['categorias', 'Categorías'], ['canal', 'Canal']] as ['productos' | 'categorias' | 'canal', string][]).map(([id, l]) => {
                            const a = topView === id
                            return <button key={id} onClick={() => setTopView(id)} style={{ height: 26, padding: '0 10px', borderRadius: 9999, border: 'none', background: a ? 'var(--color-primary-bg)' : 'var(--color-surface-alt)', color: a ? 'var(--color-primary)' : 'var(--color-muted)', fontSize: 12, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                        })}
                    </div>
                    {cargandoKpis ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} aria-hidden="true">
                            {[0, 1, 2, 3, 4].map(i => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <Skeleton width={22} height={22} radius={6} delay={i * 90} />
                                        <Skeleton width={`${[62, 48, 70, 44, 56][i]}%`} height={11} delay={i * 90 + 40} />
                                    </div>
                                    <Skeleton width="100%" height={6} radius={9999} delay={i * 90 + 80} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {topView === 'productos' && (topProductos.length > 0
                                ? <TopProductos productos={topProductos} />
                                : <VacioTop texto="Sin ventas en el período elegido." />)}
                            {topView === 'categorias' && ((datos?.top.categorias.length ?? 0) > 0
                                ? <BarChart color="#8B5CF6" data={datos?.top.categorias ?? []} />
                                : <VacioTop texto="Sin ventas por categoría en el período." />)}
                            {topView === 'canal' && (!sinVentasEnCanal
                                ? <DonutChart size={140} data={(datos?.top.canal ?? []).map((c, i) => ({ label: c.label, value: c.value, color: i === 0 ? '#3B82F6' : '#10B981' }))} />
                                : <VacioTop texto="Sin ventas en el período elegido." />)}
                        </>
                    )}
                </Card>
            </div>

            {/* 5. Actividad reciente */}
            <Card padding="md" style={{ padding: 0, marginBottom: 16 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Actividad reciente</span>
                    <button onClick={() => goSeccion('pedidos')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Ver todos →</button>
                </div>
                {cargandoKpis ? (
                    <SkeletonFilas filas={5} />
                ) : (datos?.actividad.length ?? 0) === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13.5, color: 'var(--color-muted)' }}>
                        Todavía no hay pedidos. Cuando entre el primero, lo vas a ver acá.
                    </div>
                ) : (
                    (datos?.actividad ?? []).map((p, i, arr) => (
                        <div key={p.id} className="dash-act-row" onClick={() => goSeccion('pedidos', { vista: 'detalle', id: p.id })} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto 130px 70px', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>#{p.orderNumber}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <Avatar name={p.customerName ?? 'Sin cliente'} size={24} />
                                <span style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.customerName ?? 'Sin cliente'}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.total)}</span>
                            <span className="dash-act-hide"><Badge status={API_A_UI[p.status]} size="sm" /></span>
                            <span className="dash-act-hide" style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{new Date(p.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        </div>
                    ))
                )}
            </Card>

            {/* Modales de expandir */}
            <Modal isOpen={expand === 'ventas'} onClose={() => setExpand(null)} title="Ventas de la semana" maxWidth={760}>
                <LineChart data={datos?.serieSemana.valores ?? []} labels={datos?.serieSemana.labels ?? []} height={340} formatValue={money} />
            </Modal>
            <Modal isOpen={expand === 'top'} onClose={() => setExpand(null)} title="Top productos" maxWidth={760}>
                {topProductos.length > 0 ? <TopProductos productos={topProductos} /> : <VacioTop texto="Sin ventas en el período elegido." />}
            </Modal>

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

function VacioTop({ texto }: { texto: string }) {
    return <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>{texto}</div>
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
