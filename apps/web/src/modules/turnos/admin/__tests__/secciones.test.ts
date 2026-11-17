// La tabla rubro → sidebar del panel de Turnos (tarea del 06/11): qué secciones ve cada rubro y
// cada rol, y que ninguna quede vacía con los datos de ejemplo.
import { describe, expect, it } from 'vitest'
import { RUBROS_TURNOS } from '../../datos'
import { rolesDe, TODO } from '../../datos/equipo'
import { origenDemo } from '../../datos/origen/demo'
import { REGLAS_SECCIONES, seccionesVisibles } from '../secciones'

const TODAS = REGLAS_SECCIONES.map(r => r.id)
const dueno = () => 'todo' as const

describe('secciones del panel por rubro', () => {
  it('los 23 rubros: Espacios solo en los de sala o cabina, el resto igual para todos', () => {
    expect(RUBROS_TURNOS).toHaveLength(23)
    for (const r of RUBROS_TURNOS) {
      const esperadas = r.modo === 'recurso' ? TODAS : TODAS.filter(s => s !== 'espacios')
      expect(seccionesVisibles(r.modo, dueno), r.key).toEqual(esperadas)
    }
    expect(RUBROS_TURNOS.filter(r => r.modo === 'recurso').map(r => r.key).sort())
      .toEqual(['clinica', 'depilacion', 'electro', 'estetica', 'spa'])
  })

  it('con los datos de ejemplo, ninguna sección que ve el dueño queda vacía', async () => {
    for (const r of RUBROS_TURNOS) {
      const d = await origenDemo.cargar(r)
      const visibles = seccionesVisibles(r.modo, dueno)
      const semana = d.agenda.semana(r)
      const hoy = d.agenda.delDia(0, d.recursos, semana)
      const lleno: Partial<Record<(typeof TODAS)[number], number>> = {
        agenda: hoy.length,
        clientes: d.clientes.length,
        servicios: d.servicios.length,
        equipo: d.personas.length,
        espacios: d.recursos.length,
        // Ganancias reparte lo facturado entre quienes cobran: tiene que haber al menos uno.
        ganancias: d.personas.filter(p => p.pago).length,
      }
      for (const s of visibles) if (s in lleno) expect(lleno[s], `${r.key} → ${s}`).toBeGreaterThan(0)
    }
  })

  it('cada rol de fábrica ve el Resumen, y nadie ve Espacios en un rubro por profesional', () => {
    for (const r of RUBROS_TURNOS) {
      for (const rol of rolesDe(r)) {
        const visibles = seccionesVisibles(r.modo, id => rol.permisos[id])
        expect(visibles[0], `${r.key} / ${rol.id}`).toBe('resumen')
        if (r.modo === 'profesional') expect(visibles).not.toContain('espacios')
        // Lo que se configura viene junto: o se ve todo el bloque de Reservas y Configuración, o nada.
        const config = visibles.filter(s => ['reglas', 'mensajes', 'pagos', 'configuracion', 'avanzado'].includes(s))
        expect([0, 5]).toContain(config.length)
      }
    }
  })

  it('el dueño es el único rol de fábrica con todas las secciones', () => {
    for (const r of RUBROS_TURNOS) {
      expect(rolesDe(r).find(x => x.id === 'dueno')?.permisos).toEqual(TODO)
      const completos = rolesDe(r).filter(rol => seccionesVisibles(r.modo, id => rol.permisos[id]).length === seccionesVisibles(r.modo, dueno).length)
      expect(completos.map(x => x.id), r.key).toEqual(['dueno'])
    }
  })
})
