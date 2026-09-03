// Espejo de apps/api/src/wizard-analytics/events.ts.
//
// El backend descarta en silencio cualquier `type` que no esté en SU lista, así
// que si agregás un evento acá y te olvidás allá, el evento se manda y se
// pierde sin decir nada. Los dos archivos se editan juntos.

export const WIZARD_EVENT_TYPES = [
  'session_start',
  'step_view',
  'step_next',
  'step_back',
  'wizard_complete',
  'checkout_start',
  'field_focus',
  'field_blur',
  'field_error',
  'availability_check',
  'orbi_open',
  'orbi_message',
  'orbi_suggestion_applied',
  'orbi_suggestion_overridden',
  'orbi_nudge_shown',
  'orbi_nudge_dismissed',
] as const

export type WizardEventType = (typeof WIZARD_EVENT_TYPES)[number]
