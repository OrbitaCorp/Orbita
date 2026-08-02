import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [DiscountsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
