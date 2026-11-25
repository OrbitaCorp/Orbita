// El manual de Gimnasio contra el panel: cada [[Botón]] que nombra existe con
// ese nombre en las pantallas, y lo que llega a Orbi es texto plano con ids
// únicos. Si una pantalla cambia un botón y el manual no, esto falla.
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { botonesQueFaltan } from '@/lib/manual/contrato'
import { botonesDelManual, manualDeModuloParaOrbi } from '@/lib/manual/modulos'
import { MANUAL_GIMNASIO } from '../manual'

const PANEL = fileURLToPath(new URL('../admin', import.meta.url))
// La barra de guardar ("Guardar cambios", "Descartar") es del kit compartido: sus botones también se ven en el panel.
const KIT = fileURLToPath(new URL('../../../design-system/reservas', import.meta.url))

describe('manual de Gimnasio', () => {
    it('cada botón que nombra existe en el panel de Gimnasio', () => {
        const botones = botonesDelManual(MANUAL_GIMNASIO)
        expect(botones.length).toBeGreaterThan(10)
        // Falta el que no está ni en las pantallas del módulo ni en las piezas del kit que esas pantallas usan.
        expect(botonesQueFaltan(botones, [PANEL, KIT])).toEqual([])
        // Sin el kit, los de la barra de guardar faltarían: están en sus piezas, no en las pantallas del módulo.
        expect(botonesQueFaltan(botones, PANEL)).toEqual(['Guardar cambios', 'Descartar'])
        expect(botones).toEqual(expect.arrayContaining(['Guardar cambios', 'Sin definir', 'Quitar el plan', 'Usar los planes sugeridos']))
        // El contrato muerde: un botón que no existe se detecta, y uno que termina en "…" se reconoce.
        expect(botonesQueFaltan(['Un botón que no existe', 'Actividad nueva…'], PANEL)).toEqual(['Un botón que no existe'])
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
        // Lo nuevo del 24/11: cómo paga cada lugar, los alumnos y los planes tienen su tema.
        expect(ids).toEqual(expect.arrayContaining(['gimnasio.como-paga', 'gimnasio.lista-de-alumnos', 'gimnasio.sumar-alumno', 'gimnasio.asignar-plan', 'gimnasio.planes-y-precios']))
        // El sitio: lo que ve quien reserva desde ahí y cómo llega al panel.
        expect(m.temas.find(t => t.id === 'gimnasio.reservar-desde-el-sitio')?.texto).toMatch(/sin definir/)
    })
})
