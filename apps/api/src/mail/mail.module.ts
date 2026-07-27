import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// Módulo global transversal: expone MailService a toda la app sin que cada
// módulo de dominio tenga que importarlo explícitamente. El envío en sí
// (Resend) y el render de plantillas se resuelven dentro de MailService, así
// que acá no hace falta configurar ningún transporte.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
