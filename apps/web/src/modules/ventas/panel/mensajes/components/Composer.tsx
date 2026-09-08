import { useRef, useState } from 'react'
import { FileText, Paperclip, Send } from 'lucide-react'
import type { Plantilla, Conversacion, PedidoResumen } from '../mock/mensajes.mock'
import { PlantillaPopover } from './PlantillaPopover'
import { PedidoMencionPopover } from './PedidoMencionPopover'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  cv:              Conversacion | null
  plantillas:      Plantilla[]
  pedidos:         PedidoResumen[]
  onSend:          (txt: string) => Promise<boolean>
  onIrAPlantillas: () => void
  onToast:         (m: string) => void
}

interface HashTrigger {
  idx:   number
  query: string
}

// Mismo tope que el DTO del backend (send-message.dto.ts / customer-message.dto.ts).
const MAX_MSG = 5000

export function Composer({ cv, plantillas, pedidos, onSend, onIrAPlantillas, onToast }: Props) {
  const { user } = useAuth()
  const tienda = user && 'business' in user ? user.business.name : undefined
  // Los pedidos vienen ordenados del más nuevo al más viejo (getCustomer →
  // orders, createdAt desc): pedidos[0] es el más reciente, y es contra ese
  // que se resuelven {id}/{tracking} en las plantillas.
  const pedidoReciente = pedidos[0]
    ? { numero: Number(pedidos[0].id), tracking: pedidos[0].tracking }
    : undefined
  const [draft, setDraft] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [showPlantillas, setShowPlantillas] = useState(false)
  const [hashTrigger, setHashTrigger] = useState<HashTrigger | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const enviar = async () => {
    const m = draft.trim()
    if (!m || enviando) return
    setEnviando(true)
    // Solo se limpia el input si el envío salió bien — si el POST falla, el
    // vendedor no pierde lo que escribió y puede reintentar.
    const ok = await onSend(m)
    setEnviando(false)
    if (ok) {
      setDraft('')
      setHashTrigger(null)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDraft(val)
    setShowPlantillas(false)

    if (cv && pedidos.length > 0) {
      const m = val.match(/#(\w*)$/)
      if (m) {
        setHashTrigger({ idx: val.length - m[0].length, query: m[1] })
      } else {
        setHashTrigger(null)
      }
    } else {
      setHashTrigger(null)
    }
  }

  const handleSelectPedido = (pedidoId: string) => {
    if (hashTrigger === null) return
    const before    = draft.slice(0, hashTrigger.idx)
    const queryLen  = hashTrigger.query.length
    const after     = draft.slice(hashTrigger.idx + 1 + queryLen)
    const newDraft  = `${before}#${pedidoId} ${after}`
    setDraft(newDraft)
    setHashTrigger(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const iconBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 7,
    border: 'none', background: 'transparent',
    color: 'var(--color-muted)', cursor: 'pointer',
    display: 'grid', placeItems: 'center',
    flexShrink: 0,
    transition: 'color 120ms ease, background 120ms ease',
  }

  return (
    <div style={{ position: 'relative', padding: '8px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>

      {/* Plantilla popover */}
      {showPlantillas && (
        <PlantillaPopover
          plantillas={plantillas}
          cv={cv}
          tienda={tienda}
          pedido={pedidoReciente}
          onSeleccionar={(texto, usoPedido) => {
            setDraft(texto)
            setShowPlantillas(false)
            if (usoPedido && pedidoReciente) {
              onToast(`Plantilla completada con el pedido #${pedidoReciente.numero} — cambialo si es de otro`)
            }
          }}
          onClose={() => setShowPlantillas(false)}
          onIrAPlantillas={onIrAPlantillas}
        />
      )}

      {/* # Pedido mention popover */}
      {hashTrigger !== null && pedidos.length > 0 && cv && (
        <PedidoMencionPopover
          pedidos={pedidos}
          clienteNombre={cv.cliente}
          query={hashTrigger.query}
          onSelect={handleSelectPedido}
          onClose={() => setHashTrigger(null)}
        />
      )}

      {/* Ícono: plantilla */}
      <button
        className="ds-hover"
        title="Usar plantilla"
        onClick={() => { setShowPlantillas((v) => !v); setHashTrigger(null) }}
        style={{
          ...iconBtn,
          color: showPlantillas ? 'var(--color-primary)' : 'var(--color-muted)',
          background: showPlantillas ? 'var(--color-primary-bg)' : 'transparent',
        }}
      >
        <FileText size={16} />
      </button>

      {/* Ícono: adjuntar */}
      <button
        className="ds-hover"
        title="Adjuntar archivo"
        onClick={() => onToast('Adjunto en desarrollo')}
        style={iconBtn}
      >
        <Paperclip size={16} />
      </button>

      {/* Input principal */}
      <input
        className="ds-field"
        ref={inputRef}
        value={draft}
        onChange={handleChange}
        maxLength={MAX_MSG}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setHashTrigger(null); setShowPlantillas(false) }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
        }}
        placeholder={cv ? 'Escribí un mensaje… (usá # para mencionar un pedido)' : 'Seleccioná una conversación primero'}
        disabled={!cv}
        style={{
          flex: 1,
          height: 40, padding: '0 12px',
          background: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          fontSize: 13, color: 'var(--color-text)',
          fontFamily: 'inherit', outline: 'none',
          opacity: cv ? 1 : 0.5,
        }}
      />

      {/* Contador — solo aparece cuando falta poco para el tope */}
      {draft.length > MAX_MSG - 200 && (
        <span style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>
          {draft.length}/{MAX_MSG}
        </span>
      )}

      {/* Enviar */}
      <button
        className="ds-hover"
        onClick={enviar}
        disabled={!draft.trim() || !cv || enviando}
        title="Enviar"
        style={{
          width: 40, height: 40, borderRadius: 10,
          border: 'none',
          background: draft.trim() && cv && !enviando ? 'var(--color-primary)' : 'var(--color-surface-alt)',
          color: draft.trim() && cv && !enviando ? '#fff' : 'var(--color-subtle)',
          cursor: draft.trim() && cv && !enviando ? 'pointer' : 'default',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          transition: 'background 150ms ease, color 150ms ease',
        }}
      >
        <Send size={16} strokeWidth={1.8} />
      </button>
    </div>
  )
}
