import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { ApiError, enviarProductoInstagram, panelListProducts, type ApiProductRow, type InstagramMensaje } from '@/lib/api'
import { fmtMoney } from '@/lib/utils'

// Mandar la ficha de un producto por mensaje directo: su foto y, en otro mensaje, el nombre, el precio y el enlace
// corto de la tienda (en los mensajes directos los enlaces sí se pueden tocar). Se elige de los productos
// publicados de la tienda.

interface Props {
  charlaId: string
  cliente: string
  onCerrar: () => void
  /** Los mensajes que salieron, para sumarlos al chat. */
  onEnviado: (mensajes: InstagramMensaje[]) => void
}

export function EnviarProductoModal({ charlaId, cliente, onCerrar, onEnviado }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState<ApiProductRow[] | null>(null)
  const [elegido, setElegido] = useState<ApiProductRow | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])

  useEffect(() => {
    let cancelado = false
    const t = setTimeout(() => {
      panelListProducts({ search: busqueda.trim() || undefined, status: 'PUBLISHED', limit: 12 })
        .then((r) => { if (!cancelado) setProductos(r.data) })
        .catch(() => { if (!cancelado) setProductos([]) })
    }, busqueda ? 300 : 0)
    return () => { cancelado = true; clearTimeout(t) }
  }, [busqueda])

  const enviar = async () => {
    if (!elegido) return
    setEnviando(true); setError(null)
    try {
      const mensajes = await enviarProductoInstagram(charlaId, elegido.id)
      if (!montado.current) return
      onEnviado(mensajes)
      onCerrar()
    } catch (e) {
      if (montado.current) { setError(e instanceof ApiError ? e.message : 'No se pudo mandar el producto. Probá de nuevo.'); setEnviando(false) }
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => { if (!enviando) onCerrar() }}
      dismissable={!enviando}
      title="Mandar un producto"
      maxWidth={460}
      footer={(
        <>
          <Button variant="secondary" disabled={enviando} onClick={onCerrar}>Cancelar</Button>
          <Button loading={enviando} disabled={!elegido} onClick={enviar}>Mandar a {cliente.split(' ')[0]}</Button>
        </>
      )}
    >
      <style>{CSS}</style>
      <p className="ep-suave">Le llega la foto del producto y, abajo, su nombre, el precio y el enlace a tu tienda.</p>
      <label className="ep-buscador">
        <Search size={15} strokeWidth={2} aria-hidden />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en tus productos publicados" aria-label="Buscar producto" autoFocus />
      </label>
      <ul className="ep-lista">
        {productos === null && <li className="ep-vacio">Cargando…</li>}
        {productos?.length === 0 && <li className="ep-vacio">{busqueda ? 'No hay productos publicados con ese nombre.' : 'Todavía no tenés productos publicados en tu tienda.'}</li>}
        {productos?.map((p) => {
          const foto = p.primaryImageUrl ?? p.images[0] ?? null
          const activo = elegido?.id === p.id
          return (
            <li key={p.id}>
              <button type="button" className={`ep-producto${activo ? ' ep-producto-activo' : ''}`} aria-pressed={activo} onClick={() => setElegido(p)}>
                <span className="ep-miniatura">{foto ? <img src={foto} alt="" /> : null}</span>
                <span className="ep-texto">
                  <span className="ep-nombre">{p.name}</span>
                  <span className="ep-sub">{fmtMoney(p.basePrice)}{foto ? '' : ' · sin foto: va solo el texto'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {error && <p className="ep-error" role="alert">{error}</p>}
    </Modal>
  )
}

const CSS = `
.ep-suave { margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: var(--color-muted); }
.ep-buscador { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; margin-bottom: 10px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); color: var(--color-muted); }
.ep-buscador:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-bg); background: var(--color-surface); }
.ep-buscador input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; color: var(--color-text); }
.ep-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; }
.ep-vacio { padding: 18px 8px; text-align: center; font-size: 13px; color: var(--color-muted); }
.ep-producto { width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid transparent; border-radius: 12px; background: transparent; cursor: pointer; font: inherit; text-align: left; transition: background-color 150ms, border-color 150ms; }
.ep-producto:hover { background: var(--color-surface-alt); }
.ep-producto-activo, .ep-producto-activo:hover { border-color: var(--color-primary); background: var(--color-primary-bg); }
.ep-producto:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.ep-miniatura { width: 44px; height: 44px; flex-shrink: 0; overflow: hidden; border-radius: 10px; border: 1px solid var(--color-border); background: #fff; display: inline-flex; }
.ep-miniatura img { width: 100%; height: 100%; object-fit: contain; }
.ep-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ep-nombre { font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ep-sub { font-size: 12.5px; color: var(--color-muted); }
.ep-error { margin: 10px 0 0; font-size: 12.5px; color: var(--color-error); }
@media (prefers-reduced-motion: reduce) { .ep-producto { transition: none; } }
`
