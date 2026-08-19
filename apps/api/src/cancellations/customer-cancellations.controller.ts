import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { CancellationsService } from './cancellations.service';
import { CancelOrderDto } from '../orders/dto/cancel-order.dto';

// Vive acá (no en CustomerOrdersController/OrdersModule) porque necesita
// OrdersService Y MercadopagoService — y OrdersModule ya es dependencia de
// MercadopagoModule, así que importarlo de vuelta ahí sería circular.
@Controller('me/orders')
export class CustomerCancellationsController {
  constructor(private readonly cancellationsService: CancellationsService) {}

  // "Seguimiento de pedido" = estados (PENDING→CONFIRMED→...), no logística
  // física. Mientras el pedido sigue PENDING, cancelar sigue siendo directo
  // (nunca hay plata de Mercado Pago ya cobrada de por medio ahí); desde
  // CONFIRMED/PREPARING pasa a ser una SOLICITUD que el negocio tiene que
  // aceptar o rechazar (ver CancellationsService.requestOrCancel).
  @Patch(':id/cancel')
  cancel(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.cancellationsService.requestOrCancel(businessId, customerId, id, dto.reason);
  }
}
