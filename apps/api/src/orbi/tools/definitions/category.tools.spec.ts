import { ListCategoriesTool, CreateCategoryTool } from './category.tools';
import { ToolRegistryService } from '../tool-registry.service';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { ToolExecutionContext } from '../tool.interface';

const ctx: ToolExecutionContext = {
  businessId: 'biz-1',
  userId: 'user-1',
  surface: OrbiSurface.PANEL,
  permissions: ['catalog.view', 'catalog.manage'],
};

describe('ListCategoriesTool', () => {
  it('pide catalog.view, como listProducts, y no escribe', () => {
    const tool = new ListCategoriesTool({} as any);
    expect(tool.requiredPermissions).toEqual(['catalog.view']);
    expect((tool as { requiresConfirmation?: boolean }).requiresConfirmation).toBeFalsy();
  });

  it('devuelve nombre exacto y cantidad de productos, del negocio de la sesión', async () => {
    const service = {
      findAll: jest.fn().mockResolvedValue([
        { id: 'c1', name: 'Perfumería', productCount: 2, isActive: true },
        { id: 'c2', name: 'Regalos', productCount: 0, isActive: false },
      ]),
    };
    const r = await new ListCategoriesTool(service as any).execute({}, ctx);
    expect(service.findAll).toHaveBeenCalledWith('biz-1', true);
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      categorias: [{ id: 'c1', nombre: 'Perfumería', productos: 2 }, { id: 'c2', nombre: 'Regalos', productos: 0, oculta: true }],
      total: 2,
    });
  });
});

describe('CreateCategoryTool', () => {
  function armar(existentes = [{ id: 'c1', name: 'Perfumería' }]) {
    const service = { create: jest.fn().mockResolvedValue({ id: 'nueva', name: 'Velas' }) };
    const prisma = { category: { findMany: jest.fn().mockResolvedValue(existentes) } };
    const tool = new CreateCategoryTool(service as any, prisma as any);
    const registry = new ToolRegistryService();
    registry.register(tool);
    return { service, prisma, tool, registry };
  }

  it('pide catalog.manage (como POST /categories) y confirmación', () => {
    const { tool } = armar();
    expect(tool.requiredPermissions).toEqual(['catalog.manage']);
    expect(tool.requiresConfirmation).toBe(true);
  });

  it('propone con la tarjeta que nombra la categoría', async () => {
    const { registry } = armar();
    expect(await registry.proponer('createCategory', { name: 'Velas' }, ctx)).toEqual({ resumen: 'Crear la categoría "Velas" en el catálogo' });
  });

  it('una que ya existe (sin tildes, mayúsculas ni plural) no se duplica', async () => {
    const { registry, prisma } = armar();
    const r = await registry.proponer('createCategory', { name: 'PERFUMERIAS' }, ctx);
    expect(r).toEqual(expect.objectContaining({ invalidos: [expect.objectContaining({ motivo: expect.stringContaining('ya existe la categoría "Perfumería"') })] }));
    expect(prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1' } }));
  });

  it('sin nombre, o con uno de más de 60: error sin tarjeta', async () => {
    const { registry } = armar();
    expect(await registry.proponer('createCategory', {}, ctx)).toEqual(expect.objectContaining({ faltan: ['nombre'] }));
    expect(await registry.proponer('createCategory', { name: 'x'.repeat(61) }, ctx)).toEqual(expect.objectContaining({ invalidos: [expect.objectContaining({ campo: 'nombre' })] }));
  });

  it('al confirmar crea con el service, en el negocio y a nombre de quien confirma', async () => {
    const { service, tool } = armar();
    const r = await tool.execute({ name: 'Velas' }, ctx);
    expect(service.create).toHaveBeenCalledWith('biz-1', { name: 'Velas' }, 'user-1');
    expect(r).toEqual(expect.objectContaining({ success: true, data: { categoryId: 'nueva', name: 'Velas' } }));
  });
});
