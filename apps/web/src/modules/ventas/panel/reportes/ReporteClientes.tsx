// src/modules/ventas/panel/reportes/ReporteClientes.tsx — Vista 13
//
// (Fase 4 — Ale) Antes era 100% maqueta. Ahora todo sale del nuevo
// GET /reports/customers: las métricas de la cartera (activos, nuevos del mes,
// % recurrentes, LTV), el gráfico de altas por semana, la torta de segmentos
// (el segmento lo calcula el backend al leer — vip / recurrente / nuevo /
// inactivo) y el top por gasto. El export baja TODOS los clientes con su
// segmento a un Excel de verdad (exceljs, mismo estilo que el historial).

import { useEffect, useState } from 'react'
import { Download, Users, TrendingUp, Banknote, BarChart2 } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { KpiCard } from '@/design-system/components/KpiCard'
import { Skeleton, SkeletonCircle, SkeletonText, SkeletonChip } from '@/design-system/components/Skeleton'
import { BarChart, DonutChart } from '@/design-system/components/Chart'
import { fmtMoney } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, panelGetCustomersReport, type ApiCustomersReport, type ApiSegmento } from '@/lib/api'
import type { VistaReporte } from './components/ReporteTabs'
import { SegmentoBadge } from '../clientes/components/SegmentoBadge'

const SEG_COLORES: Record<ApiSegmento, string> = {
    vip: '#F59E0B', recurrente: '#3B82F6', nuevo: '#10B981', inactivo: '#94A3B8',
}
const SEG_LABELS: Record<ApiSegmento, string> = {
    vip: 'VIP', recurrente: 'Recurrente', nuevo: 'Nuevo', inactivo: 'Inactivo',
}

// `ir` es parte del contrato del hub de reportes pero esta pantalla no navega
// entre tabs de reportes (usa su propia tab bar con irLista) — no se destructura.
export default function ReporteClientes({ irLista }: { ir: (v: VistaReporte) => void; irLista: () => void }) {
    const { user } = useAuth()
    const puedeExportar = user?.type === 'member' && user.permissions.includes('reports.view')

    const [datos, setDatos]           = useState<ApiCustomersReport | null>(null)
    const [cargando, setCargando]     = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [reintento, setReintento]   = useState(0)
    const [exportando, setExportando] = useState(false)
    const [toast, setToast]           = useState<string | null>(null)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    useEffect(() => {
        let cancelado = false
        setCargando(true)
        panelGetCustomersReport()
            .then(r => { if (!cancelado) { setDatos(r); setErrorCarga(null) } })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar el reporte de clientes') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [reintento])

    const m = datos?.metricas
    const cargandoKpis = cargando && !datos

    // ── Exportar a Excel ── mismo armado que el export del historial de pedidos.
    async function exportarExcel() {
        if (exportando || !datos) return
        setExportando(true)
        try {
            const ExcelJS = (await import('exceljs')).default
            if (datos.clientes.length === 0) { setToast('No hay clientes para exportar.'); return }

            const wb = new ExcelJS.Workbook()
            wb.creator = 'Órbita'
            wb.created = new Date()
            const ws = wb.addWorksheet('Clientes', { views: [{ state: 'frozen', ySplit: 1 }] })

            ws.columns = [
                { header: 'Cliente', key: 'nombre', width: 28 },
                { header: 'Segmento', key: 'segmento', width: 14 },
                { header: 'Pedidos', key: 'pedidos', width: 10 },
                { header: 'Total gastado', key: 'gastado', width: 16, style: { numFmt: '"$"#,##0.00' } },
                { header: 'Última compra', key: 'ultima', width: 16 },
                { header: 'Cliente desde', key: 'desde', width: 16 },
            ]

            for (const c of datos.clientes) {
                ws.addRow({
                    nombre: c.nombre,
                    segmento: SEG_LABELS[c.segmento],
                    pedidos: c.pedidos,
                    gastado: c.gastado,
                    ultima: c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('es-AR') : '—',
                    desde: new Date(c.creadoEl).toLocaleDateString('es-AR'),
                })
            }

            const header = ws.getRow(1)
            header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
            header.alignment = { vertical: 'middle' }
            header.height = 22

            ws.eachRow((row, i) => {
                row.eachCell(cell => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    }
                    if (i > 1) cell.alignment = { vertical: 'middle' }
                })
                if (i > 1 && i % 2 === 0) {
                    row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } })
                }
            })

            const buffer = await wb.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `reporte-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`
            a.click()
            URL.revokeObjectURL(url)
            setToast(`${datos.clientes.length} cliente${datos.clientes.length === 1 ? '' : 's'} exportado${datos.clientes.length === 1 ? '' : 's'} a Excel`)
        } catch {
            setToast('No se pudo generar el Excel')
        } finally {
            setExportando(false)
        }
    }

    return (
        <div style={pageWrap}>
            {/* Tab bar igual al módulo clientes */}
            <div style={{ display:'flex', gap:4, borderBottom:'1px solid var(--color-border)', marginBottom:20 }}>
                {([['lista', 'Lista', false], ['reporte', 'Reporte clientes', true]] as [string, string, boolean][]).map(([k, l, icon]) => {
                    const a = k === 'reporte'
                    return (
                        <button key={k} onClick={() => k === 'lista' && irLista()} style={{ padding:'10px 14px', border:'none', background:'transparent', color: a ? 'var(--color-text)' : 'var(--color-muted)', fontSize:13.5, fontWeight: a ? 600 : 500, cursor:'pointer', fontFamily:'inherit', borderBottom:`2px solid ${a ? 'var(--color-primary)' : 'transparent'}`, marginBottom:-1, whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:6 }}>
                            {icon && <BarChart2 size={13} />}
                            {l}
                        </button>
                    )
                })}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Reporte de clientes</h1>
                {puedeExportar && (
                    <Button variant="outline" icon={<Download size={15} />} loading={exportando} disabled={!datos || exportando} onClick={() => void exportarExcel()}>Exportar</Button>
                )}
            </div>

            {/* Error de carga, con reintento */}
            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Clientes activos" value={m?.activos ?? 0} delta={0} icon={Users} accent="#3B82F6" loading={cargandoKpis} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>compraron en los últimos 90 días</span>} />
                <KpiCard label="Nuevos este mes" value={m?.nuevosMes ?? 0} delta={m?.deltaNuevosMes ?? 0} icon={Users} accent="#10B981" loading={cargandoKpis} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Δ vs mes pasado, en clientes</span>} />
                <KpiCard label="Recurrentes" value={m?.recurrentesPct ?? 0} delta={0} decimals={1} icon={TrendingUp} accent="#8B5CF6" loading={cargandoKpis} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>% de compradores con 2+ pedidos</span>} />
                <KpiCard label="LTV prom" value={m?.ltvPromedio ?? 0} delta={0} prefix="$" icon={Banknote} accent="#F59E0B" loading={cargandoKpis} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, marginBottom: 16 }}>
                <Card>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 14 }}>Nuevos clientes por semana</div>
                    {cargandoKpis ? (
                        <div style={{ height: 150, display: 'flex', alignItems: 'flex-end', gap: 14, padding: '0 8px' }} aria-hidden="true">
                            {[45, 70, 35, 80].map((h, i) => <Skeleton key={i} width="100%" height={`${h}%`} radius={6} delay={i * 90} />)}
                        </div>
                    ) : (
                        <BarChart color="#10B981" data={datos?.nuevosPorSemana ?? []} />
                    )}
                </Card>
                <Card>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 14 }}>Segmentación</div>
                    {cargandoKpis ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '8px 0' }} aria-hidden="true">
                            <SkeletonCircle size={140} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                                {[0, 1, 2, 3].map(i => <SkeletonText key={i} width={`${[70, 55, 62, 48][i]}%`} height={11} delay={i * 80} />)}
                            </div>
                        </div>
                    ) : (datos?.segmentacion ?? []).every(s => s.cantidad === 0) ? (
                        <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>Todavía no hay clientes cargados.</div>
                    ) : (
                        <DonutChart
                            size={140}
                            data={(datos?.segmentacion ?? []).filter(s => s.cantidad > 0).map(s => ({
                                label: SEG_LABELS[s.segmento], value: s.cantidad, color: SEG_COLORES[s.segmento],
                            }))}
                        />
                    )}
                </Card>
            </div>

            <Card padding="md" style={{ padding: 0 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Top clientes por gasto</div>
                {cargandoKpis ? (
                    <div aria-hidden="true">
                        {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < 4 ? '1px solid var(--color-border)' : 'none', height: 49 }}>
                                <SkeletonText width={14} height={12} delay={i * 90} />
                                <SkeletonCircle size={28} delay={i * 90 + 30} />
                                <SkeletonText width={`${[36, 28, 42, 24, 33][i]}%`} height={12} delay={i * 90 + 60} />
                                <span style={{ flex: 1 }} />
                                <SkeletonText width={54} height={11} delay={i * 90 + 90} />
                                <SkeletonChip width={78} delay={i * 90 + 120} />
                            </div>
                        ))}
                    </div>
                ) : (datos?.topClientes.length ?? 0) === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13.5, color: 'var(--color-muted)' }}>
                        Todavía no hay compras registradas.
                    </div>
                ) : (
                    (datos?.topClientes ?? []).map((c, i, arr) => (
                        <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 110px 120px', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{i + 1}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <Avatar name={c.nombre} size={28} />
                                <span style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</span>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{c.pedidos} ped.</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{fmtMoney(c.gastado)}</span>
                            <span style={{ display: 'flex', justifyContent: 'flex-end' }}><SegmentoBadge segmento={c.segmento} size="sm" /></span>
                        </div>
                    ))
                )}
            </Card>

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <ToastMini texto={toast} />
                </div>
            )}
        </div>
    )
}

// Toast liviano local (misma estética que el Toast del design system, sin
// pelearse con el z-index del hub de reportes).
function ToastMini({ texto }: { texto: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-success)', borderRadius: 10, boxShadow: '0 4px 12px rgba(15,23,42,0.10)', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            {texto}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
