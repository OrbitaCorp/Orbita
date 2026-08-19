import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { CancellationsService } from './cancellations.service';
import { FindCancellationsQueryDto } from './dto/find-cancellations-query.dto';
import { RejectCancellationDto } from './dto/reject-cancellation.dto';

// Panel (Postventa → Cancelaciones): mismo criterio de permisos que
// devoluciones — ver leer con orders.view, resolver con orders.manage.
@Controller('cancellations')
export class CancellationsController {
  constructor(private readonly cancellationsService: CancellationsService) {}

  @Get()
  @RequirePermission('orders.view')
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindCancellationsQueryDto) {
    const member = assertMemberContext(ctx);
    return this.cancellationsService.findAll(member.businessId, query);
  }

  @Patch(':id/approve')
  @RequirePermission('orders.manage')
  approve(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.cancellationsService.approve(member.businessId, member.memberId, id);
  }

  @Patch(':id/reject')
  @RequirePermission('orders.manage')
  reject(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: RejectCancellationDto) {
    const member = assertMemberContext(ctx);
    return this.cancellationsService.reject(member.businessId, id, dto);
  }
}
