// Lo que cambió en la demo de Gimnasio, guardado en el navegador: la
// configuración del negocio, las inscripciones que se hicieron desde el sitio
// o el panel, los check-in, los socios nuevos y sus planes. Sin backend, este
// archivo es el hilo que une el sitio, la reserva, "Mis clases" y el panel.
//
// Dos reglas viven acá, para que valgan igual desde el sitio y desde el panel:
// - La lista de espera avanza sola: cuando alguien cancela una clase llena, el
//   primero que esperaba pasa a reservado; si el dueño le sube el cupo a una
//   clase en la grilla, pasan los que entren en los lugares nuevos.
// - El pack se descuenta al reservar: una clase reservada con el pack resta
//   una; si se cancela a tiempo (antes del plazo del negocio), vuelve. Quien
//   pasa de la lista de espera a reservado también la descuenta.
import { useSyncExternalStore } from 'react'
import { AHORA, HOY, cupoDe, inscripcionesDe, negocioDe, planDe, rubroPorKey, sociosDe, type ClaseSemanal, type Inscripcion, type NegocioGym, type Socio } from './index'
import { diaSemana, diasEntre, sumarDias } from '@/lib/reservas/fechas'

export interface DemoGym {
  negocios: Record<string, Partial<NegocioGym>>
  inscripciones: Record<string, Inscripcion[]>
  cambios: Record<string, Partial<Inscripcion>>
  socios: Record<string, Socio[]>
  cambiosSocio: Record<string, Partial<Socio>>
  alta: string | null
}

const INICIAL: DemoGym = { negocios: {}, inscripciones: {}, cambios: {}, socios: {}, cambiosSocio: {}, alta: null }
const CLAVE = 'orbita_gimnasio_demo'

let cache: DemoGym = INICIAL
let leido = false
const oyentes = new Set<() => void>()

function leer(): DemoGym {
  if (leido) return cache
  leido = true
  try {
    const crudo = window.localStorage.getItem(CLAVE)
    if (crudo) cache = { ...INICIAL, ...(JSON.parse(crudo) as Partial<DemoGym>) }
  } catch { /* sin almacenamiento o JSON roto: se arranca de cero */ }
  return cache
}

function escribir(n: DemoGym) {
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

export const negocioDelDemo = (demo: DemoGym, rubro: string): NegocioGym => ({ ...negocioDe(rubroPorKey(rubro)), ...demo.negocios[rubro] })

export function sociosDelDemo(demo: DemoGym, rubro: string): Socio[] {
  const base = sociosDe(negocioDe(rubroPorKey(rubro)))
  return [...base, ...(demo.socios[rubro] ?? [])].map(s => (demo.cambiosSocio[s.id] ? { ...s, ...demo.cambiosSocio[s.id] } : s))
}

export function inscripcionesDelDemo(demo: DemoGym, rubro: string): Inscripcion[] {
  const n = negocioDe(rubroPorKey(rubro))
  const base = inscripcionesDe(n, sociosDe(n))
  return [...base, ...(demo.inscripciones[rubro] ?? [])].map(i => (demo.cambios[i.id] ? { ...i, ...demo.cambios[i.id] } : i))
}

// ─── El pack ─────────────────────────────────────────────────────────────────

/**
 * Suma `delta` a las clases que le quedan al socio de la inscripción, si la
 * pagó con su pack. Devuelve los cambios de socio a guardar (o los mismos si
 * no aplica). Nunca baja de 0 ni pasa lo que trae el pack.
 */
function ajustarPack(d: DemoGym, rubro: string, i: Inscripcion, delta: number): Record<string, Partial<Socio>> {
  const socio = sociosDelDemo(d, rubro).find(s => s.id === i.socioId)
  const plan = planDe(negocioDelDemo(d, rubro), i.planId)
  if (!socio || plan?.tipo !== 'pack' || socio.planId !== plan.id || socio.clasesRestantes === null) return d.cambiosSocio
  const restantes = Math.min(plan.clases ?? Infinity, Math.max(0, socio.clasesRestantes + delta))
  return { ...d.cambiosSocio, [socio.id]: { ...d.cambiosSocio[socio.id], clasesRestantes: restantes } }
}

/** Si una inscripción se cancela antes del plazo del negocio (en horas antes del inicio). */
function aTiempo(n: NegocioGym, i: Inscripcion): boolean {
  const clase = n.clases.find(c => c.id === i.claseId)
  if (!clase) return true
  const horas = diasEntre(HOY, i.fecha) * 24 + (clase.inicio - AHORA) / 60
  return horas >= n.cancelaHastaHoras
}

/** La lista de espera de una clase en una fecha, en orden de llegada. */
const enEspera = (todas: Inscripcion[], claseId: string, fecha: string) =>
  todas.filter(i => i.claseId === claseId && i.fecha === fecha && i.estado === 'espera').sort((a, b) => a.creada.localeCompare(b.creada) || a.id.localeCompare(b.id))

/**
 * Con la grilla nueva ya guardada en `d`: en las clases a las que se les subió
 * el cupo, los primeros de la lista de espera pasan a reservado en las fechas
 * que vienen (hasta donde llega la reserva anticipada), y su pack se descuenta.
 */
function pasarPorCupoNuevo(d: DemoGym, rubro: string, antes: ClaseSemanal[]): DemoGym {
  const n = negocioDelDemo(d, rubro)
  const agrandadas = n.clases.filter(c => { const vieja = antes.find(x => x.id === c.id); return !!vieja && c.cupo > vieja.cupo })
  if (!agrandadas.length) return d
  let actual = d
  for (let k = 0; k <= n.anticipacionDias; k++) {
    const fecha = sumarDias(HOY, k)
    for (const c of agrandadas.filter(x => x.dia === diaSemana(fecha) && (k > 0 || x.inicio > AHORA))) {
      const todas = inscripcionesDelDemo(actual, rubro)
      const pasan = enEspera(todas, c.id, fecha).slice(0, cupoDe(c, fecha, todas).libres)
      for (const i of pasan) {
        actual = { ...actual, cambios: { ...actual.cambios, [i.id]: { ...actual.cambios[i.id], estado: 'reservada' } }, cambiosSocio: ajustarPack(actual, rubro, i, -1) }
      }
    }
  }
  return actual
}

/**
 * Lo que se puede hacer en la demo. No dependen de React: leen y escriben el
 * almacén directo (por eso se prueban solas, ver __tests__/reglas.test.ts), y
 * useDemoGym las devuelve junto con el estado para que las pantallas se
 * redibujen al cambiar.
 */
export const accionesGym = {
  reiniciar: () => escribir(INICIAL),
  configurar: (rubro: string, cambio: Partial<NegocioGym>) => {
    const d = leer()
    const nuevo: DemoGym = { ...d, negocios: { ...d.negocios, [rubro]: { ...d.negocios[rubro], ...cambio } } }
    // Si cambió la grilla y alguna clase tiene más cupo, la lista de espera avanza sola.
    escribir(cambio.clases ? pasarPorCupoNuevo(nuevo, rubro, negocioDelDemo(d, rubro).clases) : nuevo)
  },
  /**
   * Una inscripción nueva (reserva o lista de espera), con el socio si es
   * nuevo. Si queda reservada y se paga con el pack, el pack se descuenta.
   */
  inscribir: (rubro: string, i: Inscripcion, socio?: Socio) => {
    const d = leer()
    const nuevo = socio && !(d.socios[rubro] ?? []).some(s => s.id === socio.id) ? socio : undefined
    const socios = nuevo ? { ...d.socios, [rubro]: [...(d.socios[rubro] ?? []), nuevo] } : d.socios
    escribir({
      ...d,
      inscripciones: { ...d.inscripciones, [rubro]: [...(d.inscripciones[rubro] ?? []), i] },
      socios,
      cambiosSocio: i.estado === 'reservada' ? ajustarPack({ ...d, socios }, rubro, i, -1) : d.cambiosSocio,
    })
  },
  /** Un cambio de estado o de datos de una inscripción, sin reglas (check-in, faltó). */
  cambiarInscripcion: (id: string, cambio: Partial<Inscripcion>) => {
    const d = leer()
    escribir({ ...d, cambios: { ...d.cambios, [id]: { ...d.cambios[id], ...cambio } } })
  },
  /**
   * Igual que cambiarInscripcion, pero sabiendo el rubro: si alguien pasa de
   * la lista de espera a reservado ("Darle el lugar"), su pack se descuenta.
   */
  cambiarInscripcionEn: (rubro: string, id: string, cambio: Partial<Inscripcion>) => {
    const d = leer()
    const la = inscripcionesDelDemo(d, rubro).find(i => i.id === id)
    const promovida = la && la.estado === 'espera' && cambio.estado === 'reservada'
    escribir({
      ...d,
      cambios: { ...d.cambios, [id]: { ...d.cambios[id], ...cambio } },
      cambiosSocio: promovida ? ajustarPack(d, rubro, la, -1) : d.cambiosSocio,
    })
  },
  /**
   * Cancela una inscripción. Si la clase estaba llena y hay gente esperando,
   * la primera en la lista pasa a reservada: así la lista de espera avanza sola.
   * Con pack: cancelada a tiempo, la clase vuelve; la de quien pasa de la lista, se descuenta.
   */
  cancelar: (rubro: string, id: string) => {
    const d = leer()
    const todas = inscripcionesDelDemo(d, rubro)
    const la = todas.find(i => i.id === id)
    if (!la) return
    const cambios: Record<string, Partial<Inscripcion>> = { ...d.cambios, [id]: { ...d.cambios[id], estado: 'cancelada' } }
    let cambiosSocio = d.cambiosSocio
    if (la.estado === 'reservada') {
      if (aTiempo(negocioDelDemo(d, rubro), la)) cambiosSocio = ajustarPack(d, rubro, la, +1)
      const siguiente = enEspera(todas, la.claseId, la.fecha)[0]
      if (siguiente) {
        cambios[siguiente.id] = { ...cambios[siguiente.id], estado: 'reservada' }
        cambiosSocio = ajustarPack({ ...d, cambiosSocio }, rubro, siguiente, -1)
      }
    }
    escribir({ ...d, cambios, cambiosSocio })
  },
  agregarSocio: (rubro: string, s: Socio) => {
    const d = leer()
    escribir({ ...d, socios: { ...d.socios, [rubro]: [...(d.socios[rubro] ?? []), s] } })
  },
  cambiarSocio: (id: string, cambio: Partial<Socio>) => {
    const d = leer()
    escribir({ ...d, cambiosSocio: { ...d.cambiosSocio, [id]: { ...d.cambiosSocio[id], ...cambio } } })
  },
  marcarAlta: (rubro: string | null) => escribir({ ...leer(), alta: rubro }),
}

/** El estado de la demo tal como está ahora, fuera de un componente (las pruebas lo usan). */
export const leerDemo = (): DemoGym => leer()

export function useDemoGym() {
  const demo = useSyncExternalStore(suscribir, leer, () => INICIAL)
  return { demo, ...accionesGym }
}
