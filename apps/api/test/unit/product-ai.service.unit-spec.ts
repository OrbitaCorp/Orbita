import { ProductAiService } from '../../src/products/product-ai.service';

// Unit test de ProductAiService (RBT-635 — Orbi genera la descripción del
// producto). No pega a la API real: mockea el cliente de Groq vía el
// campo privado `client`, mismo patrón que mail.service.unit-spec.ts con `_resend`.

function makeService(apiKey: string | undefined) {
  const config = { get: () => apiKey } as any;
  return new ProductAiService(config);
}

const dto = { name: 'Remera oversize' };

describe('ProductAiService.generateDescription (unit)', () => {
  it('rechaza con 503 si GROQ_API_KEY no está configurada', async () => {
    const svc = makeService(undefined);
    await expect(svc.generateDescription(dto)).rejects.toMatchObject({ status: 503 });
  });

  it('devuelve el texto generado cuando la API responde texto', async () => {
    const svc = makeService('gsk-test');
    const create = jest.fn().mockResolvedValue({
      choices: [{ finish_reason: 'stop', message: { content: '  Remera de algodón premium, corte oversize.  ' } }],
    });
    (svc as any).client = { chat: { completions: { create } } };

    const texto = await svc.generateDescription(dto);

    expect(texto).toBe('Remera de algodón premium, corte oversize.');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'llama-3.1-8b-instant',
      messages: [
        expect.objectContaining({ role: 'system' }),
        { role: 'user', content: expect.stringContaining('Remera oversize') },
      ],
    }));
  });

  it('incluye categoría, etiquetas y borrador previo en el mensaje cuando vienen', async () => {
    const svc = makeService('gsk-test');
    const create = jest.fn().mockResolvedValue({
      choices: [{ finish_reason: 'stop', message: { content: 'ok' } }],
    });
    (svc as any).client = { chat: { completions: { create } } };

    await svc.generateDescription({
      name: 'Remera oversize',
      categoryName: 'Remeras',
      tags: ['verano', 'algodón'],
      existingDescription: 'Es cómoda',
    });

    const enviado = create.mock.calls[0][0].messages[1].content as string;
    expect(enviado).toContain('Categoría: Remeras');
    expect(enviado).toContain('Etiquetas: verano, algodón');
    expect(enviado).toContain('Borrador actual del vendedor: Es cómoda');
  });

  it('rechaza con 500 si la llamada a la API falla', async () => {
    const svc = makeService('gsk-test');
    const create = jest.fn().mockRejectedValue(new Error('network down'));
    (svc as any).client = { chat: { completions: { create } } };

    await expect(svc.generateDescription(dto)).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza con 500 si la respuesta no trae texto', async () => {
    const svc = makeService('gsk-test');
    const create = jest.fn().mockResolvedValue({ choices: [{ finish_reason: 'stop', message: { content: null } }] });
    (svc as any).client = { chat: { completions: { create } } };

    await expect(svc.generateDescription(dto)).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza con 500 si la respuesta no trae ningún choice', async () => {
    const svc = makeService('gsk-test');
    const create = jest.fn().mockResolvedValue({ choices: [] });
    (svc as any).client = { chat: { completions: { create } } };

    await expect(svc.generateDescription(dto)).rejects.toMatchObject({ status: 500 });
  });
});
