import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { WhatsappService } from './whatsapp.service';
import { ConnectWhatsappDto } from './dto/connect-whatsapp.dto';

// Conexión de WhatsApp del negocio, desde el panel. Conectar y desconectar son
// cosa de propietario/admin (igual que Mercado Pago): cambian a dónde llegan
// los mensajes de los clientes.
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  estado(@CurrentBusiness() ctx: AuthContext) {
    return this.whatsapp.estado(assertMemberContext(ctx).businessId);
  }

  @Post('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  conectar(@CurrentBusiness() ctx: AuthContext, @Body() dto: ConnectWhatsappDto) {
    return this.whatsapp.conectar(assertMemberContext(ctx).businessId, dto);
  }

  @Delete('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  desconectar(@CurrentBusiness() ctx: AuthContext) {
    return this.whatsapp.desconectar(assertMemberContext(ctx).businessId);
  }
}
