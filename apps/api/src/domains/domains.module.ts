import { Module } from '@nestjs/common';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { VercelDomainsService } from './vercel-domains.service';
import { DomainPurchaseService } from './domain-purchase.service';
import { DomainPurchaseWebhookController } from './domain-purchase-webhook.controller';
import { MercadopagoModule } from '../mercadopago/mercadopago.module';

@Module({
  imports: [MercadopagoModule], // createPlatformPreference()/refundPlatformPayment() para la compra de dominios
  controllers: [DomainsController, DomainPurchaseWebhookController],
  providers: [DomainsService, VercelDomainsService, DomainPurchaseService],
})
export class DomainsModule {}
