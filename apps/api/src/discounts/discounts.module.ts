import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { DiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';
import { DiscountsMetricsService } from './discounts-metrics.service';
import { DiscountCountdownService } from './discount-countdown.service';

@Module({
  // BusinessesModule: hasActiveAddon() para el gate de la cuenta regresiva
  // (paquete Avanzado) en DiscountCountdownService.
  imports: [BusinessesModule],
  controllers: [DiscountsController],
  providers: [DiscountsService, DiscountsMetricsService, DiscountCountdownService],
  // OrdersService lo usa para resolver un cupón al crear un pedido (RBT-616).
  exports: [DiscountsService],
})
export class DiscountsModule {}
