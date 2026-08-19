// ─── KpiCard ──────────────────────────────────────────────────────────────────
// Card para mostrar una métrica clave (KPI) del negocio.
// Muestra: label, valor grande animado, delta positivo/negativo vs período
// anterior, y un footnote opcional para contexto extra.
//
// El contador animado usa requestAnimationFrame con curva easeOutCubic.
// Se usa en: Dashboard, ReporteVentas, ReporteProductos, POS (Alan).

import { useState, useEffect, type ComponentType } from 'react'  // ← ComponentType viene de react, no de lucide
import { Skeleton } from './Skeleton'
import { Card }     from './Card'

interface KpiCardProps {
    label:      string
    value:      number
    delta:      number
    prefix?:    string
    // Se pega DESPUÉS del número ("50%"): para tasas y porcentajes, que antes
    // se mostraban pelados ("50,0") y no se entendía qué eran.
    suffix?:    string
    accent:     string
    loading:    boolean
    footnote?:  React.ReactNode
    icon?:      ComponentType<{ size?: number; strokeWidth?: number }>  // ← tipo correcto
    decimals?:  number  // decimales a mostrar (0 por defecto; ej: tasas en %)
    // El delta por defecto es un porcentaje ("▲ 12.5%"). Cuando la variación
    // es en unidades (ej: "+1 cliente"), se pasa deltaEnUnidades y se muestra
    // el número entero sin el símbolo %.
    deltaEnUnidades?: boolean
}

// ← icon se desestructura acá, antes faltaba
export function KpiCard({ label, value, delta, prefix = '', suffix = '', accent, loading, footnote, icon: Icon, decimals = 0, deltaEnUnidades = false }: KpiCardProps) {
    const [animVal, setAnimVal] = useState(0)

    useEffect(() => {
        if (loading) { setAnimVal(0); return }

        let raf: number
        const start    = performance.now()
        const duration = 700

        const tick = (now: number) => {
            const p     = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - p, 3)
            setAnimVal(value * eased)
            if (p < 1) raf = requestAnimationFrame(tick)
            else setAnimVal(value)
        }

        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [value, loading])

    const display = prefix + animVal.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
    const isPos   = delta >= 0
    // Variación 0 = sin cambio: badge neutro (gris, sin flecha) — antes se
    // mostraba "▲ 0.0%" en verde, como si hubiera crecido.
    const esNeutro = delta === 0
    // "+600%" en vez de "+600.0%": el decimal solo aparece cuando aporta.
    const fmtPct = (n: number) => `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`

    return (
        <Card padding="sm">

            {/* Encabezado: label a la izquierda, ícono a la derecha */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{
                    fontSize:      12,
                    fontWeight:    600,
                    color:         'var(--color-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                }}>
                    {label}
                </div>
                <div style={{
                    width:        32,
                    height:       32,
                    borderRadius: 8,
                    background:   `${accent}1A`,
                    color:        accent,
                    display:      'grid',
                    placeItems:   'center',
                }}>
                    {/* Si se pasa ícono lo usa, sino muestra el círculo de fallback */}
                    {Icon
                        ? <Icon size={16} strokeWidth={1.5} />
                        : <span style={{ fontSize:16 }}>●</span>
                    }
                </div>
            </div>

            {/* Valor principal */}
            <div style={{
                fontSize:      30,
                fontWeight:    700,
                color:         'var(--color-text)',
                fontFamily:    'Geist Mono, monospace',
                letterSpacing: '-0.02em',
                lineHeight:    1,
                marginBottom:  10,
            }}>
                {loading ? <Skeleton height={28} /> : display}
            </div>

            {/* Delta + footnote */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                {/* Badge verde si delta positivo, rojo si negativo */}
                <span style={{
                    display:    'inline-flex',
                    alignItems: 'center',
                    gap:        4,
                    height:     22,
                    padding:    '0 8px',
                    borderRadius: 6,
                    background: esNeutro ? 'var(--color-surface-alt)' : isPos ? '#D1FAE5' : '#FEE2E2',
                    color:      esNeutro ? 'var(--color-muted)' : isPos ? '#047857' : '#DC2626',
                    fontSize:   12,
                    fontWeight: 600,
                    fontFamily: 'Geist Mono, monospace',
                }}>
                    {esNeutro ? '—' : isPos ? '▲' : '▼'} {deltaEnUnidades ? Math.abs(Math.round(delta)) : fmtPct(Math.abs(delta))}
                </span>

                {footnote ?? (
                    <span style={{ fontSize:11, color:'var(--color-muted)' }}>
                        vs período anterior
                    </span>
                )}
            </div>
        </Card>
    )
}