import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { FindReturnsQueryDto } from './dto/find-returns-query.dto';

// (Fase 3 — Ale) Mismos permisos que pedidos: ver para leer, gestionar para
// crear y resolver — una devolución es una acción sobre un pedido.
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  @RequirePermission('orders.view')
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindReturnsQueryDto) {
    const member = assertMemberContext(ctx);
    return this.returnsService.findAll(member.businessId, query);
  }

  @Post()
  @RequirePermission('orders.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: CreateReturnDto) {
    const member = assertMemberContext(ctx);
    return this.returnsService.create(member.businessId, dto);
  }

  @Patch(':id')
  @RequirePermission('orders.manage')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateReturnDto) {
    const member = assertMemberContext(ctx);
    return this.returnsService.update(member.businessId, member.memberId, id, dto);
  }
}
