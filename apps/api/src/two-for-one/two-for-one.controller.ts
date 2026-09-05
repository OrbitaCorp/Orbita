import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { TwoForOneService } from './two-for-one.service';
import { UpsertTwoForOneDto } from './dto/upsert-two-for-one.dto';

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

  @Post()
  @RequiresAddon('ADVANCED')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertTwoForOneDto) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.create(member.businessId, member.memberId, dto);
  }

  @Put(':id')
  @RequiresAddon('ADVANCED')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertTwoForOneDto) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.update(member.businessId, id, dto);
  }

  @Patch(':id/toggle')
  @RequiresAddon('ADVANCED')
  toggle(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.toggle(member.businessId, id);
  }

  @Delete(':id')
  @RequiresAddon('ADVANCED')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.remove(member.businessId, id);
  }
}
