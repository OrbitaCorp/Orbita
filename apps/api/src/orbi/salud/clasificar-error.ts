/**
 * Qué falló cuando una llamada de Orbi tira: lo que decide si se apaga Orbi
 * para todos o solo se le avisa a la persona que probó de nuevo.
 *
 * Hasta ahora todo terminaba en "Error procesando tu mensaje": un saldo agotado
 * (402), una key inválida (401/403), un modelo que Google dio de baja (404) y un
 * hipo de red se veían igual, y nadie se enteraba de ninguno.
 *
 * Las categorías con `inmediata: true` no se arreglan solas ni con reintentos:
 * mientras duren, TODA llamada va a fallar igual. Esas apagan Orbi en la primera.
 * Las demás (caídas, cuota por minuto, errores nuestros) solo cuentan para el
 * umbral de falla sostenida.
 */

export type CategoriaDeFalla =
  | 'PROVIDER_CREDITS' // 402: saldo prepago agotado
  | 'PROVIDER_AUTH' // 401 / 403: key inválida, revocada o sin permiso
  | 'MODEL_NOT_FOUND' // 404: el modelo ya no existe
  | 'PROVIDER_QUOTA' // 429: límite por minuto o por día
  | 'PROVIDER_DOWN' // 5xx, timeouts y errores de red
  | 'REQUEST_INVALID' // 400: algo que mandamos mal (o un contexto que el modelo rechaza)
  | 'INTERNAL'; // cualquier otra cosa: un bug o la base, no el proveedor

export interface FallaClasificada {
  categoria: CategoriaDeFalla;
  httpStatus?: number;
  /** Apaga Orbi en la primera: no se arregla sola. */
  inmediata: boolean;
  /** Texto corto y sin datos de personas ni claves, para el log y el mail. */
  detalle: string;
}

const MAX_DETALLE = 240;

/** Lo que viaja a la persona según cómo falló. Nunca el error crudo del proveedor. */
export const MENSAJE_FALLA_PASAJERA = 'Orbi tuvo un problema para responder. Probá de nuevo en unos minutos.';
export const MENSAJE_MANTENIMIENTO_PANEL =
  'Orbi está en mantenimiento por un problema técnico. Ya avisamos al equipo. Mientras tanto, el Manual del panel sigue disponible.';
/** En el alta de negocios no existe "el Manual del panel": se puede seguir sin Orbi. */
export const MENSAJE_MANTENIMIENTO_WIZARD =
  'Orbi está en mantenimiento por un problema técnico. Ya avisamos al equipo. Podés seguir completando los pasos sin su ayuda.';

const CODIGOS_DE_RED = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT',
]);

/** Saca claves y recorta: el mensaje de Google puede traer fragmentos de la request. */
export function sanitizarDetalle(texto: string): string {
  return texto
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[clave]')
    .replace(/\bAQ\.[0-9A-Za-z_-]{20,}/g, '[clave]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DETALLE);
}

function mensajeDe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * El SDK de Gemini tira el cuerpo de la respuesta como mensaje: un JSON dentro
 * de un JSON (`{"error":{"message":"{\n \"error\": {\"code\": 402, ...}}"}}`).
 * Se baja hasta el mensaje legible, y se busca el código en cualquier nivel.
 */
function desenvolver(mensaje: string): { texto: string; codigo?: number } {
  let texto = mensaje;
  let codigo: number | undefined;
  for (let i = 0; i < 3; i++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(texto);
    } catch {
      break;
    }
    const err = (parsed as { error?: { message?: unknown; code?: unknown } } | null)?.error;
    if (!err) break;
    if (typeof err.code === 'number' && codigo === undefined) codigo = err.code;
    if (typeof err.message !== 'string') break;
    texto = err.message;
  }
  if (codigo === undefined) {
    const m = /"?code\\?"?\s*:\s*(\d{3})/.exec(mensaje);
    if (m) codigo = Number(m[1]);
  }
  return { texto, codigo };
}

function statusDe(error: unknown, codigoDelCuerpo?: number): number | undefined {
  const e = error as { status?: unknown; code?: unknown; statusCode?: unknown } | null;
  for (const v of [e?.status, e?.statusCode, e?.code]) {
    if (typeof v === 'number' && v >= 100 && v < 600) return v;
  }
  return codigoDelCuerpo;
}

function esDeRed(error: unknown, texto: string): boolean {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const codigos = [e?.code, e?.cause?.code].filter((c): c is string => typeof c === 'string');
  if (codigos.some((c) => CODIGOS_DE_RED.has(c))) return true;
  return /fetch failed|network error|socket hang up|timed? ?out|deadline[_ ]exceeded|UNAVAILABLE/i.test(texto);
}

export function clasificarError(error: unknown): FallaClasificada {
  const crudo = mensajeDe(error);
  const { texto, codigo } = desenvolver(crudo);
  const httpStatus = statusDe(error, codigo);
  const detalle = sanitizarDetalle(texto || crudo);

  const falla = (categoria: CategoriaDeFalla, inmediata = false): FallaClasificada => ({
    categoria,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    inmediata,
    detalle,
  });

  // Sin key configurada: el servidor la pide pero no hay (Secret Manager mal montado). No se arregla solo.
  if (/GEMINI_API_KEY no configurada/i.test(texto)) return falla('PROVIDER_AUTH', true);
  if (httpStatus === 402 || /prepayment credits|credits are depleted|payment required/i.test(texto)) return falla('PROVIDER_CREDITS', true);
  if (httpStatus === 401 || httpStatus === 403 || /API[_ ]KEY[_ ]INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(texto)) {
    return falla('PROVIDER_AUTH', true);
  }
  // Un 404 con el mensaje VACÍO no es "el modelo no existe": es el frontend de Google escupiendo durante
  // un pico de demanda (ver llm-errors.ts). Solo un 404 CON texto de modelo es un modelo mal configurado.
  if (httpStatus === 404 && texto.trim() === '') return falla('PROVIDER_DOWN');
  if (httpStatus === 404 && /model|models\//i.test(texto)) return falla('MODEL_NOT_FOUND', true);
  if (httpStatus === 429 || /RESOURCE_EXHAUSTED/i.test(texto)) return falla('PROVIDER_QUOTA');
  if ((httpStatus !== undefined && httpStatus >= 500) || esDeRed(error, texto)) return falla('PROVIDER_DOWN');
  if (httpStatus === 400) return falla('REQUEST_INVALID');
  return falla('INTERNAL');
}

/** Cómo se le cuenta a la persona (nunca el detalle crudo del proveedor). */
export function codigoParaElFront(categoria: CategoriaDeFalla): 'ORBI_PROVIDER_DOWN' | 'ORBI_ERROR' {
  return categoria === 'INTERNAL' || categoria === 'REQUEST_INVALID' ? 'ORBI_ERROR' : 'ORBI_PROVIDER_DOWN';
}
