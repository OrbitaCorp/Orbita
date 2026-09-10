import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { DiscountsService } from './discounts.service';
import { DiscountsMetricsService } from './discounts-metrics.service';
import { MetricsQueryDto } from './dto/metrics-query.dto';
import { EvaluateDiscountsDto } from './dto/evaluate-discounts.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { UpsertDiscountDto } from './dto/upsert-discount.dto';
import { FindDiscountsQueryDto } from './dto/find-discounts-query.dto';

// Auditoría interna 10/09 (ítem api.discounts): salieron cinco rutas stub que
// respondían "not implemented" y nadie usa (duplicar, métricas y auditoría por
// descuento, link y envío de link). Los DTOs set-/send-discount-link quedan
// sin uso.
@Controller('discounts')
export class DiscountsController {
  constructor(
    private readonly discountsService: DiscountsService,
    private readonly metricsService: DiscountsMetricsService,
  ) {}

  @Get()
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindDiscountsQueryDto) {
    const member = assertMemberContext(ctx);
    return this.discountsService.findAll(member.businessId, query);
  }

  // Rendimiento de descuentos/cupones (agrega sobre DiscountRedemption). Devuelve
  // ceros mientras no haya canjes (checkout stub) — no es un bug.
  @Get('metrics')
  metrics(@CurrentBusiness() ctx: AuthContext, @Query() query: MetricsQueryDto) {
    const member = assertMemberContext(ctx);
    return this.metricsService.resumen(member.businessId, query);
  }

  // Lo consume el checkout del storefront (customer) y el panel (member): no
  // alcanza con assertMemberContext, porque el comprador también evalúa su
  // carrito. Un platform_admin sí queda afuera: no pertenece a ningún negocio.
  @Post('evaluate')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  evaluate(@CurrentBusiness() ctx: AuthContext, @Body() dto: EvaluateDiscountsDto) {
    if (ctx.type === 'platform_admin') {
      throw new ForbiddenException('Este recurso pertenece a un negocio.');
    }
    return this.discountsService.evaluate(ctx.businessId, dto);
  }

  // Lo usa el checkout del storefront antes de confirmar la compra (customer)
  // y el panel para probar un cupón (member): mismo criterio de acceso que
  // /evaluate, solo bloquea platform_admin.
  //
  // Un cliente se evalúa SIEMPRE como él mismo: el `customerId` del body solo
  // lo puede elegir el panel (probar el cupón de un cliente). Antes un
  // cliente podía mandar el id de otro y probar sus cupones personales
  // (premios de juegos). Throttle propio: probar códigos es fuerza bruta
  // (auditoría interna 10/09, ítem api.discounts).
  @Post('validate')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  validate(@CurrentBusiness() ctx: AuthContext, @Body() dto: ValidateCouponDto) {
    if (ctx.type === 'platform_admin') {
      throw new ForbiddenException('Este recurso pertenece a un negocio.');
    }
    const customerId = ctx.type === 'customer' ? ctx.customerId : dto.customerId;
    return this.discountsService.validateCoupon(ctx.businessId, { ...dto, customerId });
  }

  @Get(':id')
  findOne(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.discountsService.findOne(member.businessId, id);
  }

  @Post()
  @Roles('owner', 'admin')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertDiscountDto) {
    const member = assertMemberContext(ctx);
    return this.discountsService.create(member.businessId, member.memberId, dto);
  }

  @Put(':id')
  @Roles('owner', 'admin')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertDiscountDto) {
    const member = assertMemberContext(ctx);
    return this.discountsService.update(member.businessId, id, dto);
  }

  @Patch(':id/toggle')
  @Roles('owner', 'admin')
  toggle(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.discountsService.toggle(member.businessId, id);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.discountsService.remove(member.businessId, id);
  }
}
