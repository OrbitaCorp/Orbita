// src/modules/ventas/panel/reportes/ReportePagos.tsx
//
// Ingresos por medio de pago — GET /reports/payments. Posible desde que cada
// pedido deja un Payment real sin importar el medio (RBT-619, resuelto):
// antes, CASH/TRANSFER/DEBIT_CARD/CREDIT_CARD nunca dejaban ningún registro,
// así que este reporte no tenía con qué construirse.

import { useEffect, useState } from 'react'
import { Wallet, Receipt, Landmark, Percent } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { SkeletonKpis, SkeletonFilas } from '@/design-system/components/Skeleton'
import { DonutChart } from '@/design-system/components/Chart'
import { fmtMoney } from '@/lib/utils'
import { StatCard } from '../_shared/StatCard'
import { ReporteTabs, type VistaReporte } from './components/ReporteTabs'
import { panelGetPaymentsReport, ApiError, type ApiPaymentsReport } from '@/lib/api'

// Mismo diccionario que ya usa PedidoDetalle.tsx (METODO_PAGO) para traducir
// el enum crudo que manda el backend.
const METODO_LABEL: Record<string, string> = {
    MERCADOPAGO: 'Mercado Pago', CASH: 'Efectivo', DEBIT_CARD: 'Tarjeta de débito',
    CREDIT_CARD: 'Tarjeta de crédito', TRANSFER: 'Coordinar por WhatsApp', QR: 'QR',
    CREDIT_NOTE: 'Nota de crédito',
}
const METODO_COLOR: Record<string, string> = {
    MERCADOPAGO: '#3B82F6', CASH: '#10B981', DEBIT_CARD: '#8B5CF6',
    CREDIT_CARD: '#F59E0B', TRANSFER: '#06B6D4', QR: '#EC4899', CREDIT_NOTE: '#94A3B8',
}
const hueRespaldo = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

const COLS = '1.5fr 130px 130px 100px 90px'

function fechaCorta(iso: string): string {
    const d = new Date(iso)
    const m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`
}

export default function ReportePagos({ ir }: { ir: (v: VistaReporte) => void }) {
    const [datos, setDatos]           = useState<ApiPaymentsReport | null>(null)
    const [cargando, setCargando]     = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [reintento, setReintento]   = useState(0)

    useEffect(() => {
        let cancelado = false
        setCargando(true)
        panelGetPaymentsReport()
            .then(r => {
                if (cancelado) return
                // Guardia de forma: si el backend responde con otra forma
                // (versión vieja o a medio desplegar), mejor el cartel con
                // "Reintentar" que una pantalla rota a mitad de render.
                if (!r || !Array.isArray(r.porMedio)) {
                    throw new ApiError(0, 'La respuesta del servidor llegó incompleta. Reintentá en un momento.')
                }
                setDatos(r); setErrorCarga(null)
            })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar el reporte de pagos') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [reintento])

    const cargandoInicial = cargando && !datos
    const porMedio = datos?.porMedio ?? []
    const cantidadTotal = porMedio.reduce((s, m) => s + m.cantidad, 0)
    const comisionTotal = porMedio.reduce((s, m) => s + m.comision, 0)
    const medioTop = porMedio[0] ?? null // ya viene ordenado desc por monto

    return (
        <div style={pageWrap}>
            <ReporteTabs activo="pagos" ir={ir} />

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Ingresos por medio de pago</h1>
                    {datos && <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 4 }}>{fechaCorta(datos.desde)} – {fechaCorta(datos.hasta)}</div>}
                </div>
            </div>

            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                {cargandoInicial ? (
                    <SkeletonKpis cantidad={4} />
                ) : (
                    <>
                        <StatCard label="Total cobrado" value={fmtMoney(datos?.total ?? 0)} icon={Wallet} accent="#3B82F6" />
                        <StatCard label="Cantidad de pagos" value={cantidadTotal} icon={Receipt} accent="#10B981" />
                        <StatCard label="Medio principal" value={medioTop ? (METODO_LABEL[medioTop.method] ?? medioTop.method) : '—'} icon={Landmark} accent="#8B5CF6" />
                        <StatCard label="Comisión Mercado Pago" value={fmtMoney(comisionTotal)} icon={Percent} accent="#EF4444" sub="sobre pagos con MP" />
                    </>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 16, marginBottom: 16 }}>
                <Card>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 14 }}>Distribución</div>
                    {cargandoInicial ? (
                        <div style={{ display: 'grid', placeItems: 'center', height: 160 }}><SkeletonKpis cantidad={1} /></div>
                    ) : porMedio.length === 0 ? (
                        <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>Sin pagos en el período.</div>
                    ) : (
                        <DonutChart
                            size={150}
                            data={porMedio.map(m => ({
                                label: METODO_LABEL[m.method] ?? m.method,
                                value: m.monto,
                                color: METODO_COLOR[m.method] ?? `hsl(${hueRespaldo(m.method)}, 55%, 55%)`,
                            }))}
                        />
                    )}
                </Card>

                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <span>Medio</span><span style={{ textAlign: 'right' }}>Monto</span><span style={{ textAlign: 'right' }}>Comisión</span><span style={{ textAlign: 'right' }}>Pagos</span><span style={{ textAlign: 'right' }}>%</span>
                    </div>
                    {cargandoInicial ? (
                        <SkeletonFilas filas={4} />
                    ) : porMedio.length === 0 ? (
                        <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13.5, color: 'var(--color-muted)' }}>
                            Todavía no hay pagos registrados en este período.
                        </div>
                    ) : (
                        porMedio.map((m, i) => (
                            <div key={m.method} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 52, borderBottom: i < porMedio.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: METODO_COLOR[m.method] ?? `hsl(${hueRespaldo(m.method)}, 55%, 55%)`, flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{METODO_LABEL[m.method] ?? m.method}</span>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{fmtMoney(m.monto)}</span>
                                <span style={{ fontSize: 12, color: m.comision > 0 ? 'var(--color-error)' : 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{m.comision > 0 ? `−${fmtMoney(m.comision)}` : '—'}</span>
                                <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{m.cantidad}</span>
                                <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{(datos?.total ?? 0) > 0 ? Math.round((m.monto / (datos!.total)) * 100) : 0}%</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
