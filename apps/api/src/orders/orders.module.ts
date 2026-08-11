import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { CustomerOrdersController } from './customer-orders.controller';
import { OrdersService } from './orders.service';
import { DiscountsModule } from '../discounts/discounts.module';
import { ReturnsModule } from '../returns/returns.module';

@Module({
  imports: [DiscountsModule, ReturnsModule],
  controllers: [OrdersController, CustomerOrdersController],
  providers: [OrdersService],
  exports: [OrdersService], // StorefrontModule lo usa para el checkout real
})
export class OrdersModule {}
