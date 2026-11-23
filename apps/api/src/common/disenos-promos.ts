// Catálogo de diseños de las promos del paquete Avanzado: juegos con premio,
// anuncios y oferta relámpago. Son solo los ids que la API acepta; el dibujo,
// los nombres y los colores viven en el front
// (apps/web/src/modules/ventas/promos/catalogo.ts). Un test del front compara
// las dos listas: sumar una temática sin registrarla acá la haría rechazar con
// 400 al guardar. Cómo sumar una: .claude/skills/disenos-promos/SKILL.md.

export const TEMATICAS_PROMO = [
  'clasico', 'papel', 'pizarra', 'linea', 'riso', 'noche',
  'verano', 'carnaval', 'valentin', 'pascuas', 'ofertas', 'patria',
  'padre', 'infancias', 'primavera', 'madre', 'halloween', 'navidad', 'anio',
] as const;

// Colores de anuncios y ofertas: los básicos, que toman la marca de la tienda,
// o cualquier temática del catálogo.
export const DISENOS_PROMO = ['tienda', 'claro', 'oscuro', ...TEMATICAS_PROMO] as const;

export const PRESENTACIONES_JUEGO = ['centro', 'lado', 'hoja'] as const;

export const FORMATOS_ANUNCIO = [
  'barra', 'centro', 'partido', 'esquina', 'cinta', 'hoja', 'cupon', 'pantalla', 'pestana',
] as const;

export const FORMATOS_OFERTA = [
  'cartelera', 'reloj', 'tablero', 'vidriera', 'tarjetas', 'tira', 'marquesina',
] as const;
