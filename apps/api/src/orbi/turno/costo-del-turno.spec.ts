import { costoDelTurno, creditosDe, USD_POR_CREDITO } from './costo-del-turno';
import type { ConsumoPorProveedor } from './motor-de-turno';

const FECHA = new Date('2026-10-03T12:00:00Z');

const gemini = (promptTokens: number, completionTokens: number, cachedTokens = 0): ConsumoPorProveedor =>
  new Map([['gemini', { model: 'gemini-3.6-flash', promptTokens, completionTokens, cachedTokens, thinkingTokens: 0 }]]);

describe('creditosDe', () => {
  it('redondea para arriba y 0 si no costó nada', () => {
    expect(USD_POR_CREDITO).toBe(0.001);
    expect(creditosDe(0)).toBe(0);
    expect(creditosDe(-1)).toBe(0);
    expect(creditosDe(0.0001)).toBe(1);
    expect(creditosDe(0.001)).toBe(1);
    expect(creditosDe(0.0011)).toBe(2);
    expect(creditosDe(0.007893)).toBe(8);
  });

  it('el ruido de punto flotante no suma un crédito de más', () => {
    expect(creditosDe(0.003)).toBe(3);
    expect(creditosDe(0.007)).toBe(7);
  });
});

describe('costoDelTurno', () => {
  it('el mensaje promedio de producción (9.844 / 136, sin caché) cuesta USD 0,007893 y 8 créditos', () => {
    expect(costoDelTurno(gemini(9844, 136), new Map(), FECHA)).toEqual({ costUsd: 0.007893, toolsCostUsd: 0, credits: 8 });
  });

  it('un consumo vacío no cuesta nada', () => {
    expect(costoDelTurno(new Map(), new Map(), FECHA)).toEqual({ costUsd: 0, toolsCostUsd: 0, credits: 0 });
  });

  it('la caché abarata la entrada', () => {
    const sin = costoDelTurno(gemini(10000, 100), new Map(), FECHA).costUsd;
    const con = costoDelTurno(gemini(10000, 100, 4096), new Map(), FECHA).costUsd;
    expect(con).toBeLessThan(sin);
    expect(con).toBeCloseTo(((10000 - 4096) * 0.75 + 4096 * 0.075 + 100 * 3.75) / 1e6, 6);
  });

  it('la IA que dispararon las tools suma al total y se informa aparte', () => {
    const r = costoDelTurno(gemini(9844, 136), gemini(2000, 500), FECHA);
    const tools = (2000 * 0.75 + 500 * 3.75) / 1e6;
    expect(r.toolsCostUsd).toBeCloseTo(tools, 6);
    expect(r.toolsCostUsd).toBeGreaterThan(0);
    expect(r.costUsd).toBeCloseTo(0.007893 + tools, 6);
    expect(r.credits).toBe(creditosDe(0.007893 + tools));
  });

  it('suma proveedores distintos, cada uno a su precio', () => {
    const consumo: ConsumoPorProveedor = new Map([
      ['gemini', { model: 'gemini-3.6-flash', promptTokens: 1000, completionTokens: 100, cachedTokens: 0, thinkingTokens: 0 }],
      ['groq', { model: 'openai/gpt-oss-120b', promptTokens: 1000, completionTokens: 100, cachedTokens: 0, thinkingTokens: 0 }],
    ]);
    expect(costoDelTurno(consumo, new Map(), FECHA).costUsd).toBeCloseTo((1000 * 0.75 + 100 * 3.75 + 1000 * 0.15 + 100 * 0.6) / 1e6, 6);
  });
});
