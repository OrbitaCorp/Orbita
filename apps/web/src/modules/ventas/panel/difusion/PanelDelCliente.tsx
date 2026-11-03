import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, Link2, Search, ShoppingBag, UserRound } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import {
  ApiError, getCustomers, getInstagramClienteDeCharla, vincularInstagramCliente,
  type ApiCustomer, type InstagramFichaCliente,
} from '@/lib/api'
import { adminPath, currentSlug } from '@/lib/tenant'
import { fmtMoney } from '@/lib/utils'
import { iniciales } from './formatoMensajes'

// Panel lateral del chat de Instagram: quién es la persona para el negocio. Sus pedidos, lo que gastó, y los
// atajos para pasar de la charla a la venta: crear un pedido con esa persona ya elegida, abrir su ficha de cliente,
// o unirla con un cliente que el negocio ya tenía (el que compró por la tienda, por ejemplo).

interface Props {
  charlaId: string
  /** Se unió con otro cliente: la charla puede haber pasado a otra (la que ya tenía ese cliente). */
  onVinculado: (conversationId: string) => void
}

const ESTADOS: Record<string, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PREPARING: 'En preparación', SHIPPED: 'Enviado',
  DELIVERED: 'Entregado', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
}

export function PanelDelCliente({ charlaId, onVinculado }: Props) {
  const router = useRouter()
  const [ficha, setFicha] = useState<InstagramFichaCliente | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vinculando, setVinculando] = useState(false)

  useEffect(() => {
    let cancelado = false
    setFicha(null); setError(null)
    getInstagramClienteDeCharla(charlaId)
      .then((f) => { if (!cancelado) setFicha(f) })
      .catch((e) => { if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudo cargar al cliente.') })
    return () => { cancelado = true }
  }, [charlaId])

  const irA = (seccion: string, query: Record<string, string>) => {
    const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
    const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
    void router.push({ pathname: adminPath(negocioId, moduloPadre, seccion), query })
  }

  if (error) return <aside className="pc-raiz"><style>{CSS}</style><p className="pc-error" role="alert">{error}</p></aside>
  if (!ficha) return <aside className="pc-raiz" aria-busy="true"><style>{CSS}</style><div className="pc-esqueleto"><span /><span /><span /></div></aside>

  const desde = new Date(ficha.desde).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <aside className="pc-raiz" aria-label="Datos del cliente">
      <style>{CSS}</style>
      <div className="pc-persona">
        <span className="pc-avatar" aria-hidden>{iniciales(ficha.nombre)}</span>
        <p className="pc-nombre">{ficha.nombre}</p>
        <p className="pc-sub">Cliente desde {desde}</p>
        {(ficha.email || ficha.telefono) && <p className="pc-contacto">{[ficha.email, ficha.telefono].filter(Boolean).join(' · ')}</p>}
      </div>

      <div className="pc-numeros">
        <div><p className="pc-numero">{ficha.pedidos.cantidad}</p><p className="pc-etiqueta">{ficha.pedidos.cantidad === 1 ? 'pedido' : 'pedidos'}</p></div>
        <div><p className="pc-numero">{fmtMoney(ficha.pedidos.total)}</p><p className="pc-etiqueta">gastó en total</p></div>
      </div>

      <div className="pc-acciones">
        <Button size="md" onClick={() => irA('pedidos', { vista: 'nuevo', clienteId: ficha.id })} icon={<ShoppingBag size={15} aria-hidden />}>Crear pedido</Button>
        <Button size="md" variant="secondary" onClick={() => irA('clientes', { vista: 'detalle', id: ficha.id })} icon={<UserRound size={15} aria-hidden />}>Ver cliente</Button>
      </div>

      <div>
        <p className="pc-seccion">Últimos pedidos</p>
        {ficha.pedidos.ultimos.length === 0 ? (
          <p className="pc-vacio">Todavía no compró. Si cierran una venta por acá, creale el pedido y queda todo junto.</p>
        ) : (
          <ul className="pc-pedidos">
            {ficha.pedidos.ultimos.map((p) => (
              <li key={p.id}>
                <button type="button" className="pc-pedido" onClick={() => irA('pedidos', { vista: 'detalle', id: p.id })}>
                  <span className="pc-pedido-texto">
                    <span className="pc-pedido-titulo">Pedido #{p.numero}</span>
                    <span className="pc-pedido-sub">{ESTADOS[p.estado] ?? p.estado} · {new Date(p.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                  </span>
                  <span className="pc-pedido-total">{fmtMoney(p.total)}</span>
                  <ArrowRight size={13} aria-hidden className="pc-flecha" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pc-vincular">
        <p className="pc-seccion">¿Ya es cliente tuyo?</p>
        <p className="pc-vacio" style={{ marginBottom: 8 }}>Si ya te compró por la tienda con otro nombre o email, unilos para ver todo su historial junto.</p>
        <Button size="sm" variant="secondary" onClick={() => setVinculando(true)} icon={<Link2 size={14} aria-hidden />}>Unir con un cliente</Button>
      </div>

      {vinculando && (
        <ModalDeVinculo
          charlaId={charlaId}
          aExcluir={ficha.id}
          nombre={ficha.nombre}
          onCerrar={() => setVinculando(false)}
          onVinculado={(id) => { setVinculando(false); onVinculado(id) }}
        />
      )}
    </aside>
  )
}

function ModalDeVinculo({ charlaId, aExcluir, nombre, onCerrar, onVinculado }: {
  charlaId: string
  aExcluir: string
  nombre: string
  onCerrar: () => void
  onVinculado: (conversationId: string) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [clientes, setClientes] = useState<ApiCustomer[] | null>(null)
  const [elegido, setElegido] = useState<ApiCustomer | null>(null)
  const [uniendo, setUniendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])

  useEffect(() => {
    let cancelado = false
    const t = setTimeout(() => {
      getCustomers({ search: busqueda.trim() || undefined, limit: 8 })
        .then((r) => { if (!cancelado) setClientes(r.data.filter((c) => c.id !== aExcluir)) })
        .catch(() => { if (!cancelado) setClientes([]) })
    }, busqueda ? 300 : 0)
    return () => { cancelado = true; clearTimeout(t) }
  }, [busqueda, aExcluir])

  const unir = async () => {
    if (!elegido) return
    setUniendo(true); setError(null)
    try {
      const r = await vincularInstagramCliente(charlaId, elegido.id)
      if (montado.current) onVinculado(r.conversationId)
    } catch (e) {
      if (montado.current) { setError(e instanceof ApiError ? e.message : 'No se pudo unir. Probá de nuevo.'); setUniendo(false) }
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => { if (!uniendo) onCerrar() }}
      dismissable={!uniendo}
      title="Unir con un cliente"
      maxWidth={460}
      footer={(
        <>
          <Button variant="secondary" disabled={uniendo} onClick={onCerrar}>Cancelar</Button>
          <Button loading={uniendo} disabled={!elegido} onClick={unir}>Unir</Button>
        </>
      )}
    >
      <p className="pc-modal-texto">
        Elegí el cliente que ya tenías. Su historial y el de <strong>{nombre}</strong> quedan en una sola ficha, y esta charla pasa a ser suya. No se puede deshacer.
      </p>
      <label className="pc-buscador">
        <Search size={15} strokeWidth={2} aria-hidden />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, email o teléfono" aria-label="Buscar cliente" autoFocus />
      </label>
      <ul className="pc-clientes">
        {clientes === null && <li className="pc-vacio" style={{ padding: 14, textAlign: 'center' }}>Cargando…</li>}
        {clientes?.length === 0 && <li className="pc-vacio" style={{ padding: 14, textAlign: 'center' }}>No hay clientes con esa búsqueda.</li>}
        {clientes?.map((c) => {
          const activo = elegido?.id === c.id
          return (
            <li key={c.id}>
              <button type="button" className={`pc-cliente${activo ? ' pc-cliente-activo' : ''}`} aria-pressed={activo} onClick={() => setElegido(c)}>
                <span className="pc-cliente-avatar" aria-hidden>{iniciales(`${c.firstName} ${c.lastName ?? ''}`)}</span>
                <span className="pc-cliente-texto">
                  <span className="pc-cliente-nombre">{c.firstName}{c.lastName ? ` ${c.lastName}` : ''}</span>
                  <span className="pc-cliente-sub">{[c.email, c.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {error && <p className="pc-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
    </Modal>
  )
}

const CSS = `
.pc-raiz { width: 300px; flex-shrink: 0; min-height: 0; overflow-y: auto; padding: 18px 16px 24px; border-left: 1px solid var(--color-border); background: var(--color-surface); display: flex; flex-direction: column; gap: 18px; }
.pc-persona { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; }
.pc-avatar { width: 64px; height: 64px; margin-bottom: 8px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #8a94a6, #5b6578); }
.pc-nombre { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--color-text); overflow-wrap: anywhere; }
.pc-sub { margin: 0; font-size: 12.5px; color: var(--color-muted); }
.pc-contacto { margin: 4px 0 0; font-size: 12.5px; color: var(--color-muted); overflow-wrap: anywhere; }
.pc-numeros { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px; border-radius: 14px; background: var(--color-surface-alt); border: 1px solid var(--color-border); text-align: center; }
.pc-numero { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: var(--color-text); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.pc-etiqueta { margin: 2px 0 0; font-size: 11.5px; color: var(--color-muted); }
.pc-acciones { display: flex; flex-direction: column; gap: 8px; }
.pc-acciones button { justify-content: center; }
.pc-seccion { margin: 0 0 8px; font-size: 12.5px; font-weight: 600; color: var(--color-text); }
.pc-vacio { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
.pc-pedidos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pc-pedido { width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); cursor: pointer; font: inherit; text-align: left; transition: border-color 150ms; }
.pc-pedido:hover { border-color: var(--color-muted); }
.pc-pedido:focus-visible, .pc-cliente:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.pc-pedido-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.pc-pedido-titulo { font-size: 13px; font-weight: 600; color: var(--color-text); }
.pc-pedido-sub { font-size: 12px; color: var(--color-muted); }
.pc-pedido-total { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-text); }
.pc-flecha { flex-shrink: 0; color: var(--color-muted); }
.pc-error { margin: 0; font-size: 12.5px; color: var(--color-error); }
.pc-esqueleto { display: flex; flex-direction: column; gap: 12px; }
.pc-esqueleto span { height: 72px; border-radius: 12px; background: var(--color-surface-alt); }

.pc-modal-texto { margin: 0 0 12px; font-size: 13px; line-height: 1.55; color: var(--color-muted); }
.pc-buscador { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; margin-bottom: 10px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); color: var(--color-muted); }
.pc-buscador:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-bg); background: var(--color-surface); }
.pc-buscador input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; color: var(--color-text); }
.pc-clientes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto; }
.pc-cliente { width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid transparent; border-radius: 12px; background: transparent; cursor: pointer; font: inherit; text-align: left; transition: background-color 150ms, border-color 150ms; }
.pc-cliente:hover:not(:disabled) { background: var(--color-surface-alt); }
.pc-cliente:disabled { opacity: 0.5; cursor: not-allowed; }
.pc-cliente-activo, .pc-cliente-activo:hover { border-color: var(--color-primary); background: var(--color-primary-bg); }
.pc-cliente-avatar { width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--color-muted); background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.pc-cliente-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pc-cliente-nombre { font-size: 14px; font-weight: 600; color: var(--color-text); }
.pc-cliente-sub { font-size: 12.5px; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 1180px) {
  .pc-raiz { position: absolute; top: 0; right: 0; bottom: 0; z-index: 10; width: min(320px, 100%); box-shadow: -12px 0 28px -16px rgba(15,23,42,0.35); }
}
@media (prefers-reduced-motion: reduce) { .pc-pedido, .pc-cliente { transition: none; } }
`
