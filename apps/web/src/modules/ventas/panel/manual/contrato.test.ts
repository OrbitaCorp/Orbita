import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { CAPITULOS, type Bloque, type Destino } from './contenido'
import { SECCIONES_DEL_PANEL, VISTAS_DE_CONFIGURACION } from '../secciones'

// El manual es la fuente de lo que Orbi sabe del sistema (spec
// 2026-09-30-orbi-base-de-conocimiento, §3.6 capa 2). Si dice que un botón se
// llama de una forma y la pantalla dice otra, Orbi le repite el error a la
// persona. Estos tests son el contrato entre el manual y el código: se rompen
// cuando una pantalla cambia y el manual no.
//
// Habrían atrapado los dos desfases que había al 30/09: "+ Agregar
// característica" (el botón dice "Agregar especificación") y "Ver más
// detalles →" (el link se sacó el 29/09).

const SRC = fileURLToPath(new URL('../../../../', import.meta.url))
const PANEL = fileURLToPath(new URL('../', import.meta.url))

function archivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap(nombre => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivosDe(ruta)
    return /\.(tsx?|jsx?)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

/**
 * Lo que NO es una pantalla aunque nombre botones: el manual mismo, los
 * tutoriales (sus anclas 'boton:…' nombran el botón que creen que existe: con
 * ellas adentro, el contrato pasaba con "Generar con Orbi" cuando el botón
 * dice "Redactar con Orbi"), los mocks y los prototipos de propuestas.
 */
const NO_ES_PANTALLA = [/[\\/]manual[\\/]/, /[\\/]tutoriales[\\/]/, /[\\/]mock[\\/]/, /[\\/]propuestas[\\/]/]

/** Como se compara un texto: sin íconos de flecha o tilde, sin el "+" de adelante, espacios simples. */
const normalizar = (t: string) => t.replace(/[→✓]/g, '').replace(/^\s*\+\s*/, '').replace(/\s+/g, ' ').trim()

/**
 * Los textos completos que puede mostrar un archivo: cada texto de JSX y cada
 * string literal, leídos con el parser de TypeScript. Así los comentarios no
 * cuentan (un botón que se sacó suele quedar nombrado en el comentario que
 * explica por qué se sacó) y un "//" o un "`" dentro de un string no
 * desordena nada, como pasaba con una regex.
 */
function textosDelArchivo(archivo: string): string[] {
  const fuente = ts.createSourceFile(archivo, readFileSync(archivo, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
  const textos: string[] = []
  const visitar = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) textos.push(n.text)
    ts.forEachChild(n, visitar)
  }
  visitar(fuente)
  return textos.map(normalizar).filter(Boolean)
}

const pantallasDe = (dir: string) => archivosDe(dir).filter(f => f.endsWith('.tsx') && !NO_ES_PANTALLA.some(r => r.test(f)))

/**
 * Los textos de las pantallas del front. Un botón del manual tiene que ser UNO
 * de estos entero: "Guardar" no lo prueba "Guardar cambios", ni un nombre de
 * botón suelto dentro de una frase.
 */
const TEXTOS_DE_PANTALLA = new Set(pantallasDe(SRC).flatMap(textosDelArchivo))

/** Los strings de una sección del panel (su carpeta), para ver qué vistas lee. */
const CARPETA_DE_SECCION: Record<string, string> = {
  pedidos: 'pedidos', catalogo: 'catalogo', categorias: 'catalogo', clientes: 'clientes',
  reportes: 'reportes', descuentos: 'descuentos', cupones: 'descuentos', mensajes: 'mensajes',
  avanzado: 'avanzado', perfil: 'perfil',
}
function textosDeSeccion(seccion: string): Set<string> {
  const carpeta = CARPETA_DE_SECCION[seccion]
  return new Set(carpeta ? archivosDe(join(PANEL, carpeta)).filter(f => !NO_ES_PANTALLA.some(r => r.test(f))).flatMap(textosDelArchivo) : [])
}

const temas = CAPITULOS.flatMap(c => c.temas.map(t => ({ capitulo: c, tema: t })))

function textosDe(b: Bloque): string[] {
  switch (b.tipo) {
    case 'parrafo': case 'nota': return [b.texto]
    case 'lista': return b.items
    case 'pasos': return b.items.flatMap(i => [i.titulo, i.texto])
    case 'campos': return [b.titulo ?? '', ...b.items.flatMap(i => [i.label, i.texto])]
    case 'estados': return b.items.flatMap(i => [i.label, i.texto])
  }
}
const textosDelManual = [
  ...CAPITULOS.flatMap(c => [c.titulo, c.resumen]),
  ...temas.flatMap(({ tema }) => [tema.titulo, ...tema.bloques.flatMap(textosDe)]),
]

/**
 * El texto de un [[botón]] como se busca en el código. Las flechas y los
 * tildes del manual suelen ser íconos en la pantalla (<ArrowRight />, <Check />),
 * no texto: se comparan sin ellos. Un manual que nombra los dos estados de un
 * mismo botón los separa con "|".
 */
function variantesDelBoton(boton: string): string[] {
  return boton.split('|').map(normalizar).filter(Boolean)
}

describe('manual: contrato con el código del panel', () => {
  it('los ids de tema son únicos y no chocan con los de capítulo', () => {
    const ids = temas.map(t => t.tema.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of CAPITULOS) expect(ids).not.toContain(c.id)
  })

  it('cada [[botón]] del manual existe como texto en las pantallas', () => {
    const faltan: string[] = []
    for (const texto of textosDelManual) {
      for (const m of texto.matchAll(/\[\[([^\]]+)\]\]/g)) {
        if (!variantesDelBoton(m[1]).every(v => TEXTOS_DE_PANTALLA.has(v))) faltan.push(m[1])
      }
    }
    expect(faltan).toEqual([])
  })

  it('cada destino lleva a una sección (y vista) que el panel abre de verdad', () => {
    const destinos: Destino[] = [
      ...CAPITULOS.flatMap(c => (c.ir ? [c.ir] : [])),
      ...temas.flatMap(({ tema }) => (tema.ir ? [tema.ir] : [])),
    ]
    for (const d of destinos) {
      expect(SECCIONES_DEL_PANEL as readonly string[]).toContain(d.seccion)
      const vista = d.query?.vista
      if (!vista) continue
      if (d.seccion === 'configuracion') {
        expect(VISTAS_DE_CONFIGURACION as readonly string[]).toContain(vista)
      } else {
        // La pantalla tiene que leer esa vista: el literal aparece en su código.
        expect(textosDeSeccion(d.seccion).has(vista), `${d.seccion}?vista=${vista}`).toBe(true)
      }
    }
  })

  it('ningún texto nombra identificadores internos (enums, funciones, archivos)', () => {
    const internos: string[] = []
    for (const texto of textosDelManual) {
      const plano = texto.replace(/\[\[[^\]]+\]\]/g, '')
      for (const m of plano.matchAll(/\b[A-Z]{3,}(?:_[A-Z]+)+\b|\b[a-z]+[A-Z][a-zA-Z]*\(|\b[\w/-]+\.(?:tsx?|jsx?|json)\b/g)) {
        internos.push(m[0])
      }
      for (const m of plano.matchAll(/\b(PENDING|CONFIRMED|PREPARING|SHIPPED|DELIVERED|COMPLETED|CANCELLED|PUBLISHED|DRAFT)\b/g)) {
        internos.push(m[0])
      }
    }
    expect(internos).toEqual([])
  })
})
