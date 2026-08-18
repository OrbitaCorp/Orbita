import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Package } from 'lucide-react'
import type { Conversacion, Plantilla, PedidoResumen } from '../mock/mensajes.mock'
import { ChatHeader } from './ChatHeader'
import { Composer } from './Composer'
import { getConversationMessages, sendConversationMessage, getCustomer, type ChatMessage } from '@/lib/api'

interface Props {
  cv:              Conversacion | null
  onToast:         (m: string) => void
  onPerfil:        () => void
  onArchivar:      (id: string) => void
  plantillas:      Plantilla[]
  onIrAPlantillas: () => void
}

const MONO = '"Geist Mono", "Fira Code", monospace'

// Mismo mapeo de estado→etiqueta que el resto del panel (Seguimiento del
// storefront, Perfil del cliente) — acá solo hace falta la etiqueta, el
// color lo resuelve ESTADO_PEDIDO por nombre.
const ESTADO_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PREPARING: 'En preparación',
  SHIPPED: 'Enviado', DELIVERED: 'Entregado', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
}

// Cada ~2.5s mientras hay una conversación abierta — se corta al cerrarla o
// cambiar a otra.
const POLL_MS = 2500

/** Renderiza texto con chips inline para patrones #XXXX */
function BurbujaTxt({ txt, me }: { txt: string; me: boolean }) {
  const partes = txt.split(/(#\d+)/g)
  return (
    <>
      {partes.map((p, i) =>
        /^#\d+$/.test(p) ? (
          <span
            key={i}
            title="Ver pedido"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 7px', borderRadius: 9999,
              background: me ? 'rgba(255,255,255,.22)' : 'var(--color-primary-bg)',
              color: me ? '#fff' : 'var(--color-primary)',
              fontSize: 12, fontWeight: 700, fontFamily: MONO,
              cursor: 'pointer', verticalAlign: 'middle',
              border: me ? '1px solid rgba(255,255,255,.3)' : '1px solid var(--color-primary)',
            }}
          >
            <Package size={9} />
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export function ChatPanel({ cv, onToast, onPerfil, onArchivar, plantillas, onIrAPlantillas }: Props) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Mensajes reales de la conversación abierta + sondeo mientras sigue abierta.
  useEffect(() => {
    if (!cv) { setMsgs([]); return }
    let cancelado = false
    const cargar = () => getConversationMessages(cv.id).then(rows => { if (!cancelado) setMsgs(rows) }).catch(() => {})
    cargar()
    const interval = setInterval(cargar, POLL_MS)
    // Mismo motivo que MensajesCliente.tsx (lado storefront): el navegador
    // throttlea los timers de una pestaña sin foco, así que sin esto, volver
    // a esta pestaña después de un rato mostraba la conversación vieja hasta
    // el próximo tick real — en la práctica, como si hiciera falta recargar.
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      cancelado = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [cv?.id])

  // Pedidos reales del cliente (para los chips del header y el # de mención
  // del composer) — se resuelve una sola vez por conversación, no hace
  // falta sondearlo cada 2.5s como los mensajes.
  useEffect(() => {
    if (!cv) { setPedidos([]); return }
    let cancelado = false
    getCustomer(cv.customerId).then(c => {
      if (cancelado) return
      setPedidos(c.orders.map(o => ({
        id: String(o.orderNumber),
        fecha: new Date(o.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        estado: ESTADO_LABEL[o.status] ?? o.status,
        total: o.total,
      })))
    }).catch(() => setPedidos([]))
    return () => { cancelado = true }
  }, [cv?.customerId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs])

  const handleEnviar = async (txt: string) => {
    if (!cv) return
    try {
      const nuevo = await sendConversationMessage(cv.id, { text: txt })
      setMsgs(prev => [...prev, nuevo])
    } catch {
      onToast('No se pudo enviar el mensaje')
    }
  }

  if (!cv) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--color-muted)', padding: 32 }}>
        <MessageSquare size={40} strokeWidth={1.3} />
        <p style={{ margin: 0, fontSize: 14, textAlign: 'center', lineHeight: 1.5, maxWidth: 240 }}>
          Seleccioná una conversación para ver los mensajes.
        </p>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      <ChatHeader
        cv={cv}
        pedidos={pedidos}
        onPerfil={onPerfil}
        onArchivar={() => onArchivar(cv.id)}
      />

      {/* Mensajes */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto',
          padding: 18, display: 'flex',
          flexDirection: 'column', gap: 10,
          background: 'var(--color-surface)',
          minHeight: 0,
        }}
      >
        {msgs.map((m) => {
          const me = m.sender === 'STORE'
          const hora = new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={m.id} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
              <div style={{
                padding: '10px 13px',
                borderRadius: 12,
                background: me ? 'var(--color-primary)' : 'var(--color-bg)',
                border: me ? 'none' : '1px solid var(--color-border)',
                color: me ? '#fff' : 'var(--color-text)',
                fontSize: 13.5, lineHeight: 1.6,
                borderBottomRightRadius: me ? 4 : 12,
                borderBottomLeftRadius: me ? 12 : 4,
              }}>
                <BurbujaTxt txt={m.text} me={me} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', fontFamily: MONO, marginTop: 3, textAlign: me ? 'right' : 'left' }}>
                {hora}
              </div>
            </div>
          )
        })}

        {msgs.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
            Sé el primero en escribir un mensaje
          </div>
        )}
      </div>

      <Composer
        cv={cv}
        plantillas={plantillas}
        pedidos={pedidos}
        onSend={(txt) => { handleEnviar(txt); onToast('Mensaje enviado') }}
        onIrAPlantillas={onIrAPlantillas}
        onToast={onToast}
      />
    </div>
  )
}
