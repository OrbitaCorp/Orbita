import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
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
import { SetDiscountLinkDto } from './dto/set-discount-link.dto';
import { SendDiscountLinkDto } from './dto/send-discount-link.dto';

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
  evaluate(@CurrentBusiness() ctx: AuthContext, @Body() dto: EvaluateDiscountsDto) {
    if (ctx.type === 'platform_admin') {
      throw new ForbiddenException('Este recurso pertenece a un negocio.');
    }
    return this.discountsService.evaluate(ctx.businessId, dto);
  }

  @Post('validate')
  validate(@Body() dto: ValidateCouponDto) {
    void this.discountsService;
    return { message: 'not implemented' };
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

  @Post(':id/duplicate')
  @Roles('owner', 'admin')
  duplicate(@Param('id') id: string) {
    void this.discountsService;
    return { message: 'not implemented' };
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.discountsService.remove(member.businessId, id);
  }

  @Get(':id/metrics')
  metricsById(@Param('id') id: string) {
    void this.discountsService;
    return { message: 'not implemented' };
  }

  @Get(':id/audit')
  audit(@Param('id') id: string) {
    void this.discountsService;
    return { message: 'not implemented' };
  }

  @Patch(':id/link')
  @Roles('owner', 'admin')
  setLink(@Param('id') id: string, @Body() dto: SetDiscountLinkDto) {
    void this.discountsService;
    return { message: 'not implemented' };
  }

  @Post(':id/send-link')
  @Roles('owner', 'admin')
  sendLink(@Param('id') id: string, @Body() dto: SendDiscountLinkDto) {
    void this.discountsService;
    return { message: 'not implemented' };
  }
}
