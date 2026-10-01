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

describe('CreateProductTool', () => {
  it('calls ProductsService.create with correct args', async () => {
    const mockService = {
      create: jest.fn().mockResolvedValue({ id: 'p-new', name: 'Remera' }),
    };

    const tool = new CreateProductTool(mockService as any, {} as any);
    const result = await tool.execute(
      { name: 'Remera', basePrice: 5000, categoryId: 'cat-1' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockService.create).toHaveBeenCalledWith('biz-1', expect.objectContaining({
      name: 'Remera',
      basePrice: 5000,
      categoryId: 'cat-1',
      status: 'DRAFT',
    }));
    expect((result.data as any).productId).toBe('p-new');
  });

  it('pide catalog.manage, el mismo permiso que POST /products', () => {
    const tool = new CreateProductTool({} as any, {} as any);
    expect(tool.requiredPermissions).toEqual(['catalog.manage']);
    expect(tool.requiresConfirmation).toBe(true);
  });
});

describe('CreateProductTool — la tarjeta y la validación', () => {
  const CATEGORIA = '55555555-5555-4555-8555-555555555555';
  const TAG1 = '66666666-6666-4666-8666-666666666666';
  const TAG2 = '77777777-7777-4777-8777-777777777777';

  function armar(categoria: unknown = { name: 'Ropa' }) {
    const prisma = { category: { findFirst: jest.fn().mockResolvedValue(categoria) } };
    const tool = new CreateProductTool({} as any, prisma as any);
    const registry = new ToolRegistryService();
    registry.register(tool);
    return { prisma, tool, registry };
  }

  const validos = { name: 'Remera', basePrice: 5000, categoryId: CATEGORIA };

  it('muestra nombre, precio, categoría, estado, descripción truncada y etiquetas', async () => {
    const { tool } = armar();
    const r = await tool.describirAccion({
      ...validos, status: 'PUBLISHED', tags: [TAG1, TAG2],
      description: `Algodón peinado\n"premium" ${'y'.repeat(200)}`,
    }, ctx);
    expect(r).toContain('"Remera"');
    expect(r).toContain('$5000');
    expect(r).toContain('"Ropa"');
    expect(r).toContain('publicado');
    expect(r).toContain('2 etiquetas');
    expect(r).not.toMatch(/[\r\n]/);
    const descripcion = r.match(/"(Algodón[^"]*)"/)?.[1] ?? '';
    expect(Array.from(descripcion).length).toBeLessThanOrEqual(80);
  });

  it('sin estado dice que queda como borrador', async () => {
    const { tool } = armar();
    expect(await tool.describirAccion(validos, ctx)).toContain('borrador');
  });

  it('la categoría se busca acotada al negocio; si no es suya, error sin tarjeta', async () => {
    const { registry, prisma } = armar(null);
    expect(await registry.proponer('createProduct', validos, ctx)).toEqual({ error: 'Categoría no encontrada' });
    expect(prisma.category.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: CATEGORIA, businessId: 'biz-1' }),
    }));
  });

  it('valida con CreateProductDto: nombre de más de 150, categoría no UUID, precio 0, etiquetas no UUID', async () => {
    const { registry } = armar();
    expect(await registry.proponer('createProduct', validos, ctx)).toEqual({ resumen: expect.any(String) });
    for (const malo of [
      { ...validos, name: 'n'.repeat(151) },
      { ...validos, categoryId: 'ropa' },
      { ...validos, basePrice: 0 },
      { ...validos, tags: ['verano'] },
      { ...validos, status: 'ARCHIVED' },
    ]) {
      expect(await registry.proponer('createProduct', malo, ctx)).toEqual({ error: expect.any(String) });
    }
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
    expect(mockAiService.assist).toHaveBeenCalledWith('biz-1', {
      name: 'Remera algodón',
      existingDescription: undefined,
    });
    expect((result.data as any).description).toBe('Una remera cómoda');
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
