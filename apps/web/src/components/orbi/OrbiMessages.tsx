import { useRef, useEffect, useState, type ReactNode } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useOrbiStore } from './useOrbiStore'
import { votarRespuestaOrbi } from '@/lib/analytics/wizardTracker'
import { OrbiIcon } from './OrbiIcon'
import { OrbiNavigateButton } from './OrbiNavigateButton'
import { useOrbiChat } from './useOrbiChat'
import type { OrbiAction, OrbiMessage } from './types'

// El modelo de 20B a veces escribe la sintaxis del tool call como texto plano
// además de llamar la herramienta real (ej: "selectWizardOption({ key: ... })").
// Lo limpiamos en el render para que el usuario no vea código.
function cleanToolLeaks(text: string): string {
  return text
    .replace(/\b[a-z][a-zA-Z]*\(\s*\{[\s\S]*?\}\s*\)/g, '')
    .replace(/```(?:json)?\s*\{[^`]*\}\s*```/g, '')
    .replace(/\{\{[a-zA-Z]+[^}]*\}\}/g, '')
    .replace(/<[a-z][a-zA-Z]*\s[^>]*>[\s\S]*?<\/[a-z][a-zA-Z]*>/gi, '')
    .replace(/<\/?[a-z][a-zA-Z]*(?:[:\s][^>]*)?\/?>/gi, '')
    .replace(/\n?\s*\{[^{}]*"?(?:key|label|field|value|rubro|keywords|businessName)"?[^{}]*\}/g, '')
    .replace(/\[(?:Seleccionar|Elegir|Select)[^\]]*\]/gi, '')
    .replace(/\b(?:selectWizardOption|fillWizardField|suggestBusinessName|suggestDescription)\s*\n(?:[a-z]\w*:\s*[^\n]+\n?)+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Orbi escribe **negrita** en markdown para destacar (nombre sugerido,
// próximo paso, etc.). No sumamos una librería de markdown entera por esto:
// alcanza con reconocer el patrón y devolver <strong> reales.
function renderTextoConNegrita(texto: string): ReactNode {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  if (partes.length === 1) return texto
  return partes.map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**')
      ? <strong key={i}>{parte.slice(2, -2)}</strong>
      : parte
  )
}

function OrbiSelectButton({ optionKey, label }: { optionKey: string; label: string }) {
  const [applied, setApplied] = useState(false)

  return (
    <button
      onClick={() => {
        window.dispatchEvent(new CustomEvent('orbi:select-option', { detail: { key: optionKey } }))
        setApplied(true)
      }}
      disabled={applied}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', marginTop: 4,
        borderRadius: 10,
        border: applied ? '1.5px solid #3B82F6' : '1.5px solid transparent',
        background: applied ? 'rgba(59,130,246,0.10)' : 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
        color: applied ? '#3B82F6' : 'white',
        fontSize: 13, fontWeight: 600,
        cursor: applied ? 'default' : 'pointer',
        transition: 'all 150ms',
      }}
    >
      {applied ? '✓' : '→'} {applied ? `${label} seleccionado` : `Elegir ${label}`}
    </button>
  )
}

/**
 * Botón de confirmar una acción que Orbi propuso pero NO ejecutó.
 *
 * Las herramientas que escriben en la base del negocio — crear un cupón,
 * cambiar el estado de un pedido, tocar la configuración — no corren solas:
 * llegan hasta acá como una propuesta y ocurren cuando el dueño aprieta.
 *
 * No es una molestia de más, es la defensa. El texto que escriben los clientes
 * de la tienda (el nombre en un pedido, el motivo de una cancelación) vuelve al
 * contexto del modelo cuando alguien pregunta "mostrame los pedidos de hoy", y
 * ahí adentro puede venir algo que lo convenza de pedir un cupón del 100%.
 * Puede pedirlo; no puede apretar este botón.
 */
function OrbiConfirmButton({ accion, mensajeId }: { accion: OrbiAction; mensajeId: string }) {
  const { confirmarAccion } = useOrbiChat()
  const [enviando, setEnviando] = useState(false)

  const alConfirmar = async () => {
    if (enviando || !accion.actionId) return
    setEnviando(true)
    await confirmarAccion(mensajeId, accion.id, accion.actionId)
  }

  return (
    <div style={{
      marginTop: 8, padding: '12px 14px',
      borderRadius: 12,
      border: '1.5px solid var(--color-border)',
      background: 'var(--color-surface)',
    }}>
      <div style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 10, lineHeight: 1.45 }}>
        {accion.resumen ?? accion.label}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={alConfirmar}
          disabled={enviando}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 9,
            border: '1.5px solid transparent',
            background: enviando ? 'var(--color-surface-alt)' : 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            color: enviando ? 'var(--color-muted)' : 'white',
            fontSize: 13, fontWeight: 600,
            cursor: enviando ? 'default' : 'pointer',
            transition: 'all 150ms',
          }}
        >
          {enviando ? 'Aplicando…' : 'Confirmar'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          No se hizo nada todavía
        </span>
      </div>
    </div>
  )
}

// Solo aparece en el wizard, y solo cuando el backend devolvió el id del turno
// (evento SSE `turn`). Vota poca gente — es normal y está bien: el grueso de la
// medición de calidad son las señales implícitas, esto es la confirmación
// explícita de los casos fuertes, sobre todo los enojados.
function PulgaresOrbi({ msg }: { msg: OrbiMessage }) {
  const setRating = useOrbiStore(s => s.setRating)
  if (!msg.turnId) return null

  const votar = (rating: 1 | -1) => {
    if (msg.rating) return
    setRating(msg.id, rating)
    votarRespuestaOrbi(msg.turnId!, rating)
  }

  const boton = (valor: 1 | -1, Icono: typeof ThumbsUp, titulo: string) => {
    const elegido = msg.rating === valor
    // Una vez votado se apaga el otro pulgar en vez de esconderlo: el usuario
    // ve qué votó, y no queda un hueco que mueva el resto de la conversación.
    const apagado = msg.rating !== undefined && !elegido
    return (
      <button
        onClick={() => votar(valor)}
        disabled={msg.rating !== undefined}
        title={titulo}
        aria-label={titulo}
        aria-pressed={elegido}
        style={{
          display: 'grid', placeItems: 'center', padding: 4,
          background: 'none', border: 'none', borderRadius: 6,
          cursor: msg.rating !== undefined ? 'default' : 'pointer',
          opacity: apagado ? 0.25 : 1,
          color: elegido ? '#3B82F6' : 'var(--color-muted)',
          transition: 'color 150ms, opacity 150ms',
        }}
      >
        <Icono size={13} strokeWidth={2} fill={elegido ? '#3B82F6' : 'none'} />
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2, marginLeft: 4 }}>
      {boton(1, ThumbsUp, 'Esta respuesta me sirvió')}
      {boton(-1, ThumbsDown, 'Esta respuesta no me sirvió')}
    </div>
  )
}

function MessageBubble({ msg, isLastMessage }: { msg: OrbiMessage; isLastMessage: boolean }) {
  const isUser = msg.role === 'user'
  const isStreaming = useOrbiStore(s => s.isStreaming)
  const navigateAction = msg.actions?.find(a => a.status === 'complete' && a.data && typeof a.data === 'object' && 'path' in a.data)
  const selectActions = msg.actions?.filter(a => a.status === 'complete' && a.tool === 'selectWizardOption' && a.data) ?? []
  const pendingActions = msg.actions?.filter(a => a.status === 'pending') ?? []
  // El tool_call llega ANTES que el texto explicativo (el modelo llama la tool,
  // el controller la ejecuta y manda action_complete, y DESPUÉS hace un segundo
  // LLM call que genera el texto). Si mostramos el botón de inmediato, el usuario
  // ve "Elegir X" flotando sin contexto durante 1-2 segundos.
  const hideActionsUntilDone = isLastMessage && isStreaming

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 2 }}>
      {!isUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#3B82F6', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <OrbiIcon size={13} color="white" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)' }}>Orbi</span>
        </div>
      )}
      <div style={{
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser ? '#3B82F6' : 'var(--color-surface-alt)',
        color: isUser ? 'white' : 'var(--color-text)',
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {(() => {
          const contenido = msg.role === 'assistant' ? cleanToolLeaks(msg.content) : msg.content
          if (contenido) return msg.role === 'assistant' ? renderTextoConNegrita(contenido) : contenido
          return msg.role === 'assistant' && !msg.actions?.length ? <TypingDots /> : null
        })()}
      </div>

      {!hideActionsUntilDone && pendingActions.map(a => (
        <OrbiConfirmButton key={a.id} accion={a} mensajeId={msg.id} />
      ))}

      {!hideActionsUntilDone && selectActions.map(a => (
        <OrbiSelectButton
          key={a.id}
          optionKey={a.data!.key as string}
          label={a.data!.label as string}
        />
      ))}

      {!hideActionsUntilDone && navigateAction && (
        <OrbiNavigateButton
          path={navigateAction.data!.path as string}
          label={navigateAction.result ?? 'Ir'}
        />
      )}

      {/* Recién cuando terminó de escribir: votar una respuesta a medio
          streamear no significa nada. */}
      {!isUser && !hideActionsUntilDone && <PulgaresOrbi msg={msg} />}
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--color-muted)', display: 'inline-block',
          animation: `orbi-typing 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes orbi-typing { 0%, 60%, 100% { opacity: 0.3; transform: scale(0.8) } 30% { opacity: 1; transform: scale(1) } }`}</style>
    </div>
  )
}

export function OrbiMessages() {
  const messages = useOrbiStore(s => s.messages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!messages.length) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#3B82F6', display: 'grid', placeItems: 'center' }}>
          <OrbiIcon size={28} color="white" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Hola, soy Orbi</div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Tu asistente de IA. Preguntame lo que<br />necesites o pedime que haga algo.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {messages.map((msg, i) =>
        msg.role === 'divider' ? (
          <div key={msg.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 0', margin: '4px 0',
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
              {msg.content}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>
        ) : (
          <MessageBubble key={msg.id} msg={msg} isLastMessage={i === messages.length - 1} />
        )
      )}
      <div ref={bottomRef} />
    </div>
  )
}
