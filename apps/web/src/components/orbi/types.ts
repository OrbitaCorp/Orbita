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
}

export type OrbiMessageRole = 'user' | 'assistant'

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
}
