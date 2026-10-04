// El día en órbita: la pieza insignia de Turnos.
//
// La jornada (de la apertura al cierre) se despliega sobre un arco de 270°.
// Cada profesional o espacio es un anillo; cada turno, un tramo de ese anillo.
// Por afuera corre la órbita del tiempo, con el satélite parado en "ahora".
// Es el logo de Órbita convertido en agenda: de un vistazo se ve cuánto del
// día está tomado, con quién, y qué queda libre.
import { useState } from 'react'
import { ESTADO_TURNO, horaTxt, type Recurso, type Turno } from '@/modules/turnos/datos'
import { arco, largoArco, punto } from './geometria'

const C = 200            // centro del viewBox (400 x 400)
const INICIO = 135       // ángulo de la apertura
const BARRIDO = 270      // grados que ocupa la jornada
const R_TIEMPO = 172     // órbita del tiempo (la del satélite)
const R_HORAS = 190      // rótulos de las horas
const GROSOR = 13

interface Props {
  recursos: Recurso[]
  turnos: Turno[]
  /** Minutos desde las 00:00. */
  ahora: number
  apertura?: number
  cierre?: number
  nombreCliente: (id: string) => string
  onAbrir?: (t: Turno) => void
  /** Texto del centro cuando no hay ningún turno señalado. */
  pie?: string
  size?: number
}

export function OrbitaDia({ recursos, turnos, ahora, apertura = 8 * 60, cierre = 21 * 60, nombreCliente, onAbrir, pie, size = 380 }: Props) {
  const [senalado, setSenalado] = useState<string | null>(null)
  // Sin onAbrir (landing, índice) el toque fija el turno en el centro: en el celular no hay hover.
  const [fijo, setFijo] = useState<string | null>(null)
  const foco = senalado ?? fijo
  const tocar = (t: Turno) => (onAbrir ? onAbrir(t) : setFijo(f => (f === t.id ? null : t.id)))
  const ang = (min: number) => INICIO + ((Math.min(cierre, Math.max(apertura, min)) - apertura) / (cierre - apertura)) * BARRIDO
  const anillos = recursos.slice(0, 4).map((r, i) => ({ r, radio: 150 - i * 23 }))
  const enFoco = turnos.find(t => t.id === foco)
  const horas = Array.from({ length: Math.floor((cierre - apertura) / 120) + 1 }, (_, i) => apertura + i * 120)
  const [sx, sy] = punto(C, C, R_TIEMPO, ang(ahora))
  const activos = turnos.filter(t => t.estado !== 'cancelado')

  return (
    <svg
      viewBox="0 0 400 400" width={size} height={size} role="group" className="tuo-od" data-con-foco={foco !== null}
      aria-label={`El día en órbita: ${activos.length} turnos entre las ${horaTxt(apertura)} y las ${horaTxt(cierre)}`}
      style={{ display: 'block', maxWidth: '100%', height: 'auto', overflow: 'visible' }}
    >
      <style>{`
        .tuo-od-tramo { cursor: pointer; transition: stroke-width 180ms ease, opacity 180ms ease, filter 180ms ease; outline: none; }
        .tuo-od-tramo:hover, .tuo-od-tramo:focus-visible, .tuo-od-tramo[data-foco="true"] { stroke-width: ${GROSOR + 6}px; opacity: 1 !important; filter: drop-shadow(0 0 7px currentColor); }
        .tuo-od[data-con-foco="true"] .tuo-od-tramo:not([data-foco="true"]) { opacity: 0.3 !important; }
        .tuo-od-traza { stroke-dasharray: var(--largo); animation: tuoTraza 1100ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(var(--i, 0) * 45ms + 200ms); }
        @media (prefers-reduced-motion: reduce) { .tuo-od-traza { animation: none; } .tuo-od-tramo { transition: none; } }
      `}</style>
      <defs>
        <linearGradient id="tuoOdTiempo" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#93C5FD" />
        </linearGradient>
        <radialGradient id="tuoOdNucleo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.30" />
          <stop offset="60%" stopColor="#3B82F6" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Resplandor del planeta, detrás de la hora */}
      <circle cx={C} cy={C} r={84} fill="url(#tuoOdNucleo)" />

      {/* Órbita del tiempo: pista punteada + lo que ya pasó del día */}
      <path d={arco(C, C, R_TIEMPO, INICIO, INICIO + BARRIDO)} fill="none" stroke="var(--color-border-strong)" strokeWidth={1} strokeDasharray="1.5 6" strokeLinecap="round" />
      {ahora > apertura && (
        <path d={arco(C, C, R_TIEMPO, INICIO, ang(ahora))} fill="none" stroke="url(#tuoOdTiempo)" strokeWidth={2} strokeLinecap="round" />
      )}

      {/* Horas */}
      {horas.map(h => {
        const [x, y] = punto(C, C, R_HORAS, ang(h))
        const [a1, b1] = punto(C, C, R_TIEMPO - 4, ang(h))
        const [a2, b2] = punto(C, C, R_TIEMPO + 4, ang(h))
        return (
          <g key={h}>
            <line x1={a1} y1={b1} x2={a2} y2={b2} stroke="var(--color-border-strong)" strokeWidth={1} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontFamily='"Geist Mono", monospace' fill="var(--color-muted)">{String(Math.floor(h / 60)).padStart(2, '0')}</text>
          </g>
        )
      })}

      {/* Un anillo por profesional o espacio */}
      {anillos.map(({ r, radio }, i) => (
        <g key={r.id}>
          <path d={arco(C, C, radio, INICIO, INICIO + BARRIDO)} fill="none" stroke="var(--color-border)" strokeWidth={GROSOR} strokeLinecap="round" opacity={0.75} />
          {turnos.filter(t => t.recursoId === r.id && t.estado !== 'cancelado').map((t, k) => {
            // El extremo redondeado suma medio grosor por lado: se descuenta para
            // que el tramo ocupe exactamente su horario.
            const tapa = ((GROSOR / 2 / radio) * 180) / Math.PI
            const a1 = ang(t.inicio) + tapa
            const a2 = Math.max(a1 + 0.5, ang(t.inicio + t.duracion) - tapa - 0.6)
            const pasado = t.estado === 'completado' || t.estado === 'ausente'
            const cliente = nombreCliente(t.clienteId)
            return (
              <path
                key={t.id} d={arco(C, C, radio, a1, a2)} fill="none"
                className={t.estado === 'pendiente' ? 'tuo-od-tramo' : 'tuo-od-tramo tuo-od-traza'} data-foco={foco === t.id}
                stroke={t.estado === 'ausente' ? 'var(--color-error)' : r.color} color={r.color}
                strokeWidth={GROSOR} strokeLinecap="round"
                opacity={pasado ? 0.38 : 1}
                strokeDasharray={t.estado === 'pendiente' ? '3 5' : undefined}
                style={{ ['--largo' as string]: largoArco(radio, a2 - a1) + GROSOR, ['--i' as string]: i * 4 + k }}
                tabIndex={0} role="button" aria-pressed={onAbrir ? undefined : fijo === t.id}
                aria-label={`${horaTxt(t.inicio)}, ${cliente}, ${t.servicio}, ${r.nombre}, ${ESTADO_TURNO[t.estado].label}`}
                onMouseEnter={() => setSenalado(t.id)} onMouseLeave={() => setSenalado(null)}
                onFocus={() => setSenalado(t.id)} onBlur={() => setSenalado(null)}
                onClick={() => tocar(t)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tocar(t) } }}
              />
            )
          })}
        </g>
      ))}

      {/* Satélite: ahora */}
      {ahora >= apertura && ahora <= cierre && (
        <g aria-hidden>
          <line x1={punto(C, C, 150 - (anillos.length - 1) * 23 - 12, ang(ahora))[0]} y1={punto(C, C, 150 - (anillos.length - 1) * 23 - 12, ang(ahora))[1]} x2={sx} y2={sy} stroke="#93C5FD" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
          <circle cx={sx} cy={sy} r={11} fill="#60A5FA" opacity={0.22} className="tuo-late" />
          <circle cx={sx} cy={sy} r={5} fill="#BFDBFE" stroke="#3B82F6" strokeWidth={2} />
        </g>
      )}

      {/* Centro: la hora, o el turno que se está señalando */}
      {enFoco ? (
        <g aria-hidden>
          <text x={C} y={C - 22} textAnchor="middle" fontSize={11} fontFamily='"Geist Mono", monospace' letterSpacing="0.08em" fill="var(--color-muted)">
            {horaTxt(enFoco.inicio)} – {horaTxt(enFoco.inicio + enFoco.duracion)}
          </text>
          <text x={C} y={C + 2} textAnchor="middle" fontSize={16} fontWeight={700} fontFamily="'Sora', sans-serif" fill="var(--color-text)">
            {recortar(nombreCliente(enFoco.clienteId), 17)}
          </text>
          <text x={C} y={C + 22} textAnchor="middle" fontSize={11.5} fill="var(--color-body)">{recortar(enFoco.servicio, 22)}</text>
          <text x={C} y={C + 41} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={ESTADO_TURNO[enFoco.estado].dot}>{ESTADO_TURNO[enFoco.estado].label}</text>
        </g>
      ) : (
        <g aria-hidden>
          <text x={C} y={C - 24} textAnchor="middle" fontSize={10} fontFamily='"Geist Mono", monospace' letterSpacing="0.16em" fill="var(--color-muted)">AHORA</text>
          <text x={C} y={C + 8} textAnchor="middle" fontSize={38} fontWeight={700} fontFamily="'Sora', sans-serif" letterSpacing="-0.03em" fill="var(--color-text)">{horaTxt(ahora)}</text>
          {pie && <text x={C} y={C + 32} textAnchor="middle" fontSize={11.5} fill="var(--color-body)">{pie}</text>}
        </g>
      )}
    </svg>
  )
}

const recortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Anillo de progreso chico (ocupación, cupo de una clase, avance de un paso). */
export function Anillo({ valor, size = 56, grosor = 6, color = 'var(--color-primary)', children, label }: { valor: number; size?: number; grosor?: number; color?: string; children?: React.ReactNode; label?: string }) {
  const r = (size - grosor) / 2
  const largo = 2 * Math.PI * r
  const v = Math.min(1, Math.max(0, valor))
  return (
    <span role="img" aria-label={label ?? `${Math.round(v * 100)}%`} style={{ position: 'relative', width: size, height: size, display: 'inline-grid', placeItems: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-alt)" strokeWidth={grosor} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round"
          strokeDasharray={`${(largo * v).toFixed(1)} ${largo.toFixed(1)}`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <span style={{ position: 'relative', fontFamily: '"Geist Mono", monospace', fontSize: Math.max(10, size * 0.22), fontWeight: 600, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
        {children ?? `${Math.round(v * 100)}%`}
      </span>
    </span>
  )
}
