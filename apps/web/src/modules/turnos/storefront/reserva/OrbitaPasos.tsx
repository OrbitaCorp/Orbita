// El progreso de la reserva como una órbita: cada paso es un punto sobre un
// arco y un satélite acompaña al paso en el que estás. Es el logo de Órbita
// haciendo de indicador, pintado con el color del negocio.
//
// El arco es un SVG y los pasos son botones HTML montados encima, ubicados en
// porcentajes: así el texto no se escala con el dibujo y los pasos ya hechos
// son botones de verdad (foco, teclado, lector de pantalla).
// En celular no entra un arco legible: va un anillo con "2/4" y el nombre.
import { Check } from 'lucide-react'
import { Anillo } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { arco, punto } from '@/modules/turnos/_shared/orbita/geometria'

const ANCHO = 760
const ALTO = 116
const RADIO = 1400          // círculo enorme: de él solo se ve el casquete de arriba
const CX = ANCHO / 2
const TOPE = 30             // y del punto más alto del arco
const CY = TOPE + RADIO
const MEDIO = 300           // del centro al primer y al último paso, en x
const SEMI = (Math.asin(MEDIO / RADIO) * 180) / Math.PI

interface Props {
  pasos: string[]
  actual: number
  onIr: (i: number) => void
}

export function OrbitaPasos({ pasos, actual, onIr }: Props) {
  const n = pasos.length
  const ang = (i: number) => (n === 1 ? 270 : 270 - SEMI + (2 * SEMI * i) / (n - 1))
  const avance = n === 1 ? 1 : actual / (n - 1)

  return (
    <nav aria-label="Pasos de la reserva">
      <div className="tur-orb">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden focusable="false">
          {/* Órbita exterior, de adorno, y la pista por donde van los pasos */}
          <path d={arco(CX, CY, RADIO + 15, 270 - SEMI - 2.4, 270 + SEMI + 2.4)} fill="none" stroke="var(--color-border)" strokeWidth={1} strokeDasharray="1.5 7" strokeLinecap="round" />
          <path d={arco(CX, CY, RADIO, 270 - SEMI - 1.6, 270 + SEMI + 1.6)} fill="none" stroke="var(--color-border)" strokeWidth={2} strokeLinecap="round" />
          {/* Lo recorrido: pathLength=1 deja animar el trazo sin medir el arco */}
          {n > 1 && (
            <path className="tur-orb-avance" d={arco(CX, CY, RADIO, ang(0), ang(n - 1))} pathLength={1} fill="none" stroke="var(--color-primary)" strokeWidth={2.5}
              strokeDasharray="1 1" strokeDashoffset={1 - avance} />
          )}
          {/* La nave gira alrededor del centro del círculo grande: se desliza por el arco, no en línea recta */}
          <g className="tur-orb-nave" style={{ transform: `rotate(${(ang(actual) - 270).toFixed(3)}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
            <circle cx={CX} cy={TOPE} r={24} fill="var(--color-primary-bg)" stroke="var(--color-primary)" strokeOpacity={0.55} strokeWidth={1.2} />
            <g className="tur-orb-sat" style={{ transformOrigin: `${CX}px ${TOPE}px` }}>
              <circle cx={CX + 24} cy={TOPE} r={4} fill="var(--color-primary)" stroke="var(--color-bg)" strokeWidth={1.5} />
            </g>
          </g>
        </svg>
        <ol>
          {pasos.map((p, i) => {
            const [x, y] = punto(CX, CY, RADIO, ang(i))
            const estado = i < actual ? 'hecho' : i === actual ? 'actual' : 'falta'
            return (
              <li key={p} style={{ left: `${(x / ANCHO) * 100}%`, top: `${(y / ALTO) * 100}%` }}>
                <button type="button" className="tur-orb-paso" data-estado={estado} disabled={estado !== 'hecho'} onClick={() => onIr(i)}
                  aria-current={estado === 'actual' ? 'step' : undefined}
                  aria-label={`Paso ${i + 1} de ${n}: ${p}${estado === 'hecho' ? ' (listo, tocá para volver)' : estado === 'actual' ? ' (estás acá)' : ''}`}>
                  <span className="tur-orb-punto">{estado === 'hecho' ? <Check size={15} strokeWidth={3} aria-hidden /> : i + 1}</span>
                  <span className="tur-orb-txt">{p}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="tur-orb-compacto">
        <Anillo valor={(actual + 1) / n} size={54} grosor={5} label={`Paso ${actual + 1} de ${n}`}>{actual + 1}/{n}</Anillo>
        <div style={{ minWidth: 0 }}>
          <div className="tur-h" style={{ fontSize: 19, fontWeight: 700 }}>{pasos[actual]}</div>
          <div style={{ fontSize: 13.5, color: 'var(--color-muted)', marginTop: 3 }}>{actual < n - 1 ? `Sigue: ${pasos[actual + 1]}` : 'Último paso'}</div>
        </div>
      </div>
    </nav>
  )
}
