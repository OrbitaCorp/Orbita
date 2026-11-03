import { describe, expect, it } from 'vitest'
import { SECCIONES_DEL_PANEL, VISTAS_DE_CONFIGURACION } from '../../secciones'
import { RECORRIDOS, claveDeAyuda, recorridoDe } from '../recorridos'
import { coincide, normalizar } from '../ubicar'
import { decidirPrimerosPasos, pasoInicial } from '../primerosPasos'
import { ESTADO_AYUDA_VACIO, parsear } from '../almacen'
import { puedeUsarModoPrueba, comandoDeQuery, cumplidasSimuladas, siguientePasoDePrueba } from '../acceso'
import { INTERVALO_MS, SUGERENCIAS, claveDeSugerencia, elegirSugerencia } from '../sugerencias'

describe('recorrido por módulo', () => {
    it('las claves son secciones del panel o una vista de Configuración', () => {
        for (const clave of Object.keys(RECORRIDOS)) {
            const [seccion, vista] = clave.split('/')
            expect(SECCIONES_DEL_PANEL as readonly string[]).toContain(seccion)
            if (!vista) continue
            // Configuración: una vista suya. El resto: la vista del formulario de creación.
            if (seccion === 'configuracion') expect(VISTAS_DE_CONFIGURACION as readonly string[]).toContain(vista)
            else expect(['crear', 'nuevo', 'nueva', 'plantilla']).toContain(vista)
        }
    })

    it('cada pantalla de Configuración tiene su recorrido (menos la zona peligrosa)', () => {
        for (const v of VISTAS_DE_CONFIGURACION) {
            if (v === 'peligro' || v === 'general') continue
            expect(recorridoDe(claveDeAyuda('configuracion', v)), `configuracion/${v}`).not.toBeNull()
        }
    })

    it('cada sección del panel tiene recorrido, salvo el manual', () => {
        for (const sec of SECCIONES_DEL_PANEL) {
            if (sec === 'manual' || sec === 'configuracion') continue
            expect(recorridoDe(claveDeAyuda(sec)), sec).not.toBeNull()
        }
    })

    it('los formularios de creación tienen su propia guía, y la lista apunta a ella', () => {
        expect(claveDeAyuda('descuentos', 'crear')).toBe('descuentos/crear')
        expect(claveDeAyuda('cupones', 'crear')).toBe('cupones/crear')
        expect(claveDeAyuda('catalogo', 'nuevo')).toBe('catalogo/nuevo')
        expect(claveDeAyuda('pedidos', 'nuevo')).toBe('pedidos/nuevo')
        // Lo que no es creación sigue con la guía del módulo.
        expect(claveDeAyuda('pedidos', 'historial')).toBe('pedidos')
        expect(claveDeAyuda('descuentos', 'metricas')).toBe('descuentos')
        for (const clave of ['descuentos/crear', 'cupones/crear', 'catalogo/nuevo', 'pedidos/nuevo', 'categorias/nueva', 'mensajes/plantilla', 'configuracion/equipo/invitar']) {
            expect(recorridoDe(clave), clave).not.toBeNull()
            expect(recorridoDe(clave)?.pregunta, clave).toBeTruthy()
        }
    })

    it('tocar lo señalado en un paso lleva a una guía que existe', () => {
        for (const [clave, r] of Object.entries(RECORRIDOS)) {
            for (const p of r.pasos) {
                if (p.alTocar) expect(recorridoDe(p.alTocar), `${clave} → ${p.alTocar}`).not.toBeNull()
            }
        }
    })

    it('Configuración sin vista (o con la vieja "general") abre el recorrido de Negocio', () => {
        expect(claveDeAyuda('configuracion')).toBe('configuracion/negocio')
        expect(claveDeAyuda('configuracion', 'general')).toBe('configuracion/negocio')
        expect(claveDeAyuda('configuracion', 'apariencia')).toBe('configuracion/apariencia')
        expect(claveDeAyuda('catalogo', 'otra')).toBe('catalogo')
    })

    it('breves: pocos pasos y poco texto, para que se terminen en el celular', () => {
        for (const [clave, r] of Object.entries(RECORRIDOS)) {
            expect(r.pasos.length, clave).toBeGreaterThan(0)
            expect(r.pasos.length, clave).toBeLessThanOrEqual(5)
            for (const p of r.pasos) {
                expect(p.titulo.length, `${clave}: ${p.titulo}`).toBeLessThanOrEqual(40)
                expect(p.texto.length, `${clave}: ${p.titulo}`).toBeLessThanOrEqual(190)
            }
        }
    })

    it('cada recorrido tiene algo que se vea siempre: un paso que no depende de la pantalla', () => {
        // Un recorrido hecho solo de pasos opcionales podría saltarse entero y dejar al usuario con nada.
        for (const [clave, r] of Object.entries(RECORRIDOS)) {
            expect(r.pasos.some(p => !p.opcional), clave).toBe(true)
        }
    })
})

describe('encontrar textos en la pantalla', () => {
    it('ignora tildes, mayúsculas, flechas y espacios', () => {
        expect(normalizar('  Más   Tarde →')).toBe('mas tarde')
        expect(normalizar('✓ Tienda online')).toBe('tienda online')
        expect(coincide('Pendientes', 'pendientes')).toBe(true)
        expect(coincide('Pendientes 5', 'Pendientes')).toBe(false)
        expect(coincide('Pendientes 5', 'Pendientes', true)).toBe(true)
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

describe('sugerencias', () => {
    const base = { cumplidas: [] as string[], sabe: [] as string[], posponer: {}, ultima: 0, silenciadoHasta: 0, ahora: 40 * INTERVALO_MS, claveActual: 'dashboard' }

    it('cada sugerencia lleva a un tutorial que existe y los ids no se repiten', () => {
        const ids = SUGERENCIAS.map(s => s.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const s of SUGERENCIAS) expect(recorridoDe(claveDeSugerencia(s)), s.id).not.toBeNull()
    })

    it('sugiere primero lo que deja la tienda lista para vender', () => {
        expect(elegirSugerencia(base)?.id).toBe('negocio')
    })

    it('nunca sugiere lo que ya hizo ni lo que dijo que ya sabe', () => {
        const r = elegirSugerencia({ ...base, cumplidas: ['negocio', 'mp'], sabe: ['envios'] })
        expect(r?.id).toBe('pedidos')
    })

    it('no sugiere el tutorial de la pantalla en que está parado', () => {
        const r = elegirSugerencia({ ...base, cumplidas: ['negocio', 'mp', 'envios'], claveActual: 'pedidos' })
        expect(r?.id).toBe('descuentos')
    })

    it('"Más tarde" calla esa sugerencia hasta la fecha, y pasa a la que sigue', () => {
        const r = elegirSugerencia({ ...base, posponer: { negocio: base.ahora + 1 } })
        expect(r?.id).toBe('mp')
        expect(elegirSugerencia({ ...base, posponer: { negocio: base.ahora - 1 } })?.id).toBe('negocio')
    })

    it('de vez en cuando: no sugiere si hubo otra hace poco', () => {
        expect(elegirSugerencia({ ...base, ultima: base.ahora - 1000 })).toBeNull()
        expect(elegirSugerencia({ ...base, ultima: base.ahora - INTERVALO_MS })).not.toBeNull()
    })

    it('una por día como mucho, y si las descarta seguidas se callan todas un tiempo', () => {
        expect(INTERVALO_MS).toBe(24 * 60 * 60 * 1000)
        expect(elegirSugerencia({ ...base, silenciadoHasta: base.ahora + 1 })).toBeNull()
        expect(elegirSugerencia({ ...base, silenciadoHasta: base.ahora - 1 })).not.toBeNull()
    })

    it('con todo hecho no queda nada que sugerir', () => {
        expect(elegirSugerencia({ ...base, cumplidas: SUGERENCIAS.map(s => s.id) })).toBeNull()
    })
})

describe('lo que recuerda el dispositivo', () => {
    it('un valor roto o ajeno vuelve al estado vacío', () => {
        expect(parsear(null)).toEqual(ESTADO_AYUDA_VACIO)
        expect(parsear('no es json')).toEqual(ESTADO_AYUDA_VACIO)
        expect(parsear('{"vistos":[1,"pedidos"],"enCurso":"si"}')).toEqual({ ...ESTADO_AYUDA_VACIO, vistos: ['pedidos'] })
        expect(parsear('{"sabe":["mp",3],"posponer":{"a":5,"b":"x"},"ultimaSugerencia":"ayer"}'))
            .toEqual({ ...ESTADO_AYUDA_VACIO, sabe: ['mp'], posponer: { a: 5 } })
    })
})

describe('quién puede usar el modo prueba', () => {
    it('solo la tienda "negocio"', () => {
        expect(puedeUsarModoPrueba('negocio')).toBe(true)
        expect(puedeUsarModoPrueba('Negocio')).toBe(true)
        for (const otra of ['euge-joyas', 'negocio-2', 'minegocio', '', null, undefined]) {
            expect(puedeUsarModoPrueba(otra), String(otra)).toBe(false)
        }
    })

    it('solo se entienden los tres comandos de la dirección', () => {
        expect(comandoDeQuery('probar')).toBe('probar')
        expect(comandoDeQuery('reiniciar')).toBe('reiniciar')
        expect(comandoDeQuery('salir')).toBe('salir')
        for (const raro of ['PROBAR', 'borrar', '', undefined, ['probar']]) expect(comandoDeQuery(raro)).toBeNull()
    })

    it('la tienda simulada avanza de categoría a producto a listo, como lo haría la API', () => {
        expect(pasoInicial(cumplidasSimuladas('categoria'))).toBe('categoria')
        expect(pasoInicial(cumplidasSimuladas('producto'))).toBe('producto')
        expect(pasoInicial(cumplidasSimuladas('listo'))).toBe('listo')
        expect(siguientePasoDePrueba('categoria')).toBe('producto')
        expect(siguientePasoDePrueba('producto')).toBe('listo')
    })

    it('lo guardado con prueba se lee; un valor inventado, no', () => {
        expect(parsear('{"prueba":"producto"}').prueba).toBe('producto')
        expect(parsear('{"prueba":"otro"}').prueba).toBeNull()
        // Sin la marca, la tienda de pruebas todavía no arrancó sola.
        expect(parsear('{"prueba":"listo"}').pruebaElegida).toBe(false)
        expect(parsear('{"pruebaElegida":true}').pruebaElegida).toBe(true)
        expect(parsear('{"descartadasSeguidas":2,"silenciadoHasta":"x"}')).toMatchObject({ descartadasSeguidas: 2, silenciadoHasta: 0 })
    })
})
