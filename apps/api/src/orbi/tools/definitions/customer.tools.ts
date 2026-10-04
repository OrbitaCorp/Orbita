import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { CustomersService } from '../../../customers/customers.service';

export class ListCustomersTool implements OrbiTool {
  name = 'listCustomers';
  description = 'Listar clientes del negocio. Úsalo para buscar un cliente por nombre o email, o para dar contexto general.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['customers.view'];
  parameters = {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Texto para buscar por nombre o email (opcional)' },
      limit: { type: 'number', description: 'Cantidad máxima de clientes a devolver (default 10, max 20)' },
    },
  };

  constructor(private readonly customersService: CustomersService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const limit = Math.min(Number(args.limit) || 10, 20);
      const result = await this.customersService.findAll(ctx.businessId, {
        search: args.search as string | undefined,
        page: 1,
        limit,
      });

      return {
        success: true,
        label: `Encontré ${result.total} cliente${result.total === 1 ? '' : 's'}`,
        data: { customers: result.data, total: result.total },
      };
    } catch (error) {
      return { success: false, error: `Error al listar clientes: ${error}`, label: 'Error listando clientes' };
    }
  }
}

export class GetCustomerDetailTool implements OrbiTool {
  name = 'getCustomerDetail';
  description = 'Obtener el detalle de un cliente: nombre, cuántos pedidos hizo y cuánto gastó, sus pedidos recientes y su localidad. No incluye datos de contacto (mail, teléfono, DNI, direcciones).';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['customers.view'];
  parameters = {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'ID del cliente (UUID). Usá listCustomers para obtenerlo.' },
    },
    required: ['customerId'],
  };

  constructor(private readonly customersService: CustomersService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const customer = await this.customersService.findOne(ctx.businessId, args.customerId as string);

      return {
        success: true,
        label: `Cliente: ${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`,
        // Se mapea campo por campo, igual que getOrderDetail, en vez de devolver
        // el objeto entero que trae findOne (DNI, mail, teléfono, direcciones
        // completas y los asuntos de los mails que se le mandaron). Orbi no
        // necesita nada de eso para contar cómo viene comprando un cliente, y
        // varios de esos textos los escribe un tercero: cuanto menos texto
        // ajeno entre al contexto del modelo, menos superficie de inyección
        // (ver RBT-695). De las direcciones va solo la localidad.
        data: {
          id: customer.id,
          nombre: `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`,
          tieneCuenta: customer.hasAccount,
          cantidadPedidos: customer.orderCount,
          totalGastado: customer.totalSpent,
          ticketPromedio: customer.avgTicket,
          ultimoPedido: customer.lastOrderAt,
          clienteDesde: customer.createdAt,
          pedidos: customer.orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            channel: o.channel,
            status: o.status,
            total: o.total,
            cantidadItems: o.itemCount,
            createdAt: o.createdAt,
          })),
          localidades: [...new Set(customer.addresses.map((a) => a.city).filter(Boolean))],
        },
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude obtener el cliente: ${msg}`, label: 'Error obteniendo cliente' };
    }
  }
}
