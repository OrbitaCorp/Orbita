// Errores de la base que el módulo traduce a respuestas HTTP.

const texto = (err: unknown): string => {
  if (!err || typeof err !== 'object') return String(err);
  const e = err as { message?: unknown; code?: unknown; meta?: unknown };
  return `${String(e.message ?? '')} ${String(e.code ?? '')} ${JSON.stringify(e.meta ?? {})}`;
};

/**
 * La constraint de exclusión `appointments_no_overlap` rechazó el turno (dos
 * reservas simultáneas pasaron el chequeo y la segunda chocó en la base).
 * Prisma la entrega como error desconocido / P2010 con el código en el
 * mensaje: se reconoce por el texto (CONTRATO.md § 1.1, paso 3).
 */
export const esChoqueDeHorario = (err: unknown): boolean => /23P01|appointments_no_overlap|exclusion constraint/i.test(texto(err));

/** Violación de único (P2002) sobre `code` o `access_token`: se reintenta con otro. */
export function esCodigoRepetido(err: unknown): boolean {
  if (!err || typeof err !== 'object' || (err as { code?: unknown }).code !== 'P2002') return false;
  return /code|access_token|accessToken/.test(JSON.stringify((err as { meta?: unknown }).meta ?? {}));
}
