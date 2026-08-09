import { Module } from '@nestjs/common';
import { StorefrontController } from './storefront.controller';
import { MeController } from './me.controller';
import { StorefrontService } from './storefront.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule], // el checkout real reusa OrdersService.create()
  controllers: [StorefrontController, MeController],
  providers: [StorefrontService],
})
export class StorefrontModule {}
