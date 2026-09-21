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
 * Un 404 de Gemini con el mensaje VACÍO no es "el modelo no existe": ese caso
 * SIEMPRE trae texto ("models/x is not found for API version v1beta..."). Un
 * 404 pelado es el frontend de Google escupiendo cualquier cosa durante un pico
 * de demanda, en la misma tanda que los 503.
 *
 * Visto en producción el 2026-09-10: la primera llamada del turno se comía un
 * 503 "This model is currently experiencing high demand" y caía bien al
 * fallback, pero la llamada de continuación (la que redacta la respuesta
 * después de la tool) volvía a Gemini y le contestaba 404 con message:"". Como
 * el 404 estaba excluido, no había fallback y el usuario terminaba viendo
 * "Error procesando tu mensaje" con el botón de la tool ya renderizado arriba.
 *
 * El 404 CON mensaje sigue siendo un error duro a propósito: ese sí es un
 * modelo mal configurado y taparlo con Groq lo volvería invisible.
 */
function es404Vacio(err: unknown, status: number | undefined): boolean {
  if (status !== 404) return false;
  const bruto = err instanceof Error ? err.message : String(err ?? '');
  try {
    // El SDK de @google/genai mete el cuerpo del error como JSON en `message`.
    const cuerpo = JSON.parse(bruto) as { error?: { message?: unknown } };
    const interno = cuerpo?.error?.message;
    return typeof interno === 'string' && interno.trim() === '';
  } catch {
    return bruto.trim() === '';
  }
}

/**
 * ¿Este error de Gemini justifica caer al proveedor de fallback (Groq)?
 *
 * SÍ: cuota agotada (429), errores del servidor (5xx), "servicio no configurado"
 * (503 — ej. GEMINI_API_KEY vacía), errores de red/timeout, y el 404 pelado de
 * arriba.
 *
 * NO: 400/401/403, el 404 con mensaje, y cualquier Error genérico sin status.
 * Un 400 es un request mal armado y un 404 con detalle un modelo mal
 * configurado: son bugs nuestros que hay que ver, no indisponibilidad.
 */
export function esErrorDeDisponibilidad(err: unknown): boolean {
  const status = statusDe(err);
  if (status !== undefined) return status === 429 || status >= 500 || es404Vacio(err, status);

  const code = (err as { code?: unknown })?.code;
  if (typeof code === 'string' && CODIGOS_DE_RED.has(code)) return true;

  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return msg.includes('fetch failed') || msg.includes('network') || msg.includes('socket hang up');
}
