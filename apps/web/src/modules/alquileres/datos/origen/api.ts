// El origen de la API de reservas: lo que el panel de un negocio real lee del
// backend compartido (apps/api/src/reservas, módulo ALQUILERES), con la sesión
// del panel. Las traducciones a los tipos del panel están en mapear.ts y las
// del panel a la API, en escribir.ts.
//
// Qué trae (detalle en docs/superpowers/specs/2026-11-18-alquileres-sobre-el-backend-design.md, § 5):
// - El negocio: nombre y subdominio de /business; el modo sale del primer
//   subrubro de Alquileres (industry "alquileres", subrubros ["cabana"]).
// - Lo que se alquila: los recursos del modo (CANCHA, SALON o ALOJAMIENTO),
//   y en salones los servicios limitados a cada uno como paquetes.
// - Las reservas de medio año para atrás (Ingresos compara tres meses contra
//   los tres anteriores) y medio año para adelante (el calendario de la
//   estadía), en tramos de 90 días: la API acepta hasta 93 por pedido.
// - Los bloqueos de ese mismo rango y los clientes, que salen de las reservas.
//
// Escribe lo de la estadía por noche (escriturasDe): propiedades, reglas y
// seña, reservas a mano, pagos, cambios de estado y bloqueos. Cada escritura
// le pide a la API y vuelve a cargar, así el panel muestra siempre lo que
// quedó guardado. Canchas y salones todavía no escriben.
import { useCallback, useEffect, useEffectEvent, useState } from 'react'
// panelGetBusiness y no getBusiness: getBusiness manda el token del alta (onboarding), no el de la sesión del panel.
import { panelGetBusiness } from '@/lib/api'
import { panel } from '@/lib/reservasApi/cliente'
import type { Reserva as ReservaApi } from '@/lib/reservasApi/tipos'
import { sumarDias, type ISO } from '@/lib/reservas/fechas'
import { NEGOCIOS_DEMO, type Propiedad } from '../index'
import { clientesDeReservas, fechaArgentina, negocioDeApi, reservaDeApi, tipoDeRecurso, tipoDeRubro } from './mapear'
import { bloqueoParaApi, cambiosDePropiedades, configDeCambio, idDeBloqueo, pasosDeCambio, pedidoDeReserva, recursoDePropiedad } from './escribir'
import type { DatosPanelAlquiler, Escrituras, OrigenAlquileres } from './index'

/** Cuántos días para cada lado de hoy trae el panel. */
export const DIAS_ATRAS = 186
export const DIAS_ADELANTE = 186
/** Cuántos días entran en un pedido del listado: la API acepta hasta 93 (MAX_DIAS_LISTADO en reservas.service.ts). */
export const DIAS_POR_PEDIDO = 90
const POR_PAGINA = 100

/** Los tramos de hasta `porTramo` días (desde y hasta incluidos) que cubren el rango. Igual que en Turnos. */
export function tramosDeFechas(desde: ISO, hasta: ISO, porTramo = DIAS_POR_PEDIDO): [ISO, ISO][] {
  const tramos: [ISO, ISO][] = []
  for (let d = desde; d <= hasta; d = sumarDias(d, porTramo)) {
    const fin = sumarDias(d, porTramo - 1)
    tramos.push([d, fin < hasta ? fin : hasta])
  }
  return tramos
}

/**
 * Las reservas de Alquileres entre dos fechas (incluidas), todas las páginas
 * de cada tramo. De a un pedido por vez, no en paralelo: la API limita a 60
 * pedidos por minuto por IP, y un complejo de canchas con mucho movimiento
 * son varias páginas por tramo.
 */
export async function reservasEntre(desde: ISO, hasta: ISO): Promise<ReservaApi[]> {
  const todas: ReservaApi[] = []
  for (const [d, h] of tramosDeFechas(desde, hasta)) {
    let delTramo = 0
    for (let page = 1; ; page++) {
      const p = await panel.agenda({ modulo: 'ALQUILERES', desde: d, hasta: h, page, limit: POR_PAGINA })
      todas.push(...p.data)
      delTramo += p.data.length
      if (p.data.length < POR_PAGINA || delTramo >= p.total) break
    }
  }
  return todas
}

/** Lo que trae una carga: lo que el panel dibuja y, para escribir, las reservas tal como las tiene la API. */
export type CargaApi = Pick<DatosPanelAlquiler, 'tipo' | 'negocio' | 'reservas' | 'clientes'> & { reservasApi: ReservaApi[] }

/**
 * Por ahora el servidor cobra un precio fijo por noche. Hasta que calcule
 * temporadas, fin de semana y limpieza (etapa 3 del plan), el panel no las
 * aplica aunque estén guardadas: así el total que muestra es el que se cobra.
 */
const soloPrecioBase = (p: Propiedad): Propiedad => ({ ...p, modalidad: 'noche', tarifa: { ...p.tarifa, temporadas: [], finDeSemanaPct: 0, limpieza: 0 } })

/** Todo lo que el panel necesita del negocio con sesión. Sin config de Alquileres, el negocio todavía no lo usa. */
export async function cargarApi(hoy: ISO): Promise<CargaApi> {
  const desde = sumarDias(hoy, -DIAS_ATRAS)
  const hasta = sumarDias(hoy, DIAS_ADELANTE)
  const [negocio, config, recursosTodos, servicios, bloqueos, reservasApi] = await Promise.all([
    panelGetBusiness(),
    panel.config('ALQUILERES'),
    // Con los desactivados: sus reservas (las pasadas y las que siguen en pie) no desaparecen del panel.
    panel.recursos('ALQUILERES', true),
    panel.servicios('ALQUILERES'),
    panel.bloqueos('ALQUILERES', desde, hasta),
    reservasEntre(desde, hasta),
  ])
  if (!config) throw new Error('Este negocio todavía no tiene Alquileres configurado.')
  const { tipo, rubro } = tipoDeRubro(negocio.subrubros)
  // Lo que se alquila hoy: solo los activos del modo.
  const recursos = recursosTodos.filter(r => r.activo && r.tipo === tipoDeRecurso(tipo))
  const porId = new Map(recursosTodos.map(r => [r.id, r]))
  // Las reservas del modo, también las de un recurso desactivado o borrado (que ya no viene en la lista).
  const delModo = reservasApi.filter(r => { const rec = porId.get(r.recursoId); return !rec || rec.tipo === tipoDeRecurso(tipo) })
  const armado = negocioDeApi({
    tipo, rubro, config, recursos, servicios, bloqueos,
    negocio: { nombre: negocio.name, slug: negocio.subdomain, descripcion: negocio.description },
  })
  return {
    tipo,
    negocio: { ...armado, propiedades: armado.propiedades.map(soloPrecioBase) },
    reservas: delModo.map(r => reservaDeApi(r, tipo)).filter(r => r !== null),
    clientes: clientesDeReservas(delModo),
    reservasApi: delModo,
  }
}

const SOLO_ESTADIA = 'Por ahora el panel guarda solo alojamientos por noche.'
const NO_SE_GUARDA = 'Esto todavía no se guarda en el panel.'
/** El medio de pago no se pregunta todavía en la ficha: queda como "otro" hasta que se sume. */
const METODO = 'OTRO' as const

/**
 * Las escrituras del panel sobre la API, para lo ya cargado en `d`. Cada una
 * termina recargando. Si la API rechaza algo, la promesa falla con su mensaje
 * (en castellano, listo para mostrar) y no se recarga.
 */
export function escriturasDe(d: CargaApi, recargar: () => Promise<void>): Escrituras {
  const estadia = () => { if (d.tipo !== 'estadia') throw new Error(SOLO_ESTADIA) }
  return {
    configurar: async (_tipo, cambio) => {
      estadia()
      let hizoAlgo = false
      const nuevas = cambio.propiedades
      if (nuevas) {
        const c = cambiosDePropiedades(d.negocio.propiedades, nuevas)
        const orden = (id: string) => nuevas.findIndex(p => p.id === id)
        for (const p of c.crear) await panel.crearRecurso(recursoDePropiedad(p, orden(p.id)))
        for (const p of c.editar) await panel.editarRecurso(p.id, recursoDePropiedad(p, orden(p.id)))
        for (const id of c.borrar) await panel.borrarRecurso(id)
        hizoAlgo = true
      }
      const config = configDeCambio(cambio)
      if (config) { await panel.guardarConfig(config); hizoAlgo = true }
      if (!hizoAlgo) throw new Error(NO_SE_GUARDA)
      await recargar()
    },
    reservar: async (_tipo, r, cliente) => {
      estadia()
      if (!cliente) throw new Error('Elegí a quién es la reserva.')
      const creada = await panel.crear(pedidoDeReserva(r, cliente))
      // "Ya pagó la seña": la seña la calcula el servidor; se anota esa.
      if (r.senaPagada && creada.sena > 0) await panel.pago(creada.id, { monto: creada.sena, metodo: METODO })
      await recargar()
    },
    cambiarReserva: async (id, cambio) => {
      const actual = d.reservasApi.find(x => x.id === id)
      if (!actual) throw new Error('Esa reserva ya no está. Recargá la página.')
      for (const paso of pasosDeCambio(actual, cambio)) {
        if (paso.tipo === 'pago') await panel.pago(id, { monto: paso.monto, metodo: METODO })
        else if (paso.tipo === 'confirmar') await panel.confirmar(id)
        else if (paso.tipo === 'completar') await panel.completar(id)
        else await panel.cancelar(id)
      }
      await recargar()
    },
    agregarBloqueo: async (_tipo, b) => {
      estadia()
      await panel.crearBloqueo(bloqueoParaApi(b, d.negocio.propiedades.find(p => p.id === b.unidadId)))
      await recargar()
    },
    quitarBloqueo: async (_tipo, id) => {
      await panel.borrarBloqueo(idDeBloqueo(id))
      await recargar()
    },
    // Los calendarios externos de verdad (Airbnb) son la etapa 4: la sección no se muestra en el panel real.
    agregarCalendario: async () => { throw new Error(NO_SE_GUARDA) },
    quitarCalendario: async () => { throw new Error(NO_SE_GUARDA) },
  }
}

/** Mientras llega lo de verdad, el panel muestra su silueta: lo de abajo no se ve, solo le da forma. */
const VACIO: CargaApi = { tipo: 'cancha', negocio: { ...NEGOCIOS_DEMO.cancha, nombre: '', unidades: [], salones: [], propiedades: [], bloqueos: [], equipo: [] }, reservas: [], clientes: [], reservasApi: [] }

const hoyReal = () => fechaArgentina(new Date().toISOString())
const mensajeDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'No pudimos traer los datos del panel.')

export const origenApi: OrigenAlquileres = {
  tipo: 'api',
  useDatos() {
    const [estado, setEstado] = useState<{ datos: CargaApi | null; error: string | null }>({ datos: null, error: null })
    const [intento, setIntento] = useState(0)
    const cargar = useEffectEvent(() => cargarApi(hoyReal()))
    useEffect(() => {
      let vivo = true
      cargar().then(
        datos => { if (vivo) setEstado({ datos, error: null }) },
        (e: unknown) => { if (vivo) setEstado({ datos: null, error: mensajeDe(e) }) },
      )
      return () => { vivo = false }
    }, [intento])
    const reintentar = useCallback(() => { setEstado({ datos: null, error: null }); setIntento(n => n + 1) }, [])
    // Después de escribir: se trae todo de nuevo sin pasar por la silueta (lo que hay sigue a la vista).
    const [version, setVersion] = useState(0)
    const recargar = useCallback(async () => { const datos = await cargarApi(hoyReal()); setEstado({ datos, error: null }); setVersion(v => v + 1) }, [])
    const datos = estado.datos ?? VACIO
    return {
      tipo: datos.tipo, negocio: datos.negocio, reservas: datos.reservas, clientes: datos.clientes,
      listo: estado.datos !== null, error: estado.error, reintentar, soloLectura: false, version,
      ...escriturasDe(datos, recargar),
    }
  },
}
