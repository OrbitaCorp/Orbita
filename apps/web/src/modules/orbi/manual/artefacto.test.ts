// El artefacto de la API (manual.generated.ts): que esté al día, y que el
// manual de cada módulo llegue aparte de los temas de Tienda, sin que ningún
// módulo importe a Tienda.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { botonesQueFaltan } from '@/lib/manual/contrato'
import { botonesDelManual, manualDeModuloParaOrbi, type ManualDeModulo } from '@/lib/manual/modulos'
import { armarManualParaOrbi } from '@/modules/ventas/panel/manual/paraOrbi'
import { MANUAL_GIMNASIO } from '@/modules/gimnasio/manual'
import { MANUALES_DE_MODULOS, aArchivoTs, armarArtefacto } from './artefacto'

const ARTEFACTO = '../../../../../api/src/orbi/manual/manual.generated.ts'
const SRC = fileURLToPath(new URL('../../../', import.meta.url))

// Temas de prueba de los otros dos módulos: datos de este test, no archivos de sus módulos (cada uno escribe el suyo).
const DE_PRUEBA: ManualDeModulo[] = [
    { modulo: 'turnos', nombre: 'Turnos', capitulos: [{ id: 'agenda', titulo: 'Agenda', resumen: 'Prueba.', temas: [{ id: 'agenda-del-dia', titulo: 'La agenda del día', bloques: [{ tipo: 'parrafo', texto: 'Tocá [[Nuevo turno]] para dar uno a mano.' }] }] }] },
    { modulo: 'alquileres', nombre: 'Alquileres', capitulos: [{ id: 'reservas', titulo: 'Reservas', resumen: 'Prueba.', temas: [{ id: 'que-hay-libre', titulo: 'Qué hay libre', bloques: [{ tipo: 'nota', variante: 'dato', texto: 'Muestra lo **libre** de hoy.' }] }] }] },
]

describe('artefacto de Orbi (manual.generated.ts)', () => {
    // Si este test falla en CI: cd apps/web && pnpm manual:generar, y commitear
    // apps/api/src/orbi/manual/manual.generated.ts.
    it('manual.generated.ts está al día con el manual de Tienda, los primeros pasos, el menú y los manuales de los módulos', async () => {
        await expect(aArchivoTs(armarArtefacto())).toMatchFileSnapshot(ARTEFACTO)
    })

    it('los temas de Tienda siguen siendo los mismos; los de los módulos van aparte, en `modulos`', () => {
        const a = armarArtefacto()
        expect(a.temas).toEqual(armarManualParaOrbi().temas)
        expect(a.temas.some(t => t.id.startsWith('gimnasio.'))).toBe(false)
        expect(a.modulos.map(m => m.modulo)).toEqual(MANUALES_DE_MODULOS.map(m => m.modulo))
        expect(a.modulos.find(m => m.modulo === 'gimnasio')?.temas.length).toBeGreaterThan(5)
    })

    it('un tema de prueba de Turnos, de Alquileres y de Gimnasio llega al artefacto, en texto plano', () => {
        const a = armarArtefacto([...DE_PRUEBA, MANUAL_GIMNASIO])
        expect(a.modulos.map(m => m.modulo)).toEqual(['turnos', 'alquileres', 'gimnasio'])
        expect(a.modulos[0].temas).toEqual([{ id: 'turnos.agenda-del-dia', capitulo: 'Agenda', titulo: 'La agenda del día', texto: 'Tocá "Nuevo turno" para dar uno a mano.' }])
        expect(a.modulos[1].temas[0]).toMatchObject({ id: 'alquileres.que-hay-libre', texto: 'Dato: Muestra lo libre de hoy.' })
        expect(a.modulos[2].temas.some(t => t.id === 'gimnasio.anotar')).toBe(true)
        // La versión cambia si cambia un tema de un módulo.
        expect(armarArtefacto([...DE_PRUEBA, MANUAL_GIMNASIO]).version).not.toBe(armarArtefacto([MANUAL_GIMNASIO]).version)
    })

    // Las tres que siguen valen para el manual de cualquier módulo que se sume a MANUALES_DE_MODULOS: quien
    // escriba el de Turnos o el de Alquileres queda cubierto sin copiar nada.
    it('ningún manual de módulo ni la librería importan a otro módulo', () => {
        const archivos = [...MANUALES_DE_MODULOS.map(m => `modules/${m.modulo}/manual.ts`), 'lib/manual/bloques.ts', 'lib/manual/modulos.ts', 'lib/manual/contrato.ts']
        for (const archivo of archivos) {
            expect(readFileSync(`${SRC}${archivo}`, 'utf8'), archivo).not.toMatch(/from ['"]@\/modules\//)
        }
    })

    it('cada botón que nombra el manual de un módulo existe, con ese nombre, en las pantallas de ese módulo', () => {
        for (const m of MANUALES_DE_MODULOS) {
            expect(botonesQueFaltan(botonesDelManual(m), `${SRC}modules/${m.modulo}`), `manual de ${m.nombre}`).toEqual([])
        }
    })

    it('cada módulo aparece una sola vez y sus temas no repiten id ni quedan vacíos', () => {
        expect(new Set(MANUALES_DE_MODULOS.map(m => m.modulo)).size).toBe(MANUALES_DE_MODULOS.length)
        for (const m of MANUALES_DE_MODULOS) {
            const temas = manualDeModuloParaOrbi(m).temas
            expect(temas.length, m.nombre).toBeGreaterThan(0)
            expect(new Set(temas.map(t => t.id)).size, `ids repetidos en ${m.nombre}`).toBe(temas.length)
            for (const t of temas) {
                expect(t.id.startsWith(`${m.modulo}.`), t.id).toBe(true)
                expect(t.texto.trim().length, t.id).toBeGreaterThan(40)
                // Para Orbi es texto plano: sin los [[ ]] ni las ** del manual.
                expect(t.texto, t.id).not.toMatch(/\*\*|\[\[|\]\]/)
            }
        }
    })
})
