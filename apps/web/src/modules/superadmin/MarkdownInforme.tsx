import { Fragment, type ReactNode } from 'react'

// Render de Markdown para los informes de la auditoría interna.
//
// Deliberadamente chico y SIN innerHTML: parsea un subconjunto (títulos,
// párrafos, listas, citas, tablas, bloques de código, separadores, negrita,
// cursiva, código inline, links http/https e imágenes) y devuelve elementos
// React. Lo que no entiende lo muestra como texto plano, nunca como HTML.
// Alcanza para documentar cómo está hecho un módulo y qué se verificó; si
// algún día hace falta más, se cambia por una librería con sanitizado, no por
// innerHTML.

type Imagen = { alt: string; src: string }

type Bloque =
  | { tipo: 'h'; nivel: 1 | 2 | 3 | 4; texto: string }
  | { tipo: 'p'; texto: string }
  | { tipo: 'ul'; items: string[] }
  | { tipo: 'ol'; items: string[] }
  | { tipo: 'quote'; texto: string }
  | { tipo: 'code'; codigo: string; lang: string }
  | { tipo: 'table'; cabecera: string[]; filas: string[][] }
  | { tipo: 'hr' }
  // Un párrafo hecho solo de imágenes: las capturas antes/después de una
  // entrada de Módulos. Va como galería, no como texto.
  | { tipo: 'imgs'; imagenes: Imagen[] }

// Imágenes: solo https o una ruta de este mismo sitio bajo /auditoria/ (las
// capturas viven en apps/web/public/auditoria/modulos/…). Nada de http, data:
// ni javascript:, y nada de "..": un src es un GET con las cookies del panel,
// así que no puede apuntar a cualquier ruta propia.
const RE_SRC_HTTPS = /^https:\/\/[^\s"'<>()\\]+$/
const RE_SRC_LOCAL = /^\/auditoria\/[A-Za-z0-9._~%/-]+$/

export function srcSeguro(url: string): string | null {
  if (RE_SRC_HTTPS.test(url)) return url
  if (RE_SRC_LOCAL.test(url) && !url.split('/').includes('..')) return url
  return null
}

// Proporción reservada antes de que cargue la imagen, para que la página no
// salte: sale del ancho de la captura que dicen el alt o el archivo
// ("Antes · 390", "agenda-despues-390.jpg"). Sin ancho, la de escritorio.
export function anchoCaptura(alt: string, src: string): 390 | 768 | 1280 {
  const pista = `${alt} ${src.split('/').pop() ?? ''}`
  if (/(^|\D)390(\D|$)/.test(pista)) return 390
  if (/(^|\D)768(\D|$)/.test(pista)) return 768
  return 1280
}
const PROPORCION: Record<390 | 768 | 1280, string> = { 390: '390 / 844', 768: '768 / 1024', 1280: '16 / 10' }

const RE_IMG = /!\[([^\]]*)\]\(([^)\s]+)\)/g
const RE_SOLO_IMGS = /^(\s*!\[[^\]]*\]\([^)\s]+\)\s*)+$/

function soloImagenes(texto: string): Imagen[] | null {
  if (!RE_SOLO_IMGS.test(texto)) return null
  const out: Imagen[] = []
  for (const m of texto.matchAll(RE_IMG)) {
    const src = srcSeguro(m[2])
    // Una sola URL no permitida y el párrafo se muestra como texto: mejor ver
    // el Markdown crudo que una galería con huecos.
    if (!src) return null
    out.push({ alt: m[1].trim(), src })
  }
  return out
}

const RE_H = /^(#{1,4})\s+(.*)$/
const RE_UL = /^\s*[-*•]\s+(.*)$/
const RE_OL = /^\s*\d+[.)]\s+(.*)$/
const RE_TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

function celdas(linea: string): string[] {
  let l = linea.trim()
  if (l.startsWith('|')) l = l.slice(1)
  if (l.endsWith('|')) l = l.slice(0, -1)
  return l.split('|').map((c) => c.trim())
}

export function parsearMarkdown(src: string): Bloque[] {
  const lineas = src.replace(/\r\n?/g, '\n').split('\n')
  const out: Bloque[] = []
  let i = 0
  while (i < lineas.length) {
    const linea = lineas[i]
    const t = linea.trim()

    if (t === '') { i++; continue }

    if (t.startsWith('```')) {
      const lang = t.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) { buf.push(lineas[i]); i++ }
      i++ // cierre
      out.push({ tipo: 'code', codigo: buf.join('\n'), lang })
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { out.push({ tipo: 'hr' }); i++; continue }

    const h = RE_H.exec(t)
    if (h) { out.push({ tipo: 'h', nivel: h[1].length as 1 | 2 | 3 | 4, texto: h[2].trim() }); i++; continue }

    if (t.startsWith('|') && i + 1 < lineas.length && RE_TABLE_SEP.test(lineas[i + 1])) {
      const cabecera = celdas(t)
      const filas: string[][] = []
      i += 2
      while (i < lineas.length && lineas[i].trim().startsWith('|')) { filas.push(celdas(lineas[i])); i++ }
      out.push({ tipo: 'table', cabecera, filas })
      continue
    }

    if (t.startsWith('>')) {
      const buf: string[] = []
      while (i < lineas.length && lineas[i].trim().startsWith('>')) { buf.push(lineas[i].trim().replace(/^>\s?/, '')); i++ }
      out.push({ tipo: 'quote', texto: buf.join(' ') })
      continue
    }

    if (RE_UL.test(linea) || RE_OL.test(linea)) {
      const ordenada = RE_OL.test(linea)
      const re = ordenada ? RE_OL : RE_UL
      const items: string[] = []
      while (i < lineas.length) {
        const m = re.exec(lineas[i])
        if (m) { items.push(m[1]); i++; continue }
        // Continuación indentada del ítem anterior.
        if (items.length && /^\s{2,}\S/.test(lineas[i]) && !RE_UL.test(lineas[i]) && !RE_OL.test(lineas[i])) {
          items[items.length - 1] += ' ' + lineas[i].trim()
          i++
          continue
        }
        break
      }
      out.push({ tipo: ordenada ? 'ol' : 'ul', items })
      continue
    }

    // Párrafo: junta líneas hasta la próxima línea en blanco o bloque especial.
    const buf: string[] = [t]
    i++
    while (i < lineas.length) {
      const s = lineas[i].trim()
      if (s === '' || s.startsWith('```') || s.startsWith('#') || s.startsWith('>') || s.startsWith('|') || RE_UL.test(lineas[i]) || RE_OL.test(lineas[i]) || /^(-{3,}|\*{3,})$/.test(s)) break
      buf.push(s)
      i++
    }
    const texto = buf.join(' ')
    const imagenes = soloImagenes(texto)
    out.push(imagenes ? { tipo: 'imgs', imagenes } : { tipo: 'p', texto })
  }
  return out
}

// Una imagen con su lugar reservado (aspect-ratio fijo). <img> y no
// next/image: las capturas pueden estar en cualquier host https y next/image
// exige declarar cada dominio. `inline` la usa dentro de un párrafo, así que
// el envoltorio es un <span> (un <figure> no puede ir adentro de un <p>).
function ImagenFija({ alt, src }: Imagen) {
  const ancho = anchoCaptura(alt, src)
  return (
    <span className="md-img" data-ancho={ancho} style={{ aspectRatio: PROPORCION[ancho] }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </span>
  )
}

// Las rutas de los informes (apps/web/src/…/Archivo.tsx:30) no tienen
// espacios: en celular cortaban a mitad del nombre del archivo. Con un <wbr>
// después de cada barra cortan ahí; el texto (y lo que se copia) no cambia.
function conCortes(codigo: string): ReactNode {
  const partes = codigo.split('/')
  if (partes.length < 2) return codigo
  return partes.map((s, i) => (i < partes.length - 1 ? <Fragment key={i}>{s}/<wbr /></Fragment> : <Fragment key={i}>{s}</Fragment>))
}

// Inline: **negrita**, *cursiva*, `código`, [texto](https://…) y la imagen
// ![alt](https://… o /auditoria/…). Todo lo demás es texto. Los links solo
// http(s); las imágenes pasan por srcSeguro y van en un <img> con src
// controlado, nunca por innerHTML.
const RE_INLINE = /(!\[[^\]]*?\]\((?:https:\/\/|\/auditoria\/)[^)\s]+\)|\*\*[^*]+?\*\*|`[^`]+?`|\[[^\]]+?\]\(https?:\/\/[^)\s]+\)|\*[^*\s][^*]*?\*)/g

export function inline(texto: string): ReactNode {
  const partes = texto.split(RE_INLINE)
  return partes.map((p, idx) => {
    if (!p) return null
    if (p.startsWith('![')) {
      const m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(p)
      const src = m ? srcSeguro(m[2]) : null
      if (m && src) return <ImagenFija key={idx} alt={m[1]} src={src} />
    }
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={idx}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={idx} className="md-code">{conCortes(p.slice(1, -1))}</code>
    if (p.startsWith('[')) {
      const m = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(p)
      if (m) return <a key={idx} href={m[2]} target="_blank" rel="noopener noreferrer">{m[1]}</a>
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={idx}>{p.slice(1, -1)}</em>
    return <Fragment key={idx}>{p}</Fragment>
  })
}

export function MarkdownInforme({ texto, className }: { texto: string; className?: string }) {
  const bloques = parsearMarkdown(texto)
  return (
    <div className={`md-informe${className ? ` ${className}` : ''}`}>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case 'h': {
            const Tag = (`h${Math.min(b.nivel + 1, 5)}`) as 'h2' | 'h3' | 'h4' | 'h5'
            return <Tag key={i} className={`md-h md-h${b.nivel}`}>{inline(b.texto)}</Tag>
          }
          case 'p': return <p key={i}>{inline(b.texto)}</p>
          case 'ul': return <ul key={i}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>
          case 'ol': return <ol key={i}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>
          case 'quote': return <blockquote key={i}>{inline(b.texto)}</blockquote>
          case 'code': return <pre key={i} data-lang={b.lang || undefined}><code>{b.codigo}</code></pre>
          case 'hr': return <hr key={i} />
          // Antes y después lado a lado desde 768 px, apilados abajo de eso
          // (MD_CSS). El alt ("Antes · 1280") hace de epígrafe.
          case 'imgs': return (
            <div key={i} className="md-capturas" data-una={b.imagenes.length === 1 ? '' : undefined}>
              {b.imagenes.map((img, j) => (
                <figure key={j} className="md-captura">
                  <ImagenFija alt={img.alt} src={img.src} />
                  {img.alt && <figcaption>{img.alt}</figcaption>}
                </figure>
              ))}
            </div>
          )
          case 'table': return (
            <div key={i} className="md-table-wrap">
              <table>
                <thead><tr>{b.cabecera.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
                <tbody>
                  {b.filas.map((f, j) => (
                    <tr key={j}>{b.cabecera.map((_, k) => <td key={k}>{inline(f[k] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      })}
    </div>
  )
}

// Estilos compartidos entre la pestaña (tema del panel, variables CSS) y el
// documento imprimible (paleta fija clara). Se inyectan una vez desde cada
// contenedor con <style>.
export const MD_CSS = `
  .md-informe { font-size: 13.5px; line-height: 1.6; color: var(--md-fg, var(--color-body)); overflow-wrap: anywhere; }
  .md-informe > :first-child { margin-top: 0; }
  .md-informe p { margin: 0 0 10px; }
  .md-informe .md-h { color: var(--md-strong, var(--color-text)); font-weight: 700; letter-spacing: -0.01em; margin: 20px 0 8px; line-height: 1.3; break-after: avoid; }
  .md-informe .md-h1 { font-size: 18px; }
  .md-informe .md-h2 { font-size: 15.5px; padding-bottom: 4px; border-bottom: 1px solid var(--md-border, var(--color-border)); }
  .md-informe .md-h3 { font-size: 14px; }
  .md-informe .md-h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--md-muted, var(--color-muted)); }
  .md-informe ul, .md-informe ol { margin: 0 0 10px; padding-left: 22px; }
  /* El preflight de Tailwind deja las listas sin viñeta ni número: sin esto,
     las listas de los informes se leían como párrafos sueltos. */
  .md-informe ul { list-style: disc; }
  .md-informe ol { list-style: decimal; }
  .md-informe li { margin: 3px 0; }
  .md-informe li::marker { color: var(--md-muted, var(--color-muted)); }
  .md-informe blockquote { margin: 0 0 10px; padding: 8px 14px; border-left: 3px solid var(--md-accent, var(--color-primary)); background: var(--md-quote-bg, var(--color-surface-alt)); border-radius: 0 8px 8px 0; color: var(--md-strong, var(--color-text)); }
  .md-informe .md-code, .md-informe pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .md-informe .md-code { font-size: 12px; padding: 1px 5px; border-radius: 5px; background: var(--md-code-bg, var(--color-surface-alt)); color: var(--md-strong, var(--color-text)); }
  .md-informe pre { margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; background: var(--md-code-bg, var(--color-surface-alt)); border: 1px solid var(--md-border, var(--color-border)); font-size: 12px; line-height: 1.5; overflow-x: auto; white-space: pre; break-inside: avoid; }
  .md-informe hr { border: none; border-top: 1px solid var(--md-border, var(--color-border)); margin: 16px 0; }
  .md-informe a { color: var(--md-accent, var(--color-primary)); text-decoration: underline; text-underline-offset: 2px; }
  .md-informe .md-img { display: block; width: 100%; overflow: hidden; border-radius: 8px; border: 1px solid var(--md-border, var(--color-border)); background: var(--md-quote-bg, var(--color-surface-alt)); }
  .md-informe .md-img > img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .md-informe .md-img[data-ancho="390"] { max-width: 320px; margin-inline: auto; }
  .md-informe p > .md-img { margin: 4px 0 10px; }
  .md-informe .md-capturas { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; margin: 4px 0 16px; }
  .md-informe .md-captura { margin: 0; min-width: 0; break-inside: avoid; }
  .md-informe .md-captura figcaption { margin-top: 6px; font-size: 12px; font-weight: 600; text-align: center; color: var(--md-muted, var(--color-muted)); }
  @media (min-width: 768px) { .md-informe .md-capturas:not([data-una]) { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .md-informe .md-table-wrap { overflow-x: auto; margin: 0 0 12px; border: 1px solid var(--md-border, var(--color-border)); border-radius: 10px; }
  .md-informe table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
  .md-informe th, .md-informe td { text-align: left; vertical-align: top; padding: 7px 10px; border-bottom: 1px solid var(--md-border, var(--color-border)); overflow-wrap: normal; }
  .md-informe th { font-weight: 700; color: var(--md-strong, var(--color-text)); background: var(--md-quote-bg, var(--color-surface-alt)); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; }
  .md-informe tr:last-child td { border-bottom: none; }
  .md-informe tr { break-inside: avoid; }
`
