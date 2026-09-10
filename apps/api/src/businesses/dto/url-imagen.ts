// Imágenes de Apariencia (logo, favicon, slides, parallax): una URL https
// (Storage, o una externa que pegó el dueño) o una ruta propia del sitio
// ("/plantillas/..."). Antes era cualquier string (auditoría interna 10/09,
// ítem `api.businesses`); en producción todas cumplen.
//
// Archivo aparte (y no en update-storefront-config.dto.ts) porque lo usan
// también los slides, y ese DTO importa el de los slides: con la constante
// adentro quedaba un import circular.
// '' se acepta: es como el panel limpia un campo (sin imagen).
export const URL_IMAGEN = /^((https:\/\/|\/(?!\/))\S*)?$/;
export const URL_IMAGEN_MENSAJE = 'La imagen tiene que ser una URL https o una ruta del sitio';
