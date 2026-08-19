import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { ReturnsService } from './returns.service';

// "Mis notas de crédito" del storefront — mismo patrón que
// CustomerOrdersController (me/orders): businessId + customerId siempre
// salen del token, nunca de un id a ciegas. Alimenta el selector de "aplicar
// saldo" en el checkout (CheckoutPago.tsx) y la vista informativa en el
// perfil del cliente.
@Controller('me/credit-notes')
export class CustomerCreditNotesController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  findMine(@CurrentUser() ctx: AuthContext) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.returnsService.findAvailableForCustomer(businessId, customerId);
  }
}
