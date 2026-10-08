// El tope de gasto de las evals del panel (test/evals/panel/presupuesto.ts):
// las evals corren con una key aparte con plata contada, y el freno tiene que
// cortar ANTES de pasarse. Todo offline: ni el adapter de verdad ni la red.
//
// Si esto falla, una corrida puede gastar más de lo que el dueño autorizó.

import 'reflect-metadata';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// El adapter de verdad no se construye nunca en este archivo: si algo lo
// intenta, el mock lo anota y el test lo ve.
jest.mock('../../src/orbi/llm/gemini.adapter', () => ({
  GeminiAdapter: jest.fn(() => {
    throw new Error('El test construyó el GeminiAdapter de verdad');
  }),
}));

import { GeminiAdapter } from '../../src/orbi/llm/gemini.adapter';
import { costoDeConsumoUsd } from '../../src/platform/costs/precios';
import type { ConsumoPorProveedor } from '../../src/orbi/turno/motor-de-turno';
import type { LlmEvent } from '../../src/orbi/llm/llm-adapter.interface';
import {
  COSTO_POR_CASO_POR_DEFECTO_USD,
  correrConTope,
  costoTechoUsd,
  ensayar,
  esTopeDeGastoDelProveedor,
  estimarProximoCaso,
  leerLibro,
  MENSAJE_TOPE_DEL_PROVEEDOR,
  reporteDeGasto,
  resolverTope,
  type Libro,
} from '../evals/panel/presupuesto';
import { VARIANTES, correrCaso, type Resultado } from '../evals/panel/motor';
import { crearNegocioDePrueba } from '../evals/panel/negocio-de-prueba';
import { main } from '../evals/panel/run';
import type { CasoPanel } from '../evals/panel/casos';
import { RESPUESTA_FUERA_DE_ALCANCE } from '../../src/orbi/prompts/alcance';

const FECHA = new Date('2026-10-07T12:00:00.000Z'); // flash a precio de lanzamiento: 0,75 / 0,075 / 3,75

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orbi-evals-gasto-'));
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

function consumo(c: Partial<{ model: string; promptTokens: number; completionTokens: number; cachedTokens: number; thinkingTokens: number }>): ConsumoPorProveedor {
  return new Map([['gemini', { model: 'gemini-3.6-flash', promptTokens: 0, completionTokens: 0, cachedTokens: 0, thinkingTokens: 0, ...c }]]);
}

function resultado(costoUsd: number, parcial: Partial<Resultado> = {}): Resultado {
  return {
    id: 'x', categoria: 'datos', intento: 1, ok: true, violaciones: [], noAplica: [],
    turno: { texto: '', toolCalls: [], propuestas: [], escriturasRechazadas: [], destinos: [], temasLeidos: [], toolsOfrecidas: [] },
    ms: 1000, tokens: { entrada: 10_000, salida: 100 }, costoUsd, llamadas: 2, cachedTokens: 0, thinkingTokens: 0,
    ...parcial,
  };
}

const trabajos = (n: number) => Array.from({ length: n }, (_, i) => ({ caso: `caso-${i}`, intento: 1 }));

// ─── Costo ───────────────────────────────────────────────────────────────────

describe('costo de un caso', () => {
  it('es a precio de lista: la caché no descuenta', () => {
    const c = consumo({ promptTokens: 1_000_000, cachedTokens: 900_000, completionTokens: 100_000 });
    // 1M de entrada a 0,75 + 100k de salida a 3,75, como si nada estuviera cacheado.
    expect(costoTechoUsd(c, FECHA)).toBeCloseTo(0.75 + 0.375, 9);
    const conCache = costoDeConsumoUsd({ provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 1_000_000, cachedTokens: 900_000, completionTokens: 100_000 }, FECHA);
    expect(costoTechoUsd(c, FECHA)).toBeGreaterThan(conCache);
  });

  it('un modelo sin precio en la tabla se cobra como el más caro, no como el default', () => {
    const c = consumo({ model: 'gemini-9-ultra', promptTokens: 1_000_000 });
    expect(costoTechoUsd(c, FECHA)).toBeCloseTo(2, 9); // gemini-3.1-pro-preview
    expect(costoTechoUsd(c, FECHA)).toBeGreaterThan(costoTechoUsd(consumo({ promptTokens: 1_000_000 }), FECHA));
  });

  it('el motor deja en el Resultado el costo techo, la caché y el pensamiento reales y las llamadas', async () => {
    const usage = (promptTokens: number, cachedTokens: number, completionTokens: number, thinkingTokens: number): LlmEvent =>
      ({ type: 'usage', usage: { provider: 'gemini', model: 'gemini-3.6-flash', promptTokens, cachedTokens, completionTokens, thinkingTokens } });
    const vueltas: LlmEvent[][] = [
      [{ type: 'tool_call', call: { id: 'a', name: 'listOrders', arguments: { status: 'PENDING' } } }, usage(20_000, 15_000, 300, 200), { type: 'done' }],
      [{ type: 'text', chunk: 'Tenés pedidos pendientes.' }, usage(21_000, 20_000, 100, 50), { type: 'done' }],
    ];
    let i = 0;
    const llm = { async *streamChat(): AsyncGenerator<LlmEvent> { for (const ev of vueltas[i++] ?? [{ type: 'done' as const }]) yield ev; } };
    const caso: CasoPanel = { id: 'x', categoria: 'datos', descripcion: '', pantalla: 'pedidos', mensaje: 'hola', expectativas: [] };

    const r = await correrCaso(caso, 1, crearNegocioDePrueba(FECHA), VARIANTES.actual, { llm });

    expect(r.llamadas).toBe(2);
    expect(r.tokens).toEqual({ entrada: 41_000, salida: 400 });
    expect([r.cachedTokens, r.thinkingTokens]).toEqual([35_000, 250]);
    expect(r.costoUsd).toBeCloseTo((41_000 * 0.75 + 400 * 3.75) / 1_000_000, 9);
  });
});

// ─── Tope ────────────────────────────────────────────────────────────────────

describe('tope', () => {
  it('--tope manda (y acepta coma); si no, el del libro; sin ninguno, no se corre', () => {
    const libro: Libro = { topeUsd: 4, gastadoUsd: 1, corridas: [] };
    expect(resolverTope(libro, '5,5')).toEqual({ topeUsd: 5.5 });
    expect(resolverTope(libro, undefined)).toEqual({ topeUsd: 4 });
    expect(resolverTope(null, undefined)).toEqual({ error: expect.stringContaining('--tope=4') });
    expect(resolverTope(null, 'cuatro')).toEqual({ error: expect.stringContaining('--tope inválido') });
    expect(resolverTope(null, '0')).toEqual({ error: expect.stringContaining('--tope inválido') });
  });

  it('el primer caso se estima con el default; después, con el promedio de la corrida', () => {
    expect(estimarProximoCaso([])).toBe(COSTO_POR_CASO_POR_DEFECTO_USD);
    expect(estimarProximoCaso([0.01, 0.03])).toBeCloseTo(0.02, 9);
  });
});

// ─── Libro y freno ───────────────────────────────────────────────────────────

describe('libro de gasto y freno', () => {
  it('el libro acumula entre corridas y se escribe después de cada caso', async () => {
    const ruta = join(dir, 'gasto.json');
    const enDisco: number[] = [];
    const correr = async () => {
      enDisco.push(leerLibro(ruta)!.gastadoUsd);
      return resultado(0.01);
    };

    await correrConTope({ trabajos: trabajos(3), correr, libro: { topeUsd: 4, gastadoUsd: 0, corridas: [] }, rutaLibro: ruta, etiqueta: 'linea-base' });
    // Segunda corrida, otro proceso: arranca de lo que quedó en disco.
    await correrConTope({ trabajos: trabajos(2), correr, libro: leerLibro(ruta)!, rutaLibro: ruta, etiqueta: 'con-cambio' });

    const libro = leerLibro(ruta)!;
    expect(libro.gastadoUsd).toBeCloseTo(0.05, 9);
    expect(libro.corridas.map((c) => [c.etiqueta, c.casos, c.llamadas, c.estado])).toEqual([
      ['linea-base', 3, 6, 'completa'],
      ['con-cambio', 2, 4, 'completa'],
    ]);
    expect(libro.corridas[0].usd).toBeCloseTo(0.03, 9);
    // Antes de cada caso, el disco ya tenía lo de los anteriores: un crash no pierde la cuenta.
    expect(enDisco.map((x) => Number(x.toFixed(6)))).toEqual([0, 0.01, 0.02, 0.03, 0.04]);
  });

  it('frena ANTES del caso que pasaría el tope, sin llamar, y deja la cuenta guardada', async () => {
    const ruta = join(dir, 'gasto.json');
    const correr = jest.fn(async () => resultado(0.03));

    const r = await correrConTope({ trabajos: trabajos(5), correr, libro: { topeUsd: 0.1, gastadoUsd: 0, corridas: [] }, rutaLibro: ruta, etiqueta: 'x' });

    // 0,03 + 0,03 + 0,03 = 0,09; el cuarto (estimado 0,03) llevaría a 0,12.
    expect(correr).toHaveBeenCalledTimes(3);
    expect(r.resultados).toHaveLength(3);
    expect(r.frenada?.quedan).toBe(2);
    expect(r.frenada?.mensaje).toMatch(/^Tope de USD 0\.10 alcanzado: se gastaron USD 0\.0900; quedan 2 caso\(s\) sin correr/);
    const libro = leerLibro(ruta)!;
    expect(libro.gastadoUsd).toBeCloseTo(0.09, 9);
    expect(libro.gastadoUsd).toBeLessThanOrEqual(libro.topeUsd);
    expect(libro.corridas[0].estado).toBe('frenada');
  });

  it('con el tope ya casi agotado por corridas anteriores, no hace ni una llamada', async () => {
    const ruta = join(dir, 'gasto.json');
    const correr = jest.fn(async () => resultado(0.001));
    const libro: Libro = { topeUsd: 4, gastadoUsd: 3.98, corridas: [{ fecha: '2026-10-06T00:00:00.000Z', etiqueta: 'vieja', casos: 100, llamadas: 200, usd: 3.98, estado: 'completa' }] };

    const r = await correrConTope({ trabajos: trabajos(51), correr, libro, rutaLibro: ruta, etiqueta: 'y' });

    expect(correr).not.toHaveBeenCalled();
    expect(r.frenada?.quedan).toBe(51);
    expect(leerLibro(ruta)!.gastadoUsd).toBeCloseTo(3.98, 9);
  });
});

// ─── El tope de gasto del proyecto en Google ────────────────────────────────

// Lo que contesta Gemini cuando el proyecto llegó a su tope de gasto mensual.
const ERROR_TOPE_DE_GOOGLE =
  '{"error":{"code":429,"message":"Your project has exceeded its monthly spending cap. Please go to AI Studio at https://ai.studio/spend to manage your project spend cap.","status":"RESOURCE_EXHAUSTED"}}';
const ERROR_RATE_LIMIT =
  '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. Please retry in 20.5s.","status":"RESOURCE_EXHAUSTED"}}';

describe('tope de gasto del proyecto en Google', () => {
  it('reconoce el 429 del tope de gasto y no un rate limit común', () => {
    expect(esTopeDeGastoDelProveedor(`Proveedor: ${ERROR_TOPE_DE_GOOGLE}`)).toBe(true);
    expect(esTopeDeGastoDelProveedor('exceeded its monthly SPEND_CAP')).toBe(true);
    expect(esTopeDeGastoDelProveedor(`Proveedor: ${ERROR_RATE_LIMIT}`)).toBe(false);
    expect(esTopeDeGastoDelProveedor('Proveedor: 503 UNAVAILABLE')).toBe(false);
  });

  it('para en el primer caso que lo recibe: guarda lo anterior y no le anota costo a ese caso', async () => {
    const ruta = join(dir, 'gasto.json');
    let n = 0;
    const correr = jest.fn(async () => {
      n++;
      if (n === 3) return resultado(0, { ok: false, infra: true, error: `Proveedor: ${ERROR_TOPE_DE_GOOGLE}`, llamadas: 0, costoUsd: 0 });
      return resultado(0.01);
    });

    const r = await correrConTope({ trabajos: trabajos(6), correr, libro: { topeUsd: 4, gastadoUsd: 0, corridas: [] }, rutaLibro: ruta, etiqueta: 'x' });

    // Los casos 4 a 6 no se intentan: darían el mismo 429.
    expect(correr).toHaveBeenCalledTimes(3);
    expect(r.resultados).toHaveLength(2);
    expect(r.resultados.some((x) => x.infra)).toBe(false);
    expect(r.frenada).toEqual({ quedan: 4, motivo: 'proveedor', mensaje: expect.stringContaining(MENSAJE_TOPE_DEL_PROVEEDOR) });
    expect(MENSAJE_TOPE_DEL_PROVEEDOR).toBe('Google frenó por el tope de gasto del proyecto en AI Studio: subilo en https://ai.studio/spend y volvé a correr');
    const libro = leerLibro(ruta)!;
    expect(libro.gastadoUsd).toBeCloseTo(0.02, 9);
    expect(libro.corridas[0]).toMatchObject({ casos: 2, estado: 'frenada' });
    expect(libro.corridas[0].usd).toBeCloseTo(0.02, 9);
  });

  it('un error de infraestructura común no para la corrida', async () => {
    const ruta = join(dir, 'gasto.json');
    const correr = jest.fn(async () => resultado(0, { ok: false, infra: true, error: `Proveedor: ${ERROR_RATE_LIMIT}` }));

    const r = await correrConTope({ trabajos: trabajos(3), correr, libro: { topeUsd: 4, gastadoUsd: 0, corridas: [] }, rutaLibro: ruta, etiqueta: 'x' });

    expect(correr).toHaveBeenCalledTimes(3);
    expect(r.frenada).toBeNull();
  });

  it('la CLI sale con código 3, con el mensaje, sin reintentar y con lo corrido guardado', async () => {
    const ruta = join(dir, 'gasto.json');
    const salida = join(dir, 'corrida.json');
    // Un modelo guionado: contesta el primer caso y en el segundo Google corta.
    let llamadas = 0;
    const llm = {
      async *streamChat(): AsyncGenerator<LlmEvent> {
        llamadas++;
        if (llamadas > 1) throw new Error(ERROR_TOPE_DE_GOOGLE);
        yield { type: 'text', chunk: RESPUESTA_FUERA_DE_ALCANCE };
        yield { type: 'usage', usage: { model: 'gemini-3.6-flash', provider: 'gemini', promptTokens: 1000, completionTokens: 10, cachedTokens: 0, thinkingTokens: 0 } };
        yield { type: 'done' };
      },
    };
    const keyAntes = process.env.GEMINI_API_KEY;
    // main() exige que haya una key; nunca se usa: el modelo es el guionado.
    process.env.GEMINI_API_KEY = 'no-se-usa-en-este-test';
    try {
      const codigo = await main(
        ['--categoria=fuera-de-alcance', '--tope=4', `--gasto=${ruta}`, `--salida=${salida}`],
        { crearModelo: () => ({ llm, nombre: 'gemini-3.6-flash' }) },
      );
      expect(codigo).toBe(3);
    } finally {
      if (keyAntes === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = keyAntes;
    }

    // Una llamada que anduvo y una que cortó: sin reintentos por "rate limit" ni más casos.
    expect(llamadas).toBe(2);
    expect(GeminiAdapter).not.toHaveBeenCalled();
    expect((console.error as jest.Mock).mock.calls.flat().join('\n')).toContain(MENSAJE_TOPE_DEL_PROVEEDOR);
    const guardada = JSON.parse(readFileSync(salida, 'utf8')) as { resultados: Resultado[] };
    expect(guardada.resultados).toHaveLength(1);
    expect(guardada.resultados[0].infra).toBeUndefined();
    const libro = leerLibro(ruta)!;
    expect(libro.corridas[0]).toMatchObject({ casos: 1, estado: 'frenada' });
  });
});

// ─── Ensayo ──────────────────────────────────────────────────────────────────

describe('--ensayo', () => {
  it('no construye el adapter, no pide la key y no escribe el libro', async () => {
    const ruta = join(dir, 'gasto.json');
    const crearModelo = jest.fn();

    expect(await main(['--ensayo', '--tope=4', `--gasto=${ruta}`, '--repeticiones=2'], { crearModelo })).toBe(0);
    // Con las dependencias de verdad, tampoco: el GeminiAdapter mockeado tiraría.
    expect(await main(['--ensayo', `--gasto=${ruta}`])).toBe(0);

    expect(crearModelo).not.toHaveBeenCalled();
    expect(GeminiAdapter).not.toHaveBeenCalled();
    expect(existsSync(ruta)).toBe(false);
    expect((console.log as jest.Mock).mock.calls.flat().join('\n')).toMatch(/Ensayo \(no se llama a nada\): \d+ caso\(s\) x 2/);
  });

  it('sin tope ni libro, la corrida de verdad se niega antes de armar el modelo', async () => {
    const crearModelo = jest.fn();
    expect(await main([`--gasto=${join(dir, 'gasto.json')}`], { crearModelo })).toBe(1);
    expect(crearModelo).not.toHaveBeenCalled();
    expect((console.error as jest.Mock).mock.calls.flat().join('\n')).toContain('No hay tope de gasto');
  });

  it('estima el rango con la historia del libro y cuántos casos entrarían', () => {
    const sinHistoria = ensayar({ casos: 50, repeticiones: 2, libro: null, topeUsd: 4 });
    expect(sinHistoria.corridas).toBe(100);
    expect(sinHistoria.hastaUsd).toBeCloseTo(100 * COSTO_POR_CASO_POR_DEFECTO_USD, 9);
    expect(sinHistoria.entranConElTecho).toBe(100);

    const libro: Libro = {
      topeUsd: 4, gastadoUsd: 3,
      corridas: [
        { fecha: '', etiqueta: 'a', casos: 50, llamadas: 100, usd: 1, estado: 'completa' }, // 0,02 por caso
        { fecha: '', etiqueta: 'b', casos: 50, llamadas: 100, usd: 2, estado: 'completa' }, // 0,04 por caso
      ],
    };
    const conHistoria = ensayar({ casos: 50, repeticiones: 1, libro, topeUsd: 4 });
    expect(conHistoria.desdeUsd).toBeCloseTo(1, 9);
    expect(conHistoria.hastaUsd).toBeCloseTo(2, 9);
    expect(conHistoria.disponibleUsd).toBeCloseTo(1, 9);
    expect(conHistoria.entranConElTecho).toBe(25);
  });
});

// ─── Reporte ─────────────────────────────────────────────────────────────────

describe('reporte de gasto', () => {
  it('pasaron/fallaron, USD de la corrida y acumulado, promedios y % cacheado', () => {
    const resultados = [
      resultado(0.02, { ms: 1000, tokens: { entrada: 20_000, salida: 100 }, cachedTokens: 15_000, thinkingTokens: 300 }),
      resultado(0.04, { ok: false, ms: 3000, tokens: { entrada: 30_000, salida: 100 }, cachedTokens: 10_000, thinkingTokens: 100 }),
      // Una corrida guardada antes de 2026-10-07: sin caché ni costo.
      resultado(0, { infra: true, ok: false, ms: 2000, tokens: { entrada: 0, salida: 0 }, costoUsd: undefined, cachedTokens: undefined, thinkingTokens: undefined }),
    ];
    const r = reporteDeGasto(resultados, { topeUsd: 4, gastadoUsd: 1.5, corridas: [] }, null);
    expect(r).toMatchObject({
      pasaron: 1, fallaron: 1, infra: 1, usdAcumulado: 1.5, topeUsd: 4,
      promedioTokensDeEntrada: Math.round(50_000 / 3), porcentajeCacheado: 50, promedioTokensDePensamiento: Math.round(400 / 3),
      latenciaPromedioMs: 2000, frenada: false, casosSinCorrer: 0,
    });
    expect(r.usdCorrida).toBeCloseTo(0.06, 9);
  });
});

// El mock tiene que haber reemplazado al adapter de verdad (si no, los tests de arriba no prueban nada).
it('el GeminiAdapter de este archivo es el mock', () => {
  expect(jest.isMockFunction(GeminiAdapter)).toBe(true);
  expect(readFileSync(join(__dirname, '../evals/panel/run.ts'), 'utf8')).toContain("from '../../../src/orbi/llm/gemini.adapter'");
});
