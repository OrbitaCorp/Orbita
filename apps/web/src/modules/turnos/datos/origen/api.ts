// El origen de la API de reservas: lo que el panel de un negocio real lee del
// backend compartido (apps/api/src/reservas, módulo TURNOS), con la sesión del
// panel. Las traducciones a los tipos del panel están en mapear.ts.
//
// Qué trae y qué todavía no (detalle en la entrada "mapa-de-turnos-sobre-el-
// backend" de Auditoría):
// - Catálogo: las agendas son los recursos PROFESIONAL (rubros por
//   profesional) o ESPACIO (por sala o cabina), y los servicios, con los
//   pausados (inactivos) incluidos. Los servicios también se guardan acá
//   (crear, editar, pausar y borrar, 19/11).
// - Agenda: el horario del negocio sale de la config de Turnos y los turnos de
//   las reservas de dos meses para atrás y dos para adelante, lo mismo que mira
//   el panel (Ganancias del mes pasado, historial de cada cliente).
// - Clientes: salen de esas mismas reservas (una persona por ficha, teléfono o
//   email). La API no tiene una lista de clientes de Turnos ni la obra social.
// - Equipo: cada profesional es una persona con el rol de fábrica
//   "Profesional". La API no guarda roles propios de Turnos, ni cómo cobra cada
//   uno, ni quién es el dueño: hasta que se decida dónde viven, el equipo de la
//   API es solo quien atiende.
import { claveDeIntento, panel } from '@/lib/reservasApi/cliente'
import type { Reserva } from '@/lib/reservasApi/tipos'
import { sumarDias, type ISO } from '@/lib/reservas/fechas'
import type { Cliente, Recurso, RubroTurnos } from '@/modules/turnos/datos'
import type { Semana } from '@/modules/turnos/horario'
import type { ServicioBase, TurnoAgenda } from '@/modules/turnos/datos/agenda'
import { rolesDe, type Persona, type Rol } from '@/modules/turnos/datos/equipo'
import {
  ahoraArgentina, bloqueoDeVacaciones, bloqueosDeDia, claveDeDia, claveDeVacaciones, clientesDeReservas, configDeReglas, diasCerradosDeBloqueos, horarioDeSemana,
  enEsperaDeApi, pasosDeHistorial, porDia, recortarHorario, recursoDeApi, turnoDeApi, recursoParaApi, reglasDeConfig, rolIdDeApi, semanaDeHorario, servicioDeApi, servicioParaApi, tipoDeAgenda,
} from './mapear'
import type { DatosPanel, FuenteAgenda, OrigenTurnos } from './index'
import { conCambios, extrasDeDatos, leerDatos } from './datosConfig'

/** Cuántos días para cada lado de hoy trae la agenda: los mismos que arma el panel. */
export const VENTANA_DIAS = 62
const POR_PAGINA = 100

/** El horario del negocio, de la config de Turnos. Sin config, el negocio todavía no usa Turnos. */
export async function semanaApi(): Promise<Semana> {
  return semanaDeHorario((await configApi()).horario)
}

/** La config de Turnos; sin config, el negocio todavía no usa Turnos. */
export async function configApi() {
  const config = await panel.config('TURNOS')
  if (!config) throw new Error('Este negocio todavía no tiene Turnos configurado.')
  return config
}

/** Catálogo: las agendas del modo del rubro (con su horario propio) y todos los servicios. */
export async function catalogoApi(rubro: RubroTurnos, semana: Semana): Promise<{ recursos: Recurso[]; servicios: ServicioBase[]; rolIds: Record<string, string> }> {
  const [recursos, servicios] = await Promise.all([panel.recursos('TURNOS'), panel.servicios('TURNOS', true)])
  const tipo = tipoDeAgenda(rubro)
  const propios = recursos.filter(r => r.tipo === tipo).sort((a, b) => a.orden - b.orden)
  const rolIds: Record<string, string> = {}
  for (const r of propios) {
    const rolId = rolIdDeApi(r)
    if (rolId) rolIds[r.id] = rolId
  }
  return {
    recursos: propios.map((r, i) => recursoDeApi(r, rubro, semana, i)),
    servicios: servicios.sort((a, b) => a.orden - b.orden).map(servicioDeApi),
    rolIds,
  }
}

/**
 * Cuántos días entran en un pedido del listado: la API acepta hasta 93 por vez (MAX_DIAS_LISTADO
 * en reservas.service.ts) y la ventana del panel son 125, así que va en tramos.
 */
export const DIAS_POR_PEDIDO = 90

/** Los tramos de hasta `porTramo` días (desde y hasta incluidos) que cubren el rango. */
export function tramosDeFechas(desde: ISO, hasta: ISO, porTramo = DIAS_POR_PEDIDO): [ISO, ISO][] {
  const tramos: [ISO, ISO][] = []
  for (let d = desde; d <= hasta; d = sumarDias(d, porTramo)) {
    const fin = sumarDias(d, porTramo - 1)
    tramos.push([d, fin < hasta ? fin : hasta])
  }
  return tramos
}

/** Las reservas de Turnos entre dos fechas (incluidas), todas las páginas de cada tramo. */
export async function reservasEntre(desde: ISO, hasta: ISO): Promise<Reserva[]> {
  const porTramo = await Promise.all(tramosDeFechas(desde, hasta).map(async ([d, h]) => {
    const todas: Reserva[] = []
    for (let page = 1; ; page++) {
      const p = await panel.agenda({ modulo: 'TURNOS', desde: d, hasta: h, page, limit: POR_PAGINA })
      todas.push(...p.data)
      if (p.data.length < POR_PAGINA || todas.length >= p.total) return todas
    }
  }))
  return porTramo.flat()
}

/** Agenda: las reservas ya traídas, por día. La semana es la de la config (no depende del rubro). */
export function agendaApi(reservas: Reserva[], semana: Semana, hoy: ISO, minutos: number): FuenteAgenda {
  const dias = porDia(reservas, hoy, minutos)
  return { semana: () => semana, delDia: dia => dias.get(dia) ?? [] }
}

/** Clientes: los que reservaron en la ventana de la agenda. */
export const clientesApi = (reservas: Reserva[]): Cliente[] => clientesDeReservas(reservas)

/**
 * Equipo: el que el panel guardó en `datos` de la config (personas, roles y cómo cobra cada
 * uno), con sus agendas al día: quien apunta a una agenda que ya no está la pierde, y una
 * agenda sin persona (creada antes, o desde otro lado) suma a quien atiende ahí, con el rol
 * guardado en la agenda (si es uno de los de fábrica del rubro) o "Profesional".
 */
export function equipoApi(rubro: RubroTurnos, recursos: Recurso[], rolIds: Record<string, string> = {}, guardado?: { personas: Persona[]; roles: Rol[] }): { personas: Persona[]; roles: Rol[] } {
  const roles = guardado?.roles.length ? guardado.roles : rolesDe(rubro)
  const ids = new Set(recursos.map(r => r.id))
  const conocidas = (guardado?.personas ?? []).map(p => (p.recursoId && !ids.has(p.recursoId) ? { ...p, recursoId: undefined } : p))
  const conAgenda = new Set(conocidas.map(p => p.recursoId).filter(Boolean))
  const nuevas: Persona[] = rubro.modo !== 'profesional' ? [] : recursos.filter(r => !conAgenda.has(r.id)).map(r => ({
    id: `p-${r.id}`, nombre: r.nombre, rolId: roles.some(x => x.id === rolIds[r.id]) ? rolIds[r.id] : 'profesional', email: '', telefono: '', color: r.color, recursoId: r.id,
    // Cómo cobra cada uno no está en la API todavía: null es "lo que factura queda para el negocio".
    pago: null,
  }))
  return { personas: [...conocidas, ...nuevas], roles }
}

/** Una reserva como turno del panel, con el "ahora" real. Una vencida no debería volver de una acción. */
function aTurno(r: Reserva): TurnoAgenda {
  const { hoy, minutos } = ahoraArgentina()
  const t = turnoDeApi(r, hoy, minutos)
  if (!t) throw new Error('El turno venció antes de que se guardara. Volvé a darlo.')
  return t
}

export const origenApi: OrigenTurnos = {
  tipo: 'api',
  async cargar(rubro): Promise<DatosPanel> {
    const { hoy, minutos } = ahoraArgentina()
    const config = await configApi()
    const semana = semanaDeHorario(config.horario)
    const [catalogo, reservas] = await Promise.all([
      catalogoApi(rubro, semana),
      reservasEntre(sumarDias(hoy, -VENTANA_DIAS), sumarDias(hoy, VENTANA_DIAS)),
    ])
    return {
      recursos: catalogo.recursos,
      servicios: catalogo.servicios,
      clientes: clientesApi(reservas),
      ...equipoApi(rubro, catalogo.recursos, catalogo.rolIds, leerDatos(config.datos).turnos.equipo),
      agenda: agendaApi(reservas, semana, hoy, minutos),
      reloj: { hoy, minutos },
      senaPct: config.senaPorcentaje,
    }
  },
  // /reservas/servicios (exige el permiso reservas.config). Borrar es una baja: las reservas ya
  // dadas conservan la foto del servicio. La API rechaza un nombre repetido con su mensaje.
  servicios: {
    crear: async (s, orden) => servicioDeApi(await panel.crearServicio({ ...servicioParaApi(s), orden })),
    editar: async s => servicioDeApi(await panel.editarServicio(s.id, servicioParaApi(s))),
    borrar: async id => { await panel.borrarServicio(id) },
  },
  // /reservas/recursos: PROFESIONAL o ESPACIO según el rubro. Editar no manda `orden` ni
  // `memberId`, así quedan como estaban. Borrar es una baja que la API rechaza si hay reservas por delante.
  agendas: {
    async crear(r, { rubro, semana, rolId, orden }) {
      // Una agenda nueva arranca con la grilla del negocio (Reglas de reserva).
      const grilla = leerDatos((await configApi()).datos).turnos.grilla
      return recursoDeApi(await panel.crearRecurso({ ...recursoParaApi(r, rubro, semana, rolId), orden, ...(grilla ? { pasoMinutos: grilla } : {}) }), rubro, semana, orden)
    },
    editar: async (r, { rubro, semana, rolId }) =>
      recursoDeApi(await panel.editarRecurso(r.id, recursoParaApi(r, rubro, semana, rolId)), rubro, semana, 0),
    borrar: async id => { await panel.borrarRecurso(id) },
  },
  horarios: {
    async guardarSemana(semana, rubro) {
      // Solo la config: la API cruza el horario propio de cada agenda con este al dar
      // disponibilidad, así que nadie se reescribe. Se avisa quién se queda sin días.
      const negocio = horarioDeSemana(semana)
      await panel.guardarConfig({ modulo: 'TURNOS', horario: negocio })
      const tipo = tipoDeAgenda(rubro)
      const propias = (await panel.recursos('TURNOS')).filter(r => r.tipo === tipo)
      const sinDias = propias.filter(r => r.horario && !Object.keys(recortarHorario(r.horario, negocio)).length).map(r => r.nombre)
      const { recursos } = await catalogoApi(rubro, semana)
      return { semana, recursos, sinDias }
    },
    diasCerrados: async () => diasCerradosDeBloqueos(await panel.bloqueos('TURNOS', ahoraArgentina().hoy)),
    async guardarDiasCerrados(antes, despues) {
      const nuevas = new Set(despues.especiales.map(claveDeDia))
      const viejas = new Set(antes.especiales.map(claveDeDia))
      const cambiaVac = claveDeVacaciones(antes) !== claveDeVacaciones(despues)
      const aCrear = [
        ...despues.especiales.filter(e => !viejas.has(claveDeDia(e))).flatMap(bloqueosDeDia),
        ...(cambiaVac && despues.vacaciones ? [bloqueoDeVacaciones(despues)] : []),
      ]
      const aBorrar = [
        ...antes.especiales.filter(e => !nuevas.has(claveDeDia(e))).flatMap(e => e.bloqueos ?? []),
        ...(cambiaVac && antes.vacBloqueo ? [antes.vacBloqueo] : []),
      ]
      // Primero lo nuevo: si algo falla en el medio, sobra un cierre en lugar de quedar abierto un feriado.
      let hayTurnos = false
      for (const b of aCrear) {
        if ((await panel.crearBloqueo(b)).afectadas > 0) hayTurnos = true
      }
      for (const id of aBorrar) await panel.borrarBloqueo(id)
      return { hayTurnos }
    },
  },
  reglas: {
    async leer(rubro) {
      const config = await configApi()
      return { reglas: reglasDeConfig(config, rubro.sena), extras: extrasDeDatos(config.datos) }
    },
    async guardar(reglas, extras, rubro) {
      // `datos` se reemplaza entero: se arma desde lo último guardado, cambiando solo lo de Reglas.
      const config = await configApi()
      const { grilla, ...publico } = extras
      await panel.guardarConfig({ ...configDeReglas(reglas), datos: conCambios(config.datos, { publico, turnos: { grilla } }) })
      // La grilla la aplica el motor como el paso de cada agenda.
      if (leerDatos(config.datos).turnos.grilla !== grilla) {
        const tipo = tipoDeAgenda(rubro)
        const agendas = (await panel.recursos('TURNOS')).filter(r => r.tipo === tipo && r.pasoMinutos !== grilla)
        await Promise.all(agendas.map(r => panel.editarRecurso(r.id, { modulo: 'TURNOS', tipo: r.tipo, nombre: r.nombre, pasoMinutos: grilla })))
      }
    },
  },
  turnos: {
    async crear(t, cliente, servicioId) {
      const { hoy } = ahoraArgentina()
      // Alguien que ya tiene ficha va por su id; el resto, con sus datos (la API arma o encuentra la ficha).
      const conFicha = cliente.id && !/^(tel|mail|reserva):/.test(cliente.id)
      const r = await panel.crear({
        modulo: 'TURNOS', recursoId: t.recursoId, servicioId, fecha: sumarDias(hoy, t.dia ?? 0), inicioMinutos: t.inicio,
        estado: t.estado === 'pendiente' ? 'PENDIENTE' : 'CONFIRMADA', clave: claveDeIntento(),
        ...(conFicha ? { clienteId: cliente.id } : { cliente: { nombre: cliente.nombre, ...(cliente.telefono ? { telefono: cliente.telefono } : {}), ...(cliente.email ? { email: cliente.email } : {}) } }),
        ...(t.nota ? { notaInterna: t.nota } : {}),
      })
      return aTurno(r)
    },
    async estado(id, estado) {
      if (estado === 'cancelado') {
        // Cancelar devuelve qué pasó con la seña y a quién se le dio el lugar, no la reserva: se vuelve a leer.
        const { promovida } = await panel.cancelar(id)
        return { turno: aTurno(await panel.detalle(id)), ...(promovida ? { promovido: aTurno(promovida) } : {}) }
      }
      const r = estado === 'confirmado' ? await panel.confirmar(id)
        : estado === 'completado' ? await panel.completar(id)
          : estado === 'ausente' ? await panel.ausente(id)
            : null
      if (!r) throw new Error('Ese cambio no se hace a mano.')
      return { turno: aTurno(r) }
    },
    async mover(id, dia, inicio, recursoId) {
      const { hoy } = ahoraArgentina()
      return aTurno(await panel.reprogramar(id, { fecha: sumarDias(hoy, dia), inicioMinutos: inicio, ...(recursoId ? { recursoId } : {}) }))
    },
    async sena(id) {
      const r = await panel.detalle(id)
      const falta = Math.max(0, r.sena - r.pagado)
      return aTurno(falta > 0 ? await panel.pago(id, { monto: falta, metodo: 'OTRO', referencia: 'Seña registrada desde el panel' }) : r)
    },
    historial: async id => pasosDeHistorial((await panel.detalle(id)).historial),
    async espera() {
      const { hoy } = ahoraArgentina()
      return (await panel.espera('TURNOS')).filter(e => e.estado === 'ESPERANDO').map(e => enEsperaDeApi(e, hoy))
    },
    darLugar: async id => aTurno(await panel.darLugar(id)),
    quitarDeEspera: async id => { await panel.quitarDeEspera(id) },
  },
  equipo: {
    async guardar(personas, roles) {
      const config = await configApi()
      await panel.guardarConfig({ modulo: 'TURNOS', datos: conCambios(config.datos, { turnos: { equipo: { personas, roles } } }) })
    },
  },
}
