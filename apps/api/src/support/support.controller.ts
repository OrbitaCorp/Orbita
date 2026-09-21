import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { SUBIDA_IMAGEN } from '../common/utils/subida-imagen';
import { SupportService } from './support.service';
import { SendSupportRequestDto } from './dto/send-support-request.dto';
import { ReplySupportRequestDto } from './dto/reply-support-request.dto';
import { ManualFeedbackDto } from './dto/manual-feedback.dto';

// Lado del negocio (Configuración → Soporte y el Manual). Todo filtra por el
// businessId del token: un negocio nunca ve ni toca consultas de otro. Las
// rutas fijas van ANTES de ':id' — Nest las resuelve en orden de declaración
// y 'attachments' o 'manual-feedback' calzarían como un id.
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // Captura para adjuntar a un mensaje. Devuelve la URL pública; el mensaje
  // la manda después en `attachments` y el service verifica que sea de esta
  // cuenta. Tope propio, más alto que el de mandar consultas: son hasta 3
  // por mensaje y un reintento por foto pesada no tiene que bloquear.
  @Post('attachments')
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @UseInterceptors(FileInterceptor('file', SUBIDA_IMAGEN))
  uploadAttachment(@CurrentBusiness() ctx: AuthContext, @UploadedFile() file?: Express.Multer.File) {
    const member = assertMemberContext(ctx);
    if (!file) throw new BadRequestException('Falta el archivo "file"');
    return this.supportService.uploadAttachment(member.businessId, file);
  }

  @Post('manual-feedback')
  saveManualFeedback(@CurrentBusiness() ctx: AuthContext, @Body() dto: ManualFeedbackDto) {
    const member = assertMemberContext(ctx);
    return this.supportService.saveManualFeedback(member.businessId, member.memberId, dto);
  }

  @Get('manual-feedback')
  listManualFeedback(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.supportService.listManualFeedback(member.businessId, member.memberId);
  }

  // Cada consulta manda un mail a soporte@orbita.site: con tope propio para que
  // una cuenta no pueda llenar esa casilla (auditoría interna 10/09, ítem api.mail).
  @Post()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: SendSupportRequestDto) {
    const member = assertMemberContext(ctx);
    return this.supportService.create(member.businessId, member.memberId, dto);
  }

  @Get()
  list(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.supportService.list(member.businessId);
  }

  @Get(':id')
  get(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.supportService.get(member.businessId, id);
  }

  // Repreguntar en un hilo también manda un mail al buzón: mismo motivo que
  // el tope de arriba, un poco más holgado porque un ida y vuelta real puede
  // tener varios mensajes seguidos.
  @Post(':id/messages')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  addMessage(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: ReplySupportRequestDto) {
    const member = assertMemberContext(ctx);
    return this.supportService.addMessage(member.businessId, member.memberId, id, dto);
  }
}
