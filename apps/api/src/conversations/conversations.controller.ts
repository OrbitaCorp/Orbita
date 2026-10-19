import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { CANALES_DE_BANDEJA, ConversationsService, type CanalDeBandeja } from './conversations.service';
import { SUBIDA_IMAGEN } from '../common/utils/subida-imagen';
import { SendImageDto } from './dto/send-image.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

// Bandeja de mensajes del panel. Hasta acá (17/09) andaba SIN gate de
// ningún tipo — "cualquier miembro puede leer/contestar, un empleado
// también atiende clientes" — así que Mensajes tampoco tenía forma de
// restringirse en un rol personalizado. Pedido explícito de Ale: que se
// pueda dar (o no) por rol, sin ascender a nadie a Propietario. Los
// negocios existentes reciben messages.view/manage por la migración
// 20260917_mensajes_avanzado_permisos (a TODOS los roles que ya tenían,
// sin gate ninguno) — el propietario siempre pasa (ver PermissionsGuard).
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @FullModeOnly()
  @RequirePermission('messages.view')
  findAll(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.conversationsService.findAllForBusiness(member.businessId);
  }

  // Contador liviano para la campana/el menú lateral (RBT-657) — separado de
  // findAll() a propósito: el header lo pide cada pocos segundos y no
  // necesita traer clientes/último mensaje de cada conversación para eso.
  @Get('unread-count')
  @FullModeOnly()
  @RequirePermission('messages.view')
  unreadCount(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.conversationsService.unreadCount(member.businessId);
  }

  @Get(':id/messages')
  @FullModeOnly()
  @RequirePermission('messages.view')
  messages(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Query('canal') canal?: string) {
    const member = assertMemberContext(ctx);
    if (canal !== undefined && !CANALES_DE_BANDEJA.includes(canal as CanalDeBandeja)) throw new BadRequestException('Canal inválido');
    return this.conversationsService.getMessages(member.businessId, id, !member.readOnly, canal as CanalDeBandeja | undefined);
  }

  @Post(':id/messages')
  @FullModeOnly()
  @RequirePermission('messages.manage')
  sendMessage(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: SendMessageDto) {
    const member = assertMemberContext(ctx);
    return this.conversationsService.sendMessage(member.businessId, id, dto);
  }

  // Una foto por WhatsApp (campo `file`, y `texto` como pie de foto): solo desde la bandeja de WhatsApp.
  @Post(':id/messages/image')
  @FullModeOnly()
  @RequirePermission('messages.manage')
  @UseInterceptors(FileInterceptor('file', SUBIDA_IMAGEN))
  sendImage(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: SendImageDto, @UploadedFile() file?: Express.Multer.File) {
    const member = assertMemberContext(ctx);
    return this.conversationsService.enviarImagen(member.businessId, id, file, dto.texto);
  }

  @Patch(':id')
  @FullModeOnly()
  @RequirePermission('messages.manage')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateConversationDto) {
    const member = assertMemberContext(ctx);
    return this.conversationsService.update(member.businessId, id, dto);
  }
}
