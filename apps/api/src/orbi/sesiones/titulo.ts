// Títulos de las sesiones de Orbi (spec fase 3, §3.4 y §8). Salen del texto de
// la persona y se muestran en una lista: en una línea, sin caracteres de
// control ni de formato (un override bidi daría vuelta cómo se ve el resto de
// la fila, uno de ancho cero escondería texto) y acotados.

const LARGO_AUTOMATICO = 60;
export const LARGO_MAXIMO_DEL_TITULO = 80;

/** En una línea y sin invisibles, con el mismo criterio que la tarjeta de confirmación (tools/acciones/formato.ts), sin tocar las comillas. */
export function tituloLimpio(texto: string): string {
  return texto
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * El título que se pone solo: el primer mensaje de la persona, cortado a 60
 * caracteres en el último espacio (si queda algo razonable) y con "…" si se
 * cortó. Determinista y sin modelo: no cuesta una llamada ni suma una falla.
 */
export function tituloAutomatico(primerMensaje: string): string | null {
  const limpio = tituloLimpio(primerMensaje);
  if (!limpio) return null;
  const letras = Array.from(limpio);
  if (letras.length <= LARGO_AUTOMATICO) return limpio;
  // Lugar para el "…": el total no pasa de 60.
  const corte = letras.slice(0, LARGO_AUTOMATICO - 1).join('');
  const palabraEntera = letras[LARGO_AUTOMATICO - 1] === ' ';
  const espacio = corte.lastIndexOf(' ');
  const base = palabraEntera || espacio < LARGO_AUTOMATICO / 2 ? corte : corte.slice(0, espacio);
  return `${base.replace(/[\s.,;:]+$/u, '')}…`;
}
