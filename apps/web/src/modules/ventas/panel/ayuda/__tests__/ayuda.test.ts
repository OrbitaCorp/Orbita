import { describe, expect, it } from 'vitest'
import { CAPITULOS } from '../../manual/contenido'
import { SECCIONES_DEL_PANEL, VISTAS_DE_CONFIGURACION } from '../../secciones'
import { AYUDA_POR_SECCION, ayudaDe, claveDeAyuda } from '../modulos'
import { decidirPrimerosPasos, pasoInicial } from '../primerosPasos'
import { ESTADO_AYUDA_VACIO, parsear } from '../almacen'

// El tutorial de cada módulo sale del manual: si un id de acá deja de existir
// allá, el aviso mostraría una hoja vacía (o ninguna) sin que nadie se entere.
describe('tutorial por módulo', () => {
    it('cada módulo apunta a un capítulo y a temas que existen en el manual', () => {
        for (const [clave, def] of Object.entries(AYUDA_POR_SECCION)) {
            const capitulo = CAPITULOS.find(c => c.id === def.capitulo)
            expect(capitulo, `${clave}: capítulo ${def.capitulo}`).toBeTruthy()
            for (const id of def.temas) {
                expect(capitulo!.temas.some(t => t.id === id), `${clave}: tema ${id}`).toBe(true)
            }
            expect(ayudaDe(clave)?.temas).toHaveLength(def.temas.length)
        }
    })

    it('las claves son secciones del panel o una vista de Configuración', () => {
        for (const clave of Object.keys(AYUDA_POR_SECCION)) {
            const [seccion, vista] = clave.split('/')
            expect(SECCIONES_DEL_PANEL as readonly string[]).toContain(seccion)
            if (vista) expect(VISTAS_DE_CONFIGURACION as readonly string[]).toContain(vista)
        }
    })

    it('Apariencia tiene su tutorial; las demás vistas usan el de Configuración', () => {
        expect(claveDeAyuda('configuracion', 'apariencia')).toBe('configuracion/apariencia')
        expect(claveDeAyuda('configuracion', 'pagos')).toBe('configuracion')
        expect(claveDeAyuda('catalogo', 'nuevo')).toBe('catalogo')
        expect(ayudaDe('perfil')).toBeNull()
    })
})

describe('primeros pasos', () => {
    const base = { seccion: 'dashboard', pospuesto: false, enCurso: false }

    it('categoría → producto → listo, según lo que la API deduce', () => {
        expect(pasoInicial([])).toBe('categoria')
        expect(pasoInicial(['negocio'])).toBe('categoria')
        expect(pasoInicial(['categorias'])).toBe('producto')
        expect(pasoInicial(['producto'])).toBe('listo')
        // Con producto no hace falta categoría.
        expect(pasoInicial(['categorias', 'producto'])).toBe('listo')
    })

    it('sin saber qué tiene hecho no muestra nada', () => {
        expect(decidirPrimerosPasos({ ...base, cumplidas: null })).toEqual({ tipo: 'nada' })
    })

    it('al entrar al Inicio pide empezar; "Más tarde" lo calla ahí', () => {
        expect(decidirPrimerosPasos({ ...base, cumplidas: [] })).toEqual({ tipo: 'modal', paso: 'categoria' })
        expect(decidirPrimerosPasos({ ...base, cumplidas: [], pospuesto: true })).toEqual({ tipo: 'nada' })
    })

    it('no interrumpe en el resto del panel', () => {
        for (const seccion of ['pedidos', 'perfil', 'manual', 'clientes']) {
            expect(decidirPrimerosPasos({ ...base, cumplidas: [], seccion })).toEqual({ tipo: 'nada' })
        }
    })

    it('en la pantalla del paso acompaña con una tira, aunque haya dicho "Más tarde"', () => {
        const r = decidirPrimerosPasos({ ...base, cumplidas: [], seccion: 'categorias', pospuesto: true })
        expect(r.tipo).toBe('tira')
        const p = decidirPrimerosPasos({ ...base, cumplidas: ['categorias'], seccion: 'catalogo', vista: 'nuevo' })
        expect(p).toMatchObject({ tipo: 'tira', paso: 'producto' })
    })

    it('al crear la categoría (sigue en Categorías) pide el producto', () => {
        expect(decidirPrimerosPasos({ ...base, cumplidas: ['categorias'], seccion: 'categorias' }))
            .toEqual({ tipo: 'modal', paso: 'producto' })
    })

    it('el cierre solo lo ve quien pasó por los pasos', () => {
        expect(decidirPrimerosPasos({ ...base, cumplidas: ['producto'] })).toEqual({ tipo: 'nada' })
        expect(decidirPrimerosPasos({ ...base, cumplidas: ['producto'], enCurso: true })).toEqual({ tipo: 'listo' })
    })
})

describe('lo que recuerda el dispositivo', () => {
    it('un valor roto o ajeno vuelve al estado vacío', () => {
        expect(parsear(null)).toEqual(ESTADO_AYUDA_VACIO)
        expect(parsear('no es json')).toEqual(ESTADO_AYUDA_VACIO)
        expect(parsear('{"vistos":[1,"pedidos"],"enCurso":"si"}')).toEqual({ ...ESTADO_AYUDA_VACIO, vistos: ['pedidos'] })
    })
})
