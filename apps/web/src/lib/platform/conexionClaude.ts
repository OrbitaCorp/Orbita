// La solicitud de conexión de Claude que quedó a medias porque hizo falta iniciar sesión antes de autorizarla.
// Vive en la pestaña (sessionStorage): al volver al panel se retoma la pantalla de autorización
// (pages/superadmin/conectar-claude.tsx y pages/superadmin/index.tsx).

const CLAVE = 'orbita_conectar_claude'

export function guardarConexionPendiente(req: string) {
  try { sessionStorage.setItem(CLAVE, req) } catch { /* sin almacenamiento: hay que volver a empezar desde Claude */ }
}
export function olvidarConexionPendiente() {
  try { sessionStorage.removeItem(CLAVE) } catch { /* nada que borrar */ }
}
export function leerConexionPendiente(): string | null {
  try { return sessionStorage.getItem(CLAVE) } catch { return null }
}
