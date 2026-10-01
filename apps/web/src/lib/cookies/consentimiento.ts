// Preferencias de cookies del visitante (banner de cookies de las tiendas y de
// orbita.site). Viven en el localStorage de cada sitio: cada tienda (subdominio
// o dominio propio) pregunta por su cuenta, como cualquier sitio distinto.
//
// Hay dos categorías:
//   - Necesarias: la sesión de quien inició sesión, el carrito, el tema y otras
//     preferencias del navegador. Siempre activas, no se pueden apagar.
//   - Estadísticas: el contador de visitas de la tienda (una marca en la
//     pestaña y un registro anónimo en el servidor: tienda, dominio, ruta y
//     hora; sin IP ni identificador). Es lo único opcional que hay hoy.
//
// Mientras el visitante no eligió, las estadísticas cuentan (el contador no
// usa cookies ni datos personales); si elige "Solo necesarias", esa visita y
// las siguientes de ese navegador ya no se cuentan.
//
// Subir VERSION cuando cambie qué se usa o para qué: obliga a volver a preguntar.

const CLAVE = 'orbita-cookies'
const VERSION = 1

export const EVENTO_CAMBIO = 'orbita:cookies-cambio'
export const EVENTO_ABRIR = 'orbita:cookies-abrir'

export type Consentimiento = { estadisticas: boolean; version: number; fecha: string }

export function leerConsentimiento(): Consentimiento | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const c = JSON.parse(crudo) as Partial<Consentimiento>
    if (c.version !== VERSION || typeof c.estadisticas !== 'boolean') return null
    return { estadisticas: c.estadisticas, version: VERSION, fecha: c.fecha ?? '' }
  } catch {
    return null
  }
}

export function guardarConsentimiento(estadisticas: boolean): Consentimiento {
  const c: Consentimiento = { estadisticas, version: VERSION, fecha: new Date().toISOString() }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(c))
  } catch {
    // Sin almacenamiento (modo privado estricto): vale para esta pestaña, no se recuerda.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO, { detail: c }))
  return c
}

/** ¿Se puede contar la visita? Sí, salvo que haya elegido "Solo necesarias". */
export function estadisticasPermitidas(): boolean {
  return leerConsentimiento()?.estadisticas ?? true
}

/** Vuelve a mostrar el banner (enlace "Preferencias de cookies" del pie). */
export function abrirPreferenciasDeCookies(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_ABRIR))
}
