import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { ReturnRequestsService } from './return-requests.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';

@Controller('storefront')
export class ReturnRequestsController {
  constructor(private readonly returnRequestsService: ReturnRequestsService) {}

  // @OptionalAuth() (no @Public()), mismo criterio que checkout()/tracking()
  // en storefront.controller.ts: sin login sigue funcionando igual (RBT-683
  // pide explícitamente "no debe requerir login"), pero si el cliente tiene
  // sesión @FullModeOnly() sí puede leerla. Throttle propio (más estricto
  // que el default de 60/60s): cada request dispara hasta 2 emails.
  @Post(':slug/return-requests')
  @OptionalAuth()
  @FullModeOnly()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  create(@Param('slug') slug: string, @Body() dto: CreateReturnRequestDto) {
    return this.returnRequestsService.create(slug, dto);
  }
}
