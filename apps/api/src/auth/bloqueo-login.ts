// Bloqueo por intentos fallidos de login (members, clientes y admins de plataforma).
//
// 5 fallos seguidos bloquean la cuenta 15 minutos. Hasta el 12/11 el contador solo volvía a cero con un ingreso
// correcto: cuando vencía el bloqueo seguía en 5, así que UN fallo más (por ejemplo, el navegador autocompletando una
// contraseña vieja) volvía a bloquear otros 15 minutos, y así cada vez. Le pasaba a Milagros en el super panel: "se le
// bloquea siempre aunque pone bien la contraseña". Ahora, si el bloqueo anterior ya venció, el fallo cuenta desde 1.

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

/** Lo que se guarda en la cuenta después de un intento fallido. */
export function trasIntentoFallido(
  intentosActuales: number,
  bloqueadaHasta: Date | null,
  ahora: Date = new Date(),
): { failedLoginAttempts: number; lockedUntil?: Date | null } {
  const bloqueoVencido = !!bloqueadaHasta && bloqueadaHasta.getTime() <= ahora.getTime();
  const intentos = (bloqueoVencido ? 0 : intentosActuales) + 1;
  if (intentos >= LOCKOUT_THRESHOLD) {
    return { failedLoginAttempts: intentos, lockedUntil: new Date(ahora.getTime() + LOCKOUT_DURATION_MS) };
  }
  // lockedUntil solo se escribe si cambia: un bloqueo vencido se limpia, uno vigente o ninguno no se toca.
  return bloqueoVencido ? { failedLoginAttempts: intentos, lockedUntil: null } : { failedLoginAttempts: intentos };
}
