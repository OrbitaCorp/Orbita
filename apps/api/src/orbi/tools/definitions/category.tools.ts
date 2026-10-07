import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { CategoriesService } from '../../../categories/categories.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import { UpsertCategoryDto } from '../../../categories/dto/upsert-category.dto';
import { validarConDto, type ResultadoDeValidacion } from '../acciones/validar-args';
import { entreComillas } from '../acciones/formato';
import { FICHAS, chequearFaltantes, descripcionDe, fallaDeDatos, invalidoDelDto, parametrosDe } from '../acciones/requisitos';
import { cargarCategorias, claveDeNombre } from '../acciones/resolver-nombres';

/**
 * Las categorías del negocio, con su nombre exacto y cuántos productos tiene
 * cada una. Antes no había forma de verlas: createProduct pedía el id de la
 * categoría y el modelo solo encontraba nombres sueltos en listProducts.
 *
 * Mismo permiso que listProducts (catalog.view): GET /categories no pide
 * ninguno, pero por Orbi se atan a ver el catálogo.
 */
export class ListCategoriesTool implements OrbiTool {
  name = 'listCategories';
  description = 'Listar las categorías del negocio con su nombre exacto y cuántos productos tiene cada una. Úsalo cuando la persona pregunta qué categorías tiene o no sabés en cuál va un producto.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['catalog.view'];
  parameters = { type: 'object', properties: {} };

  constructor(private readonly categoriesService: CategoriesService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(_args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      // `flat`: la lista plana del panel, con el conteo de productos (sin los borrados).
      const categorias = (await this.categoriesService.findAll(ctx.businessId, true)) as { id: string; name: string; productCount: number; isActive: boolean }[];
      return {
        success: true,
        label: `Encontré ${categorias.length} categoría${categorias.length === 1 ? '' : 's'}`,
        data: {
          categorias: categorias.map((c) => ({ id: c.id, nombre: c.name, productos: c.productCount, ...(c.isActive === false ? { oculta: true } : {}) })),
          total: categorias.length,
        },
      };
    } catch (error) {
      return { success: false, error: `Error al listar categorías: ${error}`, label: 'Error listando categorías' };
    }
  }
}

const FICHA = FICHAS.createCategory;

/**
 * Crear una categoría, para que Orbi pueda ofrecerlo cuando la persona quiere
 * cargar un producto en una que no existe. Mismo permiso que POST /categories
 * (catalog.manage) y la misma validación (UpsertCategoryDto); el service arma
 * el slug y la deja activa, igual que el botón "Nueva categoría".
 */
export class CreateCategoryTool implements OrbiTool {
  name = 'createCategory';
  description = descripcionDe(FICHA);
  parameters = parametrosDe(FICHA);
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['catalog.manage'];
  requiresConfirmation = true;

  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly prisma: PrismaService,
  ) {}

  describirAccion(args: Record<string, unknown>): string {
    return `Crear la categoría ${entreComillas(args.name ?? 'sin nombre')} en el catálogo`;
  }

  async validarArgs(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ResultadoDeValidacion> {
    const faltan = chequearFaltantes(FICHA, args);
    if (faltan) return faltan;
    const forma = await validarConDto(UpsertCategoryDto, { name: args.name });
    if (!forma.ok) return invalidoDelDto(FICHA, forma);
    // Una que ya existe con el mismo nombre (sin tildes, mayúsculas ni plural)
    // no se duplica: "Perfumerías" cuando ya está "Perfumería" es la misma.
    const clave = claveDeNombre(String(args.name));
    const existente = (await cargarCategorias(this.prisma, ctx.businessId)).find((c) => claveDeNombre(c.name) === clave);
    if (existente) {
      return fallaDeDatos([], [{ campo: FICHA.campos.name.etiqueta, motivo: `ya existe la categoría "${existente.name}": usala en vez de crear otra` }]);
    }
    return { ok: true };
  }

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const categoria = await this.categoriesService.create(ctx.businessId, { name: args.name as string }, ctx.userId);
      return {
        success: true,
        label: `Categoría "${categoria.name}" creada`,
        data: { categoryId: categoria.id, name: categoria.name },
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude crear la categoría: ${msg}`, label: 'Error creando categoría' };
    }
  }
}
