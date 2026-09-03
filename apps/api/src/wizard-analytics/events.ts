// El contrato de eventos del wizard. Es la lista COMPLETA de lo que el front
// tiene permitido mandar: cualquier `type` que no esté acá se descarta en la
// ingesta sin error (el endpoint es público, así que la tabla tiene que estar
// blindada contra basura y contra alguien tirándole cosas a mano).
//
// El espejo de esta lista vive en apps/web/src/lib/analytics/wizardEvents.ts.
// Si agregás un evento, agregalo en los dos lados.

export const WIZARD_EVENT_TYPES = [
  // ── Recorrido ──
  'session_start', // primera vez que se pisa el wizard en esta visita
  'step_view', // entró a ver un paso
  'step_next', // avanzó (durationMs = cuánto estuvo en el paso)
  'step_back', // volvió atrás — señal fuerte de que algo no se entendió
  'wizard_complete', // terminó los 5 pasos y llegó a la pantalla de pago
  'checkout_start', // apretó el botón de pagar

  // ── Campos ──
  'field_focus',
  'field_blur', // salió del campo (durationMs = cuánto lo tuvo enfocado)
  'field_error', // una validación le dijo que no
  'availability_check', // chequeo de subdominio / email: meta.status

  // ── Orbi ──
  'orbi_open',
  'orbi_message', // le escribió algo (el TEXTO se guarda del lado del server)
  'orbi_suggestion_applied', // aceptó una sugerencia (tool del wizard)
  'orbi_suggestion_overridden', // la aceptó y después la pisó a mano: mala sugerencia
  'orbi_nudge_shown',
  'orbi_nudge_dismissed',
] as const;

export type WizardEventType = (typeof WIZARD_EVENT_TYPES)[number];

const VALIDOS = new Set<string>(WIZARD_EVENT_TYPES);

export function esEventoConocido(type: string): type is WizardEventType {
  return VALIDOS.has(type);
}

/** Los pasos del recorrido completo, en orden (espejo de BarraPasos.tsx). */
export const WIZARD_STEPS = [
  'rubro',
  'subrubros',
  'tu-negocio',
  'ubicacion',
  'cuenta',
  'pago',
] as const;
