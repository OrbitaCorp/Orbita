import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition, LlmUsage } from '../../llm/llm-adapter.interface';
import type { ProductsService } from '../../../products/products.service';
import type { ProductAiService } from '../../../products/product-ai.service';
import type { CuotaService } from '../../../common/cuota/cuota.service';
import { AI_ASSIST_DIA_NEGOCIO } from '../../../common/cuota/limites';
import type { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from '../../../products/dto/create-product.dto';
import { AccionInvalida, validarConDto, type ArgsInvalidos, type Invalido, type ResultadoDeValidacion } from '../acciones/validar-args';
import { entreComillas, monto, presente } from '../acciones/formato';
import { FICHAS, descripcionDe, fallaDeDatos, faltantes, invalidoDelDto, parametrosDe, tieneValor } from '../acciones/requisitos';
import {
  CATEGORIA,
  ETIQUETA,
  cargarCategorias,
  cargarEtiquetas,
  invalidoDeResolucion,
  resolverLista,
  resolverNombre,
  type Candidato,
} from '../acciones/resolver-nombres';

const FICHA = FICHAS.createProduct;

// Las propiedades del DTO que en la tool se llaman distinto: el modelo da
// nombres, el DTO lleva ids.
const PARAMETRO_DEL_DTO = { categoryId: 'categoria', tagIds: 'etiquetas' };

type ProductoArmado = { dto: CreateProductDto; categoria: string; etiquetas: string[] };

/**
 * Lo que se le manda a ProductsService.create, armado en un solo lugar:
 * validarArgs() lo pasa por CreateProductDto (el de POST /products),
 * describirAccion() lo muestra y execute() lo escribe, así lo validado es
 * exactamente lo mostrado y lo escrito. Sin conversiones de tipo: un precio
 * "5000" como texto lo rechaza el DTO, igual que por HTTP.
 *
 * La categoría y las etiquetas llegan por NOMBRE y se resuelven acá, acotadas
 * al negocio (ver acciones/resolver-nombres.ts). `categoryId` y `tags` (ids)
 * son los parámetros de antes: se siguen leyendo para las propuestas que
 * quedaron guardadas con esa forma.
 */
async function armarProducto(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
  prisma: PrismaService,
): Promise<{ ok: true; producto: ProductoArmado } | ArgsInvalidos> {
  const categoriaPedida = args.categoria ?? args.categoryId;
  const etiquetasPedidas = args.etiquetas ?? args.tags;
  const faltan = faltantes(FICHA, { ...args, categoria: categoriaPedida });
  const invalidos: Invalido[] = [];

  let categoria: Candidato | undefined;
  if (tieneValor(categoriaPedida)) {
    const r = resolverNombre(String(categoriaPedida), await cargarCategorias(prisma, ctx.businessId));
    if (r.ok) categoria = r.entidad;
    else invalidos.push(invalidoDeResolucion(FICHA.campos.categoria.etiqueta, String(categoriaPedida), r, CATEGORIA));
  }
  let etiquetas: Candidato[] = [];
  if (tieneValor(etiquetasPedidas)) {
    const r = resolverLista(FICHA.campos.etiquetas.etiqueta, etiquetasPedidas, await cargarEtiquetas(prisma, ctx.businessId), ETIQUETA);
    etiquetas = r.entidades;
    invalidos.push(...r.invalidos);
  }
  if (faltan.length || invalidos.length || !categoria) return fallaDeDatos(faltan, invalidos);

  return {
    ok: true,
    producto: {
      dto: {
        name: args.name as string,
        description: (args.description ?? undefined) as string | undefined,
        basePrice: args.basePrice as number,
        categoryId: categoria.id,
        tagIds: etiquetas.length ? etiquetas.map((e) => e.id) : undefined,
        status: (args.status as 'PUBLISHED' | 'DRAFT' | undefined) ?? 'DRAFT',
        variants: [{ price: args.basePrice as number, optionValues: [] }],
      },
      categoria: categoria.name,
      etiquetas: etiquetas.map((e) => e.name),
    },
  };
}

export class ListProductsTool implements OrbiTool {
  name = 'listProducts';
  description = 'Listar productos del negocio (con su id, su nombre exacto y su categoría). Úsalo para mostrar qué productos tiene cargados, buscar uno específico, o dar contexto antes de crear uno nuevo.';
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
  description = descripcionDe(FICHA);
  parameters = parametrosDe(FICHA);
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['catalog.manage'];
  requiresConfirmation = true;

  // Además de nombre y precio: la categoría con su nombre REAL (el de la
  // base, no el que escribió la persona: "perfumeria" se muestra
  // "Perfumería"), si queda publicado en la tienda o como borrador, la
  // descripción y las etiquetas. Publicar es lo que lo hace visible a los
  // clientes: la persona tiene que ver eso antes de confirmar.
  async describirAccion(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<string> {
    const armado = await armarProducto(args, ctx, this.prisma);
    if (!armado.ok) throw new AccionInvalida(armado.error, armado);
    const { categoria, etiquetas } = armado.producto;

    const estado = (args.status ?? 'DRAFT') === 'PUBLISHED' ? 'publicado en la tienda' : 'como borrador';
    const partes = [
      `Crear el producto ${entreComillas(args.name ?? 'sin nombre')} a ${monto(args.basePrice)}`,
      `en la categoría ${entreComillas(categoria)}`,
      estado,
    ];
    if (presente(args.description)) partes.push(`con la descripción ${entreComillas(args.description)}`);
    if (etiquetas.length) partes.push(`con ${etiquetas.length === 1 ? 'la etiqueta' : 'las etiquetas'} ${etiquetas.map((e) => entreComillas(e)).join(', ')}`);
    return partes.join(', ');
  }

  async validarArgs(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ResultadoDeValidacion> {
    const armado = await armarProducto(args, ctx, this.prisma);
    if (!armado.ok) return armado;
    const forma = await validarConDto(CreateProductDto, { ...armado.producto.dto });
    return forma.ok ? { ok: true } : invalidoDelDto(FICHA, forma, PARAMETRO_DEL_DTO);
  }

  constructor(
    private readonly productsService: ProductsService,
    private readonly prisma: PrismaService,
  ) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const armado = await armarProducto(args, ctx, this.prisma);
      if (!armado.ok) return { success: false, error: `No pude crear el producto: ${armado.error}`, label: 'Error creando producto' };
      const product = await this.productsService.create(ctx.businessId, armado.producto.dto);

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
    // Fuera del try: si la IA respondió (y se cobró) pero la respuesta no sirvió,
    // el consumo igual tiene que llegar a la ficha del turno.
    let consumo: LlmUsage | undefined;
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
      // La IA de esta tool gasta plata propia (no es la del turno): se ata al turno
      // y al miembro, y el consumo vuelve en el resultado para que el turno lo sume.
      const result = await this.productAiService.assist(
        ctx.businessId,
        {
          name: args.productName as string,
          existingDescription: args.existingDescription as string | undefined,
        },
        { memberId: ctx.userId, turnId: ctx.turnId, alConsumir: (u) => { consumo = u; } },
      );

      return {
        success: true,
        label: `Descripción generada para "${args.productName}"`,
        data: {
          description: result.description,
          suggestedTags: result.suggestedTags,
          suggestedSpecs: result.suggestedSpecs,
          suggestedCategoryId: result.suggestedCategoryId,
        },
        consumo,
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude generar la descripción: ${msg}`, label: 'Error generando descripción', consumo };
    }
  }
}
