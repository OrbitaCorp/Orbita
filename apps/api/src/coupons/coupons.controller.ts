import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { CouponsService } from './coupons.service';
import { UpsertCouponDto } from './dto/upsert-coupon.dto';
import { FindCouponsQueryDto } from './dto/find-coupons-query.dto';
import { SendCouponLinkEmailDto } from './dto/send-link-email.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // Mismo hueco que tenía /discounts antes de la auditoría 10/09
  // (web.panel.descuentos): sin permiso, cualquier miembro listaba cupones
  // y veía el código de los privados por la API aunque el menú no le
  // mostrara Descuentos. Se había cerrado en DiscountsController pero no acá
  // (hallazgo 17/09, ítem equipo-permisos-catalogo).
  @Get()
  @RequirePermission('discounts.view')
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindCouponsQueryDto) {
    const member = assertMemberContext(ctx);
    return this.couponsService.findAll(member.businessId, query);
  }

  @Get(':id')
  @RequirePermission('discounts.view')
  findOne(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.couponsService.findOne(member.businessId, id);
  }

  @Post()
  @RequirePermission('discounts.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertCouponDto) {
    const member = assertMemberContext(ctx);
    return this.couponsService.create(member.businessId, member.memberId, dto);
  }

  // Throttle propio: sale con el remitente de Órbita a cualquier dirección
  // (auditoría interna 10/09, ítem api.coupons).
  @Post('link-email')
  @RequirePermission('discounts.manage')
  @Throttle({ default: { limit: 30, ttl: 3600000 } })
  sendLinkEmail(@CurrentBusiness() ctx: AuthContext, @Body() dto: SendCouponLinkEmailDto) {
    const member = assertMemberContext(ctx);
    return this.couponsService.sendLinkEmail(member.businessId, dto);
  }

  @Put(':id')
  @RequirePermission('discounts.manage')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertCouponDto) {
    const member = assertMemberContext(ctx);
    return this.couponsService.update(member.businessId, id, dto, member.memberId);
  }

  @Patch(':id/toggle')
  @RequirePermission('discounts.manage')
  toggle(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.couponsService.toggle(member.businessId, id, member.memberId);
  }

  @Delete(':id')
  @RequirePermission('discounts.manage')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.couponsService.remove(member.businessId, id, member.memberId);
  }
}
