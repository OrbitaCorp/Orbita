import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { ProductsService } from '../../../products/products.service';
import type { ProductAiService } from '../../../products/product-ai.service';

export class ListProductsTool implements OrbiTool {
  name = 'listProducts';
  description = 'Listar productos del negocio. Úsalo para mostrar al usuario qué productos tiene cargados, buscar uno específico, o dar contexto antes de crear uno nuevo.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Texto para buscar por nombre o SKU (opcional)' },
      limit: { type: 'number', description: 'Cantidad máxima de productos a devolver (default 10, max 20)' },
    },
  };

  constructor(private readonly productsService: ProductsService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const limit = Math.min(Number(args.limit) || 10, 20);
      const result = await this.productsService.findAll(ctx.businessId, {
        search: args.search as string | undefined,
        limit,
        page: 1,
      });

      const simplified = result.data.map(p => ({
        id: p.id,
        name: p.name,
        price: p.basePrice,
        stock: p.totalStock,
        status: p.status,
        category: p.categoryName,
      }));

      return {
        success: true,
        label: `Encontré ${result.total} producto${result.total === 1 ? '' : 's'}`,
        data: { products: simplified, total: result.total },
      };
    } catch (error) {
      return { success: false, error: `Error al listar productos: ${error}`, label: 'Error listando productos' };
    }
  }
}

export class CreateProductTool implements OrbiTool {
  name = 'createProduct';
  description = 'Crear un nuevo producto en el catálogo del negocio. Necesitás al menos nombre, precio y categoría. El producto se crea como borrador por defecto.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['products:write'];
  requiresConfirmation = true;

  describirAccion(args: Record<string, unknown>): string {
    const precio = typeof args.basePrice === 'number' ? ` a $${args.basePrice}` : '';
    return `Crear el producto "${String(args.name ?? 'sin nombre')}"${precio}`;
  }

  parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nombre del producto' },
      description: { type: 'string', description: 'Descripción del producto (opcional)' },
      basePrice: { type: 'number', description: 'Precio base del producto en pesos argentinos' },
      categoryId: { type: 'string', description: 'ID de la categoría (UUID). Usá listProducts para obtener las categorías disponibles.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'IDs de etiquetas (UUIDs, opcional)' },
      status: { type: 'string', enum: ['PUBLISHED', 'DRAFT'], description: 'Estado inicial (default DRAFT)' },
    },
    required: ['name', 'basePrice', 'categoryId'],
  };

  constructor(private readonly productsService: ProductsService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const product = await this.productsService.create(ctx.businessId, {
        name: args.name as string,
        description: args.description as string | undefined,
        basePrice: Number(args.basePrice),
        categoryId: args.categoryId as string,
        tagIds: args.tags as string[] | undefined,
        status: (args.status as 'PUBLISHED' | 'DRAFT') ?? 'DRAFT',
        variants: [{ price: Number(args.basePrice), optionValues: [] }],
      });

      return {
        success: true,
        label: `Producto "${args.name}" creado`,
        data: { productId: product.id, name: product.name },
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude crear el producto: ${msg}`, label: 'Error creando producto' };
    }
  }
}

export class GenerateDescriptionTool implements OrbiTool {
  name = 'generateDescription';
  description = 'Generar una descripción con IA para un producto, además de sugerir categoría, etiquetas y especificaciones técnicas. Útil cuando el usuario necesita ayuda redactando.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      productName: { type: 'string', description: 'Nombre del producto para el que generar la descripción' },
      existingDescription: { type: 'string', description: 'Borrador existente para mejorar (opcional)' },
    },
    required: ['productName'],
  };

  constructor(private readonly productAiService: ProductAiService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const result = await this.productAiService.assist(ctx.businessId, {
        name: args.productName as string,
        existingDescription: args.existingDescription as string | undefined,
      });

      return {
        success: true,
        label: `Descripción generada para "${args.productName}"`,
        data: {
          description: result.description,
          suggestedTags: result.suggestedTags,
          suggestedSpecs: result.suggestedSpecs,
          suggestedCategoryId: result.suggestedCategoryId,
        },
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude generar la descripción: ${msg}`, label: 'Error generando descripción' };
    }
  }
}
