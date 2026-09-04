import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { OrdersService } from '../../../orders/orders.service';

export class ListOrdersTool implements OrbiTool {
  name = 'listOrders';
  description = 'Listar pedidos del negocio. Úsalo para mostrar pedidos recientes, buscar uno por cliente o número, o filtrar por estado.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'], description: 'Filtrar por estado (opcional)' },
      search: { type: 'string', description: 'Buscar por nombre/email de cliente o número de pedido (opcional)' },
      limit: { type: 'number', description: 'Cantidad máxima de pedidos a devolver (default 10, max 20)' },
    },
  };

  constructor(private readonly ordersService: OrdersService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const limit = Math.min(Number(args.limit) || 10, 20);
      const result = await this.ordersService.findAll(ctx.businessId, {
        status: args.status as any,
        search: args.search as string | undefined,
        page: 1,
        limit,
      });

      return {
        success: true,
        label: `Encontré ${result.total} pedido${result.total === 1 ? '' : 's'}`,
        data: {
          orders: result.data.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            customerName: o.customerName,
            total: o.total,
            createdAt: o.createdAt,
          })),
          total: result.total,
        },
      };
    } catch (error) {
      return { success: false, error: `Error al listar pedidos: ${error}`, label: 'Error listando pedidos' };
    }
  }
}

export class GetOrderDetailTool implements OrbiTool {
  name = 'getOrderDetail';
  description = 'Obtener el detalle completo de un pedido específico por su ID: items, cliente, pagos y estado.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      orderId: { type: 'string', description: 'ID del pedido (UUID). Usá listOrders para obtenerlo.' },
    },
    required: ['orderId'],
  };

  constructor(private readonly ordersService: OrdersService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const order = await this.ordersService.findOne(ctx.businessId, args.orderId as string);

      // Se mapea campo por campo, igual que listOrders, en vez de devolver el
      // objeto entero que trae findOne. Ese objeto incluye email del cliente,
      // dirección de envío completa, historial de estados y el texto libre de
      // los pedidos de cancelación — todo eso volvía al contexto del modelo
      // para responder "resumime el pedido 123".
      //
      // Son dos problemas en uno. Uno es de datos personales: Orbi no necesita
      // el mail ni la dirección para contar en qué anda un pedido. El otro es
      // de inyección: varios de esos campos los escribe el cliente, y en el
      // panel Orbi tiene herramientas que ESCRIBEN en la base (ver RBT-695).
      // Cuanto menos texto ajeno entre al contexto, menos superficie hay.
      return {
        success: true,
        label: `Pedido #${order.orderNumber}`,
        data: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          channel: order.channel,
          // Solo el nombre de pila y el apellido, no el mail ni el avatar.
          customerName: order.customer
            ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
            : null,
          total: order.total,
          createdAt: order.createdAt,
          items: order.items.map(i => ({
            nombre: i.productName,
            cantidad: i.quantity,
            precioUnitario: i.editedPrice ?? i.unitPrice,
          })),
          pagos: order.payments.map(p => ({
            metodo: p.method,
            estado: p.status,
            monto: p.amount,
          })),
          // De devoluciones y cancelaciones va el HECHO de que existen y su
          // estado, no el motivo que escribió el cliente.
          devolucionesPendientes: order.returns.filter(r => r.status === 'PENDING').length,
          cancelacionesPendientes: order.cancellationRequests.filter(c => c.status === 'PENDING').length,
        },
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude obtener el pedido: ${msg}`, label: 'Error obteniendo pedido' };
    }
  }
}

export class UpdateOrderStatusTool implements OrbiTool {
  name = 'updateOrderStatus';
  description = 'Cambiar el estado de un pedido (ej. confirmar, marcar como enviado o entregado). Solo se permiten las transiciones válidas para el canal del pedido.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['orders:write'];
  parameters = {
    type: 'object',
    properties: {
      orderId: { type: 'string', description: 'ID del pedido (UUID). Usá listOrders para obtenerlo.' },
      status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'], description: 'Nuevo estado del pedido' },
    },
    required: ['orderId', 'status'],
  };

  constructor(private readonly ordersService: OrdersService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const order = await this.ordersService.updateStatus(
        ctx.businessId,
        ctx.userId,
        args.orderId as string,
        args.status as any,
      );

      return {
        success: true,
        label: `Pedido #${order.orderNumber} actualizado a "${args.status}"`,
        data: { orderId: order.id, status: order.status },
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude actualizar el pedido: ${msg}`, label: 'Error actualizando pedido' };
    }
  }
}
