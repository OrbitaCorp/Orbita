import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { OrdersService } from './orders.service';
import { ReturnsService } from '../returns/returns.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateCustomerReturnDto } from './dto/create-customer-return.dto';

// (RBT-628) "Mis pedidos" del storefront. Exclusivo del cliente: cada handler
// resuelve businessId + customerId del token con assertCustomerContext, así un
// cliente solo ve SUS pedidos, de SU negocio. Nunca por id a ciegas.
@Controller('me/orders')
export class CustomerOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly returnsService: ReturnsService,
  ) {}

  @Get()
  findAll(@CurrentUser() ctx: AuthContext) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.ordersService.findAllForCustomer(businessId, customerId);
  }

  @Get(':id')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.ordersService.findOneForCustomer(businessId, customerId, id);
  }

  // "Seguimiento de pedido" = estados (PENDING→CONFIRMED→...), no logística
  // física — el admin los cambia a mano desde el panel. Cancelar SÍ lo puede
  // disparar el cliente, pero solo mientras está PENDING (ver el comentario
  // en OrdersService.cancelByCustomer).
  @Patch(':id/cancel')
  cancel(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.ordersService.cancelByCustomer(businessId, customerId, id, dto.reason);
  }

  @Post(':id/return')
  createReturn(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: CreateCustomerReturnDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.returnsService.createForCustomer(businessId, customerId, {
      orderId: id,
      orderItemId: dto.orderItemId,
      quantity: dto.quantity,
      reason: dto.reason,
    });
  }
}
