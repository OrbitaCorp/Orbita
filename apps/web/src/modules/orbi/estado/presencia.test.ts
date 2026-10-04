import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DURACION_ENTRADA_MS, DURACION_SALIDA_MS, esperaDeFase, estaMontado, siguienteFase, type EventoPresencia, type Fase } from './presencia'

const recorrer = (desde: Fase, eventos: EventoPresencia[], conMovimiento = true) =>
  eventos.reduce<Fase>((f, e) => siguienteFase(f, e, conMovimiento), desde)

describe('presencia del panel de Orbi', () => {
  it('abre en tres pasos: un cuadro en posición de cerrado, la transición y quieto', () => {
    expect(siguienteFase('cerrado', 'abrir')).toBe('preparando')
    expect(siguienteFase('preparando', 'arrancar')).toBe('entrando')
    expect(siguienteFase('entrando', 'fin')).toBe('abierto')
  })

  it('al cerrar sigue montado hasta que termina la salida', () => {
    const f = siguienteFase('abierto', 'cerrar')
    expect(f).toBe('saliendo')
    expect(estaMontado(f)).toBe(true)
    expect(siguienteFase(f, 'fin')).toBe('cerrado')
    expect(estaMontado('cerrado')).toBe(false)
  })

  it('volver a abrir mientras se va retoma la entrada, sin pasar por cerrado', () => {
    expect(recorrer('abierto', ['cerrar', 'abrir'])).toBe('entrando')
    expect(recorrer('abierto', ['cerrar', 'abrir', 'fin'])).toBe('abierto')
  })

  it('cerrar a mitad de la entrada sale desde donde está', () => {
    expect(recorrer('cerrado', ['abrir', 'arrancar', 'cerrar'])).toBe('saliendo')
    // Antes del primer cuadro todavía no se vio nada: se va sin animar.
    expect(recorrer('cerrado', ['abrir', 'cerrar'])).toBe('cerrado')
  })

  it('un `fin` o `arrancar` atrasado no cambia lo que no corresponde', () => {
    expect(siguienteFase('abierto', 'fin')).toBe('abierto')
    expect(siguienteFase('cerrado', 'fin')).toBe('cerrado')
    expect(siguienteFase('entrando', 'arrancar')).toBe('entrando')
    expect(siguienteFase('saliendo', 'arrancar')).toBe('saliendo')
    expect(siguienteFase('saliendo', 'cerrar')).toBe('saliendo')
    expect(siguienteFase('abierto', 'abrir')).toBe('abierto')
  })

  it('sin movimiento aparece y desaparece de una', () => {
    expect(siguienteFase('cerrado', 'abrir', false)).toBe('abierto')
    expect(siguienteFase('abierto', 'cerrar', false)).toBe('cerrado')
    // Si a mitad de una animación deja de haber movimiento, termina donde iba.
    expect(siguienteFase('saliendo', 'cerrar', false)).toBe('cerrado')
    expect(siguienteFase('entrando', 'arrancar', false)).toBe('abierto')
    expect(siguienteFase('preparando', 'arrancar', false)).toBe('abierto')
  })

  it('solo se espera en las fases con transición, y la salida es más corta que la entrada', () => {
    expect(esperaDeFase('entrando')).toBeGreaterThanOrEqual(DURACION_ENTRADA_MS)
    expect(esperaDeFase('saliendo')).toBeGreaterThanOrEqual(DURACION_SALIDA_MS)
    expect(esperaDeFase('abierto')).toBeNull()
    expect(esperaDeFase('preparando')).toBeNull()
    expect(esperaDeFase('cerrado')).toBeNull()
    expect(DURACION_SALIDA_MS).toBeLessThan(DURACION_ENTRADA_MS)
  })
})

describe('los tiempos de la presencia y los del CSS', () => {
  it('orbi.module.css usa las mismas duraciones que el código que desmonta el panel', () => {
    const css = readFileSync(fileURLToPath(new URL('../orbi.module.css', import.meta.url)), 'utf8')
    expect(css).toContain(`--orbi-dur-entrada: ${DURACION_ENTRADA_MS}ms`)
    expect(css).toContain(`--orbi-dur-salida: ${DURACION_SALIDA_MS}ms`)
  })
})

// El recorrido completo con los temporizadores, como lo hace el hook: la fase
// manda `fin` cuando pasa su espera, y volver a abrir cancela la espera vieja.
describe('recorrido con el reloj', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function simular() {
    let fase: Fase = 'cerrado'
    let temporizador: ReturnType<typeof setTimeout> | null = null
    const programar = () => {
      if (temporizador) clearTimeout(temporizador)
      temporizador = null
      const espera = esperaDeFase(fase)
      if (espera !== null) temporizador = setTimeout(() => { fase = siguienteFase(fase, 'fin'); programar() }, espera)
    }
    const mandar = (e: EventoPresencia) => { fase = siguienteFase(fase, e); programar() }
    return { mandar, fase: () => fase }
  }

  it('se desmonta recién cuando termina la salida', () => {
    const p = simular()
    p.mandar('abrir'); p.mandar('arrancar')
    vi.advanceTimersByTime(esperaDeFase('entrando')!)
    expect(p.fase()).toBe('abierto')
    p.mandar('cerrar')
    vi.advanceTimersByTime(DURACION_SALIDA_MS - 1)
    expect(estaMontado(p.fase())).toBe(true)
    vi.advanceTimersByTime(esperaDeFase('saliendo')!)
    expect(p.fase()).toBe('cerrado')
  })

  it('reabrir durante la salida cancela el desmontaje', () => {
    const p = simular()
    p.mandar('abrir'); p.mandar('arrancar')
    vi.advanceTimersByTime(1000)
    p.mandar('cerrar')
    vi.advanceTimersByTime(DURACION_SALIDA_MS / 2)
    p.mandar('abrir')
    vi.advanceTimersByTime(1000)
    expect(p.fase()).toBe('abierto')
  })
})
