import { useState } from 'react'
import { X, Send } from 'lucide-react'
import type { Plantilla, Conversacion } from '../mock/mensajes.mock'
import { resolverVariables } from '../mock/mensajes.mock'

interface Props {
  plantilla: Plantilla
  cv:        Conversacion | null
  onEnviar:  (txt: string) => void
  onCerrar:  () => void
}

export function ModalUsarPlantilla({ plantilla, cv, onEnviar, onCerrar }: Props) {
  const [texto, setTexto] = useState(() => resolverVariables(plantilla.texto, cv))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 500, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,.18)' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Usar plantilla</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
              {cv ? `Enviando a ${cv.cliente}` : 'Sin conversación seleccionada'}
            </div>
          </div>
          <button className="ds-hover" onClick={onCerrar} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500, color: 'var(--color-body)' }}>Mensaje</p>
            <textarea
              className="ds-field"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', border: '1px solid var(--color-border)',
                borderRadius: 8, background: 'var(--color-surface-alt)',
                fontSize: 13, color: 'var(--color-text)',
                fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6,
              }}
            />
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--color-muted)' }}>
              Podés editar el texto antes de enviar.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="ds-hover" onClick={onCerrar} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
          <button
            className="ds-hover"
            onClick={() => { if (texto.trim()) { onEnviar(texto.trim()); onCerrar() } }}
            disabled={!texto.trim()}
            style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: texto.trim() ? 'var(--color-primary)' : 'var(--color-border)', color: texto.trim() ? 'var(--color-on-primary)' : 'var(--color-muted)', fontSize: 13, fontWeight: 600, cursor: texto.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Send size={13} />
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
