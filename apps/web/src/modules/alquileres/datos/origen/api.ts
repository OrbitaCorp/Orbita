// El origen de la API de reservas: lo que el panel de un negocio real lee del
// backend compartido (apps/api/src/reservas, módulo ALQUILERES), con la sesión
// del panel. Las traducciones a los tipos del panel están en mapear.ts.
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
// Todavía no escribe: lo que se cambia en el panel no llega a la API
// (`soloLectura`). Las escrituras se conectan sección por sección en las
// semanas 2 a 4 del plan.
import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { getBusiness } from '@/lib/api'
import { panel } from '@/lib/reservasApi/cliente'
import type { Reserva as ReservaApi } from '@/lib/reservasApi/tipos'
import { sumarDias, type ISO } from '@/lib/reservas/fechas'
import { NEGOCIOS_DEMO } from '../index'
import { clientesDeReservas, fechaArgentina, negocioDeApi, reservaDeApi, tipoDeRecurso, tipoDeRubro } from './mapear'
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

/** Todo lo que el panel necesita del negocio con sesión. Sin config de Alquileres, el negocio todavía no lo usa. */
export async function cargarApi(hoy: ISO): Promise<Pick<DatosPanelAlquiler, 'tipo' | 'negocio' | 'reservas' | 'clientes'>> {
  const desde = sumarDias(hoy, -DIAS_ATRAS)
  const hasta = sumarDias(hoy, DIAS_ADELANTE)
  const [negocio, config, recursosTodos, servicios, bloqueos, reservasApi] = await Promise.all([
    getBusiness(),
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
  return {
    tipo,
    negocio: negocioDeApi({
      tipo, rubro, config, recursos, servicios, bloqueos,
      negocio: { nombre: negocio.name, slug: negocio.subdomain, descripcion: negocio.description },
    }),
    reservas: delModo.map(r => reservaDeApi(r, tipo)).filter(r => r !== null),
    clientes: clientesDeReservas(delModo),
  }
}

/** Las escrituras de esta semana: no hacen nada y lo dejan dicho en la consola. */
const sinEscribir = (nombre: string) => () => { console.warn(`[alquileres] ${nombre}: el origen de la API todavía no escribe.`) }
const ESCRITURAS: Escrituras = {
  configurar: sinEscribir('configurar'),
  reservar: sinEscribir('reservar'),
  cambiarReserva: sinEscribir('cambiarReserva'),
  agregarBloqueo: sinEscribir('agregarBloqueo'),
  quitarBloqueo: sinEscribir('quitarBloqueo'),
  agregarCalendario: sinEscribir('agregarCalendario'),
  quitarCalendario: sinEscribir('quitarCalendario'),
}

type Carga = Pick<DatosPanelAlquiler, 'tipo' | 'negocio' | 'reservas' | 'clientes'>
/** Mientras llega lo de verdad, el panel muestra su silueta: lo de abajo no se ve, solo le da forma. */
const VACIO: Carga = { tipo: 'cancha', negocio: { ...NEGOCIOS_DEMO.cancha, nombre: '', unidades: [], salones: [], propiedades: [], bloqueos: [], equipo: [] }, reservas: [], clientes: [] }

export const origenApi: OrigenAlquileres = {
  tipo: 'api',
  useDatos() {
    const [estado, setEstado] = useState<{ datos: Carga | null; error: string | null }>({ datos: null, error: null })
    const [intento, setIntento] = useState(0)
    const cargar = useEffectEvent(() => cargarApi(fechaArgentina(new Date().toISOString())))
    useEffect(() => {
      let vivo = true
      cargar().then(
        datos => { if (vivo) setEstado({ datos, error: null }) },
        (e: unknown) => { if (vivo) setEstado({ datos: null, error: e instanceof Error && e.message ? e.message : 'No pudimos traer los datos del panel.' }) },
      )
      return () => { vivo = false }
    }, [intento])
    const reintentar = useCallback(() => { setEstado({ datos: null, error: null }); setIntento(n => n + 1) }, [])
    return { ...(estado.datos ?? VACIO), listo: estado.datos !== null, error: estado.error, reintentar, soloLectura: true, ...ESCRITURAS }
  },
}
