import { useRouter } from 'next/router'
import { useMemo, useSyncExternalStore } from 'react'
import type { OrbiContext } from './types'
import { useAuth } from '@/hooks/useAuth'
import { useOrbiStore } from './useOrbiStore'

interface WizardOverrides {
  step?: number
  stepName?: string
  rubro?: string
  availableOptions?: { key: string; label: string; description?: string }[]
}

// `wizardOverrides` es mutado desde afuera de React (ElegirRubro,
// SetupUnificado llaman a setWizardContext en un useEffect cada vez que
// cambia el paso/rubro/catálogo). Antes esto vivía en una variable de módulo
// plana leída dentro de un useMemo con deps [pathname, slug, user] — como
// ninguna de esas deps cambia cuando avanza el wizard, el memo nunca se
// recalculaba y useOrbiContext() devolvía para siempre el snapshot vacío de
// la primera vez que se montó el panel. Resultado: Orbi actuaba como si no
// supiera en qué paso estaba (porque, en la práctica, no lo sabía) — no
// sugería nombres reales, ni el rubro real, incluso con los fixes de prompt
// y de tools por paso ya aplicados. useSyncExternalStore es el mecanismo
// correcto de React para que un hook reaccione a un store externo mutable.
let wizardOverrides: WizardOverrides = {}
const wizardListeners = new Set<() => void>()

// Un label por cada stepName que se emite de verdad — 'elegir-rubro' desde
// ElegirRubro y el resto desde STEP_NAMES en SetupUnificado. Tenía además
// 'pagos' y 'equipo', dos pasos que el alta dejó de preguntar (commit 1088f0a).
const STEP_LABELS: Record<string, string> = {
  'elegir-rubro': 'Elegir rubro',
  'subrubros': 'Tipo de productos',
  'tu-negocio': 'Tu negocio',
  'ubicacion': 'Ubicación',
  'cuenta': 'Tu cuenta',
}

/**
 * Lo que la persona lleva completado del formulario. Viaja al backend en cada
 * mensaje para que Orbi sepa qué hay escrito y no vuelva a pedir algo que ya
 * está — ver OrbiWizardFormStateDto del lado de la API, que es la lista cerrada
 * de campos que se aceptan.
 *
 * A propósito NO pasa por useSyncExternalStore como wizardOverrides: esto
 * cambia con cada tecla que el usuario escribe, y notificar a los suscriptores
 * en cada keystroke re-renderizaría el panel de Orbi entero para nada. Solo se
 * lee en el momento de mandar un mensaje (useOrbiChat), que es cuando importa.
 */
export type WizardFormState = {
  nombre?: string
  descripcion?: string
  subdominio?: string
  modoVenta?: string
  subrubros?: string[]
  tipoLocal?: string[]
  telefonoCargado?: boolean
  logoCargado?: boolean
  direccionCargada?: boolean
}

let wizardFormState: WizardFormState = {}

export function setWizardFormState(next: WizardFormState) {
  wizardFormState = next
}

export function getWizardFormState(): WizardFormState {
  return wizardFormState
}

export function resetWizardFormState() {
  wizardFormState = {}
}

export function setWizardContext(overrides: WizardOverrides) {
  const prevStep = wizardOverrides.stepName
  wizardOverrides = overrides
  wizardListeners.forEach(l => l())

  if (overrides.stepName && overrides.stepName !== prevStep) {
    const store = useOrbiStore.getState()
    const label = STEP_LABELS[overrides.stepName] ?? overrides.stepName
    store.addStepDivider(label)

    if (prevStep && store.isOpen && store.messages.length > 0) {
      store.addMessage({
        id: `greet-${Date.now()}`,
        role: 'assistant',
        content: `¡Avanzaste a **${label}**! ¿Querés que te ayude con este paso?`,
        timestamp: Date.now(),
      })
    }
  }
}

function subscribeWizardOverrides(listener: () => void) {
  wizardListeners.add(listener)
  return () => wizardListeners.delete(listener)
}

function getWizardOverrides() {
  return wizardOverrides
}

// Tiene que ser SIEMPRE la misma referencia. Devolver un `{}` nuevo en cada
// llamada hace que React avise "The result of getServerSnapshot should be
// cached to avoid an infinite loop" — el snapshot del servidor se compara por
// identidad, y uno distinto cada vez le dice a React que el store cambió
// durante la hidratación, en loop.
const SNAPSHOT_SERVIDOR_VACIO: WizardOverrides = {}

function getWizardOverridesServerSnapshot(): WizardOverrides {
  return SNAPSHOT_SERVIDOR_VACIO
}

export function useOrbiContext(): OrbiContext {
  const router = useRouter()
  const { user } = useAuth()
  const { slug } = router.query
  const overrides = useSyncExternalStore(subscribeWizardOverrides, getWizardOverrides, getWizardOverridesServerSnapshot)

  return useMemo(() => {
    if (router.pathname.startsWith('/onboarding')) {
      return {
        surface: 'wizard' as const,
        ...overrides,
      }
    }

    const partes = Array.isArray(slug) ? slug : []
    const section = partes[partes.length - 1]
    const module = partes.length >= 2 ? partes[partes.length - 2] : undefined

    return {
      surface: 'panel' as const,
      module: module ?? section ?? undefined,
      section: partes.length >= 2 ? section : undefined,
      businessId: user?.type === 'member' ? user.business.id : undefined,
      permissions: user?.type === 'member' ? user.permissions : undefined,
    }
  }, [router.pathname, slug, user, overrides])
}
