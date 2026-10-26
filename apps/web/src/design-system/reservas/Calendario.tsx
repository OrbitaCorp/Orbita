// Calendario mensual de reservas (design system): un mes por vez, lunes a domingo, celdas de
// 44 px. Sirve para elegir un día (canchas y salones) o un rango de noches
// (estadías): el rango se arma con dos toques, el de entrada y el de salida,
// sin arrastrar ni pasar el mouse. Las flechas del teclado mueven el foco de
// día en día (Inicio/Fin: punta de la semana; RePág/AvPág: otro mes) y Enter
// elige. Puro y controlado: el padre decide qué día está ocupado, cerrado o
// fuera de rango.
//
// Un día que no se puede elegir no lleva `disabled` sino aria-disabled: sigue
// recibiendo el foco, así el teclado puede pasar por encima (con `disabled` el
// foco se quedaba trabado en el último día libre y la grilla podía quedar sin
// ningún día alcanzable con Tab).
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DIAS_CORTOS, diasEntre, diaSemana, esAntes, fechaLarga, grillaMes, mesTxt, moverMes, partes, sumarDias, type ISO } from '@/lib/reservas/fechas'

export interface EstadoDia {
  /** No se puede elegir (cerrado, pasado, fuera de la ventana). */
  deshabilitado?: boolean
  /** Está tomado: se ve tachado. */
  ocupado?: boolean
  /** Texto para el lector de pantalla. */
  aria?: string
}

interface Base {
  /** Cualquier fecha del mes que se muestra. */
  mes: ISO
  onMes: (mes: ISO) => void
  hoy: ISO
  estadoDe?: (fecha: ISO) => EstadoDia
  /** Hasta qué mes se puede avanzar (por defecto, sin tope). */
  maxMes?: ISO
  minMes?: ISO
  className?: string
}

/** A qué día manda una tecla desde `fecha`; null si la tecla no mueve el foco. Pura: no toca refs. */
function saltoDeTecla(e: KeyboardEvent<HTMLButtonElement>, fecha: ISO): ISO | null {
  const salto: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -diaSemana(fecha), End: 6 - diaSemana(fecha) }
  let destino: ISO | null = null
  if (Object.hasOwn(salto, e.key)) destino = sumarDias(fecha, salto[e.key])
  else if (e.key === 'PageUp' || e.key === 'PageDown') {
    // El mismo número de día en el mes de al lado (o el último, si ese mes es más corto).
    const primero = moverMes(fecha, e.key === 'PageUp' ? -1 : 1)
    const ultimo = sumarDias(moverMes(primero, 1), -1)
    destino = sumarDias(primero, Math.min(partes(fecha).dia, partes(ultimo).dia) - 1)
  }
  if (destino) e.preventDefault()
  return destino
}

/** El primer día del mes de `f`, para comparar meses. */
const inicioDeMes = (f: ISO) => moverMes(f, 0)

/** El teclado no lleva a un mes al que tampoco llegan las flechas de arriba. */
const fueraDeMeses = (f: ISO, minMes?: ISO, maxMes?: ISO) =>
  (!!minMes && esAntes(inicioDeMes(f), inicioDeMes(minMes))) || (!!maxMes && esAntes(inicioDeMes(maxMes), inicioDeMes(f)))

function Cabecera({ mes, onMes, minMes, maxMes }: Pick<Base, 'mes' | 'onMes' | 'minMes' | 'maxMes'>) {
  const p = partes(mes)
  const puedeAtras = !minMes || esAntes(minMes, `${p.anio}-${String(p.mes).padStart(2, '0')}-01`)
  const puedeAdelante = !maxMes || esAntes(mes, maxMes)
  return (
    <div className="rv-cal-cab">
      <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => onMes(moverMes(mes, -1))} disabled={!puedeAtras} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
      <span className="rv-cal-mes" aria-live="polite">{mesTxt(mes)}</span>
      <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => onMes(moverMes(mes, 1))} disabled={!puedeAdelante} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
    </div>
  )
}

const Encabezados = () => (
  <div className="rv-cal-dias" aria-hidden>
    {DIAS_CORTOS.map(d => <span key={d}>{d}</span>)}
  </div>
)

/**
 * Qué día de la grilla recibe el Tab (tabindex roving): el que tuvo el foco,
 * el elegido o el primero libre, pero siempre uno que se esté viendo. Si el
 * foco quedó en otro mes (se pasó de mes con las flechas de arriba), ningún
 * día tendría tabindex 0 y la grilla quedaría fuera del alcance del teclado.
 */
function diaActivo(celdas: { fecha: ISO; delMes: boolean }[], candidatos: (ISO | null)[], libre: (f: ISO) => boolean): ISO {
  const visibles = new Set(celdas.map(c => c.fecha))
  return candidatos.find((f): f is ISO => !!f && visibles.has(f)) ?? celdas.find(c => c.delMes && libre(c.fecha))?.fecha ?? celdas.find(c => c.delMes)?.fecha ?? celdas[0].fecha
}

/** Lo que dice el lector de pantalla de cada día: "Sábado 14 de noviembre de 2026". */
const diaParaLeer = (f: ISO) => `${fechaLarga(f)} de ${partes(f).anio}`

// ─── Un día ──────────────────────────────────────────────────────────────────

export function CalendarioDia({ mes, onMes, hoy, estadoDe, elegido, onElegir, minMes, maxMes, className }: Base & { elegido: ISO | null; onElegir: (f: ISO) => void }) {
  const celdas = grillaMes(partes(mes).anio, partes(mes).mes)
  const [foco, setFoco] = useState<ISO | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const id = useId()
  const irA = (f: ISO) => {
    if (fueraDeMeses(f, minMes, maxMes)) return
    if (inicioDeMes(f) !== inicioDeMes(mes)) onMes(f)
    setFoco(f)
    requestAnimationFrame(() => raiz.current?.querySelector<HTMLButtonElement>(`[data-fecha="${f}"]`)?.focus())
  }
  const teclas = (e: KeyboardEvent<HTMLButtonElement>, fecha: ISO) => { const f = saltoDeTecla(e, fecha); if (f) irA(f) }
  const activo = diaActivo(celdas, [foco, elegido], f => !estadoDe?.(f).deshabilitado)
  return (
    <div ref={raiz} className={`rv-cal${className ? ` ${className}` : ''}`} role="group" aria-labelledby={id}>
      <span id={id} className="rv-sr">Elegí un día</span>
      <Cabecera mes={mes} onMes={onMes} minMes={minMes} maxMes={maxMes} />
      <Encabezados />
      <div className="rv-cal-dias">
        {celdas.map(c => {
          const e = estadoDe?.(c.fecha) ?? {}
          const sel = elegido === c.fecha
          const bloqueado = !!e.deshabilitado
          return (
            <button key={c.fecha} type="button" className="rv-cal-celda" data-fecha={c.fecha} data-fuera={!c.delMes} data-hoy={c.fecha === hoy} data-ocupado={e.ocupado || undefined}
              aria-pressed={sel} aria-disabled={bloqueado || undefined} tabIndex={c.fecha === activo ? 0 : -1}
              aria-label={`${diaParaLeer(c.fecha)}${c.fecha === hoy ? ', hoy' : ''}${e.aria ? `, ${e.aria}` : bloqueado ? ', no disponible' : ''}`}
              onClick={() => { if (!bloqueado) onElegir(c.fecha) }} onKeyDown={ev => teclas(ev, c.fecha)} onFocus={() => setFoco(c.fecha)}>
              {partes(c.fecha).dia}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Un rango de noches ──────────────────────────────────────────────────────

export interface Rango { entrada: ISO | null; salida: ISO | null }

/**
 * Dos toques: el primero marca la entrada, el segundo la salida. Un toque
 * antes de la entrada la reemplaza (empieza de nuevo desde ese día); un toque
 * sobre la entrada la borra; con el rango completo, el próximo toque arranca
 * otro. Entre medio, `salidaMaxima` acota hasta dónde se puede llegar sin
 * pisar una noche tomada (sin `salidaMaxima` no hay tope). La salida puede
 * caer en un día ocupado (ese día no se duerme).
 */
export function CalendarioRango({ mes, onMes, hoy, estadoDe, rango, onRango, salidaMaxima, minMes, maxMes, className }: Base & {
  rango: Rango
  onRango: (r: Rango) => void
  /** Desde la entrada elegida, la última salida posible. null = la entrada no sirve. */
  salidaMaxima?: (entrada: ISO) => ISO | null
}) {
  const celdas = grillaMes(partes(mes).anio, partes(mes).mes)
  const [foco, setFoco] = useState<ISO | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const id = useId()
  const irA = (f: ISO) => {
    if (fueraDeMeses(f, minMes, maxMes)) return
    if (inicioDeMes(f) !== inicioDeMes(mes)) onMes(f)
    setFoco(f)
    requestAnimationFrame(() => raiz.current?.querySelector<HTMLButtonElement>(`[data-fecha="${f}"]`)?.focus())
  }
  const teclas = (e: KeyboardEvent<HTMLButtonElement>, fecha: ISO) => { const f = saltoDeTecla(e, fecha); if (f) irA(f) }
  const { entrada, salida } = rango
  const eligiendoSalida = !!entrada && !salida
  // undefined = sin tope; null = desde esa entrada no se puede salir ningún día.
  const tope: ISO | null | undefined = eligiendoSalida && salidaMaxima ? salidaMaxima(entrada) : undefined
  const dentroDelTope = (f: ISO) => tope === undefined || (tope !== null && !esAntes(tope, f))

  /** Si `f` se puede tocar ahora (como entrada o como salida, según el paso). */
  const sePuede = (f: ISO, e: EstadoDia) => {
    if (e.deshabilitado) return false
    if (eligiendoSalida && entrada) {
      // Antes de la entrada o sobre ella: es reemplazar o borrar la entrada.
      if (f === entrada) return true
      if (esAntes(f, entrada)) return !e.ocupado
      // Después: tiene que ser una salida posible. Un día ocupado sirve de salida si está dentro del tope.
      return dentroDelTope(f) && (!e.ocupado || tope !== undefined)
    }
    return !e.ocupado
  }

  const elegir = (f: ISO) => {
    if (!entrada || salida) { onRango({ entrada: f, salida: null }); return }
    if (f === entrada) { onRango({ entrada: null, salida: null }); return }
    if (esAntes(f, entrada)) { onRango({ entrada: f, salida: null }); return }
    onRango({ entrada, salida: f })
  }
  const activo = diaActivo(celdas, [foco, salida, entrada], f => !estadoDe?.(f).deshabilitado && !estadoDe?.(f).ocupado)
  const estadoTxt = !entrada ? 'Elegí el día de entrada' : !salida ? `Entrada el ${diaParaLeer(entrada)}. Ahora elegí el día de salida` : `Del ${diaParaLeer(entrada)} al ${diaParaLeer(salida)}, ${diasEntre(entrada, salida)} noches`

  return (
    <div ref={raiz} className={`rv-cal${className ? ` ${className}` : ''}`} role="group" aria-labelledby={id}>
      <span id={id} className="rv-sr">Elegí entrada y salida</span>
      <p className="rv-sr" aria-live="polite">{estadoTxt}</p>
      <Cabecera mes={mes} onMes={onMes} minMes={minMes} maxMes={maxMes} />
      <Encabezados />
      <div className="rv-cal-dias">
        {celdas.map(c => {
          const f = c.fecha
          const e = estadoDe?.(f) ?? {}
          const libre = sePuede(f, e)
          let rangoAttr: 'inicio' | 'fin' | 'medio' | 'solo' | undefined
          if (entrada && salida) {
            if (f === entrada) rangoAttr = 'inicio'
            else if (f === salida) rangoAttr = 'fin'
            else if (esAntes(entrada, f) && esAntes(f, salida)) rangoAttr = 'medio'
          } else if (entrada && f === entrada) rangoAttr = 'solo'
          const papel = rangoAttr === 'inicio' || rangoAttr === 'solo' ? ', entrada' : rangoAttr === 'fin' ? ', salida' : ''
          return (
            <button key={f} type="button" className="rv-cal-celda" data-fecha={f} data-fuera={!c.delMes} data-hoy={f === hoy} data-ocupado={e.ocupado && !rangoAttr ? true : undefined} data-rango={rangoAttr}
              aria-disabled={!libre || undefined} tabIndex={f === activo ? 0 : -1}
              aria-label={`${diaParaLeer(f)}${f === hoy ? ', hoy' : ''}${papel}${e.aria ? `, ${e.aria}` : !libre ? ', no disponible' : ''}`}
              onClick={() => { if (libre) elegir(f) }} onKeyDown={ev => teclas(ev, f)} onFocus={() => setFoco(f)}>
              {partes(f).dia}
            </button>
          )
        })}
      </div>
    </div>
  )
}
