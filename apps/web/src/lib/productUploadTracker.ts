import { useSyncExternalStore } from 'react'

// ─── Tracker de "crear producto" en segundo plano ──────────────────────────
// Antes, crear un producto bloqueaba la pantalla hasta que TODO terminara:
// crear el registro (POST /products) y subir cada foto (lo más lento —
// conversión a WebP + subida a Supabase Storage por cada una). Ahora
// ProductoNuevo.tsx vuelve a la lista apenas el usuario toca "Crear
// producto" — ni siquiera espera el POST — y el resto sigue en segundo
// plano. Este módulo es el puente entre esa pantalla y la lista para que
// esta última sepa qué hay "en vuelo" y lo muestre como una card de
// progreso, aunque el producto todavía ni exista en el backend.
//
// Pub/sub simple a mano (no Zustand/Redux — no hay ninguna librería de
// estado global en el resto del proyecto) sobre un Map en el módulo: como
// ProductoLista.tsx (el "Hub") nunca se desmonta mientras el usuario sigue
// en Productos, el estado sigue vivo aunque ProductoNuevo.tsx sí se
// desmonte apenas se vuelve a la lista — por eso todo lo que pasa en
// segundo plano llama SOLO a las funciones de acá, nunca a un setState de
// ProductoNuevo (ese componente ya no existe para cuando termina).

export type ProductUploadPhase = 'creating' | 'uploading' | 'done' | 'error'

export type ProductUploadState = {
  // Id local, estable durante TODA la operación — el id real de la base
  // todavía no existe en la fase 'creating'.
  tempId: string
  // Se completa apenas responde el POST /products.
  productId: string | null
  // Datos tal como los cargó el usuario, para poder dibujar una card de
  // vista previa antes de que el producto exista de verdad.
  name: string
  basePrice: number
  totalStock: number
  categoryName: string | null
  status: 'PUBLISHED' | 'DRAFT'
  phase: ProductUploadPhase
  totalImages: number
  completed: number
  failed: number
  errorMessage?: string
}

const estados = new Map<string, ProductUploadState>()
const listeners = new Set<() => void>()

function notificar() {
  for (const l of listeners) l()
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// Snapshot estable para useSyncExternalStore: mismo array de referencia
// mientras nada cambió, para no re-renderizar de más.
let snapshot: ProductUploadState[] = []
export function getSnapshot() {
  return snapshot
}
function actualizarSnapshot() {
  snapshot = Array.from(estados.values())
}

// Red de seguridad: si por lo que sea nadie llama a clearProductUpload()
// (ej. ProductoLista no llegó a estar montado en ese momento), la card
// "en vuelo" no se queda pegada para siempre — se saca sola después de un
// rato. En el camino normal, ProductoLista.tsx la saca bastante antes de
// que esto llegue a dispararse (ver su efecto de "fase done").
const fallbacks = new Map<string, ReturnType<typeof setTimeout>>()
function agendarLimpiezaDeRespaldo(tempId: string, delayMs: number) {
  const anterior = fallbacks.get(tempId)
  if (anterior) clearTimeout(anterior)
  fallbacks.set(tempId, setTimeout(() => clearProductUpload(tempId), delayMs))
}

// ── Ciclo de vida ────────────────────────────────────────────────────────

export function beginProductCreation(tempId: string, info: {
  name: string
  basePrice: number
  totalStock: number
  categoryName: string | null
  status: 'PUBLISHED' | 'DRAFT'
}) {
  estados.set(tempId, {
    tempId, productId: null, phase: 'creating',
    totalImages: 0, completed: 0, failed: 0,
    ...info,
  })
  actualizarSnapshot()
  notificar()
}

// El POST /products respondió: ya hay id real. Si no hay fotos que subir,
// ya terminó todo — pasa directo a 'done' (no se borra sola: la deja
// vivir hasta que ProductoLista pida la lista de nuevo y la reemplace por
// la fila real, para que el cambio sea invisible en vez de dejar un hueco).
export function markProductCreated(tempId: string, productId: string, totalImages: number) {
  const s = estados.get(tempId)
  if (!s) return
  s.productId = productId
  s.totalImages = totalImages
  s.phase = totalImages === 0 ? 'done' : 'uploading'
  actualizarSnapshot()
  notificar()
  if (totalImages === 0) agendarLimpiezaDeRespaldo(tempId, 10000)
}

export function markImageUploaded(tempId: string, ok: boolean) {
  const s = estados.get(tempId)
  if (!s) return
  if (ok) s.completed++
  else s.failed++
  actualizarSnapshot()
  notificar()
}

// El POST /products en sí falló (no una foto — eso ya se banca solo, ver
// ProductoNuevo.tsx). Acá sí se pierde el producto: no hay ninguna fila
// real esperando del otro lado, así que se le avisa al usuario con la
// card en rojo un rato y se saca sola — no depende de ProductoLista.
export function markProductCreationFailed(tempId: string, message: string) {
  const s = estados.get(tempId)
  if (!s) return
  s.phase = 'error'
  s.errorMessage = message
  actualizarSnapshot()
  notificar()
  agendarLimpiezaDeRespaldo(tempId, 4000)
}

// Todas las fotos terminaron de intentarse (con o sin fallos). La card
// queda "lista" al 100% — sigue viva hasta que ProductoLista.tsx vuelva a
// pedir la lista y llame a clearProductUpload() con el producto real ya
// disponible. Antes esto mismo borraba la entrada con un setTimeout ciego,
// sin importar si la lista ya se había vuelto a pedir o no: si el refetch
// tardaba más que el timeout, quedaba un hueco vacío entre que
// desaparecía la card de mentira y aparecía la real — se veía como que el
// producto "se perdía" un instante. Ahora el que decide cuándo sacarla es
// quien tiene los datos reales en la mano.
export function finishProductUpload(tempId: string) {
  const s = estados.get(tempId)
  if (!s) return
  s.phase = 'done'
  actualizarSnapshot()
  notificar()
  agendarLimpiezaDeRespaldo(tempId, 10000)
}

// Saca la entrada del tracker — se llama recién cuando ya se sabe que el
// producto real (con su foto de verdad) está disponible para mostrarse en
// su lugar, o como limpieza de una card en error.
export function clearProductUpload(tempId: string) {
  const pendiente = fallbacks.get(tempId)
  if (pendiente) { clearTimeout(pendiente); fallbacks.delete(tempId) }
  if (!estados.has(tempId)) return
  estados.delete(tempId)
  actualizarSnapshot()
  notificar()
}

// Hook para ProductoLista.tsx — se re-renderiza solo cuando cambia algún
// estado de creación/subida (nueva, progreso, o se saca del mapa al terminar).
export function useProductUploads(): ProductUploadState[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// ─── Tracker de "editar producto" en segundo plano ─────────────────────────
// Mismo problema que create() pero para update(): antes, guardar los cambios
// de un producto (PUT + subir las fotos nuevas) bloqueaba la pantalla hasta
// que todo terminara. Con productos de varias variantes ese PUT puede tardar
// bastante — hasta 30s en el caso límite, ver el timeout explícito y el bug
// real de producción comentado en products.service.ts → update() — y el
// vendedor se quedaba mirando la pantalla congelada todo ese rato. Ahora
// ProductoNuevo.tsx vuelve a la lista apenas se toca "Guardar cambios" y el
// resto sigue acá atrás, igual que ya pasaba con la creación.
//
// A diferencia de la creación, acá el producto YA EXISTE (con su id real
// desde el arranque) y la lista YA tiene su fila real dibujada con los
// datos viejos — no hace falta una card "de mentira", alcanza con una
// marca liviana sobre la fila real para que ProductoLista sepa "esta se
// está guardando" sin tapar la foto ni el resto de los datos.

export type ProductEditPhase = 'saving' | 'done' | 'error'

export type ProductEditState = {
  productId: string
  phase: ProductEditPhase
  // Fotos nuevas que no se pudieron subir aunque el producto en sí se haya
  // guardado bien — se avisa con un toast recién cuando ProductoLista
  // refetchea (ver su efecto de "fase done"), no desde acá.
  failedPhotos: number
  errorMessage?: string
}

const ediciones = new Map<string, ProductEditState>()
const editListeners = new Set<() => void>()

function notificarEdicion() {
  for (const l of editListeners) l()
}

export function subscribeEdits(listener: () => void) {
  editListeners.add(listener)
  return () => { editListeners.delete(listener) }
}

let editSnapshot: ProductEditState[] = []
export function getEditSnapshot() {
  return editSnapshot
}
function actualizarEditSnapshot() {
  editSnapshot = Array.from(ediciones.values())
}

const editFallbacks = new Map<string, ReturnType<typeof setTimeout>>()
function agendarLimpiezaEdicion(productId: string, delayMs: number) {
  const anterior = editFallbacks.get(productId)
  if (anterior) clearTimeout(anterior)
  editFallbacks.set(productId, setTimeout(() => clearProductEdit(productId), delayMs))
}

export function beginProductEdit(productId: string) {
  ediciones.set(productId, { productId, phase: 'saving', failedPhotos: 0 })
  actualizarEditSnapshot()
  notificarEdicion()
}

// El PUT respondió bien (con o sin fotos fallidas — eso no tira abajo el
// guardado, ver ProductoNuevo.tsx). Igual que finishProductUpload(): queda
// viva hasta que ProductoLista pida la lista de nuevo y la saque, para que
// el swap a los datos reales sea invisible en vez de dejar la fila vieja
// un instante.
export function finishProductEdit(productId: string, failedPhotos = 0) {
  const s = ediciones.get(productId)
  if (!s) return
  s.phase = 'done'
  s.failedPhotos = failedPhotos
  actualizarEditSnapshot()
  notificarEdicion()
  agendarLimpiezaEdicion(productId, 10000)
}

// El PUT en sí falló — a diferencia de la creación, acá SÍ hay una fila
// real del otro lado (sin tocar, el producto sigue como estaba antes del
// intento), así que no hace falta esperar a nadie: se marca en error un
// rato para que se note en la fila y se saca sola.
export function markProductEditFailed(productId: string, message: string) {
  const s = ediciones.get(productId)
  if (!s) return
  s.phase = 'error'
  s.errorMessage = message
  actualizarEditSnapshot()
  notificarEdicion()
  agendarLimpiezaEdicion(productId, 5000)
}

export function clearProductEdit(productId: string) {
  const pendiente = editFallbacks.get(productId)
  if (pendiente) { clearTimeout(pendiente); editFallbacks.delete(productId) }
  if (!ediciones.has(productId)) return
  ediciones.delete(productId)
  actualizarEditSnapshot()
  notificarEdicion()
}

export function useProductEdits(): ProductEditState[] {
  return useSyncExternalStore(subscribeEdits, getEditSnapshot, getEditSnapshot)
}
