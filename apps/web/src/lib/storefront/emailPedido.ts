// Email del comprador invitado para ver su pedido recién hecho (confirmación y
// vuelta de Mercado Pago) sin cuenta. Antes viajaba en la URL
// (?email=...): quedaba en el historial, en los logs de cualquier proxy y en la
// URL de retorno que se le pasa a Mercado Pago (hallazgo email-en-url,
// auditoría 09/09; cerrado en la auditoría interna 10/09, ítem
// web.cliente.checkout). Ahora se guarda en sessionStorage —de esta pestaña,
// se borra al cerrarla y sobrevive la ida y vuelta a MP— y viaja a la API en
// un header (x-buyer-email), no en la query.

const clave = (orderId: string) => `orbita-email-pedido:${orderId}`

export function guardarEmailDePedido(orderId: string, email: string): void {
  try { sessionStorage.setItem(clave(orderId), email) } catch { /* sin sessionStorage: la confirmación pide ingresar a la cuenta */ }
}

export function emailDePedido(orderId: string): string | null {
  try { return sessionStorage.getItem(clave(orderId)) } catch { return null }
}
