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

// ─── Column Chart (vertical) ─────────────────────────────────────────────────
// Columnas verticales para series cortas y regulares: horas del día, días de la
// semana, o ventas por día. Con `inner` dibuja, DENTRO de cada columna, la parte
// que se quiere destacar (ej: la ganancia dentro de las ventas).
//
// Hecho con divs y no con SVG: las columnas y sus etiquetas escalan con el ancho
// sin deformar el texto (el LineChart usa preserveAspectRatio="none").
// Accesibilidad: el gráfico es una imagen con un resumen en aria-label; el dato
// exacto de cada columna sale en el cuadro que aparece al pasar el mouse.

interface ColumnChartProps {
  values:       number[];
  labels:       string[];
  inner?:       number[];
  color?:       string;
  innerColor?:  string;
  height?:      number;
  formatValue?: (v: number) => string;
  /** Nombre de cada serie en el cuadro del hover (ej: "Ventas", "Ganancia"). */
  valueName?:   string;
  innerName?:   string;
  /** Cuántas etiquetas del eje como máximo (se salta de a N si hay más columnas). */
  maxLabels?:   number;
}

export function ColumnChart({
  values, labels, inner, color = 'var(--color-primary)', innerColor, height = 160,
  formatValue = (v) => String(v), valueName, innerName, maxLabels = 12,
}: ColumnChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (values.length === 0 || values.every(v => v === 0)) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--color-muted)' }}>
        Sin datos para este período
      </div>
    );
  }

  const max     = Math.max(...values, 1);
  const paso    = Math.max(1, Math.ceil(values.length / maxLabels));
  const tieneIn = !!inner && inner.some(v => v > 0);
  // Con una serie interna la columna principal queda tenue y la interna sólida;
  // con una sola serie la columna es sólida.
  const colorMain = tieneIn ? `color-mix(in srgb, ${color} 24%, transparent)` : color;
  const colorIn   = innerColor ?? color;
  const resumen   = `Gráfico de columnas. ${values.map((v, i) => `${labels[i]}: ${formatValue(v)}`).join(', ')}.`;

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        .ds-col-bar { transition: height 380ms ease; }
        @media (prefers-reduced-motion: reduce) { .ds-col-bar { transition: none; } }
      `}</style>
      <div style={{ fontSize: 10, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', marginBottom: 4 }}>
        máx. {formatValue(max)}
      </div>
      <div role="img" aria-label={resumen} onMouseLeave={() => setHovered(null)}
        style={{ display: 'flex', alignItems: 'flex-end', gap: values.length > 20 ? 2 : 4, height, borderBottom: '1px solid var(--color-border)' }}>
        {values.map((v, i) => {
          const hp  = (v / max) * 100;
          const ip  = tieneIn ? ((inner![i] ?? 0) / max) * 100 : 0;
          const act = hovered === i;
          return (
            <div key={i} onMouseEnter={() => setHovered(i)}
              style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'default' }}>
              <div className="ds-col-bar" style={{
                position: 'relative', width: '100%', height: `max(${hp}%, 2px)`,
                background: v === 0 ? 'var(--color-border)' : colorMain,
                borderRadius: '3px 3px 0 0', opacity: hovered === null || act ? 1 : 0.55,
              }}>
                {tieneIn && ip > 0 && (
                  <div className="ds-col-bar" style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.min(100, (ip / Math.max(hp, 0.0001)) * 100)}%`,
                    background: colorIn, borderRadius: '3px 3px 0 0',
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: values.length > 20 ? 2 : 4, marginTop: 6 }} aria-hidden="true">
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 10, color: 'var(--color-muted)', fontFamily: '"Geist", sans-serif', whiteSpace: 'nowrap', overflow: 'visible' }}>
            {i % paso === 0 ? l : ''}
          </div>
        ))}
      </div>

      {hovered !== null && (
        <div style={{
          position: 'absolute', top: 18, left: `${Math.min(Math.max(14, ((hovered + 0.5) / values.length) * 100), 86)}%`,
          transform: 'translateX(-50%)', background: 'var(--color-text)', color: 'var(--color-bg)',
          padding: '5px 9px', borderRadius: 6, fontSize: 11, pointerEvents: 'none', whiteSpace: 'nowrap',
          fontFamily: '"Geist Mono", monospace', lineHeight: 1.5, zIndex: 5,
        }}>
          <div style={{ opacity: 0.75 }}>{labels[hovered]}</div>
          <div>{valueName ? `${valueName}: ` : ''}{formatValue(values[hovered])}</div>
          {tieneIn && <div>{innerName ? `${innerName}: ` : ''}{formatValue(inner![hovered] ?? 0)}</div>}
        </div>
      )}
    </div>
  );
}
