// El manual en el formato que lee Orbi (spec 2026-09-30-orbi-base-de-conocimiento,
// §3.2). La imagen de la API se construye solo con apps/api, así que no puede
// leer este archivo: se le entrega un artefacto generado y commiteado,
// apps/api/src/orbi/manual/manual.generated.ts.
//
// Esto arma la parte de Tienda. El artefacto entero (Tienda y el manual de
// cada módulo nuevo) lo junta modules/orbi/manual/artefacto.ts, y lo escribe
// artefacto.test.ts con toMatchFileSnapshot:
//   - `pnpm manual:generar` lo regenera (vitest -u sobre ese test).
//   - `pnpm test` (lo corre CI) falla si alguien cambió el manual, los
//     primeros pasos o los permisos del menú y no lo regeneró.
//
// Solo lo importan los tests: node:crypto no llega nunca al navegador.

import { createHash } from 'node:crypto'
import { CAPITULOS, type Destino } from './contenido'
import { plano, textoDeBloque } from '@/lib/manual/bloques'
import { TAREAS_CHECKLIST, TAREAS_CHECKLIST_ETAPA2, type TareaChecklist } from '../tutoriales/copy'
import { MODULOS_DEL_MENU } from '@/layouts/components/permisosDelMenu'

// La misma forma que apps/api/src/orbi/manual/manual.types.ts (ManualGenerado).
export type DestinoParaOrbi = { seccion: string; vista?: string; label: string }
export type TemaParaOrbi = { id: string; capitulo: string; titulo: string; pista?: string; texto: string; destino?: DestinoParaOrbi }
export type PasoParaOrbi = { id: string; titulo: string; etapa: 1 | 2; grupo?: string; destino: DestinoParaOrbi }
export type ModuloParaOrbi = { id: string; label: string; permisos: string[] }
export type ManualParaOrbi = {
    version: string
    temas: TemaParaOrbi[]
    primerosPasos: PasoParaOrbi[]
    modulosDelMenu: ModuloParaOrbi[]
}

// El texto plano de cada bloque es el de lib/manual: el mismo para Tienda y para los módulos.
export { plano, textoDeBloque }

function destinoDe(d: Destino | undefined): DestinoParaOrbi | undefined {
    if (!d) return undefined
    return { seccion: d.seccion, ...(d.query?.vista ? { vista: d.query.vista } : {}), label: d.label }
}

function pasoDe(t: TareaChecklist, etapa: 1 | 2): PasoParaOrbi {
    const [, seccion, query] = t.destino
    return {
        id: t.id,
        titulo: t.titulo,
        etapa,
        ...(t.grupo ? { grupo: t.grupo } : {}),
        destino: { seccion, ...(query?.vista ? { vista: query.vista } : {}), label: t.destinoLabel },
    }
}

/** La versión del artefacto: un hash del contenido (la API la loguea con cada lectura). */
export function versionDe(contenido: Omit<ManualParaOrbi, 'version'>): string {
    return createHash('sha256').update(JSON.stringify(contenido)).digest('hex').slice(0, 16)
}

export function armarManualParaOrbi(): ManualParaOrbi {
    const temas: TemaParaOrbi[] = CAPITULOS.flatMap(c => c.temas.map(t => {
        // Un tema sin botón propio lleva al de su capítulo: "¿dónde está X?"
        // siempre tiene adónde ir.
        const destino = destinoDe(t.ir ?? c.ir)
        return {
            id: t.id,
            capitulo: c.titulo,
            titulo: t.titulo,
            ...(t.pista ? { pista: t.pista } : {}),
            texto: t.bloques.map(textoDeBloque).join('\n\n'),
            ...(destino ? { destino } : {}),
        }
    }))
    const primerosPasos = [
        ...TAREAS_CHECKLIST.map(t => pasoDe(t, 1)),
        ...TAREAS_CHECKLIST_ETAPA2.map(t => pasoDe(t, 2)),
    ]
    const modulosDelMenu = MODULOS_DEL_MENU.map(m => ({ id: m.id, label: m.label, permisos: [...m.permisos] }))

    const contenido = { temas, primerosPasos, modulosDelMenu }
    return { version: versionDe(contenido), ...contenido }
}
