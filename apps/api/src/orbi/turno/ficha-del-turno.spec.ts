import { caracteresDelContexto, proveedorDelTurno, totalesDelConsumo } from './ficha-del-turno';

const c = (p: number, o: number, ca = 0, th = 0) => ({ model: 'm', promptTokens: p, completionTokens: o, cachedTokens: ca, thinkingTokens: th });

describe('ficha del turno', () => {
  it('proveedor: uno, mixto o ninguno', () => {
    expect(proveedorDelTurno(new Map())).toBeUndefined();
    expect(proveedorDelTurno(new Map([['gemini', c(1, 1)]]))).toBe('gemini');
    expect(proveedorDelTurno(new Map([['gemini', c(1, 1)], ['groq', c(1, 1)]]))).toBe('mixto');
  });
  it('suma los totales de todos los proveedores', () => {
    expect(totalesDelConsumo(new Map([['gemini', c(10, 2, 4, 1)], ['groq', c(5, 1)]]))).toEqual({ promptTokens: 15, completionTokens: 3, cachedTokens: 4, thinkingTokens: 1 });
  });
  it('mide el contexto en caracteres', () => {
    const r = caracteresDelContexto({ system: 'abcd', tools: [{ name: 'x', description: 'y', parameters: {} }], history: [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'chau' }], message: 'ok' });
    expect(r).toEqual({ system: 4, tools: JSON.stringify([{ name: 'x', description: 'y', parameters: {} }]).length, history: 8, message: 2 });
  });
});
