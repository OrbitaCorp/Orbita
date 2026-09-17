import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { SocialProofService } from './social-proof.service';
import { UpsertSocialProofDto } from './dto/upsert-social-proof.dto';

// Gate de escritura: antes @Roles('owner','admin') a secas, ahora
// @RequirePermission('advanced.manage') — mismo universo de acceso hoy
// (los roles owner/admin de fábrica ya lo tienen, ver la migración
// 20260917_mensajes_avanzado_permisos), pero delegable: el dueño puede
// darle Avanzado a un rol personalizado sin ascenderlo (pedido 17/09).
// Paquete "Avanzado" — gateado por AddonGuard en los tres endpoints, mismo
// patrón que PromoModalController. Panel (dueño configurando); el consumo
// desde el storefront va por StorefrontSocialProofController, público.
@Controller('social-proof')
export class SocialProofController {
  constructor(private readonly socialProofService: SocialProofService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  get(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.socialProofService.getForBusiness(member.businessId);
  }

  // Configurarlo es una decisión del dueño, no una tarea operativa: mismo
  // gate que los descuentos y la oferta relámpago. Hasta la auditoría interna
  // del 09/09 (ítem `api.common`, verificación 2) alcanzaba con ser miembro
  // del negocio, así que cualquier empleado lo podía cambiar.
  @Put()
  @RequirePermission('advanced.manage')
  @RequiresAddon('ADVANCED')
  upsert(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertSocialProofDto) {
    const member = assertMemberContext(ctx);
    return this.socialProofService.upsert(member.businessId, dto);
  }

  // Preview para el panel: los mismos eventos que vería el storefront, pero
  // visibles para el dueño aunque el toggle todavía esté apagado — así puede
  // decidir si tiene pedidos recientes suficientes antes de prenderlo.
  @Get('preview')
  @RequiresAddon('ADVANCED')
  preview(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.socialProofService.getRecentEvents(member.businessId);
  }
}
