import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Plantilla, CategoriaPlantilla } from '../mock/mensajes.mock'
import { CATEGORIAS_PLANTILLA, VARIABLES_DISPONIBLES, DATOS_EJEMPLO } from '../mock/mensajes.mock'
import { Button } from '@/design-system/components/Button'

interface Props {
  plantilla?: Plantilla
  guardando?: boolean
  onGuardar: (p: Omit<Plantilla, 'id'>) => void
  onCerrar:  () => void
}

export function ModalPlantilla({ plantilla, guardando = false, onGuardar, onCerrar }: Props) {
  const [nombre,    setNombre]    = useState(plantilla?.nombre ?? '')
  const [categoria, setCategoria] = useState<CategoriaPlantilla>(plantilla?.categoria ?? 'pedido')
  const [texto,     setTexto]     = useState(plantilla?.texto ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const preview = texto.replace(/\{([^}]+)\}/g, (_, k) => DATOS_EJEMPLO[k] ?? `{${k}}`)

  const insertarVar = (v: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const nuevo = texto.slice(0, start) + v + texto.slice(end)
    setTexto(nuevo)
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + v.length
      ta.focus()
    }, 0)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    height: 38, padding: '0 12px',
    border: '1px solid var(--color-border)', borderRadius: 8,
    background: 'var(--color-surface-alt)',
    fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,.18)' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
            {plantilla ? 'Editar plantilla' : 'Nueva plantilla'}
          </span>
          <button onClick={onCerrar} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Pedido confirmado" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Categoría</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaPlantilla)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {CATEGORIAS_PLANTILLA.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Mensaje</label>
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribí el mensaje. Usá {nombre}, {id}, etc. para personalizar."
              rows={4}
              style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {VARIABLES_DISPONIBLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertarVar(v)}
                  style={{ height: 24, padding: '0 9px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', color: 'var(--color-primary)', fontSize: 11.5, fontWeight: 600, fontFamily: '"Geist Mono", monospace', cursor: 'pointer' }}
                >
                  {v}
                </button>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
              Las variables se reemplazan automáticamente con los datos del cliente y pedido al usar la plantilla.
            </p>
          </div>

          {/* Preview */}
          {texto && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-muted)' }}>Vista previa</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-body)', lineHeight: 1.6 }}>{preview}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={guardando}
            disabled={!nombre.trim() || !texto.trim()}
            onClick={() => { if (nombre && texto) onGuardar({ nombre, categoria, texto }) }}
          >
            {plantilla ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </div>
      </div>
    </div>
  )
}
