// ─── El recorrido del alta, dibujado como una órbita ─────────────────────────
//
// Cada paso es una estación sobre un arco y el satélite marca dónde está
// parado el dueño: lo ya hecho queda tildado y el tramo recorrido se pinta con
// el color de la marca. Es el dibujo que nació en la demo de Turnos, traído al
// alta real en reemplazo de la franja plana de bolitas numeradas.
//
// Solo presentación: recibe la lista de pasos y cuál es el actual, nada más.
// Los colores salen de los tokens del tema (--color-*), así que el mismo
// componente sirve en claro y en oscuro; las reglas viven en globals.css
// (.ob-arco*), junto al resto del responsive del onboarding.
//
// En celular el arco no entra con sus seis rótulos: de 640px para abajo va la
// versión compacta, un anillo con "2/6", el nombre del paso y el que sigue.

import { useEffect, useState } from 'react'

// El arco es un pedazo de un círculo enorme con el centro muy por debajo: así
// queda una curva suave y no una semicircunferencia que se coma media pantalla.
const ANCHO = 720
const ALTO = 112
const RADIO = 900
const CX = ANCHO / 2
const CY = 18 + RADIO
const CIMA = 270        // en SVG, 0° apunta a la derecha y 270° hacia arriba
const MEDIO = 19.5      // grados a cada lado de la cima

// Anillo de la versión compacta.
const LADO = 44
const GROSOR = 4
const R_ANILLO = (LADO - GROSOR) / 2
const LARGO_ANILLO = 2 * Math.PI * R_ANILLO

/** Punto del círculo del arco a `grados`. Redondeado: servidor y navegador escriben el mismo número. */
function punto(grados: number): [number, number] {
  const a = (grados * Math.PI) / 180
  return [+(CX + RADIO * Math.cos(a)).toFixed(2), +(CY + RADIO * Math.sin(a)).toFixed(2)]
}

// Último paso que mostró el arco en esta pestaña. Rubro, setup y pago son tres
// páginas y cada una monta su propia barra: sin esto, al pasar de una a otra
// el satélite aparecería ya parado en el paso nuevo. Así arranca donde había
// quedado y llega viajando por el arco. Solo se escribe desde un efecto, o sea
// que en el servidor queda siempre en null.
let ultimoMostrado: number | null = null

interface Props {
  pasos: readonly string[]
  /** Índice del paso actual; pasos.length = todo terminado. */
  actual: number
}

export function ArcoPasos({ pasos, actual }: Props) {
  const n = pasos.length
  // Punto de partida del viaje, solo si hay de dónde venir y la persona no
  // pidió menos movimiento (sin transición, mostrar el paso anterior durante
  // dos cuadros sería un parpadeo). En el servidor ultimoMostrado es null y
  // nunca se llega a tocar window.
  const [desde, setDesde] = useState<number | null>(() =>
    ultimoMostrado !== null && ultimoMostrado !== actual && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? ultimoMostrado
      : null,
  )

  useEffect(() => {
    if (desde === null) return
    // Dos cuadros: en el primero se pinta el punto de partida; recién en el
    // segundo se suelta, para que la transición de CSS tenga de dónde salir.
    let segundo = 0
    const primero = requestAnimationFrame(() => { segundo = requestAnimationFrame(() => setDesde(null)) })
    return () => { cancelAnimationFrame(primero); cancelAnimationFrame(segundo) }
  }, [desde])
  useEffect(() => { ultimoMostrado = actual }, [actual])

  if (n === 0) return null

  const mostrado = Math.max(0, Math.min(desde ?? actual, n))
  const terminado = mostrado >= n
  const enArco = Math.min(mostrado, n - 1)
  const angulo = (i: number) => n === 1 ? CIMA : CIMA - MEDIO + (i / (n - 1)) * MEDIO * 2
  const recorrido = terminado ? 100 : n === 1 ? 0 : +((enArco / (n - 1)) * 100).toFixed(2)
  const [x1, y1] = punto(angulo(0))
  const [x2, y2] = punto(angulo(n - 1))
  const trazo = `M ${x1} ${y1} A ${RADIO} ${RADIO} 0 0 1 ${x2} ${y2}`
  const [sx, sy] = punto(CIMA)
  const estaciones = pasos.map((label, i) => {
    const [x, y] = punto(angulo(i))
    const estado = i < mostrado ? 'hecho' : i === mostrado ? 'actual' : 'falta'
    return { label, x, y, estado }
  })
  const avance = terminado ? 1 : (enArco + 1) / n

  return (
    <nav className="ob-arco" aria-label="Pasos del alta">
      {/* ── Escritorio: el arco con todas las estaciones ── */}
      <div className="ob-arco-pista">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden focusable="false">
          <defs>
            <linearGradient id="obArcoRecorrido" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: 'var(--color-primary-h)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-primary)' }} />
            </linearGradient>
            <linearGradient id="obArcoHecho" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-primary)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-primary-h)' }} />
            </linearGradient>
            {/* El resplandor de lo hecho es un degradé y no un filtro: los filtros de
                CSS sobre elementos internos de un SVG no andan igual en todos los navegadores. */}
            <radialGradient id="obArcoBrillo">
              <stop offset="55%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0.4 }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0 }} />
            </radialGradient>
          </defs>
          <path className="ob-arco-linea" d={trazo} />
          {/* pathLength=100 deja hablar en porcentaje: lo recorrido es "X de 100". */}
          <path className="ob-arco-recorrido" d={trazo} pathLength={100} strokeDasharray={`${recorrido} 100`} />
          {estaciones.map((e, i) => (
            <g key={i} className="ob-arco-est" data-estado={e.estado} transform={`translate(${e.x} ${e.y})`}>
              <circle className="ob-arco-falta" r={5} />
              <g className="ob-arco-hecho">
                <circle className="ob-arco-brillo" r={15} />
                <circle className="ob-arco-disco" r={9} />
                <path d="M-3.7 0.2 L-1.2 2.7 L3.9 -2.5" />
              </g>
            </g>
          ))}
          {!terminado && (
            // El satélite está dibujado en la cima y se lo gira alrededor del
            // centro del círculo: al cambiar de paso viaja POR el arco, no en
            // línea recta.
            <g className="ob-arco-satelite" style={{ transform: `rotate(${+(angulo(enArco) - CIMA).toFixed(3)}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
              <circle className="ob-arco-halo" cx={sx} cy={sy} r={15} />
              <circle className="ob-arco-nucleo" cx={sx} cy={sy} r={8} />
              <circle className="ob-arco-centro" cx={sx} cy={sy} r={2.8} />
            </g>
          )}
        </svg>
        <ol>
          {estaciones.map((e, i) => (
            <li
              key={`${i}-${e.label}`} data-estado={e.estado}
              aria-current={e.estado === 'actual' ? 'step' : undefined}
              style={{ left: `${+((e.x / ANCHO) * 100).toFixed(3)}%`, top: `${+((e.y / ALTO) * 100).toFixed(3)}%` }}
            >
              {e.label}
              <span className="ob-arco-sr">{e.estado === 'hecho' ? ', hecho' : e.estado === 'actual' ? ', paso actual' : ', pendiente'}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Celular: anillo con el número de paso, su nombre y el que sigue ── */}
      <div className="ob-arco-mini">
        <span className="ob-arco-anillo" aria-hidden>
          <svg viewBox={`0 0 ${LADO} ${LADO}`} focusable="false">
            <circle className="ob-arco-anillo-pista" cx={LADO / 2} cy={LADO / 2} r={R_ANILLO} />
            <circle
              className="ob-arco-anillo-avance" cx={LADO / 2} cy={LADO / 2} r={R_ANILLO}
              strokeDasharray={`${(LARGO_ANILLO * avance).toFixed(1)} ${LARGO_ANILLO.toFixed(1)}`}
            />
          </svg>
          <b>{terminado ? n : enArco + 1}/{n}</b>
        </span>
        <span className="ob-arco-mini-txt">
          <span className="ob-arco-sr">{terminado ? 'Alta terminada.' : `Paso ${enArco + 1} de ${n}:`}</span>
          <strong>{terminado ? '¡Listo!' : pasos[enArco]}</strong>
          {!terminado && <span>{enArco < n - 1 ? `Sigue: ${pasos[enArco + 1]}` : 'Último paso'}</span>}
        </span>
      </div>
    </nav>
  )
}
