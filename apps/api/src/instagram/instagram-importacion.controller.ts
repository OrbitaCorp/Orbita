import { Controller, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { InternalCronSecretGuard } from '../internal-cron/internal-cron-secret.guard';
import { InstagramImportacionService } from './instagram-importacion.service';

// Endpoint interno de la importación de charlas de Instagram (ver instagram-importacion.service.ts). Lo llama la propia
// API al conectar una cuenta, para que la importación corra dentro de un pedido (Cloud Run no le da CPU a lo que sigue
// después de responder). Servidor a servidor: sin sesión, con el mismo secreto que los cron.
@Controller('instagram/importacion')
@Public()
@SkipThrottle()
@UseGuards(InternalCronSecretGuard)
export class InstagramImportacionController {
  constructor(private readonly importacion: InstagramImportacionService) {}

  @Post(':businessId')
  @HttpCode(200)
  tanda(@Param('businessId') businessId: string, @Query('desde') desde?: string) {
    const n = Number(desde);
    return this.importacion.tanda(businessId, Number.isInteger(n) && n > 0 ? n : 0);
  }
}
