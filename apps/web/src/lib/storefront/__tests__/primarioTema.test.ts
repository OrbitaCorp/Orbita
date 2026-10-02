import { describe, it, expect } from 'vitest'
import { onColorPara, primarioParaOscuro, cssPrimarioTienda } from '../primarioTema'

describe('primarioTema', () => {
  describe('onColorPara', () => {
    it('devuelve texto blanco sobre colores oscuros o saturados', () => {
      expect(onColorPara('#3B82F6')).toBe('#FFFFFF') // Azul por defecto
      expect(onColorPara('#10B981')).toBe('#FFFFFF') // Verde esmeralda
      expect(onColorPara('#8B5CF6')).toBe('#FFFFFF') // Violeta
      expect(onColorPara('#EF4444')).toBe('#FFFFFF') // Rojo
      expect(onColorPara('#0F172A')).toBe('#FFFFFF') // Slate oscuro
      expect(onColorPara('#000000')).toBe('#FFFFFF') // Negro
    })

    it('devuelve texto oscuro sobre colores claros y pasteles para asegurar contraste', () => {
      expect(onColorPara('#FFFFFF')).toBe('#0F172A') // Blanco
      expect(onColorPara('#FACC15')).toBe('#0F172A') // Amarillo
      expect(onColorPara('#BEF264')).toBe('#0F172A') // Verde lima
      expect(onColorPara('#FDE047')).toBe('#0F172A') // Amarillo claro
      expect(onColorPara('#A7F3D0')).toBe('#0F172A') // Menta claro
    })

    it('fallback seguro a #FFFFFF si el hex es invalido', () => {
      expect(onColorPara('')).toBe('#FFFFFF')
      expect(onColorPara('invalido')).toBe('#FFFFFF')
    })
  })

  describe('cssPrimarioTienda', () => {
    it('inyecta --color-on-primary en :root y en .dark', () => {
      const css = cssPrimarioTienda('#3B82F6')
      expect(css).toContain('--color-primary: #3B82F6 !important;')
      expect(css).toContain('--color-on-primary: #FFFFFF !important;')
    })

    it('inyecta --color-on-primary oscuro si el primario es claro', () => {
      const css = cssPrimarioTienda('#FACC15')
      expect(css).toContain('--color-primary: #FACC15 !important;')
      expect(css).toContain('--color-on-primary: #0F172A !important;')
    })
  })
})
