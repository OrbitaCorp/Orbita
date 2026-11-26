// El alta real de Turnos: lo que se cargó en el alta, con la forma en que lo
// recibe la API (wizard.turnos del checkout → OnboardingService.sembrarTurnos).
// El negocio nace por el mismo camino que una tienda (plan y pago, o el código
// del 100%), y con esto arranca con su agenda armada:
//   horario   el del paso "Tu negocio", con los días y la jornada elegidos
//   seña      la del paso de servicios
//   agenda    la del dueño (rubros por profesional) o el primer espacio (por sala)
//   servicios los cargados; si no cargó ninguno, los típicos del rubro
import type { AltaTurnos } from '@/lib/api'
import { recursosDe, type RubroTurnos } from '@/modules/turnos/datos'
import { horarioDeSemana } from '@/modules/turnos/datos/origen/mapear'
import { identidadDe, type DatosAlta, type ServicioAlta } from './modelo'

/** El color de la primera agenda: el mismo con el que el panel pinta la primera. */
const COLOR_PRIMERA = '#3B82F6'

export function altaTurnosDe(d: DatosAlta, rubro: RubroTurnos, servicios: ServicioAlta[], sena: number): AltaTurnos {
  const identidad = identidadDe(d, rubro, servicios, sena)
  const persona = rubro.modo === 'profesional'
  return {
    rubro: rubro.key,
    horario: horarioDeSemana(identidad.horarios),
    senaPorcentaje: Math.round(Math.min(100, Math.max(0, sena))),
    agenda: persona
      ? { tipo: 'PROFESIONAL', nombre: d.nombre.trim() || d.negocio.trim(), rol: rubro.profesional, color: COLOR_PRIMERA }
      : { tipo: 'ESPACIO', nombre: recursosDe(rubro)[0]?.nombre ?? 'Espacio 1', rol: 'Espacio', color: COLOR_PRIMERA },
    servicios: identidad.servicios.slice(0, 30).map(s => ({ nombre: s.nombre, duracionMinutos: s.duracion, precio: s.precio })),
  }
}
