// Fotos HEIC/HEIF (el formato por defecto de la cámara de iPhone) — ningún
// browser salvo Safari las puede decodificar: ni <img src>, ni canvas, ni
// el preview del <input type="file">. Si se suben tal cual el vendedor ve
// su propia foto rota apenas la carga, y para el resto de los visitantes
// (que no usan Safari) el producto queda sin imagen. La solución no es un
// input distinto: es convertir a JPEG en el momento de elegir el archivo,
// antes de generar cualquier preview o de mandarlo al backend.
//
// Además Chrome en Windows suele reportar `file.type === ''` para .heic/
// .heif (no está en su tabla de MIME), así que la detección de abajo
// también mira la extensión — confiar solo en `file.type` deja pasar el
// archivo sin convertir.

// Espejo del límite real del backend (MAX_IMAGEN_BYTES en
// apps/api/src/common/utils/subida-imagen.ts, que aplica parejo a logo,
// imágenes de Apariencia, fotos de producto y avatar) — no tiene sentido que
// el panel avise un tope más chico del que el backend realmente acepta.
export const MAX_IMAGEN_MB = 10
export const MAX_IMAGEN_BYTES = MAX_IMAGEN_MB * 1024 * 1024

/** Texto estándar de formatos/tamaño para los uploaders de imagen del panel. */
export const FORMATOS_IMAGEN_AYUDA = `PNG, JPG o HEIC · máx ${MAX_IMAGEN_MB}MB`

const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])

function esHeic(file: File): boolean {
    if (HEIC_MIME_TYPES.has(file.type.toLowerCase())) return true
    return /\.hei[cf]$/i.test(file.name)
}

/** true si `file` es una imagen válida para subir — incluye HEIC, que `file.type` a veces no reporta. */
export function esArchivoDeImagen(file: File): boolean {
    return file.type.startsWith('image/') || esHeic(file)
}

/**
 * Si `file` es HEIC/HEIF lo convierte a JPEG (carga el decoder WASM de
 * `heic2any` on-demand, así no engorda el bundle principal). Cualquier otro
 * tipo de archivo se devuelve sin tocar.
 */
export async function normalizarImagen(file: File): Promise<File> {
    if (!esHeic(file)) return file
    const heic2any = (await import('heic2any')).default
    const resultado = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    const blob = Array.isArray(resultado) ? resultado[0] : resultado
    const nombre = file.name.replace(/\.hei[cf]$/i, '.jpg')
    return new File([blob], nombre, { type: 'image/jpeg' })
}
