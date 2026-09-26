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

/**
 * Optimiza una imagen para el escaneo de visión con IA (Gemini):
 * Normaliza HEIC si aplica y, si la imagen supera 1600px o 1MB, la escala
 * en un canvas a máx 1600px de lado mayor y calidad JPEG 0.85.
 * Esto reduce el tamaño de fotos de celular de 8MB-12MB a ~250KB, acelerando
 * la subida un 95% y evitando timeouts y errores 500 de la API.
 */
export async function optimizarImagenParaScan(file: File): Promise<Blob> {
    const norm = await normalizarImagen(file)
    if (typeof window === 'undefined' || typeof document === 'undefined') return norm

    return new Promise<Blob>((resolve) => {
        const url = URL.createObjectURL(norm)
        const img = new Image()
        img.onload = () => {
            URL.revokeObjectURL(url)
            const maxDim = 1600
            let w = img.width
            let h = img.height

            // Si ya es liviana (< 1600px y < 1.2MB), enviar directa
            if (w <= maxDim && h <= maxDim && norm.size <= 1.2 * 1024 * 1024 && (norm.type === 'image/jpeg' || norm.type === 'image/png')) {
                resolve(norm)
                return
            }

            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((h * maxDim) / w)
                    w = maxDim
                } else {
                    w = Math.round((w * maxDim) / h)
                    h = maxDim
                }
            }

            const canvas = document.createElement('canvas')
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                resolve(norm)
                return
            }
            ctx.drawImage(img, 0, 0, w, h)
            canvas.toBlob((blob) => {
                resolve(blob ?? norm)
            }, 'image/jpeg', 0.85)
        }
        img.onerror = () => {
            URL.revokeObjectURL(url)
            resolve(norm)
        }
        img.src = url
    })
}

