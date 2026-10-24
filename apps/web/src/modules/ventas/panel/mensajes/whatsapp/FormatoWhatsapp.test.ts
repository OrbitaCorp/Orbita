import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FormatoWhatsapp } from './FormatoWhatsapp'

const html = (t: string) => renderToStaticMarkup(createElement(FormatoWhatsapp, { texto: t }))

describe('FormatoWhatsapp', () => {
  it('negrita, cursiva y tachado, sin los símbolos', () => {
    expect(html('Soy Orbi de *Rama*, _un gusto_ y ~no~ sí')).toBe('Soy Orbi de <strong>Rama</strong>, <em>un gusto</em> y <s>no</s> sí')
  })
  it('el código en línea y el bloque no se formatean por dentro', () => {
    expect(html('usá `*cupón*` ya')).toBe('usá <code class="wa-fmt-codigo">*cupón*</code> ya')
    expect(html('```línea *uno*\ndos```')).toContain('<code class="wa-fmt-bloque">línea *uno*\ndos</code>')
  })
  it('se pueden anidar: negrita con cursiva adentro', () => {
    expect(html('*hola _vos_*')).toBe('<strong>hola <em>vos</em></strong>')
  })
  it('los símbolos pegados a una palabra o sueltos no se tocan (2*3, snake_case_x, un * solo)', () => {
    expect(html('2*3*4')).toBe('2*3*4')
    expect(html('mi_variable_x')).toBe('mi_variable_x')
    expect(html('precio * cantidad')).toBe('precio * cantidad')
    expect(html('* nada *')).toBe('* nada *')
  })
  it('los links quedan tocables, abren afuera y no se llevan la puntuación del final', () => {
    expect(html('Mirá https://rama.orbita.site/p/abcdef12.')).toBe(
      'Mirá <a class="wa-fmt-link" href="https://rama.orbita.site/p/abcdef12" target="_blank" rel="noopener noreferrer">https://rama.orbita.site/p/abcdef12</a>.',
    )
  })
  it('lo que escribe un cliente no puede inyectar HTML ni links peligrosos', () => {
    expect(html('<img src=x onerror=alert(1)> *hola*')).toBe('&lt;img src=x onerror=alert(1)&gt; <strong>hola</strong>')
    expect(html('javascript:alert(1)')).toBe('javascript:alert(1)')
  })
  it('el texto sin formato sale igual', () => {
    expect(html('Hola, ¿tienen talle M?')).toBe('Hola, ¿tienen talle M?')
    expect(html('')).toBe('')
  })
})
