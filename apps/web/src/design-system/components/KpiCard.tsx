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
    // Para KPIs donde "más" es malo (ej: comisiones, un costo) — invierte el
    // verde/rojo del badge sin tocar la flecha (▲ sigue siendo "subió").
    invertirColor?: boolean
}

// ← icon se desestructura acá, antes faltaba
export function KpiCard({ label, value, delta, prefix = '', suffix = '', accent, loading, footnote, icon: Icon, decimals = 0, deltaEnUnidades = false, invertirColor = false }: KpiCardProps) {
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
    // "Bueno" (verde) no siempre es "subió" — en un KPI de costo (ej.
    // comisiones), que suba es lo malo. La flecha sigue mostrando la
    // dirección real, solo el color cambia de sentido.
    const esBueno = invertirColor ? !isPos : isPos
    // "+600%" en vez de "+600.0%": el decimal solo aparece cuando aporta.
    // Y con un período anterior casi vacío la variación da cualquier cosa
    // ("▲ 1350550%", Ale 08/09) y rompe la tarjeta: arriba de 999% se muestra
    // ">999%" y el número exacto queda en el tooltip del badge.
    const TOPE_PCT = 999
    const fmtPct = (n: number) => n > TOPE_PCT ? `>${TOPE_PCT}%` : `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`
    const deltaExacto = deltaEnUnidades ? null : `${isPos ? '+' : '-'}${Math.abs(delta).toLocaleString('es-AR', { maximumFractionDigits: 1 })}% vs período anterior`
    // Cifras largas ($13.505.500) no entran a 30px en una tarjeta de 4 por
    // fila: el tamaño baja con el largo, y si aun así no entra se corta con
    // puntos suspensivos en vez de pisar la tarjeta de al lado.
    const tamanoValor = display.length > 14 ? 20 : display.length > 11 ? 24 : 30

    return (
        <Card padding="sm">

            {/* Encabezado: label a la izquierda, ícono a la derecha.
                Las clases ds-kpi-* existen para la variante compacta de
                celular (media query en globals.css): a 2 columnas de ~180px
                esta card entera no entra con las medidas de escritorio. */}
            <div className="ds-kpi-head" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                <div className="ds-kpi-label" style={{
                    fontSize:      12,
                    fontWeight:    600,
                    color:         'var(--color-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                }}>
                    {label}
                </div>
                <div className="ds-kpi-icon" style={{
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
            <div className="ds-kpi-value" style={{
                fontSize:      tamanoValor,
                fontWeight:    700,
                color:         'var(--color-text)',
                fontFamily:    'Geist Mono, monospace',
                letterSpacing: '-0.02em',
                lineHeight:    1,
                marginBottom:  10,
                minWidth:      0,
                overflow:      'hidden',
                textOverflow:  'ellipsis',
                whiteSpace:    'nowrap',
            }} title={display}>
                {loading ? <Skeleton height={28} /> : display}
            </div>

            {/* Delta + footnote */}
            <div className="ds-kpi-foot" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', minWidth:0 }}>
                {/* Badge verde si delta positivo, rojo si negativo */}
                <span title={deltaExacto ?? undefined} style={{
                    display:    'inline-flex',
                    alignItems: 'center',
                    gap:        4,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    height:     22,
                    padding:    '0 8px',
                    borderRadius: 6,
                    background: esNeutro ? 'var(--color-surface-alt)' : esBueno ? '#D1FAE5' : '#FEE2E2',
                    color:      esNeutro ? 'var(--color-muted)' : esBueno ? '#047857' : '#DC2626',
                    fontSize:   12,
                    fontWeight: 600,
                    fontFamily: 'Geist Mono, monospace',
                }}>
                    {esNeutro ? '-' : isPos ? '▲' : '▼'} {deltaEnUnidades ? Math.abs(Math.round(delta)) : fmtPct(Math.abs(delta))}
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