import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
  esEnvioVigente,
  idDeConversacionDelEvento,
  seMarcaDetenido,
  soloSiVigente,
} from './sesionOrbi'
import {
  EVENTO_ACCION_EJECUTADA,
  confirmarConReintentos,
  interpretarRespuestaCancelar,
  interpretarRespuestaConfirmar,
  queriesARefrescar,
  siguienteEstadoAlCancelar,
  type DetalleAccionEjecutada,
  type RespuestaCancelar,
  type RespuestaConfirmar,
} from './confirmarAccion'

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

// POST /orbi/confirm pasado a la respuesta tipada. Un fetch que tira (red
// caída) lo convierte confirmarConReintentos en "no sé".
async function pedirConfirmacion(actionId: string): Promise<RespuestaConfirmar> {
  const res = await authedFetch(`${API}/orbi/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actionId }),
  })
  return interpretarRespuestaConfirmar(res.status, await res.json().catch(() => null))
}

const esperar = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function esRegistro(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function useOrbiChat() {
  const store = useOrbiStore()
  const queryClient = useQueryClient()

  // Después de una acción aplicada, la pantalla que la muestra tiene que
  // enterarse: sin esto el dueño crea un cupón con Orbi y la lista de cupones
  // abierta al lado sigue sin él hasta que recarga.
  const alAplicarse = useCallback((tool: string, data?: Record<string, unknown>) => {
    if (typeof data?.productId === 'string') {
      useOrbiStore.getState().markProductCreated(data.productId)
    }
    for (const queryKey of queriesARefrescar(tool)) {
      void queryClient.invalidateQueries({ queryKey })
    }
    const detail: DetalleAccionEjecutada = { tool, data }
    window.dispatchEvent(new CustomEvent(EVENTO_ACCION_EJECUTADA, { detail }))
  }, [queryClient])

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

    // Se leen del estado vivo (no del `store` de este render): la sesión y el
    // id tienen que ser los de este instante. Un AbortController por envío,
    // guardado en el store para que Detener, cerrar, reset y logout lo corten.
    // iniciarEnvio corta el envío anterior si seguía en curso (un chip del
    // wizard puede mandar mientras Orbi responde) ANTES de sumar las burbujas
    // nuevas, y devuelve el número de este envío.
    const sesionAlEnviar = useOrbiStore.getState().sesion
    const corte = new AbortController()
    const miEnvio = useOrbiStore.getState().iniciarEnvio(corte)
    const sigueVigente = () => {
      const s = useOrbiStore.getState()
      return esEnvioVigente(sesionAlEnviar, s.sesion, miEnvio, s.envio)
    }

    const userMsg: OrbiMessage = {
      id: `user-${Date.now()}-${miEnvio}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }
    store.addMessage(userMsg)

    // El número de envío en el id lo hace único aunque dos envíos caigan en
    // el mismo milisegundo: marcarDetenido tiene que dar con ESTA burbuja.
    const assistantMsg: OrbiMessage = {
      id: `assistant-${Date.now()}-${miEnvio}`,
      role: 'assistant',
      content: '',
      actions: [],
      timestamp: Date.now(),
    }
    store.addMessage(assistantMsg)
    store.setStreaming(true)

    // Si llegó `done` la respuesta está completa aunque el stream siga
    // abierto (el wizard manda `turn` después): un Detener en ese hueco no
    // tiene que marcarla "Detenido".
    let recibioDone = false

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
        if (debeDescartar(sesionAlEnviar, useOrbiStore.getState().sesion)) return
        // Cortado mientras se leía el error: no se inventa un mensaje.
        if (corte.signal.aborted) {
          store.marcarDetenido(assistantMsg.id)
          return
        }
        // Reemplazado por otro envío: la última burbuja ya es la del nuevo.
        if (!sigueVigente()) return
        store.appendToLastAssistant(
          typeof cuerpo?.message === 'string' ? cuerpo.message : 'No pude responder ahora. Probá de nuevo en un rato.',
        )
        return
      }
      if (!res.body) throw new Error('No response body')
      // Se lee hasta que el servidor cierra el stream, sin cortar en `done`:
      // el wizard manda `turn` después (ver leerStreamSse).
      // Cada evento pasa por el filtro: si hubo un reset desde que se mandó
      // este mensaje, o un envío nuevo lo reemplazó, se tira todo lo que
      // falte, `conversation` incluido (sería el hilo de otra persona o de la
      // conversación vieja, o texto que caería en la burbuja del envío nuevo).
      await leerStreamSse(res.body.getReader(), soloSiVigente(sigueVigente, ({ event: eventType, data: crudo }) => {
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
          // Señal de que la respuesta terminó. El estado de "escribiendo" lo
          // baja el `finally` al cerrarse el stream, y todavía puede llegar
          // `turn` (wizard); solo se anota para el catch.
          recibioDone = true
        }
      }))
    } catch (err) {
      // Con la sesión cambiada (reset) la burbuja ya no existe: no se toca
      // nada. Un corte (Detener, cerrar el panel, o un envío nuevo que
      // reemplazó a este) no es un error de conexión: la burbuja de ESTE
      // envío, buscada por id, queda con lo que llegó y la marca "Detenido".
      if (debeDescartar(sesionAlEnviar, useOrbiStore.getState().sesion)) return
      if (esAborto(err) || corte.signal.aborted) {
        if (seMarcaDetenido(true, recibioDone)) store.marcarDetenido(assistantMsg.id)
      } else if (sigueVigente()) {
        // appendToLastAssistant escribe en la última burbuja: solo si sigue
        // siendo la de este envío.
        store.appendToLastAssistant('Error de conexión. Intentá de nuevo.')
      }
    } finally {
      // Solo el envío vigente suelta su controller y baja el "escribiendo":
      // uno reemplazado o de antes de un reset no toca el estado del nuevo.
      useOrbiStore.getState().terminarEnvio(miEnvio, sesionAlEnviar)
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
  const confirmarAccion = useCallback(async (mensajeId: string, accionId: string, actionId: string, tool: string) => {
    const sesionAlConfirmar = useOrbiStore.getState().sesion
    useOrbiStore.getState().updateAction(mensajeId, accionId, { status: 'active', result: undefined, nota: undefined, titulo: undefined })

    // Mientras la API diga "se está aplicando" se vuelve a preguntar con el
    // MISMO actionId; red caída o 5xx quedan en "no sé" con Reintentar (ver
    // confirmarAccion.ts: confirmar es idempotente, reintentar no duplica).
    // El lazo de reintentos dura hasta ~15 s: si en ese tiempo hubo un reset
    // (logout, otro usuario, Nueva conversación) se corta. La acción no se
    // pierde, el servidor la termina igual; lo que no se hace es seguir
    // POSTeando ni aplicar efectos (refrescar pantallas, marcar el producto
    // como creado) sobre la sesión nueva.
    const vigente = () => !debeDescartar(sesionAlConfirmar, useOrbiStore.getState().sesion)
    const final = await confirmarConReintentos(actionId, pedirConfirmacion, esperar, tool, vigente)
    if (final.cortado || !vigente()) return
    const data = esRegistro(final.data) ? final.data : undefined

    useOrbiStore.getState().updateAction(mensajeId, accionId, {
      status: final.estado,
      result: final.mensaje,
      titulo: final.titulo,
      data,
    })
    if (final.estado === 'complete') alAplicarse(tool, data)
  }, [alAplicarse])

  /**
   * Cancela una propuesta desde la tarjeta. Si alguien la confirmó antes
   * (otra pestaña), la API devuelve lo que pasó y la tarjeta lo muestra con
   * "Ya se aplicó" en vez de decir "Cancelado".
   */
  const rechazarAccion = useCallback(async (mensajeId: string, accionId: string, actionId: string, tool: string) => {
    let respuesta: RespuestaCancelar
    try {
      const res = await authedFetch(`${API}/orbi/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      })
      respuesta = interpretarRespuestaCancelar(res.status, await res.json().catch(() => null))
    } catch {
      respuesta = { http: 'red' }
    }

    const paso = siguienteEstadoAlCancelar(respuesta, tool)
    const data = esRegistro(paso.data) ? paso.data : undefined
    useOrbiStore.getState().updateAction(mensajeId, accionId, {
      status: paso.estado,
      result: paso.mensaje,
      nota: paso.nota,
      titulo: paso.titulo,
      ...(data ? { data } : {}),
    })
    if (paso.estado === 'complete') alAplicarse(tool, data)
  }, [alAplicarse])

  return { send, confirmarAccion, rechazarAccion, isStreaming: store.isStreaming }
}
