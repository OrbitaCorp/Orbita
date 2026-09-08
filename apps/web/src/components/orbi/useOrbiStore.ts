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

  toggle: () => void
  open: () => void
  close: () => void
  showBubble: (data: OrbiBubbleData) => void
  hideBubble: () => void
  addMessage: (msg: OrbiMessage) => void
  appendToLastAssistant: (chunk: string) => void
  addActionToLastAssistant: (action: OrbiAction) => void
  updateAction: (msgId: string, actionId: string, update: Partial<OrbiAction>) => void
  markProductCreated: (productId: string) => void
  setTurnIdOnLastAssistant: (turnId: string) => void
  setRating: (msgId: string, rating: 1 | -1) => void
  setStreaming: (v: boolean) => void
  setConversationId: (id: string) => void
  addStepDivider: (stepName: string) => void
  reset: () => void
}

export const useOrbiStore = create<OrbiState>((set) => ({
  isOpen: false,
  messages: [],
  conversationId: null,
  isStreaming: false,
  createdProductIds: new Set(),
  bubble: null,

  toggle: () => set(s => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true, bubble: null }),
  close: () => set({ isOpen: false }),
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

  reset: () => set({ messages: [], conversationId: null, isStreaming: false }),
}))
