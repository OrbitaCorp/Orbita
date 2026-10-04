import { SEO_CANONICAL_HOST } from '@/lib/tenant'

// La línea de privacidad abajo del input de Orbi (panel v1 y v2). Nombra a los
// dos proveedores que pueden procesar el texto: Gemini y, si falla, Groq.
export const AVISO_PRIVACIDAD = 'Lo que escribís queda en tu historial y lo procesa Google Gemini (y Groq como respaldo).'

// Absoluto al sitio de Órbita: el panel también se abre desde el subdominio de
// la tienda, y ahí el middleware reescribe /privacidad al storefront
// (/tienda/<slug>/privacidad), no a la política de Órbita. SEO_CANONICAL_HOST
// y no ROOT_DOMAIN: el apex redirige a www.
export const URL_PRIVACIDAD = `https://${SEO_CANONICAL_HOST}/privacidad`
