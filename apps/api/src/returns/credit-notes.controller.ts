import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { ReturnsService } from './returns.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { FindCreditNotesQueryDto } from './dto/find-credit-notes-query.dto';

@Controller('credit-notes')
export class CreditNotesController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  @RequirePermission('orders.view')
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindCreditNotesQueryDto) {
    const member = assertMemberContext(ctx);
    return this.returnsService.findAllCreditNotes(member.businessId, query);
  }

  @Post()
  @RequirePermission('orders.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: CreateCreditNoteDto) {
    const member = assertMemberContext(ctx);
    return this.returnsService.createCreditNote(member.businessId, dto);
  }
}
