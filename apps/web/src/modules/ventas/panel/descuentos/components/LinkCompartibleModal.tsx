import { useState } from 'react'
import { X, Copy, Check, ChevronDown, ChevronUp, Link2, Loader2 } from 'lucide-react'
import { useToggleLink } from '../hooks/useToggleLink'
import { useEnviarLinkEmail } from '../hooks/useEnviarLinkEmail'
import { useClientes } from '../hooks/useClientes'
import { useCupon } from '../hooks/useCupon'
import { useCategoriasDescuento, useBuscarProductosDescuento } from '../hooks/useCatalogoDescuento'
import { useAuth } from '@/hooks/useAuth'
import { tenantUrl } from '@/lib/tenant'
import type { Cupon } from '../types'
import type { ApiCustomer } from '@/lib/api'

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", "Fira Code", monospace' }
type TipoDestino = 'inicio' | 'producto' | 'categoria'

function descCupon(c: Cupon) {
  const val = c.tipoDescuento === 'porcentaje' ? `${c.valor}%` : `$${c.valor.toLocaleString('es-AR')}`
  const alcance = c.alcance === 'ticket' ? 'en tu compra' : 'en productos seleccionados'
  return `${val} de descuento ${alcance}`
}

function nombreCliente(c: ApiCustomer) {
  return c.lastName ? `${c.firstName} ${c.lastName}` : c.firstName
}

interface Props {
  cupon: Cupon
  onClose: () => void
}

export function LinkCompartibleModal({ cupon: cuponFila, onClose }: Props) {
  const { user } = useAuth()
  const subdomain = user && 'business' in user ? user.business.subdomain : null
  const nombreNegocio = user && 'business' in user ? user.business.name : ''

  // La fila del listado trae link_redirect/productosIds incompletos (son
  // placeholders para la tabla) — se pide el detalle completo, única fuente
  // confiable para armar el PUT (reemplaza el cupón entero, ver useToggleLink).
  const { data: cupon, isLoading: cargandoCupon } = useCupon(cuponFila.id)

  const [copiado, setCopiado] = useState(false)
  const [queryProducto, setQueryProducto] = useState('')
  const [emailExpanded, setEmailExpanded] = useState(false)
  const [queryCliente, setQueryCliente] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ApiCustomer | null>(null)
  const [emailEnviado, setEmailEnviado] = useState(false)
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)

  const toggleLink = useToggleLink()
  const enviarEmail = useEnviarLinkEmail()
  const { data: clientesFiltrados = [] } = useClientes(queryCliente)
  const { data: categorias = [] } = useCategoriasDescuento()
  const { data: busquedaProductos } = useBuscarProductosDescuento(queryProducto)
  const productosFiltrados = busquedaProductos?.productos ?? []

  const linkRedirect = cupon?.link_redirect ?? null
  const linkActivo = cupon?.link_activo ?? false
  const tipoDestino: TipoDestino = !linkRedirect ? 'inicio' : linkRedirect.startsWith('/productos/') ? 'producto' : 'categoria'
  const urlActual = subdomain && cupon ? tenantUrl(subdomain, `/descuentos/${cupon.codigo}`) : ''

  function copiar() {
    if (!urlActual) return
    navigator.clipboard.writeText(urlActual).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function guardar(cambios: { link_activo?: boolean; link_redirect?: string | null }) {
    if (!cupon) return
    toggleLink.mutate({
      cupon,
      link_activo: cambios.link_activo ?? linkActivo,
      link_redirect: cambios.link_redirect,
    })
  }

  function handleActivar() {
    guardar({ link_activo: true })
  }

  function handleTipoDestino(tipo: TipoDestino) {
    setQueryProducto('')
    if (tipo === 'inicio') guardar({ link_redirect: null })
    // producto/categoria: se guarda recién cuando eligen un ítem puntual (más
    // abajo) — clickear el radio solo cambia qué lista se muestra.
  }

  function handleEnviarEmail() {
    if (!clienteSeleccionado?.email || !cupon || !urlActual) return
    const subject = `¡Tenés un descuento exclusivo en ${nombreNegocio}!`
    const body = `Hola ${clienteSeleccionado.firstName}, te compartimos un descuento especial: <strong>${descCupon(cupon)}</strong>. `
      + `El descuento se aplica automáticamente al entrar desde este link: <a href="${urlActual}">${urlActual}</a>`
    enviarEmail.mutate({ clienteId: clienteSeleccionado.id, subject, body }, {
      onSuccess: () => setEmailEnviado(true),
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', background: 'var(--color-bg)', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Link compartible</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2, ...MONO }}>{cuponFila.codigo}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={15} />
          </button>
        </div>

        {cargandoCupon || !cupon ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={20} color="var(--color-muted)" style={{ animation: 'spin 800ms linear infinite' }} />
          </div>
        ) : (
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Sección 1 — URL */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>URL del link</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 12, color: 'var(--color-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...MONO }}>
                {urlActual || '—'}
              </div>
              <button onClick={copiar} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: copiado ? 'var(--color-success-bg, #f0fdf4)' : 'var(--color-bg)', color: copiado ? 'var(--color-success)' : 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 9999, background: linkActivo ? 'rgba(16,185,129,.1)' : 'var(--color-surface-alt)', color: linkActivo ? 'var(--color-success)' : 'var(--color-muted)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                {linkActivo ? 'Activo' : 'Inactivo'}
              </span>
              {!linkActivo && (
                <button onClick={handleActivar} disabled={toggleLink.isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Link2 size={12} /> Activar link
                </button>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)' }} />

          {/* Sección 2 — Página de destino */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>Página de destino</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['inicio', 'producto', 'categoria'] as TipoDestino[]).map((t) => {
                const labels = { inicio: 'Página de inicio', producto: 'Producto específico', categoria: 'Categoría' }
                return (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--color-body)' }}>
                    <input type="radio" name="destino" value={t} checked={tipoDestino === t} onChange={() => handleTipoDestino(t)} style={{ accentColor: 'var(--color-primary)' }} />
                    {labels[t]}
                  </label>
                )
              })}
            </div>

            {tipoDestino === 'producto' && (
              <div style={{ marginTop: 12 }}>
                <input value={queryProducto} onChange={(e) => setQueryProducto(e.target.value)} placeholder="Buscar producto…" style={{ width: '100%', height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                {queryProducto.trim() && (
                  <div style={{ maxHeight: 140, overflowY: 'auto', marginTop: 6, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    {productosFiltrados.map((p) => (
                      <button key={p.id} onClick={() => guardar({ link_redirect: `/productos/${p.id}` })} style={{ width: '100%', textAlign: 'left', padding: '7px 10px', background: linkRedirect === `/productos/${p.id}` ? 'var(--color-primary-bg)' : 'transparent', color: linkRedirect === `/productos/${p.id}` ? 'var(--color-primary)' : 'var(--color-body)', border: 'none', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--color-border)' }}>
                        {p.name}
                      </button>
                    ))}
                    {productosFiltrados.length === 0 && (
                      <div style={{ padding: '7px 10px', fontSize: 12, color: 'var(--color-muted)' }}>Sin resultados.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tipoDestino === 'categoria' && (
              <div style={{ marginTop: 12, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                {categorias.map((cat) => (
                  <button key={cat.id} onClick={() => guardar({ link_redirect: `/categorias/${cat.id}` })} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: linkRedirect === `/categorias/${cat.id}` ? 'var(--color-primary-bg)' : 'transparent', color: linkRedirect === `/categorias/${cat.id}` ? 'var(--color-primary)' : 'var(--color-body)', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {cat.name}
                    <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{cat.productCount} productos</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)' }} />

          {/* Sección 3 — Enviar por email (colapsable) */}
          <div>
            <button onClick={() => setEmailExpanded(!emailExpanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Enviar a un cliente</span>
              {emailExpanded ? <ChevronUp size={15} color="var(--color-muted)" /> : <ChevronDown size={15} color="var(--color-muted)" />}
            </button>

            {emailExpanded && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <input value={clienteSeleccionado ? nombreCliente(clienteSeleccionado) : queryCliente} onChange={(e) => { setQueryCliente(e.target.value); setClienteSeleccionado(null); setEmailEnviado(false); setShowClienteDropdown(true) }} onFocus={() => setShowClienteDropdown(true)} onBlur={() => setTimeout(() => setShowClienteDropdown(false), 150)} placeholder="Buscar cliente por nombre o email…" style={{ width: '100%', height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  {showClienteDropdown && clientesFiltrados.length > 0 && !clienteSeleccionado && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, marginTop: 4, maxHeight: 160, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                      {clientesFiltrados.map((c) => (
                        <button key={c.id} onMouseDown={() => { setClienteSeleccionado(c); setShowClienteDropdown(false) }} disabled={!c.email} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: c.email ? 'pointer' : 'not-allowed', fontSize: 13, opacity: c.email ? 1 : 0.5 }}>
                          <span style={{ color: 'var(--color-text)' }}>{nombreCliente(c)}</span>
                          <span style={{ color: 'var(--color-muted)', marginLeft: 8, fontSize: 12 }}>{c.email ?? 'sin email'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {clienteSeleccionado && (
                  <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 12, color: 'var(--color-body)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div><span style={{ color: 'var(--color-muted)' }}>Para:</span> <span style={MONO}>{clienteSeleccionado.email}</span></div>
                    <div><span style={{ color: 'var(--color-muted)' }}>Asunto:</span> ¡Tenés un descuento exclusivo en {nombreNegocio}!</div>
                    <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 6, paddingTop: 6, color: 'var(--color-body)', lineHeight: 1.5 }}>
                      Hola {clienteSeleccionado.firstName}, te compartimos un descuento especial: <strong>{descCupon(cupon)}</strong>.
                      El descuento se aplica automáticamente al entrar desde el link.
                    </div>
                  </div>
                )}

                {emailEnviado ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-success)', fontWeight: 500 }}>
                    <Check size={14} /> Email enviado a {clienteSeleccionado?.email} ✓
                  </div>
                ) : (
                  <button onClick={handleEnviarEmail} disabled={!clienteSeleccionado?.email || enviarEmail.isPending} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: clienteSeleccionado?.email ? 'var(--color-primary)' : 'var(--color-border)', color: clienteSeleccionado?.email ? '#fff' : 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: clienteSeleccionado?.email ? 'pointer' : 'not-allowed' }}>
                    {enviarEmail.isPending ? 'Enviando…' : 'Enviar email'}
                  </button>
                )}
                {enviarEmail.isError && (
                  <div style={{ fontSize: 12, color: 'var(--color-error)' }}>No se pudo enviar el email. Probá de nuevo.</div>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
