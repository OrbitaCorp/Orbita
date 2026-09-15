import { Module } from '@nestjs/common';
import { PlatformAdminLogService } from './platform-admin-log.service';

// Módulo chico a propósito (hallazgo `auditoria-acciones-sin-registro`,
// parte 3): PlatformAdminLogService lo consumen PlatformModule (mails de
// prueba) y AuthModule (login y segundo factor del super panel). Si viviera
// en PlatformModule, AuthModule (@Global) tendría que importar PlatformModule
// entero, con sus controllers y sus imports (suscripciones, analítica del
// wizard) — y un ciclo con cualquiera de ellos pediría forwardRef. Con un
// módulo que solo depende de PrismaModule (@Global) no hay ciclo posible.
@Module({
  providers: [PlatformAdminLogService],
  exports: [PlatformAdminLogService],
})
export class PlatformAdminLogModule {}
