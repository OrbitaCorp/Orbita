// Turnos, Alquileres y Gimnasio no se importan entre sí (ni al alta, que es
// la única que los conoce a todos), y lo que comparten no sabe de ningún
// módulo. Es la misma regla que marca eslint (no-restricted-imports en
// eslint.config.mjs), pero acá bloquea: en el CI el lint es informativo y los
// tests no. Si esto falla, lo que querés compartir va a lib/reservas,
// lib/reservasApi, lib/manual o design-system/reservas.
//
// Lee los archivos con el parser de TypeScript: cuenta los import, los
// export … from, los import() y los require(), no lo que diga un comentario.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const SRC = fileURLToPath(new URL('../../', import.meta.url))

/** Lo que cada módulo no puede importar (carpetas de src/modules), igual que en eslint.config.mjs. */
const NO_IMPORTA: Record<string, string[]> = {
    turnos: ['alquileres', 'gimnasio', 'onboarding/alta'],
    alquileres: ['turnos', 'gimnasio', 'onboarding/alta', 'ventas', 'landing', 'onboarding'],
    gimnasio: ['turnos', 'alquileres', 'onboarding/alta', 'ventas', 'landing', 'onboarding'],
}

/** Las carpetas compartidas: no importan nada de src/modules. */
const COMPARTIDO = ['lib/reservas', 'lib/reservasApi', 'lib/manual', 'design-system/reservas']

function archivosDe(dir: string): string[] {
    return readdirSync(dir).flatMap(nombre => {
        const ruta = join(dir, nombre)
        if (statSync(ruta).isDirectory()) return archivosDe(ruta)
        return /\.(ts|tsx)$/.test(nombre) ? [ruta] : []
    })
}

/** Cada módulo que un archivo trae, con su línea. */
export function importsDe(fuente: string, archivo = 'x.tsx'): { desde: string; linea: number }[] {
    const sf = ts.createSourceFile(archivo, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const out: { desde: string; linea: number }[] = []
    const anotar = (n: ts.Node, texto: string) => out.push({ desde: texto, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 })
    const visitar = (n: ts.Node) => {
        if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier)) anotar(n, n.moduleSpecifier.text)
        // import('x') y require('x')
        if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
            const [arg] = n.arguments
            if (arg && ts.isStringLiteralLike(arg)) anotar(n, arg.text)
        }
        // El tipo import('x').Algo
        if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteralLike(n.argument.literal)) anotar(n, n.argument.literal.text)
        ts.forEachChild(n, visitar)
    }
    visitar(sf)
    return out
}

/** A qué carpeta de src/ apunta un import ('modules/turnos/admin/x'), o null si es un paquete. */
function destino(archivo: string, desde: string): string | null {
    if (desde.startsWith('@/')) return desde.slice(2)
    if (desde.startsWith('.')) return relative(SRC, resolve(dirname(archivo), desde)).replace(/\\/g, '/')
    return null
}

const esDe = (ruta: string, carpeta: string) => ruta === carpeta || ruta.startsWith(`${carpeta}/`)

/** Los imports de una carpeta que caen en alguna de las prohibidas, como "archivo:línea → destino". */
function cruces(carpeta: string, prohibidas: string[]): string[] {
    return archivosDe(join(SRC, carpeta)).flatMap(archivo =>
        importsDe(readFileSync(archivo, 'utf8'), archivo)
            .map(i => ({ ...i, a: destino(archivo, i.desde) }))
            .filter(i => i.a !== null && prohibidas.some(p => esDe(i.a as string, p)))
            .map(i => `${relative(SRC, archivo).replace(/\\/g, '/')}:${i.linea} → ${i.a}`))
}

describe('los módulos de reservas son independientes', () => {
    for (const [modulo, otros] of Object.entries(NO_IMPORTA)) {
        it(`${modulo} no importa a otro módulo ni al alta`, () => {
            expect(cruces(`modules/${modulo}`, otros.map(o => `modules/${o}`))).toEqual([])
        })
    }

    for (const carpeta of COMPARTIDO) {
        it(`${carpeta} no importa a ningún módulo`, () => {
            expect(cruces(carpeta, ['modules'])).toEqual([])
        })
    }

    it('el detector muerde: ve el import con alias, el relativo, el dinámico, el de tipos y el export … from', () => {
        const fuente = [
            "import A from '@/modules/turnos/admin/PanelTurnos'",
            "import { b } from '../../alquileres/datos'",
            "export { c } from '@/modules/onboarding/alta/Alta'",
            "const d = () => import('@/modules/ventas/panel/x')",
            "type E = import('@/modules/turnos/datos').Turno",
            "// import F from '@/modules/turnos/no-cuenta': es un comentario",
            "import { fechaLarga } from '@/lib/reservas/fechas'",
            "import React from 'react'",
        ].join('\n')
        const archivo = join(SRC, 'modules/gimnasio/admin/Falso.tsx')
        const prohibidas = NO_IMPORTA.gimnasio.map(o => `modules/${o}`)
        const vistos = importsDe(fuente, archivo).map(i => ({ linea: i.linea, a: destino(archivo, i.desde) })).filter(i => i.a !== null && prohibidas.some(p => esDe(i.a as string, p)))
        expect(vistos).toEqual([
            { linea: 1, a: 'modules/turnos/admin/PanelTurnos' },
            { linea: 2, a: 'modules/alquileres/datos' },
            { linea: 3, a: 'modules/onboarding/alta/Alta' },
            { linea: 4, a: 'modules/ventas/panel/x' },
            { linea: 5, a: 'modules/turnos/datos' },
        ])
        // "turnos-algo" no es "turnos": la carpeta se compara entera.
        expect(esDe('modules/turnos-viejo/x', 'modules/turnos')).toBe(false)
    })
})
