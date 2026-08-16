import { useState } from 'react'
import { Copy, Check, Link2 } from 'lucide-react'
import { Toggle } from '../../../_shared/components/Toggle'
import { SectionCard } from './FormField'
import { useAuth } from '@/hooks/useAuth'
import { tenantUrl } from '@/lib/tenant'
import { useCategoriasDescuento, useBuscarProductosDescuento } from '../hooks/useCatalogoDescuento'

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", "Fira Code", monospace' }
type TipoDestino = 'inicio' | 'producto' | 'categoria'

interface Props {
  codigo: string
  linkActivo: boolean
  onToggleActivo: (v: boolean) => void
  linkRedirect: string | null
  onRedirectChange: (v: string | null) => void
}

export function LinkCompartibleSection({ codigo, linkActivo, onToggleActivo, linkRedirect, onRedirectChange }: Props) {
  const { user } = useAuth()
  const subdomain = user && 'business' in user ? user.business.subdomain : null
  const [copiado, setCopiado] = useState(false)
  const [queryProducto, setQueryProducto] = useState('')

  const { data: categorias = [] } = useCategoriasDescuento()
  const { data: busquedaProductos } = useBuscarProductosDescuento(queryProducto)
  const productosFiltrados = busquedaProductos?.productos ?? []

  // tipoDestino es estado propio de la UI (qué sección se ve), NO derivado de
  // linkRedirect — si no, clickear "Producto" no mostraba nada: linkRedirect
  // seguía null hasta elegir un producto puntual, así que el valor derivado
  // volvía a caer en 'inicio' apenas se soltaba el click. El valor inicial sí
  // se lee de linkRedirect (una vez, al montar) para reflejar la selección
  // ya guardada al abrir el form de edición.
  const [tipoDestino, setTipoDestino] = useState<TipoDestino>(
    () => !linkRedirect ? 'inicio' : linkRedirect.startsWith('/productos/') ? 'producto' : 'categoria',
  )
  const url = subdomain ? tenantUrl(subdomain, `/descuentos/${codigo}`) : `(cargando…) /descuentos/${codigo}`

  function copiar() {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function handleTipoDestino(tipo: TipoDestino) {
    setTipoDestino(tipo)
    onRedirectChange(null)
    setQueryProducto('')
  }

  return (
    <SectionCard
      title="Link compartible"
      subtitle="Generá un link que aplica este cupón automáticamente al entrar a la tienda."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)' }}>Habilitar link compartible</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
              {linkActivo ? 'El link está activo y puede ser compartido.' : 'Activá para generar un link compartible.'}
            </div>
          </div>
          <Toggle checked={linkActivo} onChange={onToggleActivo} />
        </div>

        {linkActivo && (
          <>
            {/* URL */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>URL</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 10px', height: 34, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 11, color: 'var(--color-body)', overflow: 'hidden', ...MONO }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                </div>
                <button onClick={copiar} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: copiado ? 'var(--color-success)' : 'var(--color-body)', fontSize: 12, cursor: 'pointer' }}>
                  {copiado ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                </button>
              </div>
            </div>

            {/* Página de destino */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Página de destino</div>
              <div style={{ display: 'flex', gap: 14 }}>
                {(['inicio', 'producto', 'categoria'] as TipoDestino[]).map((t) => {
                  const labels = { inicio: 'Inicio', producto: 'Producto', categoria: 'Categoría' }
                  return (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--color-body)' }}>
                      <input type="radio" name="destino-form" value={t} checked={tipoDestino === t} onChange={() => handleTipoDestino(t)} style={{ accentColor: 'var(--color-primary)' }} />
                      {labels[t]}
                    </label>
                  )
                })}
              </div>

              {tipoDestino === 'producto' && (
                <div style={{ marginTop: 8 }}>
                  <input value={queryProducto} onChange={(e) => setQueryProducto(e.target.value)} placeholder="Buscar producto…" style={{ width: '100%', height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', fontSize: 13, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }} />
                  {queryProducto.trim() && (
                    <div style={{ maxHeight: 120, overflowY: 'auto', marginTop: 6, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                      {productosFiltrados.map((p) => (
                        <button key={p.id} onClick={() => onRedirectChange(`/productos/${p.id}`)} style={{ width: '100%', textAlign: 'left', padding: '6px 10px', background: linkRedirect === `/productos/${p.id}` ? 'var(--color-primary-bg)' : 'transparent', color: linkRedirect === `/productos/${p.id}` ? 'var(--color-primary)' : 'var(--color-body)', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', fontSize: 13 }}>
                          {p.name}
                        </button>
                      ))}
                      {productosFiltrados.length === 0 && (
                        <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--color-muted)' }}>Sin resultados.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tipoDestino === 'categoria' && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {categorias.map((cat) => (
                    <button key={cat.id} onClick={() => onRedirectChange(`/categorias/${cat.id}`)} style={{ height: 30, padding: '0 12px', borderRadius: 9999, border: `1px solid ${linkRedirect === `/categorias/${cat.id}` ? 'var(--color-primary)' : 'var(--color-border)'}`, background: linkRedirect === `/categorias/${cat.id}` ? 'var(--color-primary-bg)' : 'transparent', color: linkRedirect === `/categorias/${cat.id}` ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12, cursor: 'pointer' }}>
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)', fontSize: 12, color: 'var(--color-primary)' }}>
              <Link2 size={12} /> El link se comparte desde el menú contextual (⋮) de la tabla de cupones.
            </div>
          </>
        )}
      </div>
    </SectionCard>
  )
}
