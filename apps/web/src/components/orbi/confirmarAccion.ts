// Lógica pura de la tarjeta de acción de Orbi (spec §3.9): qué estado muestra
// la tarjeta según lo que responde la API al confirmar o cancelar. Vive acá,
// sin fetch ni React, para poder probar cada fila de la tabla en node;
// useOrbiChat solo pide y aplica.
//
// La regla que ordena todo: nunca se le dice "pedísela de nuevo" a alguien
// cuya acción pudo haberse aplicado. Pedírsela de nuevo genera un actionId
// nuevo, y si la primera sí se aplicó quedan dos cupones. Cuando no sabemos,
// se dice que no sabemos, dónde revisarlo, y se ofrece reintentar el MISMO
// actionId: confirmar es idempotente en el servidor, así que no duplica.

export type EstadoTarjeta = 'pending' | 'active' | 'complete' | 'error' | 'rejected' | 'unknown'

/** El ToolResult que devuelve POST /orbi/confirm (y que guarda la acción). */
export interface ResultadoTool {
  success: boolean
  data?: unknown
  error?: string
  label: string
}

export type RespuestaConfirmar =
  | { http: 200; body: ResultadoTool }
  | { http: 404 }
  | { http: 409; body: { estado: 'aplicando' | 'desconocido'; mensaje?: string } }
  | { http: 'red' | 500 }

export type RespuestaCancelar =
  | { http: 200 }
  | { http: 404 }
  | { http: 409; body: { estado: 'ya_aplicada'; result: ResultadoTool | null } }
  | { http: 'red' | 500 }

export interface PasoTarjeta {
  estado: EstadoTarjeta
  /** Solo con 409 `aplicando`: volver a preguntar solo, con el mismo actionId. */
  reintentar: boolean
  mensaje?: string
}

// Los dos únicos textos que dicen "pedísela de nuevo": la acción seguro NO se
// aplicó (no existe más, o el servidor se negó porque la tarjeta quedó vieja).
export const MENSAJE_NO_DISPONIBLE = 'Esa acción ya no está disponible. Pedísela a Orbi de nuevo.'
export const MENSAJE_DESACTUALIZADA = 'La acción cambió mientras tanto. Pedísela de nuevo a Orbi.'

// El servidor guarda `interno` cuando la herramienta tiró: la escritura no
// llegó a hacerse y la acción quedó como fallida. La palabra cruda no le dice
// nada a nadie.
const MENSAJE_INTERNO = 'Falló de nuestro lado y no se aplicó.'
const MENSAJE_SIN_MOTIVO = 'No se pudo completar.'

// Los códigos de error fijos que manda la API (ver nota-conversacion.ts en
// apps/api): el resto son frases de las herramientas, que ya están en castellano.
const ERROR_DESACTUALIZADA = 'desactualizada'
const ERROR_INTERNO = 'interno'

/**
 * Espera antes de cada reintento con 409 `aplicando`: creciente, y con tope.
 * Son 5 reintentos (15,5 s en total); si para entonces sigue aplicándose, la
 * tarjeta pasa a "No sé si se aplicó" con Reintentar en vez de quedar
 * girando para siempre.
 */
export const ESPERAS_REINTENTO_MS: readonly number[] = [500, 1000, 2000, 4000, 8000]

// Espejo de la pantalla de cada tool en apps/api (nota-conversacion.ts,
// `pantallaDe`): el mismo lugar que nombra el 409 `desconocido`. Una tool que
// no está acá no se nombra.
const PANTALLA_DE: Record<string, string> = {
  createProduct: 'Productos',
  createDiscount: 'Descuentos',
  createCoupon: 'Cupones',
  updateOrderStatus: 'Pedidos',
  updateBusinessInfo: 'Configuración',
  updatePaymentMethods: 'Configuración',
  updateShipping: 'Configuración',
}

/** Dónde revisar si una acción se aplicó. */
export function dondeRevisar(tool?: string): string {
  return tool && Object.prototype.hasOwnProperty.call(PANTALLA_DE, tool) ? PANTALLA_DE[tool] : 'el panel'
}

function mensajeDesconocido(tool?: string): string {
  return `No sé si se aplicó. Revisalo en ${dondeRevisar(tool)}; si reintentás, no se duplica.`
}

function mensajeSigueAplicando(tool?: string): string {
  return `Todavía se está aplicando. Revisalo en ${dondeRevisar(tool)} en un rato; si reintentás, no se duplica.`
}

/** El motivo de un ToolResult fallido, en palabras para la persona. */
export function motivoDelError(error?: string): string {
  if (error === ERROR_DESACTUALIZADA) return MENSAJE_DESACTUALIZADA
  if (error === ERROR_INTERNO) return MENSAJE_INTERNO
  return error && error.trim() ? error : MENSAJE_SIN_MOTIVO
}

/** Qué hace la tarjeta con una respuesta de POST /orbi/confirm (tabla de §3.9). */
export function siguienteEstado(r: RespuestaConfirmar, tool?: string): PasoTarjeta {
  switch (r.http) {
    case 200:
      return r.body.success
        ? { estado: 'complete', reintentar: false, mensaje: r.body.label }
        : { estado: 'error', reintentar: false, mensaje: motivoDelError(r.body.error) }
    case 404:
      return { estado: 'error', reintentar: false, mensaje: MENSAJE_NO_DISPONIBLE }
    case 409:
      return r.body.estado === 'aplicando'
        ? { estado: 'active', reintentar: true }
        : { estado: 'unknown', reintentar: false, mensaje: mensajeDesconocido(tool) }
    default:
      // Red caída o 5xx: la escritura pudo haber llegado a la base.
      return { estado: 'unknown', reintentar: false, mensaje: mensajeDesconocido(tool) }
  }
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function comoResultado(v: unknown): ResultadoTool | null {
  if (!esObjeto(v) || typeof v.success !== 'boolean') return null
  return {
    success: v.success,
    label: typeof v.label === 'string' ? v.label : '',
    ...(v.data !== undefined ? { data: v.data } : {}),
    ...(typeof v.error === 'string' ? { error: v.error } : {}),
  }
}

/**
 * Pasa el status y el cuerpo crudos de POST /orbi/confirm a la respuesta
 * tipada. El 409 de Nest trae `{ estado, mensaje, error, statusCode }`: se lee
 * `estado`. Todo lo que no es una respuesta conocida (5xx, 403, 429, un
 * cuerpo que no se entiende) cae en "no sé": nunca se afirma algo que no se
 * sabe, y reintentar el mismo actionId no duplica.
 */
export function interpretarRespuestaConfirmar(status: number, cuerpo: unknown): RespuestaConfirmar {
  if (status === 200) {
    const body = comoResultado(cuerpo)
    return body ? { http: 200, body } : { http: 500 }
  }
  if (status === 404) return { http: 404 }
  if (status === 409 && esObjeto(cuerpo) && (cuerpo.estado === 'aplicando' || cuerpo.estado === 'desconocido')) {
    return {
      http: 409,
      body: { estado: cuerpo.estado, ...(typeof cuerpo.mensaje === 'string' ? { mensaje: cuerpo.mensaje } : {}) },
    }
  }
  return { http: 500 }
}

export interface ResultadoConfirmar extends PasoTarjeta {
  /** `data` del ToolResult, solo en un 200. */
  data?: unknown
}

/**
 * Confirma y, mientras la API diga 409 `aplicando`, vuelve a preguntar con el
 * MISMO actionId esperando cada vez más. `pedir` hace el POST; si tira (red
 * caída) cuenta como "no sé". `esperar` se inyecta para poder probarlo sin
 * relojes.
 */
export async function confirmarConReintentos(
  actionId: string,
  pedir: (actionId: string) => Promise<RespuestaConfirmar>,
  esperar: (ms: number) => Promise<void>,
  tool?: string,
): Promise<ResultadoConfirmar> {
  for (let reintentos = 0; ; reintentos++) {
    let r: RespuestaConfirmar
    try {
      r = await pedir(actionId)
    } catch {
      r = { http: 'red' }
    }
    const paso = siguienteEstado(r, tool)
    if (!paso.reintentar) {
      return r.http === 200 && r.body.data !== undefined ? { ...paso, data: r.body.data } : paso
    }
    if (reintentos >= ESPERAS_REINTENTO_MS.length) {
      return { estado: 'unknown', reintentar: false, mensaje: mensajeSigueAplicando(tool) }
    }
    await esperar(ESPERAS_REINTENTO_MS[reintentos])
  }
}

/** Status y cuerpo crudos de POST /orbi/reject → respuesta tipada. */
export function interpretarRespuestaCancelar(status: number, cuerpo: unknown): RespuestaCancelar {
  if (status === 200) return { http: 200 }
  if (status === 404) return { http: 404 }
  if (status === 409 && esObjeto(cuerpo) && cuerpo.estado === 'ya_aplicada') {
    return { http: 409, body: { estado: 'ya_aplicada', result: comoResultado(cuerpo.result) } }
  }
  // 403, 5xx, red: cancelar no escribió nada que haya que contar.
  return { http: 500 }
}

export interface PasoCancelar {
  estado: EstadoTarjeta
  mensaje?: string
  /** Aviso chico arriba del resultado ("Ya se aplicó", "No pude cancelarla"). */
  nota?: string
  data?: unknown
}

/** Qué hace la tarjeta con una respuesta de POST /orbi/reject. */
export function siguienteEstadoAlCancelar(r: RespuestaCancelar, tool?: string): PasoCancelar {
  switch (r.http) {
    case 200:
      return { estado: 'rejected' }
    case 409: {
      // Alguien la confirmó antes (otra pestaña, un doble clic): se muestra
      // lo que de verdad pasó, con el resultado guardado en el servidor.
      const result = r.body.result
      if (!result) return { estado: 'unknown', mensaje: mensajeDesconocido(tool) }
      return result.success
        ? { estado: 'complete', mensaje: result.label, nota: 'Ya se aplicó', ...(result.data !== undefined ? { data: result.data } : {}) }
        : { estado: 'error', mensaje: motivoDelError(result.error), nota: 'Ya se había confirmado' }
    }
    case 404:
      // 404 también es "se está aplicando en este momento" (ver
      // PendingActionService#rechazar): no se puede afirmar que no pasó nada.
      return { estado: 'error', mensaje: `Ya no se puede cancelar. Revisá en ${dondeRevisar(tool)} si se aplicó.` }
    default:
      // Cancelar no escribe nada: la propuesta sigue ahí y se puede volver a
      // cancelar (o confirmar).
      return { estado: 'pending', nota: 'No pude cancelarla. Probá de nuevo.' }
  }
}

/**
 * Queries de react-query que muestran lo que una acción acaba de crear. Son
 * las keys reales de las pantallas (useDescuentos: ['descuentos', filtros];
 * useCupones: ['cupones', filtros]); invalidar el prefijo alcanza a todos los
 * filtros. Las dos juntas porque la pantalla de descuentos muestra ambas.
 */
export function queriesARefrescar(tool: string): string[][] {
  if (tool === 'createDiscount' || tool === 'createCoupon') return [['descuentos'], ['cupones']]
  return []
}

/**
 * Evento de ventana que se emite tras cada acción aplicada, con
 * `{ tool, data }`. Las pantallas que no usan react-query (ProductoLista) lo
 * escuchan para recargar.
 */
export const EVENTO_ACCION_EJECUTADA = 'orbi:accion-ejecutada'

export interface DetalleAccionEjecutada {
  tool: string
  data?: unknown
}

/** ProductoLista recarga la grilla solo cuando Orbi creó un producto. */
export function recargaProductos(detalle: unknown): boolean {
  return esObjeto(detalle) && detalle.tool === 'createProduct'
}
