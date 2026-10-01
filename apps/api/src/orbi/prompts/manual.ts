/**
 * Capa del manual (spec 2026-09-30-orbi-base-de-conocimiento, §3.3). Solo en el
 * panel, entre CORE_PROMPT y la capa del panel.
 *
 * Va ANTES de todo lo que depende del negocio (el nombre, el rubro, el
 * snapshot): así el comienzo del prompt es idéntico para todos los negocios y
 * la caché implícita de Gemini lo puede reusar. Si se mueve después de la capa
 * del panel, cada negocio paga su propio prefijo.
 *
 * Es el índice (un renglón por tema), no el manual: el texto de cada tema lo
 * pide el modelo con leerTemaDelManual. La alternativa (el manual entero acá)
 * es una variante de las evals, no de producción, hasta que las evals decidan.
 */

import { indiceDelManual } from '../manual/manual';

export function capaDelManual(): string {
  return `## Manual de uso del panel
Tenés el manual de Órbita. Este es su índice (id · título), por capítulo:

${indiceDelManual()}

Cómo usarlo:
- Si te preguntan cómo se hace algo en el panel, dónde está algo o qué significa algo de una pantalla, leé el tema con leerTemaDelManual (hasta 3 ids) ANTES de responder, y respondé desde lo que dice. Esa herramienta ya le muestra a la persona el botón para ir a la pantalla: no hace falta que además navegues.
- No inventes pasos, nombres de botones ni pantallas que no estén en el tema. Si nombrás un botón, usá el nombre exacto que aparece entre comillas en el tema.
- Si ningún tema lo cubre, decí que eso no está en el manual y ofrecé escribirle al equipo de Órbita desde Configuración → Soporte.
- Hablá con las palabras de la pantalla (pendiente, borrador, publicado). Nunca nombres internos del sistema ni nombres de herramientas.`;
}
