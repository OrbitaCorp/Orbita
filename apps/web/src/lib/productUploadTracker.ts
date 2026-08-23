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

export type ProductUploadPhase = 'creating' | 'uploading' | 'error'

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
// termina acá mismo (no hace falta esperar nada más).
export function markProductCreated(tempId: string, productId: string, totalImages: number) {
  const s = estados.get(tempId)
  if (!s) return
  s.productId = productId
  s.totalImages = totalImages
  s.phase = 'uploading'
  actualizarSnapshot()
  notificar()
  if (totalImages === 0) finishProductUpload(tempId, 500)
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
// ProductoNuevo.tsx). Acá sí se pierde el producto: se le avisa al usuario
// con la card en rojo un rato y se saca — tiene que volver a cargarlo.
export function markProductCreationFailed(tempId: string, message: string) {
  const s = estados.get(tempId)
  if (!s) return
  s.phase = 'error'
  s.errorMessage = message
  actualizarSnapshot()
  notificar()
  finishProductUpload(tempId, 4000)
}

// Se llama al terminar (éxito o fotos fallidas) — un delay chico antes de
// sacarlo del todo para que el usuario alcance a ver el resultado final en
// vez de que la card cambie de golpe. ProductoLista.tsx además usa que esta
// entrada desaparezca como señal de "recién terminó algo, volvé a pedir la
// lista" (para traer la foto real en vez del placeholder).
export function finishProductUpload(tempId: string, delayMs = 1200) {
  setTimeout(() => {
    estados.delete(tempId)
    actualizarSnapshot()
    notificar()
  }, delayMs)
}

// Hook para ProductoLista.tsx — se re-renderiza solo cuando cambia algún
// estado de creación/subida (nueva, progreso, o se saca del mapa al terminar).
export function useProductUploads(): ProductUploadState[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
