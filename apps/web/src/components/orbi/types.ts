export type OrbiSurface = 'wizard' | 'panel'

export interface OrbiContext {
  surface: OrbiSurface
  module?: string
  section?: string
  businessId?: string
  permissions?: string[]
  step?: number
  stepName?: string
  rubro?: string
  availableOptions?: { key: string; label: string; description?: string }[]
}

export type OrbiMessageRole = 'user' | 'assistant' | 'divider'

export interface OrbiAction {
  id: string
  label: string
  tool: string
  /**
   * 'pending' es una acción que Orbi PROPUSO y todavía no se ejecutó: las
   * herramientas que escriben en la base esperan un clic (ver
   * PendingActionStore en el backend). Las demás se ejecutan solas y pasan
   * directo de 'active' a 'complete'.
   */
  status: 'pending' | 'active' | 'complete' | 'error'
  result?: string
  data?: Record<string, unknown>
  /** Solo en 'pending': el id con el que se confirma contra el servidor. */
  actionId?: string
  /** Solo en 'pending': qué va a pasar, en castellano, para mostrar en el botón. */
  resumen?: string
}

export interface OrbiMessage {
  id: string
  role: OrbiMessageRole
  content: string
  actions?: OrbiAction[]
  timestamp: number
  /**
   * Id del turno registrado en el backend (solo en el wizard). Lo manda el
   * servidor al final del stream y es lo que permite votar la respuesta:
   * sin él no hay pulgares, y el mensaje se muestra igual que siempre.
   */
  turnId?: string
  /** Voto del usuario sobre esta respuesta: 1 pulgar arriba, -1 abajo. */
  rating?: 1 | -1
}
