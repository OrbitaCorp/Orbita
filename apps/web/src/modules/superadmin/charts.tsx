import { useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { SeriesRange } from '@/lib/platform/api'

// Gráficos del panel de plataforma.
//
// Reglas que se siguen acá (y por qué el diseño anterior las rompía):
//  · Dos series comparables van en LÍNEAS, no en dos áreas rellenas superpuestas:
//    el área de adelante tapaba a la de atrás y no se podía leer el cruce.
//  · Una sola serie de dinero sí va en área (magnitud en el tiempo, sin nada
//    que ocluir).
//  · El selector de rango NO vive adentro de la tarjeta del gráfico: va una
//    sola vez arriba y alcanza a todo lo que muestra la pantalla. Antes había
//    un selector por gráfico y cada uno podía quedar en un rango distinto.
//  · Al cambiar el rango NO se desmonta el gráfico para poner un spinner: se
//    mantiene el dibujo anterior atenuado, así el layout no salta.
//  · Grilla y ejes son hairlines sólidas y recesivas; nada de líneas punteadas.
//  · Paleta: --chart-1 / --chart-2 de globals.css, validadas con el script de
//    la guía de dataviz en tema claro y oscuro (CVD ΔE 28.2 y 26.8, muy por
//    encima del piso de 8).

const RANGES: { value: SeriesRange; label: string }[] = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '3 meses' },
  { value: 180, label: '6 meses' },
]

export function RangePicker({ value, onChange }: { value: SeriesRange; onChange: (v: SeriesRange) => void }) {
  return (
    <div
      role="group"
      aria-label="Período"
      style={{
        display: 'inline-flex',
        padding: 3,
        gap: 2,
        borderRadius: 10,
        background: 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
      }}
    >
      {RANGES.map((r) => {
        const activo = r.value === value
        return (
          <button
            key={r.value}
            onClick={() => onChange(r.value)}
            aria-pressed={activo}
            className={activo ? undefined : 'ds-hover'}
            style={{
              height: 30, padding: '0 13px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'inherit', border: 'none',
              background: activo ? 'var(--color-bg)' : 'transparent',
              color: activo ? 'var(--color-text)' : 'var(--color-muted)',
              fontSize: 13, fontWeight: activo ? 600 : 500,
              boxShadow: activo ? 'var(--shadow-card)' : 'none',
            }}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}
function fmtLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}
function fmtCount(n: number): string {
  return n.toLocaleString('es-AR')
}
function fmtMoney(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
// Los montos del eje Y se acortan: "$1,2M" en vez de "$1.200.000", que obliga
// a ensanchar el eje y se come el ancho del dibujo.
function fmtMoneyCorto(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}

// Tooltip: el valor primero y fuerte (es lo que se busca al pasar el mouse),
// la serie después como aclaración. El trazo de color a la izquierda lleva la
// identidad, así el texto puede quedarse en tinta normal y seguir legible.
function ChartTooltip({ active, payload, label, formatValue }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  formatValue: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      padding: '10px 12px',
      boxShadow: 'var(--shadow-card-hover)',
      minWidth: 150,
    }}>
      <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 7 }}>
        {label && fmtLongDate(label)}
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' }}>
          <span style={{ width: 12, height: 2, background: p.color, display: 'inline-block', borderRadius: 1, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
            {formatValue(p.value)}
          </span>
          <span style={{ color: 'var(--color-muted)' }}>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

const ejeTick = { fill: 'var(--color-muted)', fontSize: 11.5 }
const CURSOR = { stroke: 'var(--color-border-strong)', strokeWidth: 1 }

// Envoltorio común: fija la altura contando la banda del eje X (si no, el
// gráfico entra pero las etiquetas de abajo quedan cortadas) y atenúa el
// dibujo mientras se recarga, en vez de reemplazarlo por un spinner.
function Lienzo({ alto = 260, cargando, children }: { alto?: number; cargando?: boolean; children: React.ReactElement }) {
  return (
    <div style={{
      width: '100%',
      height: alto,
      opacity: cargando ? 0.45 : 1,
      transition: 'opacity 200ms ease',
    }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

// ─── Serie(s) en el tiempo, en líneas ─────────────────────────────────────────
// Para conteos comparables (negocios/suscripciones, pedidos/clientes). Con 2
// series siempre hay leyenda: la identidad nunca queda solo en el color.
export function LineSeriesChart({ data, series, formatValue = fmtCount, cargando, alto }: {
  data: Record<string, string | number>[]
  series: { key: string; label: string }[]
  formatValue?: (n: number) => string
  cargando?: boolean
  alto?: number
}) {
  const colores = ['var(--chart-1)', 'var(--chart-2)']
  return (
    <Lienzo alto={alto} cargando={cargando}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="date" tickFormatter={fmtShortDate} tick={ejeTick}
          axisLine={{ stroke: 'var(--chart-axis)' }} tickLine={false} minTickGap={28} dy={4}
        />
        <YAxis tick={ejeTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={CURSOR} />
        {series.length > 1 && (
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12.5, color: 'var(--color-muted)', paddingTop: 8 }}
          />
        )}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={colores[i % colores.length]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            // r=4 → 8px de diámetro, el mínimo de marca que pide la guía.
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-bg)' }}
          />
        ))}
      </LineChart>
    </Lienzo>
  )
}

// ─── Una sola serie de dinero, en área ───────────────────────────────────────
// Sin leyenda a propósito: el título de la tarjeta ya dice qué es.
export function AreaSeriesChart({ data, label = 'Monto', formatValue = fmtMoney, cargando, alto }: {
  data: { date: string; value: number }[]
  label?: string
  formatValue?: (n: number) => string
  cargando?: boolean
  alto?: number
}) {
  return (
    <Lienzo alto={alto} cargando={cargando}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sa-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="date" tickFormatter={fmtShortDate} tick={ejeTick}
          axisLine={{ stroke: 'var(--chart-axis)' }} tickLine={false} minTickGap={28} dy={4}
        />
        <YAxis tick={ejeTick} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => fmtMoneyCorto(v as number)} />
        <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={CURSOR} />
        <Area
          type="monotone" dataKey="value" name={label}
          stroke="var(--chart-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          fill="url(#sa-area-fill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-bg)' }}
        />
      </AreaChart>
    </Lienzo>
  )
}

// ─── Reparto por categoría, en barras horizontales ───────────────────────────
// Magnitud por categoría: barra horizontal, que deja leer etiquetas largas sin
// rotarlas. Un color por serie (no un degradé según el valor: el largo de la
// barra ya codifica la magnitud). `tono` permite pasar un color de estado
// cuando la categoría ES un estado (al día / vencido / suspendida).
export function BarDistribution({ items, formatValue = fmtCount, maxItems }: {
  items: { label: string; value: number; tono?: string }[]
  formatValue?: (n: number) => string
  maxItems?: number
}) {
  const visibles = maxItems ? items.slice(0, maxItems) : items
  const max = Math.max(...visibles.map((i) => i.value), 1)
  const total = items.reduce((a, i) => a + i.value, 0)

  if (visibles.length === 0) {
    return <div style={{ padding: '22px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>Sin datos.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {visibles.map((it) => {
        const pct = total > 0 ? Math.round((it.value / total) * 100) : 0
        return (
          <div key={it.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 13.5, color: 'var(--color-body)' }}>{it.label}</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatValue(it.value)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-subtle)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round((it.value / max) * 100)}%`,
                height: '100%',
                borderRadius: 999,
                background: it.tono ?? 'var(--chart-1)',
                transition: 'width 300ms ease',
              }} />
            </div>
          </div>
        )
      })}
      {maxItems && items.length > maxItems && (
        <div style={{ fontSize: 12, color: 'var(--color-subtle)', paddingTop: 2 }}>
          y {items.length - maxItems} más
        </div>
      )}
    </div>
  )
}

// Esqueleto con la MISMA altura que el gráfico, para la primera carga: así la
// tarjeta no cambia de alto cuando llegan los datos.
export function ChartSkeleton({ alto = 260 }: { alto?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%', height: alto, borderRadius: 10,
        background: 'linear-gradient(90deg, var(--color-surface-alt) 25%, var(--color-surface) 50%, var(--color-surface-alt) 75%)',
        backgroundSize: '200% 100%',
        animation: 'sa-shimmer 1.4s ease-in-out infinite',
      }}
    >
      <style>{`@keyframes sa-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  )
}

export { fmtMoney, fmtCount, fmtMoneyCorto }

// Hook chico para no repetir el patrón "estado de rango + refetch" en cada
// pantalla que muestra un gráfico con selector de días.
export function useRange(initial: SeriesRange = 30): [SeriesRange, (v: SeriesRange) => void] {
  const [range, setRange] = useState<SeriesRange>(initial)
  return [range, setRange]
}
