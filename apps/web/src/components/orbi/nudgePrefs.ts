// Preferencias de las ofertas proactivas de Orbi durante el onboarding, en
// sessionStorage — un reload arranca de cero, que es la señal natural de
// "quiero volver a empezar". Nada de esto va a la base.
//
// Reglas:
// - Un "No, gracias" en una burbuja proactiva marca ese paso como ya ofrecido
//   (no vuelve a ofrecer en ESE paso).
// - Dos "No" en total → se apagan TODAS las ofertas proactivas por la sesión.
//   El chat y el FAB siguen disponibles siempre; esto solo calla lo automático.

const KEY_DECLINES = 'orbi-nudge-declines'
const KEY_OFF = 'orbi-nudges-off'
const KEY_STEPS = 'orbi-nudge-steps-offered'

const NO_PARA_APAGAR = 2

function get(k: string): string | null {
  try {
    return sessionStorage.getItem(k)
  } catch {
    return null
  }
}

function set(k: string, v: string): void {
  try {
    sessionStorage.setItem(k, v)
  } catch {
    /* modo incógnito / storage bloqueado: sin persistencia, no rompe nada */
  }
}

export function nudgesApagados(): boolean {
  return get(KEY_OFF) === '1'
}

/** El usuario apretó "No, gracias" en una oferta del paso `stepKey`. */
export function registrarNo(stepKey: string): void {
  marcarPasoOfrecido(stepKey)
  const n = Number(get(KEY_DECLINES) ?? '0') + 1
  set(KEY_DECLINES, String(n))
  if (n >= NO_PARA_APAGAR) set(KEY_OFF, '1')
}

function pasosOfrecidos(): string[] {
  try {
    const arr = JSON.parse(get(KEY_STEPS) ?? '[]')
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function pasoYaOfrecido(stepKey: string): boolean {
  return pasosOfrecidos().includes(stepKey)
}

export function marcarPasoOfrecido(stepKey: string): void {
  const set_ = new Set(pasosOfrecidos())
  set_.add(stepKey)
  set(KEY_STEPS, JSON.stringify([...set_]))
}

/** ¿Se puede mostrar una oferta proactiva para este paso ahora mismo? */
export function puedeOfrecer(stepKey: string): boolean {
  return !nudgesApagados() && !pasoYaOfrecido(stepKey)
}
