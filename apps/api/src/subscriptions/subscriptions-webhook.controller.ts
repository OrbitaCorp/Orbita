import { Body, Controller, Headers, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Controller('webhooks/mercadopago')
export class SubscriptionsWebhookController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('preapproval')
  @Public()
  preapprovalWebhook(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.subscriptionsService.handleWebhook(body, headers, query);
  }
}
