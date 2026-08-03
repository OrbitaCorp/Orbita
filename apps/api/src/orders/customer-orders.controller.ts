import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { OrdersService } from './orders.service';

// (RBT-628) "Mis pedidos" del storefront. Exclusivo del cliente: cada handler
// resuelve businessId + customerId del token con assertCustomerContext, así un
// cliente solo ve SUS pedidos, de SU negocio. Nunca por id a ciegas.
@Controller('me/orders')
export class CustomerOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
}
