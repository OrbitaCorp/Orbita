import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { StorefrontCountdownController } from './storefront-countdown.controller';
import { CountdownService } from './countdown.service';

// Sin controller de panel a propósito: no hay nada que el dueño configure
// acá aparte de lo que ya hace en Descuentos (ver comentario en
// countdown.service.ts) — un solo endpoint público.
@Module({
  imports: [StorefrontModule],
  controllers: [StorefrontCountdownController],
  providers: [CountdownService],
})
export class CountdownModule {}
