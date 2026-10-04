import { Global, Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { DemoIaService } from './demo-ia.service';
import { DemoIaInterceptor } from './demo-ia.interceptor';
import { DemoFechasService } from './demo-fechas.service';

// Demo pública de Órbita (demo.orbita.site). Global: DemoIaInterceptor se usa
// con @UseInterceptors en rutas de varios módulos (productos, image-studio,
// Orbi) y necesita resolver DemoIaService desde cualquiera de ellos.
@Global()
@Module({
  controllers: [DemoController],
  providers: [DemoIaService, DemoIaInterceptor, DemoFechasService],
  exports: [DemoIaService, DemoIaInterceptor, DemoFechasService],
})
export class DemoModule {}
