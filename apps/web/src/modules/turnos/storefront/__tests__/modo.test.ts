// La plantilla dada vuelta (conModo / paletaEnModo): el visitante elige claro
// sobre una plantilla oscura o al revés, y todo tiene que seguir leyéndose.
import { describe, expect, it } from 'vitest'
import { RUBROS_TURNOS } from '@/modules/turnos/datos'
import { conModo, plantillasDelRubro, temaDe } from '../tema'
import { aplicarPlantilla, contraste, legibleSobre, paletaEnModo } from '../plantillas'

describe('paletaEnModo', () => {
  const marcas = ['#F5B83D', '#C8F03A', '#7A1F2E', '#0F766E', '#DB2777', '#111111', '#FFFFFF']
  it('texto, cuerpo, apagado y marca pasan AA sobre el fondo y la superficie, en los dos modos', () => {
    for (const marca of marcas) {
      for (const oscuro of [true, false]) {
        const p = paletaEnModo({ bg: '#000000', surface: '#111111', surfaceAlt: '#222222', border: '#333333', text: '#FFFFFF', body: '#DDDDDD', muted: '#AAAAAA', primary: marca, primaryH: marca, onPrimary: '#000000', primaryBg: '#000000' }, oscuro)
        for (const fondo of [p.bg, p.surface]) {
          expect(contraste(p.text, fondo), `${marca} ${oscuro} texto`).toBeGreaterThanOrEqual(4.5)
          expect(contraste(p.body, fondo), `${marca} ${oscuro} cuerpo`).toBeGreaterThanOrEqual(4.5)
          expect(contraste(p.muted, fondo), `${marca} ${oscuro} apagado`).toBeGreaterThanOrEqual(4.5)
        }
        expect(contraste(p.primary, p.bg), `${marca} ${oscuro} marca`).toBeGreaterThanOrEqual(4.5)
        expect(contraste(p.onPrimary, p.primary), `${marca} ${oscuro} sobre la marca`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('legibleSobre deja el color quieto si ya se lee y lo corre lo justo si no', () => {
    expect(legibleSobre('#111111', '#FFFFFF')).toBe('#111111')
    const dorado = legibleSobre('#F5B83D', '#FAFAF8')
    expect(dorado).not.toBe('#F5B83D')
    expect(contraste(dorado, '#FAFAF8')).toBeGreaterThanOrEqual(4.5)
    expect(contraste(dorado, '#FAFAF8')).toBeLessThan(7)
  })
})

describe('conModo', () => {
  it('con el modo propio devuelve el mismo tema; con el otro, cambia la paleta y los estados y conserva la plantilla', () => {
    for (const rubro of RUBROS_TURNOS) {
      const t = temaDe(rubro)
      expect(conModo(t, t.oscuro)).toBe(t)
      const v = conModo(t, !t.oscuro)
      expect(v.oscuro).toBe(!t.oscuro)
      expect([v.estilo, v.composicion, v.tarjeta, v.forma, v.textura, v.fh, v.fb, v.fotoHero]).toEqual([t.estilo, t.composicion, t.tarjeta, t.forma, t.textura, t.fh, t.fb, t.fotoHero])
      expect(v.e.acento).toBe(t.e.acento)
      expect(v.e.ok).not.toBe(t.e.ok)
      expect(contraste(v.c.text, v.c.bg)).toBeGreaterThanOrEqual(4.5)
      expect(contraste(v.c.primary, v.c.bg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('las cinco plantillas de cada rubro se leen dadas vuelta', () => {
    for (const rubro of RUBROS_TURNOS) {
      const base = temaDe(rubro)
      for (const p of plantillasDelRubro(rubro)) {
        const t = aplicarPlantilla(base, p)
        const v = conModo(t, !t.oscuro)
        expect(contraste(v.c.text, v.c.surface), `${rubro.key} ${p.id}`).toBeGreaterThanOrEqual(4.5)
        expect(contraste(v.c.muted, v.c.bg), `${rubro.key} ${p.id}`).toBeGreaterThanOrEqual(4.5)
        expect(contraste(v.c.primary, v.c.bg), `${rubro.key} ${p.id}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
