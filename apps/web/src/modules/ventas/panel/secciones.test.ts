import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SECCIONES_DEL_PANEL, VISTAS_DE_CONFIGURACION } from './secciones'

// La API no puede importar del front (su imagen se construye solo con
// apps/api), así que tiene un espejo de estas listas. Este test es lo único que
// impide que se separen: si alguien agrega una sección acá y se olvida del
// espejo, Orbi seguiría sin ofrecerla (o, peor, ofreciendo una que ya no existe).
const ESPEJO_API = fileURLToPath(new URL('../../../../../api/src/orbi/navegacion/secciones.ts', import.meta.url))
const SHELL = fileURLToPath(new URL('./AdminSeccionShell.tsx', import.meta.url))

// Lee el array `export const <nombre> = [ ... ] as const` de un archivo como
// TEXTO y devuelve sus strings, en orden. Se compara texto y no imports para no
// depender de que el front pueda resolver código de la API.
function arrayDeTexto(archivo: string, nombre: string): string[] {
  const src = readFileSync(archivo, 'utf8')
  const m = new RegExp(`export const ${nombre}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`).exec(src)
  if (!m) throw new Error(`No encontré ${nombre} en ${archivo}`)
  // Se sacan los comentarios de línea antes de juntar los strings.
  const cuerpo = m[1].replace(/\/\/.*$/gm, '')
  return [...cuerpo.matchAll(/'([^']+)'/g)].map(x => x[1])
}

describe('secciones del panel: espejo de la API', () => {
  it('SECCIONES_DEL_PANEL del front y de la API son la misma lista, en el mismo orden', () => {
    expect(arrayDeTexto(ESPEJO_API, 'SECCIONES_DEL_PANEL')).toEqual([...SECCIONES_DEL_PANEL])
  })

  it('VISTAS_DE_CONFIGURACION del front y de la API son la misma lista, en el mismo orden', () => {
    expect(arrayDeTexto(ESPEJO_API, 'VISTAS_DE_CONFIGURACION')).toEqual([...VISTAS_DE_CONFIGURACION])
  })
})

describe('secciones del panel: coinciden con lo que el panel realmente monta', () => {
  it('las claves de componentMap (ventas) son exactamente SECCIONES_DEL_PANEL', () => {
    // Además del tipo (tsc ya lo exige), se chequea el texto: así el test
    // falla aunque alguien afloje el tipo de componentMap.
    const src = readFileSync(SHELL, 'utf8')
    const bloque = /ventas:\s*\{([\s\S]*?)\r?\n\s{4}\},?\s*\r?\n\}/.exec(src)
    expect(bloque).not.toBeNull()
    const claves = [...bloque![1].matchAll(/^\s+(\w+):\s+dynamic\(/gm)].map(x => x[1])
    expect(claves).toEqual([...SECCIONES_DEL_PANEL])
  })

  it('las listas no tienen repetidos y la vista por defecto (negocio) es válida', () => {
    expect(new Set(SECCIONES_DEL_PANEL).size).toBe(SECCIONES_DEL_PANEL.length)
    expect(new Set(VISTAS_DE_CONFIGURACION).size).toBe(VISTAS_DE_CONFIGURACION.length)
    expect(VISTAS_DE_CONFIGURACION).toContain('negocio')
  })

  it('incluye las secciones que Orbi antes no ofrecía', () => {
    for (const s of ['cupones', 'categorias', 'reportes', 'avanzado', 'manual']) {
      expect(SECCIONES_DEL_PANEL).toContain(s)
    }
  })
})
