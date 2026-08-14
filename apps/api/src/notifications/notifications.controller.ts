import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

// Campana del panel — cualquier miembro del negocio ve las mismas
// notificaciones (no hay preferencia por miembro individual, ver spec).
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: ListNotificationsQueryDto) {
    const member = assertMemberContext(ctx);
    return this.notificationsService.findAll(member.businessId, query);
  }

  // Contador liviano para el polling de la campana (cada 15s) — separado de
  // findAll() a propósito, mismo criterio que unread-count de conversations.
  @Get('unread-count')
  unreadCount(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.notificationsService.unreadCount(member.businessId);
  }

  @Patch(':id/read')
  markRead(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.notificationsService.markRead(member.businessId, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.notificationsService.markAllRead(member.businessId);
  }
}
