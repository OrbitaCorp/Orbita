import { useState } from 'react'
import { ModalPreviewConfirmacion } from './ModalPreviewConfirmacion'

interface Props {
  labelConfirmar: string
  cargando: boolean
  // Valida el formulario y setea errores inline. Devuelve true si es válido.
  validar: () => boolean
  // Ejecuta el submit real (misma llamada que ya existe).
  onSubmit: () => void
  onCancelar: () => void
  // Preview/resumen reutilizado (mismo que la columna lateral de desktop).
  preview: React.ReactNode
}

// Footer de guardado responsive:
// - Desktop: el botón principal ejecuta el submit directo (el preview lateral está visible).
// - Mobile: el botón principal valida y, si es válido, abre un modal centrado con el preview
//   y las acciones Cancelar / Confirmar. El submit real corre al Confirmar.
export function AccionesGuardado({ labelConfirmar, cargando, validar, onSubmit, onCancelar, preview }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)

  const abrirConfirmacion = () => {
    if (validar()) setShowConfirm(true)
  }

  const btnBase: React.CSSProperties = {
    height: 40, borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
    border: 'none', color: '#fff', padding: '0 24px',
  }

  return (
    <>
      <style>{`.ag-mobile { display: none; } @media (max-width: 768px) { .ag-desktop { display: none !important; } .ag-mobile { display: inline-flex !important; } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 40 }}>
        <button
          type="button"
          className="ds-hover"
          onClick={onCancelar}
          style={{ height: 40, padding: '0 20px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={cargando}
          className="ds-hover ag-desktop"
          style={{ ...btnBase, background: cargando ? 'var(--color-border)' : 'var(--color-primary)', cursor: cargando ? 'not-allowed' : 'pointer' }}
        >
          {cargando ? 'Guardando…' : labelConfirmar}
        </button>
        <button
          type="button"
          onClick={abrirConfirmacion}
          disabled={cargando}
          className="ds-hover ag-mobile"
          style={{ ...btnBase, background: 'var(--color-primary)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}
        >
          {labelConfirmar}
        </button>
      </div>

      {showConfirm && (
        <ModalPreviewConfirmacion
          titulo="Revisar y confirmar"
          labelConfirmar={labelConfirmar}
          cargando={cargando}
          onCancelar={() => setShowConfirm(false)}
          onConfirmar={onSubmit}
        >
          {preview}
        </ModalPreviewConfirmacion>
      )}
    </>
  )
}
