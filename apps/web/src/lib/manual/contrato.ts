// El contrato entre un manual y sus pantallas: los textos que puede mostrar una
// carpeta de pantallas, para comprobar que cada [[Botón]] del manual existe con
// ese nombre. Si el manual dice que un botón se llama de una forma y la
// pantalla dice otra, Orbi le repetiría el error a la persona.
//
// Solo para los tests (lee archivos y usa el parser de TypeScript): ninguna
// pantalla lo importa. El de Tienda tiene el suyo, más completo, en
// modules/ventas/panel/manual/contrato.test.ts.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

/** Como se compara un texto: sin íconos de flecha o tilde, sin el "+" de adelante, espacios simples. */
export const normalizar = (t: string) => t.replace(/[→✓…]/g, '').replace(/^\s*\+\s*/, '').replace(/\s+/g, ' ').trim()

function archivosDe(dir: string): string[] {
    return readdirSync(dir).flatMap(nombre => {
        const ruta = join(dir, nombre)
        if (statSync(ruta).isDirectory()) return archivosDe(ruta)
        return /\.tsx$/.test(nombre) && !/\.test\.tsx$/.test(nombre) ? [ruta] : []
    })
}

/**
 * Los textos que pueden mostrar las pantallas de una carpeta: cada texto de
 * JSX y cada string literal, leídos con el parser (así un botón que se sacó y
 * quedó nombrado en un comentario no cuenta).
 */
export function textosDePantallas(dir: string): Set<string> {
    const textos = new Set<string>()
    for (const archivo of archivosDe(dir)) {
        const fuente = ts.createSourceFile(archivo, readFileSync(archivo, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
        const visitar = (n: ts.Node) => {
            if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) {
                const t = normalizar(n.text)
                if (t) textos.add(t)
            }
            ts.forEachChild(n, visitar)
        }
        visitar(fuente)
    }
    return textos
}

/**
 * Los botones de un manual que ninguna pantalla de la carpeta muestra con ese
 * nombre (vacío si están todos). El nombre del manual se compara igual que el
 * texto de la pantalla (normalizar): sin eso, un botón que termina en "…"
 * ("Actividad nueva…") nunca coincidía con el suyo, que se guarda sin los
 * puntos.
 *
 * Con varias carpetas, alcanza con que esté en una: las pantallas de un módulo
 * muestran también los botones de las piezas compartidas que usan (la barra
 * de guardar del kit: "Guardar cambios", "Descartar").
 */
export function botonesQueFaltan(botones: string[], dir: string | string[]): string[] {
    const textos = new Set<string>()
    for (const d of [dir].flat()) for (const t of textosDePantallas(d)) textos.add(t)
    return botones.filter(b => !textos.has(normalizar(b)))
}
