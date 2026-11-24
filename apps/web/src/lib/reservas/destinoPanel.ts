// A dónde lleva /panel y qué muestra <slug>.orbita.site según el rubro
// principal del negocio (Business.industry: llega en la sesión por GET
// /auth/me y en la config pública del sitio). Tienda va a su panel y muestra
// su tienda, como siempre; Alquileres, a su panel (pages/panel/alquileres.tsx)
// y a su sitio de reservas. Sin rubro, o con cualquier otro, no cambia nada:
// es el camino de Tienda.
//
// Vive en lib/reservas para que Turnos y Gimnasio sumen acá su rubro cuando
// tengan su panel y su sitio en producción, en lugar de tocar
// pages/panel/index.tsx y pages/tienda/[slug]/index.tsx.

export const esDeAlquileres = (industry: string | undefined | null): boolean => industry === 'alquileres'

/** `query` es `window.location.search` ("" o "?a=b"): viaja entera. */
export function destinoDelPanel(industry: string | undefined | null, query: string): string {
  if (esDeAlquileres(industry)) return `/panel/alquileres${query}`
  return `/admin/ventas/dashboard${query}`
}

/** Qué se muestra en la portada del sitio del negocio: su tienda (lo de siempre) o su sitio de reservas. */
export function sitioDelNegocio(industry: string | undefined | null): 'tienda' | 'alquileres' {
  return esDeAlquileres(industry) ? 'alquileres' : 'tienda'
}
