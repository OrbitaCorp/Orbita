import { describe, it, expect } from 'vitest'
import { estandarizarImagenProducto, analizarBorde } from '../imageStandardizer'

// Imagen RGBA cruda de w×h: cada píxel lo da `color(x, y)`.
function imagen(w: number, h: number, color: (x: number, y: number) => [number, number, number]) {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const [r, g, b] = color(x, y)
            const i = (y * w + x) * 4
            data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255
        }
    }
    return data
}

// Pseudoaleatorio determinista: los tests no pueden depender del azar.
const ruido = (x: number, y: number, amplitud: number) => (((x * 73856093) ^ (y * 19349663)) % 1000) / 1000 * amplitud - amplitud / 2

describe('analizarBorde', () => {
    it('un fondo blanco de estudio con ruido de JPEG es plano', () => {
        const data = imagen(200, 200, (x, y) => [250 + ruido(x, y, 4), 250 + ruido(y, x, 4), 250 + ruido(x + y, y, 4)])
        const borde = analizarBorde(data, 200, 200)
        expect(borde.esPlano).toBe(true)
        expect(borde.r).toBeGreaterThan(240)
    })

    it('una alfombra con textura NO es plana (el caso de venustyle: salía con marco marrón)', () => {
        // Textura de ±30 de amplitud alrededor de un marrón: lo que mide una foto de alfombra real.
        const data = imagen(200, 200, (x, y) => [110 + ruido(x, y, 60), 95 + ruido(y, x, 60), 80 + ruido(x + y, y, 60)])
        const borde = analizarBorde(data, 200, 200)
        expect(borde.esPlano).toBe(false)
        expect(borde.fraccionPlana).toBeLessThan(0.5)
    })

    it('un producto que toca el borde en un tramo corto no invalida un fondo liso', () => {
        // Fondo blanco con la prenda asomando por el borde izquierdo en un tramo de 40 px (~5% de la banda).
        const data = imagen(200, 200, (x, y) => (x < 12 && y >= 80 && y < 120 ? [30, 30, 30] : [255, 255, 255]))
        expect(analizarBorde(data, 200, 200).esPlano).toBe(true)
    })

    it('si la mitad del borde es de otro color (por ejemplo la prenda ocupa todo un costado) no es plano', () => {
        const data = imagen(200, 200, (x) => (x < 12 ? [30, 30, 30] : [255, 255, 255]))
        expect(analizarBorde(data, 200, 200).esPlano).toBe(false)
    })

    it('un borde mitad de un color y mitad de otro no es plano', () => {
        const data = imagen(200, 200, (x) => (x < 100 ? [255, 255, 255] : [20, 20, 20]))
        expect(analizarBorde(data, 200, 200).esPlano).toBe(false)
    })
})

describe('imageStandardizer', () => {
    it('debe existir la función estandarizarImagenProducto', () => {
        expect(typeof estandarizarImagenProducto).toBe('function')
    })

    it('en entorno sin DOM (SSR) devuelve el archivo de entrada sin romper', async () => {
        const dummy = new File(['dummy-content'], 'test.jpg', { type: 'image/jpeg' })
        const res = await estandarizarImagenProducto(dummy, 'test.jpg')
        expect(res).toBeDefined()
        expect(res.name).toBe('test.jpg')
    })
})
