import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { CustomerOrdersController } from './customer-orders.controller';
import { OrdersService } from './orders.service';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [DiscountsModule],
  controllers: [OrdersController, CustomerOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
