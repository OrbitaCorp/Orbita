export function fmt(n: number): string {
  return '$ ' + Number(n).toLocaleString('es-AR')
}

export function openWpp(wpp: string, msg?: string) {
  const url = `https://wa.me/${wpp}` + (msg ? `?text=${encodeURIComponent(msg)}` : '')
  window.open(url, '_blank', 'noopener')
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
