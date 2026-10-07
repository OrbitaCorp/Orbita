import { Module } from '@nestjs/common';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { VercelDomainsService } from './vercel-domains.service';
import { DomainPurchaseService } from './domain-purchase.service';
import { DomainPurchaseWebhookController } from './domain-purchase-webhook.controller';
import { DomainExpiryService } from './domain-expiry.service';
import { MercadopagoModule } from '../mercadopago/mercadopago.module';
import { SearchConsoleModule } from '../search-console/search-console.module';

@Module({
  // MercadopagoModule: createPlatformPreference()/refundPlatformPayment() para la compra de dominios.
  // SearchConsoleModule: al quedar activo un dominio propio se verifica en Google y se le envía el sitemap.
  imports: [MercadopagoModule, SearchConsoleModule],
  controllers: [DomainsController, DomainPurchaseWebhookController],
  providers: [DomainsService, VercelDomainsService, DomainPurchaseService, DomainExpiryService],
  // DomainExpiryService lo consume el mantenimiento nocturno (InternalCronModule).
  exports: [DomainExpiryService],
})
export class DomainsModule {}
