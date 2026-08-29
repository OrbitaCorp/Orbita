import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { SubscriptionsService } from './subscriptions.service';
import { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto';
import { StartPendingCheckoutDto } from './dto/start-pending-checkout.dto';

@Controller('subscription')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @Roles('owner', 'admin')
  get(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.subscriptionsService.getForBusiness(member.businessId);
  }

  @Get('payments')
  @Roles('owner', 'admin')
  payments(
    @CurrentBusiness() ctx: AuthContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const member = assertMemberContext(ctx);
    return this.subscriptionsService.getPayments(
      member.businessId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  // Público: todavía no existe ningún negocio/cuenta en este punto del wizard
  // — los datos quedan en PendingSignup hasta que MP confirme el pago (ver
  // SubscriptionsService.confirmAndCreate). Seguro de exponer público por el
  // mismo motivo que el webhook: nunca crea nada a partir del body en sí,
  // solo arma el link de pago de MP.
  @Post('checkout')
  @Public()
  checkout(@Body() dto: StartPendingCheckoutDto) {
    return this.subscriptionsService.startCheckoutPending(dto);
  }

  // Lo llama el frontend (vía BFF) cuando MP devuelve al usuario a la app.
  // Público por el mismo motivo que /checkout: no confía en el body, siempre
  // vuelve a preguntarle a MP el estado real antes de crear nada.
  @Post('confirm')
  @Public()
  confirm(@Body() dto: ConfirmSubscriptionDto) {
    return this.subscriptionsService.confirmAndCreate(dto.preapprovalId);
  }

  // Previsualiza un código de descuento ANTES de mandar al usuario a pagar,
  // para poder mostrarle cuánto va a pagar en vez de que se entere en MP.
  // Público porque en este punto del wizard todavía no hay cuenta creada; no
  // revela nada más que el porcentaje y el precio resultante.
  @Get('discount/:code')
  @Public()
  previewDiscount(@Param('code') code: string) {
    return this.subscriptionsService.previewDiscount(code);
  }
}
