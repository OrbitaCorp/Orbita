import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { MeService } from './me.service';

// PrismaModule, SupabaseModule, MailModule y AuthModule son @Global — no hace
// falta importarlos. AuthService (global) lo inyecta MeController directo para
// las rutas de sesiones (RBT-631).
@Module({
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
