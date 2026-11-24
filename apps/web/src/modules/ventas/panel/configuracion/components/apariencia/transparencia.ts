// ¿La foto de un slide tiene el fondo transparente? Hace falta para la imagen
// centrada del hero (ver plantillasPorDefecto.ts): con una foto común queda un
// rectángulo pegado sobre el color del slide.
//
// No alcanza con mirar la extensión: todas las imágenes de Apariencia se
// guardan como webp (ver uploadToStorage en businesses.service.ts), tengan o
// no transparencia. Se dibuja la foto chiquita en un canvas y se mira el borde:
// una foto sin fondo tiene píxeles transparentes ahí.
//
// Si no se puede medir (la foto no carga, o el servidor no deja leerla desde
// otro origen), se toma como NO transparente: es el lado seguro, el slide queda
// a imagen completa como siempre.

const cache = new Map<string, Promise<boolean>>()
const LADO = 48

export function tieneTransparencia(url: string): Promise<boolean> {
    const ya = cache.get(url)
    if (ya) return ya
    const p = new Promise<boolean>(resolve => {
        if (typeof document === 'undefined') return resolve(false)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            try {
                const c = document.createElement('canvas')
                c.width = LADO; c.height = LADO
                const ctx = c.getContext('2d', { willReadFrequently: true })
                if (!ctx) return resolve(false)
                ctx.drawImage(img, 0, 0, LADO, LADO)
                const { data } = ctx.getImageData(0, 0, LADO, LADO)
                // Solo el borde: el centro de un producto recortado es opaco.
                let transparentes = 0, total = 0
                for (let y = 0; y < LADO; y++) {
                    for (let x = 0; x < LADO; x++) {
                        if (x !== 0 && y !== 0 && x !== LADO - 1 && y !== LADO - 1) continue
                        total++
                        if (data[(y * LADO + x) * 4 + 3] < 200) transparentes++
                    }
                }
                // Con un cuarto del borde transparente ya es una foto recortada.
                resolve(transparentes / total >= 0.25)
            } catch {
                resolve(false)
            }
        }
        img.onerror = () => resolve(false)
        img.src = url
    })
    cache.set(url, p)
    return p
}
