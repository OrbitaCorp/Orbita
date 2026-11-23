// El check del catálogo de diseños de promos (ver .claude/skills/disenos-promos).
// Dibuja cada combinación con los componentes reales y revisa lo que un ojo no
// llega a mirar en 114 escenas: que coincida con la API, que se lea y que nada
// salga roto.

import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ESCENAS } from '@/modules/ventas/cliente/juegos/escenas'
import { AnuncioPromo } from './AnuncioPromo'
import { DISENOS_BASICOS, FORMATOS_ANUNCIO, FORMATOS_OFERTA, PRESENTACIONES, TEMATICAS, resolverDiseno, tematicasOrdenadas } from './catalogo'
import { escenaDe } from './escenasTematicas'
import { OfertaDisenada } from './OfertaDisenada'

const api = readFileSync('../api/src/common/disenos-promos.ts', 'utf8')
const listaApi = (nombre: string) => {
    const cuerpo = new RegExp(`${nombre} = \\[([\\s\\S]*?)\\] as const`).exec(api)?.[1] ?? ''
    return [...cuerpo.matchAll(/'([a-z]+)'/g)].map(m => m[1])
}

const canal = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const luz = (h: string) => {
    const [r, g, b] = [1, 3, 5].map(i => canal(parseInt(h.slice(i, i + 2), 16) / 255))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a: string, b: string) => {
    const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m)
    return (x + 0.05) / (y + 0.05)
}

const ROTO = /undefined|NaN|\[object/

describe('catálogo', () => {
    it('los ids coinciden con los que acepta la API', () => {
        expect(TEMATICAS.map(t => t.id).sort()).toEqual(listaApi('TEMATICAS_PROMO').sort())
        expect(FORMATOS_ANUNCIO.map(f => f.id).sort()).toEqual(listaApi('FORMATOS_ANUNCIO').sort())
        expect(FORMATOS_OFERTA.map(f => f.id).sort()).toEqual(listaApi('FORMATOS_OFERTA').sort())
        expect(PRESENTACIONES.map(f => f.id).sort()).toEqual(listaApi('PRESENTACIONES_JUEGO').sort())
    })

    it('no hay ids repetidos y cada temática dice cuándo se usa', () => {
        expect(new Set(TEMATICAS.map(t => t.id)).size).toBe(TEMATICAS.length)
        for (const t of TEMATICAS) {
            expect(t.cuando, t.id).toBeTruthy()
            if (t.grupo === 'temporada') expect(t.meses?.length, t.id).toBeGreaterThan(0)
        }
    })

    it('las de temporada se ordenan desde la próxima fecha', () => {
        expect(tematicasOrdenadas('temporada', new Date(2026, 10, 22))[0].meses).toContain(11)
        expect(tematicasOrdenadas('temporada', new Date(2026, 1, 1)).slice(0, 3).map(t => t.id)).toContain('valentin')
    })

    it('el texto y los botones de cada temática se leen', () => {
        for (const t of TEMATICAS) {
            expect(contraste(t.ui.tx, t.ui.card), `${t.id} texto`).toBeGreaterThanOrEqual(4.5)
            expect(contraste(t.ui.mu, t.ui.card), `${t.id} texto apagado`).toBeGreaterThanOrEqual(4.5)
            expect(contraste(t.ui.on, t.ui.bt), `${t.id} botón`).toBeGreaterThanOrEqual(4.5)
        }
    })
})

describe('escenas', () => {
    const juegos = Object.keys(ESCENAS)

    it('clásico es el dibujo original de cada juego', () => {
        for (const j of juegos) {
            expect(escenaDe(j, 'clasico')).toBe(ESCENAS[j])
            expect(escenaDe(j, null)).toBe(ESCENAS[j])
            expect(escenaDe(j, 'una-tematica-que-no-existe')).toBe(ESCENAS[j])
        }
    })

    it('cada juego se dibuja con cada temática, en cada estado', () => {
        for (const j of juegos) for (const t of TEMATICAS) {
            const e = escenaDe(j, t.id)
            expect(escenaDe(j, t.id), 'tiene que venir del cache: si no, se remonta en cada cuadro').toBe(e)
            for (const estado of ['moviendo', 'acierto', 'fallo'] as const) {
                const html = renderToStaticMarkup(createElement('div', null,
                    createElement(e.Fondo),
                    createElement(e.Objetivo, { estado, etiqueta: '+3%' }),
                    createElement(e.Proyectil, { estado, etiqueta: '+3%' }),
                    e.ObjetivoFrente ? createElement(e.ObjetivoFrente, { estado }) : null,
                    e.FondoFrente ? createElement(e.FondoFrente) : null,
                ))
                expect(ROTO.test(html), `${j}/${t.id}/${estado}`).toBe(false)
            }
        }
    })

    it('misma geometría de juego: la zona de acierto queda al alcance', () => {
        for (const j of juegos) for (const t of TEMATICAS) {
            const e = escenaDe(j, t.id)
            expect(e.amplitud, `${j}/${t.id}`).toBeGreaterThan(12) // pasa por la zona 38-62 y sale de ella
            expect(e.amplitud, `${j}/${t.id}`).toBeLessThanOrEqual(40)
            expect(e.direccion).toBe(ESCENAS[j].direccion)
        }
    })

    it('la etiqueta del premio se escapa', () => {
        const e = escenaDe('CUT', 'navidad')
        const html = renderToStaticMarkup(createElement(e.Objetivo, { estado: 'moviendo', etiqueta: '<img src=x>' }))
        expect(html).not.toContain('<img')
    })
})

describe('formatos', () => {
    const disenos = [...DISENOS_BASICOS.map(d => d.id), ...TEMATICAS.map(t => t.id)]
    const anuncio = { title: 'Título de prueba', message: 'Mensaje', badge: '25% OFF', code: 'PRUEBA25', ctaText: 'Ver', imageUrl: 'https://ejemplo.test/foto.webp' }

    it('cada anuncio se dibuja en cada diseño, con y sin foto', () => {
        for (const f of FORMATOS_ANUNCIO) for (const d of disenos) for (const imageUrl of [anuncio.imageUrl, null]) {
            const html = renderToStaticMarkup(createElement(AnuncioPromo, { anuncio: { ...anuncio, imageUrl }, formato: f.id, diseno: d, onCerrar: () => {} }))
            expect(ROTO.test(html), `${f.id}/${d}`).toBe(false)
            // La pestaña cerrada muestra la etiqueta; el resto, el título.
            expect(html, `${f.id}/${d}`).toContain(f.id === 'pestana' ? '25% OFF' : 'Título de prueba')
            if (!imageUrl) expect(html, `${f.id}/${d}`).not.toContain('<img')
        }
    })

    it('un anuncio con solo título no deja huecos', () => {
        for (const f of FORMATOS_ANUNCIO) {
            const html = renderToStaticMarkup(createElement(AnuncioPromo, { anuncio: { title: 'Solo título' }, formato: f.id, diseno: 'tienda', onCerrar: () => {} }))
            expect(html, f.id).toContain('Solo título')
            expect(ROTO.test(html), f.id).toBe(false)
        }
    })

    it('cada oferta se dibuja en cada diseño y muestra el tiempo real', () => {
        const productos = [{ id: 'p1', nombre: 'Producto', cat: '', precio: 750, precioAnt: 1000, badge: null, hue: 200, stock: true }]
        for (const f of FORMATOS_OFERTA) for (const d of disenos) {
            const restanteMs = (2 * 3600 + 5 * 60 + 9) * 1000
            const html = renderToStaticMarkup(createElement(OfertaDisenada, { formato: f.id, diseno: d, titulo: 'Oferta', off: '25% OFF', restanteMs, productos }))
            expect(ROTO.test(html), `${f.id}/${d}`).toBe(false)
            if (f.id === 'tablero') expect(html, f.id).toContain('<b>05</b>')
            else expect(html, f.id).toContain('02:05:09')
        }
    })

    it('un diseño desconocido cae al color de la tienda', () => {
        expect(resolverDiseno('no-existe').card).toBe('var(--color-primary)')
        expect(resolverDiseno(null).card).toBe('var(--color-primary)')
    })
})
