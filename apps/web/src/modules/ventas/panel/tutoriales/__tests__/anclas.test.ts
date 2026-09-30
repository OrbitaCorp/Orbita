import { describe, expect, it } from 'vitest'
import { SELECTORES_ORBI, primeroVisible } from '../anclas'

// El ancla 'header:orbi' del tutorial: el botón de la barra del celular va
// primero y el del menú lateral es el respaldo. Los dos están siempre en el
// DOM (cada uno se oculta con CSS), así que lo que importa es que gane el que
// se VE, no el que exista.

type Fake = { id: string; visible: boolean }
const dom = (...els: [string, Fake][]) => (sel: string) => new Map(els).get(sel) ?? null
const visible = (el: Fake) => el.visible

describe('primeroVisible con los selectores de Orbi', () => {
    const [barra, menu] = SELECTORES_ORBI

    it('prueba primero el aria-label del celular y después el title del menú', () => {
        expect(barra).toBe('[aria-label="Abrir Orbi"]')
        expect(menu).toBe('[title="Orbi AI (Ctrl+K)"]')
    })

    it('en celular gana el botón de la barra', () => {
        const buscar = dom([barra, { id: 'barra', visible: true }], [menu, { id: 'menu', visible: false }])
        expect(primeroVisible(SELECTORES_ORBI, buscar, visible)?.id).toBe('barra')
    })

    it('en escritorio el botón de la barra está oculto: cae al del menú lateral', () => {
        const buscar = dom([barra, { id: 'barra', visible: false }], [menu, { id: 'menu', visible: true }])
        expect(primeroVisible(SELECTORES_ORBI, buscar, visible)?.id).toBe('menu')
    })

    it('si el de la barra no existe, usa el del menú', () => {
        const buscar = dom([menu, { id: 'menu', visible: true }])
        expect(primeroVisible(SELECTORES_ORBI, buscar, visible)?.id).toBe('menu')
    })

    it('si ninguno se ve devuelve null (el tutorial cae a la tarjeta centrada)', () => {
        const buscar = dom([barra, { id: 'barra', visible: false }], [menu, { id: 'menu', visible: false }])
        expect(primeroVisible(SELECTORES_ORBI, buscar, visible)).toBeNull()
        expect(primeroVisible(SELECTORES_ORBI, dom(), visible)).toBeNull()
    })
})
