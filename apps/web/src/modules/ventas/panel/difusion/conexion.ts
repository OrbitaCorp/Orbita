import type { InstagramEstado } from '@/lib/api'

// Cuántos de los 3 pasos de la conexión están hechos: 0 sin pedido, 1 pedido enviado (pendiente de
// confirmación), 2 habilitado para conectar, 3 conectado.
export function pasosHechos(estado: InstagramEstado | null): number {
  if (!estado) return 0
  if (estado.connected) return 3
  if (estado.habilitado === false) return estado.solicitud ? 1 : 0
  return 2
}

/** El modal de conexión se abre solo únicamente en el paso 3: dos hechos y falta conectar. */
export function abreElModalSolo(estado: InstagramEstado | null): boolean {
  return pasosHechos(estado) === 2
}
