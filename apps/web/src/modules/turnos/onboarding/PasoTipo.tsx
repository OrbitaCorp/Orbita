// Camino Tienda, paso 2: qué vende. Es el mismo primer paso del alta real
// (modules/onboarding/tienda/Setup.tsx): se pueden marcar varios subrubros y
// "De todo un poco" es excluyente. Al costado (abajo en celular), el panel
// "así se arma tu catálogo" muestra qué cambia según lo elegido: el `tipo` de
// cada subrubro decide si el producto lleva variantes, número de serie o
// cantidad variable.
import { useMemo, useState } from 'react'
import { Check, Minus, Plus, Search, SearchX, ShoppingCart } from 'lucide-react'
import { plano } from './modelo'
import { SUBRUBROS_TIENDA, TIPOS, alternarTipo, subrubroPorKey, type SubrubroTienda, type TipoProducto } from './subrubrosTienda'

// El panel muestra un solo producto de ejemplo: el del tipo "más rico" entre los elegidos.
const ORDEN: TipoProducto[] = ['variantes', 'serie', 'volumen', 'simple']

export function PasoTipo({ elegidos, onCambio }: { elegidos: string[]; onCambio: (t: string[]) => void }) {
  const [busqueda, setBusqueda] = useState('')
  const visibles = useMemo(() => {
    const q = plano(busqueda.trim())
    return SUBRUBROS_TIENDA.filter(s => !q || plano(`${s.label} ${s.descripcion}`).includes(q))
  }, [busqueda])

  return (
    <div className="tuob-ancho">
      <div className="tuob-rubro-grid">
        <div style={{ minWidth: 0 }}>
          <div className="tuob-filtros">
            <label className="tuo-buscar">
              <Search size={16} aria-hidden />
              <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscá tu rubro: ropa, celulares, ferretería…" aria-label="Buscar rubro de tienda" />
            </label>
            <span className="tuob-contador" role="status" aria-live="polite">
              {elegidos.length === 0 ? 'Podés elegir varios' : `${elegidos.length} elegido${elegidos.length === 1 ? '' : 's'}`}
            </span>
          </div>

          {visibles.length === 0 ? (
            <div className="tuob-vacio">
              <SearchX size={26} strokeWidth={1.6} aria-hidden />
              <div className="tuo-h2">No encontramos “{busqueda.trim()}”</div>
              <p style={{ margin: 0, fontSize: 13 }}>Probá con otra palabra, o elegí “De todo un poco”: después podés cambiarlo.</p>
              <button type="button" className="tuo-btn tuo-btn--sm" onClick={() => setBusqueda('')}>Ver todos los rubros</button>
            </div>
          ) : (
            <div className="tuob-rubros" role="group" aria-label="Qué vendés">
              {visibles.map(s => {
                const sel = elegidos.includes(s.key)
                const etiqueta = TIPOS[s.tipo]
                return (
                  <button key={s.key} type="button" className="tuob-rubro" aria-pressed={sel} onClick={() => onCambio(alternarTipo(elegidos, s.key))}>
                    {sel && <span className="tuob-tilde" aria-hidden><Check size={13} strokeWidth={3.2} /></span>}
                    <span className="tuob-rubro-icono"><s.Icon size={20} strokeWidth={1.75} aria-hidden /></span>
                    <b>{s.label}</b>
                    <small>{s.descripcion}</small>
                    {etiqueta.etiqueta && <span className="tuob-etiqueta"><etiqueta.Icon size={12} strokeWidth={2} aria-hidden /> {etiqueta.etiqueta}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <aside id="tuob-previa" className="tuob-previa" aria-label="Así se arma tu catálogo">
          <div className="tuo-eyebrow">Así se arma tu catálogo</div>
          {elegidos.length ? <Previa key={elegidos.join()} elegidos={elegidos} /> : (
            <div className="tuob-previa-hueco">
              <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden>
                <circle cx="66" cy="66" r="60" fill="none" stroke="rgba(147,197,253,0.22)" strokeDasharray="2 7" />
                <rect x="38" y="38" width="56" height="56" rx="14" fill="none" stroke="rgba(147,197,253,0.2)" strokeWidth="8" />
                <circle cx="66" cy="6" r="4" fill="#BFDBFE" />
              </svg>
              <div className="tuo-h2">Elegí qué vendés</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--color-muted)', maxWidth: 260 }}>
                Acá vas a ver cómo se carga un producto en tu rubro: con talles, con número de serie o por peso.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Previa({ elegidos }: { elegidos: string[] }) {
  const subrubros = elegidos.map(subrubroPorKey).filter((s): s is SubrubroTienda => !!s)
  const tipos = ORDEN.filter(t => subrubros.some(s => s.tipo === t))
  const principal = subrubros.find(s => s.tipo === tipos[0]) ?? subrubros[0]
  if (!principal) return null
  return (
    <div className="tuob-previa-cuerpo">
      <div className="tuob-prod" aria-hidden>
        <span className="tuob-prod-foto"><principal.Icon size={30} strokeWidth={1.5} /></span>
        <div style={{ minWidth: 0 }}>
          <span className="tuo-rotulo">{principal.label}</span>
          <strong>Tu producto</strong>
          <span className="tuo-num tuob-prod-precio">$24.900</span>
          {principal.tipo === 'variantes' && (
            <div className="tuob-prod-fila">
              {['S', 'M', 'L', 'XL'].map(t => <span key={t} className="tuob-prod-talle tuo-num" data-sel={t === 'M'}>{t}</span>)}
              <i style={{ background: '#60A5FA' }} /><i style={{ background: '#F0ABFC' }} /><i style={{ background: '#F1F5FD' }} />
            </div>
          )}
          {principal.tipo === 'serie' && <div className="tuob-prod-fila"><span className="tuob-prod-serie tuo-num">N° de serie 4821-0093-A</span></div>}
          {principal.tipo === 'volumen' && (
            <div className="tuob-prod-fila">
              <span className="tuob-prod-cant"><Minus size={12} /><b className="tuo-num">1,5 kg</b><Plus size={12} /></span>
              <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>precio por kg</span>
            </div>
          )}
          {principal.tipo === 'simple' && <div className="tuob-prod-fila"><span className="tuob-prod-carrito"><ShoppingCart size={12} /> Agregar al carrito</span></div>}
        </div>
      </div>

      {tipos.map(t => {
        const info = TIPOS[t]
        return (
          <div key={t} className="tuob-dato">
            <info.Icon size={18} strokeWidth={1.8} aria-hidden />
            <div>
              <strong>{info.titulo}</strong>
              <p>{info.texto}</p>
            </div>
          </div>
        )
      })}

      <ul className="tuob-elegidos" aria-label="Rubros elegidos">
        {subrubros.map(s => <li key={s.key} className="tuo-chip tuo-chip--primario"><s.Icon size={12} strokeWidth={2} aria-hidden /> {s.label}</li>)}
      </ul>
    </div>
  )
}
