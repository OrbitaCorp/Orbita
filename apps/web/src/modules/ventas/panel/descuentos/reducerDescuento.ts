import type { TipoDescuento, AlcanceDescuento, Aplicacion, BonusTipoBeneficio } from './types'
import { hoyISO, localAInstante } from './utils'
import type { EscalaForm } from './components/ConfigVolumen'

// ─── State ────────────────────────────────────────────────────────────────────

export interface DescuentoFormState {
  // Básico
  nombre: string
  tipo: TipoDescuento | null
  // Valor + alcance estándar
  valor: string
  alcance: AlcanceDescuento
  productosIds: string[]
  categoriasIds: string[]
  // Monto mínimo (ticket types)
  montoMinimo: string
  sinMontoMinimo: boolean
  // LlevaXPagaY
  llevaCantidad: string
  pagaCantidad: string
  // CompraXObtieneZ — trigger
  triggerAlcance: AlcanceDescuento
  triggerProductosIds: string[]
  triggerCategoriasIds: string[]
  cantidadMinCompra: string
  // CompraXObtieneZ — bonus
  bonusAlcance: AlcanceDescuento
  bonusProductosIds: string[]
  bonusCategoriasIds: string[]
  bonusTipoBeneficio: BonusTipoBeneficio
  bonusValor: string
  // Volumen
  escalasVolumen: EscalaForm[]
  // Vigencia
  fechaInicio: string
  fechaFin: string
  sinVencimiento: boolean
  diasVigencia: number[]
  todosDias: boolean
  todoElDia: boolean
  horaInicio: string
  horaFin: string
  limiteUsosTotal: string
  ilimitadoUsos: boolean
  // Aplicación
  aplicacion: Aplicacion
  // Oferta relámpago: hora exacta ("HH:mm", local) en la que termina. La
  // fecha es `fechaFin`. Los demás tipos no la usan.
  horaFinRelampago: string
  // Validación
  errores: Record<string, string>
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type DescuentoFormAction =
  | { type: 'SET'; key: keyof DescuentoFormState; value: unknown }
  | { type: 'SET_TIPO'; tipo: TipoDescuento }
  | { type: 'ADD_ESCALA' }
  | { type: 'UPDATE_ESCALA'; idx: number; field: keyof EscalaForm; value: string }
  | { type: 'REMOVE_ESCALA'; idx: number }
  | { type: 'PRECARGAR'; state: Partial<DescuentoFormState> }

// ─── Initial State ────────────────────────────────────────────────────────────

const hoy = hoyISO

export const initialDescuentoState: DescuentoFormState = {
  nombre: '',
  tipo: null,
  valor: '',
  alcance: 'producto',
  productosIds: [],
  categoriasIds: [],
  montoMinimo: '',
  sinMontoMinimo: false,
  llevaCantidad: '',
  pagaCantidad: '',
  triggerAlcance: 'producto',
  triggerProductosIds: [],
  triggerCategoriasIds: [],
  cantidadMinCompra: '1',
  bonusAlcance: 'producto',
  bonusProductosIds: [],
  bonusCategoriasIds: [],
  bonusTipoBeneficio: 'gratis',
  bonusValor: '',
  escalasVolumen: [{ desde: '1', hasta: '', porcentaje: '' }],
  fechaInicio: hoy(),
  fechaFin: '',
  sinVencimiento: false,
  diasVigencia: [],
  todosDias: true,
  todoElDia: true,
  horaInicio: '00:00',
  horaFin: '23:59',
  limiteUsosTotal: '',
  ilimitadoUsos: true,
  aplicacion: 'automatico',
  horaFinRelampago: '23:59',
  errores: {},
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function reducerDescuento(
  state: DescuentoFormState,
  action: DescuentoFormAction
): DescuentoFormState {
  switch (action.type) {
    case 'SET':
      // Al setear el mapa de errores completo, guardarlo tal cual (no auto-limpiar).
      if (action.key === 'errores') return { ...state, errores: action.value as Record<string, string> }
      return { ...state, [action.key]: action.value, errores: { ...state.errores, [action.key as string]: '' } }

    case 'SET_TIPO': {
      // % Ticket / $ Fijo Ticket no muestran selector de alcance (aplican al
      // ticket completo, no a productos/categorías puntuales) — si acá se
      // dejaba el 'producto' del tipo anterior, el payload mandaba
      // scope=PRODUCT sin productIds y el backend lo rechazaba con "Elegí al
      // menos un producto o una categoría" sin que la UI mostrara nada.
      const esTicket = action.tipo === 'porcentaje_ticket' || action.tipo === 'monto_fijo_ticket'
      // La oferta relámpago siempre termina: al elegirla, "Sin vencimiento" se
      // apaga (y el bloque de Vigencia pasa a pedir fecha Y hora de fin).
      const esRelampago = action.tipo === 'oferta_relampago'
      return {
        ...state,
        tipo: action.tipo,
        valor: '',
        alcance: esTicket ? 'ticket' : 'producto',
        productosIds: [],
        categoriasIds: [],
        llevaCantidad: '',
        pagaCantidad: '',
        sinVencimiento: esRelampago ? false : state.sinVencimiento,
        errores: {},
      }
    }

    case 'ADD_ESCALA':
      return {
        ...state,
        escalasVolumen: [...state.escalasVolumen, { desde: '', hasta: '', porcentaje: '' }],
      }

    case 'UPDATE_ESCALA': {
      const escalas = state.escalasVolumen.map((e, i) =>
        i === action.idx ? { ...e, [action.field]: action.value } : e
      )
      return { ...state, escalasVolumen: escalas }
    }

    case 'REMOVE_ESCALA':
      return { ...state, escalasVolumen: state.escalasVolumen.filter((_, i) => i !== action.idx) }

    case 'PRECARGAR':
      return { ...state, ...action.state, errores: {} }

    default:
      return state
  }
}

// ─── Validación ───────────────────────────────────────────────────────────────

// `ahoraMs` se recibe por parámetro (y no `Date.now()` adentro) para que la
// validación sea una función pura: se prueba con un "ahora" fijo y no depende
// del reloj de la máquina.
export function validarDescuentoForm(state: DescuentoFormState, esEdicion = false, ahoraMs: number = Date.now()): Record<string, string> {
  const e: Record<string, string> = {}
  if (!state.nombre.trim()) e.nombre = 'El nombre es obligatorio'
  if (!state.tipo) e.tipo = 'Seleccioná un tipo de descuento'
  const esRelampago = state.tipo === 'oferta_relampago'
  const esPorcentaje = state.tipo === 'porcentaje_producto' || state.tipo === 'porcentaje_ticket' || esRelampago
  if (!['lleva_x_paga_y', 'compra_x_obtiene_z', 'volumen'].includes(state.tipo ?? '')) {
    // El backend rechaza value<=0 siempre, y porcentaje>100 además — replicarlo
    // acá evita mandar el POST/PUT para que rebote con un 400 recién en el submit.
    const valorNum = parseFloat(state.valor)
    if (!state.valor || Number.isNaN(valorNum) || valorNum <= 0) {
      e.valor = 'Ingresá un valor de descuento'
    } else if (esPorcentaje && valorNum > 100) {
      e.valor = 'El porcentaje tiene que estar entre 1 y 100'
    }
  }
  if (state.tipo === 'lleva_x_paga_y') {
    const lleva = parseInt(state.llevaCantidad, 10)
    const paga = parseInt(state.pagaCantidad, 10)
    if (!lleva || lleva < 2) e.llevaCantidad = 'Mínimo 2'
    if (!paga || paga < 1) e.pagaCantidad = 'Mínimo 1'
    if (lleva && paga && paga >= lleva) e.cantidades = 'Pagá debe ser menor que Llevá'
  }
  if (state.tipo === 'volumen' && state.escalasVolumen.length === 0) {
    e.escalas = 'Agregá al menos una escala'
  }
  // El backend rechaza con 400 un alcance producto/categoría sin selección
  // (RF-15) — validarlo acá antes de mandar el POST/PUT evita el error
  // "crudo" de la API y muestra el mensaje en el lugar correcto del form.
  if (state.alcance === 'producto' && state.productosIds.length === 0) {
    e.seleccion = 'Seleccioná al menos un producto'
  }
  if (state.alcance === 'categoria' && state.categoriasIds.length === 0) {
    e.seleccion = 'Seleccioná al menos una categoría'
  }
  // El calendario ya impide elegir un inicio pasado al crear, pero un
  // descuento en edición puede tener legítimamente una fecha de inicio vieja
  // (ya está corriendo) — la regla de "no pasado" solo aplica al alta.
  if (!state.fechaInicio) {
    e.fechaInicio = 'Seleccioná fecha de inicio'
  } else if (!esEdicion && state.fechaInicio < hoy()) {
    e.fechaInicio = 'La fecha de inicio no puede ser anterior a hoy'
  }
  if (esRelampago) {
    // La oferta relámpago termina en un instante exacto: fecha Y hora, en el
    // futuro, y no antes de que empiece. El mismo día que el inicio vale
    // (una oferta "solo por hoy hasta las 20:00").
    if (!state.fechaFin) {
      e.fechaFin = 'Poné la fecha en la que termina la oferta'
    } else if (!state.horaFinRelampago) {
      e.horaFinRelampago = 'Poné la hora en la que termina la oferta'
    } else {
      const fin = localAInstante(state.fechaFin, state.horaFinRelampago)
      if (!fin) {
        e.horaFinRelampago = 'Fecha u hora inválidas'
      } else if (new Date(fin).getTime() <= ahoraMs) {
        e.fechaFin = 'La oferta relámpago tiene que terminar en el futuro'
      } else if (state.fechaFin < state.fechaInicio) {
        e.fechaFin = 'La fecha de fin no puede ser anterior a la de inicio'
      }
    }
  } else if (!state.sinVencimiento) {
    if (!state.fechaFin) {
      e.fechaFin = 'Seleccioná fecha de fin o activá "Sin vencimiento"'
    } else if (state.fechaFin <= state.fechaInicio) {
      e.fechaFin = 'La fecha de fin tiene que ser posterior a la de inicio'
    }
  }
  return e
}
