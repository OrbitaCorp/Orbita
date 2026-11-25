// A dónde lleva /panel y qué muestra <slug>.orbita.site según el rubro
// principal del negocio (Business.industry: llega en la sesión por GET
// /auth/me y en la config pública del sitio). Tienda va a su panel y muestra
// su tienda, como siempre; Alquileres, a su panel (pages/panel/alquileres.tsx)
// y a su sitio de reservas; Gimnasio muestra su sitio de clases (su panel
// todavía no tiene ruta de producción: sigue yendo al de siempre). Sin rubro,
// o con cualquier otro, no cambia nada: es el camino de Tienda.
//
// Vive en lib/reservas para que Turnos sume acá su rubro cuando tenga su
// panel y su sitio en producción, en lugar de tocar pages/panel/index.tsx y
// pages/tienda/[slug]/index.tsx.

type Rubro = string | undefined | null
type Subrubros = readonly string[] | undefined | null

export const esDeAlquileres = (industry: Rubro): boolean => industry === 'alquileres'

/**
 * Las claves de rubro de Gimnasio (RUBROS_GYM, en modules/gimnasio/datos). Van
 * copiadas porque esta librería no importa a los módulos; un test de Gimnasio
 * (datos/origen/__tests__/sitio.test.ts) cuida que sean las mismas.
 */
export const RUBROS_DE_GIMNASIO: readonly string[] = ['gym', 'crossfit', 'funcional', 'yoga', 'danza', 'artes-marciales', 'natacion', 'talleres']

/**
 * Un negocio de Gimnasio: rubro principal "gimnasio" y, entre sus subrubros,
 * uno de Gimnasio (así lo guarda su alta: industry "gimnasio", subrubros
 * ["crossfit"]). Hacen falta las dos cosas: el rubro principal también se
 * escribe a mano en Configuración → Información del negocio de Tienda
 * ("Rubro (opcional)", texto libre), y una tienda que ponga "gimnasio" ahí
 * tiene que seguir viendo su tienda.
 */
export const esDeGimnasio = (industry: Rubro, subrubros: Subrubros): boolean =>
  industry === 'gimnasio' && (subrubros ?? []).some(s => RUBROS_DE_GIMNASIO.includes(s))

/** `query` es `window.location.search` ("" o "?a=b"): viaja entera. */
export function destinoDelPanel(industry: Rubro, query: string): string {
  if (esDeAlquileres(industry)) return `/panel/alquileres${query}`
  return `/admin/ventas/dashboard${query}`
}

/** Qué se muestra en la portada del sitio del negocio: su tienda (lo de siempre) o su sitio de reservas. */
export function sitioDelNegocio(industry: Rubro, subrubros?: Subrubros): 'tienda' | 'alquileres' | 'gimnasio' {
  if (esDeAlquileres(industry)) return 'alquileres'
  if (esDeGimnasio(industry, subrubros)) return 'gimnasio'
  return 'tienda'
}

/** Si el sitio del negocio tiene la página /reserva: los que reservan sí; en una tienda es un 404. */
export const sitioConReserva = (industry: Rubro, subrubros?: Subrubros): boolean => sitioDelNegocio(industry, subrubros) !== 'tienda'
