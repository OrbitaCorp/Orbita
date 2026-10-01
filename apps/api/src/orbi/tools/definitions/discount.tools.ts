import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { DiscountsService } from '../../../discounts/discounts.service';
import type { CouponsService } from '../../../coupons/coupons.service';
import { UpsertDiscountDto } from '../../../discounts/dto/upsert-discount.dto';
import { UpsertCouponDto } from '../../../coupons/dto/upsert-coupon.dto';
import { validarConDto } from '../acciones/validar-args';
import { cantidad, dato, entreComillas, presente } from '../acciones/formato';

export class ListDiscountsTool implements OrbiTool {
  name = 'listDiscounts';
  description = 'Listar los descuentos automáticos del negocio (sin código). Úsalo para mostrar qué descuentos existen o dar contexto antes de crear uno nuevo.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['discounts.view'];
  parameters = {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Texto para buscar por nombre (opcional)' },
    },
  };

  constructor(private readonly discountsService: DiscountsService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const result = await this.discountsService.findAll(ctx.businessId, {
        search: args.search as string | undefined,
        page: 1,
        limit: 10,
      });

      return {
        success: true,
        label: `Encontré ${result.total} descuento${result.total === 1 ? '' : 's'}`,
        data: {
          discounts: result.data.map(d => ({ id: d.id, name: d.name, type: d.type, value: d.value, estado: d.estado })),
          total: result.total,
        },
      };
    } catch (error) {
      return { success: false, error: `Error al listar descuentos: ${error}`, label: 'Error listando descuentos' };
    }
  }
}

/**
 * "20% off en cada producto" o "$500 off sobre el total de la compra", según
 * el tipo. Va en el botón de confirmación: la persona tiene que poder ver de
 * un vistazo si el modelo entendió bien, y "PERCENT_TICKET / 20" no se lee de
 * un vistazo.
 */
function formatearValor(tipo: unknown, valor: unknown): string {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return 'valor inválido';
  const cuanto = String(tipo).startsWith('PERCENT') ? `${n}% off` : `$${n} off`;
  const donde = String(tipo).endsWith('_TICKET') ? 'sobre el total de la compra' : 'en cada producto';
  return `${cuanto} ${donde}`;
}

const ALCANCE: Record<string, string> = {
  PRODUCT: 'productos elegidos',
  CATEGORY: 'categorías elegidas',
  TICKET: 'toda la compra',
};

// Alcance, cuántos productos/categorías y vigencia (spec §3.2): con solo el
// código y el valor, un cupón "para 1 producto" y uno "para toda la tienda"
// se veían igual en la tarjeta. Los ids no se muestran (no le dicen nada a
// nadie): se muestra cuántos son, que es lo que la persona puede chequear.
function alcanceYVigencia(args: Record<string, unknown>): string {
  const partes = [`para ${ALCANCE[String(args.scope)] ?? dato(args.scope)}`];
  if (presente(args.productIds)) partes.push(cantidad(args.productIds, 'producto', 'productos'));
  if (presente(args.categoryIds)) partes.push(cantidad(args.categoryIds, 'categoría', 'categorías'));
  const desde = presente(args.startDate) ? `desde ${dato(args.startDate)}` : 'desde ahora';
  const hasta = presente(args.endDate) ? `hasta ${dato(args.endDate)}` : 'sin fecha de fin';
  return `${partes.join(', ')}; ${desde}, ${hasta}`;
}

// Lo que se le manda al service, armado en un solo lugar: validarArgs() lo
// pasa por el DTO del endpoint y execute() lo escribe, así lo validado es
// exactamente lo escrito. Un null del modelo en un opcional es "no mandar":
// no se escribe nada que la tarjeta no muestre. Sin conversiones de tipo: si
// el modelo manda "20" en vez de 20, el DTO lo rechaza, igual que por HTTP.
function aDtoDescuento(args: Record<string, unknown>): UpsertDiscountDto {
  return {
    name: args.name as string,
    type: args.type as string,
    value: args.value as number,
    scope: args.scope as string,
    productIds: (args.productIds ?? undefined) as string[] | undefined,
    categoryIds: (args.categoryIds ?? undefined) as string[] | undefined,
    startDate: (args.startDate as string | undefined) ?? new Date().toISOString(),
    endDate: (args.endDate ?? undefined) as string | undefined,
  };
}

export class CreateDiscountTool implements OrbiTool {
  name = 'createDiscount';
  description = 'Crear un descuento automático (sin código) para productos, categorías o el ticket total. Se aplica solo, sin que el cliente escriba nada.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['discounts.manage'];
  requiresConfirmation = true;

  describirAccion(args: Record<string, unknown>): string {
    return `Crear el descuento ${entreComillas(args.name ?? 'sin nombre')} de ${formatearValor(args.type, args.value)}, ${alcanceYVigencia(args)}`;
  }

  validarArgs(args: Record<string, unknown>) {
    return validarConDto(UpsertDiscountDto, { ...aDtoDescuento(args) });
  }

  parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nombre del descuento' },
      type: { type: 'string', enum: ['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET'], description: 'Tipo de descuento' },
      value: { type: 'number', description: 'Valor del descuento (porcentaje 1-100, o monto en pesos)' },
      scope: { type: 'string', enum: ['PRODUCT', 'CATEGORY', 'TICKET'], description: 'A qué aplica el descuento' },
      productIds: { type: 'array', items: { type: 'string' }, description: 'IDs de productos (requerido si scope es PRODUCT)' },
      categoryIds: { type: 'array', items: { type: 'string' }, description: 'IDs de categorías (requerido si scope es CATEGORY)' },
      startDate: { type: 'string', description: 'Fecha de inicio ISO 8601 (default: ahora)' },
      endDate: { type: 'string', description: 'Fecha de fin ISO 8601 (opcional, sin fin si no se indica)' },
    },
    required: ['name', 'type', 'value', 'scope'],
  };

  constructor(private readonly discountsService: DiscountsService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const discount = await this.discountsService.create(ctx.businessId, ctx.userId, aDtoDescuento(args));

      return {
        success: true,
        label: `Descuento "${args.name}" creado`,
        data: { discountId: discount.id, name: discount.name },
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude crear el descuento: ${msg}`, label: 'Error creando descuento' };
    }
  }
}

// Mismo criterio que aDtoDescuento, con el código.
function aDtoCupon(args: Record<string, unknown>): UpsertCouponDto {
  return { ...aDtoDescuento(args), code: args.code as string };
}

export class CreateCouponTool implements OrbiTool {
  name = 'createCoupon';
  description = 'Crear un cupón con código que el cliente ingresa manualmente en el checkout.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['discounts.manage'];
  requiresConfirmation = true;

  describirAccion(args: Record<string, unknown>): string {
    return `Crear el cupón ${entreComillas(args.code ?? '(sin código)')} (${entreComillas(args.name ?? 'sin nombre')}) de ${formatearValor(args.type, args.value)}, ${alcanceYVigencia(args)}`;
  }

  validarArgs(args: Record<string, unknown>) {
    return validarConDto(UpsertCouponDto, { ...aDtoCupon(args) });
  }

  parameters = {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Código del cupón (ej. VERANO20)' },
      name: { type: 'string', description: 'Nombre descriptivo del cupón' },
      type: { type: 'string', enum: ['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET'], description: 'Tipo de cupón' },
      value: { type: 'number', description: 'Valor del cupón (porcentaje 1-100, o monto en pesos)' },
      scope: { type: 'string', enum: ['PRODUCT', 'CATEGORY', 'TICKET'], description: 'A qué aplica el cupón' },
      productIds: { type: 'array', items: { type: 'string' }, description: 'IDs de productos (requerido si scope es PRODUCT)' },
      categoryIds: { type: 'array', items: { type: 'string' }, description: 'IDs de categorías (requerido si scope es CATEGORY)' },
      startDate: { type: 'string', description: 'Fecha de inicio ISO 8601 (default: ahora)' },
      endDate: { type: 'string', description: 'Fecha de expiración ISO 8601 (opcional)' },
    },
    required: ['code', 'name', 'type', 'value', 'scope'],
  };

  constructor(private readonly couponsService: CouponsService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const coupon = await this.couponsService.create(ctx.businessId, ctx.userId, aDtoCupon(args));

      return {
        success: true,
        label: `Cupón "${args.code}" creado`,
        data: { couponId: coupon.id, code: coupon.code, name: coupon.name },
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude crear el cupón: ${msg}`, label: 'Error creando cupón' };
    }
  }
}
