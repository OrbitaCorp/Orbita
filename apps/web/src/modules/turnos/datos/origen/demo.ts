// El origen de la demo (/turnos-demo): los mismos datos de ejemplo que el panel
// usaba directo, ahora detrás de una función por sección. Nada viaja a la red:
// todo sale de datos/ y del navegador. La espera que se ve en la demo la pone
// el panel (useCargaSimulada), no este origen.
import { clientesDe, recursosDe, semanaDe, type Cliente, type Recurso, type RubroTurnos } from '@/modules/turnos/datos'
import { turnosDelDia, type ServicioBase } from '@/modules/turnos/datos/agenda'
import { personasDe, rolesDe, type Persona, type Rol } from '@/modules/turnos/datos/equipo'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { subdominioDe } from '@/modules/turnos/admin/configuracion/datos'
import type { DatosPanel, FuenteAgenda, OrigenTurnos } from './index'

/** Catálogo: las agendas del rubro, con el rol de cada persona debajo de su nombre, y sus servicios. */
export function catalogoDemo(rubro: RubroTurnos): { recursos: Recurso[]; servicios: ServicioBase[] } {
  const base = recursosDe(rubro)
  const servicios = rubro.servicios.map((s, i) => ({ ...s, id: `s${i + 1}`, online: i !== 3 }))
  if (rubro.modo !== 'profesional') return { recursos: base, servicios }
  // Cada agenda es de una persona: debajo del nombre va su rol (Aprendiz, Colorista…).
  const equipo = personasDe(rubro, base, '')
  const deFabrica = rolesDe(rubro)
  const recursos = base.map(r => {
    const rol = deFabrica.find(x => x.id === equipo.find(p => p.recursoId === r.id)?.rolId)
    return rol && !rol.fijo ? { ...r, rol: rol.nombre } : r
  })
  return { recursos, servicios }
}

/** Clientes (o pacientes, con su obra social) de ejemplo. */
export const clientesDemo = (rubro: RubroTurnos): Cliente[] => clientesDe(rubro)

/** Equipo: las personas de ejemplo, con mails del dominio del negocio, y los roles de fábrica del rubro. */
export function equipoDemo(rubro: RubroTurnos): { personas: Persona[]; roles: Rol[] } {
  return { personas: personasDe(rubro, recursosDe(rubro), `${subdominioDe(temaDe(rubro).nombre)}.com.ar`), roles: rolesDe(rubro) }
}

/** Agenda: los turnos de ejemplo se arman para cada día con las agendas como están en ese momento. */
export const agendaDemo = (rubro: RubroTurnos): FuenteAgenda => ({
  semana: r => semanaDe(r),
  delDia: (dia, recursos, semana) => turnosDelDia(rubro, recursos, semana, dia),
})

export const origenDemo: OrigenTurnos = {
  tipo: 'demo',
  cargar: async (rubro): Promise<DatosPanel> => ({
    ...catalogoDemo(rubro),
    clientes: clientesDemo(rubro),
    ...equipoDemo(rubro),
    agenda: agendaDemo(rubro),
  }),
}
