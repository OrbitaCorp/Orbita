// El progreso del alta dibujado como una órbita: cada paso es una estación
// sobre un arco y el satélite avanza hasta el paso actual.
//
// Los pasos llegan con id porque la lista cambia según el módulo: antes de
// elegir se ven los cinco que comparten Tienda y Turnos, y al elegir aparecen
// los propios (seis en Tienda, ocho en Turnos). Cada estación conserva su nodo
// (key = id), así que las que ya estaban se DESLIZAN por el arco hasta su lugar
// nuevo en vez de saltar, y las nuevas aparecen en el hueco que se abre.
//
// En celular el arco no entra con sus rótulos: ahí va la versión compacta, un
// anillo con "2/8" y el nombre del paso.
import { Check } from 'lucide-react'
import { Anillo } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { arco, punto } from '@/modules/turnos/_shared/orbita/geometria'
import type { Paso } from './modelo'

// El arco es un pedazo de un círculo enorme con el centro muy por debajo: así
// queda una curva suave y no una semicircunferencia que se coma media pantalla.
const ANCHO = 720
const ALTO = 126
const RADIO = 900
const CX = ANCHO / 2
const CY = 24 + RADIO
const CIMA = 270        // en SVG, 270° apunta para arriba
const MEDIO = 19.5      // grados a cada lado de la cima

interface Props {
  pasos: readonly Paso[]
  /** Índice del paso actual; pasos.length = todo terminado. */
  actual: number
  /** Hasta qué paso se llegó: los ya visitados que quedaron adelante también se pueden tocar. */
  alcanzado: number
  onIr: (paso: number) => void
}

type Estado = 'hecho' | 'actual' | 'visitado' | 'falta'
const AVISO: Record<Estado, string> = { hecho: ' (hecho, volver)', actual: ' (actual)', visitado: ' (ya lo pasaste, ir)', falta: '' }

export function OrbitaPasos({ pasos, actual, alcanzado, onIr }: Props) {
  const n = pasos.length
  const terminado = actual >= n
  const enArco = Math.min(actual, n - 1)
  const angulo = (i: number) => CIMA - MEDIO + (i / (n - 1)) * MEDIO * 2
  const recorrido = terminado ? 100 : (enArco / (n - 1)) * 100
  const [sx, sy] = punto(CX, CY, RADIO, CIMA)
  const trazo = arco(CX, CY, RADIO, CIMA - MEDIO, CIMA + MEDIO)

  return (
    <>
      <nav className="tuob-pasos" aria-label="Pasos del alta">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden focusable="false">
          <defs>
            <linearGradient id="tuobRecorrido" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="60%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#93C5FD" />
            </linearGradient>
          </defs>
          <path d={trazo} fill="none" stroke="rgba(147,197,253,0.26)" strokeWidth={1.1} strokeDasharray="2 7" strokeLinecap="round" />
          {/* pathLength=100 deja hablar en porcentaje: lo recorrido es "X de 100". */}
          <path className="tuob-recorrido" d={trazo} pathLength={100} fill="none" stroke="url(#tuobRecorrido)" strokeWidth={1.8} strokeLinecap="round" strokeDasharray={`${recorrido} 100`} />
          {!terminado && (
            // El satélite está dibujado en la cima y se lo gira alrededor del
            // centro del círculo: al cambiar de paso (o de cantidad de pasos)
            // viaja POR el arco, no en línea recta.
            <g className="tuob-satelite" style={{ transform: `rotate(${angulo(enArco) - CIMA}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
              <circle cx={sx} cy={sy} r={13} fill="#60A5FA" opacity={0.2} className="tuo-late" />
              <circle cx={sx} cy={sy} r={6.2} fill="#BFDBFE" stroke="#3B82F6" strokeWidth={2.2} />
            </g>
          )}
        </svg>
        <ol>
          {pasos.map((p, i) => {
            const [x, y] = punto(CX, CY, RADIO, angulo(i))
            const estado: Estado = terminado || i < actual ? 'hecho' : i === actual ? 'actual' : i <= alcanzado ? 'visitado' : 'falta'
            const tocable = !terminado && (estado === 'hecho' || estado === 'visitado')
            return (
              <li key={p.id} style={{ left: `${(x / ANCHO) * 100}%`, top: `${(y / ALTO) * 100}%` }}>
                <button
                  type="button" className="tuob-punto" data-estado={estado} data-tocable={tocable}
                  // Para atrás se vuelve siempre; para adelante, solo a un paso por el que ya se pasó.
                  disabled={!tocable}
                  aria-current={estado === 'actual' ? 'step' : undefined}
                  aria-label={`Paso ${i + 1} de ${n}: ${p.label}${terminado ? ' (hecho)' : AVISO[estado]}`}
                  onClick={() => onIr(i)}
                >
                  <i aria-hidden><Check strokeWidth={3.4} /></i>
                  <span aria-hidden>{p.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="tuob-pasos-mini">
        <Anillo valor={terminado ? 1 : (enArco + 1) / n} size={54} grosor={5} color="#60A5FA" label={terminado ? 'Alta terminada' : `Paso ${enArco + 1} de ${n}`}>
          {terminado ? <Check size={20} strokeWidth={2.6} aria-hidden /> : `${enArco + 1}/${n}`}
        </Anillo>
        <div style={{ minWidth: 0 }}>
          <div className="tuo-rotulo">{terminado ? 'Alta terminada' : `Paso ${enArco + 1} de ${n}`}</div>
          <div className="tuo-h2" style={{ marginTop: 3 }}>{terminado ? '¡Listo!' : pasos[enArco].label}</div>
          {!terminado && enArco < n - 1 && <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>Sigue: {pasos[enArco + 1].label}</div>}
        </div>
      </div>
    </>
  )
}
