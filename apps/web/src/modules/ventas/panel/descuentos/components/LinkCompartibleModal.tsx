import { useState } from 'react'
import { X, Copy, Check, ChevronDown, ChevronUp, Link2, Send } from 'lucide-react'
import { useToggleLink } from '../hooks/useToggleLink'
import { useEnviarLinkEmail } from '../hooks/useEnviarLinkEmail'
import { useCupon } from '../hooks/useCupon'
import { SkeletonModalLink } from './DescuentosSkeleton'
import { useAuth } from '@/hooks/useAuth'
import { tenantUrl } from '@/lib/tenant'
import type { Cupon } from '../types'

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", "Fira Code", monospace' }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// El contenido del email (valor, saludo, botón con el link) lo arma el
// servidor a partir del cupón — CouponsService.sendLinkEmail. Antes se armaba
// acá y la API mandaba el HTML tal cual (auditoría interna 10/09).

interface Props {
  cupon: Cupon
  onClose: () => void
}

export function LinkCompartibleModal({ cupon: cuponFila, onClose }: Props) {
  const { user } = useAuth()
  const subdomain = user && 'business' in user ? user.business.subdomain : null

  // La fila del listado trae link_redirect/productosIds incompletos (son
  // placeholders para la tabla) — se pide el detalle completo, única fuente
  // confiable para armar el PUT (reemplaza el cupón entero, ver useToggleLink).
  const { data: cupon, isLoading: cargandoCupon } = useCupon(cuponFila.id)

  const [copiado, setCopiado] = useState(false)
  const [emailExpanded, setEmailExpanded] = useState(false)
  const [emailDestino, setEmailDestino] = useState('')
  const [nombreDestino, setNombreDestino] = useState('')
  const [emailEnviado, setEmailEnviado] = useState(false)

  const toggleLink = useToggleLink()
  const enviarEmail = useEnviarLinkEmail()

  const linkActivo = cupon?.link_activo ?? false
  const urlActual = subdomain && cupon ? tenantUrl(subdomain, `/descuentos/${cupon.codigo}`) : ''

  function copiar() {
    if (!urlActual) return
    navigator.clipboard.writeText(urlActual).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function handleActivar() {
    if (!cupon) return
    toggleLink.mutate({ cupon, link_activo: true, link_redirect: null })
  }

  const emailValido = EMAIL_RE.test(emailDestino.trim())

  function handleEnviarEmail() {
    if (!emailValido || !cupon || !urlActual) return
    enviarEmail.mutate({ couponId: cupon.id, to: emailDestino.trim(), nombreDestino: nombreDestino.trim() || undefined }, {
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
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Compartir cupón</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2, ...MONO }}>{cuponFila.codigo}</div>
          </div>
          <button className="ds-hover" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={15} />
          </button>
        </div>

        {cargandoCupon || !cupon ? (
          <SkeletonModalLink conEstado />
        ) : (
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Sección 1 — URL */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>URL del link</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 12, color: 'var(--color-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...MONO }}>
                {urlActual || '-'}
              </div>
              <button className="ds-hover" onClick={copiar} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: copiado ? 'var(--color-success-bg, #f0fdf4)' : 'var(--color-bg)', color: copiado ? 'var(--color-success)' : 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 9999, background: linkActivo ? 'rgba(16,185,129,.1)' : 'var(--color-surface-alt)', color: linkActivo ? 'var(--color-success)' : 'var(--color-muted)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                {linkActivo ? 'Activo' : 'Inactivo'}
              </span>
              {!linkActivo && (
                <button className="ds-hover" onClick={handleActivar} disabled={toggleLink.isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Link2 size={12} /> Activar link
                </button>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)' }} />

          {/* Sección 2 — Enviar por email (colapsable) */}
          <div>
            <button className="ds-hover" onClick={() => setEmailExpanded(!emailExpanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Enviar por email</span>
              {emailExpanded ? <ChevronUp size={15} color="var(--color-muted)" /> : <ChevronDown size={15} color="var(--color-muted)" />}
            </button>

            {emailExpanded && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: -4 }}>
                  Podés mandarlo a cualquier dirección — no hace falta que sea un cliente registrado.
                </div>
                <input
                  className="ds-field"
                  type="email"
                  value={emailDestino}
                  onChange={(e) => { setEmailDestino(e.target.value); setEmailEnviado(false) }}
                  placeholder="Email del destinatario"
                  style={{ width: '100%', height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
                <input
                  className="ds-field"
                  value={nombreDestino}
                  onChange={(e) => setNombreDestino(e.target.value)}
                  placeholder="Nombre (opcional, para el saludo)"
                  style={{ width: '100%', height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />

                {emailEnviado ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-success)', fontWeight: 500 }}>
                    <Check size={14} /> Email enviado a {emailDestino.trim()} ✓
                  </div>
                ) : (
                  <button className="ds-hover" onClick={handleEnviarEmail} disabled={!emailValido || enviarEmail.isPending} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: emailValido ? 'var(--color-primary)' : 'var(--color-border)', color: emailValido ? 'var(--color-on-primary)' : 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: emailValido ? 'pointer' : 'not-allowed' }}>
                    <Send size={13} /> {enviarEmail.isPending ? 'Enviando…' : 'Enviar'}
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
          <button className="ds-hover" onClick={onClose} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
