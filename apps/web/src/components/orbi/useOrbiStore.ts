import { create } from 'zustand'
import type { OrbiMessage, OrbiAction } from './types'

export interface OrbiBubbleData {
  message: string
  chips?: { label: string; actionKey: string }[]
  autoHideMs?: number
}

interface OrbiState {
  isOpen: boolean
  messages: OrbiMessage[]
  conversationId: string | null
  isStreaming: boolean
  // IDs de productos creados por Orbi en esta sesión de pestaña — vive solo en
  // memoria (no persist) a propósito: un reload de página es la señal natural
  // de "ya se vio el aviso", sin necesitar limpieza explícita.
  createdProductIds: Set<string>
  bubble: OrbiBubbleData | null
  // Último paso/superficie donde Orbi ya saludó (o dio la línea de "seguimos
  // con X"). Evita re-saludar al reabrir el panel en el mismo paso. Se
  // reinicia con reset().
  welcomeGreetedStep: string | null
  // Contador de "sesión" del chat. Cada reset() lo sube; el lector del stream
  // anota el valor al enviar y, si cambió cuando llega un evento, lo descarta
  // (ver sesionOrbi.ts). Así un stream viejo nunca escribe en el chat nuevo.
  sesion: number
  // El AbortController del envío en curso (uno por envío, lo pone
  // useOrbiChat). Sin cortarlo, cerrar Orbi o navegar no cierra la conexión y
  // la API sigue gastando modelo para una respuesta que nadie va a leer.
  abortEnCurso: AbortController | null
  // Número del envío vigente. Cada iniciarEnvio() lo sube: un envío que ya
  // fue reemplazado por otro (chip tocado mientras Orbi respondía) lo ve
  // distinto y no toca el estado del nuevo.
  envio: number
  // Orbi en mantenimiento (lo apagó el sistema o un admin): el aviso que se
  // muestra fijo arriba del input, con el input deshabilitado. Es de Orbi, no
  // de la conversación: reset() no lo toca. Lo pone useOrbiChat (503 o evento
  // del stream) y lo pone o lo saca useDisponibilidadOrbi al abrir.
  mantenimiento: string | null

  toggle: () => void
  open: () => void
  close: () => void
  showBubble: (data: OrbiBubbleData) => void
  hideBubble: () => void
  addMessage: (msg: OrbiMessage) => void
  appendToLastAssistant: (chunk: string) => void
  resetLastAssistantText: () => void
  addActionToLastAssistant: (action: OrbiAction) => void
  updateAction: (msgId: string, actionId: string, update: Partial<OrbiAction>) => void
  markProductCreated: (productId: string) => void
  setTurnIdOnLastAssistant: (turnId: string) => void
  setRating: (msgId: string, rating: 1 | -1) => void
  setStreaming: (v: boolean) => void
  setConversationId: (id: string | null) => void
  addStepDivider: (stepName: string) => void
  setWelcomeGreetedStep: (stepKey: string | null) => void
  marcarDetenido: (msgId: string) => void
  setAbort: (c: AbortController | null) => void
  abortar: () => void
  iniciarEnvio: (c: AbortController) => number
  terminarEnvio: (envio: number, sesionAlEnviar: number) => void
  reset: () => void
  setMantenimiento: (aviso: string | null) => void
  quitarMensaje: (msgId: string) => void
}

export const useOrbiStore = create<OrbiState>((set, get) => ({
  isOpen: false,
  messages: [],
  conversationId: null,
  isStreaming: false,
  createdProductIds: new Set(),
  bubble: null,
  welcomeGreetedStep: null,
  sesion: 0,
  abortEnCurso: null,
  envio: 0,
  mantenimiento: null,

  // Cerrar Orbi corta la respuesta en curso: la vista se desmonta y nadie la
  // va a leer. Abrir no toca nada.
  toggle: () => {
    if (get().isOpen) get().abortar()
    set(s => ({ isOpen: !s.isOpen }))
  },
  open: () => set({ isOpen: true, bubble: null }),
  close: () => {
    get().abortar()
    set({ isOpen: false })
  },
  showBubble: (data) => set({ bubble: data }),
  hideBubble: () => set({ bubble: null }),

  addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),

  appendToLastAssistant: (chunk) => set(s => {
    const msgs = [...s.messages]
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') {
      msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
    }
    return { messages: msgs }
  }),

  // Gemini 3.x manda un mensaje ANTES de llamar una tool y otro DESPUÉS. El
  // primero se streamea igual (Orbi "pensando en voz alta") pero el backend
  // manda un text_reset cuando esa vuelta termina llamando una tool: se borra
  // ese texto y queda solo la respuesta final. Las actions no se tocan.
  resetLastAssistantText: () => set(s => {
    const msgs = [...s.messages]
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') {
      msgs[msgs.length - 1] = { ...last, content: '' }
    }
    return { messages: msgs }
  }),

  addActionToLastAssistant: (action) => set(s => {
    const msgs = [...s.messages]
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') {
      msgs[msgs.length - 1] = { ...last, actions: [...(last.actions ?? []), action] }
    }
    return { messages: msgs }
  }),

  updateAction: (msgId, actionId, update) => set(s => {
    const msgs = s.messages.map(m => {
      if (m.id !== msgId) return m
      return {
        ...m,
        actions: m.actions?.map(a => a.id === actionId ? { ...a, ...update } : a),
      }
    })
    return { messages: msgs }
  }),

  markProductCreated: (productId) => set(s => ({ createdProductIds: new Set(s.createdProductIds).add(productId) })),

  setTurnIdOnLastAssistant: (turnId) => set(s => {
    const msgs = [...s.messages]
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') { msgs[i] = { ...msgs[i], turnId }; break }
    }
    return { messages: msgs }
  }),

  setRating: (msgId, rating) => set(s => ({
    messages: s.messages.map(m => m.id === msgId ? { ...m, rating } : m),
  })),

  setStreaming: (v) => set({ isStreaming: v }),
  setConversationId: (id) => set({ conversationId: id }),

  addStepDivider: (stepName) => set(s => ({
    messages: [...s.messages, {
      id: `divider-${Date.now()}`,
      role: 'divider' as const,
      content: stepName,
      timestamp: Date.now(),
    }],
  })),

  setWelcomeGreetedStep: (stepKey) => set({ welcomeGreetedStep: stepKey }),

  marcarDetenido: (msgId) => set(s => ({
    messages: s.messages.map(m => m.id === msgId ? { ...m, detenido: true } : m),
  })),

  setAbort: (c) => set({ abortEnCurso: c }),

  // Corta la respuesta, no la conversación: los mensajes y el id quedan (es
  // lo que usa el botón Detener y cerrar el panel).
  abortar: () => {
    const c = get().abortEnCurso
    if (!c) return
    set({ abortEnCurso: null })
    c.abort()
  },

  // Arranca un envío: corta el que estuviera en curso (si no, su conexión
  // queda abierta sin nadie que la pueda cortar y la API sigue generando y
  // facturando) y devuelve el número de este envío.
  iniciarEnvio: (c) => {
    get().abortar()
    const envio = get().envio + 1
    set({ abortEnCurso: c, envio })
    return envio
  },

  // Cierre de un envío: solo el vigente suelta el controller y, si no hubo
  // reset mientras tanto, baja el "escribiendo". Uno reemplazado no toca nada.
  terminarEnvio: (envio, sesionAlEnviar) => {
    const s = get()
    if (s.envio !== envio) return
    if (s.abortEnCurso) set({ abortEnCurso: null })
    if (s.sesion === sesionAlEnviar) set({ isStreaming: false })
  },

  // Conversación nueva (botón Nueva conversación, logout, login de otra
  // persona): corta lo que esté en curso y sube la sesión para que ningún
  // evento del stream viejo llegue a escribir acá. Limpiar welcomeGreetedStep
  // hace que el saludo vuelva a aparecer.
  reset: () => {
    get().abortar()
    set(s => ({
      messages: [],
      conversationId: null,
      isStreaming: false,
      welcomeGreetedStep: null,
      sesion: s.sesion + 1,
    }))
  },

  setMantenimiento: (aviso) => set({ mantenimiento: aviso }),

  quitarMensaje: (msgId) => set(s => ({ messages: s.messages.filter(m => m.id !== msgId) })),
}))
