import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { CostsModule } from '../platform/costs/costs.module';

// Módulo global transversal: expone MailService a toda la app sin que cada
// módulo de dominio tenga que importarlo explícitamente. El envío en sí
// (Resend) y el render de plantillas se resuelven dentro de MailService, así
// que acá no hace falta configurar ningún transporte.
@Global()
@Module({
  imports: [CostsModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
