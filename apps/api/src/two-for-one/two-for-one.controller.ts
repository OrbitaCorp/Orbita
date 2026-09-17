import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { TwoForOneService } from './two-for-one.service';
import { UpsertTwoForOneDto } from './dto/upsert-two-for-one.dto';

// Gate de escritura: antes @Roles('owner','admin') a secas, ahora
// @RequirePermission('advanced.manage') — mismo universo de acceso hoy
// (los roles owner/admin de fábrica ya lo tienen, ver la migración
// 20260917_mensajes_avanzado_permisos), pero delegable: el dueño puede
// darle Avanzado a un rol personalizado sin ascenderlo (pedido 17/09).
// "2x1 y 3x2" (paquete Avanzado, RBT-675) — gateado por AddonGuard en todos
// los endpoints, mismo patrón que PromoModalController/DiscountsController
// (toggle/remove siguen el mismo shape que este último). Panel únicamente:
// el consumo real (el motor aplicando el descuento, el badge del catálogo)
// pasa por DiscountsService/StorefrontService, no por acá. Un negocio puede
// tener varias promos a la vez (2026-09-04), de ahí el CRUD completo en vez
// de un get/upsert de un solo registro.
@Controller('two-for-one')
export class TwoForOneController {
  constructor(private readonly twoForOne: TwoForOneService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  list(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.list(member.businessId);
  }

  // Configurarlo es una decisión del dueño, no una tarea operativa: mismo
  // gate que los descuentos y la oferta relámpago. Hasta la auditoría interna
  // del 09/09 (ítem `api.common`, verificación 2) alcanzaba con ser miembro
  // del negocio, así que cualquier empleado lo podía cambiar.
  @Post()
  @RequirePermission('advanced.manage')
  @RequiresAddon('ADVANCED')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertTwoForOneDto) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.create(member.businessId, member.memberId, dto);
  }

  @Put(':id')
  @RequirePermission('advanced.manage')
  @RequiresAddon('ADVANCED')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertTwoForOneDto) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.update(member.businessId, id, dto);
  }

  @Patch(':id/toggle')
  @RequirePermission('advanced.manage')
  @RequiresAddon('ADVANCED')
  toggle(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.toggle(member.businessId, id);
  }

  @Delete(':id')
  @RequirePermission('advanced.manage')
  @RequiresAddon('ADVANCED')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.remove(member.businessId, id);
  }
}
