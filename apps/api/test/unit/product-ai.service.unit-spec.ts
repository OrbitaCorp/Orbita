import { ProductAiService } from '../../src/products/product-ai.service';

// Unit test de ProductAiService (RBT-635 — Orbi genera la descripción del
// producto). No pega a la API real: mockea el cliente de Anthropic vía el
// campo privado `client`, mismo patrón que mail.service.unit-spec.ts con `_resend`.

function makeService(apiKey: string | undefined) {
  const config = { get: () => apiKey } as any;
  return new ProductAiService(config);
}

const dto = { name: 'Remera oversize' };

describe('ProductAiService.generateDescription (unit)', () => {
  it('rechaza con 503 si ANTHROPIC_API_KEY no está configurada', async () => {
    const svc = makeService(undefined);
    await expect(svc.generateDescription(dto)).rejects.toMatchObject({ status: 503 });
  });

  it('devuelve el texto generado cuando la API responde texto', async () => {
    const svc = makeService('sk-test');
    const create = jest.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '  Remera de algodón premium, corte oversize.  ' }],
    });
    (svc as any).client = { messages: { create } };

    const texto = await svc.generateDescription(dto);

    expect(texto).toBe('Remera de algodón premium, corte oversize.');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-opus-5',
      messages: [{ role: 'user', content: expect.stringContaining('Remera oversize') }],
    }));
  });

  it('incluye categoría, etiquetas y borrador previo en el mensaje cuando vienen', async () => {
    const svc = makeService('sk-test');
    const create = jest.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'ok' }],
    });
    (svc as any).client = { messages: { create } };

    await svc.generateDescription({
      name: 'Remera oversize',
      categoryName: 'Remeras',
      tags: ['verano', 'algodón'],
      existingDescription: 'Es cómoda',
    });

    const enviado = create.mock.calls[0][0].messages[0].content as string;
    expect(enviado).toContain('Categoría: Remeras');
    expect(enviado).toContain('Etiquetas: verano, algodón');
    expect(enviado).toContain('Borrador actual del vendedor: Es cómoda');
  });

  it('rechaza con 500 si Claude se niega a responder (stop_reason refusal)', async () => {
    const svc = makeService('sk-test');
    const create = jest.fn().mockResolvedValue({ stop_reason: 'refusal', content: [] });
    (svc as any).client = { messages: { create } };

    await expect(svc.generateDescription(dto)).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza con 500 si la llamada a la API falla', async () => {
    const svc = makeService('sk-test');
    const create = jest.fn().mockRejectedValue(new Error('network down'));
    (svc as any).client = { messages: { create } };

    await expect(svc.generateDescription(dto)).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza con 500 si la respuesta no trae ningún bloque de texto', async () => {
    const svc = makeService('sk-test');
    const create = jest.fn().mockResolvedValue({ stop_reason: 'end_turn', content: [] });
    (svc as any).client = { messages: { create } };

    await expect(svc.generateDescription(dto)).rejects.toMatchObject({ status: 500 });
  });
});
