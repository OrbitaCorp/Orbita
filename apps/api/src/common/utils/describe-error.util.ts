/**
 * Convierte un valor atrapado en un `catch` en un string diagnosticable para logs.
 *
 * Interpolar `e` directo en un template literal (`${e}`) produce "[object Object]" para
 * cualquier objeto sin `toString()` propio — que es exactamente lo que tira el SDK de
 * Mercado Pago: `RestClient.fetch()` hace `throw await response.json()`, o sea que el error
 * es el body JSON crudo de la API (`{ message, error, cause, status }`), no una instancia de
 * `Error`. Sin este helper, ese mensaje real queda perdido para siempre en el log.
 */
export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    const partes: string[] = [];
    if (typeof obj.message === 'string') partes.push(obj.message);
    if (typeof obj.error === 'string' && obj.error !== obj.message) partes.push(obj.error);
    if (obj.cause !== undefined) {
      try {
        partes.push(`cause=${JSON.stringify(obj.cause)}`);
      } catch {
        // cause no serializable, se ignora
      }
    }
    if (partes.length > 0) {
      const status = typeof obj.status === 'number' ? ` (status ${obj.status})` : '';
      return `${partes.join(' — ')}${status}`;
    }
    try {
      return JSON.stringify(obj);
    } catch {
      // sigue al fallback de abajo
    }
  }
  return String(e);
}
