import { useRef, useEffect } from 'react'
import { useOrbiStore } from './useOrbiStore'
import { OrbiIcon } from './OrbiIcon'
import { OrbiPipeline } from './OrbiPipeline'
import { OrbiNavigateButton } from './OrbiNavigateButton'
import type { OrbiMessage } from './types'

function MessageBubble({ msg }: { msg: OrbiMessage }) {
  const isUser = msg.role === 'user'
  const navigateAction = msg.actions?.find(a => a.status === 'complete' && a.data && typeof a.data === 'object' && 'path' in a.data)

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
        {msg.content || (msg.role === 'assistant' && !msg.actions?.length ? (
          <TypingDots />
        ) : null)}
      </div>

      {msg.actions && msg.actions.length > 0 && (
        <div style={{ maxWidth: '85%', width: '100%' }}>
          <OrbiPipeline actions={msg.actions} />
        </div>
      )}

      {navigateAction && (
        <OrbiNavigateButton
          path={navigateAction.data!.path as string}
          label={navigateAction.result ?? 'Ir'}
        />
      )}
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
      {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
      <div ref={bottomRef} />
    </div>
  )
}
