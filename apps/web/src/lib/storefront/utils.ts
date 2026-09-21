import { normalizarWhatsApp } from '@/lib/utils'

export function fmt(n: number): string {
  return '$ ' + Number(n).toLocaleString('es-AR')
}

// "Grilla de productos" de Apariencia (Configuración → Apariencia → Diseño y
// layout, config.appearance.gridLayout) — hasta acá se guardaba pero ninguna
// página de listado la leía, así que elegir 3/4 columnas o Lista no cambiaba
// nada en la tienda real (reportado). Compartido entre Catalogo.tsx y
// Categoria.tsx, las dos páginas de listado de productos, para que no queden
// dos copias del mismo criterio.
//
// Columnas en tablet/desktop — mobile siempre fuerza 2 vía media query en
// cada página, sin importar esto (una grilla de 4 en un celular no entra).
export function columnasDeGrilla(gridLayout: string | null | undefined): string {
  return gridLayout === '4col' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)'
}

// 'list': el listado se dibuja como filas (ProductCard layout="list") en vez
// de grilla — en Catalogo.tsx el shopper puede además cambiarlo a mano con
// su propio selector (viewMode), que arranca en este valor pero después
// manda él; en Categoria.tsx no hay selector propio, así que esto es lo
// único que decide.
export function esGrillaDeLista(gridLayout: string | null | undefined): boolean {
  return gridLayout === 'list'
}

export function openWpp(wpp: string, msg?: string) {
  const url = `https://wa.me/${normalizarWhatsApp(wpp)}` + (msg ? `?text=${encodeURIComponent(msg)}` : '')
  window.open(url, '_blank', 'noopener')
}

// Instagram/TikTok/Facebook en Configuración: antes solo aceptaba el link
// completo (era literalmente el `href` del ícono del footer, sin ninguna
// transformación) — pedirle a un dueño de tienda que pegue
// "https://www.instagram.com/mi_negocio/" es más fricción de la necesaria
// cuando alcanza con el usuario. Ahora el campo acepta CUALQUIERA de los
// dos: si ya parece un link (empieza con http/https), se usa tal cual —
// así una tienda que ya había cargado el link completo antes de este
// cambio no se rompe — si no, se arma la URL a partir del usuario (sacando
// un "@" de más si lo escribió, costumbre de Instagram/TikTok).
const BASE_RED_SOCIAL: Record<'instagram' | 'tiktok' | 'facebook', string> = {
  instagram: 'https://instagram.com/',
  tiktok: 'https://tiktok.com/@',
  facebook: 'https://facebook.com/',
}

export function urlRedSocial(valor: string, red: keyof typeof BASE_RED_SOCIAL): string {
  const v = valor.trim()
  if (!v) return v
  if (/^https?:\/\//i.test(v)) return v
  return BASE_RED_SOCIAL[red] + v.replace(/^@/, '')
}

export function descuento(precio: number, precioAnt: number): number {
  return Math.round((1 - precio / precioAnt) * 100)
}

// Umbral de "queda poco" cuando el stock se agota EN VIVO por lo que el
// propio cliente ya tiene en su carrito — no depende de revalidar contra el
// backend, así que una variante con maxQty alto (ej. 20) puede pasar a verse
// "casi agotada" apenas el cliente agrega varias unidades en la misma
// sesión. Se combina con `lowStock` (server-side, contra VariantStock.
// stockMin) para no perder ese aviso cuando el cliente todavía no agregó nada.
export const UMBRAL_POCAS_UNIDADES_LOCAL = 5

export function quedanPocas(restante: number, lowStockBackend: boolean): boolean {
  return restante > 0 && (lowStockBackend || restante <= UMBRAL_POCAS_UNIDADES_LOCAL)
}

// Foto de una variante puntual — cruza sus optionValueIds contra
// ProductImage.optionValueId (mismo criterio que ya usa el backend en
// storefront.service.ts validateCart()), cayendo a la primaria/primera
// imagen del producto si esa combinación no tiene foto propia. Se usa al
// agregar al carrito (ProductCard, ProductoDetalle, VariantPickerModal) para
// que el carrito muestre la foto real en vez de solo el degradé de `hue`.
export function imagenParaVariante(
  images: { url: string; isPrimary: boolean; optionValueId: string | null }[],
  optionValueIds: string[],
): string | undefined {
  const ids = new Set(optionValueIds)
  const conFoto = images.find(i => i.optionValueId && ids.has(i.optionValueId))
  if (conFoto) return conFoto.url
  return (images.find(i => i.isPrimary) ?? images[0])?.url
}

// "LA" variante de un producto sin opciones — normalmente hay una sola, pero
// si el producto quedó con más de una por algún dato corrupto (dos filas
// "sin opciones" en vez de una editada), hay que elegir siempre la MISMA que
// ya eligió el backend al armar el precio/maxQty que se está mostrando
// (mismo criterio que precioRepresentativo() en storefront.service.ts):
// primero la marcada isDefault, si no la que tiene stock, si no la primera.
export function variantePrincipal<V extends { isDefault: boolean; inStock: boolean }>(variants: V[]): V | undefined {
  return variants.find(v => v.isDefault) ?? variants.find(v => v.inStock) ?? variants[0]
}

// Gradient tile background used as image placeholder
export function thumbGradient(hue: number): string {
  return `repeating-linear-gradient(135deg,
    oklch(0.84 0.06 ${hue}) 0px 28px,
    oklch(0.80 0.06 ${hue}) 28px 56px)`
}

// Alternate gradient — opposite angle + lighter, simulates a second product angle
export function thumbGradientAlt(hue: number): string {
  return `repeating-linear-gradient(-45deg,
    oklch(0.89 0.08 ${hue}) 0px 32px,
    oklch(0.83 0.06 ${hue}) 32px 64px)`
}

// Sección de video de Apariencia (Inicio.tsx § "VIDEO", StorePreview.tsx) —
// el dueño pega CUALQUIER link (YouTube, Vimeo, o el archivo directo), no
// sube nada: no hay infraestructura propia de Órbita para alojar video, y
// construirla (storage, límites de tamaño, transcodificación) es un problema
// aparte. Esta función decide CÓMO embeberlo según la forma del link — un
// solo lugar, compartido entre el storefront real y el preview del panel,
// para que los dos entiendan exactamente los mismos links.
//
// 'youtube'/'vimeo' devuelven la URL de un <iframe> (con el id sacado del
// link, así sirve tanto un link "para compartir" como uno "embed" que el
// dueño haya pegado tal cual); 'file' devuelve el link tal cual, para un
// <video> nativo. Un link que no matchea ninguna forma conocida (mal
// pegado, u otro host no soportado) devuelve null — la sección entera no se
// dibuja en vez de mostrar un cuadro roto.
const YOUTUBE_ID = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
const VIMEO_ID = /vimeo\.com\/(?:video\/)?(\d+)/
const ARCHIVO_VIDEO = /\.(mp4|webm|ogg|mov)(\?\S*)?$/i

export type VideoEmbed = { tipo: 'youtube' | 'vimeo'; src: string } | { tipo: 'file'; src: string }

export function parseVideoEmbed(url: string | null | undefined): VideoEmbed | null {
  const v = url?.trim()
  if (!v) return null
  const yt = v.match(YOUTUBE_ID)
  if (yt) return { tipo: 'youtube', src: `https://www.youtube-nocookie.com/embed/${yt[1]}` }
  const vm = v.match(VIMEO_ID)
  if (vm) return { tipo: 'vimeo', src: `https://player.vimeo.com/video/${vm[1]}` }
  if (ARCHIVO_VIDEO.test(v)) return { tipo: 'file', src: v }
  return null
}
