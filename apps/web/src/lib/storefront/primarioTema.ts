// CSS del color primario de una tienda, para modo claro y oscuro.
//
// El primario que elige el dueño (Apariencia → Paleta) es UNO solo, pensado
// casi siempre sobre fondo claro. En el modo oscuro de la tienda (fondo
// #05080F) un primario oscuro — negro, azul marino, bordó — deja de verse: los
// textos, bordes y hovers que usan `var(--color-primary)` (nombre de categoría
// al pasar el mouse, "Ver todas →", el botón "Ingresar") quedan oscuro sobre
// oscuro. Por eso, en `.dark`, un primario demasiado oscuro se aclara hasta una
// luminancia intermedia y se deja de usar tal cual.
//
// Se apunta a una luminancia relativa de ~0.20, que es el punto donde el mismo
// color sirve para las dos cosas que hace en la tienda: texto/acento sobre el
// fondo oscuro (contraste ≥ 4.5:1) y fondo de un botón con texto blanco encima
// (~4.4:1) — hay muchos botones con `color: '#fff'` fijo sobre el primario.
// Un primario que ya es más claro que eso no se toca, en ninguno de los modos.

const LUMINANCIA_MINIMA_OSCURO = 0.2

function aRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// Luminancia relativa WCAG 2.x.
function luminancia([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

const aHex = (rgb: [number, number, number]) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')

// Versión del primario legible sobre el fondo oscuro de la tienda: la misma
// tinta, mezclada con blanco lo mínimo necesario. Devuelve el mismo hex si ya
// alcanza (o si no se puede leer).
export function primarioParaOscuro(hex: string): string {
  const rgb = aRgb(hex)
  if (!rgb || luminancia(rgb) >= LUMINANCIA_MINIMA_OSCURO) return hex
  let lo = 0, hi = 1
  for (let i = 0; i < 14; i++) {
    const t = (lo + hi) / 2
    const mezcla = rgb.map(v => v + (255 - v) * t) as [number, number, number]
    if (luminancia(mezcla) >= LUMINANCIA_MINIMA_OSCURO) hi = t; else lo = t
  }
  return aHex(rgb.map(v => v + (255 - v) * hi) as [number, number, number])
}

// `!important` a propósito: pisa las variables de globals.css (mismo selector,
// misma especificidad) sin depender del orden en que Next inyecte las hojas.
export function cssPrimarioTienda(primario: string): string {
  const oscuro = primarioParaOscuro(primario)
  return `
    :root {
      --color-primary: ${primario} !important;
      --color-primary-bg: color-mix(in srgb, ${primario} 15%, transparent) !important;
      --color-primary-h: color-mix(in srgb, ${primario} 82%, black) !important;
    }
    .dark {
      --color-primary: ${oscuro} !important;
      --color-primary-bg: color-mix(in srgb, ${oscuro} 15%, transparent) !important;
      --color-primary-h: color-mix(in srgb, ${oscuro} 75%, white) !important;
    }`
}
