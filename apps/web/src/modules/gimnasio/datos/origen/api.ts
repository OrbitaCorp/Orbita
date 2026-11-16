// El origen de la API de reservas: lo que el panel de un negocio real lee y
// guarda en el backend compartido (módulo GIMNASIO), con la sesión del panel.
// Las traducciones están en mapear.ts; acá, cuándo se lee y qué ruta se llama
// para cada acción.
//
// Lee una ventana de días alrededor de hoy (cinco semanas para atrás, porque
// el % de la grilla mira las últimas cuatro; ocho para adelante, la reserva
// anticipada) y la agranda si el panel mira otra fecha. Después de cada acción
// vuelve a leer: lo que se ve es siempre lo que quedó en la base. También si
// la acción falló (un 409: "No queda lugar en ese horario."), porque lo que se
// veía pudo haber quedado viejo.
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { claveDeIntento, panel, type ClientePanel } from '@/lib/reservasApi/cliente'
import type { Espera, Recurso, Reserva } from '@/lib/reservasApi/tipos'
import { maxFecha, minFecha, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { avisoDeAfectadas, negocioDe, type Inscripcion, type NegocioGym, type RubroGym, type Socio } from '../index'
import { RELOJ_DEMO, useRelojReal } from '../reloj'
import {
  MODULO, bloqueoParaApi, esEspera, esperaDeInscripcion, horarioSinSesion, idDeEspera, inscripcionesDeApi, negocioDeApi, pedidoDeInscripcion,
  planDeBloqueos, planDeGrilla, recursoDeClase, recursoParaClase, sesionesDe, sociosDeApi, type CatalogoApi,
} from './mapear'
import type { AccionesGimnasio, OrigenGimnasio, Resultado, SeccionGimnasio, VistaGimnasio } from './index'

/** Los días que se leen para cada lado de hoy. */
export const ATRAS = 35
export const ADELANTE = 56
/** La API lista hasta 93 días por pedido y 100 reservas por página: lo más largo se pide en tramos. */
const TRAMO_DIAS = 90
const POR_PAGINA = 100

export interface Ventana { desde: ISO; hasta: ISO }

/** Lo que el panel tiene leído de la API. */
export interface DatosApi extends CatalogoApi { reservas: Reserva[]; esperas: Espera[]; ventana: Ventana }

/** Las secciones que guardan en la API (las demás se ven y avisan que todavía no guardan). */
export const SECCIONES_CONECTADAS: readonly SeccionGimnasio[] = ['clases', 'bloqueos']

export const alrededorDe = (hoy: ISO): Ventana => ({ desde: sumarDias(hoy, -ATRAS), hasta: sumarDias(hoy, ADELANTE) })

/** La ventana agrandada para que entre una fecha y su semana (con margen para la tira de días). */
export function conFecha(v: Ventana, fecha: ISO): Ventana {
  return { desde: minFecha(v.desde, sumarDias(fecha, -7)), hasta: maxFecha(v.hasta, sumarDias(fecha, 7)) }
}
const adentro = (v: Ventana, fecha: ISO) => fecha >= sumarDias(v.desde, 7) && fecha <= sumarDias(v.hasta, -7)

type Lector = Pick<ClientePanel, 'config' | 'recursos' | 'bloqueos' | 'agenda' | 'espera'>

/** Las reservas de Gimnasio entre dos días: todos los tramos y todas las páginas. */
export async function reservasEntre(cliente: Pick<ClientePanel, 'agenda'>, v: Ventana): Promise<Reserva[]> {
  const todas: Reserva[] = []
  for (let desde = v.desde; desde <= v.hasta; desde = sumarDias(desde, TRAMO_DIAS)) {
    const hasta = minFecha(sumarDias(desde, TRAMO_DIAS - 1), v.hasta)
    for (let page = 1; ; page++) {
      const p = await cliente.agenda({ modulo: MODULO, desde, hasta, page, limit: POR_PAGINA })
      todas.push(...p.data)
      if (p.data.length < POR_PAGINA || page * POR_PAGINA >= p.total) break
    }
  }
  return todas
}

/**
 * Todo lo que el panel necesita, de una vez. Sin la config de Gimnasio el
 * negocio todavía no usa el módulo: se avisa así. Los días sin clases se
 * traen desde el principio de la ventana en adelante (todos los que vienen,
 * aunque caigan lejos), y la lista de espera, entera.
 */
export async function leerApi(cliente: Lector, v: Ventana): Promise<DatosApi> {
  const config = await cliente.config(MODULO)
  if (!config) throw new Error('Este negocio todavía no tiene Gimnasio configurado.')
  const [recursos, bloqueos, reservas, esperas] = await Promise.all([
    cliente.recursos(MODULO),
    cliente.bloqueos(MODULO, v.desde),
    reservasEntre(cliente, v),
    cliente.espera(MODULO),
  ])
  return { config, recursos, bloqueos, reservas, esperas, ventana: v }
}

// ─── Las acciones ────────────────────────────────────────────────────────────

type Escritor = Pick<ClientePanel, 'crearRecurso' | 'editarRecurso' | 'borrarRecurso' | 'crearBloqueo' | 'borrarBloqueo' | 'crear' | 'completar' | 'ausente' | 'cancelar' | 'anotarEnEspera' | 'darLugar' | 'quitarDeEspera'>

export interface DepsAcciones {
  cliente: Escritor
  /** Los recursos tal como están en la API (para editar el que guarda cada clase). */
  recursos: Recurso[]
  negocio: NegocioGym
  socios: Socio[]
  /** Después de cada acción, salga bien o mal: volver a leer. */
  recargar: () => void
  /** Un uuid por intento de reserva (los tests lo fijan). */
  clave?: () => string
}

const hecho: Resultado = {}
const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre

/**
 * Las acciones del panel traducidas a rutas de /reservas. Van de a una y en
 * orden: si una falla, las que siguen no se mandan y el error sube con el
 * mensaje de la API.
 */
export function accionesApi(d: DepsAcciones): AccionesGimnasio {
  const clave = d.clave ?? claveDeIntento
  const conRecarga = (f: () => Promise<Resultado>): Promise<Resultado> => f().finally(d.recargar)
  const recursos = new Map(d.recursos.map(r => [r.id, r]))
  const recursoDe = (claseId: string) => {
    const r = recursos.get(recursoDeClase(claseId))
    if (!r) throw new Error('Esa clase ya no está en la grilla. Volvé a cargar el panel.')
    return r
  }
  const claseDe = (id: string) => {
    const c = d.negocio.clases.find(x => x.id === id)
    if (!c) throw new Error('Esa clase ya no está en la grilla. Volvé a cargar el panel.')
    return c
  }

  async function guardarGrilla(clases: NegocioGym['clases']) {
    const plan = planDeGrilla(d.negocio.clases, clases)
    for (const c of plan.crear) await d.cliente.crearRecurso(recursoParaClase(c, d.negocio))
    for (const { antes, despues } of plan.editar) {
      const r = recursoDe(antes.id)
      // El recurso actualizado reemplaza al leído: dos clases del mismo recurso en un guardado no se pisan.
      recursos.set(r.id, await d.cliente.editarRecurso(r.id, recursoParaClase(despues, d.negocio, { recurso: r, clase: antes })))
    }
    for (const c of plan.quitar) {
      const r = recursoDe(c.id)
      if (sesionesDe(r.horario).length <= 1) {
        await d.cliente.borrarRecurso(r.id)
        recursos.delete(r.id)
      } else {
        recursos.set(r.id, await d.cliente.editarRecurso(r.id, { modulo: MODULO, tipo: 'CLASE', nombre: r.nombre, horario: horarioSinSesion(r.horario, c) }))
      }
    }
  }

  async function guardarBloqueos(bloqueos: NegocioGym['bloqueos']): Promise<Resultado> {
    const plan = planDeBloqueos(d.negocio.bloqueos, bloqueos)
    let afectadas = 0
    for (const b of plan.crear) afectadas += (await d.cliente.crearBloqueo(bloqueoParaApi(b))).afectadas
    for (const b of plan.quitar) await d.cliente.borrarBloqueo(b.id)
    const detalle = avisoDeAfectadas(afectadas)
    return detalle ? { detalle } : hecho
  }

  return {
    configurar: cambio => conRecarga(async () => {
      // Solo la grilla y los días sin clases guardan en la API: el panel no manda lo demás (ver guarda()).
      const otras = Object.keys(cambio).filter(k => k !== 'clases' && k !== 'bloqueos')
      if (otras.length) throw new Error('Esta sección todavía no guarda en la API.')
      if (cambio.clases) await guardarGrilla(cambio.clases)
      return cambio.bloqueos ? guardarBloqueos(cambio.bloqueos) : hecho
    }),

    inscribir: (i, nuevo) => conRecarga(async () => {
      const c = claseDe(i.claseId)
      const s = nuevo ?? d.socios.find(x => x.id === i.socioId)
      if (!s) throw new Error('No encontramos a esa persona. Volvé a cargar el panel.')
      if (i.estado === 'espera') {
        const e = await d.cliente.anotarEnEspera(esperaDeInscripcion(i, c, s))
        return e.posicion ? { detalle: `Está en el lugar ${e.posicion} de la lista.` } : hecho
      }
      await d.cliente.crear(pedidoDeInscripcion(i, c, s, clave()))
      return hecho
    }),

    cambiarInscripcion: (id, cambio) => conRecarga(async () => {
      if (esEspera(id)) {
        if (cambio.estado !== 'reservada') throw new Error('A quien espera solo se le puede dar el lugar o sacar de la lista.')
        await d.cliente.darLugar(idDeEspera(id))
        return hecho
      }
      if (cambio.estado === 'asistio') await d.cliente.completar(id)
      else if (cambio.estado === 'ausente') await d.cliente.ausente(id)
      else throw new Error('Ese cambio todavía no se guarda en la API.')
      return hecho
    }),

    cancelar: id => conRecarga(async () => {
      if (esEspera(id)) {
        await d.cliente.quitarDeEspera(idDeEspera(id))
        return hecho
      }
      const r = await d.cliente.cancelar(id, { motivo: 'Lugar liberado desde el panel.' })
      return r.promovida ? { detalle: `${primerNombre(r.promovida.clienteNombre)} pasó de la lista de espera y ya tiene su lugar.` } : hecho
    }),

    // Alumnos y planes no viven en la API todavía (decisión del 16/11): el panel no llama a estas.
    agregarSocio: () => conRecarga(async () => { throw new Error('Los alumnos todavía no se guardan en la API.') }),
    cambiarSocio: () => conRecarga(async () => { throw new Error('Los alumnos todavía no se guardan en la API.') }),
  }
}

/** Las mismas acciones, avisando antes de salir (el panel queda ocupado hasta la lectura siguiente). */
export function ocupando(a: AccionesGimnasio, marcar: () => void): AccionesGimnasio {
  return Object.fromEntries(Object.entries(a).map(([nombre, f]) => [nombre, (...args: unknown[]) => { marcar(); return (f as (...x: unknown[]) => Promise<Resultado>)(...args) }])) as unknown as AccionesGimnasio
}

// ─── El hook ─────────────────────────────────────────────────────────────────

/** Cómo se llama el rol de quien mira, en el armazón del panel. */
const ROLES: Record<string, string> = { owner: 'Dueño', admin: 'Administración', empleado: 'Equipo' }

function useVistaApi(rubro: RubroGym): VistaGimnasio {
  const { user } = useAuth()
  const foto = useRelojReal()
  const [pedida, setPedida] = useState<Ventana | null>(null)
  const [estado, setEstado] = useState<{ datos: DatosApi | null; error: string | null }>({ datos: null, error: null })
  const [lectura, setLectura] = useState(0)
  // Desde que sale una acción hasta que llega la lectura que la sigue.
  const [ocupado, setOcupado] = useState(false)
  const recargar = useCallback(() => setLectura(n => n + 1), [])

  const hoy = foto?.reloj.hoy ?? null
  // La ventana: alrededor de hoy (se corre sola a la medianoche), o la que se agrandó para mirar otra fecha.
  const ventana = useMemo(() => pedida ?? (hoy ? alrededorDe(hoy) : null), [pedida, hoy])

  const leer = useEffectEvent((v: Ventana) => leerApi(panel, v))
  useEffect(() => {
    if (!ventana) return
    let vivo = true
    leer(ventana).then(
      datos => { if (vivo) { setEstado({ datos, error: null }); setOcupado(false) } },
      (e: unknown) => { if (vivo) { setEstado(s => ({ datos: s.datos, error: e instanceof Error && e.message ? e.message : 'No pudimos traer los datos del panel.' })); setOcupado(false) } },
    )
    return () => { vivo = false }
  }, [ventana, lectura])

  const base = useMemo(() => {
    const n = negocioDe(rubro)
    return user?.type === 'member' ? { ...n, nombre: user.business.name } : n
  }, [rubro, user])
  const datos = estado.datos
  const negocio = useMemo(() => (datos ? negocioDeApi(base, datos) : base), [base, datos])
  const ms = foto?.ms ?? 0
  const inscripciones = useMemo<Inscripcion[]>(() => (datos ? inscripcionesDeApi(datos.reservas, datos.esperas, negocio.clases, new Date(ms)) : []), [datos, negocio.clases, ms])
  const socios = useMemo(() => (datos ? sociosDeApi(datos.reservas, datos.esperas) : []), [datos])
  const acciones = useMemo(() => ocupando(accionesApi({ cliente: panel, recursos: datos?.recursos ?? [], negocio, socios, recargar }), () => setOcupado(true)), [datos, negocio, socios, recargar])

  return {
    tipo: 'api', negocio, socios, inscripciones,
    // Sin hora todavía (el render de la hidratación) el panel no está listo y no la usa.
    reloj: foto?.reloj ?? RELOJ_DEMO,
    usuario: user?.type === 'member' ? { nombre: user.member.name, rol: ROLES[user.role] ?? user.role } : { nombre: '', rol: '' },
    listo: !!datos && !!foto,
    ocupado,
    error: datos ? null : estado.error,
    reintentar: () => { setEstado(s => ({ ...s, error: null })); recargar() },
    guarda: seccion => SECCIONES_CONECTADAS.includes(seccion),
    puede: { corregirAsistencia: false },
    verFecha: fecha => { if (ventana && !adentro(ventana, fecha)) setPedida(conFecha(ventana, fecha)) },
    acciones,
  }
}

export const origenApi: OrigenGimnasio = { tipo: 'api', useVista: useVistaApi }
