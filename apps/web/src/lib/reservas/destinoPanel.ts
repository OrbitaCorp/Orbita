// A dónde lleva /panel según el rubro principal del negocio (Business.industry,
// que llega en la sesión por GET /auth/me). Tienda va a su panel de siempre;
// Alquileres, al suyo (pages/panel/alquileres.tsx). Sin rubro en la sesión, o
// con cualquier otro, no cambia nada: es el camino de Tienda.
//
// Vive en lib/reservas para que Turnos y Gimnasio sumen acá su rubro cuando
// tengan su panel en producción, en lugar de tocar pages/panel/index.tsx.

export const esDeAlquileres = (industry: string | undefined | null): boolean => industry === 'alquileres'

/** `query` es `window.location.search` ("" o "?a=b"): viaja entera. */
export function destinoDelPanel(industry: string | undefined | null, query: string): string {
  if (esDeAlquileres(industry)) return `/panel/alquileres${query}`
  return `/admin/ventas/dashboard${query}`
}
