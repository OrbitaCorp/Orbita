import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { ProductsService } from '../../../products/products.service';
import type { ProductAiService } from '../../../products/product-ai.service';
import type { CuotaService } from '../../../common/cuota/cuota.service';
import { AI_ASSIST_DIA_NEGOCIO } from '../../../common/cuota/limites';
import type { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from '../../../products/dto/create-product.dto';
import { AccionInvalida, validarConDto } from '../acciones/validar-args';
import { cantidad, entreComillas, monto, presente } from '../acciones/formato';

// Lo que se le manda a ProductsService.create, armado en un solo lugar:
// validarArgs() lo pasa por CreateProductDto (el de POST /products) y
// execute() lo escribe, así lo validado es exactamente lo escrito. Sin
// conversiones de tipo: un precio "5000" como texto lo rechaza el DTO, igual
// que por HTTP.
function aDtoProducto(args: Record<string, unknown>): CreateProductDto {
  return {
    name: args.name as string,
    description: (args.description ?? undefined) as string | undefined,
    basePrice: args.basePrice as number,
    categoryId: args.categoryId as string,
    tagIds: (args.tags ?? undefined) as string[] | undefined,
    status: (args.status as 'PUBLISHED' | 'DRAFT' | undefined) ?? 'DRAFT',
    variants: [{ price: args.basePrice as number, optionValues: [] }],
  };
}

export class ListProductsTool implements OrbiTool {
  name = 'listProducts';
  description = 'Listar productos del negocio. Úsalo para mostrar al usuario qué productos tiene cargados, buscar uno específico, o dar contexto antes de crear uno nuevo.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['catalog.view'];
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
  requiredPermissions = ['catalog.manage'];
  requiresConfirmation = true;

  // Además de nombre y precio: la categoría (con su nombre, no el id), si
  // queda publicado en la tienda o como borrador, la descripción y cuántas
  // etiquetas. Publicar es lo que lo hace visible a los clientes: la persona
  // tiene que ver eso antes de confirmar.
  async describirAccion(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<string> {
    // Acotada al negocio del token: una categoría de otro negocio no existe.
    const categoria = await this.prisma.category.findFirst({
      where: { id: String(args.categoryId), businessId: ctx.businessId },
      select: { name: true },
    });
    if (!categoria) throw new AccionInvalida('Categoría no encontrada');

    const estado = (args.status ?? 'DRAFT') === 'PUBLISHED' ? 'publicado en la tienda' : 'como borrador';
    const partes = [
      `Crear el producto ${entreComillas(args.name ?? 'sin nombre')} a ${monto(args.basePrice)}`,
      `en la categoría ${entreComillas(categoria.name)}`,
      estado,
    ];
    if (presente(args.description)) partes.push(`con la descripción ${entreComillas(args.description)}`);
    if (presente(args.tags)) partes.push(`con ${cantidad(args.tags, 'etiqueta', 'etiquetas')}`);
    return partes.join(', ');
  }

  validarArgs(args: Record<string, unknown>) {
    return validarConDto(CreateProductDto, { ...aDtoProducto(args) });
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

  constructor(
    private readonly productsService: ProductsService,
    private readonly prisma: PrismaService,
  ) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const product = await this.productsService.create(ctx.businessId, aDtoProducto(args));

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
  // catalog.manage y no catalog.view: es el permiso que POST /products/ai-assist exige.
  // Con view (el Empleado) tendría por Orbi una IA paga que por HTTP se le niega.
  requiredPermissions = ['catalog.manage'];
  parameters = {
    type: 'object',
    properties: {
      productName: { type: 'string', description: 'Nombre del producto para el que generar la descripción' },
      existingDescription: { type: 'string', description: 'Borrador existente para mejorar (opcional)' },
    },
    required: ['productName'],
  };

  constructor(
    private readonly productAiService: ProductAiService,
    private readonly cuotaService: CuotaService,
  ) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      // Misma cuota que POST /products/ai-assist: la IA de productos gasta plata
      // y las dos vías (el botón del panel y Orbi) suman al mismo contador
      // diario del negocio, con la misma clave y el mismo tope.
      if (!(await this.cuotaService.consumir(`ai-assist:${ctx.businessId}`, AI_ASSIST_DIA_NEGOCIO))) {
        return {
          success: false,
          error: 'Llegaste al máximo de ayudas de IA por hoy. Mañana se renueva.',
          label: 'Llegaste al máximo de ayudas de IA por hoy',
        };
      }
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
