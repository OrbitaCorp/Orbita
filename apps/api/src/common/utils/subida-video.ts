// Opciones de multer para los endpoints que reciben un video (sección de
// video de Apariencia y el video de producto, alternativa a pegar un link en
// los dos — ver businesses.service.ts#uploadStorefrontVideo, reusado también
// por products.controller.ts#uploadVideo). Mismo criterio de límite explícito
// que subida-imagen.ts (sin `limits`, multer guarda el archivo ENTERO en
// memoria antes de que el service lo mire).
//
// El tope es más alto que el de imagen (10 MB): un video corto ya pesa eso
// solo con la compresión de cualquier celular. Pero acá NO hay reencodeo
// (una imagen se decodifica con sharp, que duplica el buffer en memoria; un
// video se sube tal cual, sin tocarlo) — así que 40 MB deja bastante margen
// contra los 2 GiB de la instancia de Cloud Run sin acercarse al límite que
// llevó a poner esto en primer lugar.
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export const SUBIDA_VIDEO = {
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 20 },
};

export const MENSAJE_VIDEO_GRANDE = `El archivo supera el máximo de ${MAX_VIDEO_BYTES / 1024 / 1024} MB`;

// A diferencia de una imagen (que sharp valida al decodificarla — un archivo
// que no es una imagen simplemente falla ahí), un video no se procesa: si acá
// no se chequea el mimetype, cualquier archivo con el nombre cambiado se
// subiría tal cual con "cara" de video. Los cuatro formatos que reproduce
// directo un <video> de HTML sin plugins.
export const MIME_VIDEO_PERMITIDOS = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

export const EXTENSION_POR_MIME_VIDEO: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
};
