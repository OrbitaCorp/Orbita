import { useCallback } from 'react'
import { useOrbiStore } from './useOrbiStore'
import type { OrbiContext, OrbiMessage } from './types'
import { authedFetch } from '@/lib/auth/authClient'
import { track, wizardIds } from '@/lib/analytics/wizardTracker'
import { getWizardFormState } from './useOrbiContext'
import { leerStreamSse } from './sseParser'
import {
  conversationIdParaEnviar,
  debeDescartar,
  esAborto,
  filtrarPorSesion,
  idDeConversacionDelEvento,
} from './sesionOrbi'

// Forma de los datos de los eventos del stream. Es permisiva a propósito: el
// parser devuelve `unknown` (JSON ya decodificado) y cada evento usa solo
// los campos que le tocan (el servidor los manda siempre que corresponden).
interface DatosSse {
  id: string
  chunk: string
  label: string
  tool: string
  resumen: string
  actionId: string
  result: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
  turnId: string
  message?: string
}

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
      ? (() => {
          const msgs = store.messages
          const lastDividerIdx = msgs.findLastIndex(m => m.role === 'divider')
          const relevant = lastDividerIdx >= 0 ? msgs.slice(lastDividerIdx + 1) : msgs
          return relevant
            .filter(m => m.role !== 'divider' && m.content.trim().length > 0)
            .slice(-16)
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        })()
      : undefined

    if (context.surface === 'wizard') {
      // Solo se registra QUE preguntó y en qué paso. El texto de la pregunta lo
      // guarda el backend, que además le tapa mail/teléfono antes de escribirlo.
      track('orbi_message', { step: context.step, stepName: context.stepName, rubro: context.rubro })
    }

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

    // Se leen del estado vivo (no del `store` de este render): la sesión y el
    // id tienen que ser los de este instante. Un AbortController por envío,
    // guardado en el store para que Detener, cerrar, reset y logout lo corten.
    const sesionAlEnviar = useOrbiStore.getState().sesion
    const corte = new AbortController()
    store.setAbort(corte)
    const sigueVigente = () => !debeDescartar(sesionAlEnviar, useOrbiStore.getState().sesion)

    try {
      const endpoint = context.surface === 'wizard' ? '/orbi/chat/wizard' : '/orbi/chat'
      const fetchFn = context.surface === 'wizard' ? fetch : authedFetch

      const res = await fetchFn(`${API}${endpoint}`, {
        method: 'POST',
        signal: corte.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          // Los ids anónimos van pegados al contexto para que el turno de Orbi
          // se pueda cruzar con el resto del recorrido de esa misma persona
          // (en qué paso preguntó, si después avanzó, si terminó pagando).
          // El estado del formulario se lee acá y no en el contexto reactivo
          // por lo mismo: cambia con cada tecla y solo hace falta al mandar.
          context: context.surface === 'wizard'
            ? { ...context, ...wizardIds(), formState: getWizardFormState() }
            : context,
          // Solo el panel sigue un hilo guardado en el servidor; sin id (o
          // en el wizard) el campo no viaja y el servidor arranca uno nuevo.
          conversationId: conversationIdParaEnviar(context.surface, useOrbiStore.getState().conversationId),
          history: priorHistory,
        }),
      })

      // El tope diario (429), el throttle y el 403 de no-miembro llegan como
      // JSON antes de abrir el stream: sin esto Orbi quedaba con la burbuja
      // vacía y la persona no veía por qué (auditoría interna 10/09).
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null)
        if (!sigueVigente()) return
        // Cortado mientras se leía el error: no se inventa un mensaje.
        if (corte.signal.aborted) {
          store.marcarDetenido(assistantMsg.id)
          return
        }
        store.appendToLastAssistant(
          typeof cuerpo?.message === 'string' ? cuerpo.message : 'No pude responder ahora. Probá de nuevo en un rato.',
        )
        return
      }
      if (!res.body) throw new Error('No response body')
      // Se lee hasta que el servidor cierra el stream, sin cortar en `done`:
      // el wizard manda `turn` después (ver leerStreamSse).
      // Cada evento pasa por el filtro de sesión: si hubo un reset desde que
      // se mandó este mensaje, se tira todo lo que falte, `conversation`
      // incluido (sería el hilo de otra persona o de la conversación vieja).
      await leerStreamSse(res.body.getReader(), filtrarPorSesion(sesionAlEnviar, () => useOrbiStore.getState().sesion, ({ event: eventType, data: crudo }) => {
        const data = (crudo ?? {}) as DatosSse
        if (eventType === 'conversation') {
          // El servidor emite primero el id de la conversación del panel
          // (la crea si hace falta). Se guarda para mandarlo en el próximo
          // mensaje y que Orbi siga el mismo hilo. En el wizard no se usa.
          const id = idDeConversacionDelEvento(context.surface, crudo)
          if (id) store.setConversationId(id)
        } else if (eventType === 'text') {
          store.appendToLastAssistant(data.chunk ?? '')
        } else if (eventType === 'text_reset') {
          // El backend descarta el texto que Orbi dijo antes de llamar una
          // tool (ver resetLastAssistantText). Las actions ya emitidas quedan.
          store.resetLastAssistantText()
        } else if (eventType === 'action_start') {
          store.addActionToLastAssistant({
            id: data.id,
            label: data.label,
            tool: data.tool,
            status: 'active',
          })
        } else if (eventType === 'action_pending') {
          // Orbi propuso algo que escribe en la base. No pasó nada
          // todavía: se muestra un botón y la acción ocurre si la persona
          // lo aprieta (ver confirmarAccion).
          store.addActionToLastAssistant({
            id: data.id,
            label: data.resumen,
            tool: data.tool,
            status: 'pending',
            actionId: data.actionId,
            resumen: data.resumen,
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
        } else if (eventType === 'turn') {
          store.setTurnIdOnLastAssistant(data.turnId)
        } else if (eventType === 'error') {
          store.appendToLastAssistant(data.message ?? 'Error procesando tu mensaje')
        } else if (eventType === 'done') {
          // Señal de que la respuesta terminó. No hay nada que hacer: el
          // estado de "escribiendo" lo baja el `finally` al cerrarse el
          // stream, y todavía puede llegar `turn` (wizard).
        }
      }))
    } catch (err) {
      // Con la sesión cambiada (reset) la burbuja ya no existe: no se toca
      // nada. Un corte pedido (Detener, cerrar el panel) no es un error de
      // conexión: queda lo que llegó con la marca "Detenido".
      if (!sigueVigente()) return
      if (esAborto(err) || corte.signal.aborted) {
        store.marcarDetenido(assistantMsg.id)
      } else {
        store.appendToLastAssistant('Error de conexión. Intentá de nuevo.')
      }
    } finally {
      // Solo se suelta el controller si sigue siendo el de este envío, y solo
      // se baja el "escribiendo" si nadie reinició el chat mientras tanto (el
      // reset ya lo bajó, y puede haber otro envío en curso).
      if (useOrbiStore.getState().abortEnCurso === corte) store.setAbort(null)
      if (sigueVigente()) store.setStreaming(false)
    }
  }, [store])

  /**
   * Ejecuta de verdad una acción que Orbi propuso. Se llama cuando la persona
   * aprieta el botón de confirmar.
   *
   * Solo viaja el `actionId`: la herramienta y sus argumentos viven en el
   * servidor. Si los mandara el navegador, esto sería el mismo agujero que se
   * viene a tapar — cualquiera podría saltearse a Orbi y postear la escritura
   * que quisiera.
   */
  const confirmarAccion = useCallback(async (mensajeId: string, accionId: string, actionId: string) => {
    useOrbiStore.getState().updateAction(mensajeId, accionId, { status: 'active' })

    try {
      const res = await authedFetch(`${API}/orbi/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      })

      if (!res.ok) throw new Error(String(res.status))

      const result = await res.json()
      useOrbiStore.getState().updateAction(mensajeId, accionId, {
        status: result.success ? 'complete' : 'error',
        result: result.success ? result.label : (result.error ?? 'No se pudo completar'),
        data: result.data,
      })
      if (result?.data?.productId) {
        useOrbiStore.getState().markProductCreated(result.data.productId as string)
      }
    } catch {
      useOrbiStore.getState().updateAction(mensajeId, accionId, {
        status: 'error',
        // La propuesta caduca a los 10 minutos y es de un solo uso, así que
        // "volvé a pedírselo" es la salida real, no una frase de relleno.
        result: 'No se pudo completar. Pedísela a Orbi de nuevo.',
      })
    }
  }, [])

  return { send, confirmarAccion, isStreaming: store.isStreaming }
}
