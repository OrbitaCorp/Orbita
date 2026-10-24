import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RECORRIDOS } from '../recorridos'

// Cada recorrido señala botones y textos tal como se ven en pantalla. Si alguien
// les cambia el rótulo, el paso se quedaría sin foco sin que nadie se entere:
// este test es el aviso. Es el mismo criterio que manual/contrato.test.ts.

const SRC = fileURLToPath(new URL('../../../../../', import.meta.url))

function archivosDe(dir: string): string[] {
    return readdirSync(dir).flatMap(nombre => {
        const ruta = join(dir, nombre)
        if (nombre === 'node_modules' || nombre === '.next') return []
        if (statSync(ruta).isDirectory()) return archivosDe(ruta)
        return /\.tsx$/.test(nombre) && !/\.test\./.test(nombre) ? [ruta] : []
    })
}

// La ayuda y el manual no son pantallas: sus textos no cuentan como "existe en la pantalla".
const NO_ES_PANTALLA = [/[\/]ayuda[\/]/, /[\/]manual[\/]/, /[\/]mock[\/]/, /[\/]tutoriales[\/]/]
const fuente = archivosDe(SRC)
    .filter(f => !NO_ES_PANTALLA.some(r => r.test(f)))
    .map(f => readFileSync(f, 'utf8'))
    .join('\n')

describe('lo que señalan los recorridos existe en las pantallas', () => {
    for (const [clave, r] of Object.entries(RECORRIDOS)) {
        for (const p of r.pasos) {
            if (!p.donde) continue
            if ('ayuda' in p.donde) {
                const marca = `data-ayuda="${p.donde.ayuda}"`
                it(`${clave} → ${marca}`, () => {
                    expect(fuente.includes(marca), `ninguna pantalla lleva ${marca}`).toBe(true)
                })
                continue
            }
            const texto = 'boton' in p.donde ? p.donde.boton : p.donde.texto
            it(`${clave} → "${texto}"`, () => {
                expect(fuente.includes(texto), `no se encontró «${texto}» en ninguna pantalla`).toBe(true)
            })
        }
    }
})
