// El manual de un módulo nuevo (Turnos, Alquileres, Gimnasio) para Orbi.
//
// Cada módulo escribe el suyo en modules/<módulo>/manual.ts con estos tipos y
// lo suma a MANUALES_DE_MODULOS (modules/orbi/manual/artefacto.ts): el
// generador lo junta en el artefacto que lee la API sin que el módulo importe a
// Tienda. Viaja aparte de los temas de Tienda (el campo `modulos` del
// artefacto) y Orbi todavía no lo usa: los módulos no usan Orbi, así no se paga
// IA por ellos. Queda escrito, con los nombres exactos de los botones, y listo
// para el día que se decida usarlo.
import { botonesDel, textoDeBloque, textosCrudos, type Bloque } from './bloques'

export type ModuloConManual = 'turnos' | 'alquileres' | 'gimnasio'

export interface TemaDeModulo {
    /** Único dentro del módulo. En el artefacto va con el módulo adelante: "gimnasio.clases-del-dia". */
    id: string
    titulo: string
    /** Cómo lo preguntaría la persona, cuando el título solo no alcanza. */
    pista?: string
    bloques: Bloque[]
}

export interface CapituloDeModulo {
    id: string
    titulo: string
    /** Una frase: de qué va el capítulo. */
    resumen: string
    temas: TemaDeModulo[]
}

export interface ManualDeModulo {
    modulo: ModuloConManual
    /** Como se llama el módulo para la persona: "Gimnasio". */
    nombre: string
    capitulos: CapituloDeModulo[]
}

/** Un tema como lo lee Orbi: texto plano, con su capítulo. La misma forma que los de Tienda, sin botón "Ir a…". */
export interface TemaDeModuloParaOrbi { id: string; capitulo: string; titulo: string; pista?: string; texto: string }
export interface ManualDeModuloParaOrbi { modulo: ModuloConManual; nombre: string; temas: TemaDeModuloParaOrbi[] }

export function manualDeModuloParaOrbi(m: ManualDeModulo): ManualDeModuloParaOrbi {
    return {
        modulo: m.modulo,
        nombre: m.nombre,
        temas: m.capitulos.flatMap(c => c.temas.map(t => ({
            id: `${m.modulo}.${t.id}`,
            capitulo: c.titulo,
            titulo: t.titulo,
            ...(t.pista ? { pista: t.pista } : {}),
            texto: t.bloques.map(textoDeBloque).join('\n\n'),
        }))),
    }
}

/** Los botones que nombra un manual, sin repetir: el contrato con las pantallas del módulo. */
export function botonesDelManual(m: ManualDeModulo): string[] {
    const todos = m.capitulos.flatMap(c => c.temas.flatMap(t => [t.titulo, ...t.bloques.flatMap(textosCrudos)]).flatMap(botonesDel))
    return [...new Set(todos)]
}
