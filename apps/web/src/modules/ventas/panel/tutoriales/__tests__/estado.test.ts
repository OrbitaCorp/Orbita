import { describe, expect, it } from 'vitest'
import {
    ETAPA_2_PARA_QUIEN_YA_TERMINO, desdeRemoto, etapaDe, inicial, iniciarEtapa2, resolverAlAbrir,
} from '../estado'
import { TAREAS_CHECKLIST, TAREAS_CHECKLIST_ETAPA2, tareasDeEtapa } from '../copy'

// Segunda etapa de la Checklist (15/09). Lo que no puede desviarse sin que
// alguien vea un tutorial que no le corresponde: cómo se lee un estado viejo
// (sin `etapa`), qué arranca al abrir el panel en cada caso, y que las dos
// listas de tareas no se pisen (los ids también los conoce la API).

const CUMPLIDAS_1 = ['negocio', 'mp']

describe('desdeRemoto: compatibilidad con lo guardado antes de la segunda etapa', () => {
    it('un estado viejo (sin etapa) queda SIN etapa: no se inventa etapa 1', () => {
        const e = desdeRemoto({ variante: 'checklist', fase: 'terminado', paso: 0, hechas: [], minimizado: false, seccionesVistas: [] })
        expect(e).not.toBeNull()
        expect('etapa' in e!).toBe(false)
        expect(etapaDe(e!)).toBe(1)
    })

    it('respeta etapa 1 y 2, y descarta cualquier otro valor', () => {
        const base = { variante: 'checklist', fase: 'activo', paso: 0, hechas: [], minimizado: false, seccionesVistas: [] }
        expect(desdeRemoto({ ...base, etapa: 2 })?.etapa).toBe(2)
        expect(desdeRemoto({ ...base, etapa: 1 })?.etapa).toBe(1)
        expect(desdeRemoto({ ...base, etapa: 7 })?.etapa).toBeUndefined()
        expect(desdeRemoto({ ...base, etapa: '2' })?.etapa).toBeUndefined()
    })

    it('inicial(): la Checklist nace con etapa, las otras variantes no', () => {
        expect(inicial('checklist').etapa).toBe(1)
        expect(inicial('checklist', 2).etapa).toBe(2)
        expect(inicial('recorrido').etapa).toBeUndefined()
    })
})

describe('resolverAlAbrir: qué arranca al abrir el panel', () => {
    it('nunca lo tocó → Checklist etapa 1 con las cumplidas, y se persiste', () => {
        const r = resolverAlAbrir(null, CUMPLIDAS_1)
        expect(r.persistir).toBe(true)
        expect(r.estado).toMatchObject({ variante: 'checklist', fase: 'activo', etapa: 1, hechas: CUMPLIDAS_1 })
    })

    it('activo → se retoma sumando solo las cumplidas nuevas', () => {
        const activo = { ...inicial('checklist', 1), hechas: ['negocio'] }
        const r = resolverAlAbrir(activo, ['negocio', 'mp'])
        expect(r.persistir).toBe(true)
        expect(r.estado?.hechas).toEqual(['negocio', 'mp'])
        expect(resolverAlAbrir(activo, ['negocio'])).toEqual({ estado: activo, persistir: false })
    })

    it('activo en etapa 2 → se retoma en etapa 2 (no vuelve a la primera)', () => {
        const activo2 = { ...inicial('checklist', 2), paso: 1, hechas: ['pedidos'] }
        const r = resolverAlAbrir(activo2, ['pedidos', 'clientes'])
        expect(r.estado?.etapa).toBe(2)
        expect(r.estado?.paso).toBe(1)
        expect(r.estado?.hechas).toEqual(['pedidos', 'clientes'])
    })

    it('terminado con etapa 2 → nada, nunca más', () => {
        expect(resolverAlAbrir({ ...inicial('checklist', 2), fase: 'terminado' }, [])).toEqual({ estado: null, persistir: false })
    })

    it('terminado con etapa 1 (ocultó la primera sin terminarla) → la segunda NO arranca sola', () => {
        expect(resolverAlAbrir({ ...inicial('checklist', 1), fase: 'terminado' }, [])).toEqual({ estado: null, persistir: false })
    })

    it('terminado SIN etapa (de antes de este cambio) → arranca la etapa 2 desde cero, según la constante', () => {
        const viejo = desdeRemoto({ variante: 'checklist', fase: 'terminado', paso: 0, hechas: ['negocio', 'mp', 'publicar'], minimizado: true, seccionesVistas: [] })!
        const r = resolverAlAbrir(viejo, ['negocio', 'pedidos'])
        if (ETAPA_2_PARA_QUIEN_YA_TERMINO) {
            expect(r.persistir).toBe(true)
            // Desde cero: paso 0 (presentación pendiente), sin minimizar, con
            // lo que la API detectó — no con los tildes manuales de la etapa 1.
            expect(r.estado).toMatchObject({ variante: 'checklist', fase: 'activo', etapa: 2, paso: 0, minimizado: false, hechas: ['negocio', 'pedidos'] })
        } else {
            expect(r).toEqual({ estado: null, persistir: false })
        }
    })

    it('terminado en otra variante → nada (las otras no tienen etapas)', () => {
        expect(resolverAlAbrir({ ...inicial('recorrido'), fase: 'terminado' }, [])).toEqual({ estado: null, persistir: false })
    })
})

describe('transición etapa 1 → 2', () => {
    it('iniciarEtapa2 arranca la segunda desde cero, con las cumplidas y presentación pendiente', () => {
        const fin1 = { ...inicial('checklist', 1), hechas: ['negocio', 'mp', 'categorias', 'producto', 'envios', 'publicar'], minimizado: true }
        const e2 = iniciarEtapa2(fin1, ['negocio', 'clientes'])
        expect(e2).toEqual({ ...inicial('checklist', 2), hechas: ['negocio', 'clientes'] })
        expect(e2.paso).toBe(0)
        expect(e2.fase).toBe('activo')
    })

    it('el estado de la etapa 2 se lee de vuelta igual (round-trip por desdeRemoto)', () => {
        const e2 = iniciarEtapa2(inicial('checklist', 1), [])
        expect(desdeRemoto(JSON.parse(JSON.stringify(e2)))).toEqual(e2)
    })
})

describe('tareas de la segunda etapa', () => {
    it('cubre los módulos que la primera no toca, sin repetir ids', () => {
        const ids1 = TAREAS_CHECKLIST.map(t => t.id)
        const ids2 = TAREAS_CHECKLIST_ETAPA2.map(t => t.id)
        expect(ids2).toEqual([
            'pedidos', 'estados', 'clientes', 'plantillas', 'herramientas',
            'apariencia', 'contacto', 'redes', 'descuentos', 'dominio',
            'equipo', 'notificaciones', 'postventa', 'reportes', 'plan',
        ])
        expect(ids2.filter(id => ids1.includes(id))).toEqual([])
        expect(new Set(ids2).size).toBe(ids2.length)
    })

    it('todas tienen grupo, y cada grupo es un tramo seguido de la lista', () => {
        const grupos = TAREAS_CHECKLIST_ETAPA2.map(t => t.grupo)
        expect(grupos.every(g => !!g)).toBe(true)
        // Un grupo que reaparece después de otro dibujaría dos encabezados
        // iguales: los tramos tienen que ser contiguos.
        const tramos = grupos.filter((g, i) => g !== grupos[i - 1])
        expect(new Set(tramos).size).toBe(tramos.length)
        expect(tramos).toEqual(['Tu día a día', 'La cara de tu tienda', 'Tu negocio'])
    })

    it('la primera etapa no lleva grupos: son seis pasos de una sola tirada', () => {
        expect(TAREAS_CHECKLIST.every(t => t.grupo === undefined)).toBe(true)
    })

    it('cada tarea tiene destino coherente con su sección y una guía (ancla o pasos)', () => {
        for (const t of TAREAS_CHECKLIST_ETAPA2) {
            expect(t.destino[0]).toBe('ventas')
            expect(t.seccionDestino).toBe(t.destino[1])
            expect(!!t.anclaDestino || !!t.pasos?.length).toBe(true)
            if (t.pasos) for (const p of t.pasos) expect(p.label.length).toBeGreaterThan(0)
        }
    })

    it('tareasDeEtapa devuelve la lista de cada etapa', () => {
        expect(tareasDeEtapa(1)).toBe(TAREAS_CHECKLIST)
        expect(tareasDeEtapa(2)).toBe(TAREAS_CHECKLIST_ETAPA2)
    })
})
