// src/modules/ventas/panel/reportes/ReporteVentas.tsx — Vista 11 + hub del módulo
//
// Punto de entrada del módulo `reportes` (registrado en el componentMap admin).
// Funciona como HUB con tabs: ventas (V11), productos (V12), clientes (V13),
// inventario (V14), conmutados vía `router.query.vista`.
//
//   /admin/[negocioId]/ventas/reportes                → ventas (V11)
//   …/reportes?vista=productos                        → ReporteProductos (V12)
//   …/reportes?vista=clientes                         → ReporteClientes (V13)
//   …/reportes?vista=inventario                       → ReporteInventario (V14)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Download, Banknote, ShoppingBag, BarChart3, XCircle } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { KpiCard } from '@/design-system/components/KpiCard'
import { BarChart } from '@/design-system/components/Chart'
import { fmtMoney, toastEsError } from '@/lib/utils'
import { adminPath, currentSlug } from '@/lib/tenant'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, panelGetSalesReport, type ApiSalesReport } from '@/lib/api'

import { ReporteTabs, type VistaReporte } from './components/ReporteTabs'
import ReporteProductos from './ReporteProductos'
import ReporteClientes from './ReporteClientes'
import ReporteInventario from './ReporteInventario'
import ReportePagos from './ReportePagos'

// ─── Ventas (V11) ─────────────────────────────────────────────────────────────
//
// (Fase 4 — Ale) Antes eran KPIs, gráfico y "desglose por día" 100% inventados,
// y los botones PDF/CSV solo tiraban un toast. Ahora todo sale de
// GET /reports/sales: el mes en curso, el mes pasado y la variación entre
// ambos. Ese endpoint da el resumen mensual (no una serie diaria), así que se
// muestra lo que hay de verdad: los 4 KPIs con su delta y una comparación
// mes actual vs mes pasado. El export baja ese resumen a un Excel real.

function VentasView({ ir, onToast }: { ir: (v: VistaReporte) => void; onToast: (m: string) => void }) {
    const { user } = useAuth()
    const puedeExportar = user?.type === 'member' && user.permissions.includes('reports.export')

    const [datos, setDatos]           = useState<ApiSalesReport | null>(null)
    const [cargando, setCargando]     = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [reintento, setReintento]   = useState(0)
    const [exportando, setExportando] = useState(false)

    useEffect(() => {
        let cancelado = false
        setCargando(true)
        panelGetSalesReport()
            .then(r => { if (!cancelado) { setDatos(r); setErrorCarga(null) } })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar el reporte de ventas') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [reintento])

    const a = datos?.actual
    const ant = datos?.anterior
    const d = datos?.deltas
    const cargandoKpis = cargando && !datos

    const nombreMes = datos ? new Date(datos.mes).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : ''

    async function exportar() {
        if (exportando || !datos) return
        setExportando(true)
        try {
            const ExcelJS = (await import('exceljs')).default
            const wb = new ExcelJS.Workbook()
            wb.creator = 'Órbita'
            const ws = wb.addWorksheet('Ventas')
            ws.columns = [
                { header: 'Métrica', key: 'm', width: 24 },
                { header: 'Este mes', key: 'act', width: 16 },
                { header: 'Mes anterior', key: 'ant', width: 16 },
                { header: 'Variación', key: 'delta', width: 14 },
            ]
            const filas: [string, string, string, string][] = [
                ['Ventas', fmtMoney(datos.actual.ventas), fmtMoney(datos.anterior.ventas), `${datos.deltas.ventas}%`],
                ['Pedidos', String(datos.actual.pedidos), String(datos.anterior.pedidos), `${datos.deltas.pedidos}%`],
                ['Ticket promedio', fmtMoney(datos.actual.ticketPromedio), fmtMoney(datos.anterior.ticketPromedio), `${datos.deltas.ticketPromedio}%`],
                ['Tasa de cancelación', `${datos.actual.tasaCancelacion}%`, `${datos.anterior.tasaCancelacion}%`, `${datos.deltas.tasaCancelacion} pts`],
            ]
            filas.forEach(f => ws.addRow({ m: f[0], act: f[1], ant: f[2], delta: f[3] }))
            const header = ws.getRow(1)
            header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
            const buffer = await wb.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = URL.createObjectURL(blob)
            const el = document.createElement('a')
            el.href = url
            el.download = `reporte-ventas-${new Date().toISOString().slice(0, 10)}.xlsx`
            el.click()
            URL.revokeObjectURL(url)
            onToast('Reporte de ventas exportado a Excel')
        } catch {
            onToast('No se pudo generar el Excel')
        } finally {
            setExportando(false)
        }
    }

    return (
        <div style={pageWrap}>
            <ReporteTabs activo="ventas" ir={ir} />

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Reporte de ventas</h1>
                    {nombreMes && <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4, textTransform: 'capitalize' }}>{nombreMes} · vs mes anterior</div>}
                </div>
                {puedeExportar && (
                    <Button variant="outline" icon={<Download size={15} />} loading={exportando} disabled={!datos || exportando} onClick={() => void exportar()}>Exportar</Button>
                )}
            </div>

            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Ventas" value={a?.ventas ?? 0} delta={d?.ventas ?? 0} prefix="$" icon={Banknote} accent="#3B82F6" loading={cargandoKpis} />
                <KpiCard label="Pedidos" value={a?.pedidos ?? 0} delta={d?.pedidos ?? 0} icon={ShoppingBag} accent="#10B981" loading={cargandoKpis} />
                <KpiCard label="Ticket prom" value={a?.ticketPromedio ?? 0} delta={d?.ticketPromedio ?? 0} prefix="$" icon={BarChart3} accent="#8B5CF6" loading={cargandoKpis} />
                {/* La tasa de cancelación mejora cuando BAJA: el delta va en puntos. */}
                <KpiCard label="Tasa cancelación" value={a?.tasaCancelacion ?? 0} delta={d ? -d.tasaCancelacion : 0} decimals={1} icon={XCircle} accent="#F59E0B" loading={cargandoKpis} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{d ? `${d.tasaCancelacion >= 0 ? '+' : ''}${d.tasaCancelacion} pts vs mes pasado` : ''}</span>} />
            </div>

            <Card>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 14 }}>Este mes vs mes anterior</div>
                {cargandoKpis ? (
                    <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', gap: 24, padding: '0 24px' }} aria-hidden="true">
                        <div style={{ flex: 1, height: '70%', background: 'var(--color-surface-alt)', borderRadius: 6 }} />
                        <div style={{ flex: 1, height: '95%', background: 'var(--color-surface-alt)', borderRadius: 6 }} />
                    </div>
                ) : (
                    <BarChart
                        color="#3B82F6"
                        data={[
                            { label: 'Mes anterior', value: ant?.ventas ?? 0 },
                            { label: 'Este mes', value: a?.ventas ?? 0 },
                        ]}
                    />
                )}
            </Card>
        </div>
    )
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

export default function ReporteVentas() {
    const router = useRouter()
    const { vista } = router.query
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    const ir = (v: VistaReporte) => {
        const { vista: _v, ...rest } = router.query
        const q: Record<string, string | string[] | undefined> = { ...rest }
        if (v !== 'ventas') q.vista = v
        router.push({ query: q })
    }

    const irClientes = () => {
        const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
        const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
        router.push({ pathname: adminPath(negocioId, moduloPadre, 'clientes') })
    }

    const sub = vista as VistaReporte | undefined
    let content
    if (sub === 'productos')       content = <ReporteProductos ir={ir} />
    else if (sub === 'clientes')   content = <ReporteClientes ir={ir} irLista={irClientes} />
    else if (sub === 'inventario') content = <ReporteInventario ir={ir} />
    else if (sub === 'pagos')      content = <ReportePagos ir={ir} />
    else                           content = <VentasView ir={ir} onToast={setToast} />

    return (
        <>
            {content}
            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
