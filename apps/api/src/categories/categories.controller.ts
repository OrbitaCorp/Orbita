import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { CategoriesService } from './categories.service';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { UpsertCategoryDto } from './dto/upsert-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@CurrentBusiness() ctx: AuthContext, @Query('flat') flat?: string) {
    const member = assertMemberContext(ctx);
    return this.categoriesService.findAll(member.businessId, flat === 'true');
  }

  @Patch('reorder')
  @RequirePermission('catalog.manage')
  reorder(@CurrentBusiness() ctx: AuthContext, @Body() dto: ReorderCategoriesDto) {
    const member = assertMemberContext(ctx);
    return this.categoriesService.reorder(member.businessId, dto);
  }

  @Post()
  @RequirePermission('catalog.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertCategoryDto) {
    const member = assertMemberContext(ctx);
    return this.categoriesService.create(member.businessId, dto, member.memberId);
  }

  @Put(':id')
  @RequirePermission('catalog.manage')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertCategoryDto) {
    const member = assertMemberContext(ctx);
    return this.categoriesService.update(member.businessId, id, dto, member.memberId);
  }

  @Delete(':id')
  @RequirePermission('catalog.manage')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.categoriesService.remove(member.businessId, id, member.memberId);
  }
}
