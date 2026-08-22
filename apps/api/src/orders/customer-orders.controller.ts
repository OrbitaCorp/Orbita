import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { OrdersService } from './orders.service';
import { ReturnsService } from '../returns/returns.service';
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

  // PATCH :id/cancel se mudó a CancellationsModule (customer-cancellations.controller.ts)
  // — necesita OrdersService Y MercadopagoService, y este módulo ya es
  // dependencia de MercadopagoModule (importar de vuelta sería circular).

  @Post(':id/return')
  createReturn(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: CreateCustomerReturnDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.returnsService.createForCustomer(businessId, customerId, {
      orderId: id,
      orderItemId: dto.orderItemId,
      quantity: dto.quantity,
      reason: dto.reason,
      refundMethod: dto.refundMethod,
    });
  }
}
