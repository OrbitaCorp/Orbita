// Lo que el dueño cargó o cambió en la demo de Alquileres, guardado en el
// navegador: el alta, la configuración (unidades, paquetes, propiedades,
// reglas, calendarios externos), las reservas que se hicieron desde el sitio y
// lo que el panel les cambió (estado, pagos). Sin backend, este archivo es el
// hilo que une el sitio, la reserva, "Mis reservas" y el panel.
//
// Vive en localStorage (no en sessionStorage) para que también lo vean los
// links que se abren en otra pestaña. La tira de la demo deja borrarlo.
//
// Mismo esquema que el resto de las demos (useSyncExternalStore): el servidor
// y el primer pintado ven los valores de fábrica, y recién después aparece lo
// guardado, así no hay diferencias de hidratación.
import { useSyncExternalStore } from 'react'
import { NEGOCIOS_DEMO, reservasDe, CLIENTES, type Bloqueo, type CalendarioExterno, type Cliente, type NegocioAlquiler, type Reserva, type TipoAlquiler } from './index'

export interface DemoAlquiler {
  /** Lo que cambió el dueño de cada negocio de ejemplo (alta o Configuración). */
  negocios: Partial<Record<TipoAlquiler, Partial<NegocioAlquiler>>>
  /** Reservas hechas en la demo (desde el sitio o desde el panel), por modo. */
  reservas: Partial<Record<TipoAlquiler, Reserva[]>>
  /** Cambios sobre reservas de ejemplo (estado, pagos), por id. */
  cambios: Record<string, Partial<Reserva>>
  /** Clientes nuevos que llegaron con una reserva. */
  clientes: Cliente[]
  /** Si el alta de la demo se hizo, con qué modo. */
  alta: TipoAlquiler | null
}

const INICIAL: DemoAlquiler = { negocios: {}, reservas: {}, cambios: {}, clientes: [], alta: null }
const CLAVE = 'orbita_alquileres_demo'

let cache: DemoAlquiler = INICIAL
let leido = false
const oyentes = new Set<() => void>()

function leer(): DemoAlquiler {
  if (leido) return cache
  leido = true
  try {
    const crudo = window.localStorage.getItem(CLAVE)
    if (crudo) cache = { ...INICIAL, ...(JSON.parse(crudo) as Partial<DemoAlquiler>) }
  } catch { /* sin almacenamiento o JSON roto: se arranca de cero */ }
  return cache
}

function escribir(n: DemoAlquiler) {
  cache = n
  leido = true
  try {
    if (n === INICIAL) window.localStorage.removeItem(CLAVE)
    else window.localStorage.setItem(CLAVE, JSON.stringify(n))
  } catch { /* cuota llena: queda en memoria */ }
  oyentes.forEach(f => f())
}

function suscribir(f: () => void) {
  oyentes.add(f)
  const alCambiar = (e: StorageEvent) => { if (e.key === CLAVE) { leido = false; leer(); f() } }
  window.addEventListener('storage', alCambiar)
  return () => { oyentes.delete(f); window.removeEventListener('storage', alCambiar) }
}

/** El negocio de un modo, con lo que el dueño cambió encima del de ejemplo. */
export const negocioDe = (demo: DemoAlquiler, tipo: TipoAlquiler): NegocioAlquiler => ({ ...NEGOCIOS_DEMO[tipo], ...demo.negocios[tipo] })

/** Todas las reservas de un modo: las de ejemplo con sus cambios, más las hechas en la demo. */
export function reservasDelDemo(demo: DemoAlquiler, tipo: TipoAlquiler): Reserva[] {
  const n = negocioDe(demo, tipo)
  const base = reservasDe(NEGOCIOS_DEMO[tipo]).filter(r => unidadExiste(n, r.unidadId))
  return [...base, ...(demo.reservas[tipo] ?? [])].map(r => (demo.cambios[r.id] ? { ...r, ...demo.cambios[r.id] } : r))
}

const unidadExiste = (n: NegocioAlquiler, id: string) =>
  n.tipo === 'bloque' ? id === 'salon' : n.tipo === 'cancha' ? n.unidades.some(u => u.id === id) : n.propiedades.some(p => p.id === id)

export const clientesDelDemo = (demo: DemoAlquiler): Cliente[] => [...CLIENTES, ...demo.clientes]

/** Si un bloqueo vino de ese calendario externo (los guardados antes de `calendarioId` se reconocen por el id). */
export const deCalendario = (b: Bloqueo, calendarioId: string) => b.calendarioId === calendarioId || b.id.startsWith(`${calendarioId}-`)

export function useDemoAlquiler() {
  const demo = useSyncExternalStore(suscribir, leer, () => INICIAL)
  const guardar = (cambio: Partial<DemoAlquiler>) => escribir({ ...leer(), ...cambio })
  return {
    demo,
    guardar,
    reiniciar: () => escribir(INICIAL),
    /** Cambia la configuración de un negocio de ejemplo. */
    configurar: (tipo: TipoAlquiler, cambio: Partial<NegocioAlquiler>) => {
      const d = leer()
      escribir({ ...d, negocios: { ...d.negocios, [tipo]: { ...d.negocios[tipo], ...cambio } } })
    },
    /** Una reserva nueva, con su cliente si es nuevo. */
    reservar: (tipo: TipoAlquiler, r: Reserva, cliente?: Cliente) => {
      const d = leer()
      escribir({
        ...d,
        reservas: { ...d.reservas, [tipo]: [...(d.reservas[tipo] ?? []), r] },
        clientes: cliente && !d.clientes.some(c => c.id === cliente.id) ? [...d.clientes, cliente] : d.clientes,
      })
    },
    /** Un cambio sobre una reserva (cualquiera, de ejemplo o nueva). */
    cambiarReserva: (id: string, cambio: Partial<Reserva>) => {
      const d = leer()
      escribir({ ...d, cambios: { ...d.cambios, [id]: { ...d.cambios[id], ...cambio } } })
    },
    agregarBloqueo: (tipo: TipoAlquiler, b: Bloqueo) => {
      const d = leer()
      const n = negocioDe(d, tipo)
      escribir({ ...d, negocios: { ...d.negocios, [tipo]: { ...d.negocios[tipo], bloqueos: [...n.bloqueos, b] } } })
    },
    quitarBloqueo: (tipo: TipoAlquiler, id: string) => {
      const d = leer()
      const n = negocioDe(d, tipo)
      escribir({ ...d, negocios: { ...d.negocios, [tipo]: { ...d.negocios[tipo], bloqueos: n.bloqueos.filter(b => b.id !== id) } } })
    },
    agregarCalendario: (tipo: TipoAlquiler, c: CalendarioExterno, bloqueos: Bloqueo[]) => {
      const d = leer()
      const n = negocioDe(d, tipo)
      escribir({ ...d, negocios: { ...d.negocios, [tipo]: { ...d.negocios[tipo], calendariosExternos: [...n.calendariosExternos, c], bloqueos: [...n.bloqueos, ...bloqueos] } } })
    },
    quitarCalendario: (tipo: TipoAlquiler, id: string) => {
      const d = leer()
      const n = negocioDe(d, tipo)
      escribir({ ...d, negocios: { ...d.negocios, [tipo]: { ...d.negocios[tipo], calendariosExternos: n.calendariosExternos.filter(c => c.id !== id), bloqueos: n.bloqueos.filter(b => !(b.origen === 'ical' && deCalendario(b, id))) } } })
    },
  }
}
