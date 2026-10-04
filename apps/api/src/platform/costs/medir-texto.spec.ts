import { medirConsumoDeTexto } from './medir-texto';

describe('medirConsumoDeTexto', () => {
  it('registra entrada y salida con la función y el modelo', () => {
    const track = jest.fn();
    medirConsumoDeTexto({ track } as never, { provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 900, completionTokens: 120, cachedTokens: 0 }, { feature: 'orbi-wizard-tools' });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ providerSlug: 'gemini', category: 'prompt_tokens', quantity: 900, metadata: expect.objectContaining({ feature: 'orbi-wizard-tools', model: 'gemini-3.6-flash' }) }));
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ category: 'completion_tokens', quantity: 120 }));
  });
  it('sin consumo informado no inventa un 0', () => {
    const track = jest.fn();
    medirConsumoDeTexto({ track } as never, { provider: 'gemini' }, { feature: 'x' });
    expect(track).not.toHaveBeenCalled();
  });
});
