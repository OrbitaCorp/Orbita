import { useEffect } from 'react'
import { useOrbiStore } from './useOrbiStore'
import { useOrbiContext } from './useOrbiContext'
import { mensajeOrbiAlLlegar } from './orbiWelcome'

// Renderiza null. Cuando Orbi está abierto y el usuario llega a una superficie/
// paso donde todavía no lo saludó, siembra un primer mensaje del asistente:
// saludo completo la primera vez, o "seguimos con X" si ya venía usando Orbi.
// Reemplaza a la burbuja de bienvenida de ElegirRubro y al mensaje
// "¡Avanzaste a X!" que inyectaba setWizardContext.
export function OrbiWelcomeSeeder() {
  const ctx = useOrbiContext()
  const isOpen = useOrbiStore(s => s.isOpen)
  const greeted = useOrbiStore(s => s.welcomeGreetedStep)

  useEffect(() => {
    if (!isOpen) return

    const stepKey = ctx.surface === 'wizard' ? (ctx.stepName ?? 'wizard') : 'panel'
    if (greeted === stepKey) return

    const store = useOrbiStore.getState()
    const hayHistorial = store.messages.some(m => m.role === 'user' || m.role === 'assistant')
    const esPrimerContacto = greeted === null && !hayHistorial

    const texto = mensajeOrbiAlLlegar(ctx, esPrimerContacto)
    if (texto) {
      store.addMessage({
        id: `orbi-greet-${Date.now()}`,
        role: 'assistant',
        content: texto,
        timestamp: Date.now(),
      })
    }
    store.setWelcomeGreetedStep(stepKey)
  }, [isOpen, ctx, greeted])

  return null
}
