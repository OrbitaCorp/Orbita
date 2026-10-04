/**
 * Mes "YYYY-MM" con el que se guardan los cost_snapshots. Es UTC a propósito
 * (toISOString): el sync de costos, getLimits y las alertas tienen que hablar
 * del mismo mes, así que nadie debería armar este string por su cuenta.
 */
export function currentMonth(ahora: Date = new Date()): string {
  return ahora.toISOString().slice(0, 7);
}

/** Primer instante (UTC) del mes de `currentMonth(ahora)`: el borde de "una vez por mes". */
export function inicioDelMesDeCostos(ahora: Date = new Date()): Date {
  return new Date(`${currentMonth(ahora)}-01T00:00:00.000Z`);
}
