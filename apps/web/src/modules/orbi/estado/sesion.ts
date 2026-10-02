// Una sesión guardada (GET /orbi/sesiones/:id) pasada a los mensajes que usa el
// chat (useOrbiStore), para seguir la conversación con el mismo motor de envío.
import type { OrbiAction, OrbiMessage } from '@/components/orbi/types'
import type { EstadoDeAprobacion, MensajeDeSesion } from '../api/sesiones'

const ESTADO: Record<EstadoDeAprobacion, OrbiAction['status']> = {
  pendiente: 'pending',
  vencida: 'pending',
  aplicando: 'active',
  aplicada: 'complete',
  fallida: 'error',
  cancelada: 'rejected',
  desconocida: 'unknown',
}

export function mensajesDeLaSesion(mensajes: MensajeDeSesion[]): OrbiMessage[] {
  return mensajes.map((m, i) => {
    const timestamp = m.creadoEl ? Date.parse(m.creadoEl) : i
    const texto = m.partes.flatMap(p => (p.tipo === 'texto' ? [p.texto] : [])).join('\n\n')
    const actions: OrbiAction[] = m.partes.flatMap((p): OrbiAction[] => {
      if (p.tipo !== 'aprobacion') return []
      const estado = p.estadoActual ?? 'desconocida'
      return [{
        id: `${m.id}-${p.actionId}`,
        label: p.resumen,
        tool: p.tool,
        status: ESTADO[estado],
        actionId: p.actionId,
        resumen: p.resumen,
        // Una vencida se reconoce por la hora: propuesta hace más de 10 minutos.
        inicio: estado === 'vencida' ? 0 : timestamp,
      }]
    })
    return {
      id: `sesion-${m.id}`,
      role: m.rol,
      content: texto,
      ...(actions.length ? { actions } : {}),
      timestamp,
    }
  })
}
