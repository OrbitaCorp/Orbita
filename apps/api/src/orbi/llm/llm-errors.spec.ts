import { ApiError } from '@google/genai';
import { esErrorDeDisponibilidad } from './llm-errors';

/** Reproduce la forma real del error del SDK: el cuerpo va como JSON en `message`. */
function errorGemini(code: number, mensajeInterno: string): ApiError {
  return new ApiError({
    message: JSON.stringify({ error: { message: mensajeInterno, code, status: 'Not Found' } }),
    status: code,
  });
}

describe('esErrorDeDisponibilidad', () => {
  it('429 (cuota) cae al fallback', () => {
    expect(esErrorDeDisponibilidad(errorGemini(429, 'quota exceeded'))).toBe(true);
  });

  it('503 (high demand) cae al fallback', () => {
    expect(esErrorDeDisponibilidad(errorGemini(503, 'This model is currently experiencing high demand'))).toBe(true);
  });

  it('500 cae al fallback', () => {
    expect(esErrorDeDisponibilidad(errorGemini(500, 'internal'))).toBe(true);
  });

  // El caso de producción del 2026-09-10: 404 con message vacío en la llamada
  // de continuación, después de que la primera se comiera un 503.
  it('404 con mensaje VACÍO cae al fallback (pico de demanda, no config)', () => {
    expect(esErrorDeDisponibilidad(errorGemini(404, ''))).toBe(true);
  });

  it('404 con mensaje en blanco (solo espacios) también cae al fallback', () => {
    expect(esErrorDeDisponibilidad(errorGemini(404, '   '))).toBe(true);
  });

  it('404 CON mensaje sigue siendo error duro (modelo mal configurado)', () => {
    const err = errorGemini(404, 'models/gemini-inventado is not found for API version v1beta');
    expect(esErrorDeDisponibilidad(err)).toBe(false);
  });

  it('400 sigue siendo error duro (request mal armado)', () => {
    expect(esErrorDeDisponibilidad(errorGemini(400, 'invalid argument'))).toBe(false);
  });

  it('401 y 403 siguen siendo errores duros', () => {
    expect(esErrorDeDisponibilidad(errorGemini(401, 'unauthorized'))).toBe(false);
    expect(esErrorDeDisponibilidad(errorGemini(403, 'forbidden'))).toBe(false);
  });

  it('errores de red caen al fallback', () => {
    const err = Object.assign(new Error('connect ECONNRESET'), { code: 'ECONNRESET' });
    expect(esErrorDeDisponibilidad(err)).toBe(true);
  });

  it('un Error genérico sin status NO cae al fallback', () => {
    expect(esErrorDeDisponibilidad(new Error('algo raro'))).toBe(false);
  });
});
