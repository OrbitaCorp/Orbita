import { useState } from 'react'
import { platformApi } from '@/lib/platform/api'
import type { ToastVariant } from '@/design-system/components/Toast'
import { ConfirmModal, btnGhostSm } from './ui'

// Conectar el Claude de cada persona a Órbita. Es UN solo conector para todo Marketing (prospección y videos): se agrega
// una vez en Claude, se autoriza con la cuenta de la organización y vale para las dos herramientas. Desconectar corta
// todos los Claude conectados con tu usuario. Servidor del conector: apps/api/src/marketing/prospeccion/mcp/.

type Aviso = { variant: ToastVariant; title: string; description?: string }

export const URL_CONECTOR = 'https://api.orbita.site/api/v1/mcp'

export function ConectarClaude({ puedeEditar, setAviso }: { puedeEditar: boolean; setAviso: (a: Aviso) => void }) {
  const [desconectar, setDesconectar] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(URL_CONECTOR)
      setAviso({ variant: 'success', title: 'La dirección se copió' })
    } catch {
      setAviso({ variant: 'error', title: 'No se pudo copiar', description: 'Seleccionala y copiala a mano.' })
    }
  }

  return (
    <>
      <details style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 18px', fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--color-text)', fontWeight: 600 }}>Claude: conectar o desconectar</summary>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            Un solo conector de Órbita para la prospección y para los videos. En Claude: Configuración → Conectores → «Agregar conector personalizado»
            (podés llamarlo «Órbita»), con esta dirección. Claude abre una pantalla del panel para que lo autorices con tu cuenta de la organización.
            Es una vez por persona.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: 12.5, overflowWrap: 'anywhere' }}>{URL_CONECTOR}</code>
            <button type="button" onClick={copiar} className="ds-hover" style={btnGhostSm}>Copiar</button>
          </div>
          {puedeEditar && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5, maxWidth: 520 }}>
                El acceso de Claude dura hasta que lo cortes. Desconectar cierra todos los Claude conectados con tu usuario (prospección y videos).
              </span>
              <button type="button" onClick={() => setDesconectar(true)} className="ds-hover" style={btnGhostSm}>Desconectar Claude</button>
            </div>
          )}
        </div>
      </details>

      {desconectar && (
        <ConfirmModal
          title="Desconectar Claude"
          body="Se corta el acceso de todos los Claude conectados con tu usuario. Lo ya guardado (análisis y videos) no se toca. Para volver a usarlo hay que autorizar la conexión otra vez desde Claude."
          confirmLabel="Desconectar"
          onCancel={() => setDesconectar(false)}
          onConfirm={async () => {
            const r = await platformApi.mcpDesconectar()
            setDesconectar(false)
            setAviso({ variant: 'success', title: r.revocados ? 'Claude desconectado' : 'No había conexiones activas' })
          }}
        />
      )}
    </>
  )
}
