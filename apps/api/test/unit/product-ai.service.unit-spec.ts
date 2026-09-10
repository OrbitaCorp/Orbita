import { ServiceUnavailableException } from '@nestjs/common';
import { ApiError } from '@google/genai';
import { ProductAiService } from '../../src/products/product-ai.service';
import type { CategoryListItem } from '../../src/categories/categories.service';
import { generarTexto } from '../../src/orbi/llm/text-generation';

// Unit test de ProductAiService (RBT-684 — Orbi asiste descripción + categoría +
// etiquetas). No pega a ninguna API: mockea generarTexto (Gemini con fallback a
// Groq) y CategoriesService/TagsService como objetos simples.
jest.mock('../../src/orbi/llm/text-generation');
const generarTextoMock = generarTexto as jest.MockedFunction<typeof generarTexto>;

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

// `impl` recibe los opts de generarTexto y devuelve el texto que "responde" el
// modelo (o {text, finishReason}), o tira.
function mockGen(impl: (...args: any[]) => any) {
  generarTextoMock.mockImplementation(async (...args: any[]) => {
    const r = await impl(...args);
    if (typeof r === 'string') return { text: r, viaFallback: false };
    return { viaFallback: false, ...r };
  });
}

beforeEach(() => generarTextoMock.mockReset());

const dto = { name: 'Remera oversize' };
const cat = (id: string, name: string): CategoryListItem => ({
  id, name, slug: name.toLowerCase(), icon: null, color: null, imageUrl: null, parentId: null,
  isActive: true, position: 0, productCount: 0,
});

describe('ProductAiService.assist (unit)', () => {
  it('rechaza con 503 si GEMINI_API_KEY no está configurada', async () => {
    const svc = makeService(undefined);
    mockGen(async () => { throw new ServiceUnavailableException('GEMINI_API_KEY no configurada'); });
    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 503 });
  });

  it('devuelve descripción, categoría sugerida y etiquetas cuando el modelo responde JSON válido', async () => {
    const svc = makeService('gsk-test', [cat('cat-1', 'Remeras')]);
    mockGen(async () => JSON.stringify({
      description: 'Remera de algodón premium, corte oversize.',
      suggestedCategoryId: 'cat-1',
      suggestedTags: ['verano', 'algodón'],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result).toEqual({
      description: 'Remera de algodón premium, corte oversize.',
      suggestedCategoryId: 'cat-1',
      suggestedTags: ['verano', 'algodón'],
      suggestedSpecs: [],
    });
  });

  it('devuelve suggestedSpecs cuando el modelo las manda para un producto técnico', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => JSON.stringify({
      description: 'ok', suggestedCategoryId: null, suggestedTags: [],
      suggestedSpecs: [{ label: 'RAM', value: '16GB' }, { label: 'Almacenamiento', value: '512GB SSD' }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedSpecs).toEqual([
      { label: 'RAM', value: '16GB' },
      { label: 'Almacenamiento', value: '512GB SSD' },
    ]);
  });

  it('descarta specs con forma inválida pero no recorta hasta 15', async () => {
    const svc = makeService('gsk-test');
    const catorceSpecs = Array.from({ length: 14 }, (_, i) => ({ label: `Spec ${i}`, value: `Valor ${i}` }));
    mockGen(async () => JSON.stringify({
      description: 'ok', suggestedCategoryId: null, suggestedTags: [],
      suggestedSpecs: [...catorceSpecs, { label: '', value: 'sin label' }, { label: 'sin value', value: '' }, 'no es objeto', null],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedSpecs).toHaveLength(14);
    expect(result.suggestedSpecs[0]).toEqual({ label: 'Spec 0', value: 'Valor 0' });
  });

  it('recorta a 20 aunque el modelo mande de más', async () => {
    const svc = makeService('gsk-test');
    const treintaSpecs = Array.from({ length: 30 }, (_, i) => ({ label: `Spec ${i}`, value: `Valor ${i}` }));
    mockGen(async () => JSON.stringify({
      description: 'ok', suggestedCategoryId: null, suggestedTags: [], suggestedSpecs: treintaSpecs,
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedSpecs).toHaveLength(20);
  });

  it('suggestedSpecs queda vacío si el modelo no lo manda', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedSpecs).toEqual([]);
  });

  it('descarta suggestedCategoryId si no está en la lista de categorías del negocio', async () => {
    const svc = makeService('gsk-test', [cat('cat-1', 'Remeras')]);
    mockGen(async () => JSON.stringify({
      description: 'ok', suggestedCategoryId: 'cat-inventado', suggestedTags: [],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedCategoryId).toBeNull();
  });

  it('dedupea sin importar mayúsculas y recorta a 5 las etiquetas sugeridas', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => JSON.stringify({
      description: 'ok',
      suggestedCategoryId: null,
      suggestedTags: ['Verano', 'verano', 'algodón', 'casual', 'urbano', 'básico', 'oversize'],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedTags).toEqual(['verano', 'algodón', 'casual', 'urbano', 'básico']);
  });

  it('pide 3000 tokens y JSON', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }));

    await svc.assist('biz-1', dto);

    expect(generarTextoMock.mock.calls[0][1]).toMatchObject({ maxTokens: 3000, json: true });
  });

  it('loguea distinto cuando el modelo corta la respuesta (finishReason MAX_TOKENS)', async () => {
    const svc = makeService('gsk-test');
    const errorSpy = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    mockGen(async () => ({ text: '{"description": "algo cortado a la mit', finishReason: 'MAX_TOKENS' }));

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('cortada por maxOutputTokens'));
  });

  it('incluye categorías y etiquetas ya usadas en el mensaje enviado al modelo', async () => {
    const svc = makeService('gsk-test', [cat('cat-1', 'Remeras')], [
      { id: 't-1', name: 'verano', createdAt: '', usageCount: 3 },
    ]);
    mockGen(async () => JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }));

    await svc.assist('biz-1', { name: 'Remera oversize', existingDescription: 'Es cómoda' });

    const opts = generarTextoMock.mock.calls[0][1];
    expect(opts.user).toContain('Remera oversize');
    expect(opts.user).toContain('Es cómoda');
    expect(opts.user).toContain('cat-1: Remeras');
    expect(opts.user).toContain('verano');
    expect(opts.system).toContain('vendedor');
  });

  it('rechaza con 500 si la generación falla', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => { throw new Error('network down'); });

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza con 503 si el modelo responde 401 (API key inválida/vencida)', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => { throw new ApiError({ message: 'Invalid API Key', status: 401 }); });

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 503 });
  });

  it('rechaza con 500 si la respuesta no es JSON válido', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => 'esto no es json');

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza con 500 si la respuesta no trae description', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => JSON.stringify({ suggestedCategoryId: null, suggestedTags: [] }));

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
  });

  it('parsea el JSON aunque venga envuelto en fences de markdown', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => '```json\n' + JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }) + '\n```');

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
    mockGen(async () => 'esto no es json');

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('esto no es json'));
  });
});
