import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PLANTILLAS } from './datos'
import { PLANTILLAS_LIBRES } from './libres'

// La API decide qué plantillas se activan sin el paquete Avanzado; el panel
// solo lo muestra. Si las dos listas se separan, el panel ofrece "Usarla en mi
// tienda" a quien la API después rechaza (o al revés).
describe('plantillas libres para el plan Base', () => {
    it('coinciden con HOME_TEMPLATES_LIBRES de la API', () => {
        const dto = readFileSync(fileURLToPath(new URL('../../../../../../../api/src/businesses/dto/set-home-template.dto.ts', import.meta.url)), 'utf8')
        const m = dto.match(/HOME_TEMPLATES_LIBRES = \[([^\]]*)\]/)
        expect(m).not.toBeNull()
        const api = [...m![1].matchAll(/'([a-z]+)'/g)].map(x => x[1])
        expect([...PLANTILLAS_LIBRES].sort()).toEqual(api.sort())
    })

    it('son plantillas que existen y se ofrecen', () => {
        for (const id of PLANTILLAS_LIBRES) {
            const p = PLANTILLAS.find(x => x.id === id)
            expect(p, id).toBeDefined()
            expect(p!.oculta, id).toBeFalsy()
        }
    })
})
