// Estado transitorio del checkout (nombre/email/teléfono del comprador)
// compartido entre los pasos "Datos" → "Pago" → confirmar. La forma de
// entrega y la dirección se eligen y se usan enteras dentro del paso "Pago"
// (CheckoutPago.tsx) — no hace falta persistirlas acá.
//
// sessionStorage, no localStorage: a diferencia del carrito (que tiene
// sentido que sobreviva a cerrar la pestaña), esto es información de UNA
// compra en curso — no hay motivo para que quede pegada después.
import type { CheckoutInput } from '@/lib/api'

export type CheckoutDraft = {
  buyer: CheckoutInput['buyer']
}

function claveStorage(slug: string) {
  return `orbita-checkout-draft:${slug}`
}

export function saveCheckoutDraft(slug: string, draft: CheckoutDraft) {
  try { sessionStorage.setItem(claveStorage(slug), JSON.stringify(draft)) } catch { /* sessionStorage bloqueado: el checkout sigue, solo no persiste entre pasos */ }
}

export function loadCheckoutDraft(slug: string): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(claveStorage(slug))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearCheckoutDraft(slug: string) {
  try { sessionStorage.removeItem(claveStorage(slug)) } catch { /* nada que limpiar */ }
}
