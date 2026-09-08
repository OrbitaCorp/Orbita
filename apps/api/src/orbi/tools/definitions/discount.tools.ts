import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { DiscountsService } from '../../../discounts/discounts.service';
import type { CouponsService } from '../../../coupons/coupons.service';

export class ListDiscountsTool implements OrbiTool {
  name = 'listDiscounts';
  description = 'Listar los descuentos automáticos del negocio (sin código). Úsalo para mostrar qué descuentos existen o dar contexto antes de crear uno nuevo.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions: string[] = [];
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
 * "20% off" o "$500 off", según el tipo. Va en el botón de confirmación: la
 * persona tiene que poder ver de un vistazo si el modelo entendió bien, y
 * "PERCENT_TICKET / 20" no se lee de un vistazo.
 */
function formatearValor(tipo: unknown, valor: unknown): string {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return 'valor inválido';
  return String(tipo).startsWith('PERCENT') ? `${n}% off` : `$${n} off`;
}

export class CreateDiscountTool implements OrbiTool {
  name = 'createDiscount';
  description = 'Crear un descuento automático (sin código) para productos, categorías o el ticket total. Se aplica solo, sin que el cliente escriba nada.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['discounts:write'];
  requiresConfirmation = true;

  describirAccion(args: Record<string, unknown>): string {
    return `Crear el descuento "${String(args.name ?? 'sin nombre')}" de ${formatearValor(args.type, args.value)}`;
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
      const discount = await this.discountsService.create(ctx.businessId, ctx.userId, {
        name: args.name as string,
        type: args.type as string,
        value: Number(args.value),
        scope: args.scope as string,
        productIds: args.productIds as string[] | undefined,
        categoryIds: args.categoryIds as string[] | undefined,
        startDate: (args.startDate as string) ?? new Date().toISOString(),
        endDate: args.endDate as string | undefined,
      });

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

export class CreateCouponTool implements OrbiTool {
  name = 'createCoupon';
  description = 'Crear un cupón con código que el cliente ingresa manualmente en el checkout.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['discounts:write'];
  requiresConfirmation = true;

  describirAccion(args: Record<string, unknown>): string {
    return `Crear el cupón ${String(args.code ?? '(sin código)')} de ${formatearValor(args.type, args.value)}`;
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
      const coupon = await this.couponsService.create(ctx.businessId, ctx.userId, {
        code: args.code as string,
        name: args.name as string,
        type: args.type as string,
        value: Number(args.value),
        scope: args.scope as string,
        productIds: args.productIds as string[] | undefined,
        categoryIds: args.categoryIds as string[] | undefined,
        startDate: (args.startDate as string) ?? new Date().toISOString(),
        endDate: args.endDate as string | undefined,
      });

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
