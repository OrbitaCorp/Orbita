// src/modules/ventas/panel/reportes/ReporteInventario.tsx — Vista 14
// Inventario valorizado: KPIs, distribución por categoría y tabla de stock.

import { useState } from 'react'
import { Download, Archive, Package, AlertTriangle, AlertCircle } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { DonutChart } from '@/design-system/components/Chart'
import { fmtMoney } from '@/lib/utils'
import { StatCard } from '../_shared/StatCard'
import { ReporteTabs, type VistaReporte } from './components/ReporteTabs'
import { ProductoThumb } from '../pedidos/components/ProductoThumb'
import { PRODUCTOS_STOCK } from '../inventario/mock/inventario.mock'

const COLS = '1.5fr 110px 90px 90px 120px 100px'

function estadoStock(stock: number, min: number): { label: string; bg: string; fg: string } {
    if (stock === 0)   return { label: 'Sin stock', bg: 'var(--color-error-bg)',   fg: 'var(--color-error)' }
    if (stock < min)   return { label: 'Crítico',   bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)' }
    return { label: 'OK', bg: 'var(--color-success-bg)', fg: 'var(--color-success)' }
}

export default function ReporteInventario({ ir }: { ir: (v: VistaReporte) => void }) {
    const [dist, setDist] = useState(false)

    return (
        <div style={pageWrap}>
            <ReporteTabs activo="inventario" ir={ir} />

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Inventario valorizado</h1>
                <Button variant="outline" icon={<Download size={15} />}>Exportar</Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                <StatCard label="Valor total" value={fmtMoney(4280000)} icon={Archive} accent="#3B82F6" />
                <StatCard label="Activos" value="54" icon={Package} accent="#10B981" />
                <StatCard label="Stock crítico" value="3" icon={AlertTriangle} accent="#F59E0B" />
                <StatCard label="Sin stock" value="1" icon={AlertCircle} accent="#EF4444" />
            </div>

            <Card padding="md" style={{ padding: 0, marginBottom: 16 }}>
                <button className="ds-hover" onClick={() => setDist(d => !d)} style={{ width: '100%', padding: '14px 20px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit', borderRadius: 11 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Distribución por categoría</span>
                    <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 500 }}>{dist ? 'Ocultar ↑' : 'Ver distribución ↓'}</span>
                </button>
                {dist && (
                    <div style={{ padding: '0 20px 20px' }}>
                        <DonutChart
                            size={140}
                            data={[
                                { label: 'Camperas', value: 32, color: '#3B82F6' },
                                { label: 'Remeras', value: 28, color: '#10B981' },
                                { label: 'Pantalones', value: 22, color: '#8B5CF6' },
                                { label: 'Buzos', value: 12, color: '#F59E0B' },
                                { label: 'Accesorios', value: 6, color: '#EC4899' },
                            ]}
                        />
                    </div>
                )}
            </Card>

            {/* Tabla de stock valorizado */}
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span>Producto</span><span>Categoría</span><span style={{ textAlign: 'right' }}>Stock</span><span style={{ textAlign: 'right' }}>Mín.</span><span style={{ textAlign: 'right' }}>Valor</span><span>Estado</span>
                </div>
                {PRODUCTOS_STOCK.map((p, i) => {
                    const est = estadoStock(p.stock, p.stockMin)
                    const crit = p.stock < p.stockMin
                    return (
                        <div key={p.id} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 56, borderBottom: i < PRODUCTOS_STOCK.length - 1 ? '1px solid var(--color-border)' : 'none', background: crit ? 'var(--color-warning-bg)' : 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <ProductoThumb hue={p.hue} size={36} />
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</span>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{p.cat}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{p.stock}</span>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{p.stockMin}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{fmtMoney(p.stock * p.precio)}</span>
                            <span><span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: est.bg, color: est.fg, fontSize: 11, fontWeight: 600 }}>{est.label}</span></span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
