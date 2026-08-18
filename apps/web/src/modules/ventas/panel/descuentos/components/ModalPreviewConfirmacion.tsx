interface Props {
  titulo: string
  labelConfirmar: string
  labelCancelar?: string
  cargando?: boolean
  onCancelar: () => void
  onConfirmar: () => void
  children: React.ReactNode
}

// Modal centrado de confirmación de guardado (solo mobile). Renderiza el mismo
// preview/resumen que la columna lateral de desktop, pasado como children.
// El tap en el overlay NO cierra: es una confirmación de una acción con efecto.
export function ModalPreviewConfirmacion({
  titulo, labelConfirmar, labelCancelar = 'Cancelar', cargando = false, onCancelar, onConfirmar, children,
}: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600, padding: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg)', borderRadius: 16, width: '100%', maxWidth: 440,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'Sora, Inter, sans-serif' }}>
            {titulo}
          </h3>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {children}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={onCancelar}
            disabled={cargando}
            style={{
              height: 40, padding: '0 20px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text)',
              fontSize: 14, fontWeight: 500, cursor: cargando ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {labelCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={cargando}
            style={{
              height: 40, padding: '0 24px', borderRadius: 8, border: 'none',
              background: cargando ? 'var(--color-border)' : 'var(--color-primary)', color: cargando ? 'var(--color-muted)' : 'var(--color-on-primary)',
              fontSize: 14, fontWeight: 600, cursor: cargando ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {cargando ? 'Guardando…' : labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
