import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { WhatsappService } from './whatsapp.service';
import { ConnectWhatsappDto } from './dto/connect-whatsapp.dto';
import { EmbeddedSignupDto } from './dto/embedded-signup.dto';
import { UpdateWhatsappBotDto } from './dto/update-whatsapp-bot.dto';
import { WhatsappBotService } from './whatsapp-bot.service';

// Conexión de WhatsApp del negocio, desde el panel. Conectar y desconectar son
// cosa de propietario/admin (igual que Mercado Pago): cambian a dónde llegan
// los mensajes de los clientes.
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly bot: WhatsappBotService,
  ) {}

  @Get('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async estado(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    await this.whatsapp.asegurarHabilitado(businessId);
    return this.whatsapp.estado(businessId);
  }

  @Post('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async conectar(@CurrentBusiness() ctx: AuthContext, @Body() dto: ConnectWhatsappDto) {
    const { businessId } = assertMemberContext(ctx);
    await this.whatsapp.asegurarHabilitado(businessId);
    return this.whatsapp.conectar(businessId, dto);
  }

  // Conexión por Embedded Signup (el botón de Meta dentro del panel): el cliente conecta su propia cuenta sin pegar nada.
  @Post('embedded-signup')
  @FullModeOnly()
  @Roles('owner', 'admin')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async conectarIntegrado(@CurrentBusiness() ctx: AuthContext, @Body() dto: EmbeddedSignupDto) {
    const { businessId } = assertMemberContext(ctx);
    await this.whatsapp.asegurarHabilitado(businessId);
    return this.whatsapp.conectarConEmbeddedSignup(businessId, dto);
  }

  // Orbi como atención al público por WhatsApp (paquete Avanzado): su configuración y lo que va gastado del cupo del mes.
  @Get('bot')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async estadoDelBot(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    await this.whatsapp.asegurarHabilitado(businessId);
    return this.bot.estado(businessId);
  }

  @Patch('bot')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async guardarBot(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpdateWhatsappBotDto) {
    const { businessId } = assertMemberContext(ctx);
    await this.whatsapp.asegurarHabilitado(businessId);
    return this.bot.guardar(businessId, dto);
  }

  @Delete('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async desconectar(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    await this.whatsapp.asegurarHabilitado(businessId);
    return this.whatsapp.desconectar(businessId);
  }
}
