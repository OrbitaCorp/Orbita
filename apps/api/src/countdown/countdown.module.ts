import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { StorefrontCountdownController } from './storefront-countdown.controller';
import { CountdownService } from './countdown.service';

// Solo el endpoint PÚBLICO de la tienda. El lado del panel (prender la cuenta
// regresiva en un descuento) vive en DiscountsModule → DiscountCountdownService:
// es una opción del descuento, no un módulo aparte, y además StorefrontModule
// importa DiscountsModule, así que traerlo acá sería un ciclo.
@Module({
  imports: [
    StorefrontModule, // resolveBusinessId()
    BusinessesModule, // hasActiveAddon() para el gate del endpoint público
  ],
  controllers: [StorefrontCountdownController],
  providers: [CountdownService],
})
export class CountdownModule {}
