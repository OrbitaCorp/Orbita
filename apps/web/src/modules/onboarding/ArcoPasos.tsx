// ─── El recorrido del alta, dibujado como una órbita ─────────────────────────
//
// Cada paso es una estación sobre un arco y el satélite marca dónde está
// parado el dueño: lo ya hecho queda tildado y el tramo recorrido se pinta con
// el color de la marca. Es el dibujo que nació en la demo de Turnos, traído al
// alta real en reemplazo de la franja plana de bolitas numeradas.
//
// Solo presentación: recibe la lista de pasos y cuál es el actual, nada más.
// Los colores salen de los tokens del tema (--color-*), así que el mismo
// componente sirve en claro y en oscuro. Las reglas (.ob-arco*) viajan con el
// componente, en CSS_ARCO, y no en globals.css: el primer deploy que las llevó
// en globals.css salió a producción con la hoja de estilos anterior y el arco
// quedó sin estilo, tapando la pantalla de pago (02/10/2026).
//
// En celular el arco no entra con sus seis rótulos: de 640px para abajo va la
// versión compacta, un anillo con "2/6", el nombre del paso y el que sigue.

import { useEffect, useState } from 'react'

const CSS_ARCO = `
/* ─── Onboarding · arco de pasos (modules/onboarding/ArcoPasos.tsx) ─────────
   La barra única del alta, dibujada como una órbita: una estación por paso y
   un satélite en el actual. Todo pinta con los tokens del tema, así que sale
   bien en claro y en oscuro sin reglas aparte.

   Los estados no dependen solo del color: lo hecho lleva tilde, el paso actual
   es el satélite (más grande, con halo y rótulo en negrita) y lo que falta es
   un punto hueco y chico. */
.ob-arco {
  --ob-arco-fondo: var(--color-surface);
  --ob-arco-ease: cubic-bezier(0.22, 1, 0.36, 1);
  padding: 10px 28px 6px;
  border-bottom: 1px solid var(--color-border);
  /* Una luz suave del color de la marca cayendo desde arriba, sobre la franja. */
  background:
    radial-gradient(560px 150px at 50% 0%, color-mix(in srgb, var(--color-primary) 11%, transparent), transparent 72%),
    var(--ob-arco-fondo);
}
.ob-arco-pista { position: relative; width: 100%; max-width: 720px; aspect-ratio: 720 / 112; margin: 0 auto; }
.ob-arco-pista > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ob-arco-linea { fill: none; stroke: color-mix(in srgb, var(--color-subtle) 80%, transparent); stroke-width: 1.3; stroke-dasharray: 2 7; stroke-linecap: round; }
.ob-arco-recorrido { fill: none; stroke: url(#obArcoRecorrido); stroke-width: 2.2; stroke-linecap: round; transition: stroke-dasharray 700ms var(--ob-arco-ease); }

/* Estaciones: el punto hueco de "falta" y, encima, el disco con tilde de "hecho"
   (con su resplandor, que es un degradé radial del SVG y no un filtro). */
.ob-arco-falta { fill: var(--ob-arco-fondo); stroke: var(--color-subtle); stroke-width: 1.5; transition: opacity 200ms ease; }
.ob-arco-est:not([data-estado='falta']) .ob-arco-falta { opacity: 0; }
.ob-arco-hecho { transform-box: fill-box; transform-origin: center; transform: scale(0.3); opacity: 0;
  transition: transform 380ms var(--ob-arco-ease), opacity 200ms ease; }
.ob-arco-est[data-estado='hecho'] .ob-arco-hecho { transform: none; opacity: 1; }
.ob-arco-brillo { fill: url(#obArcoBrillo); }
.ob-arco-disco { fill: url(#obArcoHecho); }
.ob-arco-hecho path { fill: none; stroke: var(--color-on-primary); stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }

/* El satélite: está dibujado en la cima y gira alrededor del centro del círculo. */
.ob-arco-satelite { transition: transform 700ms var(--ob-arco-ease); }
.ob-arco-halo { fill: var(--color-primary); opacity: 0.2; transform-box: fill-box; transform-origin: center; animation: obArcoLate 1.8s ease-in-out infinite; }
.ob-arco-nucleo { fill: var(--color-bg); stroke: var(--color-primary); stroke-width: 3; }
.ob-arco-centro { fill: var(--color-primary); }
@keyframes obArcoLate { 0%, 100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.1; transform: scale(1.3); } }

/* Rótulos: texto de verdad (no SVG), para que no se achiquen con el dibujo. */
.ob-arco-pista ol { list-style: none; margin: 0; padding: 0; }
.ob-arco-pista li { position: absolute; transform: translateX(-50%); margin-top: 15px; white-space: nowrap;
  font-size: 12px; font-weight: 500; line-height: 16px; color: var(--color-muted); transition: color 240ms ease; }
.ob-arco-pista li[data-estado='hecho'] { color: var(--color-body); }
.ob-arco-pista li[data-estado='actual'] { color: var(--color-text); font-weight: 600; }
/* Solo para lectores de pantalla: el estado de cada paso, dicho en palabras. */
.ob-arco-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }

/* Versión compacta (celular). */
.ob-arco-mini { display: none; align-items: center; gap: 12px; }
.ob-arco-anillo { position: relative; display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; }
.ob-arco-anillo svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.ob-arco-anillo-pista { fill: none; stroke: var(--color-border-strong); stroke-width: 4; }
.ob-arco-anillo-avance { fill: none; stroke: var(--color-primary); stroke-width: 4; stroke-linecap: round; transition: stroke-dasharray 700ms var(--ob-arco-ease); }
.ob-arco-anillo b { position: relative; font-family: "Geist Mono", ui-monospace, monospace; font-size: 12px; font-weight: 600; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; color: var(--color-text); }
.ob-arco-mini-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.ob-arco-mini-txt strong { font-size: 15px; font-weight: 700; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-arco-mini-txt > span:last-child { font-size: 12.5px; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 640px) {
  .ob-arco { padding: 10px 16px; }
  .ob-arco-pista { display: none; }
  .ob-arco-mini  { display: flex; }
}
@media (prefers-reduced-motion: reduce) {
  .ob-arco-recorrido, .ob-arco-satelite, .ob-arco-hecho, .ob-arco-falta, .ob-arco-anillo-avance, .ob-arco-pista li { transition: none; }
  .ob-arco-halo { animation: none; }
}
`

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
      <style>{CSS_ARCO}</style>
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
