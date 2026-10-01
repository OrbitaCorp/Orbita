import { Global, Module } from '@nestjs/common';
import { CuotaService } from './cuota.service';

// Global como PrismaModule: lo piden Orbi, Products e ImageStudio, y ninguno
// tiene que importar al otro (evita la dependencia circular Orbi → Products).
@Global()
@Module({
  providers: [CuotaService],
  exports: [CuotaService],
})
export class CuotaModule {}
