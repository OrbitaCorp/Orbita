import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { OrdersService } from '../../../orders/orders.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import { isUUID } from 'class-validator';
import { UpdateOrderStatusDto } from '../../../orders/dto/update-order-status.dto';
import { AccionInvalida, validarConDto, type ResultadoDeValidacion } from '../acciones/validar-args';
import { FICHAS, chequearFaltantes, descripcionDe, fallaDeDatos, invalidoDelDto, parametrosDe } from '../acciones/requisitos';
import { dato, entreComillas } from '../acciones/formato';

const EN_CASTELLANO: Record<string, string> = {
  PENDING: 'pendiente', CONFIRMED: 'confirmado', PREPARING: 'en preparación',
  SHIPPED: 'enviado', DELIVERED: 'entregado', COMPLETED: 'completado',
  CANCELLED: 'cancelado',
};
const estadoLegible = (s: unknown) => EN_CASTELLANO[String(s)] ?? dato(s);

// Medios de pago en castellano, para que la tarjeta diga "efectivo" y no
// "CASH". Un medio que no esté acá (uno nuevo del enum) sale tal cual.
const MEDIO_EN_CASTELLANO: Record<string, string> = {
  CASH: 'efectivo', TRANSFER: 'transferencia', DEBIT_CARD: 'tarjeta de débito',
  CREDIT_CARD: 'tarjeta de crédito', QR: 'QR', CREDIT_NOTE: 'nota de crédito',
  MERCADOPAGO: 'Mercado Pago',
};

export class ListOrdersTool implements OrbiTool {
  name = 'listOrders';
  description = 'Listar pedidos del negocio. Úsalo para mostrar pedidos recientes, buscar uno por cliente o número, o filtrar por estado.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['orders.view'];
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
  requiredPermissions = ['orders.view'];
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
          // filter(Boolean): lastName es opcional y el modelo recibía "Ana null".
          customerName: order.customer
            ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ')
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
  description = descripcionDe(FICHAS.updateOrderStatus);
  parameters = parametrosDe(FICHAS.updateOrderStatus);
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['orders.manage'];
  requiresConfirmation = true;

  /**
   * "Marcar el pedido como enviado" no alcanzaba: no decía CUÁL pedido, y un
   * texto de terceros (el nombre de un cliente en otro pedido) podía llevar
   * al modelo a cambiar uno distinto del que la persona tenía en mente. Ahora
   * la tarjeta dice número, cliente, de qué estado a qué estado, y lo que
   * pasa además: el mail al comprador, el movimiento de stock y qué pasa con
   * el pago pendiente.
   *
   * Las reglas de mail, stock y pago son las de OrdersService.updateStatus: si
   * cambian allá, este texto queda desactualizado (no rompe nada, pero la
   * tarjeta mentiría). Por eso están comentadas una por una.
   */
  async describirAccion(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<string> {
    // SIEMPRE acotado al negocio del token: el orderId lo arma el modelo, y
    // un id de otro negocio tiene que dar "no encontrado", no sus datos.
    const pedido = await this.prisma.order.findFirst({
      where: { id: String(args.orderId), businessId: ctx.businessId, deletedAt: null },
      select: {
        orderNumber: true,
        status: true,
        customer: { select: { firstName: true, lastName: true, email: true } },
        onlineOrderDetails: { select: { buyerName: true, buyerEmail: true } },
        // Los pagos también acotados al negocio, igual que el updateMany de
        // updateStatus. El filtro de estado y medio va abajo, en código, para
        // que la regla quede escrita en un solo lugar y a la vista.
        payments: { where: { businessId: ctx.businessId }, select: { method: true, status: true } },
      },
    });
    if (!pedido) throw new AccionInvalida('Pedido no encontrado');

    const actual = String(pedido.status);
    const nuevo = String(args.status);
    // `||` y no `??`: un buyerName vacío ('') tiene que caer al nombre de la
    // ficha, no dejar la tarjeta diciendo "sin cliente" cuando sí hay uno.
    const nombre = pedido.onlineOrderDetails?.buyerName
      || ([pedido.customer?.firstName, pedido.customer?.lastName].filter(Boolean).join(' ') || null);
    const cliente = nombre ? `de ${entreComillas(nombre)}` : 'sin cliente';

    const extras: string[] = [];
    // Pasar al mismo estado lo rechaza el service: no se promete nada.
    const cambia = actual !== nuevo;
    // Sale de pendiente a un estado comprometido: se descuenta el stock y se
    // manda el mail de confirmación con el detalle.
    const descuenta = cambia && actual === 'PENDING' && nuevo !== 'CANCELLED';
    // Cancelar algo que ya había descontado: el stock vuelve.
    const devuelve = nuevo === 'CANCELLED' && (actual === 'CONFIRMED' || actual === 'PREPARING');
    if (descuenta) extras.push('Se descuenta el stock de los productos.');
    if (devuelve) extras.push('El stock de los productos vuelve al inventario.');
    // El pago offline pendiente se resuelve en el mismo cambio: aprobado (con
    // paidAt y quien confirma como verifiedBy) si el pedido sale de pendiente,
    // rechazado si se cancela. Misma condición que updateStatus
    // (`descuentaStock || nuevo === 'CANCELLED'`) y mismo filtro que su
    // updateMany (PENDING y no MERCADOPAGO: ese lo confirma solo el webhook).
    // Sin esto la tarjeta callaba que confirmar un pedido lo da por cobrado.
    const resuelvePago = cambia && (descuenta || nuevo === 'CANCELLED');
    const medios = (pedido.payments ?? [])
      .filter((p) => p.status === 'PENDING' && p.method !== 'MERCADOPAGO')
      .map((p) => MEDIO_EN_CASTELLANO[String(p.method)] ?? dato(p.method));
    if (resuelvePago && medios.length) {
      const cuales = [...new Set(medios)].join(', ');
      const uno = medios.length === 1;
      if (nuevo === 'CANCELLED') {
        extras.push(uno
          ? `El pago pendiente (${cuales}) queda rechazado.`
          : `Los pagos pendientes (${cuales}) quedan rechazados.`);
      } else {
        extras.push(uno
          ? `El pago pendiente (${cuales}) queda marcado como cobrado.`
          : `Los pagos pendientes (${cuales}) quedan marcados como cobrados.`);
      }
    }
    // El mail va al comprador de la compra online o, si no hay, al de la ficha.
    const hayMail = Boolean(pedido.onlineOrderDetails?.buyerEmail ?? pedido.customer?.email);
    const avisa = cambia && (descuenta || nuevo === 'SHIPPED' || nuevo === 'CANCELLED' || nuevo === 'DELIVERED');
    if (hayMail && avisa) extras.push('Le llega un mail al comprador avisándole.');

    return [
      `Pasar el pedido #${pedido.orderNumber} ${cliente} de ${estadoLegible(actual)} a ${estadoLegible(nuevo)}.`,
      ...extras,
    ].join(' ');
  }

  // El endpoint (PATCH /orders/:id/status) valida el estado con su DTO; el id
  // va en la ruta. Acá los dos vienen del modelo: primero lo que falta (los
  // dos juntos), después el id como UUID antes de ir a la base.
  async validarArgs(args: Record<string, unknown>): Promise<ResultadoDeValidacion> {
    const ficha = FICHAS.updateOrderStatus;
    const faltan = chequearFaltantes(ficha, args);
    if (faltan) return faltan;
    if (!isUUID(args.orderId)) {
      const falla = fallaDeDatos([], [{ campo: ficha.campos.orderId.etiqueta, motivo: 'tiene que ser el id (UUID) que devuelve listOrders: buscá el pedido por su número' }]);
      return { ...falla, error: `Argumento inválido (orderId): tiene que ser el UUID del pedido (usá listOrders). ${falla.error}` };
    }
    const forma = await validarConDto(UpdateOrderStatusDto, { status: args.status });
    return forma.ok ? { ok: true } : invalidoDelDto(ficha, forma);
  }

  constructor(
    private readonly ordersService: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

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
