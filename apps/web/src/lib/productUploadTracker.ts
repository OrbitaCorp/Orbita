import { useSyncExternalStore } from 'react'

// ─── Tracker de subida de fotos en segundo plano ───────────────────────────
// Crear un producto con varias fotos era lo más lento de guardar (cada foto
// hace su propio viaje al backend: conversión a WebP + subida a Supabase
// Storage) — antes esa espera bloqueaba toda la pantalla hasta que las
// últimas fotos terminaban. Ahora ProductoNuevo.tsx crea el producto (rápido,
// sin fotos todavía), vuelve a la lista al toque, y las fotos se siguen
// subiendo solas en segundo plano — este módulo es el puente entre esas dos
// pantallas para que la lista sepa qué producto sigue "publicando fotos" y
// muestre el progreso.
//
// Pub/sub simple a mano (no Zustand/Redux — no hay ninguna libería de estado
// global en el resto del proyecto, no vale la pena sumar una por esto) sobre
// un Map en el módulo: como ProductoLista.tsx (el "Hub") nunca se desmonta
// mientras el usuario sigue en Productos (ver el comentario en ese archivo
// sobre `vista === 'nuevo'`), el estado sigue vivo aunque ProductoNuevo.tsx sí
// se desmonte apenas se vuelve a la lista — por eso la subida en sí NUNCA
// llama a un setState de ProductoNuevo, solo a las funciones de acá.

export type ProductUploadState = {
  productId: string
  total: number
  completed: number
  failed: number
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

export function startProductUpload(productId: string, total: number) {
  estados.set(productId, { productId, total, completed: 0, failed: 0 })
  actualizarSnapshot()
  notificar()
}

export function markImageUploaded(productId: string, ok: boolean) {
  const s = estados.get(productId)
  if (!s) return
  if (ok) s.completed++
  else s.failed++
  actualizarSnapshot()
  notificar()
}

// Se llama al terminar todas las subidas (éxito o no) — un delay chico antes
// de sacarlo del todo para que el usuario alcance a ver el "100%"/resultado
// final en vez de que la card cambie de golpe.
export function finishProductUpload(productId: string, delayMs = 1200) {
  setTimeout(() => {
    estados.delete(productId)
    actualizarSnapshot()
    notificar()
  }, delayMs)
}

export function getProductUpload(productId: string): ProductUploadState | undefined {
  return estados.get(productId)
}

// Hook para ProductoLista.tsx — se re-renderiza solo cuando cambia algún
// estado de subida (nueva, progreso, o se saca del mapa al terminar).
export function useProductUploads(): ProductUploadState[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
