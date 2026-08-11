import { Module } from '@nestjs/common';
import { MercadopagoController } from './mercadopago.controller';
import { MercadopagoWebhooksController } from './mercadopago-webhooks.controller';
import { MercadopagoService } from './mercadopago.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule], // updateStatus() para confirmar el pedido al aprobarse el pago
  controllers: [MercadopagoController, MercadopagoWebhooksController],
  providers: [MercadopagoService],
  exports: [MercadopagoService],
})
export class MercadopagoModule {}
