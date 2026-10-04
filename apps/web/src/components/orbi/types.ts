import type { EstadoTarjeta } from './confirmarAccion'

export type OrbiSurface = 'wizard' | 'panel'

/** Id del panel de Orbi en escritorio/celular: lo apunta el `aria-controls` del botón de la barra. */
export const ID_PANEL_ORBI = 'orbi-panel'

/** Lo que dice la caja de texto mientras Orbi está en mantenimiento (deshabilitada). */
export const PLACEHOLDER_EN_MANTENIMIENTO = 'Orbi no está disponible por ahora'

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
  /** Datos del paso del wizard para la tira de contexto móvil. Los publica
   *  SetupUnificado / ElegirRubro vía setWizardContext. */
  stepChips?: import('./orbiWizardSteps').OrbiStepChip[]
  quickChips?: string[]
  totalSteps?: number
  stepIndex?: number
  canAdvance?: boolean
  blockReason?: string | null
}

export type OrbiMessageRole = 'user' | 'assistant' | 'divider'

export interface OrbiAction {
  id: string
  label: string
  tool: string
  /**
   * 'pending' es una acción que Orbi PROPUSO y todavía no se ejecutó: las
   * herramientas que escriben en la base esperan un clic (ver
   * PendingActionService en el backend). Las demás se ejecutan solas y pasan
   * directo de 'active' a 'complete'. 'rejected' (la persona canceló) y
   * 'unknown' (no sabemos si se aplicó) solo los usa la tarjeta de confirmar:
   * ver confirmarAccion.ts.
   */
  status: EstadoTarjeta
  /**
   * Lo que se muestra debajo del resumen: el resultado en 'complete', el
   * motivo en 'error', dónde revisarlo en 'unknown'.
   */
  result?: string
  data?: Record<string, unknown>
  /** El id con el que se confirma o cancela contra el servidor. */
  actionId?: string
  /** Qué va a pasar, en castellano, para mostrar en la tarjeta. */
  resumen?: string
  /** Aviso chico de la tarjeta ("Ya se aplicó", "No pude cancelarla…"). */
  nota?: string
  /**
   * Encabezado propio de la tarjeta para cuando el de su estado ("No se
   * pudo") es ambiguo: "No se pudo cancelar", "No se aplicó".
   */
  titulo?: string
  /** Cuándo arrancó (consulta) o se propuso (tarjeta), en ms: el tiempo de la fila y el vencimiento de la tarjeta. */
  inicio?: number
  /** Cuándo terminó la consulta o se resolvió la tarjeta. */
  fin?: number
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
  /**
   * La respuesta se cortó a mitad de camino (Detener o cerrar el panel): la
   * burbuja conserva lo que llegó y muestra la marca "Detenido" en vez de un
   * error de conexión.
   */
  detenido?: boolean
}
