import { useState } from 'react';

// ─── Line Chart ───────────────────────────────────────────────────────────────

interface LineChartProps {
    data:          number[]
    labels:        string[]
    color?:        string
    height?:       number
    max?:          number
    // NUEVO: función opcional para formatear el valor en el tooltip.
    // Si no se pasa, muestra el número crudo.
    // Ejemplo de uso: formatValue={v => '$' + v.toLocaleString('es-AR')}
    formatValue?:  (v: number) => string
}

export function LineChart({ data, labels, color = 'var(--color-primary)', height = 140, max, formatValue }: LineChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const w       = 600;
  const pad     = { l: 36, r: 12, t: 10, b: 24 };
  const innerW  = w - pad.l - pad.r;
  const innerH  = height - pad.t - pad.b;
  const maxVal  = max ?? Math.max(...data);

  // Serie vacía: no hay curva que dibujar. Antes esto explotaba (pts[-1].x
  // sobre un array vacío) y tiraba abajo el dashboard entero de un negocio
  // sin ventas en el período.
  if (data.length === 0) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--color-muted)' }}>
        Sin datos para este período
      </div>
    );
  }

  // Un solo punto (i/(length-1) = 0/0) y todo-cero (v/0) también daban NaN.
  const divisor = maxVal > 0 ? maxVal : 1;

  const pts = data.map((v, i) => ({
    x: pad.l + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: pad.t + innerH - (v / divisor) * innerH,
    v, i,

  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x},${pad.t + innerH} L ${pts[0].x},${pad.t + innerH} Z`;
  const hp       = hovered !== null ? pts[hovered] : null;
  

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }}
        onMouseLeave={() => setHovered(null)}>
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <g key={i}>
            <line x1={pad.l} y1={pad.t + innerH * p} x2={w - pad.r} y2={pad.t + innerH * p}
              stroke="var(--color-border)" strokeWidth="1" />
            <text x={pad.l - 4} y={pad.t + innerH * p + 3} fontSize="9"
              fontFamily='"Geist Mono", monospace' fill="var(--color-muted)" textAnchor="end">
              {Math.round(maxVal - maxVal * p)}
            </text>
          </g>
        ))}

        {pts.map((p) => (
          <text key={p.i} x={p.x} y={height - 6} fontSize="9"
            fontFamily='"Geist", sans-serif' fill="var(--color-muted)" textAnchor="middle">
            {labels[p.i]}
          </text>
        ))}

        <path d={areaPath} fill="url(#lc-fill)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((p) => (
          <circle key={p.i} cx={p.x} cy={p.y}
            r={hovered === p.i ? 4 : 2.5}
            fill={color} stroke="var(--color-surface)" strokeWidth="1.5"
            onMouseEnter={() => setHovered(p.i)}
            style={{ cursor: 'pointer' }} />
        ))}

        {hp && (
          <line x1={hp.x} y1={pad.t} x2={hp.x} y2={pad.t + innerH}
            stroke={color} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
        )}
      </svg>

      {hp && (
        <div style={{
          position:      'absolute',
          left:          `${Math.min(Math.max(8, (hp.x / w) * 100), 70)}%`,
          top:           4,
          // Panel invertido: texto del tema como fondo y fondo del tema como
          // texto. Con '#fff' fijo, en tema oscuro quedaba blanco sobre casi
          // blanco — el total no se leía.
          background:    'var(--color-text)',
          color:         'var(--color-bg)',
          padding:       '4px 8px',
          borderRadius:  6,
          fontSize:      11,
          pointerEvents: 'none',
          fontFamily:    '"Geist Mono", monospace',
          
        }}>
          {labels[hp.i]} · {formatValue ? formatValue(hp.v) : hp.v}
        </div>
      )}
    </div>
  );
}

// ─── Bar Chart (horizontal) ───────────────────────────────────────────────────

interface BarItem { label: string; value: number; }

interface BarChartProps {
  data:   BarItem[];
  color?: string;
}

export function BarChart({ data, color = 'var(--color-primary)' }: BarChartProps) {
  const max = Math.max(...data.map(d => d.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((item, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--color-body)' }}>{item.label}</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>
              {item.value}
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--color-surface-alt)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height:     '100%',
              width:      `${(item.value / max) * 100}%`,
              background: color,
              borderRadius: 4,
              transition: 'width 600ms ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

interface DonutSegment { label: string; value: number; color: string; }

interface DonutChartProps {
  data:   DonutSegment[];
  size?:  number;
  label?: string;
}

export function DonutChart({ data, size = 120, label }: DonutChartProps) {
  const total  = data.reduce((s, d) => s + d.value, 0);
  const r      = 38;
  const c      = 2 * Math.PI * r;
  let   offset = 0;

  const largest = data.reduce((a, b) => a.value > b.value ? a : b, data[0]);
  const pct     = Math.round((largest.value / total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {data.map((seg, i) => {
            const dash = (seg.value / total) * c;
            const el = (
              <circle key={i} cx="50" cy="50" r={r} fill="none"
                stroke={seg.color} strokeWidth="14"
                strokeDasharray={`${dash} ${c}`}
                strokeDashoffset={-offset} />
            );
            offset += dash;
            return el;
          })}
        </svg>

        <div style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', lineHeight: 1 }}>
            {pct}%
          </div>
          {label && (
            <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>{label}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', fontSize: 11 }}>
        {data.map((seg, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-body)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            {seg.label} · <span style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 600 }}>
              {Math.round((seg.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
