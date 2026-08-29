import { useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { SeriesRange } from '@/lib/platform/api'

// Gráficos del dashboard de super admin. Construidos siguiendo la skill
// dataviz: paleta categórica validada (ver --chart-1/--chart-2 en
// globals.css), líneas de 2px, relleno de área al ~10%, grillas hairline
// recesivas, tooltip con "el valor primero, la serie después" y line-keys en
// vez de cajitas, leyenda solo cuando hay 2+ series.

const RANGES: { value: SeriesRange; label: string }[] = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
  { value: 180, label: '180 días' },
]

export function RangePicker({ value, onChange }: { value: SeriesRange; onChange: (v: SeriesRange) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {RANGES.map((r) => {
        const activo = r.value === value
        return (
          <button
            key={r.value}
            onClick={() => onChange(r.value)}
            className="ds-hover"
            style={{
              height: 30, padding: '0 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: activo ? 'var(--color-primary-bg)' : 'transparent',
              color: activo ? 'var(--color-primary)' : 'var(--color-muted)',
              fontSize: 12.5, fontWeight: activo ? 700 : 500,
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

function fmtCount(n: number): string {
  return n.toLocaleString('es-AR')
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

// Tooltip compartido: el valor va primero y en fuerte (lo que el lector busca
// al pasar el mouse), la serie va después como aclaración — jerarquía inversa
// a la leyenda. Line-key (un trazo corto del color) en vez de una cajita.
function ChartTooltip({ active, payload, label, formatValue }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  formatValue: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px', boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 6 }}>{label && fmtShortDate(label)}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '2px 0' }}>
          <span style={{ width: 10, height: 2, background: p.color, display: 'inline-block', borderRadius: 1 }} />
          <span style={{ fontWeight: 700, color: 'var(--color-text)', fontFamily: 'monospace' }}>{formatValue(p.value)}</span>
          <span style={{ color: 'var(--color-muted)' }}>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

const axisTick = { fill: 'var(--color-muted)', fontSize: 11 }

// ─── Dos series (conteos comparables: negocios/suscripciones, pedidos/clientes) ─
export function TwoSeriesAreaChart({ data, labelA, labelB, formatValue = fmtCount }: {
  data: { date: string; a: number; b: number }[]
  labelA: string
  labelB: string
  formatValue?: (n: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={axisTick} axisLine={{ stroke: 'var(--chart-axis)' }} tickLine={false} minTickGap={24} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: 'var(--color-muted)' }} />
        <Area type="monotone" dataKey="a" name={labelA} stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="b" name={labelB} stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Una sola serie (montos: MRR, ventas) — sin leyenda, el título ya dice qué es ─
export function SingleSeriesAreaChart({ data, formatValue = fmtMoney }: {
  data: { date: string; value: number }[]
  formatValue?: (n: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={axisTick} axisLine={{ stroke: 'var(--chart-axis)' }} tickLine={false} minTickGap={24} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => formatValue(v as number)} />
        <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
        <Area type="monotone" dataKey="value" name="Monto" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export { fmtMoney, fmtCount }

// Hook chico para no repetir el patrón "estado de rango + refetch" en cada
// tab/página que muestra un gráfico con selector de días.
export function useRange(initial: SeriesRange = 30): [SeriesRange, (v: SeriesRange) => void] {
  const [range, setRange] = useState<SeriesRange>(initial)
  return [range, setRange]
}
