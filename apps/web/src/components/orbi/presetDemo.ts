// Reproduce una respuesta prearmada de la demo (lib/demo/orbiPresets.ts) con
// el mismo ritmo y los mismos pasos que una respuesta real: primero "piensa"
// con una herramienta en curso, después escribe de a tramos y, si la pregunta
// termina en una propuesta, deja la tarjeta con Confirmar / Cancelar.
//
// Sin React ni fetch: recibe lo que necesita del chat y un `esperar`, así se
// prueba en node. useOrbiChat lo conecta al store y al corte (Detener, cerrar,
// Nueva conversación).
import type { OrbiAction } from './types'
import {
  PASO_MS,
  PENSANDO_MS,
  actionIdDemo,
  tramosDeRespuesta,
  type PresetDemo,
} from '@/lib/demo/orbiPresets'

export interface OpsDelChat {
  appendToLastAssistant: (texto: string) => void
  addActionToLastAssistant: (accion: OrbiAction) => void
  updateAction: (accionId: string, cambios: Partial<OrbiAction>) => void
  /** Resuelve al pasar el tiempo, o antes si se corta el envío. */
  esperar: (ms: number) => Promise<void>
  /** false apenas hubo un corte, un reset o un envío nuevo: se deja de escribir. */
  vigente: () => boolean
}

/** Devuelve true si llegó hasta el final; false si lo cortaron a la mitad. */
export async function reproducirPreset(preset: PresetDemo, ops: OpsDelChat): Promise<boolean> {
  const idConsulta = `demo-consulta-${preset.id}`
  ops.addActionToLastAssistant({ id: idConsulta, label: preset.tool, tool: preset.tool, status: 'active', inicio: Date.now() })

  await ops.esperar(PENSANDO_MS)
  if (!ops.vigente()) return false
  ops.updateAction(idConsulta, { status: 'complete', fin: Date.now(), ...(preset.resultado ? { result: preset.resultado } : {}) })

  for (const tramo of tramosDeRespuesta(preset.respuesta)) {
    if (!ops.vigente()) return false
    ops.appendToLastAssistant(tramo)
    await ops.esperar(PASO_MS)
  }
  if (!ops.vigente()) return false

  if (preset.accion) {
    ops.addActionToLastAssistant({
      id: `demo-accion-${preset.id}`,
      label: preset.accion.resumen,
      tool: preset.accion.tool,
      status: 'pending',
      actionId: actionIdDemo(preset.id),
      resumen: preset.accion.resumen,
      inicio: Date.now(),
    })
  }
  return true
}
