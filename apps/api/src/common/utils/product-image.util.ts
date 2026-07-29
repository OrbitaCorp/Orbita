type ProductImageLite = { url: string; isPrimary: boolean; optionValueId: string | null };

// Resuelve qué imagen mostrar como principal cuando nadie marcó una a mano —
// típico en productos puramente de variantes (ej. solo talles, sin fotos
// generales) donde el dueño nunca pasó por el picker de "principal". Orden de
// preferencia: (1) la marcada isPrimary, (2) la primera foto GENERAL (sin
// optionValueId), (3) la primera foto de variante que exista.
export function pickPrimaryImageUrl(images: ProductImageLite[]): string | null {
  return (images.find((i) => i.isPrimary) ?? images.find((i) => !i.optionValueId) ?? images[0])?.url ?? null;
}

// Todas las URLs, con la que elegiría pickPrimaryImageUrl() primero y el
// resto detrás en su orden de `position` — para carruseles (vista en grilla
// del panel, storefront) que navegan entre fotos de un producto.
export function orderedImageUrls(images: ProductImageLite[]): string[] {
  const primero = pickPrimaryImageUrl(images);
  if (!primero) return [];
  const resto = images.map((i) => i.url).filter((url) => url !== primero);
  return [primero, ...resto];
}
