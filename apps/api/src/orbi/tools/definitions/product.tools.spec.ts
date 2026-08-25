import { ListProductsTool, CreateProductTool, GenerateDescriptionTool } from './product.tools';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { ToolExecutionContext } from '../tool.interface';

const ctx: ToolExecutionContext = {
  businessId: 'biz-1',
  userId: 'user-1',
  surface: OrbiSurface.PANEL,
  permissions: ['products:write'],
};

describe('ListProductsTool', () => {
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

    const tool = new CreateProductTool(mockService as any);
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

  it('requires products:write permission', () => {
    const tool = new CreateProductTool({} as any);
    expect(tool.requiredPermissions).toContain('products:write');
  });
});

describe('GenerateDescriptionTool', () => {
  it('passes through to ProductAiService.assist', async () => {
    const mockAiService = {
      assist: jest.fn().mockResolvedValue({
        description: 'Una remera cómoda',
        suggestedTags: ['remera', 'algodón'],
        suggestedSpecs: [],
        suggestedCategoryId: 'cat-1',
      }),
    };

    const tool = new GenerateDescriptionTool(mockAiService as any);
    const result = await tool.execute({ productName: 'Remera algodón' }, ctx);

    expect(result.success).toBe(true);
    expect(mockAiService.assist).toHaveBeenCalledWith('biz-1', {
      name: 'Remera algodón',
      existingDescription: undefined,
    });
    expect((result.data as any).description).toBe('Una remera cómoda');
  });
});
