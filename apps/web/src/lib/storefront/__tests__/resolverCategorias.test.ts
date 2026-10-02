import { describe, expect, it } from 'vitest'
import { resolverCategorias, type CatVisual } from '@/modules/ventas/cliente/inicio/Inicio'

const MOCK_CATS: CatVisual[] = [
    { id: 'cat-1', slug: 'celulares', nombre: 'Celulares', count: 10, hue: 120, icon: 'tag', color: null, imageUrl: 'https://example.com/1.jpg' },
    { id: 'cat-2', slug: 'computadoras', nombre: 'Computadoras', count: 5, hue: 200, icon: 'tag', color: null, imageUrl: null },
    { id: 'cat-3', slug: 'electronica', nombre: 'Electrónica', count: 8, hue: 40, icon: 'tag', color: null, imageUrl: 'https://example.com/3.jpg' },
    { id: 'cat-4', slug: 'remeras', nombre: 'Remeras', count: 12, hue: 280, icon: 'tag', color: null, imageUrl: 'https://example.com/4.jpg' },
    { id: 'cat-5', slug: 'pantalones', nombre: 'Pantalones', count: 6, hue: 320, icon: 'tag', color: null, imageUrl: 'https://example.com/5.jpg' },
    { id: 'cat-6', slug: 'zapatillas', nombre: 'Zapatillas', count: 4, hue: 10, icon: 'tag', color: null, imageUrl: 'https://example.com/6.jpg' },
]

describe('resolverCategorias', () => {
    it('en modo índice sin categoryIds devuelve todas las categorías en orden de catálogo', () => {
        const res = resolverCategorias(MOCK_CATS, 'indice', null)
        expect(res.map(c => c.id)).toEqual(['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6'])
    })

    it('en modo índice con categoryIds respeta el orden explícito definido por el usuario', () => {
        // El usuario quiere cat-4 primero, luego cat-1, luego cat-3
        const ordenElegido = ['cat-4', 'cat-1', 'cat-3']
        const res = resolverCategorias(MOCK_CATS, 'indice', ordenElegido)
        expect(res.map(c => c.id)).toEqual(['cat-4', 'cat-1', 'cat-3'])
        expect(res.map(c => c.nombre)).toEqual(['Remeras', 'Celulares', 'Electrónica'])
    })

    it('ignora IDs inexistentes o eliminados manteniendo el orden del resto', () => {
        const ordenElegido = ['cat-3', 'id-inexistente', 'cat-1']
        const res = resolverCategorias(MOCK_CATS, 'indice', ordenElegido)
        expect(res.map(c => c.id)).toEqual(['cat-3', 'cat-1'])
    })

    it('en mosaico respeta orden, filtra por foto y aplica tope de 5', () => {
        // cat-2 no tiene imageUrl
        const ordenElegido = ['cat-4', 'cat-2', 'cat-3', 'cat-1', 'cat-6', 'cat-5']
        const res = resolverCategorias(MOCK_CATS, 'mosaico', ordenElegido)
        // cat-2 se filtra porque no tiene foto, y se toman los primeros 5 con foto
        expect(res.map(c => c.id)).toEqual(['cat-4', 'cat-3', 'cat-1', 'cat-6', 'cat-5'])
    })

    it('en tarjetas aplica tope de 4', () => {
        const ordenElegido = ['cat-6', 'cat-5', 'cat-4', 'cat-3', 'cat-1']
        const res = resolverCategorias(MOCK_CATS, 'tarjetas', ordenElegido)
        expect(res.map(c => c.id)).toEqual(['cat-6', 'cat-5', 'cat-4', 'cat-3'])
    })

    it('en estilos de carrusel (pills, chips, circulos) devuelve cats completas sin alterar', () => {
        const res = resolverCategorias(MOCK_CATS, 'pills', ['cat-4', 'cat-1'])
        expect(res.map(c => c.id)).toEqual(MOCK_CATS.map(c => c.id))
    })
})
