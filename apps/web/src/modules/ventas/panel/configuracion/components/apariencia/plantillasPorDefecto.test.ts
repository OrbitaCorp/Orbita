import { describe, expect, it } from 'vitest'
import { MARCA_ESTILOS, type MarcaModo } from '@/components/storefront/marca'
import {
    AP_DEFAULTS, BG_PATTERNS, CATEGORY_LAYOUTS, GOOGLE_FONTS, IMAGE_OVERLAYS, VIDEO_LAYOUTS, WHATSAPP_LAYOUTS,
    type Apariencia,
} from '../../mock/apariencia.mock'
import { PLANTILLAS_POR_DEFECTO, aplicarPlantilla, plantillaEnUso } from './plantillasPorDefecto'

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
        expect(IMAGE_OVERLAYS.map(o => o.id)).toContain(p.heroVelo)
        expect(BG_PATTERNS.map(o => o.id)).toContain(p.heroPatron)
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

    // Lo mismo que trae una tienda nueva: si se separan, "Clásica" deja de ser
    // la forma de volver al principio.
    it('Clásica es la apariencia de una tienda nueva', () => {
        expect(plantillaEnUso(AP_DEFAULTS)).toBe('clasica')
    })

    it('aplicar una la deja marcada como en uso', () => {
        for (const p of PLANTILLAS_POR_DEFECTO) expect(plantillaEnUso(aplicarPlantilla(AP_DEFAULTS, p))).toBe(p.id)
    })

    // La regla de la casa: cambia cómo se ve, nunca lo que dice ni lo que muestra.
    it('no toca textos, fotos, interruptores ni el modo de la marca', () => {
        const conContenido: Apariencia = {
            ...AP_DEFAULTS,
            nombreTienda: 'Mi tienda', tagline: 'Hecho a mano', logo: 'https://x/logo.png', marcaModo: 'nombre', marcaEstilo: 'italica',
            mostrarResenas: false, mostrarCategorias: false, mostrarNuevos: false, textoEnvio: 'Envío gratis',
            sliders: AP_DEFAULTS.sliders.map(s => ({ ...s, titulo: 'Mío', img: 'https://x/foto.jpg', imageStyle: 'centered' as const, imagePosition: 'left' as const })),
        }
        for (const p of PLANTILLAS_POR_DEFECTO) {
            const r = aplicarPlantilla(conContenido, p)
            expect(r.nombreTienda).toBe('Mi tienda')
            expect(r.tagline).toBe('Hecho a mano')
            expect(r.logo).toBe('https://x/logo.png')
            expect(r.marcaModo).toBe('nombre')
            expect(r.mostrarResenas).toBe(false)
            expect(r.mostrarCategorias).toBe(false)
            expect(r.mostrarNuevos).toBe(false)
            expect(r.textoEnvio).toBe('Envío gratis')
            expect(r.headerLinks).toEqual(conContenido.headerLinks)
            for (const s of r.sliders) {
                expect(s.titulo).toBe('Mío')
                expect(s.img).toBe('https://x/foto.jpg')
                expect(s.imageStyle).toBe('centered')
                expect(s.imagePosition).toBe('left')
            }
        }
    })
})
