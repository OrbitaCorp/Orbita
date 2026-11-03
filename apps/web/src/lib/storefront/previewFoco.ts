// ─── Foco de la vista previa de Apariencia ───────────────────────────────────
//
// Cuando el dueño toca algo en Apariencia, la previa lleva la mirada a la parte
// de la tienda que está editando: se desplaza hasta ahí (si no se ve ya) y la
// marca un instante con un marco suave. Es el otro lado del puente de
// previewBridge.ts: el panel manda `MSG_FOCO` con un OBJETIVO lógico y acá se
// resuelve contra las marcas `data-ap-sec="…"` que lleva la portada.
//
// Un objetivo lógico no es una marca: "estantes" vale para la primera fila de
// productos que se dibuje, "whatsapp" para el banner o, si no hay, el botón
// flotante. Así el panel no tiene que saber qué se está dibujando hoy.
//
// Reglas del movimiento (nada raro):
//   · si la sección ya se ve, NO se desplaza — solo se marca;
//   · el desplazamiento es suave, salvo con "menos movimiento" del sistema;
//   · el marco no toca el diseño de la tienda: es una capa aparte, encima,
//     que sigue a la sección mientras dura y después se borra sola;
//   · lo que cambia TODA la tienda (colores, tipografía) lleva a su parte más
//     representativa pero no marca nada, porque no hay "una parte" que marcar.

export const MSG_FOCO = 'orbita-preview:focus'
/** Atributo con el que la portada marca sus secciones. */
export const ATRIBUTO_SECCION = 'data-ap-sec'

export type ObjetivoPreview =
  | 'inicio' | 'anuncio' | 'header' | 'hero' | 'stats' | 'categorias'
  | 'estantes' | 'destacados' | 'nuevos' | 'recomendados' | 'topventas'
  | 'parallax' | 'marcas' | 'video' | 'whatsapp' | 'footer'

interface Resolucion {
  /** Marcas que se prueban en orden: gana la primera que está dibujada. */
  marcas: string[]
  /** false = el cambio es de toda la tienda: se lleva a la vista, sin marco. */
  marcar: boolean
}

const RESOLUCION: Record<ObjetivoPreview, Resolucion> = {
  inicio:       { marcas: ['hero', 'header'], marcar: false },
  anuncio:      { marcas: ['anuncio'], marcar: true },
  header:       { marcas: ['header'], marcar: true },
  hero:         { marcas: ['hero'], marcar: true },
  stats:        { marcas: ['stats'], marcar: true },
  categorias:   { marcas: ['categorias'], marcar: true },
  estantes:     { marcas: ['estante-destacados', 'estante-nuevos', 'estante-recomendados', 'estante-topventas'], marcar: true },
  destacados:   { marcas: ['estante-destacados'], marcar: true },
  nuevos:       { marcas: ['estante-nuevos'], marcar: true },
  recomendados: { marcas: ['estante-recomendados'], marcar: true },
  topventas:    { marcas: ['estante-topventas'], marcar: true },
  parallax:     { marcas: ['parallax'], marcar: true },
  marcas:       { marcas: ['marcas'], marcar: true },
  video:        { marcas: ['video'], marcar: true },
  whatsapp:     { marcas: ['whatsapp', 'whatsapp-flotante'], marcar: true },
  footer:       { marcas: ['footer'], marcar: true },
}

export function esObjetivoPreview(v: unknown): v is ObjetivoPreview {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(RESOLUCION, v)
}

// Una sección que se acaba de prender tarda un instante en dibujarse (y la
// portada trae los productos aparte): se reintenta unos segundos antes de
// rendirse. Si nunca aparece —está apagada o no tiene contenido— no pasa nada.
const REINTENTO_MS = 100
const REINTENTOS_MAX = 30

// Mientras el dueño tipea, cada letra pide foco sobre la misma sección: el
// marco se muestra una vez y no se reinicia a cada tecla.
const PAUSA_MARCO_MS = 4000
let ultimo: { objetivo: ObjetivoPreview; t: number } | null = null
let pendiente = 0

const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function buscar(objetivo: ObjetivoPreview): HTMLElement | null {
  for (const marca of RESOLUCION[objetivo].marcas) {
    const el = document.querySelector<HTMLElement>(`[${ATRIBUTO_SECCION}="${marca}"]`)
    // Dibujada de verdad: una sección sin contenido deja su caja en 0.
    if (el && el.getBoundingClientRect().height > 0) return el
  }
  return null
}

// El header de la tienda es `sticky`: el borde de arriba "útil" está debajo de él.
function bordeSuperior(): number {
  const h = document.querySelector<HTMLElement>(`[${ATRIBUTO_SECCION}="header"]`)
  const r = h?.getBoundingClientRect()
  return r && r.top <= 1 ? r.bottom : 0
}

function llevarAlaVista(el: HTMLElement): void {
  const r = el.getBoundingClientRect()
  const alto = window.innerHeight
  const tope = bordeSuperior() + 8
  const util = alto - tope
  const visible = Math.max(0, Math.min(r.bottom, alto) - Math.max(r.top, tope))
  // Ya se ve (lo que cabe en pantalla, al menos 60%): no se mueve nada.
  if (visible >= Math.min(r.height, util) * 0.6) return
  // Chica: centrada en lo que queda libre. Grande: su borde de arriba, debajo del header.
  const margen = r.height < util * 0.7 ? (util - r.height) / 2 : 12
  const destino = Math.max(0, window.scrollY + r.top - tope - margen)
  window.scrollTo({ top: destino, behavior: reducido() ? 'auto' : 'smooth' })
}

function quitarMarco(): void {
  document.getElementById(ID_MARCO)?.remove()
}

const ID_MARCO = 'orbita-preview-marco'
const MARCO_VISIBLE_MS = 1500
const MARCO_SALIDA_MS = 500

// Un marco neutro (oscuro + blanco, por dentro del borde): se lee sobre
// cualquier fondo y no compite con la paleta que el dueño está eligiendo.
function marcar(el: HTMLElement): void {
  quitarMarco()
  const marco = document.createElement('div')
  marco.id = ID_MARCO
  marco.setAttribute('aria-hidden', 'true')
  const quieto = reducido()
  marco.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483000', 'box-sizing:border-box',
    'border-radius:6px', 'opacity:0',
    'box-shadow:inset 0 0 0 2px rgba(15,23,42,0.55), inset 0 0 0 4px rgba(255,255,255,0.6)',
    quieto ? '' : 'transition:opacity 220ms ease',
  ].filter(Boolean).join(';')
  document.body.appendChild(marco)

  const inicio = performance.now()
  let saliendo = false
  const seguir = () => {
    if (!marco.isConnected) return
    const r = el.getBoundingClientRect()
    marco.style.top = `${r.top}px`
    marco.style.left = `${r.left}px`
    marco.style.width = `${r.width}px`
    marco.style.height = `${r.height}px`
    const t = performance.now() - inicio
    if (t > MARCO_VISIBLE_MS && !saliendo) {
      saliendo = true
      marco.style.opacity = '0'
    }
    if (t > MARCO_VISIBLE_MS + (quieto ? 0 : MARCO_SALIDA_MS)) { marco.remove(); return }
    requestAnimationFrame(seguir)
  }
  requestAnimationFrame(() => {
    marco.style.opacity = '1'
    seguir()
  })
}

export function enfocarSeccion(objetivo: ObjetivoPreview): void {
  window.clearTimeout(pendiente)
  const intentar = (n: number) => {
    const el = buscar(objetivo)
    if (!el) {
      if (n < REINTENTOS_MAX) pendiente = window.setTimeout(() => intentar(n + 1), REINTENTO_MS)
      return
    }
    llevarAlaVista(el)
    if (!RESOLUCION[objetivo].marcar) return
    const ahora = Date.now()
    if (ultimo && ultimo.objetivo === objetivo && ahora - ultimo.t < PAUSA_MARCO_MS) return
    ultimo = { objetivo, t: ahora }
    marcar(el)
  }
  intentar(0)
}
