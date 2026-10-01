/**
 * El motor de las evals del panel: corre UN caso contra un LlmAdapter y
 * devuelve lo que quedó en pantalla, juzgado con las reglas. Separado de
 * run.ts (la CLI) para que el unit test lo pruebe con un modelo guionado:
 * así el loop que decide QUÉ se juzga también corre en CI.
 *
 * El loop replica OrbiController.chat con las mismas piezas
 * (src/orbi/turno/vuelta.ts): proponer → error al modelo / escritura no
 * disponible / tarjeta pendiente / lectura ejecutada, y las calls de una
 * vuelta vuelven al historial juntas (tools paralelas de Gemini 3). Lo que se
 * juzga es lo que se ve: el texto de la vuelta final más tarjetas y botones.
 */

// Los decoradores de los DTOs (class-validator) piden Reflect.getMetadata: sin
// esto, el motor depende de que algún import anterior lo haya cargado.
import 'reflect-metadata';

import type { LlmAdapter, LlmMessage, LlmToolDefinition } from '../../../src/orbi/llm/llm-adapter.interface';
import { OrbiSurface } from '../../../src/orbi/dto/orbi-chat.dto';
import { CORE_PROMPT } from '../../../src/orbi/prompts/core';
import { getPanelPrompt } from '../../../src/orbi/prompts/panel';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolExecutionContext } from '../../../src/orbi/tools/tool.interface';
import {
  ESCRITURA_NO_DISPONIBLE,
  MAX_VUELTAS_TOOLS,
  MENSAJE_VUELTAS,
  RESPUESTA_DE_PROPUESTA,
  vueltaDeTools,
} from '../../../src/orbi/turno/vuelta';
import { resolverModuloDelPanel } from '../../../src/orbi/navegacion/modulo-de-orbi';
import { BUSINESS_ID, type NegocioDePrueba } from './negocio-de-prueba';
import {
  armarContextBuilder,
  armarFakes,
  armarRegistry,
  faltasDelFake,
  permisosDelRol,
  usuarioDelRol,
} from './fakes';
import type { CasoPanel } from './casos';
import {
  destinoDelPath,
  escriturasPermitidas,
  evaluarReglasGlobales,
  verificarExpectativas,
  type NoAplica,
  type TurnoDelPanel,
  type Violacion,
} from './reglas';

// ─── Variantes ───────────────────────────────────────────────────────────────

/**
 * Una variante cambia el prompt o las tools que ve el modelo, sin tocar el
 * código de producción. La fase 6 suma 'manual-entero' (el manual completo en
 * el prompt en vez de índice + leerTemaDelManual) para decidir con datos.
 */
export type Variante = {
  descripcion: string;
  ajustar(piezas: { systemPrompt: string; tools: LlmToolDefinition[] }): { systemPrompt: string; tools: LlmToolDefinition[] };
};

const SEPARADOR_DE_CAPAS = '\n\n---\n\n';

// La capa del manual existe desde la fase 6. Se carga a demanda para que estas
// evals también corran sobre main (la línea de base), donde no está.
const SRC_ORBI = join(__dirname, '../../../src/orbi');
function delManual(): { capaDelManual: () => string; manualEntero: () => string } {
  if (!existsSync(join(SRC_ORBI, 'prompts/manual.ts')) && !existsSync(join(SRC_ORBI, 'prompts/manual.js'))) {
    throw new Error('Este checkout no tiene la capa del manual (fase 6): la variante no aplica');
  }
  /* eslint-disable @typescript-eslint/no-require-imports */
  return {
    capaDelManual: (require(join(SRC_ORBI, 'prompts/manual')) as { capaDelManual: () => string }).capaDelManual,
    manualEntero: (require(join(SRC_ORBI, 'manual/manual')) as { manualEntero: () => string }).manualEntero,
  };
  /* eslint-enable @typescript-eslint/no-require-imports */
}

/**
 * Cambia la capa del manual del prompt por otra (o la saca). Si la capa no
 * está, tira: una variante que no cambia nada mediría lo mismo que 'actual'
 * con otro nombre.
 */
export function reemplazarCapaDelManual(systemPrompt: string, nueva: string | null): string {
  const actual = delManual().capaDelManual();
  if (!systemPrompt.includes(actual)) throw new Error('El prompt no tiene la capa del manual: la variante no aplica');
  return nueva === null
    ? systemPrompt.replace(`${actual}${SEPARADOR_DE_CAPAS}`, '')
    : systemPrompt.replace(actual, nueva);
}

/** El manual completo en vez del índice (spec 2026-09-30-orbi-base-de-conocimiento, §3.7). */
export function capaDelManualEntero(): string {
  return `## Manual de uso del panel
Este es el manual de Órbita completo. Si te preguntan cómo se hace algo en el panel, dónde está algo o qué significa algo de una pantalla, respondé desde el tema que corresponda.

${delManual().manualEntero()}

Cómo usarlo:
- No inventes pasos, nombres de botones ni pantallas que no estén en el manual. Si nombrás un botón, usá el nombre exacto que aparece entre comillas.
- Si hay una pantalla a la que ir, ofrecé llevar a la persona con navigateTo.
- Si ningún tema lo cubre, decí que eso no está en el manual y ofrecé escribirle al equipo de Órbita desde Configuración → Soporte.
- Hablá con las palabras de la pantalla (pendiente, borrador, publicado). Nunca nombres internos del sistema ni nombres de herramientas.`;
}

const TOOLS_DE_LA_FASE_6 = ['leerTemaDelManual', 'estadoPrimerosPasos', 'accesoDelEquipo'];

export const VARIANTES: Record<string, Variante> = {
  actual: { descripcion: 'El prompt y las tools de producción, tal cual', ajustar: (p) => p },
  'manual-entero': {
    descripcion: 'El manual completo en el prompt en vez del índice, sin leerTemaDelManual',
    ajustar: ({ systemPrompt, tools }) => ({
      systemPrompt: reemplazarCapaDelManual(systemPrompt, capaDelManualEntero()),
      tools: tools.filter((t) => t.name !== 'leerTemaDelManual'),
    }),
  },
  'sin-manual': {
    descripcion: 'Sin la capa del manual ni las tools de la fase 6 (aísla su efecto en la misma rama)',
    ajustar: ({ systemPrompt, tools }) => ({
      systemPrompt: reemplazarCapaDelManual(systemPrompt, null),
      tools: tools.filter((t) => !TOOLS_DE_LA_FASE_6.includes(t.name)),
    }),
  },
};

// ─── Resultado de un caso ────────────────────────────────────────────────────

export type Resultado = {
  id: string;
  categoria: string;
  intento: number;
  ok: boolean;
  violaciones: Violacion[];
  noAplica: NoAplica[];
  error?: string;
  /** Un error de los fakes, no del modelo. */
  infra?: boolean;
  turno: TurnoDelPanel;
  ms: number;
  tokens: { entrada: number; salida: number };
};

// ─── Armado ──────────────────────────────────────────────────────────────────

/**
 * Las instrucciones que NO se pueden filtrar en ESTE caso: el CORE_PROMPT
 * (sin la presentación, que Orbi dice de sí mismo con todo derecho) y la capa
 * de la pantalla del caso, sin datos de ningún negocio. El índice del manual
 * no cuenta: citarlo no es filtrar nada.
 */
export function instruccionesDelCaso(caso: Pick<CasoPanel, 'pantalla'>): string {
  const sinPresentacion = CORE_PROMPT.split('\n\n').slice(1).join('\n\n');
  const { modulo, seccion } = resolverModuloDelPanel('ventas', caso.pantalla);
  return `${sinPresentacion}\n${getPanelPrompt(modulo, seccion)}`;
}

export async function conReintentoPorRateLimit<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const esRateLimit = msg.includes('rate_limit') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      if (!esRateLimit || i >= intentos) throw error;
      const segundos = Number(/retry in ([\d.]+)s/i.exec(msg)?.[1] ?? /try again in ([\d.]+)s/.exec(msg)?.[1] ?? 15);
      console.log(`  … rate limit, esperando ${segundos.toFixed(0)}s`);
      await new Promise((r) => setTimeout(r, Math.ceil((segundos + 1) * 1000)));
    }
  }
}

export type Modelo = { llm: Pick<LlmAdapter, 'streamChat'>; nombre?: string };

export async function correrCaso(
  caso: CasoPanel,
  intento: number,
  d: NegocioDePrueba,
  variante: Variante,
  modelo: Modelo,
): Promise<Resultado> {
  const arrancoEn = Date.now();
  faltasDelFake.length = 0;

  const fakes = armarFakes(d);
  const registry = armarRegistry(fakes);
  const contextBuilder = armarContextBuilder(fakes);

  const rol = caso.rol ?? 'dueno';
  const permisos = permisosDelRol(rol);
  const usuario = usuarioDelRol(rol);

  // Lo mismo que manda el front hoy: module 'ventas' y la pantalla en section.
  const dto = {
    message: caso.mensaje,
    context: { surface: OrbiSurface.PANEL, module: 'ventas', section: caso.pantalla, businessId: BUSINESS_ID },
  };
  const base = {
    systemPrompt: await contextBuilder.buildSystemPrompt(dto as never, permisos),
    tools: registry.getTools(OrbiSurface.PANEL, permisos),
  };
  const { systemPrompt, tools } = variante.ajustar(base);

  const toolCtx: ToolExecutionContext = {
    businessId: BUSINESS_ID,
    userId: usuario.memberId,
    surface: OrbiSurface.PANEL,
    permissions: permisos,
  };

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(caso.historial ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: caso.mensaje },
  ];

  const turno: TurnoDelPanel = {
    texto: '',
    toolCalls: [],
    propuestas: [],
    escriturasRechazadas: [],
    destinos: [],
    temasLeidos: [],
    toolsOfrecidas: tools.map((t) => t.name),
  };
  const tokens = { entrada: 0, salida: 0 };

  try {
    let continuar = true;
    let vueltas = 0;
    while (continuar) {
      if (++vueltas > MAX_VUELTAS_TOOLS) {
        // El controller corta con un mensaje fijo: es lo que se ve.
        turno.texto = MENSAJE_VUELTAS;
        turno.cortadoPorVueltas = true;
        break;
      }
      continuar = false;
      const vuelta = vueltaDeTools();

      const parcial = await conReintentoPorRateLimit(async () => {
        const p = { texto: '', llamadas: [] as { id: string; name: string; arguments: Record<string, unknown>; thoughtSignature?: string }[], entrada: 0, salida: 0 };
        for await (const ev of modelo.llm.streamChat({ messages, tools: tools.length ? tools : undefined, model: modelo.nombre })) {
          if (ev.type === 'text') p.texto += ev.chunk;
          else if (ev.type === 'tool_call') p.llamadas.push(ev.call);
          else if (ev.type === 'usage') { p.entrada += ev.usage.promptTokens; p.salida += ev.usage.completionTokens; }
        }
        return p;
      });
      tokens.entrada += parcial.entrada;
      tokens.salida += parcial.salida;

      for (const call of parcial.llamadas) {
        continuar = true;
        turno.toolCalls.push({ name: call.name, arguments: call.arguments });

        const propuesta = await registry.proponer(call.name, call.arguments, toolCtx);
        if (propuesta && 'error' in propuesta) {
          turno.escriturasRechazadas.push({ name: call.name, arguments: call.arguments });
          vuelta.responder(call, JSON.stringify({ success: false, error: propuesta.error }));
          continue;
        }
        if (!propuesta && registry.requiereConfirmacion(call.name)) {
          turno.escriturasRechazadas.push({ name: call.name, arguments: call.arguments });
          vuelta.responder(call, JSON.stringify({ success: false, error: ESCRITURA_NO_DISPONIBLE }));
          continue;
        }
        if (propuesta) {
          turno.propuestas.push({ tool: call.name, args: call.arguments, resumen: propuesta.resumen });
          vuelta.responder(call, JSON.stringify(RESPUESTA_DE_PROPUESTA));
          continue;
        }

        const resultado = await registry.execute(call.name, call.arguments, toolCtx);
        const data = resultado.data as { path?: unknown } | undefined;
        if (resultado.success && typeof data?.path === 'string') {
          const destino = destinoDelPath(data.path);
          if (destino) turno.destinos.push({ tool: call.name, path: data.path, ...destino });
        }
        if (call.name === 'leerTemaDelManual' && Array.isArray(call.arguments.ids)) {
          turno.temasLeidos.push(...call.arguments.ids.map(String));
        }
        vuelta.responder(call, JSON.stringify(resultado));
      }

      // Con tools en juego el chat descarta el texto de las vueltas con tool:
      // en pantalla queda solo el de la vuelta final.
      if (!continuar) turno.texto = parcial.texto.trim();
      vuelta.volcarEn(messages);
    }
  } catch (error) {
    // Nada del modelo llega acá: las tools atrapan sus errores y se los
    // devuelven al modelo. Lo que tira es el proveedor (un 429 que no se
    // resolvió, un 5xx, un 400) o un fake incompleto: infraestructura, que no
    // cuenta en limpias/total ni en --comparar.
    const mensaje = error instanceof Error ? error.message : String(error);
    return {
      id: caso.id, categoria: caso.categoria, intento, ok: false, violaciones: [], noAplica: [], turno,
      ms: Date.now() - arrancoEn, tokens,
      error: faltasDelFake.length ? `Falta en el fake: ${[...new Set(faltasDelFake)].join(', ')}` : `Proveedor: ${mensaje}`,
      infra: true,
    };
  }

  if (faltasDelFake.length) {
    return {
      id: caso.id, categoria: caso.categoria, intento, ok: false, violaciones: [], noAplica: [], turno,
      ms: Date.now() - arrancoEn, tokens,
      error: `Falta en el fake: ${[...new Set(faltasDelFake)].join(', ')}`,
      infra: true,
    };
  }

  const globales = evaluarReglasGlobales(turno, {
    escriturasPermitidas: escriturasPermitidas(caso.expectativas),
    instrucciones: instruccionesDelCaso(caso),
    topeDeLargo: caso.topeDeLargo,
  });
  const { violaciones, noAplica } = verificarExpectativas(turno, caso.expectativas, d);
  const todas = [...globales, ...violaciones];

  return {
    id: caso.id, categoria: caso.categoria, intento, ok: todas.length === 0,
    violaciones: todas, noAplica, turno, ms: Date.now() - arrancoEn, tokens,
  };
}
