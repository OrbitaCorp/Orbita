import { ServiceUnavailableException } from '@nestjs/common';
import { ApiError } from '@google/genai';
import { ProductAiService, sanitizarVariantesSugeridas } from '../../src/products/product-ai.service';
import type { CategoryListItem } from '../../src/categories/categories.service';
import { generarTexto } from '../../src/orbi/llm/text-generation';
import { createGeminiClient } from '../../src/orbi/llm/gemini-client';
import { createGroqClient } from '../../src/orbi/llm/groq-client';

// Unit test de ProductAiService (RBT-684 — Orbi asiste descripción + categoría +
// etiquetas y escaneo con imagen). No pega a ninguna API: mockea generarTexto/createGeminiClient
// y CategoriesService/TagsService como objetos simples.
jest.mock('../../src/orbi/llm/text-generation');
jest.mock('../../src/orbi/llm/gemini-client', () => {
  const actual = jest.requireActual('../../src/orbi/llm/gemini-client');
  return {
    ...actual,
    createGeminiClient: jest.fn(),
  };
});
jest.mock('../../src/orbi/llm/groq-client', () => {
  const actual = jest.requireActual('../../src/orbi/llm/groq-client');
  return { ...actual, createGroqClient: jest.fn() };
});
const createGroqClientMock = createGroqClient as jest.MockedFunction<typeof createGroqClient>;
const generarTextoMock = generarTexto as jest.MockedFunction<typeof generarTexto>;
const createGeminiClientMock = createGeminiClient as jest.MockedFunction<typeof createGeminiClient>;

type TagUsado = { id: string; name: string; createdAt: string; usageCount: number };

// Medidor de consumo (UsageMeteringService) simulado: cada test puede mirar los
// eventos que se habrían guardado en usage_events.
const trackMock = jest.fn();
const usageMetering = { track: trackMock } as any;
beforeEach(() => trackMock.mockReset());

function makeService(
  apiKey: string | undefined,
  categorias: CategoryListItem[] = [],
  tagsUsados: TagUsado[] = [],
) {
  const config = { get: () => apiKey } as any;
  const categoriesService = { findAll: async () => categorias } as any;
  const tagsService = { findAll: async () => tagsUsados } as any;
  return new ProductAiService(config, categoriesService, tagsService, usageMetering);
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

  it('assist ya no pide ni devuelve variantes: eso es un pedido aparte', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [], suggestedVariants: [{ name: 'Talle', values: ['S', 'M'] }] }));

    const result = await svc.assist('biz-1', dto);

    expect(result).not.toHaveProperty('suggestedVariants');
    expect((generarTextoMock.mock.calls[0][1] as { system: string }).system).not.toContain('suggestedVariants');
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
    const svc = new ProductAiService(config, categoriesService, tagsService, usageMetering);
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

describe('ProductAiService.scanProductImage (unit)', () => {
  const fakeFile = {
    buffer: Buffer.from('fake-image-bytes'),
    mimetype: 'image/jpeg',
    originalname: 'test.jpg',
  } as any;

  beforeEach(() => {
    createGeminiClientMock.mockReset();
  });

  it('rechaza con 400 si falta el archivo', async () => {
    const svc = makeService('test-key');
    await expect(svc.scanProductImage('biz-1', undefined as any)).rejects.toMatchObject({ status: 400 });
  });

  it('devuelve nombre, descripción, categoría, tags y specs para productos técnicos', async () => {
    const svc = makeService('test-key', [cat('cat-relojes', 'Relojes')]);
    createGeminiClientMock.mockReturnValue({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            name: 'Reloj Q&Q KW89J205Y Dama',
            description: 'Reloj elegante con incrustaciones.',
            suggestedCategoryId: 'cat-relojes',
            suggestedTags: ['reloj', 'q&q'],
            suggestedSpecs: [{ label: 'Modelo', value: 'KW89J205Y' }, { label: 'Movimiento', value: 'Cuarzo' }],
          }),
        }),
      },
    } as any);

    const result = await svc.scanProductImage('biz-1', fakeFile);

    expect(result.name).toBe('Reloj Q&Q KW89J205Y Dama');
    expect(result.description).toBe('Reloj elegante con incrustaciones.');
    expect(result.suggestedCategoryId).toBe('cat-relojes');
    expect(result.suggestedTags).toEqual(['reloj', 'q&q']);
    expect(result.suggestedSpecs).toEqual([
      { label: 'Modelo', value: 'KW89J205Y' },
      { label: 'Movimiento', value: 'Cuarzo' },
    ]);
  });

  it('permite specs vacíos cuando es indumentaria u objeto sin ficha técnica', async () => {
    const svc = makeService('test-key', [cat('cat-ropa', 'Ropa')]);
    createGeminiClientMock.mockReturnValue({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            name: 'Remera básica lisa',
            description: 'Remera 100% algodón suave.',
            suggestedCategoryId: 'cat-ropa',
            suggestedTags: ['remera', 'algodon'],
            suggestedSpecs: [],
          }),
        }),
      },
    } as any);

    const result = await svc.scanProductImage('biz-1', fakeFile);

    expect(result.name).toBe('Remera básica lisa');
    expect(result.suggestedSpecs).toEqual([]);
    expect(result.suggestedVariants).toEqual([]);
  });

  it('devuelve las variantes sugeridas al escanear un celular, sin tocar las specs', async () => {
    const svc = makeService('test-key');
    createGeminiClientMock.mockReturnValue({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            name: 'Apple iPhone 16 Pro Titanio Desierto',
            description: 'Smartphone premium.',
            suggestedCategoryId: null,
            suggestedTags: ['iphone'],
            suggestedSpecs: [{ label: 'Marca', value: 'Apple' }],
            suggestedVariants: [{ name: 'Almacenamiento', values: ['128 GB', '256 GB', '512 GB'], usual: ['128 GB', '256 GB'] }],
          }),
        }),
      },
    } as any);

    const result = await svc.scanProductImage('biz-1', fakeFile);

    expect(result.suggestedVariants).toEqual([
      { name: 'Almacenamiento', values: ['128 GB', '256 GB', '512 GB'], usual: ['128 GB', '256 GB'] },
    ]);
    expect(result.suggestedSpecs).toEqual([{ label: 'Marca', value: 'Apple' }]);
  });

  it('rechaza con 503 si createGeminiClient tira ServiceUnavailableException', async () => {
    const svc = makeService(undefined);
    createGeminiClientMock.mockImplementation(() => {
      throw new ServiceUnavailableException('GEMINI_API_KEY no configurada');
    });

    await expect(svc.scanProductImage('biz-1', fakeFile)).rejects.toMatchObject({ status: 503 });
  });
});


describe('ProductAiService.suggestVariants (unit)', () => {
  it('devuelve las opciones de variante de ESTE producto (no las del rubro del negocio)', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => JSON.stringify({
      suggestedVariants: [
        { name: 'Almacenamiento', values: ['128 GB', '256 GB', '512 GB', '1 TB'], usual: ['128 GB', '256 GB'] },
        { name: 'Color', values: ['Titanio negro', 'Titanio blanco', 'Titanio natural', 'Titanio desierto'], usual: [] },
      ],
    }));

    const result = await svc.suggestVariants('biz-1', { name: 'iPhone 16 Pro' });

    expect(result.suggestedVariants).toEqual([
      { name: 'Almacenamiento', values: ['128 GB', '256 GB', '512 GB', '1 TB'], usual: ['128 GB', '256 GB'] },
      { name: 'Color', values: ['Titanio negro', 'Titanio blanco', 'Titanio natural', 'Titanio desierto'], usual: [] },
    ]);
  });

  it('usa un prompt corto propio (sin descripción, categorías ni ficha) y pasa el nombre y la descripción', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => JSON.stringify({ suggestedVariants: [] }));

    await svc.suggestVariants('biz-1', { name: 'Zapatillas Nike', description: 'Urbanas' });

    const opts = generarTextoMock.mock.calls[0][1] as { system: string; user: string; maxTokens: number; json?: boolean };
    expect(opts.system).toContain('no en el rubro del negocio');
    expect(opts.system).not.toContain('suggestedSpecs');
    expect(opts.user).toContain('Zapatillas Nike');
    expect(opts.user).toContain('Urbanas');
    expect(opts.json).toBe(true);
    expect(opts.maxTokens).toBeLessThan(3000);
  });

  it('devuelve [] si el modelo responde algo con otra forma o no manda variantes', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => JSON.stringify({ suggestedVariants: 'no es un array' }));
    expect((await svc.suggestVariants('biz-1', dto)).suggestedVariants).toEqual([]);

    mockGen(async () => JSON.stringify(['algo', 'raro']));
    expect((await svc.suggestVariants('biz-1', dto)).suggestedVariants).toEqual([]);
  });

  it('mapea los errores igual que el asistente: 503 si la API key es inválida, 500 si no hay JSON', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => { throw new ApiError({ message: 'Invalid API Key', status: 401 }); });
    await expect(svc.suggestVariants('biz-1', dto)).rejects.toMatchObject({ status: 503 });

    mockGen(async () => 'esto no es json');
    await expect(svc.suggestVariants('biz-1', dto)).rejects.toMatchObject({ status: 500 });
  });
});

describe('Registro de consumo de IA de producto (unit)', () => {
  const eventos = () => trackMock.mock.calls.map((c) => c[0]);

  it('assist registra tokens de entrada y salida con proveedor, modelo y función', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => ({
      text: JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }),
      provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 900, completionTokens: 420,
    }));

    await svc.assist('biz-1', dto);

    expect(eventos()).toEqual([
      expect.objectContaining({ providerSlug: 'gemini', businessId: 'biz-1', category: 'prompt_tokens', quantity: 900, unit: 'tokens', metadata: { feature: 'ai-assist', model: 'gemini-3.6-flash' } }),
      expect.objectContaining({ providerSlug: 'gemini', businessId: 'biz-1', category: 'completion_tokens', quantity: 420, unit: 'tokens', metadata: { feature: 'ai-assist', model: 'gemini-3.6-flash' } }),
    ]);
  });

  it('assist con origen: los eventos llevan memberId y turnId, y alConsumir recibe el consumo real', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => ({
      text: JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }),
      provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 900, completionTokens: 420, cachedTokens: 100, thinkingTokens: 50,
    }));
    const alConsumir = jest.fn();

    await svc.assist('biz-1', dto, { memberId: 'm1', turnId: 't1', alConsumir });

    expect(eventos()).toEqual([
      expect.objectContaining({ category: 'prompt_tokens', metadata: { feature: 'ai-assist', model: 'gemini-3.6-flash', memberId: 'm1', turnId: 't1' } }),
      expect.objectContaining({ category: 'completion_tokens', metadata: { feature: 'ai-assist', model: 'gemini-3.6-flash', memberId: 'm1', turnId: 't1' } }),
    ]);
    expect(alConsumir).toHaveBeenCalledTimes(1);
    expect(alConsumir).toHaveBeenCalledWith({
      provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 900, completionTokens: 420, cachedTokens: 100, thinkingTokens: 50,
    });
  });

  it('assist sin origen no agrega memberId ni turnId a la metadata', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => ({
      text: JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }),
      provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 10, completionTokens: 5,
    }));

    await svc.assist('biz-1', dto);

    for (const e of eventos()) expect(Object.keys(e.metadata)).toEqual(['feature', 'model']);
  });

  it('suggestVariants registra su propia función y, si respondió Groq de respaldo, lo marca', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => ({
      text: JSON.stringify({ suggestedVariants: [] }),
      provider: 'groq', model: 'openai/gpt-oss-20b', promptTokens: 300, completionTokens: 80, viaFallback: true,
    }));

    await svc.suggestVariants('biz-1', dto);

    expect(eventos()).toEqual([
      expect.objectContaining({ providerSlug: 'groq', category: 'prompt_tokens', quantity: 300, metadata: { feature: 'ai-variants', model: 'openai/gpt-oss-20b', viaFallback: true } }),
      expect.objectContaining({ providerSlug: 'groq', category: 'completion_tokens', quantity: 80 }),
    ]);
  });

  it('no registra nada si el proveedor no informó consumo (no inventa un 0)', async () => {
    const svc = makeService('gsk-test');
    mockGen(async () => JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }));

    await svc.assist('biz-1', dto);

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('registra el consumo aunque después la respuesta no sea JSON válido (ya se cobró)', async () => {
    const svc = makeService('gsk-test');
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    mockGen(async () => ({ text: 'esto no es json', provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 500, completionTokens: 50 }));

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
    expect(trackMock).toHaveBeenCalledTimes(2);
  });

  it('el escaneo con foto registra el consumo de Gemini como ai-scan', async () => {
    const svc = makeService('test-key');
    createGeminiClientMock.mockReturnValue({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({ name: 'Reloj', description: 'Un reloj.', suggestedCategoryId: null, suggestedTags: [], suggestedSpecs: [] }),
          usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 200, thoughtsTokenCount: 50 },
        }),
      },
    } as any);

    await svc.scanProductImage('biz-1', { buffer: Buffer.from('x'), mimetype: 'image/jpeg', originalname: 't.jpg' } as any);

    expect(eventos()).toEqual([
      expect.objectContaining({ providerSlug: 'gemini', category: 'prompt_tokens', quantity: 1200, metadata: expect.objectContaining({ feature: 'ai-scan' }) }),
      // La salida incluye los tokens de razonamiento: se cobran como salida.
      expect.objectContaining({ providerSlug: 'gemini', category: 'completion_tokens', quantity: 250 }),
    ]);
  });
});

describe('ProductAiService.scanProductImage — respaldo con Groq (unit)', () => {
  const fakeFile = { buffer: Buffer.from('fake-image-bytes'), mimetype: 'image/jpeg', originalname: 't.jpg' } as any;
  const eventos = () => trackMock.mock.calls.map((c) => c[0]);
  const jsonScan = JSON.stringify({ name: 'iPhone 16 Pro', description: 'Smartphone.', suggestedCategoryId: null, suggestedTags: ['iphone'], suggestedSpecs: [] });

  const gemini503 = () => Object.assign(new Error('high demand'), { status: 503 });
  const geminiCaido = () => createGeminiClientMock.mockReturnValue({ models: { generateContent: jest.fn().mockRejectedValue(gemini503()) } } as any);
  const groqResponde = (content: string) => {
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content } }], usage: { prompt_tokens: 2500, completion_tokens: 400 } });
    createGroqClientMock.mockReturnValue({ chat: { completions: { create } } } as any);
    return create;
  };

  beforeEach(() => {
    createGeminiClientMock.mockReset();
    createGroqClientMock.mockReset();
  });

  it('si TODOS los modelos Gemini están no disponibles, escanea con Groq y registra el consumo como respaldo', async () => {
    const svc = makeService('test-key');
    geminiCaido();
    const create = groqResponde(jsonScan);

    const result = await svc.scanProductImage('biz-1', fakeFile);

    expect(result.name).toBe('iPhone 16 Pro');
    const args = create.mock.calls[0][0];
    expect(args.model).toBe('qwen/qwen3.8-27b');
    expect(args.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(eventos()).toEqual([
      expect.objectContaining({ providerSlug: 'groq', category: 'prompt_tokens', quantity: 2500, metadata: { feature: 'ai-scan', model: 'qwen/qwen3.8-27b', viaFallback: true } }),
      expect.objectContaining({ providerSlug: 'groq', category: 'completion_tokens', quantity: 400 }),
    ]);
  });

  it('no usa Groq si Gemini respondió pero con algo ilegible: eso no es indisponibilidad', async () => {
    const svc = makeService('test-key');
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    createGeminiClientMock.mockReturnValue({ models: { generateContent: jest.fn().mockResolvedValue({ text: 'no es json' }) } } as any);

    await expect(svc.scanProductImage('biz-1', fakeFile)).rejects.toMatchObject({ status: 500 });
    expect(createGroqClientMock).not.toHaveBeenCalled();
  });

  it('no usa Groq si un modelo Gemini falló por indisponibilidad pero otro contestó ilegible (no fueron todos)', async () => {
    const svc = makeService('test-key');
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    const generateContent = jest.fn().mockRejectedValueOnce(gemini503()).mockResolvedValue({ text: 'no es json' });
    createGeminiClientMock.mockReturnValue({ models: { generateContent } } as any);

    await expect(svc.scanProductImage('biz-1', fakeFile)).rejects.toMatchObject({ status: 500 });
    expect(createGroqClientMock).not.toHaveBeenCalled();
  });

  it('sin GROQ_API_KEY no hay respaldo: falla como antes', async () => {
    const svc = makeService('test-key');
    (svc as any).config = { get: (k: string) => (k === 'GEMINI_API_KEY' ? 'test-key' : undefined) };
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    geminiCaido();

    await expect(svc.scanProductImage('biz-1', fakeFile)).rejects.toMatchObject({ status: 500 });
    expect(createGroqClientMock).not.toHaveBeenCalled();
  });

  it('si Groq también falla (ej. límite de tokens por minuto), devuelve el mismo error de siempre', async () => {
    const svc = makeService('test-key');
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    geminiCaido();
    createGroqClientMock.mockReturnValue({ chat: { completions: { create: jest.fn().mockRejectedValue(Object.assign(new Error('rate limit'), { status: 429 })) } } } as any);

    await expect(svc.scanProductImage('biz-1', fakeFile)).rejects.toMatchObject({ status: 500 });
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('no manda a Groq una imagen que supera su máximo de 4 MB en base64', async () => {
    const svc = makeService('test-key');
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});
    geminiCaido();

    await expect(svc.scanProductImage('biz-1', { ...fakeFile, buffer: Buffer.alloc(3.2 * 1024 * 1024) })).rejects.toMatchObject({ status: 500 });
    expect(createGroqClientMock).not.toHaveBeenCalled();
  });
});

describe('sanitizarVariantesSugeridas (unit)', () => {
  it('devuelve [] si no es un array', () => {
    expect(sanitizarVariantesSugeridas(undefined)).toEqual([]);
    expect(sanitizarVariantesSugeridas({ name: 'Talle' })).toEqual([]);
    expect(sanitizarVariantesSugeridas('Talle')).toEqual([]);
  });

  it('descarta opciones sin nombre o con menos de 2 valores, y elementos que no son objetos', () => {
    expect(sanitizarVariantesSugeridas([
      { name: '', values: ['S', 'M'] },
      { name: 'Talle', values: ['S'] },
      { name: 'Color', values: 'Negro' },
      null,
      'Talle',
      { name: 'Número', values: ['40', '41'], usual: ['40'] },
    ])).toEqual([{ name: 'Número', values: ['40', '41'], usual: ['40'] }]);
  });

  it('dedupea valores y nombres, recorta a 12 valores y a 3 opciones', () => {
    const muchos = Array.from({ length: 20 }, (_, i) => `V${i}`);
    const r = sanitizarVariantesSugeridas([
      { name: 'Color', values: ['Negro', ' Negro ', 'Blanco'], usual: [] },
      { name: 'color', values: ['Rojo', 'Azul'] },
      { name: 'Talle', values: muchos, usual: muchos },
      { name: 'Tamaño', values: ['Chico', 'Grande'] },
      { name: 'Extra', values: ['a', 'b'] },
    ]);
    expect(r.map((o) => o.name)).toEqual(['Color', 'Talle', 'Tamaño']);
    expect(r[0].values).toEqual(['Negro', 'Blanco']);
    expect(r[1].values).toHaveLength(12);
    expect(r[1].usual).toHaveLength(6);
  });

  it('"usual" solo puede tener valores que estén en "values"', () => {
    const [op] = sanitizarVariantesSugeridas([
      { name: 'Almacenamiento', values: ['128 GB', '256 GB'], usual: ['256 GB', '2 TB'] },
    ]);
    expect(op.usual).toEqual(['256 GB']);
  });
});
