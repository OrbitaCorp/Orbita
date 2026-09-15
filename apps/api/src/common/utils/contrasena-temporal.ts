// Vencimiento de las contraseñas temporales (hallazgo MEDIA
// `contrasena-temporal-reseteo`, auditoría interna 09/09).
//
// La temporal que el dueño le genera a un empleado (POST /members/:id/
// reset-password) vuelve en la respuesta y viaja por mail: quien la generó la
// conoce. Antes no vencía nunca, así que servía para entrar como esa persona
// indefinidamente. Ahora lleva fecha de vencimiento en la fila
// (`tempPasswordExpiresAt`) y el login la rechaza pasada esa fecha.
//
// Plazo: TEMP_PASSWORD_HORAS (env), default 72 h, mínimo 1 h. Un valor
// inválido (vacío, texto, 0, negativo) cae al default: es preferible a dejar
// temporales sin vencimiento por un typo en la config.

export const TEMP_PASSWORD_HORAS_DEFAULT = 72;

export function tempPasswordHoras(): number {
  const crudo = Number(process.env.TEMP_PASSWORD_HORAS);
  if (!Number.isFinite(crudo) || crudo <= 0) return TEMP_PASSWORD_HORAS_DEFAULT;
  return Math.max(1, Math.floor(crudo));
}

/** Instante en que vence una temporal emitida en `desde` (por defecto, ahora). */
export function vencimientoContrasenaTemporal(desde: Date = new Date()): Date {
  return new Date(desde.getTime() + tempPasswordHoras() * 60 * 60 * 1000);
}

// Compatibilidad: las temporales emitidas ANTES de la columna quedaron con
// `tempPasswordExpiresAt` null y siguen entrando (no se les puede poner una
// fecha retroactiva sin dejar afuera a quien todavía no la cambió). Una
// temporal sin vencimiento se regulariza sola: al cambiar la contraseña, o si
// el dueño la resetea de nuevo (la nueva ya sale con fecha).
export function contrasenaTemporalVencida(
  cuenta: { hasTempPassword?: boolean; tempPasswordExpiresAt?: Date | null },
  ahora: Date = new Date(),
): boolean {
  if (!cuenta.hasTempPassword || !cuenta.tempPasswordExpiresAt) return false;
  return cuenta.tempPasswordExpiresAt.getTime() < ahora.getTime();
}
