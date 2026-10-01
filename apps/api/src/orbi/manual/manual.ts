import { MANUAL_GENERADO } from './manual.generated';
import type { DestinoDelManual, ManualGenerado, PasoDelManual, TemaDelManual } from './manual.types';
import { rutaDelPanel } from '../navegacion/ruta';

// El manual del panel adentro de la API (spec 2026-09-30-orbi-base-de-conocimiento).
// La fuente es apps/web (manual/contenido.ts): acá llega como artefacto generado
// y commiteado, porque la imagen de la API se construye solo con apps/api.

export const MANUAL: ManualGenerado = MANUAL_GENERADO;

const TEMAS_POR_ID = new Map(MANUAL.temas.map((t) => [t.id, t]));
const PASOS_POR_ID = new Map(MANUAL.primerosPasos.map((p) => [p.id, p]));

/** Un tema por id. `id` viene del modelo: Map y no un objeto, así '__proto__' no resuelve a nada. */
export function temaDelManual(id: string): TemaDelManual | undefined {
  return TEMAS_POR_ID.get(id);
}

export function pasoDelManual(id: string): PasoDelManual | undefined {
  return PASOS_POR_ID.get(id);
}

/** La ruta del botón "Ir a…" de un destino del manual (mismo constructor que navigateTo). */
export function rutaDeDestino(d: DestinoDelManual): string {
  return rutaDelPanel(d.seccion, d.vista);
}

/**
 * El índice que va en el prompt: un renglón por tema, `id · título`, agrupado
 * por capítulo. Es lo único del manual que el modelo ve siempre; el texto de
 * cada tema lo pide con leerTemaDelManual.
 */
export function indiceDelManual(): string {
  const capitulos: string[] = [];
  const porCapitulo = new Map<string, TemaDelManual[]>();
  for (const t of MANUAL.temas) {
    if (!porCapitulo.has(t.capitulo)) {
      porCapitulo.set(t.capitulo, []);
      capitulos.push(t.capitulo);
    }
    porCapitulo.get(t.capitulo)!.push(t);
  }
  return capitulos
    .map((c) => [`${c}:`, ...porCapitulo.get(c)!.map((t) => `- ${t.id} · ${t.titulo}${t.pista ? ` (${t.pista})` : ''}`)].join('\n'))
    .join('\n');
}

/**
 * El manual completo como texto. NO lo usa producción: es la variante
 * "manual entero en el prompt" de las evals, para comparar con índice + tool
 * antes de decidir (spec §3.7).
 */
export function manualEntero(): string {
  return MANUAL.temas
    .map((t) => `### ${t.capitulo} — ${t.titulo} (${t.id})\n${t.texto}${t.destino ? `\n[Botón: ${t.destino.label}]` : ''}`)
    .join('\n\n');
}
