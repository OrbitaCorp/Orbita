import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CAPITULOS } from './contenido'
import { aArchivoTs, armarManualParaOrbi, plano, textoDeBloque, versionDe } from './paraOrbi'
import { MODULOS_DEL_MENU, PERMISOS_MODULO } from '@/layouts/components/permisosDelMenu'

const ARTEFACTO = '../../../../../../api/src/orbi/manual/manual.generated.ts'
const SIDEBAR = fileURLToPath(new URL('../../../../layouts/components/Sidebar.tsx', import.meta.url))

describe('manual para Orbi: el artefacto de la API', () => {
    // Si este test falla en CI: cd apps/web && pnpm manual:generar, y commitear
    // apps/api/src/orbi/manual/manual.generated.ts.
    it('manual.generated.ts está al día con el manual, los primeros pasos y el menú', async () => {
        await expect(aArchivoTs(armarManualParaOrbi())).toMatchFileSnapshot(ARTEFACTO)
    })

    it('trae todos los temas, con su capítulo y un destino', () => {
        const m = armarManualParaOrbi()
        expect(m.temas).toHaveLength(CAPITULOS.reduce((n, c) => n + c.temas.length, 0))
        const envios = m.temas.find(t => t.id === 'cfg-envios')!
        expect(envios).toMatchObject({ capitulo: 'Configuración', titulo: 'Envíos', destino: { seccion: 'configuracion', vista: 'envios', label: 'Abrir Envíos' } })
        // Sin botón propio, hereda el del capítulo.
        expect(m.temas.find(t => t.id === 'estados')!.destino).toMatchObject({ seccion: 'pedidos' })
    })

    it('el texto es plano: sin negrita y con los botones entre comillas', () => {
        expect(plano('Tocá [[Publicar tienda]] en el **Inicio**')).toBe('Tocá "Publicar tienda" en el Inicio')
        expect(textoDeBloque({ tipo: 'pasos', items: [{ titulo: 'Uno', texto: 'a' }, { titulo: 'Dos', texto: 'b' }] })).toBe('1. Uno: a\n2. Dos: b')
        expect(textoDeBloque({ tipo: 'nota', variante: 'aviso', texto: 'x' })).toBe('Ojo: x')
        for (const t of armarManualParaOrbi().temas) {
            expect(t.texto).not.toMatch(/\*\*|\[\[|\]\]/)
        }
    })

    it('los primeros pasos traen las dos etapas con su destino', () => {
        const pasos = armarManualParaOrbi().primerosPasos
        expect(pasos.find(p => p.id === 'publicar')).toMatchObject({ etapa: 1, destino: { seccion: 'dashboard' } })
        expect(pasos.find(p => p.id === 'equipo')).toMatchObject({ etapa: 2, destino: { seccion: 'configuracion', vista: 'equipo' } })
    })

    it('la versión es estable y cambia si cambia el contenido', () => {
        const { version, ...contenido } = armarManualParaOrbi()
        expect(version).toMatch(/^[0-9a-f]{16}$/)
        expect(armarManualParaOrbi().version).toBe(version)
        expect(versionDe(contenido)).toBe(version)
        // Una letra en un tema alcanza para otra versión.
        const otro = { ...contenido, temas: contenido.temas.map((t, i) => (i === 0 ? { ...t, texto: `${t.texto}.` } : t)) }
        expect(versionDe(otro)).not.toBe(version)
    })
})

describe('permisos del menú', () => {
    it('las etiquetas son las de MODULOS en Sidebar.tsx, en el mismo orden', () => {
        const src = readFileSync(SIDEBAR, 'utf8')
        const bloque = /const MODULOS: Modulo\[\] = \[([\s\S]*?)\r?\n\]/.exec(src)?.[1] ?? ''
        const enSidebar = [...bloque.matchAll(/id: '([a-z]+)', label: '([^']+)'/g)].map(m => ({ id: m[1], label: m[2] }))
        expect(enSidebar).toEqual(MODULOS_DEL_MENU.map(({ id, label }) => ({ id, label })))
    })

    it('PERMISOS_MODULO deja afuera los módulos sin permiso (los ve cualquiera)', () => {
        expect(PERMISOS_MODULO.manual).toBeUndefined()
        expect(PERMISOS_MODULO.descuentos).toEqual(['discounts.view', 'discounts.manage'])
    })
})
