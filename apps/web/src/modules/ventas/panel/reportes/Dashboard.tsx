// src/modules/ventas/panel/reportes/Dashboard.tsx — Vista 01
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Banknote, ShoppingBag, BarChart3, Users, Globe, Bell, X, Check, Maximize2, CalendarDays, ChevronDown } from 'lucide-react'
import { DateRangePicker, fmtChip } from './components/DateRangePicker'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Badge } from '@/design-system/components/Badge'
import { Modal } from '@/design-system/components/Modal'
import { Toast } from '@/design-system/components/Toast'
import { LineChart, BarChart, DonutChart } from '@/design-system/components/Chart'
import { fmtMoney, saludoHora, fechaLarga } from '@/lib/utils'

import { StatCard } from '../_shared/StatCard'
import { TopProductos } from './components/TopProductos'
import { SERIE_VENTAS, TOP_PRODUCTOS } from './mock/reportes.mock'
import { MOCK_PEDIDOS } from '../pedidos/mock/pedidos.mock'

interface Alerta { id: string; nivel: 'danger' | 'warning'; titulo: string; desc?: string; seccion: string; extra?: Record<string, string> }
const ALERTAS0: Alerta[] = [
    { id: 'a4', nivel: 'danger',  titulo: '4 pedidos necesitan tu atención', desc: 'Confirmá pagos y movelos a preparación', seccion: 'pedidos', extra: {} },
    { id: 'a1', nivel: 'danger',  titulo: '2 pedidos sin atender +2hs', seccion: 'pedidos' },
    { id: 'a2', nivel: 'warning', titulo: '3 productos con stock < 5',   seccion: 'inventario' },
    { id: 'a3', nivel: 'warning', titulo: '1 pago por confirmar',        seccion: 'pedidos' },
]

const PERIODOS = ['Hoy', 'Semana', 'Mes']
const money = (v: number) => fmtMoney(v)

export default function Dashboard() {
    const router = useRouter()
    const [periodo, setPeriodo] = useState(0)
    const [topView, setTopView] = useState<'productos' | 'categorias' | 'canal'>('productos')
    const [alertas, setAlertas] = useState<Alerta[]>(ALERTAS0)
    const [publicada, setPublicada] = useState(false)
    const [expand, setExpand] = useState<null | 'ventas' | 'top'>(null)
    const [toast, setToast] = useState<string | null>(null)
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [customRange, setCustomRange] = useState<{ start: Date; end: Date | null } | null>(null)
    const calendarRef = useRef<HTMLDivElement>(null)

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

    const goSeccion = (seccion: string, extra?: Record<string, string>) => {
        const { negocioId, moduloPadre } = router.query
        router.push({ query: { negocioId: negocioId as string, moduloPadre: moduloPadre as string, seccion, ...extra } })
    }

    const publicar = () => { setPublicada(true); setToast('¡Tu tienda está online en rama.orbita.shop!') }

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
                        {saludoHora()}, <span style={{ color: 'var(--color-primary)' }}>Alexander</span>
                    </h1>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4, textTransform: 'capitalize' }}>{fechaLarga()}</div>
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

                    <Button variant={publicada ? 'secondary' : 'outline'} icon={<Globe size={15} />} onClick={publicar} style={publicada ? { color: 'var(--color-success)' } : undefined}>
                        {publicada ? '✓ Tienda online' : 'Publicar tienda'}
                    </Button>
                </div>
            </div>

            {/* 2. KPIs */}
            <div className="dash-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                <StatCard label="Ventas" value={fmtMoney(248900)} icon={Banknote} accent="#3B82F6" delta="+18% vs ayer" deltaPos />
                <StatCard label="Pedidos" value="12" icon={ShoppingBag} accent="#10B981" sub="4 pendientes" />
                <StatCard label="Ticket prom" value={fmtMoney(20742)} icon={BarChart3} accent="#8B5CF6" delta="+6% vs ayer" deltaPos />
                <StatCard label="Clientes nuevos" value="3" icon={Users} accent="#F59E0B" delta="+1" deltaPos />
            </div>

            {/* 3. Alertas */}
            {alertas.length > 0 ? (
                <Card padding="sm" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Bell size={15} style={{ color: 'var(--color-warning)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{alertas.length} alertas</span>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => setAlertas([])} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Limpiar todas</button>
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
                                        <button onClick={() => setAlertas(al => al.filter(x => x.id !== a.id))} style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}><X size={12} strokeWidth={2} /></button>
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
                            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>vs semana anterior</div>
                        </div>
                        <button onClick={() => setExpand('ventas')} style={iconBtn}><Maximize2 size={15} /></button>
                    </div>
                    <LineChart data={SERIE_VENTAS.valores} labels={SERIE_VENTAS.labels} height={280} formatValue={money} />
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
                    {topView === 'productos'  && <TopProductos productos={TOP_PRODUCTOS} />}
                    {topView === 'categorias' && <BarChart color="#8B5CF6" data={[{ label: 'Camperas', value: 32 }, { label: 'Remeras', value: 28 }, { label: 'Pantalones', value: 22 }, { label: 'Buzos', value: 12 }, { label: 'Accesorios', value: 6 }]} />}
                    {topView === 'canal'      && <DonutChart size={140} data={[{ label: 'Online', value: 68, color: '#3B82F6' }, { label: 'Presencial', value: 32, color: '#10B981' }]} />}
                </Card>
            </div>

            {/* 5. Actividad reciente */}
            <Card padding="md" style={{ padding: 0, marginBottom: 16 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Actividad reciente</span>
                    <button onClick={() => goSeccion('pedidos')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Ver todos →</button>
                </div>
                {MOCK_PEDIDOS.slice(0, 5).map((p, i) => (
                    <div key={p.id} className="dash-act-row" onClick={() => goSeccion('pedidos', { vista: 'detalle', id: p.id })} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto 130px 70px', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < 4 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>#{p.id}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <Avatar name={p.cliente} size={24} />
                            <span style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.cliente}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.monto)}</span>
                        <span className="dash-act-hide"><Badge status={p.estado} size="sm" /></span>
                        <span className="dash-act-hide" style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{new Date(p.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                ))}
            </Card>

            {/* Modales de expandir */}
            <Modal isOpen={expand === 'ventas'} onClose={() => setExpand(null)} title="Ventas de la semana" maxWidth={760}>
                <LineChart data={SERIE_VENTAS.valores} labels={SERIE_VENTAS.labels} height={340} formatValue={money} />
            </Modal>
            <Modal isOpen={expand === 'top'} onClose={() => setExpand(null)} title="Top productos" maxWidth={760}>
                <TopProductos productos={TOP_PRODUCTOS} />
            </Modal>

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant="success" title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
