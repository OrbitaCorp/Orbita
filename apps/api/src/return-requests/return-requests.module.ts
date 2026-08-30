import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { ReturnRequestsController } from './return-requests.controller';
import { ReturnRequestsService } from './return-requests.service';

// RBT-683 — módulo aparte de ReturnsModule/CancellationsModule a propósito:
// esos dos son flujos con sesión, estados y panel de gestión; este es un
// único endpoint público que solo genera un número de trámite y dispara dos
// emails (ver el comentario grande en return-requests.service.ts).
@Module({
  imports: [StorefrontModule], // resolveBusinessId()
  controllers: [ReturnRequestsController],
  providers: [ReturnRequestsService],
})
export class ReturnRequestsModule {}
