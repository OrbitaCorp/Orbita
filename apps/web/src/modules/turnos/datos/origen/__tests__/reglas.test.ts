// Las reglas de reserva de Turnos sobre la config de la API (tarea del 13/11).
import { describe, expect, it } from 'vitest'
import type { Config } from '@/lib/reservasApi/tipos'
import { configDeReglas, reglasDeConfig } from '../mapear'

const config: Config = {
  modulo: 'TURNOS', activo: true, confirmacion: 'MANUAL', retencionMinutos: 10, anticipacionMinimaMinutos: 120, anticipacionMaximaDias: 30,
  cancelacionHastaHoras: 12, reprogramacionHastaHoras: 6, reprogramacionesMaximas: 3, senaPorcentaje: 40, senaReembolsable: true,
  maximoActivasPorCliente: 2, listaDeEspera: false, margenMinutos: 10, horario: { 1: [[540, 780]] },
}

describe('reglas de reserva y config', () => {
  it('traduce la config a la pantalla y vuelve igual, sin tocar el horario', () => {
    const r = reglasDeConfig(config, 20)
    expect(r).toEqual({ minAnt: 120, maxAnt: 30, buffer: 10, confirmacion: 'manual', sena: true, senaPct: 40, reprogramar: true, reproHoras: 6, reproMax: 3, limite: 2, espera: false, cancelaHasta: 12 })
    const g = configDeReglas(r)
    expect(g).toMatchObject({ modulo: 'TURNOS', confirmacion: 'MANUAL', anticipacionMinimaMinutos: 120, anticipacionMaximaDias: 30, margenMinutos: 10, senaPorcentaje: 40, reprogramacionHastaHoras: 6, reprogramacionesMaximas: 3, maximoActivasPorCliente: 2, listaDeEspera: false, cancelacionHastaHoras: 12 })
    expect(g).not.toHaveProperty('horario')
  })

  it('sin seña es 0%, y al prenderla propone la del rubro', () => {
    const r = reglasDeConfig({ ...config, senaPorcentaje: 0 }, 25)
    expect(r).toMatchObject({ sena: false, senaPct: 25 })
    expect(configDeReglas(r).senaPorcentaje).toBe(0)
    expect(configDeReglas({ ...r, sena: true }).senaPorcentaje).toBe(25)
    expect(reglasDeConfig({ ...config, senaPorcentaje: 0 }, 0).senaPct).toBe(30)
  })

  it('sin reprogramar son 0 veces, y al prenderlo propone 2', () => {
    const r = reglasDeConfig({ ...config, reprogramacionesMaximas: 0 }, 0)
    expect(r).toMatchObject({ reprogramar: false, reproMax: 2 })
    expect(configDeReglas(r).reprogramacionesMaximas).toBe(0)
    expect(configDeReglas({ ...r, reprogramar: true }).reprogramacionesMaximas).toBe(2)
  })
})
