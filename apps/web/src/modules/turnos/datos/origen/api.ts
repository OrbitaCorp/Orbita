// El origen de la API de reservas: lo que el panel de un negocio real lee del
// backend compartido (apps/api/src/reservas, módulo TURNOS), con la sesión del
// panel. Las traducciones a los tipos del panel están en mapear.ts.
//
// Qué trae y qué todavía no (detalle en la entrada "mapa-de-turnos-sobre-el-
// backend" de Auditoría):
// - Catálogo: las agendas son los recursos PROFESIONAL (rubros por
//   profesional) o ESPACIO (por sala o cabina), y los servicios, con los
//   pausados (inactivos) incluidos.
// - Agenda: el horario del negocio sale de la config de Turnos y los turnos de
//   las reservas de dos meses para atrás y dos para adelante, lo mismo que mira
//   el panel (Ganancias del mes pasado, historial de cada cliente).
// - Clientes: salen de esas mismas reservas (una persona por ficha, teléfono o
//   email). La API no tiene una lista de clientes de Turnos ni la obra social.
// - Equipo: cada profesional es una persona con el rol de fábrica
//   "Profesional". La API no guarda roles propios de Turnos, ni cómo cobra cada
//   uno, ni quién es el dueño: hasta que se decida dónde viven, el equipo de la
//   API es solo quien atiende.
import { panel } from '@/lib/reservasApi/cliente'
import type { Reserva } from '@/lib/reservasApi/tipos'
import { sumarDias, type ISO } from '@/lib/reservas/fechas'
import type { Cliente, Recurso, RubroTurnos } from '@/modules/turnos/datos'
import type { Semana } from '@/modules/turnos/horario'
import type { ServicioBase } from '@/modules/turnos/datos/agenda'
import { rolesDe, type Persona, type Rol } from '@/modules/turnos/datos/equipo'
import { ahoraArgentina, clientesDeReservas, porDia, recursoDeApi, semanaDeHorario, servicioDeApi, tipoDeAgenda } from './mapear'
import type { DatosPanel, FuenteAgenda, OrigenTurnos } from './index'

/** Cuántos días para cada lado de hoy trae la agenda: los mismos que arma el panel. */
export const VENTANA_DIAS = 62
const POR_PAGINA = 100

/** El horario del negocio, de la config de Turnos. Sin config, el negocio todavía no usa Turnos. */
export async function semanaApi(): Promise<Semana> {
  const config = await panel.config('TURNOS')
  if (!config) throw new Error('Este negocio todavía no tiene Turnos configurado.')
  return semanaDeHorario(config.horario)
}

/** Catálogo: las agendas del modo del rubro (con su horario propio) y todos los servicios. */
export async function catalogoApi(rubro: RubroTurnos, semana: Semana): Promise<{ recursos: Recurso[]; servicios: ServicioBase[] }> {
  const [recursos, servicios] = await Promise.all([panel.recursos('TURNOS'), panel.servicios('TURNOS', true)])
  const tipo = tipoDeAgenda(rubro)
  return {
    recursos: recursos.filter(r => r.tipo === tipo).sort((a, b) => a.orden - b.orden).map((r, i) => recursoDeApi(r, rubro, semana, i)),
    servicios: servicios.sort((a, b) => a.orden - b.orden).map(servicioDeApi),
  }
}

/** Las reservas de Turnos entre dos fechas, todas las páginas. */
export async function reservasEntre(desde: ISO, hasta: ISO): Promise<Reserva[]> {
  const todas: Reserva[] = []
  for (let page = 1; ; page++) {
    const p = await panel.agenda({ modulo: 'TURNOS', desde, hasta, page, limit: POR_PAGINA })
    todas.push(...p.data)
    if (p.data.length < POR_PAGINA || todas.length >= p.total) return todas
  }
}

/** Agenda: las reservas ya traídas, por día. La semana es la de la config (no depende del rubro). */
export function agendaApi(reservas: Reserva[], semana: Semana, hoy: ISO, minutos: number): FuenteAgenda {
  const dias = porDia(reservas, hoy, minutos)
  return { semana: () => semana, delDia: dia => dias.get(dia) ?? [] }
}

/** Clientes: los que reservaron en la ventana de la agenda. */
export const clientesApi = (reservas: Reserva[]): Cliente[] => clientesDeReservas(reservas)

/** Equipo: quien atiende (rubros por profesional), con el rol de fábrica "Profesional". */
export function equipoApi(rubro: RubroTurnos, recursos: Recurso[]): { personas: Persona[]; roles: Rol[] } {
  const personas: Persona[] = rubro.modo !== 'profesional' ? [] : recursos.map(r => ({
    id: `p-${r.id}`, nombre: r.nombre, rolId: 'profesional', email: '', telefono: '', color: r.color, recursoId: r.id,
    // Cómo cobra cada uno no está en la API todavía: null es "lo que factura queda para el negocio".
    pago: null,
  }))
  return { personas, roles: rolesDe(rubro) }
}

export const origenApi: OrigenTurnos = {
  tipo: 'api',
  async cargar(rubro): Promise<DatosPanel> {
    const { hoy, minutos } = ahoraArgentina()
    const semana = await semanaApi()
    const [catalogo, reservas] = await Promise.all([
      catalogoApi(rubro, semana),
      reservasEntre(sumarDias(hoy, -VENTANA_DIAS), sumarDias(hoy, VENTANA_DIAS)),
    ])
    return {
      ...catalogo,
      clientes: clientesApi(reservas),
      ...equipoApi(rubro, catalogo.recursos),
      agenda: agendaApi(reservas, semana, hoy, minutos),
    }
  },
}
