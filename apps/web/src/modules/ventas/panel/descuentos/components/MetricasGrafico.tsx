import { useState } from 'react'
import type { MetricasGrafico as MetricasGraficoType } from '../types'

const MONO = '"Geist Mono", "Fira Code", monospace'

const W = 700
const H = 200
const PAD = { top: 12, right: 24, bottom: 32, left: 52 }

function fmt(n: number) {
  return `$ ${Math.round(n).toLocaleString('es-AR')}`
}

interface Props { grafico: MetricasGraficoType }

export function MetricasGrafico({ grafico }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  const valores = grafico.revenueSacrificado
  const maxVal = Math.max(...valores, 1)
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  function cx(i: number) {
    return PAD.left + (i / Math.max(valores.length - 1, 1)) * chartW
  }

  function cy(v: number) {
    return PAD.top + chartH - (v / maxVal) * chartH
  }

  const points = valores.map((v, i) => `${cx(i)},${cy(v)}`).join(' ')
  const areaPoints = `${cx(0)},${PAD.top + chartH} ${points} ${cx(valores.length - 1)},${PAD.top + chartH}`

  const ySteps = 4
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => ({
    value: (maxVal / ySteps) * (ySteps - i),
    y: PAD.top + (chartH / ySteps) * i,
  }))

  // Mostrar solo algunas fechas en el eje X para no saturar
  const xStep = Math.ceil(grafico.fechas.length / 6)
  const xLabels = grafico.fechas
    .map((f, i) => ({ i, label: f.slice(5).replace('-', '/') }))
    .filter((_, i) => i % xStep === 0 || i === grafico.fechas.length - 1)

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '20px 24px',
      }}
    >
      <p
        style={{
          margin: '0 0 16px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text)',
        }}
      >
        Revenue sacrificado en el tiempo
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y grid lines */}
        {yLabels.map(({ value, y }) => (
          <g key={y}>
            <line
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke="var(--color-border)"
              strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 6}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-muted)"
              fontFamily={MONO}
            >
              {value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${Math.round(value)}`}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={cx(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-muted)"
            fontFamily={MONO}
          >
            {label}
          </text>
        ))}

        {/* Area fill */}
        <polygon points={areaPoints} fill="url(#grad)" />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hit zones + dots */}
        {valores.map((v, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect
              x={cx(i) - chartW / valores.length / 2}
              y={PAD.top}
              width={chartW / valores.length}
              height={chartH}
              fill="transparent"
            />
            {hover === i && (
              <>
                <line
                  x1={cx(i)} y1={PAD.top} x2={cx(i)} y2={PAD.top + chartH}
                  stroke="var(--color-primary)" strokeWidth={1} strokeDasharray="3 3"
                />
                <circle cx={cx(i)} cy={cy(v)} r={5} fill="var(--color-primary)" />
                <rect
                  x={Math.min(cx(i) - 2, W - PAD.right - 82)}
                  y={cy(v) - 30}
                  width={84}
                  height={22}
                  rx={5}
                  fill="var(--color-text)"
                />
                <text
                  x={Math.min(cx(i) - 2, W - PAD.right - 82) + 42}
                  y={cy(v) - 14}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--color-bg)"
                  fontFamily={MONO}
                >
                  {fmt(v)}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
