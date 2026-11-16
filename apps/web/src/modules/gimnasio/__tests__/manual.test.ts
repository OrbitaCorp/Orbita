// El manual de Gimnasio contra el panel: cada [[Botón]] que nombra existe con
// ese nombre en las pantallas, y lo que llega a Orbi es texto plano con ids
// únicos. Si una pantalla cambia un botón y el manual no, esto falla.
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { textosDePantallas } from '@/lib/manual/contrato'
import { botonesDelManual, manualDeModuloParaOrbi } from '@/lib/manual/modulos'
import { MANUAL_GIMNASIO } from '../manual'

const PANEL = fileURLToPath(new URL('../admin', import.meta.url))

describe('manual de Gimnasio', () => {
    it('cada botón que nombra existe en el panel de Gimnasio', () => {
        const textos = textosDePantallas(PANEL)
        const botones = botonesDelManual(MANUAL_GIMNASIO)
        expect(botones.length).toBeGreaterThan(10)
        expect(botones.filter(b => !textos.has(b))).toEqual([])
    })

    it('para Orbi: un tema por id, con el módulo adelante y en texto plano', () => {
        const m = manualDeModuloParaOrbi(MANUAL_GIMNASIO)
        const ids = m.temas.map(t => t.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every(id => id.startsWith('gimnasio.'))).toBe(true)
        for (const t of m.temas) {
            expect(t.texto).not.toMatch(/\*\*|\[\[|\]\]/)
            expect(t.texto.length).toBeGreaterThan(40)
        }
        expect(m.temas.find(t => t.id === 'gimnasio.lista-de-espera')?.texto).toMatch(/"A la lista de espera"/)
    })
})
