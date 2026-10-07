import { ListProductsTool, CreateProductTool, GenerateDescriptionTool } from './product.tools';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { ToolExecutionContext } from '../tool.interface';
import { AI_ASSIST_DIA_NEGOCIO } from '../../../common/cuota/limites';
import { ToolRegistryService } from '../tool-registry.service';

const ctx: ToolExecutionContext = {
  businessId: 'biz-1',
  userId: 'user-1',
  surface: OrbiSurface.PANEL,
  permissions: ['catalog.view', 'catalog.manage'],
};

describe('ListProductsTool', () => {
  it('pide catalog.view', () => {
    expect(new ListProductsTool({} as any).requiredPermissions).toEqual(['catalog.view']);
  });

  it('calls ProductsService.findAll and returns simplified list', async () => {
    const mockService = {
      findAll: jest.fn().mockResolvedValue({
        data: [
          { id: 'p1', name: 'iPhone', basePrice: 100, totalStock: 5, status: 'PUBLISHED', categoryName: 'Electrónica' },
        ],
        total: 1,
      }),
    };

    const tool = new ListProductsTool(mockService as any);
    const result = await tool.execute({ limit: 5 }, ctx);

    expect(result.success).toBe(true);
    expect(mockService.findAll).toHaveBeenCalledWith('biz-1', { search: undefined, limit: 5, page: 1 });
    expect((result.data as any).products[0].name).toBe('iPhone');
    expect((result.data as any).total).toBe(1);
  });
});

const CATEGORIA = '55555555-5555-4555-8555-555555555555';
const TAG1 = '66666666-6666-4666-8666-666666666666';
const TAG2 = '77777777-7777-4777-8777-777777777777';

/** Una base con las categorías y etiquetas del negocio, para el resolver de nombres. */
function prismaCon(
  categorias = [{ id: CATEGORIA, name: 'Perfumería' }, { id: '88888888-8888-4888-8888-888888888888', name: 'Ropa' }],
  etiquetas = [{ id: TAG1, name: 'Verano' }, { id: TAG2, name: 'Oferta' }],
) {
  return {
    category: { findMany: jest.fn().mockResolvedValue(categorias) },
    tag: { findMany: jest.fn().mockResolvedValue(etiquetas) },
  };
}

describe('CreateProductTool', () => {
  it('resuelve la categoría por nombre y llama a ProductsService.create con su id', async () => {
    const mockService = {
      create: jest.fn().mockResolvedValue({ id: 'p-new', name: 'Perfume' }),
    };

    const tool = new CreateProductTool(mockService as any, prismaCon() as any);
    const result = await tool.execute(
      { name: 'Perfume', basePrice: 5000, categoria: 'perfumeria' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockService.create).toHaveBeenCalledWith('biz-1', expect.objectContaining({
      name: 'Perfume',
      basePrice: 5000,
      categoryId: CATEGORIA,
      status: 'DRAFT',
    }));
    expect((result.data as any).productId).toBe('p-new');
  });

  it('una propuesta guardada con la forma de antes (categoryId, tags) se sigue ejecutando', async () => {
    const mockService = { create: jest.fn().mockResolvedValue({ id: 'p-new', name: 'Remera' }) };
    const tool = new CreateProductTool(mockService as any, prismaCon() as any);
    await tool.execute({ name: 'Remera', basePrice: 5000, categoryId: CATEGORIA, tags: [TAG1] }, ctx);
    expect(mockService.create).toHaveBeenCalledWith('biz-1', expect.objectContaining({ categoryId: CATEGORIA, tagIds: [TAG1] }));
  });

  it('pide catalog.manage, el mismo permiso que POST /products', () => {
    const tool = new CreateProductTool({} as any, {} as any);
    expect(tool.requiredPermissions).toEqual(['catalog.manage']);
    expect(tool.requiresConfirmation).toBe(true);
  });

  it('al modelo le pide el NOMBRE de la categoría, no un id', () => {
    const tool = new CreateProductTool({} as any, {} as any);
    const props = (tool.parameters as any).properties;
    expect(props.categoria.description).toContain('Nunca un id inventado');
    expect(props.categoryId).toBeUndefined();
    expect(tool.parameters.required).toEqual(['name', 'basePrice', 'categoria']);
  });
});

describe('CreateProductTool — la tarjeta y la validación', () => {
  function armar(categorias?: { id: string; name: string }[]) {
    const prisma = prismaCon(categorias);
    const tool = new CreateProductTool({} as any, prisma as any);
    const registry = new ToolRegistryService();
    registry.register(tool);
    return { prisma, tool, registry };
  }

  const validos = { name: 'Remera', basePrice: 5000, categoria: 'Ropa' };

  it('muestra nombre, precio, categoría, estado, descripción truncada y etiquetas', async () => {
    const { tool } = armar();
    const r = await tool.describirAccion({
      ...validos, status: 'PUBLISHED', etiquetas: ['verano', 'OFERTA'],
      description: `Algodón peinado\n"premium" ${'y'.repeat(200)}`,
    }, ctx);
    expect(r).toContain('"Remera"');
    expect(r).toContain('$5000');
    expect(r).toContain('"Ropa"');
    expect(r).toContain('publicado');
    expect(r).toContain('"Verano", "Oferta"');
    expect(r).not.toMatch(/[\r\n]/);
    const descripcion = r.match(/"(Algodón[^"]*)"/)?.[1] ?? '';
    expect(Array.from(descripcion).length).toBeLessThanOrEqual(80);
  });

  it('la tarjeta muestra el nombre REAL de la categoría, no como lo escribió la persona', async () => {
    const { tool } = armar();
    for (const escrito of ['perfumeria', 'Perfumería ', 'PERFUMERÍAS']) {
      expect(await tool.describirAccion({ ...validos, categoria: escrito }, ctx)).toContain('en la categoría "Perfumería"');
    }
  });

  it('sin estado dice que queda como borrador', async () => {
    const { tool } = armar();
    expect(await tool.describirAccion(validos, ctx)).toContain('borrador');
  });

  it('las categorías se buscan acotadas al negocio', async () => {
    const { registry, prisma } = armar();
    await registry.proponer('createProduct', validos, ctx);
    expect(prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1' } }));
  });

  it('categoría que no existe: sin tarjeta, y el modelo recibe cuáles hay', async () => {
    const { registry } = armar();
    const r = await registry.proponer('createProduct', { ...validos, categoria: 'Velas' }, ctx);
    expect(r).toEqual({
      error: expect.stringContaining('no existe la categoría "Velas"'),
      invalidos: [{ campo: 'categoría', motivo: expect.any(String), opciones: expect.arrayContaining(['Perfumería', 'Ropa']) }],
    });
  });

  it('categoría ambigua: pregunta cuál', async () => {
    const { registry } = armar([{ id: 'a', name: 'Remeras lisas' }, { id: 'b', name: 'Remeras estampadas' }]);
    const r = await registry.proponer('createProduct', { ...validos, categoria: 'remeras' }, ctx);
    expect(r).toEqual(expect.objectContaining({
      invalidos: [expect.objectContaining({ motivo: expect.stringContaining('preguntale cuál'), opciones: ['Remeras lisas', 'Remeras estampadas'] })],
    }));
  });

  it('faltan precio y categoría: los dos juntos, con sus nombres para la persona', async () => {
    const { registry } = armar();
    const r = await registry.proponer('createProduct', { name: 'Remera' }, ctx);
    expect(r).toEqual({ error: expect.stringContaining('Faltan datos: precio, categoría'), faltan: ['precio', 'categoría'] });
  });

  it('etiqueta que no existe: error con las que hay', async () => {
    const { registry } = armar();
    const r = await registry.proponer('createProduct', { ...validos, etiquetas: ['invierno'] }, ctx);
    expect(r).toEqual(expect.objectContaining({ invalidos: [expect.objectContaining({ campo: 'etiquetas', opciones: expect.arrayContaining(['Verano']) })] }));
  });

  it('valida con CreateProductDto: nombre de más de 150, precio 0 o como texto, estado inválido', async () => {
    const { registry } = armar();
    expect(await registry.proponer('createProduct', validos, ctx)).toEqual({ resumen: expect.any(String) });
    for (const malo of [
      { ...validos, name: 'n'.repeat(151) },
      { ...validos, basePrice: 0 },
      { ...validos, basePrice: '5000' },
      { ...validos, status: 'ARCHIVED' },
    ]) {
      expect(await registry.proponer('createProduct', malo, ctx)).toEqual(expect.objectContaining({ error: expect.any(String), invalidos: expect.any(Array) }));
    }
  });

  it('el rechazo del DTO nombra el campo como se lo pide a la persona', async () => {
    const { registry } = armar();
    const r = await registry.proponer('createProduct', { ...validos, basePrice: 0 }, ctx);
    expect(r).toEqual(expect.objectContaining({ error: expect.stringContaining('basePrice'), invalidos: [expect.objectContaining({ campo: 'precio' })] }));
  });
});

describe('GenerateDescriptionTool', () => {
  const respuesta = {
    description: 'Una remera cómoda',
    suggestedTags: ['remera', 'algodón'],
    suggestedSpecs: [],
    suggestedCategoryId: 'cat-1',
  };

  it('pide catalog.manage (como POST /products/ai-assist) y no exige confirmación', () => {
    // No persiste nada, pero gasta IA paga: con catalog.view (Empleado) tendría
    // por Orbi algo que por HTTP se le niega.
    const tool = new GenerateDescriptionTool({} as any, {} as any);
    expect(tool.requiredPermissions).toEqual(['catalog.manage']);
    expect((tool as { requiresConfirmation?: boolean }).requiresConfirmation).toBeFalsy();
  });

  it('consume la cuota ai-assist del negocio y pasa por ProductAiService.assist', async () => {
    const mockAiService = { assist: jest.fn().mockResolvedValue(respuesta) };
    const cuota = { consumir: jest.fn().mockResolvedValue(true) };

    const tool = new GenerateDescriptionTool(mockAiService as any, cuota as any);
    const result = await tool.execute({ productName: 'Remera algodón' }, ctx);

    // Misma clave y mismo tope que el endpoint: las dos vías suman al mismo
    // contador diario del negocio.
    expect(cuota.consumir).toHaveBeenCalledWith('ai-assist:biz-1', AI_ASSIST_DIA_NEGOCIO);
    expect(result.success).toBe(true);
    expect(mockAiService.assist).toHaveBeenCalledWith(
      'biz-1',
      { name: 'Remera algodón', existingDescription: undefined },
      expect.objectContaining({ memberId: 'user-1' }),
    );
    expect((result.data as any).description).toBe('Una remera cómoda');
  });

  it('devuelve el consumo de la IA y le pasa a assist el turno y el miembro', async () => {
    const uso = { provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 900, completionTokens: 420 };
    const mockAiService = {
      assist: jest.fn().mockImplementation(async (_biz: string, _dto: unknown, origen: any) => {
        origen.alConsumir(uso);
        return respuesta;
      }),
    };
    const cuota = { consumir: jest.fn().mockResolvedValue(true) };

    const tool = new GenerateDescriptionTool(mockAiService as any, cuota as any);
    const result = await tool.execute({ productName: 'Remera algodón' }, { ...ctx, turnId: 'turno-1' });

    expect(result.consumo).toEqual(uso);
    expect(mockAiService.assist).toHaveBeenCalledWith(
      'biz-1',
      { name: 'Remera algodón', existingDescription: undefined },
      expect.objectContaining({ memberId: 'user-1', turnId: 'turno-1', alConsumir: expect.any(Function) }),
    );
  });

  it('si la cuota del día se agotó devuelve success:false y no llama a la IA', async () => {
    const mockAiService = { assist: jest.fn() };
    const cuota = { consumir: jest.fn().mockResolvedValue(false) };

    const tool = new GenerateDescriptionTool(mockAiService as any, cuota as any);
    const result = await tool.execute({ productName: 'Remera' }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('máximo de ayudas de IA por hoy');
    expect(mockAiService.assist).not.toHaveBeenCalled();
  });
});
