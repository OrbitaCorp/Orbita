import { WizardAnalyticsService } from '../../src/wizard-analytics/wizard-analytics.service';
import type { LlmEvent } from '../../src/orbi/llm/llm-adapter.interface';

// El clasificador nocturno llama al LLM sin que lo dispare ninguna persona:
// si no se mide, ese gasto no aparece en Costos. El LLM se mockea siempre.

function servicio(eventos: LlmEvent[]) {
  const llm = {
    streamChat: jest.fn(async function* () {
      for (const e of eventos) yield e;
    }),
  };
  const track = jest.fn().mockResolvedValue(undefined);
  const svc = new WizardAnalyticsService({} as any, llm as any, { track } as any);
  return { svc, track };
}

describe('WizardAnalyticsService.clasificarTurno: medición', () => {
  it('registra el consumo del clasificador con la función wizard-classifier', async () => {
    const { svc, track } = servicio([
      { type: 'text', chunk: '{"topic":"otro","answeredWell":true}' },
      { type: 'usage', usage: { model: 'gemini-3.6-flash', provider: 'gemini', promptTokens: 400, completionTokens: 30 } },
      { type: 'done' },
    ]);
    const veredicto = await (svc as any).clasificarTurno('¿cómo hago X?', 'así');
    expect(veredicto).toEqual({ topic: 'otro', answeredWell: true });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({
      providerSlug: 'gemini',
      category: 'prompt_tokens',
      quantity: 400,
      metadata: expect.objectContaining({ feature: 'wizard-classifier', model: 'gemini-3.6-flash' }),
    }));
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ category: 'completion_tokens', quantity: 30 }));
  });

  it('si el adapter no informó consumo, no escribe nada', async () => {
    const { svc, track } = servicio([
      { type: 'text', chunk: '{"topic":"otro","answeredWell":false}' },
      { type: 'done' },
    ]);
    await (svc as any).clasificarTurno('p', 'r');
    expect(track).not.toHaveBeenCalled();
  });
});
