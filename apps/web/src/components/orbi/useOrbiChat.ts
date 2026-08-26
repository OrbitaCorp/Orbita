import { useCallback } from 'react'
import { useOrbiStore } from './useOrbiStore'
import type { OrbiContext, OrbiMessage } from './types'
import { authedFetch } from '@/lib/auth/authClient'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

export function useOrbiChat() {
  const store = useOrbiStore()

  const send = useCallback(async (message: string, context: OrbiContext) => {
    // El wizard es público/stateless en el backend (sin conversationId
    // persistido — ver ConversationService, que solo se usa en surface
    // panel). Sin esto, cada mensaje llegaba al LLM SIN los turnos previos:
    // Orbi "olvidaba" lo que el usuario acababa de contar y respondía a
    // ciegas. Se manda el historial reciente (ya en memoria del store) en
    // cada request; el backend lo acota igual por las dudas.
    const priorHistory = context.surface === 'wizard'
      ? store.messages
          .filter(m => m.content.trim().length > 0)
          .slice(-16)
          .map(m => ({ role: m.role, content: m.content }))
      : undefined

    const userMsg: OrbiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }
    store.addMessage(userMsg)

    const assistantMsg: OrbiMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      actions: [],
      timestamp: Date.now(),
    }
    store.addMessage(assistantMsg)
    store.setStreaming(true)

    try {
      const endpoint = context.surface === 'wizard' ? '/orbi/chat/wizard' : '/orbi/chat'
      const fetchFn = context.surface === 'wizard' ? fetch : authedFetch

      const res = await fetchFn(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context,
          conversationId: store.conversationId,
          history: priorHistory,
        }),
      })

      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            if (eventType === 'text') {
              store.appendToLastAssistant(data.chunk)
            } else if (eventType === 'action_start') {
              store.addActionToLastAssistant({
                id: data.id,
                label: data.label,
                tool: data.tool,
                status: 'active',
              })
            } else if (eventType === 'action_complete') {
              store.updateAction(assistantMsg.id, data.id, {
                status: 'complete',
                result: data.result,
                data: data.data,
              })
              if (data.data?.productId) {
                store.markProductCreated(data.data.productId)
              }
            } else if (eventType === 'error') {
              store.appendToLastAssistant(data.message ?? 'Error procesando tu mensaje')
            }
            eventType = ''
          }
        }
      }
    } catch {
      store.appendToLastAssistant('Error de conexión. Intentá de nuevo.')
    } finally {
      store.setStreaming(false)
    }
  }, [store])

  return { send, isStreaming: store.isStreaming }
}
