import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, MessageSquare, ShieldCheck, X } from 'lucide-react'
import {
  panelResenasDeProducto, panelOcultarResena, panelMostrarResena,
  ApiError, type ResenaPanel, type ResenasDeProducto,
} from '@/lib/api'

// Moderación de las reseñas de UN producto (hallazgo
// `resenas-sin-moderacion-panel`). Se abre desde el ícono de la fila del
// producto, en Productos.
//
// Por qué por producto y no una bandeja general (criterio de Mateo): una
// reseña se entiende leyendo el producto al que le pegan. Una lista suelta de
// "todas las reseñas del negocio" obliga a saltar de una a otra para saber de
// qué están hablando.
//
// Ocultar PIDE UN MOTIVO, siempre. No es burocracia: es lo único que, tres
// meses después, explica por qué esa reseña no está — y el backend lo exige
// igual, así que pedirlo acá evita un 400 que no se entiende.

const fecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

export function ResenasProducto({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [data, setData] = useState<ResenasDeProducto | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  // Reseña que se está por ocultar, con el motivo que se va escribiendo.
  const [ocultando, setOcultando] = useState<{ id: string; motivo: string } | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setData(await panelResenasDeProducto(productId))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudieron cargar las reseñas')
    } finally {
      setCargando(false)
    }
  }, [productId])

  useEffect(() => { void cargar() }, [cargar])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const ocultar = async (id: string, motivo: string) => {
    setGuardando(id); setError('')
    try {
      await panelOcultarResena(id, motivo.trim())
      setOcultando(null)
      await cargar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo ocultar la reseña')
    } finally {
      setGuardando(null)
    }
  }

  const mostrar = async (id: string) => {
    setGuardando(id); setError('')
    try {
      await panelMostrarResena(id)
      await cargar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo volver a mostrar la reseña')
    } finally {
      setGuardando(null)
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Reseñas de ${data?.producto.name ?? 'el producto'}`}
        style={{
          width: 'min(680px, 100%)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
          background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 16, boxShadow: 'var(--shadow-card-hover)',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 22px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Reseñas</h3>
            {data && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.45 }}>
                {data.producto.name} · {data.total === 0 ? 'sin reseñas' : `${data.total} en total`}
                {data.ocultas > 0 && `, ${data.ocultas} ${data.ocultas === 1 ? 'oculta' : 'ocultas'}`}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ds-hover" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </header>

        <div style={{ overflowY: 'auto', padding: '16px 22px 22px' }}>
          {error && (
            <div role="alert" style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 10, background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {cargando && <p style={{ fontSize: 13.5, color: 'var(--color-muted)' }}>Cargando…</p>}

          {!cargando && data?.total === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 10px' }}>
              <MessageSquare size={26} strokeWidth={1.7} color="var(--color-subtle)" aria-hidden />
              <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
                Este producto todavía no tiene reseñas.<br />
                Solo puede dejar una quien lo compró y ya lo recibió, una vez por compra.
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {data?.resenas.map((r) => (
              <Resena
                key={r.id}
                r={r}
                ocultando={ocultando?.id === r.id ? ocultando.motivo : null}
                guardando={guardando === r.id}
                onPedirMotivo={() => setOcultando({ id: r.id, motivo: '' })}
                onCambiarMotivo={(m) => setOcultando({ id: r.id, motivo: m })}
                onCancelar={() => setOcultando(null)}
                onOcultar={(m) => void ocultar(r.id, m)}
                onMostrar={() => void mostrar(r.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Resena({
  r, ocultando, guardando, onPedirMotivo, onCambiarMotivo, onCancelar, onOcultar, onMostrar,
}: {
  r: ResenaPanel
  ocultando: string | null
  guardando: boolean
  onPedirMotivo: () => void
  onCambiarMotivo: (m: string) => void
  onCancelar: () => void
  onOcultar: (motivo: string) => void
  onMostrar: () => void
}) {
  const oculta = r.status === 'HIDDEN'
  return (
    <article style={{
      border: `1px solid ${oculta ? 'var(--color-border)' : 'var(--color-border)'}`,
      borderRadius: 12, padding: '13px 15px',
      background: oculta ? 'var(--color-surface-alt)' : 'var(--color-bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>{r.customerName}</span>
        {r.isVerified && (
          <span title="Compró el producto y ya lo recibió" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, borderRadius: 9999, padding: '3px 8px', background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <ShieldCheck size={11} strokeWidth={2.4} aria-hidden /> Compra verificada
          </span>
        )}
        {oculta && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, borderRadius: 9999, padding: '3px 8px', background: 'rgba(245,158,11,0.13)', color: 'var(--color-warning)' }}>
            <EyeOff size={11} strokeWidth={2.4} aria-hidden /> Oculta
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--color-subtle)', whiteSpace: 'nowrap' }}>
          Pedido #{r.orderNumber} · {fecha(r.createdAt)}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13.5, color: oculta ? 'var(--color-muted)' : 'var(--color-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {r.text}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--color-subtle)' }}>{r.customerEmail}</p>

      {oculta && r.hiddenReason && (
        <p style={{ margin: '9px 0 0', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--color-body)' }}>Motivo:</strong> {r.hiddenReason}
        </p>
      )}

      {ocultando === null ? (
        <div style={{ marginTop: 11 }}>
          {oculta ? (
            <button type="button" onClick={onMostrar} disabled={guardando} className="ds-hover" style={btnChico}>
              <Eye size={13} strokeWidth={2.2} aria-hidden /> {guardando ? 'Guardando…' : 'Volver a mostrar'}
            </button>
          ) : (
            <button type="button" onClick={onPedirMotivo} disabled={guardando} className="ds-hover" style={btnChico}>
              <EyeOff size={13} strokeWidth={2.2} aria-hidden /> Ocultar de la tienda
            </button>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 11 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 5 }}>
              Por qué la ocultás (queda guardado, no lo ve el cliente)
            </span>
            <input
              value={ocultando}
              onChange={(e) => onCambiarMotivo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && ocultando.trim()) onOcultar(ocultando) }}
              maxLength={300}
              autoFocus
              placeholder="Ej: insultos, o habla de otro producto"
              className="ds-field"
              style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => onOcultar(ocultando)}
              disabled={guardando || !ocultando.trim()}
              className="ds-hover"
              style={{ ...btnChico, borderColor: 'var(--color-error)', color: ocultando.trim() ? 'var(--color-error)' : 'var(--color-subtle)' }}
            >
              {guardando ? 'Ocultando…' : 'Ocultar'}
            </button>
            <button type="button" onClick={onCancelar} disabled={guardando} className="ds-hover" style={btnChico}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

const btnChico: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 32, padding: '0 12px', borderRadius: 9,
  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
  color: 'var(--color-body)', fontSize: 12.5, fontWeight: 600,
  fontFamily: 'inherit', cursor: 'pointer',
}
