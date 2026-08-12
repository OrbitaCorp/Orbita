import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { MessageTemplatesService } from './message-templates.service';
import { UpsertMessageTemplateDto } from './dto/upsert-message-template.dto';

@Controller('message-templates')
export class MessageTemplatesController {
  constructor(private readonly messageTemplatesService: MessageTemplatesService) {}

  // Cualquier miembro puede leer y usar plantillas para contestar (mismo
  // criterio que ConversationsController) — solo crear/editar/borrar exige
  // owner/admin, para que un empleado no reescriba las respuestas del negocio.
  @Get()
  @FullModeOnly()
  findAll(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.messageTemplatesService.findAll(member.businessId);
  }

  @Post()
  @Roles('owner', 'admin')
  @FullModeOnly()
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertMessageTemplateDto) {
    const member = assertMemberContext(ctx);
    return this.messageTemplatesService.create(member.businessId, dto);
  }

  @Put(':id')
  @Roles('owner', 'admin')
  @FullModeOnly()
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertMessageTemplateDto) {
    const member = assertMemberContext(ctx);
    return this.messageTemplatesService.update(member.businessId, id, dto);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @FullModeOnly()
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.messageTemplatesService.remove(member.businessId, id);
  }
}
