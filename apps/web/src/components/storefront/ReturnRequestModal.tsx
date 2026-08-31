import { useState } from 'react'
import { RotateCcw, CheckCircle2, ShieldCheck, PackageX, HelpCircle } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { createReturnRequest, StorefrontApiError, type ReturnRequestReason } from '@/lib/storefront/api'
import { openWpp } from '@/lib/storefront/utils'
import type { TiendaConfig } from '@/lib/storefront/types'

type Props = {
  isOpen: boolean
  onClose: () => void
  slug: string
  tienda: TiendaConfig
}

const MOTIVOS: { value: ReturnRequestReason; label: string; icon: typeof RotateCcw; nota: string }[] = [
  {
    value: 'ARREPENTIMIENTO',
    label: 'Me arrepentí de la compra',
    icon: RotateCcw,
    nota: 'Válido dentro de los 10 días corridos desde que recibiste el pedido (Ley 24.240 / Disp. 954-2025). Tenés derecho al reintegro del dinero, sin costo para vos.',
  },
  {
    value: 'GARANTIA',
    label: 'El producto llegó fallado o dañado',
    icon: ShieldCheck,
    nota: 'Válido dentro de los 6 meses desde la entrega (Ley 24.240). Podés elegir entre reparación, cambio por otro igual o reintegro del dinero.',
  },
  {
    value: 'OTRO',
    label: 'Otro motivo',
    icon: PackageX,
    nota: 'Se resuelve según la política de cambios propia de esta tienda.',
  },
]

// Botón + formulario público de "Arrepentimiento / Devolución" (RBT-683):
// sin login, genera un número de trámite al toque y manda dos emails (uno de
// acuse de recibo al cliente, otro de aviso al comercio) — nada de esto
// queda en un panel de Órbita, la resolución del caso la coordinan cliente y
// comercio directo por email/WhatsApp (ver ReturnRequestsService, backend).
export function ReturnRequestModal({ isOpen, onClose, slug, tienda }: Props) {
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState<ReturnRequestReason | null>(null)
  const [comment, setComment] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<{ trackingNumber: string } | null>(null)

  const reset = () => {
    setOrderNumber(''); setEmail(''); setPhone(''); setReason(null); setComment('')
    setEnviando(false); setError(''); setResultado(null)
  }
  const handleClose = () => { onClose(); setTimeout(reset, 200) } // espera a que termine la animación de cierre

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const puedeEnviar = orderNumber.trim().length > 0 && emailValido && reason !== null

  const enviar = async () => {
    if (!puedeEnviar || !reason) return
    setEnviando(true)
    setError('')
    try {
      const res = await createReturnRequest(slug, {
        orderNumber: orderNumber.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        reason,
        comment: comment.trim() || undefined,
      })
      setResultado(res)
    } catch (err) {
      setError(err instanceof StorefrontApiError ? err.message : 'No pudimos enviar tu solicitud. Probá de nuevo en un momento.')
    } finally {
      setEnviando(false)
    }
  }

  if (resultado) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Solicitud enviada" variant="success" maxWidth={440}>
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
            <CheckCircle2 size={26} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-subtle)', marginBottom: 6 }}>
            Número de trámite
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16, fontFamily: '"Geist Mono", monospace' }}>
            {resultado.trackingNumber}
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6, marginBottom: 4 }}>
            Te mandamos un email a <strong style={{ color: 'var(--color-text)' }}>{email}</strong> con este número y el resumen de tu solicitud.
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--color-text)' }}>{tienda.nombre}</strong> se va a contactar con vos a la brevedad para coordinar los próximos pasos.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          {tienda.wpp && (
            <button
              className="ds-hover"
              onClick={() => openWpp(tienda.wpp, `Hola! Te escribo por mi trámite ${resultado.trackingNumber} (pedido #${orderNumber.trim()}).`)}
              style={{ height: 46, borderRadius: 8, background: 'var(--color-success)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Escribir por WhatsApp ahora
            </button>
          )}
          <button className="ds-hover" onClick={handleClose} style={{ height: 46, borderRadius: 8, background: 'transparent', color: 'var(--color-body)', border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Arrepentimiento / Devolución" maxWidth={520}>
      <p style={{ color: 'var(--color-muted)', marginBottom: 18 }}>
        Completá este formulario para iniciar tu solicitud — no hace falta que tengas cuenta ni que inicies sesión.
        <strong style={{ color: 'var(--color-text)' }}> {tienda.nombre}</strong> revisa y resuelve cada caso directamente con vos.
      </p>

      <Campo label="Número de pedido" required>
        <input
          className="ds-field" value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
          placeholder="Ej: 1024" style={inputStyle}
        />
      </Campo>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Email" required>
          <input
            className="ds-field" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="vos@email.com" style={inputStyle}
          />
        </Campo>
        <Campo label="Teléfono (opcional)">
          <input
            className="ds-field" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="11 2345 6789" style={inputStyle}
          />
        </Campo>
      </div>

      <Campo label="Motivo" required>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MOTIVOS.map(m => {
            const Icon = m.icon
            const active = reason === m.value
            return (
              <button
                key={m.value} type="button" className="ds-hover" onClick={() => setReason(m.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  padding: '10px 12px', borderRadius: 8,
                  border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: active ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                  color: active ? 'var(--color-primary)' : 'var(--color-body)',
                  fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Icon size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                {m.label}
              </button>
            )
          })}
        </div>
      </Campo>

      {reason && (
        <div style={{ display: 'flex', gap: 8, padding: 12, borderRadius: 8, background: 'var(--color-surface-alt)', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: 14 }}>
          <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{MOTIVOS.find(m => m.value === reason)?.nota}</span>
        </div>
      )}

      <Campo label="Comentario (opcional)">
        <textarea
          className="ds-field" value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Contanos más — útil sobre todo si el producto llegó fallado o dañado."
          style={{ ...inputStyle, minHeight: 70, resize: 'vertical', paddingTop: 10 }}
        />
      </Campo>

      {error && (
        <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        className="ds-hover" onClick={enviar} disabled={!puedeEnviar || enviando}
        style={{
          width: '100%', height: 48, borderRadius: 8, marginTop: 4,
          background: !puedeEnviar || enviando ? 'var(--color-border)' : 'var(--color-primary)',
          color: !puedeEnviar || enviando ? 'var(--color-muted)' : '#fff',
          border: 'none', fontSize: 14, fontWeight: 700,
          cursor: !puedeEnviar || enviando ? 'not-allowed' : 'pointer',
        }}
      >
        {enviando ? 'Enviando...' : 'Enviar solicitud'}
      </button>
    </Modal>
  )
}

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--color-error)' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px', borderRadius: 8, boxSizing: 'border-box',
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
}
