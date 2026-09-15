// Content-Security-Policy de la web (auditoría interna 10/09, hallazgo
// csp-scripts: "La web no tiene una Content-Security-Policy de scripts").
//
// Este archivo es la única fuente de verdad de tres cosas que tienen que
// quedar sincronizadas entre sí y que por eso no pueden vivir en lugares
// distintos:
//
//   1. TEMA_SCRIPT: el script inline pre-hidratación de _app.tsx (aplica el
//      modo oscuro antes de que React hidrate, para evitar el flash blanco).
//   2. Su hash sha256, que es lo que lo autoriza en `script-src` sin tener
//      que abrir la puerta con 'unsafe-inline'.
//   3. La política Report-Only que emite middleware.ts.
//
// Por qué hash y no nonce (check 2 del hallazgo pedía "nonce"): con el pages
// router, la landing, /login, /panel y la mayoría de las páginas del panel
// son ESTÁTICAS — Next las prerenderiza en el build y sirve el mismo HTML a
// todo el mundo. Un nonce tiene que ser distinto por request y estar en el
// HTML y en el header a la vez, cosa que un HTML fijo no puede cumplir: el
// middleware emitiría un nonce nuevo y el HTML traería el del build (o
// ninguno). Un hash cumple el mismo objetivo de seguridad (autoriza EXACTAMENTE
// ese script y ningún otro inline) y no depende de la request — la única
// condición es que el script sea idéntico byte a byte en todas las páginas,
// por eso dejó de interpolar valores y los lee de atributos data-* del
// propio <script> (ver _app.tsx).
//
// Por qué la política se emite desde middleware.ts y no desde
// next.config.ts: next.config.ts no puede importar este módulo sin tocar el
// tsconfig (Node nativo exige la extensión `.ts` en el import y tsc la
// rechaza sin `allowImportingTsExtensions`), y duplicar el hash a mano en
// dos archivos es justo el tipo de drift que este módulo evita.

// Script de tema. Parámetros por atributos del propio <script> (los lee con
// document.currentScript, que para un script inline clásico parseado desde
// el HTML siempre está definido):
//   data-root-domain: NEXT_PUBLIC_ROOT_DOMAIN (para detectar subdominio de tienda)
//   data-color-mode:  default del dueño para el storefront ('light' | 'dark' | 'system')
// OJO: cualquier cambio acá cambia el hash — no hace falta actualizar nada a
// mano (el middleware lo calcula del string), pero sí hay que rehacer el
// build/deploy de la web para que HTML y header vuelvan a coincidir.
export const TEMA_SCRIPT = `
        (function() {
          var s = document.currentScript;
          var ROOT_DOMAIN = (s && s.getAttribute('data-root-domain')) || 'orbita.local';
          var COLOR_MODE_DEFAULT = (s && s.getAttribute('data-color-mode')) || 'light';
          var hostname = window.location.hostname.toLowerCase();
          var pathname = window.location.pathname;

          // '/admin' es el panel real (ver AdminSeccionShell.tsx) — mismo criterio
          // que authChannel() en lib/tenant.ts. Sin el check de '/admin' acá, esas
          // páginas bajo el subdominio de una tienda se clasificaban como storefront
          // y leían la key de tema equivocada (orbita-theme-tienda en vez de
          // orbita-theme): el panel en oscuro arrancaba en claro hasta que React
          // hidrataba y el Header corregía la clase — el loader se veía saltar de
          // color o duplicarse con temas distintos.
          var esPanel = pathname === '/panel' || pathname.indexOf('/panel/') === 0 || pathname.indexOf('/admin') === 0;
          var esTiendaPorPath = pathname.indexOf('/tienda/') === 0;
          var esTiendaPorSubdominio = false;
          if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== ROOT_DOMAIN && hostname.slice(-(ROOT_DOMAIN.length + 1)) === '.' + ROOT_DOMAIN) {
            var sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
            if (sub.indexOf('www.') === 0) sub = sub.slice(4);
            esTiendaPorSubdominio = !!sub && sub !== 'www';
          }
          var esStorefront = !esPanel && (esTiendaPorPath || esTiendaPorSubdominio);

          if (esStorefront) {
            var temaTienda = localStorage.getItem('orbita-theme-tienda');
            if (temaTienda === 'dark') {
              document.documentElement.classList.add('dark');
            } else if (temaTienda !== 'light') {
              // El visitante nunca tocó el toggle — cae al default que
              // eligió el dueño (COLOR_MODE_DEFAULT, arriba).
              var prefiereDarkTienda = window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (COLOR_MODE_DEFAULT === 'dark' || (COLOR_MODE_DEFAULT === 'system' && prefiereDarkTienda)) {
                document.documentElement.classList.add('dark');
              }
            }
          } else {
            var tema = localStorage.getItem('orbita-theme');
            var prefiereDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (tema === 'dark' || (!tema && prefiereDark)) {
              document.documentElement.classList.add('dark');
            }
          }
        })();
      `

// A dónde mandan los navegadores las violaciones (pages/api/csp-report.ts).
// Relativo a propósito: la misma web se sirve en orbita.site, en cada
// subdominio de tienda y en dominios propios; el reporte tiene que ir al
// origen que sirvió la página, no a uno fijo.
export const CSP_REPORT_PATH = '/api/csp-report'

// sha256 en base64, formato que pide CSP ('sha256-…'). Web Crypto y no
// node:crypto porque esto corre en el edge runtime del middleware (y el
// módulo también lo importa _app.tsx, que va al bundle del cliente).
export async function sha256Base64(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  let binario = ''
  for (const b of new Uint8Array(digest)) binario += String.fromCharCode(b)
  return btoa(binario)
}

export interface OpcionesCsp {
  // Hash del TEMA_SCRIPT (sha256Base64), sin el prefijo 'sha256-'.
  hashTema: string
  // Origen de la API (NEXT_PUBLIC_API_URL sin el path), o null si no se pudo
  // parsear — en ese caso no se agrega nada y la API quedaría reportada, que
  // es preferible a inventar un origen.
  apiOrigin: string | null
}

// Política en modo Report-Only. Inventario real de orígenes (grep sobre
// apps/web/src del 15/09):
//   scripts:  solo los chunks propios de /_next/static + el script de tema
//             inline (hash). No hay SDK de Mercado Pago (se redirige al
//             init_point con location.href), ni Google Identity (OAuth por
//             redirección a la API), ni Vercel Analytics/Speed Insights.
//   connect:  la API (NEXT_PUBLIC_API_URL) y el BFF propio (/api, 'self');
//             nominatim.openstreetmap.org (geocoding en Configuración y
//             onboarding); apis.datos.gob.ar (georef.ts); *.supabase.co
//             (Storage: hoy solo se cargan imágenes, pero si algún día se
//             sube directo desde el navegador ya está cubierto).
//   img:      Supabase Storage, images.unsplash.com (plantillas), tiles de
//             OpenStreetMap ({s}.tile.openstreetmap.org), logos/fotos que
//             cada negocio sube, previews con blob: (URL.createObjectURL en
//             el catálogo) y data:. Por eso `https:` genérico: las fotos
//             de producto son URLs que cargan los dueños.
//   style:    Google Fonts (<link> en _document.tsx y fuentes por tienda en
//             _app.tsx) + 'unsafe-inline' por los style={} de React, el
//             <style> de colores por tienda en _app.tsx y Leaflet.
//   font:     fonts.gstatic.com (+ data: por fuentes embebidas en CSS).
//   frame:    solo el iframe srcDoc de la previsualización de mails del
//             superadmin y las vistas de celular del mismo origen — nada
//             externo (Mercado Pago no se embebe, YouTube no se usa).
// Sin nonce, sin 'unsafe-inline' ni 'unsafe-eval' en script-src: eso es lo
// que la política va a medir durante la semana de reportes.
export function armarCspReportOnly({ hashTema, apiOrigin }: OpcionesCsp): string {
  const connect = ["'self'", apiOrigin, 'https://*.supabase.co', 'https://nominatim.openstreetmap.org', 'https://apis.datos.gob.ar']
    .filter((o): o is string => Boolean(o))
  const directivas = [
    "default-src 'self'",
    `script-src 'self' 'sha256-${hashTema}'`,
    `connect-src ${connect.join(' ')}`,
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `report-uri ${CSP_REPORT_PATH}`,
  ]
  return directivas.join('; ')
}

// Origen (scheme + host + puerto) de una URL de API, o null si no parsea.
export function origenDeUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

// ── Reportes ────────────────────────────────────────────────────────────────

// Tope por campo y por línea de log: un reporte lo arma el navegador a
// partir de lo que haya en la página (un blocked-uri puede ser una URL
// kilométrica, un script-sample trae código), y esto va a los logs de Vercel
// tal cual. Se recorta para que una línea sea legible y no pese.
const MAX_CAMPO = 200
const MAX_LINEA = 700

const CAMPOS = ['document-uri', 'effective-directive', 'blocked-uri', 'source-file', 'line-number', 'script-sample', 'disposition'] as const
type Campo = (typeof CAMPOS)[number]

// Los dos formatos que mandan los navegadores:
//   - report-uri (legacy, todos los navegadores):
//       { "csp-report": { "document-uri": …, "violated-directive": …, … } }
//   - Reporting API (Chrome con report-to):
//       [ { "type": "csp-violation", "body": { "documentURL": …, "effectiveDirective": …, … } } ]
// Se aceptan ambos aunque hoy la política solo usa report-uri, para que
// pasar a report-to el día de mañana no exija tocar el endpoint.
const ALIAS: Record<Campo, string[]> = {
  'document-uri': ['document-uri', 'documentURL'],
  'effective-directive': ['effective-directive', 'violated-directive', 'effectiveDirective'],
  'blocked-uri': ['blocked-uri', 'blockedURL'],
  'source-file': ['source-file', 'sourceFile'],
  'line-number': ['line-number', 'lineNumber'],
  'script-sample': ['script-sample', 'sample'],
  'disposition': ['disposition'],
}

function recortar(valor: string, max: number): string {
  return valor.length > max ? `${valor.slice(0, max)}…` : valor
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Saca el/los objetos de violación del body, cualquiera sea el formato.
function violacionesDe(body: unknown): Record<string, unknown>[] {
  let datos: unknown = body
  if (typeof datos === 'string') {
    try {
      datos = JSON.parse(datos)
    } catch {
      return []
    }
  }
  if (Array.isArray(datos)) {
    return datos
      .filter(esObjeto)
      .map(r => (esObjeto(r.body) ? r.body : r))
  }
  if (!esObjeto(datos)) return []
  if (esObjeto(datos['csp-report'])) return [datos['csp-report']]
  if (esObjeto(datos.body)) return [datos.body]
  return [datos]
}

// Una línea por violación, con los campos que sirven para decidir si es un
// origen legítimo que falta en la política o ruido (extensiones del
// navegador, inyección de un ISP, etc.). Devuelve [] si el body no trae
// nada reconocible — el endpoint igual responde 204: no tiene sentido
// devolverle un error a un navegador que ni lo lee.
export function resumirReporteCsp(body: unknown): string[] {
  const lineas: string[] = []
  for (const v of violacionesDe(body)) {
    const partes: string[] = []
    for (const campo of CAMPOS) {
      const valor = ALIAS[campo].map(k => v[k]).find(x => x !== undefined && x !== null && x !== '')
      if (valor === undefined) continue
      const texto = typeof valor === 'string' || typeof valor === 'number' ? String(valor) : JSON.stringify(valor)
      partes.push(`${campo}=${recortar(texto, MAX_CAMPO)}`)
    }
    if (partes.length > 0) lineas.push(recortar(partes.join(' '), MAX_LINEA))
  }
  return lineas
}
