import { useEffect, useLayoutEffect, useState } from 'react'

/**
 * Presencia del panel de Orbi: lo deja montado mientras se va, para que el
 * cierre se anime igual que la apertura (antes se desmontaba de golpe).
 *
 *   cerrado ─abrir→ preparando ─arrancar→ entrando ─fin→ abierto
 *                                             ↑ abrir        │ cerrar
 *                                             └── saliendo ←─┘ ─fin→ cerrado
 *
 * - `preparando` es un solo cuadro con el panel en su posición de cerrado (sin
 *   transición): sin él, el navegador nunca ve el "desde" y la transición de
 *   entrada no corre.
 * - `entrando` y `saliendo` son los únicos estados con transición. El ancho del
 *   lateral que cambia la persona arrastrando el tirador (estado `abierto`) no
 *   se anima.
 * - Volver a abrir mientras se va retoma desde donde está: la transición de CSS
 *   se da vuelta sola, sin saltar a cerrado.
 * - Sin movimiento (prefers-reduced-motion, o la página de Orbi que toma el
 *   lugar del panel) no hay estados intermedios: aparece y desaparece.
 */
export type Fase = 'cerrado' | 'preparando' | 'entrando' | 'abierto' | 'saliendo'
export type EventoPresencia = 'abrir' | 'cerrar' | 'arrancar' | 'fin'

/** Mismos valores que --orbi-dur-entrada y --orbi-dur-salida de orbi.module.css (lo verifica presencia.test.ts). */
export const DURACION_ENTRADA_MS = 240
export const DURACION_SALIDA_MS = 200
/** Un poco de aire para que el último cuadro de la transición llegue a pintarse antes de desmontar. */
const MARGEN_MS = 40

export function siguienteFase(fase: Fase, evento: EventoPresencia, conMovimiento = true): Fase {
  if (!conMovimiento) {
    if (evento === 'abrir') return 'abierto'
    if (evento === 'cerrar') return 'cerrado'
    // Si la preferencia cambió a mitad de camino, termina donde iba.
    if (fase === 'preparando' || fase === 'entrando') return 'abierto'
    if (fase === 'saliendo') return 'cerrado'
    return fase
  }
  switch (evento) {
    case 'abrir':
      if (fase === 'cerrado') return 'preparando'
      if (fase === 'saliendo') return 'entrando'
      return fase
    case 'cerrar':
      if (fase === 'preparando') return 'cerrado'
      if (fase === 'entrando' || fase === 'abierto') return 'saliendo'
      return fase
    case 'arrancar':
      return fase === 'preparando' ? 'entrando' : fase
    case 'fin':
      if (fase === 'entrando') return 'abierto'
      if (fase === 'saliendo') return 'cerrado'
      return fase
  }
}

/** Cuánto esperar en esta fase antes de mandar `fin` (null: no hay nada que esperar). */
export function esperaDeFase(fase: Fase): number | null {
  if (fase === 'entrando') return DURACION_ENTRADA_MS + MARGEN_MS
  if (fase === 'saliendo') return DURACION_SALIDA_MS + MARGEN_MS
  return null
}

export const estaMontado = (fase: Fase) => fase !== 'cerrado'

/**
 * `abierto` es la intención (el store); la fase es lo que se ve. Con
 * `conMovimiento` en false abre y cierra al instante.
 */
export function usePresencia(abierto: boolean, conMovimiento: boolean): { montado: boolean; fase: Fase } {
  const [fase, setFase] = useState<Fase>(() => siguienteFase('cerrado', abierto ? 'abrir' : 'cerrar', conMovimiento))
  const [anterior, setAnterior] = useState(abierto)

  // Durante el render, no en un efecto: así el panel ya está montado (o ya
  // empezó a irse) en el mismo commit en que cambia `abierto`.
  if (anterior !== abierto) {
    setAnterior(abierto)
    setFase(f => siguienteFase(f, abierto ? 'abrir' : 'cerrar', conMovimiento))
  }

  // `preparando` → `entrando` en el cuadro siguiente. Leer el layout obliga al
  // navegador a calcular ya el estilo de cerrado: desde ahí corre la transición.
  useLayoutEffect(() => {
    if (fase !== 'preparando') return
    void document.documentElement.offsetHeight
    const cuadro = requestAnimationFrame(() => setFase(f => siguienteFase(f, 'arrancar', conMovimiento)))
    return () => cancelAnimationFrame(cuadro)
  }, [fase, conMovimiento])

  useEffect(() => {
    const espera = esperaDeFase(fase)
    if (espera === null) return
    const t = window.setTimeout(() => setFase(f => siguienteFase(f, 'fin')), espera)
    return () => window.clearTimeout(t)
  }, [fase])

  return { montado: estaMontado(fase), fase }
}
