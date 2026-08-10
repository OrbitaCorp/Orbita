import { Module } from '@nestjs/common';
import { MercadopagoController } from './mercadopago.controller';
import { MercadopagoWebhooksController } from './mercadopago-webhooks.controller';
import { MercadopagoService } from './mercadopago.service';

@Module({
  controllers: [MercadopagoController, MercadopagoWebhooksController],
  providers: [MercadopagoService],
  exports: [MercadopagoService],
})
export class MercadopagoModule {}
