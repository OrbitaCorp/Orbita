import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { pideSuperadmin } from '../acceso'

const SRC = fileURLToPath(new URL('../../../../', import.meta.url))
const PAGINAS = `${SRC}pages/alquileres-demo/`

describe('quién puede ver la demo de Alquileres', () => {
  it('en producción (y staging) pide sesión de superadmin; en desarrollo, no', () => {
    expect(pideSuperadmin('production')).toBe(true)
    expect(pideSuperadmin('development')).toBe(false)
    expect(pideSuperadmin('test')).toBe(false)
    expect(pideSuperadmin(undefined)).toBe(false)
  })

  it('todas las páginas de /alquileres-demo pasan por la compuerta y ninguna da 404 en producción', () => {
    const archivos = readdirSync(PAGINAS).filter(f => f.endsWith('.tsx'))
    expect(archivos.length).toBeGreaterThanOrEqual(6)
    for (const f of archivos) {
      const codigo = readFileSync(PAGINAS + f, 'utf8')
      expect(codigo, `${f}: falta <SoloEquipo>`).toMatch(/<SoloEquipo>/)
      expect(codigo, `${f}: sigue devolviendo notFound`).not.toMatch(/notFound/)
    }
  })

  it('los buscadores no la recorren', () => {
    expect(readFileSync(`${SRC}pages/robots.txt.ts`, 'utf8')).toContain("'/alquileres-demo'")
  })
})
