/**
 * El motor de las evals del panel: corre UN caso contra un LlmAdapter y
 * devuelve lo que quedó en pantalla, juzgado con las reglas. Separado de
 * run.ts (la CLI) para que el unit test lo pruebe con un modelo guionado:
 * así el loop que decide QUÉ se juzga también corre en CI.
 *
 * El loop es el de producción (src/orbi/turno/motor-de-turno.ts, el mismo que
 * corre OrbiController.chat), con un emisor que anota lo que se juzga en vez
 * de escribir SSE. Lo que se juzga es lo que se ve: el texto final más
 * tarjetas y botones.
 */

// Los decoradores de los DTOs (class-validator) piden Reflect.getMetadata: sin
// esto, el motor depende de que algún import anterior lo haya cargado.
import 'reflect-metadata';

import type { LlmAdapter, LlmEvent, LlmMessage, LlmToolDefinition } from '../../../src/orbi/llm/llm-adapter.interface';
import { OrbiSurface } from '../../../src/orbi/dto/orbi-chat.dto';
import { CORE_PROMPT } from '../../../src/orbi/prompts/core';
import { getPanelPrompt } from '../../../src/orbi/prompts/panel';
import { capaDeAlcance } from '../../../src/orbi/prompts/alcance';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolExecutionContext } from '../../../src/orbi/tools/tool.interface';
import { correrTurno, nuevoProgresoDelTurno, type EmisorDelTurno } from '../../../src/orbi/turno/motor-de-turno';
import { resolverModuloDelPanel } from '../../../src/orbi/navegacion/modulo-de-orbi';
import { BUSINESS_ID, type NegocioDePrueba } from './negocio-de-prueba';
import { costoTechoUsd } from './presupuesto';
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

/**
 * Saca la capa de alcance (prompts/alcance.ts). Si no está, tira: igual que
 * con el manual, una variante que no cambia nada mediría lo mismo que 'actual'.
 */
export function sacarCapaDeAlcance(systemPrompt: string): string {
  const capa = `${capaDeAlcance()}${SEPARADOR_DE_CAPAS}`;
  if (!systemPrompt.includes(capa)) throw new Error('El prompt no tiene la capa de alcance: la variante no aplica');
  return systemPrompt.replace(capa, '');
}

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
  'sin-alcance': {
    descripcion: 'Sin la capa de alcance (el prompt de antes del 2026-10-04): aísla su efecto en la misma rama',
    ajustar: ({ systemPrompt, tools }) => ({ systemPrompt: sacarCapaDeAlcance(systemPrompt), tools }),
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
  // Lo que sigue es desde 2026-10-07: las corridas guardadas antes no lo traen.
  // Va fuera de `tokens` a propósito: los turnos grabados
  // (orbi-turno-grabado.unit-spec.ts) comparan `tokens` tal cual.
  /** Techo de lo que costó: precio de lista sin descuento de caché (presupuesto.ts). */
  costoUsd?: number;
  /** Llamadas al modelo del caso. */
  llamadas?: number;
  /** De `tokens.entrada`, cuántos salieron de la caché del proveedor (lo real, no se descuenta del costo). */
  cachedTokens?: number;
  /** De `tokens.salida`, cuántos fueron pensamiento. */
  thinkingTokens?: number;
};

// ─── Armado ──────────────────────────────────────────────────────────────────

/**
 * Las instrucciones que NO se pueden filtrar en ESTE caso: el CORE_PROMPT
 * (sin la presentación, que Orbi dice de sí mismo con todo derecho) y la capa
 * de la pantalla del caso, sin datos de ningún negocio. El índice del manual
 * no cuenta: citarlo no es filtrar nada. La capa de alcance tampoco: decir de
 * qué habla Orbi no es filtrar nada, y la frase fija de fuera de alcance
 * (17 palabras) se dice tal cual a propósito.
 */
export function instruccionesDelCaso(caso: Pick<CasoPanel, 'pantalla'>): string {
  const sinPresentacion = CORE_PROMPT.split('\n\n').slice(1).join('\n\n');
  const { modulo, seccion } = resolverModuloDelPanel('ventas', caso.pantalla);
  return `${sinPresentacion}\n${getPanelPrompt(modulo, seccion)}`;
}

/**
 * Los números de pedido que la regla sin-pedidos-inventados da por buenos:
 * los que la persona nombró en la charla, y los que existen en el negocio de
 * prueba (solo se usan si el turno no guardó lo que devolvieron las tools: las
 * corridas anteriores a 2026-10-01 no lo guardaban).
 */
export function pedidosConocidos(
  caso: Pick<CasoPanel, 'mensaje' | 'historial'>,
  d: Pick<NegocioDePrueba, 'pedidos'>,
): { dichos: number[]; existentes: number[] } {
  const dichos = [caso.mensaje, ...(caso.historial ?? []).map((m) => m.content)].flatMap((t) => (t.match(/\d{3,6}/g) ?? []).map(Number));
  return { dichos, existentes: d.pedidos.map((p) => p.numero) };
}

/**
 * El modelo, con reintento ante rate limit. Solo se reintenta si la vuelta
 * falló ANTES de devolver algo: con eventos ya entregados (una tool ya
 * ejecutada), repetirla duplicaría el turno.
 */
export function conReintentoPorRateLimit(llm: Pick<LlmAdapter, 'streamChat'>, intentos = 3): Pick<LlmAdapter, 'streamChat'> {
  return {
    async *streamChat(params): AsyncGenerator<LlmEvent> {
      for (let i = 1; ; i++) {
        let entrego = false;
        try {
          for await (const ev of llm.streamChat(params)) {
            entrego = true;
            yield ev;
          }
          return;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const esRateLimit = msg.includes('rate_limit') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
          if (entrego || !esRateLimit || i >= intentos) throw error;
          const segundos = Number(/retry in ([\d.]+)s/i.exec(msg)?.[1] ?? /try again in ([\d.]+)s/.exec(msg)?.[1] ?? 15);
          console.log(`  … rate limit, esperando ${segundos.toFixed(0)}s`);
          await new Promise((r) => setTimeout(r, Math.ceil((segundos + 1) * 1000)));
        }
      }
    },
  };
}

export type Modelo = { llm: Pick<LlmAdapter, 'streamChat'>; nombre?: string };

export async function correrCaso(
  caso: CasoPanel,
  intento: number,
  d: NegocioDePrueba,
  variante: Variante,
  modelo: Modelo,
): Promise<Resultado> {
  const arrancoEn = new Date();
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

  // `roleName` es de la rama (estadoPrimerosPasos lo usa); con el `as` esto
  // también compila sobre main, donde el contexto no lo tiene (línea de base).
  const toolCtx = {
    businessId: BUSINESS_ID,
    userId: usuario.memberId,
    surface: OrbiSurface.PANEL,
    permissions: permisos,
    roleName: usuario.roleName,
  } as ToolExecutionContext;

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
    numerosDeTools: [],
    toolsOfrecidas: tools.map((t) => t.name),
  };
  const tokens = () => {
    const t = { entrada: 0, salida: 0 };
    for (const c of progreso.consumo.values()) {
      t.entrada += c.promptTokens;
      t.salida += c.completionTokens;
    }
    return t;
  };
  // Lo que costó, aunque el caso termine en error: lo consumido se paga igual.
  const gasto = () => {
    let cachedTokens = 0;
    let thinkingTokens = 0;
    for (const c of progreso.consumo.values()) {
      cachedTokens += c.cachedTokens;
      thinkingTokens += c.thinkingTokens;
    }
    return {
      costoUsd: costoTechoUsd(progreso.consumo, arrancoEn) + costoTechoUsd(progreso.consumoDeTools, arrancoEn),
      llamadas: progreso.llamadasAlModelo,
      cachedTokens,
      thinkingTokens,
    };
  };

  // Lo que se ve: el emisor anota tarjetas, botones y el texto final, en el
  // mismo orden en que el controller los escribe por SSE.
  let enPantalla = '';
  const emisor: EmisorDelTurno = {
    toolPedida: ({ call }) => { turno.toolCalls.push({ name: call.name, arguments: call.arguments }); },
    texto: (chunk) => { enPantalla += chunk; },
    reiniciarTexto: () => { enPantalla = ''; },
    escrituraRechazada: ({ call }) => { turno.escriturasRechazadas.push({ name: call.name, arguments: call.arguments }); },
    propuesta: ({ call, resumen }) => { turno.propuestas.push({ tool: call.name, args: call.arguments, resumen }); },
    lecturaInicio: () => undefined,
    lecturaFin: ({ call, resultado }) => {
      const data = resultado.data as { path?: unknown } | undefined;
      if (resultado.success && typeof data?.path === 'string') {
        const destino = destinoDelPath(data.path);
        if (destino) turno.destinos.push({ tool: call.name, path: data.path, ...destino });
      }
      if (call.name === 'leerTemaDelManual' && Array.isArray(call.arguments.ids)) {
        turno.temasLeidos.push(...call.arguments.ids.map(String));
      }
      turno.numerosDeTools!.push(...(JSON.stringify(resultado).match(/\d{3,6}/g) ?? []).map(Number));
    },
    fin: () => undefined,
  };
  const progreso = nuevoProgresoDelTurno();

  try {
    await correrTurno({
      llm: conReintentoPorRateLimit(modelo.llm),
      registry,
      messages,
      tools,
      modelo: modelo.nombre,
      toolCtx,
      soloLectura: false,
      crearPendiente: async () => 'accion-de-la-eval',
      emisor,
      progreso,
    });
    turno.texto = enPantalla.trim();
    if (progreso.estado === 'max_rounds') turno.cortadoPorVueltas = true;
  } catch (error) {
    // Nada del modelo llega acá: las tools atrapan sus errores y se los
    // devuelven al modelo. Lo que tira es el proveedor (un 429 que no se
    // resolvió, un 5xx, un 400) o un fake incompleto: infraestructura, que no
    // cuenta en limpias/total ni en --comparar.
    const mensaje = error instanceof Error ? error.message : String(error);
    return {
      id: caso.id, categoria: caso.categoria, intento, ok: false, violaciones: [], noAplica: [], turno,
      ms: Date.now() - arrancoEn.getTime(), tokens: tokens(), ...gasto(),
      error: faltasDelFake.length ? `Falta en el fake: ${[...new Set(faltasDelFake)].join(', ')}` : `Proveedor: ${mensaje}`,
      infra: true,
    };
  }

  if (faltasDelFake.length) {
    return {
      id: caso.id, categoria: caso.categoria, intento, ok: false, violaciones: [], noAplica: [], turno,
      ms: Date.now() - arrancoEn.getTime(), tokens: tokens(), ...gasto(),
      error: `Falta en el fake: ${[...new Set(faltasDelFake)].join(', ')}`,
      infra: true,
    };
  }

  const globales = evaluarReglasGlobales(turno, {
    escriturasPermitidas: escriturasPermitidas(caso.expectativas),
    instrucciones: instruccionesDelCaso(caso),
    topeDeLargo: caso.topeDeLargo,
    pedidosConocidos: pedidosConocidos(caso, d),
  });
  const { violaciones, noAplica } = verificarExpectativas(turno, caso.expectativas, d);
  const todas = [...globales, ...violaciones];

  return {
    id: caso.id, categoria: caso.categoria, intento, ok: todas.length === 0,
    violaciones: todas, noAplica, turno, ms: Date.now() - arrancoEn.getTime(), tokens: tokens(), ...gasto(),
  };
}
