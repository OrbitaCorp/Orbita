// src/modules/ventas/panel/pedidos/PedidoHistorial.tsx — Vista 05
// Historial completo de pedidos con KPIs del mes y exportación.
//
// (Fase 3 — Ale, 01/08) Antes era 100% maqueta: los cuatro KPIs eran números
// escritos a mano, la tabla mostraba pedidos de muestra y los botones de
// exportar no hacían nada. Ahora todo sale del backend: los KPIs del nuevo
// GET /reports/sales (mes en curso contra mes pasado) y la tabla del mismo
// GET /orders que usa la Lista, con paginación real. La exportación baja
// TODOS los pedidos (no solo la página visible): Excel de verdad con exceljs
// (mismo estilo que el export del catálogo) y PDF vía la hoja imprimible del
// navegador (mismo mecanismo que las etiquetas de envío).

import { useEffect, useMemo, useState } from 'react'
import { Download, Banknote, ShoppingBag, BarChart3, AlertCircle } from 'lucide-react'
import { KpiCard } from '@/design-system/components/KpiCard'
import { SkeletonFilas } from '@/design-system/components/Skeleton'
import { Button } from '@/design-system/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { fmtMoney } from '@/lib/utils'
import { ApiError, getOrders, panelGetSalesReport, sendOrderEmail, type ApiOrdersPage, type ApiOrderStatus, type ApiOrderSummary, type ApiSalesReport } from '@/lib/api'
import type { VistaPedido } from './components/PedidoTabs'
import { PedidoTable } from './components/PedidoTable'
import { ModalComprobante } from './components/ModalComprobante'
import { ModalEmail, type ClienteEmail } from './components/ModalEmail'
import type { Pedido } from './types/pedidos.types'

// Misma traducción de estados que usa la Lista.
const API_A_UI: Record<ApiOrderStatus, Pedido['estado']> = {
    PENDING: 'pendiente', CONFIRMED: 'confirmado', PREPARING: 'preparacion',
    SHIPPED: 'enviado', DELIVERED: 'entregado', COMPLETED: 'entregado', CANCELLED: 'cancelado',
}
const NOMBRE_ESTADO: Record<Pedido['estado'], string> = {
    pendiente: 'Pendiente', confirmado: 'Confirmado', preparacion: 'En preparación',
    enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
}

// Colorcito estable para el dibujito de cada producto, calculado de su nombre.
const hueDe = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

// Convierte un pedido como viene del backend al formato que dibuja la tabla.
function apiAPedido(o: ApiOrderSummary): Pedido {
    return {
        id: o.id,
        numero: String(o.orderNumber),
        clienteId: o.customerId ?? '',
        cliente: o.customerName ?? 'Sin cliente',
        email: o.customerEmail ?? '',
        productos: o.items.map(it => ({ nombre: it.productName, cantidad: it.quantity, precio: it.unitPrice, hue: hueDe(it.productName) })),
        canal: o.origin === 'MANUAL' ? 'Manual' : 'Tienda',
        monto: o.total,
        estado: API_A_UI[o.status],
        fecha: typeof o.createdAt === 'string' ? o.createdAt : String(o.createdAt),
    }
}

// Baja el historial COMPLETO página por página, para exportarlo entero.
async function bajarTodos(): Promise<ApiOrderSummary[]> {
    const todos: ApiOrderSummary[] = []
    let pg = 1
    for (;;) {
        const r = await getOrders({ page: pg, limit: 100 })
        todos.push(...r.data)
        if (todos.length >= r.total || r.data.length === 0) break
        pg++
    }
    return todos
}

interface PedidoHistorialProps {
    ir:       (vista: VistaPedido, id?: string) => void
    onToast?: (msg: string) => void
}

export default function PedidoHistorial({ ir, onToast }: PedidoHistorialProps) {
    const { user } = useAuth()
    const puede = (permiso: string) => user?.type === 'member' && user.permissions.includes(permiso)
    const negocio = user?.type === 'member' ? user.business.name : ''

    const [reporte, setReporte]         = useState<ApiSalesReport | null>(null)
    const [kpisError, setKpisError]     = useState(false)
    const [page, setPage]               = useState(1)
    const [datos, setDatos]             = useState<ApiOrdersPage | null>(null)
    const [cargando, setCargando]       = useState(true)
    const [errorCarga, setErrorCarga]   = useState<string | null>(null)
    const [reintento, setReintento]     = useState(0)
    const [comprobante, setComprobante] = useState<string | null>(null)
    const [email, setEmail]             = useState<(ClienteEmail & { pedidoId: string }) | null>(null)
    const [exportando, setExportando]   = useState<'excel' | 'pdf' | null>(null)
    const [hojaPdf, setHojaPdf]         = useState<ApiOrderSummary[] | null>(null)

    // KPIs del mes (solo se piden al entrar o al reintentar, no al paginar).
    useEffect(() => {
        let cancelado = false
        setKpisError(false)
        panelGetSalesReport()
            .then(r => { if (!cancelado) setReporte(r) })
            .catch(() => { if (!cancelado) setKpisError(true) })
        return () => { cancelado = true }
    }, [reintento])

    // La tabla: cada cambio de página vuelve a pedir la lista.
    useEffect(() => {
        let cancelado = false
        setCargando(true)
        getOrders({ page })
            .then(r => { if (!cancelado) { setDatos(r); setErrorCarga(null) } })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar el historial de pedidos') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [page, reintento])

    const rows = useMemo(() => (datos?.data ?? []).map(apiAPedido), [datos])
    const total  = datos?.total ?? 0
    const limite = datos?.limit ?? 20
    const desde  = total === 0 ? 0 : (page - 1) * limite + 1
    const hasta  = Math.min(page * limite, total)

    const k = reporte?.actual
    const d = reporte?.deltas

    // ── Exportar a Excel ──
    // Mismo armado que el export del catálogo: encabezado con color, anchos
    // por columna, moneda formateada y filas alternadas.
    async function exportarExcel() {
        if (exportando) return
        setExportando('excel')
        try {
            const ExcelJS = (await import('exceljs')).default
            const todos = await bajarTodos()
            if (todos.length === 0) { onToast?.('No hay pedidos para exportar.'); return }

            const wb = new ExcelJS.Workbook()
            wb.creator = 'Órbita'
            wb.created = new Date()
            const ws = wb.addWorksheet('Pedidos', { views: [{ state: 'frozen', ySplit: 1 }] })

            ws.columns = [
                { header: '# Pedido', key: 'numero', width: 10 },
                { header: 'Fecha', key: 'fecha', width: 18 },
                { header: 'Cliente', key: 'cliente', width: 26 },
                { header: 'Email', key: 'email', width: 28 },
                { header: 'Productos', key: 'productos', width: 42 },
                { header: 'Canal', key: 'canal', width: 11 },
                { header: 'Estado', key: 'estado', width: 15 },
                { header: 'Total', key: 'total', width: 14, style: { numFmt: '"$"#,##0.00' } },
            ]

            for (const o of todos) {
                ws.addRow({
                    numero: o.orderNumber,
                    fecha: new Date(o.createdAt).toLocaleString('es-AR'),
                    cliente: o.customerName ?? 'Sin cliente',
                    email: o.customerEmail ?? '',
                    productos: o.items.map(it => `${it.quantity}x ${it.productName}`).join(' · '),
                    canal: o.origin === 'MANUAL' ? 'Manual' : 'Tienda',
                    estado: NOMBRE_ESTADO[API_A_UI[o.status]],
                    total: o.total,
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
            a.download = `historial-pedidos-${new Date().toISOString().slice(0, 10)}.xlsx`
            a.click()
            URL.revokeObjectURL(url)
            onToast?.(`${todos.length} pedido${todos.length === 1 ? '' : 's'} exportado${todos.length === 1 ? '' : 's'} a Excel`)
        } catch {
            onToast?.('No se pudo generar el Excel')
        } finally {
            setExportando(null)
        }
    }

    // ── Exportar a PDF ──
    // Abre la hoja imprimible con todo el historial; desde ahí "Imprimir /
    // guardar PDF" usa el diálogo del navegador (destino: Guardar como PDF).
    async function exportarPdf() {
        if (exportando) return
        setExportando('pdf')
        try {
            const todos = await bajarTodos()
            if (todos.length === 0) { onToast?.('No hay pedidos para exportar.'); return }
            setHojaPdf(todos)
        } catch {
            onToast?.('No se pudieron cargar los pedidos para el PDF')
        } finally {
            setExportando(null)
        }
    }

    return (
        <div className="hist-page" style={pageWrap}>
            <style>{`
                @media (max-width: 768px) {
                    .hist-page   { padding: 16px 14px 48px !important; }
                    .hist-header { flex-direction: column; align-items: flex-start !important; }
                    .hist-kpis   { grid-template-columns: repeat(2,1fr) !important; }
                }
                @media (max-width: 460px) {
                    .hist-kpis   { grid-template-columns: 1fr !important; }
                }
            `}</style>

            {/* Header */}
            <div className="hist-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Historial de pedidos</h1>
                {puede('orders.export') && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="outline" icon={<Download size={15} />} loading={exportando === 'excel'} disabled={exportando !== null} onClick={() => void exportarExcel()}>Excel</Button>
                        <Button variant="outline" icon={<Download size={15} />} loading={exportando === 'pdf'} disabled={exportando !== null} onClick={() => void exportarPdf()}>PDF</Button>
                    </div>
                )}
            </div>

            {/* KPIs del mes en curso, comparados contra el mes pasado */}
            <div className="hist-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Ventas mes" value={k?.ventas ?? 0} delta={d?.ventas ?? 0} prefix="$" accent="#3B82F6" icon={Banknote} loading={!reporte && !kpisError} />
                <KpiCard label="Pedidos mes" value={k?.pedidos ?? 0} delta={d?.pedidos ?? 0} accent="#10B981" icon={ShoppingBag} loading={!reporte && !kpisError} />
                <KpiCard label="Ticket prom" value={k?.ticketPromedio ?? 0} delta={d?.ticketPromedio ?? 0} prefix="$" accent="#8B5CF6" icon={BarChart3} loading={!reporte && !kpisError} />
                <KpiCard label="Tasa cancelación" value={k?.tasaCancelacion ?? 0} delta={d?.tasaCancelacion ?? 0} decimals={1} accent="#EF4444" icon={AlertCircle} loading={!reporte && !kpisError} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>% del total · Δ en puntos</span>} />
            </div>
            {kpisError && (
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '-6px 0 14px' }}>
                    No se pudieron cargar las métricas del mes — el listado sigue abajo. <button onClick={() => setReintento(n => n + 1)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: '10px 8px', margin: '-10px -8px', minHeight: 44, borderRadius: 6, fontWeight: 600 }}>Reintentar</button>
                </div>
            )}

            {/* Error de carga de la tabla, con reintento */}
            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            {cargando && !datos ? (
                /* Silueta de la tabla real (avatar + cliente + estado + monto). */
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                    <SkeletonFilas filas={6} />
                </div>
            ) : (
                <>
                    {/* Refetch con datos en pantalla (cambio de página): la tabla
                        se atenúa y avisa, para que el click no parezca muerto. */}
                    <div style={{ position: 'relative', opacity: cargando ? 0.45 : 1, pointerEvents: cargando ? 'none' : 'auto', transition: 'opacity 180ms ease' }} aria-busy={cargando}>
                        {cargando && (
                            <div style={{ position: 'absolute', top: 10, right: 14, zIndex: 5, fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>
                                Actualizando…
                            </div>
                        )}
                        <PedidoTable
                            rows={rows}
                            onRowClick={(p: Pedido) => ir('detalle', p.id)}
                            onComprobante={(p) => setComprobante(p.id)}
                            onEmail={(p) => setEmail({ nombre: p.cliente, email: p.email, pedidoId: p.id })}
                        />
                    </div>

                    {!errorCarga && rows.length === 0 && (
                        <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13.5, color: 'var(--color-muted)' }}>
                            Todavía no hay pedidos en el historial.
                        </div>
                    )}

                    {/* Paginación real */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 4px', flexWrap: 'wrap', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                            Mostrando <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{desde}–{hasta}</strong> de <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{total}</strong>
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Anterior</Button>
                            <Button variant="outline" size="sm" disabled={hasta >= total} onClick={() => setPage(p => p + 1)}>Siguiente →</Button>
                        </div>
                    </div>
                </>
            )}

            {/* Hoja imprimible del PDF (tapa la pantalla; al imprimir sale solo esto) */}
            {hojaPdf && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10000, overflow: 'auto', background: 'var(--color-surface)' }}>
                    <style>{`
                        @media print {
                            body * { visibility: hidden !important; }
                            .hist-print-zone, .hist-print-zone * { visibility: visible !important; }
                            .hist-print-zone { position: absolute !important; left: 0; top: 0; width: 100%; }
                            .hist-print-bar { display: none !important; }
                        }
                    `}</style>
                    <div className="hist-print-bar" style={{ position: 'sticky', top: 0, zIndex: 50, height: 56, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button onClick={() => setHojaPdf(null)} style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: '12px 10px', margin: '0 -10px', minHeight: 44, borderRadius: 6 }}>← Cerrar</button>
                        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{hojaPdf.length} pedido{hojaPdf.length === 1 ? '' : 's'}</span>
                        <Button variant="primary" size="sm" onClick={() => window.print()}>Imprimir / guardar PDF</Button>
                    </div>
                    <div className="hist-print-zone" style={{ maxWidth: 960, margin: '0 auto', padding: 28, background: '#fff', color: '#0f172a' }}>
                        <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: 12, marginBottom: 14 }}>
                            <div style={{ fontSize: 20, fontWeight: 800 }}>Historial de pedidos{negocio ? ` — ${negocio}` : ''}</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Generado el {new Date().toLocaleDateString('es-AR')} · {hojaPdf.length} pedidos</div>
                            {k && (
                                <div style={{ fontSize: 12, color: '#334155', marginTop: 6 }}>
                                    Mes en curso: <strong>{fmtMoney(k.ventas)}</strong> en ventas · <strong>{k.pedidos}</strong> pedidos · ticket promedio <strong>{fmtMoney(k.ticketPromedio)}</strong> · cancelación <strong>{k.tasaCancelacion}%</strong>
                                </div>
                            )}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                            <thead>
                                <tr>
                                    {['#', 'Fecha', 'Cliente', 'Productos', 'Canal', 'Estado', 'Total'].map(h => (
                                        <th key={h} style={{ textAlign: h === 'Total' ? 'right' : 'left', padding: '6px 8px', borderBottom: '2px solid #0f172a', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {hojaPdf.map(o => (
                                    <tr key={o.id} style={{ breakInside: 'avoid' }}>
                                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, whiteSpace: 'nowrap' }}>#{o.orderNumber}</td>
                                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>{o.customerName ?? 'Sin cliente'}</td>
                                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', color: '#334155' }}>{o.items.map(it => `${it.quantity}x ${it.productName}`).join(' · ')}</td>
                                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{o.origin === 'MANUAL' ? 'Manual' : 'Tienda'}</td>
                                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{NOMBRE_ESTADO[API_A_UI[o.status]]}</td>
                                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtMoney(o.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <ModalComprobante isOpen={comprobante !== null} onClose={() => setComprobante(null)} id={comprobante ?? undefined} onToast={onToast} />
            {email && <ModalEmail isOpen onClose={() => setEmail(null)} cliente={email} onToast={onToast} onEnviar={async (a, c) => { await sendOrderEmail(email.pedidoId, a, c) }} />}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box', minWidth: 0 }
