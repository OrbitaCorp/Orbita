import { BadRequestException } from '@nestjs/common';

// Los botones de los anuncios del paquete Avanzado (countdown, exit-intent)
// mandan SIEMPRE a algún lado de la propia tienda. Se acepta solo una ruta
// relativa: un link a otro dominio metido desde el panel convertiría un
// anuncio de la tienda en un trampolín a cualquier sitio, cosa que el visitante
// no puede prever leyendo el cartel. `//otro.com` se rechaza aparte porque
// empieza con "/" pero el navegador lo resuelve como dominio externo.
export function normalizarLinkDeTienda(link: string | undefined | null): string | null {
  const limpio = link?.trim();
  if (!limpio) return null;
  if (!limpio.startsWith('/') || limpio.startsWith('//')) {
    throw new BadRequestException('El link tiene que ser una ruta de tu tienda, por ejemplo /catalogo');
  }
  return limpio;
}
