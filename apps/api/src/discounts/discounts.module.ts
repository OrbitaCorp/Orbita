import { Module } from '@nestjs/common';
import { DiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';
import { DiscountsMetricsService } from './discounts-metrics.service';

@Module({
  controllers: [DiscountsController],
  providers: [DiscountsService, DiscountsMetricsService],
  // OrdersService lo usa para resolver un cupón al crear un pedido (RBT-616).
  exports: [DiscountsService],
})
export class DiscountsModule {}
