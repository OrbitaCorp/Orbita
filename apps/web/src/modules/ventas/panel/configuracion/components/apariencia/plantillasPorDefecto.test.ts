import { describe, expect, it } from 'vitest'
import { MARCA_ESTILOS, type MarcaModo } from '@/components/storefront/marca'
import { contraste } from '@/lib/storefront/primarioTema'
import {
    AP_DEFAULTS, BG_PATTERNS, BG_PATTERN_SCOPES, CATEGORY_LAYOUTS, GOOGLE_FONTS, IMAGE_OVERLAYS, VIDEO_LAYOUTS, WHATSAPP_LAYOUTS,
    type Apariencia,
} from '../../mock/apariencia.mock'
import { PLANTILLAS_POR_DEFECTO, aplicarPlantilla, plantillaEnUso } from './plantillasPorDefecto'

const FOTO_COMUN = 'https://x/foto.webp'
const FOTO_SIN_FONDO = 'https://x/producto-sin-fondo.webp'
const TRANSPARENTES = new Set([FOTO_SIN_FONDO])

// Una plantilla por defecto es un atajo a los controles de Apariencia: todo lo
// que pone tiene que ser una opción que esos controles ofrecen, o el selector
// queda mostrando un valor que no sabe dibujar.
describe('plantillas por defecto de Apariencia', () => {
    it('los ids no se repiten', () => {
        const ids = PLANTILLAS_POR_DEFECTO.map(p => p.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it.each(PLANTILLAS_POR_DEFECTO.map(p => [p.id, p] as const))('%s usa solo opciones que existen', (_, p) => {
        expect(Object.keys(GOOGLE_FONTS)).toContain(p.fuenteHeading)
        expect(Object.keys(GOOGLE_FONTS)).toContain(p.fuenteBody)
        expect(IMAGE_OVERLAYS.map(o => o.id)).toContain(p.hero.velo)
        expect(BG_PATTERNS.map(o => o.id)).toContain(p.hero.patron)
        expect(BG_PATTERN_SCOPES.map(o => o.id)).toContain(p.hero.alcance)
        expect(WHATSAPP_LAYOUTS.map(o => o.id)).toContain(p.estiloWhatsapp)
        expect(VIDEO_LAYOUTS.map(o => o.id)).toContain(p.videoLayout)
        // Nunca un estilo de categorías que necesite foto: sin fotos cargadas,
        // la sección quedaría rota.
        const cat = CATEGORY_LAYOUTS.find(c => c.id === p.estiloCategorias)
        expect(cat?.necesitaFoto).toBe(false)
        for (const modo of Object.keys(MARCA_ESTILOS) as MarcaModo[]) {
            expect(MARCA_ESTILOS[modo].map(e => e.id)).toContain(p.marca[modo])
        }
        for (const c of [p.colorPrimario, p.colorSecundario, p.colorAccent]) expect(c).toMatch(/^#[0-9A-F]{6}$/i)
    })

    // Con imagen centrada el texto del slide va siempre en blanco (HeroCarousel
    // en Inicio.tsx): el color del slide tiene que dejar leerlo.
    it.each(PLANTILLAS_POR_DEFECTO.filter(p => p.hero.formato === 'centrada').map(p => [p.id, p] as const))(
        '%s: el color del slide centrado se lee con texto blanco', (_, p) => {
            expect(p.hero.fondo).toMatch(/^#[0-9A-F]{6}$/i)
            expect(contraste(p.hero.fondo, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
        })

    // Sobre una foto común el texto va en blanco (salvo con el velo blanco):
    // necesita un velo que oscurezca justo donde está. Los degradés de arriba
    // y de abajo solo oscurecen ese borde.
    it.each(PLANTILLAS_POR_DEFECTO.map(p => [p.id, p] as const))('%s: el texto queda sobre el velo', (_, p) => {
        expect(p.hero.velo).not.toBe('none')
        if (p.hero.velo === 'bottom') expect(p.hero.textoV).toBe('bottom')
        if (p.hero.velo === 'top') expect(p.hero.textoV).toBe('top')
    })

    it('hay variedad de sliders: formatos, velos y lugares del texto', () => {
        expect(new Set(PLANTILLAS_POR_DEFECTO.map(p => p.hero.velo)).size).toBeGreaterThanOrEqual(6)
        expect(new Set(PLANTILLAS_POR_DEFECTO.map(p => `${p.hero.textoH}-${p.hero.textoV}`)).size).toBeGreaterThanOrEqual(6)

        const formatos = new Set(PLANTILLAS_POR_DEFECTO.map(p => p.hero.formato))
        expect(formatos).toEqual(new Set(['completa', 'centrada']))
    })

    // Lo mismo que trae una tienda nueva: si se separan, "Clásica" deja de ser
    // la forma de volver al principio.
    it('Clásica es la apariencia de una tienda nueva', () => {
        expect(plantillaEnUso(AP_DEFAULTS)).toBe('clasica')
    })

    it('aplicar una la deja marcada como en uso', () => {
        const conFotos: Apariencia = { ...AP_DEFAULTS, sliders: AP_DEFAULTS.sliders.map((s, i) => ({ ...s, img: [FOTO_COMUN, FOTO_SIN_FONDO, null][i] ?? null })) }
        for (const p of PLANTILLAS_POR_DEFECTO) {
            expect(plantillaEnUso(aplicarPlantilla(AP_DEFAULTS, p))).toBe(p.id)
            expect(plantillaEnUso(aplicarPlantilla(conFotos, p, TRANSPARENTES), TRANSPARENTES)).toBe(p.id)
        }
    })

    // La imagen centrada es para fotos sin fondo (PNG): una foto común quedaría
    // como un rectángulo pegado sobre el color del slide.
    it('la imagen centrada va solo en slides con foto sin fondo o sin foto', () => {
        const ap: Apariencia = {
            ...AP_DEFAULTS,
            sliders: [
                { ...AP_DEFAULTS.sliders[0], img: FOTO_COMUN },
                { ...AP_DEFAULTS.sliders[1], img: FOTO_SIN_FONDO },
                { ...AP_DEFAULTS.sliders[2], img: null },
            ],
        }
        for (const p of PLANTILLAS_POR_DEFECTO.filter(x => x.hero.formato === 'centrada')) {
            const [comun, sinFondo, sinFoto] = aplicarPlantilla(ap, p, TRANSPARENTES).sliders
            expect(comun.imageStyle).toBe('full')
            expect(comun.bgColor).toBe('')
            expect(sinFondo.imageStyle).toBe('centered')
            expect(sinFondo.bgColor).toBe(p.hero.fondo)
            expect(sinFoto.imageStyle).toBe('centered')
        }
        // Sin medir (o si no se pudo medir), ninguna foto se toma como sin fondo.
        for (const p of PLANTILLAS_POR_DEFECTO.filter(x => x.hero.formato === 'centrada')) {
            expect(aplicarPlantilla(ap, p).sliders[1].imageStyle).toBe('full')
        }
    })

    // La regla de la casa: cambia cómo se ve, nunca lo que dice ni lo que muestra.
    it('no toca textos, fotos, interruptores ni el modo de la marca', () => {
        const conContenido: Apariencia = {
            ...AP_DEFAULTS,
            nombreTienda: 'Mi tienda', tagline: 'Hecho a mano', logo: 'https://x/logo.png', marcaModo: 'nombre', marcaEstilo: 'italica',
            mostrarResenas: false, mostrarCategorias: false, mostrarNuevos: false, textoEnvio: 'Envío gratis',
            sliders: AP_DEFAULTS.sliders.map(s => ({ ...s, titulo: 'Mío', subtitulo: 'Sub', cta: 'Ver', ctaLink: '/catalogo/x', img: FOTO_COMUN })),
        }
        for (const p of PLANTILLAS_POR_DEFECTO) {
            const r = aplicarPlantilla(conContenido, p, TRANSPARENTES)
            expect(r.nombreTienda).toBe('Mi tienda')
            expect(r.tagline).toBe('Hecho a mano')
            expect(r.logo).toBe('https://x/logo.png')
            expect(r.marcaModo).toBe('nombre')
            expect(r.mostrarResenas).toBe(false)
            expect(r.mostrarCategorias).toBe(false)
            expect(r.mostrarNuevos).toBe(false)
            expect(r.textoEnvio).toBe('Envío gratis')
            expect(r.headerLinks).toEqual(conContenido.headerLinks)
            expect(r.sliders.map(s => s.id)).toEqual(conContenido.sliders.map(s => s.id))
            for (const s of r.sliders) {
                expect([s.titulo, s.subtitulo, s.cta, s.ctaLink, s.img]).toEqual(['Mío', 'Sub', 'Ver', '/catalogo/x', FOTO_COMUN])
            }
        }
    })
})
