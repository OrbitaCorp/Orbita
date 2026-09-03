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
  status: 'active' | 'complete' | 'error'
  result?: string
  data?: Record<string, unknown>
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
