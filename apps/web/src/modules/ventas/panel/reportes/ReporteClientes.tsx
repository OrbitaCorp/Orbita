// src/modules/ventas/panel/reportes/ReporteClientes.tsx — Vista 13
//
// (Fase 4 — Ale) Antes era 100% maqueta. Ahora todo sale del nuevo
// GET /reports/customers: las métricas de la cartera (activos, nuevos del mes,
// % recurrentes, LTV), el gráfico de altas por semana, la tarjeta "Clientes
// para reactivar" y el top por gasto. El export baja TODOS los clientes a un
// Excel de verdad (exceljs, mismo estilo que el historial).
//
// Se sacó la segmentación (torta VIP/Recurrente/Nuevo/Inactivo, columna en el
// top y en el Excel): etiquetas abstractas que no decían qué HACER. En su
// lugar, "Clientes para reactivar" lista a los que gastaban y hace 60+ días
// que no vuelven — una lista concreta de a quién escribirle hoy, armada acá
// mismo con los datos que el reporte ya trae.

import { useEffect, useState } from 'react'
import { Download, Users, TrendingUp, Banknote, BarChart2 } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { KpiCard } from '@/design-system/components/KpiCard'
import { SkeletonBarras, SkeletonCircle, SkeletonText } from '@/design-system/components/Skeleton'
import { BarChart } from '@/design-system/components/Chart'
import { fmtMoney, toastEsError } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, panelGetCustomersReport, type ApiCustomersReport } from '@/lib/api'
import type { VistaReporte } from './components/ReporteTabs'

// A partir de cuántos días sin comprar un cliente entra en "para reactivar".
const DIAS_REACTIVAR = 60

// `ir` es parte del contrato del hub de reportes pero esta pantalla no navega
// entre tabs de reportes (usa su propia tab bar con irLista) — no se destructura.
export default function ReporteClientes({ irLista }: { ir: (v: VistaReporte) => void; irLista: () => void }) {
    const { user } = useAuth()
    const puedeExportar = user?.type === 'member' && user.permissions.includes('reports.export')

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
            .then(r => {
                if (cancelado) return
                // Guardia de forma: si el backend responde con otra forma (versión
                // vieja o a medio desplegar), mejor el cartel con "Reintentar" que
                // una pantalla rota a mitad de render.
                if (!r || !r.metricas || !r.topClientes || !r.clientes || !r.nuevosPorSemana) {
                    throw new ApiError(0, 'La respuesta del servidor llegó incompleta. Reintentá en un momento.')
                }
                setDatos(r); setErrorCarga(null)
            })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar el reporte de clientes') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [reintento])

    const m = datos?.metricas
    const cargandoKpis = cargando && !datos

    // "Para reactivar": compraban y hace DIAS_REACTIVAR+ días que no vuelven,
    // ordenados por su gasto histórico (primero los que más plata dejaban).
    // Se arma acá con la lista completa que el reporte ya trae — sin pedirle
    // nada nuevo al backend.
    const paraReactivar = (datos?.clientes ?? [])
        .filter(c => c.ultimaCompra)
        .map(c => ({ ...c, dias: Math.floor((Date.now() - new Date(c.ultimaCompra as string).getTime()) / 86400000) }))
        .filter(c => c.dias >= DIAS_REACTIVAR)
        .sort((a, b) => b.gastado - a.gastado)
        .slice(0, 5)

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
                { header: 'Pedidos', key: 'pedidos', width: 10 },
                { header: 'Total gastado', key: 'gastado', width: 16, style: { numFmt: '"$"#,##0.00' } },
                { header: 'Última compra', key: 'ultima', width: 16 },
                { header: 'Cliente desde', key: 'desde', width: 16 },
            ]

            for (const c of datos.clientes) {
                ws.addRow({
                    nombre: c.nombre,
                    pedidos: c.pedidos,
                    gastado: c.gastado,
                    ultima: c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('es-AR') : '-',
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
        <div className="rc-page panel-page">
            <style>{`
                @media (max-width: 768px) {
                    /* Cuatro KPIs en fila daban tarjetas de ~90px: el label
                       partido en tres renglones y la nota al pie ilegible. */
                    .rc-kpis   { grid-template-columns: repeat(2,1fr) !important; gap: 8px !important; }
                    /* El gráfico semanal y el panel de reactivación uno al lado
                       del otro entraban en 170px cada uno. */
                    .rc-2col   { grid-template-columns: minmax(0,1fr) !important; gap: 12px !important; }
                    .rc-head h1 { font-size: 21px !important; }
                    .rc-head    { align-items: stretch !important; }
                    .rc-head > button { width: 100% !important; }
                    /* La fila del ranking: el gasto necesita su ancho, el
                       nombre se lleva lo que sobra. */
                    .rc-top-fila { grid-template-columns: 20px minmax(0,1fr) auto !important; gap: 8px !important; padding: 10px 14px !important; }
                    .rc-top-hide { display: none !important; }
                }
            `}</style>
            {/* Tab bar igual al módulo clientes */}
            <div style={{ display:'flex', gap:4, borderBottom:'1px solid var(--color-border)', marginBottom:20 }}>
                {([['lista', 'Lista', false], ['reporte', 'Reporte clientes', true]] as [string, string, boolean][]).map(([k, l, icon]) => {
                    const a = k === 'reporte'
                    return (
                        <button key={k} className="ds-hover" onClick={() => k === 'lista' && irLista()} style={{ padding:'10px 14px', border:'none', background:'transparent', color: a ? 'var(--color-text)' : 'var(--color-muted)', fontSize:13.5, fontWeight: a ? 600 : 500, fontFamily:'inherit', borderBottom:`2px solid ${a ? 'var(--color-primary)' : 'transparent'}`, marginBottom:-1, whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:6, borderRadius:'6px 6px 0 0' }}>
                            {icon && <BarChart2 size={13} />}
                            {l}
                        </button>
                    )
                })}
            </div>

            <div className="rc-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
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

            <div className="rc-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Clientes activos" value={m?.activos ?? 0} delta={0} icon={Users} accent="#3B82F6" loading={cargandoKpis} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>compraron en los últimos 90 días</span>} />
                {/* Sin jerga: "Δ", "LTV" y un "50,0" pelado no los entiende
                    nadie que no venga de marketing — cada métrica dice qué es
                    en criollo y el porcentaje lleva su símbolo. */}
                <KpiCard label="Nuevos este mes" value={m?.nuevosMes ?? 0} delta={m?.deltaNuevosMes ?? 0} deltaEnUnidades icon={Users} accent="#10B981" loading={cargandoKpis} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>vs mes pasado</span>} />
                <KpiCard label="Clientes que repiten" value={m?.recurrentesPct ?? 0} delta={0} suffix="%" icon={TrendingUp} accent="#8B5CF6" loading={cargandoKpis} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>compraron 2 o más veces</span>} />
                <KpiCard label="Valor por cliente" value={m?.ltvPromedio ?? 0} delta={0} prefix="$" icon={Banknote} accent="#F59E0B" loading={cargandoKpis} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>gasto total promedio por cliente</span>} />
            </div>

            <div className="rc-2col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, marginBottom: 16 }}>
                <Card>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 14 }}>Nuevos clientes por semana</div>
                    {cargandoKpis ? (
                        <SkeletonBarras alturas={[45, 70, 35, 80]} height={150} gap={14} padding="0 8px" />
                    ) : (
                        <BarChart color="#10B981" data={datos?.nuevosPorSemana ?? []} />
                    )}
                </Card>
                <Card>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Clientes para reactivar</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)', margin: '2px 0 10px' }}>Compraban y hace {DIAS_REACTIVAR}+ días que no vuelven</div>
                    {cargandoKpis ? (
                        <div aria-hidden="true">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                                    <SkeletonCircle size={28} delay={i * 80} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <SkeletonText width={`${[62, 48, 55, 40][i]}%`} height={11} delay={i * 80 + 30} />
                                        <SkeletonText width="30%" height={9} delay={i * 80 + 60} />
                                    </div>
                                    <SkeletonText width={52} height={11} delay={i * 80 + 90} />
                                </div>
                            ))}
                        </div>
                    ) : paraReactivar.length === 0 ? (
                        <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
                            Nadie para reactivar: los que compraron volvieron hace poco. ✓
                        </div>
                    ) : (
                        paraReactivar.map((c, i) => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < paraReactivar.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <Avatar name={c.nombre} size={28} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>hace {c.dias} días</div>
                                </div>
                                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }} title="Gasto histórico">{fmtMoney(c.gastado)}</span>
                            </div>
                        ))
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
                                <SkeletonText width={72} height={12} delay={i * 90 + 120} />
                            </div>
                        ))}
                    </div>
                ) : (datos?.topClientes.length ?? 0) === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13.5, color: 'var(--color-muted)' }}>
                        Todavía no hay compras registradas.
                    </div>
                ) : (
                    (datos?.topClientes ?? []).map((c, i, arr) => (
                        <div key={c.id} className="rc-top-fila" style={{ display: 'grid', gridTemplateColumns: '24px 1fr 90px 130px', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{i + 1}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <Avatar name={c.nombre} size={28} />
                                <span style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</span>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{c.pedidos} ped.</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{fmtMoney(c.gastado)}</span>
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
// pelearse con el z-index del hub de reportes). El borde se pinta según si el
// mensaje es de error o de éxito, para no mostrar un fallo en verde.
function ToastMini({ texto }: { texto: string }) {
    const color = toastEsError(texto) ? 'var(--color-error)' : 'var(--color-success)'
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: `3px solid ${color}`, borderRadius: 10, boxShadow: '0 4px 12px rgba(15,23,42,0.10)', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            {texto}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
