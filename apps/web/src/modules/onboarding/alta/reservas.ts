// Lo que el alta necesita de Alquileres y de Gimnasio fuera de sus pasos
// propios (qué alquilás, rubro, actividades, precios, que son de cada módulo):
// las reglas de esos pasos, el resumen de una línea de la botonera y del pago,
// y lo que muestra la vista previa de "Tu página".
//
// Trae el código de esos dos módulos, así que el alta NO lo importa de forma
// estática: lo baja recién cuando se elige uno de los dos (cargaReservas.ts, y
// los pasos con next/dynamic en Alta.tsx). En el alta real están en
// "Próximamente": este archivo no se baja nunca.
//
// El alta guarda solo lo que se tocó en esos pasos (estadoAlta.ts); los valores
// de fábrica son los de cada módulo (alquilerDe, gymDe). El negocio sale
// SIEMPRE de negocioDesdeAlta de cada módulo (el de ejemplo del modo o del
// rubro, con lo cargado encima): la vista previa, el resumen y lo que se guarda
// al terminar (CierreReservas.tsx) son lo mismo.
import type { LucideIcon } from 'lucide-react'
import { pesos } from '@/lib/reservas/precio'
import { NEGOCIOS_DEMO, TIPOS, type NegocioAlquiler, type TipoAlquiler } from '@/modules/alquileres/datos'
import { ALTA_ALQUILER_INICIAL, negocioDesdeAlta as negocioAlquiler, validarAlquiler, type AltaAlquiler } from '@/modules/alquileres/onboarding/pasos'
import { rubroPorKey as rubroGym } from '@/modules/gimnasio/datos'
import { ALTA_GYM_INICIAL, negocioDesdeAlta as negocioGym, validarGym, type AltaGym } from '@/modules/gimnasio/onboarding/pasos'
import { slugDe, type DatosAlta, type Errores, type PasoId } from './modelo'

// Sin rubro elegido, Gimnasio arma el de ejemplo de "Gimnasio" (como negocioDesdeAlta).
export const RUBRO_GYM = 'gym'

/** Lo cargado en los pasos de Alquileres, encima de los valores de fábrica del módulo. */
export const alquilerDe = (a: Partial<AltaAlquiler>): AltaAlquiler => ({ ...ALTA_ALQUILER_INICIAL, ...a })
/** Lo cargado en los pasos de Gimnasio, encima de los valores de fábrica del módulo. */
export const gymDe = (g: Partial<AltaGym>): AltaGym => ({ ...ALTA_GYM_INICIAL, ...g })

/** Lo que los pasos comunes (tu negocio, ubicación) le pasan al negocio de cada módulo. */
export const baseDe = (d: DatosAlta) => ({
  nombre: d.negocio.trim(), descripcion: d.descripcion.trim(), telefono: d.telefono.trim(),
  direccion: d.direccion.trim(), ciudad: d.ciudad.trim(), latLng: d.latLng, slug: slugDe(d), logo: d.logo,
})

const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const sinRepetir = (xs: string[]) => [...new Set(xs.filter(Boolean))]

// ─── Reglas de sus pasos ─────────────────────────────────────────────────────

/** Los errores de un paso propio de Alquileres o de Gimnasio, con las reglas de su módulo. Vacío = se puede seguir. */
export function validarReservas(id: PasoId, alquiler: Partial<AltaAlquiler>, gym: Partial<AltaGym>): Errores {
  if (id === 'tipo-alquiler' || id === 'que-alquilas') return validarAlquiler(id, alquilerDe(alquiler))
  if (id === 'rubro-gym' || id === 'actividades' || id === 'planes') return validarGym(id, gymDe(gym))
  return {}
}

// ─── Vista previa de "Tu página" ─────────────────────────────────────────────

export interface ItemVista { nombre: string; detalle: string; precio: string }

export interface VistaReservas {
  /** "Canchas o espacios por hora", "Crossfit". */
  etiqueta: string
  /** El botón principal del sitio. */
  verbo: string
  /** La sección principal: las canchas, los paquetes, la propiedad o las clases. */
  seccion: string
  items: ItemVista[]
  /** Gimnasio: los planes que quedan a la venta, con su precio. */
  planes: ItemVista[]
  /** Las fotos que se ofrecen de portada; la primera es la del negocio de ejemplo. */
  fotos: string[]
  /**
   * El acento del sitio de ese módulo, para que la vista se le parezca. Es copia
   * de los temas de alquileres/storefront/Sitio.tsx y gimnasio/storefront/Sitio.tsx:
   * si cambian allá, se cambian acá.
   */
  color: string
}

const POR_TIPO: Record<TipoAlquiler, { seccion: string; color: string; fotos: (n: NegocioAlquiler) => string[]; items: (n: NegocioAlquiler) => ItemVista[] }> = {
  cancha: {
    seccion: 'Canchas', color: '#15803D',
    fotos: n => n.unidades.map(u => u.foto),
    items: n => n.unidades.map(u => ({ nombre: u.nombre || 'Sin nombre', detalle: u.detalle, precio: `${pesos(u.tarifaHora)}/h` })),
  },
  bloque: {
    seccion: 'Paquetes', color: '#DB2777',
    fotos: n => n.salon?.fotos ?? [],
    items: n => (n.salon?.paquetes ?? []).map(p => ({ nombre: p.nombre || 'Sin nombre', detalle: `Hasta ${p.hastaInvitados} invitados`, precio: pesos(p.precio) })),
  },
  estadia: {
    seccion: 'La propiedad', color: '#B45309',
    fotos: n => n.propiedades.flatMap(p => p.fotos),
    items: n => n.propiedades.map(p => ({ nombre: p.nombre || p.tipo, detalle: `${p.tipo} · hasta ${p.huespedes} huéspedes`, precio: `${pesos(p.tarifa.precioNoche)}/noche` })),
  },
}

export function vistaAlquiler(a: AltaAlquiler, d: DatosAlta): VistaReservas {
  const tipo = a.tipo ?? 'cancha'
  const t = POR_TIPO[tipo]
  // Las fotos que se ofrecen son las del negocio de ejemplo de ese modo.
  const ejemplo = NEGOCIOS_DEMO[tipo]
  return {
    etiqueta: TIPOS[tipo].label, verbo: TIPOS[tipo].verbo, seccion: t.seccion, color: t.color,
    items: t.items(negocioAlquiler(a, baseDe(d))), planes: [],
    fotos: sinRepetir([ejemplo.fotoPortada, ...t.fotos(ejemplo)]).slice(0, 6),
  }
}

export function vistaGym(g: AltaGym, d: DatosAlta): VistaReservas {
  const r = rubroGym(g.rubro ?? RUBRO_GYM)
  const n = negocioGym(g, baseDe(d))
  return {
    etiqueta: r.label, verbo: 'Reservar clase', seccion: 'Clases', color: '#0F766E',
    items: n.actividades.map(x => ({ nombre: x.nombre, detalle: `${x.duracion} min · cupo de ${x.cupo}`, precio: '' })),
    planes: n.planes.map(p => ({ nombre: p.nombre, detalle: '', precio: p.precio ? pesos(p.precio) : 'Gratis' })),
    fotos: sinRepetir([n.fotoPortada, ...n.galeria]).slice(0, 6),
  }
}

export const vistaDe = (d: DatosAlta, alquiler: Partial<AltaAlquiler>, gym: Partial<AltaGym>): VistaReservas | null =>
  d.modulo === 'alquileres' ? vistaAlquiler(alquilerDe(alquiler), d) : d.modulo === 'gimnasio' ? vistaGym(gymDe(gym), d) : null

/** La portada que va a quedar: la elegida si sigue entre las que se ofrecen (cambiar de modo o de rubro cambia las fotos). */
export const portadaDe = (d: DatosAlta, v: VistaReservas) => (d.portada && v.fotos.includes(d.portada) ? d.portada : v.fotos[0])

// ─── Resúmenes de una línea ──────────────────────────────────────────────────

/** Lo cargado en el segundo paso de Alquileres. */
export function resumenAlquiler(a: AltaAlquiler): string {
  if (a.tipo === 'cancha') {
    const precios = a.unidades.map(u => u.tarifaHora).filter(p => p > 0)
    return `${cuantos(a.unidades.length, 'cancha o espacio', 'canchas o espacios')}${precios.length ? ` · desde ${pesos(Math.min(...precios))} la hora` : ''}`
  }
  if (a.tipo === 'bloque') return `Hasta ${a.salon.capacidad} personas · ${cuantos(a.salon.paquetes.length, 'paquete', 'paquetes')}`
  if (a.tipo === 'estadia') return `${a.propiedad.nombre.trim() || a.propiedad.tipo} · ${pesos(a.propiedad.precioNoche)} la noche`
  return ''
}

export function resumenActividades(g: AltaGym): string {
  const cupos = g.actividades.map(x => x.cupo)
  const [min, max] = [Math.min(...cupos), Math.max(...cupos)]
  return `${cuantos(g.actividades.length, 'actividad', 'actividades')}${cupos.length ? ` · cupo de ${min}${max !== min ? ` a ${max}` : ''}` : ''}`
}

export function resumenPrecios(g: AltaGym, d: DatosAlta): string {
  const planes = vistaGym(g, d).planes
  return `${cuantos(planes.length, 'plan a la venta', 'planes a la venta')}${g.planes.prueba ? ' · clase de prueba gratis' : ''}`
}

/** Lo que dice la botonera en los pasos propios de Alquileres y de Gimnasio. */
export function pistaReservas(id: PasoId, d: DatosAlta, alquiler: Partial<AltaAlquiler>, gym: Partial<AltaGym>): string | undefined {
  const a = alquilerDe(alquiler)
  const g = gymDe(gym)
  if (id === 'tipo-alquiler') return a.tipo ? TIPOS[a.tipo].label : 'Elegí qué alquilás para seguir'
  if (id === 'que-alquilas') return resumenAlquiler(a) || undefined
  if (id === 'rubro-gym') return g.rubro ? rubroGym(g.rubro).label : 'Elegí tu rubro para seguir'
  if (id === 'actividades') return resumenActividades(g)
  if (id === 'planes') return resumenPrecios(g, d)
  return undefined
}

/** El ícono de la botonera: el del modo o el del rubro, cuando ya se eligió. */
export function iconoReservas(d: DatosAlta, alquiler: Partial<AltaAlquiler>, gym: Partial<AltaGym>): LucideIcon | null {
  if (d.modulo === 'alquileres' && alquiler.tipo) return TIPOS[alquiler.tipo].Icon
  if (d.modulo === 'gimnasio' && gym.rubro) return rubroGym(gym.rubro).Icon
  return null
}

/** Las filas propias del módulo en el resumen del último paso. */
export function filasResumen(d: DatosAlta, alquiler: Partial<AltaAlquiler>, gym: Partial<AltaGym>): { dt: string; dd: string }[] {
  if (d.modulo === 'alquileres') {
    const a = alquilerDe(alquiler)
    const tipo = a.tipo ?? 'cancha'
    return [
      { dt: 'Módulo', dd: `Alquileres · ${TIPOS[tipo].label.toLowerCase()}` },
      { dt: POR_TIPO[tipo].seccion, dd: resumenAlquiler({ ...a, tipo }) },
    ]
  }
  if (d.modulo === 'gimnasio') {
    const g = gymDe(gym)
    return [
      { dt: 'Módulo', dd: `Gimnasio · ${rubroGym(g.rubro ?? RUBRO_GYM).label.toLowerCase()}` },
      { dt: 'Actividades', dd: resumenActividades(g) },
      { dt: 'Precios', dd: resumenPrecios(g, d) },
    ]
  }
  return []
}
