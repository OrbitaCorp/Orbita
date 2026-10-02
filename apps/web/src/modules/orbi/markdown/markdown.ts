// El formato de las respuestas de Orbi (diseño A3·4): párrafos, encabezados
// chicos, listas, tablas y links internos. Un parser propio del subconjunto que
// usa Gemini, en vez de una librería: pesa nada, no arma HTML (se dibuja con
// React, sin dangerouslySetInnerHTML) y solo los links al panel son links.

export type Linea =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrita'; partes: Linea[] }
  | { tipo: 'cursiva'; partes: Linea[] }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'link'; texto: string; ruta: string }
  | { tipo: 'salto' }

export type Bloque =
  | { tipo: 'parrafo'; partes: Linea[] }
  | { tipo: 'titulo'; partes: Linea[] }
  | { tipo: 'lista'; ordenada: boolean; items: Linea[][] }
  | { tipo: 'tabla'; encabezado: Linea[][]; filas: Linea[][][]; numericas: boolean[] }

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|\*[^*\s\n][^*\n]*\*)/

/**
 * Solo una ruta del panel es link: Orbi no tiene por qué mandar a la persona a
 * un sitio de afuera, y un link externo en una respuesta es la forma más fácil
 * de que un texto de terceros (inyección) termine en un clic.
 */
export function esRutaInterna(url: string): boolean {
  return /^\/(?!\/)[^\s]*$/.test(url)
}

export function inline(texto: string): Linea[] {
  const salida: Linea[] = []
  const partes = texto.split(INLINE)
  for (const p of partes) {
    if (!p) continue
    if ((p.startsWith('**') && p.endsWith('**') && p.length > 4) || (p.startsWith('__') && p.endsWith('__') && p.length > 4)) {
      salida.push({ tipo: 'negrita', partes: inline(p.slice(2, -2)) })
    } else if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
      salida.push({ tipo: 'codigo', texto: p.slice(1, -1) })
    } else if (p.startsWith('[')) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p)
      if (m && esRutaInterna(m[2])) salida.push({ tipo: 'link', texto: m[1], ruta: m[2] })
      else salida.push({ tipo: 'texto', texto: m ? m[1] : p })
    } else if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      salida.push({ tipo: 'cursiva', partes: inline(p.slice(1, -1)) })
    } else {
      salida.push({ tipo: 'texto', texto: p })
    }
  }
  return salida
}

const ITEM = /^\s{0,3}(?:([-*•])|(\d{1,3})[.)])\s+(.*)$/
const TITULO = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/
const SEPARADOR_DE_TABLA = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
const NUMERO = /^[-+]?\s*\$?\s*[\d.,]+\s*%?$/

function celdas(linea: string): string[] {
  return linea.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
}

export function parsear(markdown: string): Bloque[] {
  const lineas = markdown.replace(/\r\n?/g, '\n').split('\n')
  const bloques: Bloque[] = []
  let parrafo: string[] = []

  const cerrarParrafo = () => {
    if (!parrafo.length) return
    const partes: Linea[] = []
    parrafo.forEach((l, i) => {
      if (i > 0) partes.push({ tipo: 'salto' })
      partes.push(...inline(l))
    })
    bloques.push({ tipo: 'parrafo', partes })
    parrafo = []
  }

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]
    if (!linea.trim()) { cerrarParrafo(); continue }

    const titulo = TITULO.exec(linea)
    if (titulo) { cerrarParrafo(); bloques.push({ tipo: 'titulo', partes: inline(titulo[1]) }); continue }

    if (linea.includes('|') && i + 1 < lineas.length && SEPARADOR_DE_TABLA.test(lineas[i + 1])) {
      cerrarParrafo()
      const encabezado = celdas(linea)
      const filas: string[][] = []
      i += 2
      while (i < lineas.length && lineas[i].includes('|') && lineas[i].trim()) filas.push(celdas(lineas[i++]))
      i--
      const ancho = encabezado.length
      const normal = filas.map(f => Array.from({ length: ancho }, (_, k) => f[k] ?? ''))
      const numericas = encabezado.map((_, k) => normal.length > 0 && normal.every(f => !f[k] || NUMERO.test(f[k])))
      bloques.push({ tipo: 'tabla', encabezado: encabezado.map(inline), filas: normal.map(f => f.map(inline)), numericas })
      continue
    }

    const item = ITEM.exec(linea)
    if (item) {
      cerrarParrafo()
      const ordenada = item[2] !== undefined
      const anterior = bloques[bloques.length - 1]
      if (anterior?.tipo === 'lista' && anterior.ordenada === ordenada) anterior.items.push(inline(item[3]))
      else bloques.push({ tipo: 'lista', ordenada, items: [inline(item[3])] })
      continue
    }

    parrafo.push(linea.trim())
  }
  cerrarParrafo()
  return bloques
}

/**
 * Mientras se escribe en vivo, una negrita abierta todavía no tiene su cierre:
 * sin esto se ven los asteriscos un instante y después desaparecen.
 */
export function sinMarcaAbierta(texto: string): string {
  const pares = (texto.match(/\*\*/g) ?? []).length
  if (pares % 2 === 0) return texto
  const ultima = texto.lastIndexOf('**')
  return texto.slice(0, ultima) + texto.slice(ultima + 2)
}
