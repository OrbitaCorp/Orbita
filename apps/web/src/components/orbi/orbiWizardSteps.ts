import type { WizardFormState } from './useOrbiContext'

export type OrbiChipKind = 'field' | 'prompt'

export interface OrbiStepChip {
  key: string
  label: string
  kind: OrbiChipKind
  filled?: boolean
  send: string
}

// stepName -> nombre humano del paso. Los stepName válidos son EXACTOS: los
// emite ElegirRubro ('elegir-rubro') y STEP_NAMES de SetupUnificado.
export const ORBI_STEP_LABELS: Record<string, string> = {
  'elegir-rubro': 'Tu rubro',
  'subrubros': 'Qué vendés',
  'tu-negocio': 'Tu negocio',
  'ubicacion': 'Ubicación',
  'cuenta': 'Tu cuenta',
}

const prompt = (label: string, send = label): OrbiStepChip => ({
  key: label.toLowerCase().replace(/[^a-z]+/g, '-'),
  label,
  kind: 'prompt',
  send,
})

// Campos de "tu-negocio" que Orbi puede completar, en orden.
const CAMPOS_TU_NEGOCIO: { key: keyof WizardFormState; label: string }[] = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'subdominio', label: 'Subdominio' },
]

function campoLleno(form: WizardFormState, key: string): boolean {
  const v = (form as Record<string, unknown>)[key]
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  return Boolean(v)
}

export function deriveStepChips(
  stepName: string,
  form: WizardFormState,
  opts: { conModoVenta?: boolean } = {},
): { chips: OrbiStepChip[]; quickChips: string[] } {
  switch (stepName) {
    case 'elegir-rubro':
      return {
        chips: [
          prompt('Vendo productos', 'Vendo productos'),
          prompt('Doy servicios', 'Doy servicios'),
          prompt('Ayudame a elegir', 'Ayudame a elegir mi rubro'),
        ],
        quickChips: ['¿Qué rubro me conviene?'],
      }

    case 'subrubros':
      return {
        chips: [
          prompt('Contame qué vendo', 'Te cuento qué vendo y elegís las opciones'),
          prompt('Vendo varios tipos', 'Vendo varios tipos de productos'),
          prompt('¿Cuáles elijo?', '¿Cuáles opciones me convienen?'),
        ],
        quickChips: ['Elegime las que correspondan'],
      }

    case 'tu-negocio': {
      const chips: OrbiStepChip[] = CAMPOS_TU_NEGOCIO.map(c => ({
        key: c.key,
        label: c.label,
        kind: 'field' as const,
        filled: campoLleno(form, c.key),
        send: `Ayudame con ${c.label.toLowerCase()}`,
      }))
      if (opts.conModoVenta) {
        chips.push({
          key: 'modoVenta',
          label: 'Tipo de tienda',
          kind: 'field',
          filled: campoLleno(form, 'modoVenta'),
          send: 'Ayudame a elegir el tipo de tienda',
        })
      }
      return {
        chips,
        quickChips: ['Sugerime un nombre', 'Sugerime una descripción', '¿Qué es el subdominio?'],
      }
    }

    case 'ubicacion':
      return {
        chips: [
          prompt('Vendo solo online', 'Vendo solo online'),
          prompt('Tengo local', 'Tengo un local físico'),
          prompt('Los dos', 'Tengo local y también vendo online'),
        ],
        quickChips: ['¿Qué pongo acá?'],
      }

    case 'cuenta':
      return {
        chips: [
          prompt('¿Por qué necesito cuenta?', '¿Por qué necesito crear una cuenta?'),
          prompt('¿Es seguro?', '¿Mis datos están seguros?'),
        ],
        quickChips: ['¿Qué contraseña conviene?'],
      }

    default:
      return { chips: [], quickChips: [] }
  }
}
