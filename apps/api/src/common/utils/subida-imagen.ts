// Opciones de multer para todos los endpoints que reciben una imagen (logo,
// imágenes de Apariencia, fotos de producto, avatar del cliente).
//
// Sin `limits`, multer acepta un archivo de cualquier tamaño y lo guarda
// ENTERO en memoria antes de que el service lo mire: el tope de 10 MB del
// body (main.ts) es de body-parser y no alcanza a multipart. Un solo POST de
// 2 GB tiraba abajo la instancia de Cloud Run (2 GiB de memoria).
// Auditoría técnica 04/09 (hallazgo "Subidas sin límite explícito"), cerrado
// en la auditoría interna del 10/09, ítem `api.businesses`.
//
// 10 MB alcanza para la foto de cualquier celular. Todo se recodifica a webp
// después, así que lo que se guarda en Storage pesa mucho menos.
export const MAX_IMAGEN_BYTES = 10 * 1024 * 1024;

export const SUBIDA_IMAGEN = {
  limits: { fileSize: MAX_IMAGEN_BYTES, files: 1, fields: 20 },
};

// Mensaje del 413 que arma multer ("File too large"), en castellano. Lo usa
// HttpExceptionFilter.
export const MENSAJE_IMAGEN_GRANDE = `El archivo supera el máximo de ${MAX_IMAGEN_BYTES / 1024 / 1024} MB`;
