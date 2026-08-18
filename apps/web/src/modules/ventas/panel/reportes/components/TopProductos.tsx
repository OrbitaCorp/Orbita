// ─── TopProductos ─────────────────────────────────────────────────────────────
// Ranking de los 5 productos más vendidos en el período seleccionado.
// Barra de progreso relativa al producto #1.
// El color de cada producto se genera dinámicamente desde su hue.
//
// Cuando el backend esté listo, recibe los datos via prop — no cambia nada acá.

import { fmtMoney } from '@/lib/utils'

interface Producto { sku: string; nombre: string; unidades: number; monto: number; hue: number }

interface TopProductosProps {
    productos: Producto[]
}

export function TopProductos({ productos }: TopProductosProps) {
    const max = Math.max(...productos.map(p => p.unidades))

    return (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {productos.map((p, i) => (
                <div key={p.sku}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                        {/* Ranking — #1 en ámbar, resto neutro */}
                        <span style={{
                            width:22, height:22, borderRadius:6,
                            background: i === 0 ? 'var(--color-warning-bg)' : 'var(--color-surface-alt)',
                            color:      i === 0 ? 'var(--chip-warning-fg)' : 'var(--color-muted)',
                            fontSize:11, fontWeight:700,
                            fontFamily:'Geist Mono, monospace',
                            display:'grid', placeItems:'center', flexShrink:0,
                        }}>
                            {i + 1}
                        </span>

                        {/* Swatch de color único por producto */}
                        <div style={{
                            width:28, height:28, borderRadius:6, flexShrink:0,
                            background:`oklch(0.78 0.10 ${p.hue})`,
                        }} />

                        <div style={{ flex:1, minWidth:0 }}>
                            <div style={{
                                fontSize:13, fontWeight:500,
                                color:'var(--color-text)',
                                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                            }}>
                                {p.nombre}
                            </div>
                            <div style={{
                                fontSize:11, color:'var(--color-muted)',
                                fontFamily:'Geist Mono, monospace',
                            }}>
                                {fmtMoney(p.monto)}
                            </div>
                        </div>

                        <span style={{
                            fontSize:13, fontWeight:700,
                            color:'var(--color-primary)',
                            fontFamily:'Geist Mono, monospace',
                        }}>
                            {p.unidades}
                            <span style={{ fontSize:10, fontWeight:500, color:'var(--color-muted)', marginLeft:2 }}>u</span>
                        </span>
                    </div>

                    {/* Barra de progreso relativa al #1 */}
                    <div style={{ height:4, background:'var(--color-surface-alt)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{
                            height:'100%',
                            width:`${(p.unidades / max) * 100}%`,
                            background: i === 0 ? '#3B82F6' : `oklch(0.62 0.12 ${p.hue})`,
                            borderRadius:2,
                            transition:'width 600ms ease',
                        }} />
                    </div>
                </div>
            ))}
        </div>
    )
}