// El artefacto que lee la API: apps/api/src/orbi/manual/manual.generated.ts.
//
// Junta el manual de Tienda (modules/ventas/panel/manual: temas, primeros
// pasos y permisos del menú) con el manual de cada módulo nuevo
// (modules/<módulo>/manual.ts), sin que ningún módulo importe a Tienda: el que
// conoce a todos es este generador, como el alta conoce a los cuatro módulos.
//
// Los temas de los módulos van en `modulos`, aparte de `temas`: `temas` es lo
// que va en el índice del prompt de Orbi en cada mensaje de Tienda, y los
// módulos no usan Orbi (no se paga IA por ellos). Quedan en el artefacto,
// escritos y al día, para el día que se decida usarlos.
//
// Para sumar el manual de un módulo: escribirlo en modules/<módulo>/manual.ts
// con los tipos de lib/manual/modulos.ts y agregarlo a MANUALES_DE_MODULOS.
// Después, cd apps/web && pnpm manual:generar.
//
// Solo lo importan los tests: node:crypto (la versión) no llega al navegador.
import { armarManualParaOrbi, versionDe } from '@/modules/ventas/panel/manual/paraOrbi'
import { manualDeModuloParaOrbi, type ManualDeModulo, type ManualDeModuloParaOrbi } from '@/lib/manual/modulos'
import { MANUAL_GIMNASIO } from '@/modules/gimnasio/manual'

/** Los manuales de los módulos nuevos que van en el artefacto. Turnos y Alquileres suman el suyo cuando lo escriban. */
export const MANUALES_DE_MODULOS: ManualDeModulo[] = [MANUAL_GIMNASIO]

type DeTienda = Omit<ReturnType<typeof armarManualParaOrbi>, 'version'>
/** La misma forma que ManualGenerado (apps/api/src/orbi/manual/manual.types.ts). */
export type ArtefactoParaOrbi = DeTienda & { version: string; modulos: ManualDeModuloParaOrbi[] }

export function armarArtefacto(modulos: ManualDeModulo[] = MANUALES_DE_MODULOS): ArtefactoParaOrbi {
    const { temas, primerosPasos, modulosDelMenu } = armarManualParaOrbi()
    const contenido = { temas, primerosPasos, modulosDelMenu, modulos: modulos.map(manualDeModuloParaOrbi) }
    // La versión cubre todo: cambia si cambia un tema de Tienda o de un módulo.
    return { version: versionDe(contenido), ...contenido }
}

/** El archivo .ts que se commitea en la API. */
export function aArchivoTs(a: ArtefactoParaOrbi): string {
    return [
        '// GENERADO — no editar a mano.',
        '//',
        '// Sale del manual del panel de Tienda (apps/web/src/modules/ventas/panel/manual/contenido.ts),',
        '// de los primeros pasos (tutoriales/copy.ts), de los permisos del menú',
        '// (apps/web/src/layouts/components/permisosDelMenu.ts) y del manual de cada módulo nuevo',
        '// (apps/web/src/modules/<módulo>/manual.ts), que va aparte en `modulos`. Para regenerarlo:',
        '//   cd apps/web && pnpm manual:generar',
        '// apps/web/src/modules/orbi/manual/artefacto.test.ts falla en CI si quedó viejo.',
        '',
        "import type { ManualGenerado } from './manual.types';",
        '',
        `export const MANUAL_GENERADO: ManualGenerado = ${JSON.stringify(a, null, 2)};`,
        '',
    ].join('\n')
}
