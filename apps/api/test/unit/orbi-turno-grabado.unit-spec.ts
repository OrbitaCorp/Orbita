/**
 * Turnos grabados: el loop de un turno del panel no cambia sin querer.
 *
 * Reproduce, con un modelo guionado, las respuestas reales de Gemini que
 * guardaron las evals del 2026-10-01 (qué tools pidió, con qué argumentos, y
 * qué contestó al final) y las pasa por los DOS consumidores del loop: el
 * controller (lo que viaja por SSE, lo que se guarda y lo que se mide) y el
 * motor de las evals (lo que se juzga). Cada salida se resume en una huella y
 * se compara con la grabada en `__grabado__/orbi-turno.json`.
 *
 * Sirve para refactors del loop (fase 3, R1: el motor de turno compartido):
 * una eval con el modelo real y 3 repeticiones no distingue un cambio de
 * comportamiento del azar del modelo; esto sí, y no cuesta nada.
 *
 * Si un cambio de comportamiento es A PROPÓSITO, se vuelve a grabar con
 *   ORBI_REGRABAR_TURNOS=1 pnpm exec jest --config ./test/jest-unit.json orbi-turno-grabado
 * y el diff del JSON va en el mismo commit que el cambio.
 */
import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { OrbiController } from '../../src/orbi/orbi.controller';
import { OrbiSurface } from '../../src/orbi/dto/orbi-chat.dto';
import type { LlmEvent, LlmMessage } from '../../src/orbi/llm/llm-adapter.interface';
import { CASOS_PANEL, type CasoPanel } from '../evals/panel/casos';
import { VARIANTES, correrCaso } from '../evals/panel/motor';
import { armarContextBuilder, armarFakes, armarRegistry, usuarioDelRol } from '../evals/panel/fakes';
import { BUSINESS_ID, crearNegocioDePrueba, type NegocioDePrueba } from '../evals/panel/negocio-de-prueba';

const EVALS = join(__dirname, '../../../../docs/superpowers/evals/2026-10-01');
const CORRIDAS = ['base.json', 'rama.json'];
const GRABADO = join(__dirname, '__grabado__/orbi-turno.json');
const REGRABAR = process.env.ORBI_REGRABAR_TURNOS === '1';

type Llamada = { name: string; arguments: Record<string, unknown> };
type Grabado = { id: string; intento: number; corrida: string; toolCalls: Llamada[]; texto: string };
type Forma = 'secuencial' | 'paralelo' | 'demo';

// ─── El guion ────────────────────────────────────────────────────────────────

/**
 * secuencial: una tool por vuelta, cada una con un preámbulo ("Voy a…") que
 * la persona no tiene que ver. paralelo: de a dos tools por vuelta (Gemini 3).
 * demo: como secuencial, con el visitante de la demo pública (solo lectura).
 */
function guion(g: Grabado, forma: Forma): LlmEvent[][] {
  const tamanio = forma === 'paralelo' ? 2 : 1;
  const vueltas: LlmEvent[][] = [];
  for (let i = 0; i < g.toolCalls.length; i += tamanio) {
    const grupo = g.toolCalls.slice(i, i + tamanio);
    vueltas.push([
      { type: 'text', chunk: 'Voy a revisar eso. ' },
      ...grupo.map((c, j): LlmEvent => ({
        type: 'tool_call',
        call: { id: `call-${i + j}`, name: c.name, arguments: c.arguments, thoughtSignature: j === 0 ? `firma-${i}` : undefined },
      })),
      { type: 'usage', usage: { model: 'gemini-guion', promptTokens: 100 + i, completionTokens: 7, provider: 'gemini' } },
      { type: 'done' },
    ]);
  }
  const tercio = Math.ceil(g.texto.length / 3) || 1;
  const trozos = g.texto.match(new RegExp(`[\\s\\S]{1,${tercio}}`, 'g')) ?? [];
  vueltas.push([
    ...trozos.map((chunk): LlmEvent => ({ type: 'text', chunk })),
    { type: 'usage', usage: { model: 'gemini-guion', promptTokens: 300, completionTokens: 40, provider: 'gemini' } },
    { type: 'done' },
  ]);
  return vueltas;
}

function modeloGuionado(vueltas: LlmEvent[][]) {
  const recibidos: LlmMessage[][] = [];
  let i = 0;
  return {
    recibidos,
    async *streamChat(p: { messages: LlmMessage[] }): AsyncGenerator<LlmEvent> {
      recibidos.push(JSON.parse(JSON.stringify(p.messages)));
      for (const ev of vueltas[i++] ?? [{ type: 'done' as const }]) yield ev;
    },
  };
}

// ─── Huella ──────────────────────────────────────────────────────────────────

function ordenado(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenado);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenado((v as Record<string, unknown>)[k])]));
  }
  return v;
}

/** Los ids al azar (pasos del stream) se numeran por orden de aparición. */
function sinAzar(texto: string): string {
  const vistos = new Map<string, string>();
  return texto.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (u) => {
    if (!vistos.has(u)) vistos.set(u, `uuid-${vistos.size + 1}`);
    return vistos.get(u)!;
  });
}

const huella = (v: unknown) => createHash('sha256').update(sinAzar(JSON.stringify(ordenado(v)))).digest('hex').slice(0, 20);

// ─── Los dos consumidores del loop ───────────────────────────────────────────

async function porElController(caso: CasoPanel, g: Grabado, forma: Forma, d: NegocioDePrueba) {
  const fakes = armarFakes(d);
  const llm = modeloGuionado(guion(g, forma));
  const guardados: unknown[] = [];
  const pendientes: unknown[] = [];
  const turnos: unknown[] = [];
  const medidos: unknown[] = [];
  let n = 0;
  const controller = new OrbiController(
    llm as never,
    { get: () => undefined } as never,
    {
      historialSiEsPropia: async () => (caso.historial ?? []).map((m) => ({ role: m.role, content: m.content, timestamp: 'x' })),
      crear: async () => ({ id: 'conv-nueva' }),
      appendMessage: async (_c: string, _b: string, _m: string, msg: { role: string; content: string }) => { guardados.push({ role: msg.role, content: msg.content }); },
    } as never,
    armarContextBuilder(fakes),
    armarRegistry(fakes),
    {} as never,
    { crear: async (a: Record<string, unknown>) => { pendientes.push(a); return `accion-${++n}`; } } as never,
    { track: (t: unknown) => { medidos.push(t); } } as never,
    { consumir: async () => true } as never,
    { registrar: (t: Record<string, unknown>) => { turnos.push({ ...t, latencyMs: undefined }); } } as never,
    {
      exigirDisponible: async () => undefined,
      registrarOk: async () => undefined,
      avisoDeFalla: async () => ({ code: 'ORBI_ERROR', message: 'falla' }),
    } as never,
  );
  const chunks: string[] = [];
  const res = {
    writableEnded: false,
    setHeader: () => undefined,
    flushHeaders: () => undefined,
    write: (s: string) => { chunks.push(s); },
    end: () => { res.writableEnded = true; },
    on: () => res,
  };
  const usuario = usuarioDelRol(caso.rol ?? 'dueno');
  await controller.chat(
    {
      message: caso.mensaje,
      conversationId: 'conv-1',
      context: { surface: OrbiSurface.PANEL, module: 'ventas', section: caso.pantalla, businessId: 'otro' },
    } as never,
    res as never,
    { type: 'member', businessId: BUSINESS_ID, ...usuario, readOnly: forma === 'demo' } as never,
  );
  return { sse: chunks.join(''), guardados, pendientes, turnos, medidos, alModelo: llm.recibidos };
}

async function porLasEvals(caso: CasoPanel, g: Grabado, forma: Forma, d: NegocioDePrueba) {
  const llm = modeloGuionado(guion(g, forma));
  const r = await correrCaso(caso, 1, d, VARIANTES.actual, { llm });
  return { ok: r.ok, violaciones: r.violaciones, noAplica: r.noAplica, error: r.error, turno: r.turno, tokens: r.tokens, alModelo: llm.recibidos };
}

// ─── El test ─────────────────────────────────────────────────────────────────

const SOLO_FECHA = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] as const;

describe('turnos grabados: el loop del panel hace lo mismo que el 2026-10-01', () => {
  const corridas = CORRIDAS.map((archivo) => ({ archivo, ...(JSON.parse(readFileSync(join(EVALS, archivo), 'utf8')) as { ahora: string; resultados: (Grabado & { turno: Grabado })[] }) }));
  const ahora = new Date(corridas[0].ahora);
  const casos = new Map(CASOS_PANEL.map((c) => [c.id, c]));

  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: [...SOLO_FECHA], now: ahora });
    // El controller avisa por log cuando corta por vueltas: ruido acá.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterAll(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('cada turno grabado da la misma salida por el controller y por las evals', async () => {
    const d = crearNegocioDePrueba(ahora);
    const actual: Record<string, string> = {};
    const primeraSalida: Record<string, unknown> = {};

    for (const corrida of corridas) {
      if (corrida.ahora !== corridas[0].ahora) throw new Error('Las corridas grabadas tienen que compartir el "ahora"');
      for (const [i, r] of corrida.resultados.entries()) {
        const caso = casos.get(r.id);
        if (!caso || !r.turno) continue;
        const g: Grabado = { id: r.id, intento: r.intento, corrida: corrida.archivo, toolCalls: r.turno.toolCalls ?? [], texto: r.turno.texto ?? '' };
        const formas: Forma[] = i % 5 === 0 ? ['secuencial', 'paralelo', 'demo'] : ['secuencial', 'paralelo'];
        for (const forma of formas) {
          const clave = `${corrida.archivo}#${r.id}#${r.intento}#${forma}`;
          const controller = await porElController(caso, g, forma, d);
          const evals = forma === 'demo' ? null : await porLasEvals(caso, g, forma, d);
          actual[`${clave}#controller`] = huella(controller);
          if (evals) actual[`${clave}#evals`] = huella(evals);
          primeraSalida[`${clave}#controller`] = controller;
          if (evals) primeraSalida[`${clave}#evals`] = evals;
        }
      }
    }

    if (REGRABAR) {
      writeFileSync(GRABADO, `${JSON.stringify(actual, null, 1)}\n`);
      return;
    }
    if (!existsSync(GRABADO)) throw new Error(`Falta ${GRABADO}: grabalo con ORBI_REGRABAR_TURNOS=1 sobre el código de antes del cambio`);

    const grabado = JSON.parse(readFileSync(GRABADO, 'utf8')) as Record<string, string>;
    const distintas = Object.keys({ ...grabado, ...actual }).filter((k) => grabado[k] !== actual[k]);
    if (distintas.length) {
      const primera = distintas[0];
      throw new Error(
        `${distintas.length} de ${Object.keys(grabado).length} turnos cambiaron. El primero: ${primera}\n` +
        `Salida actual:\n${sinAzar(JSON.stringify(ordenado(primeraSalida[primera]), null, 1)).slice(0, 6000)}`,
      );
    }
    expect(Object.keys(actual).length).toBeGreaterThan(1000);
  }, 600_000);
});
