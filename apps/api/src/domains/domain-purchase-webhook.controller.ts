import { Body, Controller, Headers, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { DomainPurchaseService } from './domain-purchase.service';

// Mismo `webhooks/mercadopago` base que mercadopago-webhooks.controller.ts y
// subscriptions-webhook.controller.ts (cada uno con su propia sub-ruta) —
// esta es la del cobro único de PLATAFORMA para comprar un dominio.
@Controller('webhooks/mercadopago')
export class DomainPurchaseWebhookController {
  constructor(private readonly domainPurchaseService: DomainPurchaseService) {}

  @Post('domain-purchase')
  @Public()
  domainPurchaseWebhook(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.domainPurchaseService.handleWebhookRequest(body, headers, query);
  }
}
