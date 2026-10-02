import { Fragment, memo, useMemo, type ReactNode } from 'react'
import { parsear, sinMarcaAbierta, type Linea } from './markdown'
import s from '../orbi.module.css'

function Lineas({ partes, onLink }: { partes: Linea[]; onLink: (ruta: string) => void }): ReactNode {
  return partes.map((p, i) => {
    switch (p.tipo) {
      case 'texto': return <Fragment key={i}>{p.texto}</Fragment>
      case 'salto': return <br key={i} />
      case 'negrita': return <strong key={i}><Lineas partes={p.partes} onLink={onLink} /></strong>
      case 'cursiva': return <em key={i}><Lineas partes={p.partes} onLink={onLink} /></em>
      case 'codigo': return <code key={i}>{p.texto}</code>
      case 'link': return <button key={i} type="button" className={s.link} onClick={() => onLink(p.ruta)}>{p.texto}</button>
    }
  })
}

/**
 * La respuesta de Orbi con formato. Memo: mientras llega el texto en vivo solo
 * se vuelve a dibujar el último mensaje, no la conversación entera.
 */
export const Markdown = memo(function Markdown({ texto, enVivo, onLink }: { texto: string; enVivo?: boolean; onLink: (ruta: string) => void }) {
  const bloques = useMemo(() => parsear(enVivo ? sinMarcaAbierta(texto) : texto), [texto, enVivo])
  return (
    <div className={s.respuesta}>
      {bloques.map((b, i) => {
        const ultimo = i === bloques.length - 1
        const cursor = enVivo && ultimo ? <span className={s.cursorBloque} aria-hidden /> : null
        switch (b.tipo) {
          case 'parrafo':
            return <p key={i}><Lineas partes={b.partes} onLink={onLink} />{cursor}</p>
          case 'titulo':
            return <div key={i} className={s.respuestaTitulo} role="heading" aria-level={3}><Lineas partes={b.partes} onLink={onLink} /></div>
          case 'lista': {
            const Lista = b.ordenada ? 'ol' : 'ul'
            return (
              <Lista key={i}>
                {b.items.map((item, k) => <li key={k}><Lineas partes={item} onLink={onLink} />{k === b.items.length - 1 ? cursor : null}</li>)}
              </Lista>
            )
          }
          case 'tabla':
            return (
              <div key={i} className={s.tabla}>
                <table>
                  <thead>
                    <tr>{b.encabezado.map((c, k) => <th key={k} className={b.numericas[k] ? s.num : undefined}><Lineas partes={c} onLink={onLink} /></th>)}</tr>
                  </thead>
                  <tbody>
                    {b.filas.map((f, k) => (
                      <tr key={k}>{f.map((c, j) => <td key={j} className={b.numericas[j] ? s.num : undefined}><Lineas partes={c} onLink={onLink} /></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      })}
      {enVivo && !bloques.length && <p><span className={s.cursorBloque} aria-hidden /></p>}
    </div>
  )
})
