import type { ConfigService } from '@nestjs/config';

// Cómo escribe un bot en un chat para que se lea como una persona: en vez de un párrafo largo, dos o tres mensajes
// cortos seguidos, con el "escribiendo…" entre uno y otro. Lo usan Orbi (atención de las tiendas, WhatsApp e Instagram)
// y el bot de ventas de Órbita en Instagram.
//
// El modelo separa las partes con una línea en blanco (así se le pide en el prompt) y acá se cortan. Lo que va separado
// por un solo salto de línea (una lista de productos, un resumen) queda junto en el mismo mensaje.

/** Hasta cuántos mensajes se manda una respuesta: más ya se siente como bombardeo. */
export const MAX_BLOQUES = 3;

/** Parte una respuesta en mensajes por las líneas en blanco. Si quedan más de `max`, lo que sobra va en el último. */
export function partirEnBloques(texto: string, max = MAX_BLOQUES): string[] {
  const partes = texto
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length <= max) return partes;
  return [...partes.slice(0, max - 1), partes.slice(max - 1).join('\n')];
}

/**
 * Cuánto se espera con el "escribiendo…" antes de mandar un mensaje: más largo, más espera, con tope para no demorar la
 * charla (todo corre dentro del pedido del webhook). `ORBI_PAUSA_BLOQUES_MS` fija un valor (0 la apaga: los tests).
 */
export function pausaDeEscritura(texto: string, config: Pick<ConfigService, 'get'>): number {
  const fija = config.get<string>('ORBI_PAUSA_BLOQUES_MS');
  if (fija !== undefined && fija !== null && fija !== '') {
    const n = Number(fija);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return Math.min(2200, 500 + texto.length * 18);
}

export const dormir = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());
