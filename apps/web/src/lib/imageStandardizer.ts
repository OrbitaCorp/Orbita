/**
 * Estandarizador automático de encuadre y escala para fotos de producto.
 *
 * Problema:
 * Los vendedores suben fotos tomadas a diferentes distancias o con recortes
 * arbitrarios: algunas remeras ocupan el 95% del archivo (recortadas al ras)
 * y otras apenas el 40% (con mucho fondo blanco sobrante alrededor). En la
 * tienda, esto produce que los productos se vean de tamaños muy dispares.
 *
 * Solución:
 * 1. Analiza los bordes y el fondo de la imagen (detecta si es PNG transparente
 *    o si tiene fondo sólido/blanco de estudio).
 * 2. Realiza un auto-trim para encontrar la caja delimitadora (bounding box) real
 *    de la prenda/producto, ignorando el aire o fondo sobrante.
 * 3. Si la foto es un producto con fondo uniforme o transparente, la centra en un
 *    lienzo cuadrado estándar (1200x1200px) donde el producto ocupa exactamente
 *    un 90% del espacio (fillRatio), dejando un margen homogéneo y armónico —
 *    ese margen es a propósito: la ficha de producto usa object-fit "cover"
 *    para la foto principal y las miniaturas (ver ProdImage en Thumb.tsx), así
 *    que si el margen queda muy justo, un contenedor no cuadrado (el común:
 *    columna ancha, alto fijo) puede recortar dentro del producto. Vale para
 *    TODOS los ingresos (subida manual, fotos IA, quitar fondo, fondo con
 *    IA) — ninguno debería asumir que puede llenar el lienzo al 100% confiado
 *    en que el fondo generado "ya viene con margen": el margen lo pone
 *    siempre este estandarizador, un solo criterio para toda foto.
 * 4. Si el fondo NO es plano (una alfombra, una pared, una foto de estilo de
 *    vida / exterior), devuelve la foto tal cual: sin recortar y sin rellenar
 *    un lienzo, porque no hay color de relleno que no se note (se vería como un
 *    marco liso alrededor de la foto). "Plano" se mide sobre toda la banda del
 *    borde, no sobre unos pocos puntos: ver analizarBorde().
 */

export interface EstandarizarOpciones {
    /** Tamaño del lienzo cuadrado final en px (default: 1200). */
    targetSize?: number
    /** Ocupación del producto respecto al lienzo (0.90 = 90% de ocupación, 5% margen a cada lado). */
    fillRatio?: number
    /** Calidad JPEG de salida (0.0 a 1.0, default 0.92). */
    calidad?: number
}

// Una foto tiene fondo "plano" si casi toda la banda del borde es del mismo color. Medido
// con las fotos reales de venustyle (05/10/2026): en un fondo de alfombra solo el 13%–32% de
// la banda cae a menos de 16 de distancia del color mediano (nunca supera 0.32), y en un
// fondo liso de estudio es ~100%. El criterio viejo miraba 8 puntos sueltos y la alfombra los
// pasaba; mirar la banda entera deja un margen enorme entre una cosa y la otra.
const BANDA_BORDE = 0.04
const TOLERANCIA_PLANO = 12
const FRACCION_PLANA = 0.9

export interface BordeAnalizado {
    /** Color mediano de la banda del borde. */
    r: number
    g: number
    b: number
    /** Fracción de la banda (0–1) que está a menos de TOLERANCIA_PLANO de ese color. */
    fraccionPlana: number
    /** ¿El fondo es liso? (si no, no hay un color con el que rellenar sin que se note). */
    esPlano: boolean
}

/** Analiza el borde de una imagen RGBA cruda (4 bytes por píxel). Pura: no usa el DOM. */
export function analizarBorde(data: Uint8ClampedArray | Uint8Array, w: number, h: number): BordeAnalizado {
    const grosor = Math.max(2, Math.round(Math.min(w, h) * BANDA_BORDE))
    const rs: number[] = []
    const gs: number[] = []
    const bs: number[] = []
    for (let y = 0; y < h; y++) {
        const enBandaY = y < grosor || y >= h - grosor
        for (let x = 0; x < w; x++) {
            if (!enBandaY && x >= grosor && x < w - grosor) continue
            const i = (y * w + x) * 4
            rs.push(data[i])
            gs.push(data[i + 1])
            bs.push(data[i + 2])
        }
    }
    const mediana = (v: number[]) => Float64Array.from(v).sort()[v.length >> 1]
    const r = mediana(rs)
    const g = mediana(gs)
    const b = mediana(bs)
    let planos = 0
    for (let k = 0; k < rs.length; k++) {
        if (Math.hypot(rs[k] - r, gs[k] - g, bs[k] - b) <= TOLERANCIA_PLANO) planos++
    }
    const fraccionPlana = planos / rs.length
    return { r, g, b, fraccionPlana, esPlano: fraccionPlana >= FRACCION_PLANA }
}

export async function estandarizarImagenProducto(
    file: File | Blob,
    nombreArchivo: string = 'producto.jpg',
    opciones: EstandarizarOpciones = {}
): Promise<File> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return file instanceof File ? file : new File([file], nombreArchivo, { type: file.type || 'image/jpeg' })
    }

    const {
        targetSize = 1200,
        fillRatio = 0.90,
        calidad = 0.92,
    } = opciones

    return new Promise<File>((resolve) => {
        const url = URL.createObjectURL(file)
        const img = new Image()

        img.onload = () => {
            URL.revokeObjectURL(url)
            const origW = img.naturalWidth || img.width
            const origH = img.naturalHeight || img.height

            if (origW < 10 || origH < 10) {
                resolve(file instanceof File ? file : new File([file], nombreArchivo, { type: file.type || 'image/jpeg' }))
                return
            }

            try {
                // 1. Crear canvas de análisis reducido para velocidad extrema (< 15ms)
                const MAX_ANALISIS = 400
                const escalaAnalisis = Math.min(1, MAX_ANALISIS / Math.max(origW, origH))
                const aW = Math.max(1, Math.round(origW * escalaAnalisis))
                const aH = Math.max(1, Math.round(origH * escalaAnalisis))

                const canvasAnalisis = document.createElement('canvas')
                canvasAnalisis.width = aW
                canvasAnalisis.height = aH
                const ctxA = canvasAnalisis.getContext('2d', { willReadFrequently: true })
                if (!ctxA) {
                    resolve(file instanceof File ? file : new File([file], nombreArchivo, { type: file.type || 'image/jpeg' }))
                    return
                }

                ctxA.drawImage(img, 0, 0, aW, aH)
                const imgData = ctxA.getImageData(0, 0, aW, aH)
                const data = imgData.data

                // 2. Determinar si la imagen tiene canal alfa real (transparencia)
                let transparentCount = 0
                const totalMuestras = 100
                for (let k = 0; k < totalMuestras; k++) {
                    const idx = Math.floor(Math.random() * (aW * aH)) * 4
                    if (data[idx + 3] < 220) transparentCount++
                }
                const tieneTransparencia = transparentCount > 2

                let esFondoUniforme = false
                let bgR = 255
                let bgG = 255
                let bgB = 255

                if (!tieneTransparencia) {
                    const borde = analizarBorde(data, aW, aH)
                    esFondoUniforme = borde.esPlano
                    bgR = borde.r
                    bgG = borde.g
                    bgB = borde.b
                }

                // 3. Si no es transparente ni fondo PLANO (una alfombra, una pared, una foto de
                // exterior/lifestyle), la foto se deja tal cual: no hay un color con el que
                // rellenar el lienzo que no se note. Antes se centraba en un lienzo cuadrado
                // blanco (o del color promedio del borde) y quedaba un marco liso alrededor de
                // la foto — en la tarjeta del catálogo se veía como un recuadro blanco o marrón
                // pegado a la foto (venustyle, 05/10/2026). El servidor ya la topea a 1600 px y
                // la pasa a webp al guardarla, así que devolver el original no deja nada sin hacer.
                if (!tieneTransparencia && !esFondoUniforme) {
                    resolve(file instanceof File ? file : new File([file], nombreArchivo, { type: file.type || 'image/jpeg' }))
                    return
                }

                // 4. Bounding Box: Encontrar los límites exactos del producto
                let minX = aW
                let maxX = 0
                let minY = aH
                let maxY = 0
                let pixelesProducto = 0

                const UMBRAL_DIST = 26

                for (let y = 0; y < aH; y++) {
                    for (let x = 0; x < aW; x++) {
                        const i = (y * aW + x) * 4
                        const a = data[i + 3]

                        let esProducto = false
                        if (tieneTransparencia) {
                            esProducto = a > 25
                        } else {
                            const r = data[i]
                            const g = data[i + 1]
                            const b = data[i + 2]
                            const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2)
                            esProducto = dist > UMBRAL_DIST
                        }

                        if (esProducto) {
                            pixelesProducto++
                            if (x < minX) minX = x
                            if (x > maxX) maxX = x
                            if (y < minY) minY = y
                            if (y > maxY) maxY = y
                        }
                    }
                }

                // Si no se detectó nada o es insignificante, devolver original
                if (pixelesProducto < 50 || minX > maxX || minY > maxY) {
                    resolve(file instanceof File ? file : new File([file], nombreArchivo, { type: file.type || 'image/jpeg' }))
                    return
                }

                // Mapear de vuelta a coordenadas del archivo original
                const factorX = origW / aW
                const factorY = origH / aH

                // Margen de seguridad sutil (1-2% para no cortar costuras finas o sombras inmediatas)
                const margenSeg = Math.max(4, Math.round(Math.min(origW, origH) * 0.015))
                const cropX = Math.max(0, Math.floor(minX * factorX) - margenSeg)
                const cropY = Math.max(0, Math.floor(minY * factorY) - margenSeg)
                const cropW = Math.min(origW - cropX, Math.ceil((maxX - minX + 1) * factorX) + margenSeg * 2)
                const cropH = Math.min(origH - cropY, Math.ceil((maxY - minY + 1) * factorY) + margenSeg * 2)

                // 5. Dibujar en el lienzo final cuadrado estandarizado (targetSize x targetSize)
                const canvasOut = document.createElement('canvas')
                canvasOut.width = targetSize
                canvasOut.height = targetSize
                const ctxOut = canvasOut.getContext('2d')
                if (!ctxOut) {
                    resolve(file instanceof File ? file : new File([file], nombreArchivo, { type: file.type || 'image/jpeg' }))
                    return
                }

                if (tieneTransparencia) {
                    ctxOut.clearRect(0, 0, targetSize, targetSize)
                } else {
                    // Si el fondo detectado era blanco o casi blanco (común en fotos de producto),
                    // aseguramos blanco puro (#ffffff) para que se fusione con la ficha de la tienda.
                    if (bgR > 235 && bgG > 235 && bgB > 235) {
                        ctxOut.fillStyle = '#ffffff'
                    } else {
                        ctxOut.fillStyle = `rgb(${bgR},${bgG},${bgB})`
                    }
                    ctxOut.fillRect(0, 0, targetSize, targetSize)
                }

                // Calcular escala para que ocupe exactamente fillRatio del lienzo
                const scale = (targetSize * fillRatio) / Math.max(cropW, cropH)
                const destW = Math.round(cropW * scale)
                const destH = Math.round(cropH * scale)
                const destX = Math.round((targetSize - destW) / 2)
                const destY = Math.round((targetSize - destH) / 2)

                ctxOut.imageSmoothingEnabled = true
                ctxOut.imageSmoothingQuality = 'high'
                ctxOut.drawImage(img, cropX, cropY, cropW, cropH, destX, destY, destW, destH)

                const mimeType = tieneTransparencia ? 'image/png' : 'image/jpeg'
                const ext = tieneTransparencia ? '.png' : '.jpg'
                const outName = nombreArchivo.replace(/\.[^.]+$/, '') + ext

                canvasOut.toBlob((blob) => {
                    if (!blob) {
                        resolve(file instanceof File ? file : new File([file], nombreArchivo, { type: file.type || 'image/jpeg' }))
                        return
                    }
                    resolve(new File([blob], outName, { type: mimeType }))
                }, mimeType, tieneTransparencia ? undefined : calidad)

            } catch (err) {
                console.warn('[imageStandardizer] Error al estandarizar imagen, conservando original:', err)
                resolve(file instanceof File ? file : new File([file], nombreArchivo, { type: file.type || 'image/jpeg' }))
            }
        }

        img.onerror = () => {
            URL.revokeObjectURL(url)
            resolve(file instanceof File ? file : new File([file], nombreArchivo, { type: file.type || 'image/jpeg' }))
        }

        img.src = url
    })
}
