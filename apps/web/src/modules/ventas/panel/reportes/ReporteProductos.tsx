// src/modules/ventas/panel/reportes/ReporteProductos.tsx — Vista 12
// Conectado a GET /reports/products (ventana de 30 días por defecto).

import { useEffect, useState } from 'react'
import { ChevronDown, Package, Tag, ShoppingBag, AlertTriangle } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { SkeletonKpis, SkeletonFilas } from '@/design-system/components/Skeleton'
import { StatCard } from '../_shared/StatCard'
import type { VistaReporte } from './components/ReporteTabs'
import { ProductoThumb } from '../pedidos/components/ProductoThumb'
import { fmtMoney } from '@/lib/utils'
import { panelGetProductsReport, ApiError, type ApiProductsReport } from '@/lib/api'

// Miniatura con imagen real; si el producto no tiene, cae al placeholder de
// color derivado del id (mismo criterio que la lista de productos).
function Mini({ url, id, size = 36 }: { url: string | null; id: string; size?: number }) {
    if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0, display: 'block' }} />
    const hue = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
    return <ProductoThumb hue={hue} size={size} />
}

export default function ReporteProductos({ ir: _ir }: { ir: (v: VistaReporte) => void }) {
    const [sinMov, setSinMov] = useState(false)
    const [critico, setCritico] = useState(true)
    const [data, setData] = useState<ApiProductsReport | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [reintento, setReintento] = useState(0)

    useEffect(() => {
        let vigente = true
        setCargando(true)
        panelGetProductsReport()
            .then(r => {
                if (!vigente) return
                // Guardia de forma: si el backend responde con otra forma (versión
                // vieja o a medio desplegar), mejor el cartel con "Reintentar" que
                // una pantalla rota a mitad de render.
                if (!r || !r.resumen || !r.masVendidos || !r.sinRotacion || !r.stockCritico || !r.porCategoria) {
                    throw new ApiError(0, 'La respuesta del servidor llegó incompleta. Reintentá en un momento.')
                }
                setData(r); setError('')
            })
            .catch(err => { if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudo cargar el reporte') })
            .finally(() => { if (vigente) setCargando(false) })
        return () => { vigente = false }
    }, [reintento])

    const cargandoInicial = cargando && !data

    const categoriaTop = data?.porCategoria[0]?.name ?? '—'
    const unidadesPorProducto = data && data.resumen.productosVendidos > 0
        ? (data.resumen.unidadesVendidas / data.resumen.productosVendidos).toFixed(1)
        : '0'

    return (
        <div style={pageWrap}>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Reporte de productos</h1>
                    {data && <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 4 }}>Últimos {data.periodoDias} días</div>}
                </div>
            </div>

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                    <span style={{ color: 'var(--color-error)', fontSize: 13, flex: 1 }}>{error}</span>
                    <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                {cargandoInicial ? (
                    <SkeletonKpis cantidad={3} />
                ) : (
                    <>
                        <StatCard label="Productos vendidos" value={data?.resumen.productosVendidos ?? 0} icon={Package} accent="#3B82F6" />
                        <StatCard label="Categoría top" value={categoriaTop} icon={Tag} accent="#8B5CF6" />
                        <StatCard label="Unidades vendidas" value={data?.resumen.unidadesVendidas ?? 0} icon={ShoppingBag} accent="#10B981" />
                    </>
                )}
            </div>

            {/* Más vendidos */}
            <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Más vendidos</div>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{unidadesPorProducto} u. promedio por producto</span>
                </div>
                {cargandoInicial ? (
                    <SkeletonFilas filas={5} />
                ) : !data?.masVendidos.length ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                        Todavía no hay ventas en este período.
                    </div>
                ) : (
                    data.masVendidos.map((p, i) => {
                        const max = data.masVendidos[0].unidades || 1
                        return (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < data.masVendidos.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{i + 1}</span>
                                <Mini url={p.primaryImageUrl} id={p.id} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{p.categoryName ?? 'Sin categoría'}</div>
                                    <div style={{ height: 4, borderRadius: 2, background: 'var(--color-surface-alt)', marginTop: 5, overflow: 'hidden' }}>
                                        <div style={{ width: `${(p.unidades / max) * 100}%`, height: '100%', background: 'var(--color-primary)' }} />
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.importe)}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{p.unidades} u.</div>
                                </div>
                            </div>
                        )
                    })
                )}
            </Card>

            {/* Stock crítico */}
            <Card padding="md" style={{ padding: 0, marginBottom: 16 }}>
                <button className="ds-hover" onClick={() => setCritico(s => !s)} style={acordeon}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={15} style={{ color: 'var(--color-warning)' }} />
                        Stock crítico ({data?.stockCritico.length ?? 0})
                    </span>
                    <ChevronDown size={16} style={{ color: 'var(--color-muted)', transform: critico ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
                </button>
                {critico && (
                    <div style={{ padding: '0 20px 16px' }}>
                        {!data?.stockCritico.length ? (
                            <div style={{ fontSize: 13, color: 'var(--color-muted)', padding: '8px 0' }}>Ningún producto por debajo de su stock mínimo.</div>
                        ) : data.stockCritico.map(s => (
                            <div key={s.variantId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                                <Mini url={s.primaryImageUrl} id={s.productId} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 13, color: 'var(--color-body)' }}>{s.productName}</span>
                                    {s.variantLabel && <span style={{ fontSize: 12, color: 'var(--color-muted)' }}> · {s.variantLabel}</span>}
                                </div>
                                <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: s.cantidad === 0 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: s.cantidad === 0 ? 'var(--color-error)' : 'var(--color-warning)', fontSize: 11, fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>
                                    {s.cantidad} / mín. {s.stockMin}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Sin rotación */}
            <Card padding="md" style={{ padding: 0, marginBottom: 16 }}>
                <button className="ds-hover" onClick={() => setSinMov(s => !s)} style={acordeon}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Sin movimiento ({data?.sinRotacion.length ?? 0})</span>
                    <ChevronDown size={16} style={{ color: 'var(--color-muted)', transform: sinMov ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
                </button>
                {sinMov && (
                    <div style={{ padding: '0 20px 16px' }}>
                        {!data?.sinRotacion.length ? (
                            <div style={{ fontSize: 13, color: 'var(--color-muted)', padding: '8px 0' }}>Todos los productos con stock tuvieron ventas.</div>
                        ) : data.sinRotacion.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', opacity: 0.85 }}>
                                <Mini url={p.primaryImageUrl} id={p.id} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: 'var(--color-body)' }}>{p.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{p.categoryName ?? 'Sin categoría'}</div>
                                </div>
                                <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 11, fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>
                                    {p.stock} en stock
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Distribución por categoría */}
            <Card>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 14 }}>Inventario por categoría</div>
                {!data?.porCategoria.length ? (
                    <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Sin datos.</div>
                ) : data.porCategoria.map((c, i) => {
                    const maxProd = data.porCategoria[0].productos || 1
                    return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < data.porCategoria.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: 'var(--color-text)' }}>{c.name}</div>
                                <div style={{ height: 4, borderRadius: 2, background: 'var(--color-surface-alt)', marginTop: 5, overflow: 'hidden' }}>
                                    <div style={{ width: `${(c.productos / maxProd) * 100}%`, height: '100%', background: '#8B5CF6' }} />
                                </div>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>{c.productos} prod.</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', flexShrink: 0, minWidth: 90, textAlign: 'right' }}>{fmtMoney(c.valor)}</span>
                        </div>
                    )
                })}
                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 10 }}>
                    El valor es a costo. Para los productos sin costo cargado se usa el precio de venta.
                </div>
            </Card>
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
// El radio acompaña las esquinas de la Card (12) para que el velo del hover no las pise.
const acordeon: React.CSSProperties = { width: '100%', padding: '14px 20px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit', borderRadius: 11 }
