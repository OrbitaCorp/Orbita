import { HttpException } from '@nestjs/common';

// Códigos de error de red de Node donde tiene sentido reintentar con otro
// proveedor (DNS, conexión, timeout). No incluye errores de protocolo/parseo.
const CODIGOS_DE_RED = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET',
]);

function statusDe(err: unknown): number | undefined {
  if (err instanceof HttpException) return err.getStatus();
  const e = err as { status?: unknown; response?: { status?: unknown }; code?: unknown };
  if (typeof e?.status === 'number') return e.status;
  if (typeof e?.response?.status === 'number') return e.response.status;
  return undefined;
}

/**
 * ¿Este error de Gemini justifica caer al proveedor de fallback (Groq)?
 *
 * SÍ: cuota agotada (429), errores del servidor (5xx), "servicio no configurado"
 * (503 — ej. GEMINI_API_KEY vacía), y errores de red/timeout.
 *
 * NO: 400/401/403/404 y cualquier Error genérico sin status. Un 400 es un
 * request mal armado y un 404 un modelo mal configurado: son bugs nuestros que
 * hay que ver, no indisponibilidad — taparlos con Groq los vuelve invisibles.
 */
export function esErrorDeDisponibilidad(err: unknown): boolean {
  const status = statusDe(err);
  if (status !== undefined) return status === 429 || status >= 500;

  const code = (err as { code?: unknown })?.code;
  if (typeof code === 'string' && CODIGOS_DE_RED.has(code)) return true;

  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return msg.includes('fetch failed') || msg.includes('network') || msg.includes('socket hang up');
}
