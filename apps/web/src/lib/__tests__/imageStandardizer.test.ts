import { describe, it, expect } from 'vitest'
import { estandarizarImagenProducto } from '../imageStandardizer'

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
