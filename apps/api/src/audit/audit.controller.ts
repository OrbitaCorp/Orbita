import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { AuditService } from './audit.service';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';

// Solo lectura, a propósito: el registro no se edita ni se borra desde
// ningún endpoint (auditoría interna 10/09, ítem `api.audit`). Antes esto
// devolvía { message: 'not implemented' }.
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission('config.audit.view')
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindAuditLogsQueryDto) {
    const member = assertMemberContext(ctx);
    return this.auditService.listar(member.businessId, query);
  }
}
