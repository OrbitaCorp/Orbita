import { Module } from '@nestjs/common';
import { TiktokCallbackController, TiktokController } from './tiktok.controller';
import { TiktokService } from './tiktok.service';

// Marketing de Órbita en TikTok (ver tiktok.service.ts). Lo usa el super panel y, para renovar
// el token cada noche, el mantenimiento nocturno (InternalCronModule).
@Module({
  controllers: [TiktokController, TiktokCallbackController],
  providers: [TiktokService],
  exports: [TiktokService],
})
export class TiktokModule {}
