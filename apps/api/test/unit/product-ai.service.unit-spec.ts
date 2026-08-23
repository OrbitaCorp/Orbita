import Groq from 'groq-sdk';
import { ProductAiService } from '../../src/products/product-ai.service';
import type { CategoryListItem } from '../../src/categories/categories.service';

// Unit test de ProductAiService (RBT-684 — Orbi asiste descripción + categoría +
// etiquetas). No pega a la API real: mockea el cliente de Groq vía el campo
// privado `client`, y CategoriesService/TagsService como objetos simples.

type TagUsado = { id: string; name: string; createdAt: string; usageCount: number };

function makeService(
  apiKey: string | undefined,
  categorias: CategoryListItem[] = [],
  tagsUsados: TagUsado[] = [],
) {
  const config = { get: () => apiKey } as any;
  const categoriesService = { findAll: async () => categorias } as any;
  const tagsService = { findAll: async () => tagsUsados } as any;
  return new ProductAiService(config, categoriesService, tagsService);
}

function mockCreate(svc: ProductAiService, impl: (...args: any[]) => any) {
  const create = jest.fn(impl);
  (svc as any).client = { chat: { completions: { create } } };
  return create;
}

const dto = { name: 'Remera oversize' };
const cat = (id: string, name: string): CategoryListItem => ({
  id, name, slug: name.toLowerCase(), icon: null, color: null, parentId: null,
  isActive: true, position: 0, productCount: 0,
});

describe('ProductAiService.assist (unit)', () => {
  it('rechaza con 503 si GROQ_API_KEY no está configurada', async () => {
    const svc = makeService(undefined);
    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 503 });
  });

  it('devuelve descripción, categoría sugerida y etiquetas cuando Groq responde JSON válido', async () => {
    const svc = makeService('gsk-test', [cat('cat-1', 'Remeras')]);
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({
        description: 'Remera de algodón premium, corte oversize.',
        suggestedCategoryId: 'cat-1',
        suggestedTags: ['verano', 'algodón'],
      }) } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result).toEqual({
      description: 'Remera de algodón premium, corte oversize.',
      suggestedCategoryId: 'cat-1',
      suggestedTags: ['verano', 'algodón'],
      suggestedSpecs: [],
    });
  });

  it('devuelve suggestedSpecs cuando Groq las manda para un producto técnico', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({
        description: 'ok', suggestedCategoryId: null, suggestedTags: [],
        suggestedSpecs: [{ label: 'RAM', value: '16GB' }, { label: 'Almacenamiento', value: '512GB SSD' }],
      }) } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedSpecs).toEqual([
      { label: 'RAM', value: '16GB' },
      { label: 'Almacenamiento', value: '512GB SSD' },
    ]);
  });

  it('descarta specs con forma inválida pero no recorta hasta 15 (el vendedor pidió poder llegar a 10+)', async () => {
    const svc = makeService('gsk-test');
    const catorceSpecs = Array.from({ length: 14 }, (_, i) => ({ label: `Spec ${i}`, value: `Valor ${i}` }));
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({
        description: 'ok', suggestedCategoryId: null, suggestedTags: [],
        suggestedSpecs: [...catorceSpecs, { label: '', value: 'sin label' }, { label: 'sin value', value: '' }, 'no es objeto', null],
      }) } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedSpecs).toHaveLength(14);
    expect(result.suggestedSpecs[0]).toEqual({ label: 'Spec 0', value: 'Valor 0' });
  });

  it('recorta a 20 aunque Groq mande de más (blindaje ante un modelo desbocado)', async () => {
    const svc = makeService('gsk-test');
    const treintaSpecs = Array.from({ length: 30 }, (_, i) => ({ label: `Spec ${i}`, value: `Valor ${i}` }));
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({
        description: 'ok', suggestedCategoryId: null, suggestedTags: [], suggestedSpecs: treintaSpecs,
      }) } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedSpecs).toHaveLength(20);
  });

  it('suggestedSpecs queda vacío si Groq no lo manda (producto sin ficha técnica)', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }) } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedSpecs).toEqual([]);
  });

  it('descarta suggestedCategoryId si no está en la lista de categorías del negocio', async () => {
    const svc = makeService('gsk-test', [cat('cat-1', 'Remeras')]);
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({
        description: 'ok', suggestedCategoryId: 'cat-inventado', suggestedTags: [],
      }) } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedCategoryId).toBeNull();
  });

  it('dedupea sin importar mayúsculas y recorta a 5 las etiquetas sugeridas', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({
        description: 'ok',
        suggestedCategoryId: null,
        suggestedTags: ['Verano', 'verano', 'algodón', 'casual', 'urbano', 'básico', 'oversize'],
      }) } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedTags).toEqual(['verano', 'algodón', 'casual', 'urbano', 'básico']);
  });

  it('pide 3000 max_completion_tokens (una respuesta con specs no entra en el presupuesto viejo de 800)', async () => {
    const svc = makeService('gsk-test');
    const create = mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }) } }],
    }));

    await svc.assist('biz-1', dto);

    expect(create.mock.calls[0][0].max_completion_tokens).toBe(3000);
  });

  it('loguea distinto cuando Groq corta la respuesta por max_completion_tokens (finish_reason length)', async () => {
    const svc = makeService('gsk-test');
    const errorSpy = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    mockCreate(svc, async () => ({
      choices: [{ message: { content: '{"description": "algo cortado a la mit' }, finish_reason: 'length' }],
    }));

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('cortada por max_completion_tokens'));
  });

  it('incluye categorías y etiquetas ya usadas en el mensaje enviado a Groq', async () => {
    const svc = makeService('gsk-test', [cat('cat-1', 'Remeras')], [
      { id: 't-1', name: 'verano', createdAt: '', usageCount: 3 },
    ]);
    const create = mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }) } }],
    }));

    await svc.assist('biz-1', { name: 'Remera oversize', existingDescription: 'Es cómoda' });

    const enviado = create.mock.calls[0][0].messages[1].content as string;
    expect(enviado).toContain('Remera oversize');
    expect(enviado).toContain('Es cómoda');
    expect(enviado).toContain('cat-1: Remeras');
    expect(enviado).toContain('verano');
    expect(create.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
  });

  it('rechaza con 500 si la llamada a la API falla', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => { throw new Error('network down'); });

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza con 503 si Groq responde 401 (API key inválida/vencida)', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => {
      throw new Groq.AuthenticationError(401, { error: { message: 'Invalid API Key' } }, 'Invalid API Key', new Headers());
    });

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 503 });
  });

  it('rechaza con 500 si la respuesta no es JSON válido', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => ({ choices: [{ message: { content: 'esto no es json' } }] }));

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza con 500 si la respuesta no trae description', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({ suggestedCategoryId: null, suggestedTags: [] }) } }],
    }));

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
  });

  it('parsea el JSON aunque venga envuelto en fences de markdown', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => ({
      choices: [{ message: { content: '```json\n' + JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }) + '\n```' } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.description).toBe('ok');
  });

  it('rechaza con 500 y loguea si no puede resolver categorías/etiquetas del negocio', async () => {
    const config = { get: () => 'gsk-test' } as any;
    const categoriesService = { findAll: async () => { throw new Error('db down'); } } as any;
    const tagsService = { findAll: async () => [] } as any;
    const svc = new ProductAiService(config, categoriesService, tagsService);
    const errorSpy = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('biz-1'));
  });

  it('loguea el contenido crudo cuando la respuesta no es JSON válido', async () => {
    const svc = makeService('gsk-test');
    const errorSpy = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    mockCreate(svc, async () => ({ choices: [{ message: { content: 'esto no es json' } }] }));

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('esto no es json'));
  });
});
