import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { SoloSuperadmin } from '../common/decorators/platform-role.decorator';
import { PlatformAdminContext } from '../common/types/auth-context.type';
import { SendMessageDto } from '../conversations/dto/send-message.dto';
import { InstagramBandejaService } from './instagram-bandeja.service';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Superadmin → Marketing → Instagram: la bandeja de mensajes directos de la cuenta de la empresa.
// Son conversaciones privadas con personas de afuera: ver y contestar es solo de SUPERADMIN (un OPERATOR
// lee el resto del super panel, pero no estos mensajes).
@UseGuards(PlatformAdminGuard)
@SoloSuperadmin()
@Controller('platform/marketing/instagram')
export class InstagramBandejaController {
  constructor(private readonly bandeja: InstagramBandejaService) {}

  // Desconectar la cuenta de la empresa (se vuelve a conectar desde la bandeja del negocio).
  @Delete('connection')
  desconectar(@Req() req: RequestWithAdmin) {
    return this.bandeja.desconectar(req.user.adminId);
  }

  @Get('conversations')
  conversaciones(@Query('limit') limit?: string) {
    return this.bandeja.conversaciones(limit ? Number(limit) || 100 : 100);
  }

  @Get('conversations/:id/messages')
  mensajes(@Param('id', ParseUUIDPipe) id: string) {
    return this.bandeja.mensajes(id);
  }

  @Post('conversations/:id/messages')
  responder(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
    return this.bandeja.responder(id, dto);
  }
}
