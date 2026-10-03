import { Module } from '@nestjs/common';
import { CupoOrbiService } from './cupo-orbi.service';

// PrismaModule y ConfigModule son globales (app.module.ts): no se importan acá.
@Module({
  providers: [CupoOrbiService],
  exports: [CupoOrbiService],
})
export class CupoOrbiModule {}
