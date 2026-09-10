import type { OrbiContext } from './types'

// Saludo completo la PRIMERA vez que Orbi aparece en la sesión, por paso del
// wizard. En el panel hay uno solo (no hay "pasos").
const SALUDO_WIZARD: Record<string, string> = {
  'elegir-rubro': '¡Hola! Soy Orbi. Te ayudo a armar tu tienda — ¿arrancamos eligiendo el rubro?',
  subrubros: '¡Hola! ¿Qué tipo de productos vas a vender? Contame y te doy una mano.',
  'tu-negocio': '¡Hola! Estoy para ayudarte con los datos de tu negocio. ¿Te tiro ideas de nombre?',
  ubicacion: '¡Hola! ¿Vendés desde un local, online, o los dos? Te ayudo a configurarlo.',
  cuenta: '¡Hola! Último paso. Cualquier duda para crear tu cuenta, preguntame.',
}
const SALUDO_WIZARD_DEFAULT = '¡Hola! Soy Orbi. ¿En qué te ayudo?'
const SALUDO_PANEL = '¡Hola! ¿En qué te doy una mano?'

// Cuando Orbi YA saludó antes en la sesión y el usuario llega a un paso nuevo:
// nada de "hola" de nuevo, solo orientarlo al paso.
const CONTINUACION_WIZARD: Record<string, string> = {
  subrubros: 'Dale, seguimos con **Tipo de productos**. ¿Qué vas a vender?',
  'tu-negocio': 'Dale, seguimos con **Tu negocio**. ¿Te ayudo con el nombre o la descripción?',
  ubicacion: 'Dale, seguimos con **Ubicación**. ¿Local, online, o los dos?',
  cuenta: 'Dale, seguimos con **Tu cuenta**. Cualquier duda, preguntame.',
}
const STEP_LABEL: Record<string, string> = {
  'elegir-rubro': 'Elegir rubro',
  subrubros: 'Tipo de productos',
  'tu-negocio': 'Tu negocio',
  ubicacion: 'Ubicación',
  cuenta: 'Tu cuenta',
}

/**
 * Qué dice Orbi al aparecer en una superficie/paso. `null` = no dice nada
 * (ej. el usuario reabre el panel en un paso donde ya lo saludó, o vuelve a
 * un paso del que ya venía).
 */
export function mensajeOrbiAlLlegar(ctx: OrbiContext, esPrimerContacto: boolean): string | null {
  if (ctx.surface === 'panel') {
    // El panel no tiene pasos: solo saluda la primera vez.
    return esPrimerContacto ? SALUDO_PANEL : null
  }

  const step = ctx.stepName
  if (esPrimerContacto) {
    return (step && SALUDO_WIZARD[step]) || SALUDO_WIZARD_DEFAULT
  }

  if (step && CONTINUACION_WIZARD[step]) return CONTINUACION_WIZARD[step]
  // Paso sin copy propio y sin label conocido: no forzamos una frase rara.
  const label = step ? STEP_LABEL[step] : undefined
  return label ? `Dale, seguimos con **${label}**.` : null
}
