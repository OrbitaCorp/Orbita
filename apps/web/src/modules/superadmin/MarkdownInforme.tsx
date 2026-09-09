import { Fragment, type ReactNode } from 'react'

// Render de Markdown para los informes de la auditoría interna.
//
// Deliberadamente chico y SIN innerHTML: parsea un subconjunto (títulos,
// párrafos, listas, citas, tablas, bloques de código, separadores, negrita,
// cursiva, código inline y links http/https) y devuelve elementos React. Lo
// que no entiende lo muestra como texto plano, nunca como HTML. Alcanza para
// documentar cómo está hecho un módulo y qué se verificó; si algún día hace
// falta más, se cambia por una librería con sanitizado, no por innerHTML.

type Bloque =
  | { tipo: 'h'; nivel: 1 | 2 | 3 | 4; texto: string }
  | { tipo: 'p'; texto: string }
  | { tipo: 'ul'; items: string[] }
  | { tipo: 'ol'; items: string[] }
  | { tipo: 'quote'; texto: string }
  | { tipo: 'code'; codigo: string; lang: string }
  | { tipo: 'table'; cabecera: string[]; filas: string[][] }
  | { tipo: 'hr' }

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
    out.push({ tipo: 'p', texto: buf.join(' ') })
  }
  return out
}

// Inline: **negrita**, *cursiva*, `código`, [texto](https://…). Todo lo demás
// es texto. Los links solo http(s) y con rel seguro.
const RE_INLINE = /(\*\*[^*]+?\*\*|`[^`]+?`|\[[^\]]+?\]\(https?:\/\/[^)\s]+\)|\*[^*\s][^*]*?\*)/g

export function inline(texto: string): ReactNode {
  const partes = texto.split(RE_INLINE)
  return partes.map((p, idx) => {
    if (!p) return null
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={idx}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={idx} className="md-code">{p.slice(1, -1)}</code>
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
  .md-informe li { margin: 3px 0; }
  .md-informe li::marker { color: var(--md-muted, var(--color-muted)); }
  .md-informe blockquote { margin: 0 0 10px; padding: 8px 14px; border-left: 3px solid var(--md-accent, var(--color-primary)); background: var(--md-quote-bg, var(--color-surface-alt)); border-radius: 0 8px 8px 0; color: var(--md-strong, var(--color-text)); }
  .md-informe .md-code, .md-informe pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .md-informe .md-code { font-size: 12px; padding: 1px 5px; border-radius: 5px; background: var(--md-code-bg, var(--color-surface-alt)); color: var(--md-strong, var(--color-text)); }
  .md-informe pre { margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; background: var(--md-code-bg, var(--color-surface-alt)); border: 1px solid var(--md-border, var(--color-border)); font-size: 12px; line-height: 1.5; overflow-x: auto; white-space: pre; break-inside: avoid; }
  .md-informe hr { border: none; border-top: 1px solid var(--md-border, var(--color-border)); margin: 16px 0; }
  .md-informe a { color: var(--md-accent, var(--color-primary)); text-decoration: underline; text-underline-offset: 2px; }
  .md-informe .md-table-wrap { overflow-x: auto; margin: 0 0 12px; border: 1px solid var(--md-border, var(--color-border)); border-radius: 10px; }
  .md-informe table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
  .md-informe th, .md-informe td { text-align: left; vertical-align: top; padding: 7px 10px; border-bottom: 1px solid var(--md-border, var(--color-border)); overflow-wrap: normal; }
  .md-informe th { font-weight: 700; color: var(--md-strong, var(--color-text)); background: var(--md-quote-bg, var(--color-surface-alt)); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; }
  .md-informe tr:last-child td { border-bottom: none; }
  .md-informe tr { break-inside: avoid; }
`
