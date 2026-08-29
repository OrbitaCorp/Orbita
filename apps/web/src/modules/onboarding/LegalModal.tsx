import { useEffect } from 'react'
import { X } from 'lucide-react'
import { LEGAL_CONTENT, type LegalKey } from '@/modules/landing/components/ui/LegalModal'

// Versión liviana del modal legal de la landing (mismo contenido, importado
// de ahí para no duplicar texto) pero con los tokens var(--color-*) que usa
// el resto del wizard — el original depende del ThemeContext de la landing,
// que no está montado en /onboarding.
export function LegalModal({ contentKey, onClose }: { contentKey: LegalKey | null; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (contentKey) {
      window.addEventListener('keydown', onEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', onEsc)
      document.body.style.overflow = ''
    }
  }, [contentKey, onClose])

  if (!contentKey) return null
  const content = LEGAL_CONTENT[contentKey]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}
      />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 560, maxHeight: '85vh',
        borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{content.title}</div>
            <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 2 }}>{content.date}</div>
          </div>
          <button
            onClick={onClose} aria-label="Cerrar"
            className="ds-hover"
            style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--color-muted)', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {content.sections.map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 5 }}>{s.subtitle}</div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-body)', margin: 0 }}>{s.text}</p>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 24, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
          }}>
            <p style={{ fontSize: 11.5, color: 'var(--color-body)', textAlign: 'center', margin: 0 }}>
              Para consultas legales contactá a <strong>legal@orbita.app</strong>
            </p>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="ds-hover"
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#2563EB', color: 'white', fontSize: 13, fontWeight: 700 }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
