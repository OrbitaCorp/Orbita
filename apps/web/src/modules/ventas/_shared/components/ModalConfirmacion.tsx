import { X } from 'lucide-react'

type Variante = 'default' | 'danger' | 'warning'

const CONFIRM_COLOR: Record<Variante, string> = {
  default: 'var(--color-primary)',
  danger:  'var(--color-error)',
  warning: 'var(--color-warning)',
}

interface Props {
  isOpen: boolean
  titulo: string
  descripcion?: string
  labelConfirmar?: string
  labelCancelar?: string
  variante?: Variante
  cargando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

export function ModalConfirmacion({
  isOpen,
  titulo,
  descripcion,
  labelConfirmar = 'Confirmar',
  labelCancelar = 'Cancelar',
  variante = 'default',
  cargando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  if (!isOpen) return null

  return (
    <div
      onClick={onCancelar}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)',
          borderRadius: 16,
          padding: 28,
          width: '100%',
          maxWidth: 420,
          margin: '0 16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'Sora, Inter, sans-serif' }}>
            {titulo}
          </h3>
          <button
            className="ds-hover"
            onClick={onCancelar}
            style={{ background: 'none', border: 'none', borderRadius: 6, color: 'var(--color-muted)', padding: 2, marginLeft: 8 }}
          >
            <X size={18} />
          </button>
        </div>

        {descripcion && (
          <p style={{ margin: '8px 0 24px', fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
            {descripcion}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: descripcion ? 0 : 20 }}>
          <button
            className="ds-hover"
            onClick={onCancelar}
            disabled={cargando}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'inherit',
            }}
          >
            {labelCancelar}
          </button>
          <button
            className="ds-hover"
            onClick={onConfirmar}
            disabled={cargando}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: CONFIRM_COLOR[variante],
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: cargando ? 'not-allowed' : 'pointer',
              opacity: cargando ? 0.65 : 1,
              fontFamily: 'inherit',
            }}
          >
            {cargando ? 'Procesando...' : labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
