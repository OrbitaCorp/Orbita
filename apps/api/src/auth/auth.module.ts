import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { GoogleOAuthExchangeStore } from './google-oauth-exchange.store';
import { PlatformAdminLogModule } from '../platform/platform-admin-log.module';

@Global()
@Module({
  // PlatformAdminLogModule: el login y el segundo factor del super panel
  // quedan en platform_admin_logs (hallazgo `auditoria-acciones-sin-registro`,
  // parte 3). Es un módulo sin dependencias propias, así que importarlo desde
  // acá no arma ciclo con PlatformModule.
  imports: [PlatformAdminLogModule],
  controllers: [AuthController, GoogleAuthController],
  providers: [AuthService, GoogleAuthService, GoogleOAuthExchangeStore],
  exports: [AuthService],
})
export class AuthModule {}
