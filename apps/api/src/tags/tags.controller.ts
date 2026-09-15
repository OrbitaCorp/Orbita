import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { TagsService } from './tags.service';
import { UpsertTagDto } from './dto/upsert-tag.dto';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.tagsService.findAll(member.businessId);
  }

  @Post()
  @RequirePermission('catalog.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertTagDto) {
    const member = assertMemberContext(ctx);
    return this.tagsService.create(member.businessId, dto, member.memberId);
  }

  @Put(':id')
  @RequirePermission('catalog.manage')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertTagDto) {
    const member = assertMemberContext(ctx);
    return this.tagsService.update(member.businessId, id, dto, member.memberId);
  }

  @Delete(':id')
  @RequirePermission('catalog.manage')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.tagsService.remove(member.businessId, id, member.memberId);
  }
}
