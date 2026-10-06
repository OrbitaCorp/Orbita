// Orbi en el alta: el asistente del alta anterior (modules/onboarding), montado
// sobre esta pantalla. Es el mismo Orbi de siempre (botón flotante, panel
// lateral en escritorio y hoja completa en celular, burbuja proactiva) hablando
// con /orbi/chat/wizard; lo que cambia es de dónde saca el contexto. Este
// archivo traduce los pasos y los datos del alta a lo que la API ya entiende
// (los stepName de prompts/wizard.ts: elegir-rubro, subrubros, tu-negocio,
// ubicacion y cuenta) y aplica sobre el alta lo que Orbi hace desde el chat:
// elegir una opción, completar un campo, continuar.
//
// Solo se monta en el alta real (<Alta real />): la demo de /turnos-demo no
// llama a la API y además useOrbiContext solo reconoce el wizard por la ruta
// /onboarding.
import { useEffect, useRef, type RefObject } from 'react'
import { OrbiPanel } from '@/components/orbi/OrbiPanel'
import { OrbiWizardFAB } from '@/components/orbi/OrbiWizardFAB'
import { OrbiBubble } from '@/components/orbi/OrbiBubble'
import { OrbiWelcomeSeeder } from '@/components/orbi/OrbiWelcomeSeeder'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import { useOrbiChat } from '@/components/orbi/useOrbiChat'
import { useOrbiKeyboardShortcut } from '@/components/orbi/useOrbiKeyboardShortcut'
import { getWizardFormState, resetWizardFormState, setWizardContext, setWizardFormState, useOrbiContext, type WizardFormState } from '@/components/orbi/useOrbiContext'
import { deriveStepChips } from '@/components/orbi/orbiWizardSteps'
import { useOrbiSafeArea } from '@/components/orbi/useOrbiSafeArea'
import { useStuckDetector } from '@/components/orbi/useStuckDetector'
import { marcarPasoOfrecido, puedeOfrecer, registrarNo } from '@/components/orbi/nudgePrefs'
import { track } from '@/lib/analytics/wizardTracker'
import { MODULOS } from './PasoModulo'
import { SUBRUBROS_TIENDA, alternarTipo } from './subrubrosTienda'
import { aSlug, modalidadesAlta, moduloHabilitado, type DatosAlta, type Errores, type Modulo, type PasoId } from './modelo'

/**
 * Cómo se llama cada paso del alta para Orbi: los stepName que entiende la API
 * (apps/api/src/orbi/prompts/wizard.ts). Los pasos propios de Turnos no tienen
 * prompt: ahí Orbi contesta con el genérico del wizard.
 */
const PASO_ORBI: Partial<Record<PasoId, string>> = {
  modulo: 'elegir-rubro', tipo: 'subrubros', negocio: 'tu-negocio', ubicacion: 'ubicacion', cuenta: 'cuenta',
}

interface Opcion { key: string; label: string; description?: string }

// Las opciones que Orbi puede elegir en cada paso (selectWizardOption), con los
// keys que después vuelven por el evento orbi:select-option. Los módulos en
// "Próximamente" no se ofrecen: no se pueden elegir.
const OPCIONES_MODULO: Opcion[] = MODULOS.filter(m => moduloHabilitado(m.id)).map(m => ({ key: m.id, label: m.titulo, description: m.bajada }))
const OPCIONES_TIPO: Opcion[] = SUBRUBROS_TIENDA.map(s => ({ key: s.key, label: s.label, description: s.descripcion }))
const OPCIONES_MODO_VENTA: Opcion[] = [
  { key: 'ecommerce', label: 'Tienda online', description: 'Carrito, checkout y pagos online' },
  { key: 'vidriera', label: 'Vidriera digital', description: 'Catálogo sin carrito ni checkout' },
]
// La API habla de "fisico" y "online", como el alta anterior; acá son las modalidades local y domicilio.
const OPCIONES_UBICACION: Opcion[] = [
  { key: 'fisico', label: 'Local físico', description: 'Tengo un local, showroom o depósito propio.' },
  { key: 'online', label: 'Online / A domicilio', description: 'Vendo por internet y envío o entrego los pedidos.' },
]
const OPCIONES_POR_PASO: Partial<Record<PasoId, Opcion[]>> = {
  modulo: OPCIONES_MODULO, tipo: OPCIONES_TIPO, negocio: OPCIONES_MODO_VENTA, ubicacion: OPCIONES_UBICACION,
}
const MODALIDAD_DE: Record<string, 'local' | 'domicilio'> = { fisico: 'local', online: 'domicilio' }

// Campos que Orbi puede completar (tool fillWizardField) y a qué dato del alta van.
type CampoTexto = 'negocio' | 'descripcion' | 'slug' | 'telefono' | 'direccion'
const CAMPO_DE: Record<string, CampoTexto> = { nombre: 'negocio', descripcion: 'descripcion', subdominio: 'slug', telefono: 'telefono', direccion: 'direccion' }

// Oferta proactiva SOLO cuando la persona está trabada: 30 s sin tocar nada en
// el paso, con el panel cerrado y sin haber dicho "No" ya (ver nudgePrefs).
const OFERTA: Record<string, string> = {
  'elegir-rubro': '¿Te ayudo a elegir con qué arrancar?',
  subrubros: '¿Te ayudo a elegir el tipo de productos?',
  'tu-negocio': '¿Te ayudo con el nombre o la descripción?',
  ubicacion: '¿Te ayudo a configurar dónde vendés?',
  cuenta: '¿Alguna duda para crear tu cuenta?',
}
const PEDIDO_DE_AYUDA: Record<string, string> = {
  'elegir-rubro': 'Ayudame a elegir con qué arrancar',
  subrubros: 'Ayudame a elegir el tipo de productos',
  'tu-negocio': 'Ayudame con el nombre y la descripción',
  ubicacion: 'Ayudame a configurar dónde vendo',
  cuenta: 'Tengo una duda con la cuenta',
}

interface Props {
  id: PasoId
  /** Índice del paso actual y cantidad de pasos del recorrido. */
  paso: number
  total: number
  datos: DatosAlta
  /** Errores del paso actual: vacío = se puede continuar. */
  errores: Errores
  /** La botonera fija de abajo: Orbi (botón, burbuja y panel) se acomoda arriba de ella. */
  pie: RefObject<HTMLElement | null>
  onElegirModulo: (m: Modulo) => void
  onPoner: <K extends keyof DatosAlta>(campo: K, valor: DatosAlta[K]) => void
  /** Orbi completó ese campo: queda marcado como sugerido hasta que la persona lo edite. */
  onSugerido: (campo: CampoTexto) => void
  onContinuar: () => void
}

export function OrbiAlta({ id, paso, total, datos, errores, pie, onElegirModulo, onPoner, onSugerido, onContinuar }: Props) {
  const stepName = PASO_ORBI[id]
  const toggle = useOrbiStore(s => s.toggle)
  const { send } = useOrbiChat()
  const contexto = useOrbiContext()
  useOrbiKeyboardShortcut()
  // La cabecera del alta no es fija (se va con el scroll): el panel arranca
  // arriba de todo y solo le deja lugar a la botonera.
  const sinCabecera = useRef<HTMLElement>(null)
  useOrbiSafeArea(sinCabecera, pie, [id])

  // Lo último que hay cargado, para que los manejadores de eventos (que se
  // suscriben una vez por paso) no lean un render viejo. Se actualiza después
  // de cada pintado, no durante (regla del compilador de React).
  const ultimo = useRef({ datos, onElegirModulo, onPoner, onSugerido, onContinuar })
  useEffect(() => { ultimo.current = { datos, onElegirModulo, onPoner, onSugerido, onContinuar } })

  // Lo que la persona lleva escrito, en los nombres que usa la API, para que
  // Orbi no vuelva a pedir algo que ya está. Cambia con cada tecla: se guarda
  // en una variable (no notifica a nadie) y se lee recién al mandar un mensaje.
  const modalidades = modalidadesAlta(datos, null)
  const form: WizardFormState = {
    nombre: datos.negocio,
    descripcion: datos.descripcion,
    subdominio: aSlug(datos.slug),
    modoVenta: datos.modoVenta,
    subrubros: datos.tipos,
    tipoLocal: [...(modalidades.includes('local') ? ['fisico'] : []), ...(modalidades.includes('domicilio') ? ['online'] : [])],
    telefonoCargado: datos.telefono.trim().length > 0,
    logoCargado: !!datos.logo,
    direccionCargada: datos.direccion.trim().length > 0,
  }
  useEffect(() => { setWizardFormState(form) })

  // El contexto del paso (lo que ve el panel y la tira del celular): se publica
  // cuando cambia algo que se ve, no con cada tecla. `llenos` entra solo para
  // recalcular las chips (lleno/vacío) cuando un campo cambia de estado; el
  // formulario se lee de la variable que dejó el efecto de arriba.
  const canAdvance = Object.keys(errores).length === 0
  const blockReason = Object.values(errores)[0] ?? null
  const rubro = datos.modulo ?? undefined
  const llenos = [form.nombre, form.descripcion, form.subdominio, form.modoVenta].map(v => (v ? '1' : '0')).join('')
  useEffect(() => {
    const { chips, quickChips } = stepName ? deriveStepChips(stepName, getWizardFormState(), { conModoVenta: true }) : { chips: [], quickChips: [] }
    setWizardContext({
      step: paso,
      stepName,
      rubro,
      availableOptions: OPCIONES_POR_PASO[id],
      stepChips: chips,
      quickChips,
      totalSteps: total,
      stepIndex: paso + 1,
      canAdvance,
      blockReason,
    })
  }, [id, stepName, paso, total, rubro, canAdvance, blockReason, llenos])

  // Al irse de la pantalla no queda contexto colgado para la próxima.
  useEffect(() => () => { setWizardContext({}); resetWizardFormState() }, [])

  // Lo que Orbi elige desde el chat (botón "Elegir X") y el "Continuar" de la hoja del celular.
  useEffect(() => {
    const alElegir = (e: Event) => {
      const key = String((e as CustomEvent<{ key?: unknown }>).detail?.key ?? '')
      const { datos: d, onElegirModulo: elegirModulo, onPoner: poner } = ultimo.current
      if (id === 'modulo') {
        if ((key === 'tienda' || key === 'turnos') && moduloHabilitado(key)) elegirModulo(key)
      } else if (id === 'tipo') {
        if (SUBRUBROS_TIENDA.some(s => s.key === key) && !d.tipos.includes(key)) poner('tipos', alternarTipo(d.tipos, key))
      } else if (id === 'negocio') {
        if (key === 'ecommerce' || key === 'vidriera') poner('modoVenta', key)
      } else if (id === 'ubicacion') {
        const modalidad = MODALIDAD_DE[key]
        const actuales = modalidadesAlta(d, null)
        if (modalidad && !actuales.includes(modalidad)) poner('modalidades', [...actuales, modalidad])
      }
    }
    const alAvanzar = () => ultimo.current.onContinuar()
    window.addEventListener('orbi:select-option', alElegir)
    window.addEventListener('orbi:advance-step', alAvanzar)
    return () => {
      window.removeEventListener('orbi:select-option', alElegir)
      window.removeEventListener('orbi:advance-step', alAvanzar)
    }
  }, [id])

  // Campos que Orbi completó (fillWizardField): se vuelcan al alta una sola vez
  // cada uno y quedan marcados como sugeridos.
  const mensajes = useOrbiStore(s => s.messages)
  const aplicadas = useRef(new Set<string>())
  useEffect(() => {
    for (const msg of mensajes) {
      for (const accion of msg.actions ?? []) {
        if (accion.status !== 'complete' || accion.tool !== 'fillWizardField' || aplicadas.current.has(accion.id)) continue
        aplicadas.current.add(accion.id)
        const field = typeof accion.data?.field === 'string' ? accion.data.field : null
        const value = typeof accion.data?.value === 'string' ? accion.data.value : null
        const campo = field ? CAMPO_DE[field] : undefined
        if (!field || !campo || value === null) continue
        ultimo.current.onPoner(campo, campo === 'slug' ? aSlug(value) : value)
        ultimo.current.onSugerido(campo)
        track('orbi_suggestion_applied', { field })
      }
    }
  }, [mensajes])

  const stepKey = stepName ?? id
  useStuckDetector({
    stepKey,
    enabled: true,
    onStuck: sk => {
      const store = useOrbiStore.getState()
      if (store.isOpen || !puedeOfrecer(sk)) return
      marcarPasoOfrecido(sk)
      store.showBubble({
        message: OFERTA[sk] ?? '¿Te doy una mano con este paso?',
        chips: [
          { label: 'Sí, dale', actionKey: 'help-step' },
          { label: 'No, gracias', actionKey: 'dismiss' },
        ],
      })
    },
  })

  const alTocarChip = (actionKey: string) => {
    if (actionKey === 'dismiss') {
      // "No, gracias": este paso no vuelve a ofrecer; a los dos "No" se apagan
      // todas las ofertas proactivas por la sesión.
      registrarNo(stepKey)
      return
    }
    if (actionKey === 'help-step') {
      useOrbiStore.getState().open()
      send(PEDIDO_DE_AYUDA[stepKey] ?? 'Ayudame con este paso', contexto)
    }
  }

  return (
    <>
      <OrbiPanel />
      <OrbiWelcomeSeeder />
      <OrbiBubble onChipClick={alTocarChip} />
      <OrbiWizardFAB onClick={toggle} />
    </>
  )
}
