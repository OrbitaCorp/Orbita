import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { StorefrontCountdownController } from './storefront-countdown.controller';
import { CountdownSettingsController } from './countdown-settings.controller';
import { CountdownService } from './countdown.service';

// El endpoint PÚBLICO de la tienda y el interruptor de la tarjeta de Avanzado
// (GET/PUT /countdown/settings). Crear la oferta relámpago en sí (el tipo del
// formulario de Descuentos) vive en DiscountsModule → DiscountCountdownService:
// StorefrontModule importa DiscountsModule, así que traerlo acá sería un ciclo.
@Module({
  imports: [
    StorefrontModule, // resolveBusinessId()
    BusinessesModule, // hasActiveAddon() para el gate del endpoint público
  ],
  controllers: [StorefrontCountdownController, CountdownSettingsController],
  providers: [CountdownService],
})
export class CountdownModule {}
