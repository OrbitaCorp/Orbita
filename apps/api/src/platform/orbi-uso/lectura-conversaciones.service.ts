import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { redact } from '../../wizard-analytics/redact';
import { PlatformAdminLogService } from '../platform-admin-log.service';
import { AbrirConversacionDto } from './dto/abrir-conversacion.dto';

interface MensajeLeido {
  rol: 'user' | 'assistant';
  texto: string;
  fecha: string | null;
}

@Injectable()
export class LecturaConversacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly adminLog: PlatformAdminLogService,
  ) {}

  /** ORBI_LECTURA_CONVERSACIONES === 'on' exacto: cualquier otra cosa es apagado. */
  get habilitada(): boolean {
    return this.config.get<string>('ORBI_LECTURA_CONVERSACIONES') === 'on';
  }

  /**
   * Abre una conversación de Orbi para un admin de plataforma (spec D10). El
   * acceso se registra ANTES de devolver el texto: si el registro falla, no se
   * muestra nada (Ley 25.326 art. 9: poder detectar accesos). El texto sale
   * redactado (emails, teléfonos, documentos, tarjetas). Apagado = 403 antes de
   * tocar la base.
   */
  async abrir(conversationId: string, adminId: string, dto: AbrirConversacionDto) {
    if (!this.habilitada) {
      throw new ForbiddenException('La lectura de conversaciones está deshabilitada hasta actualizar la política de privacidad.');
    }
    const conv = await this.prisma.orbiConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, title: true, businessId: true, userId: true, version: true, messages: true },
    });
    if (!conv) throw new NotFoundException('No existe esa conversación');

    const ticket = dto.ticket?.trim() || null;
    await this.prisma.orbiConversationAccess.create({
      data: { adminId, conversationId, businessId: conv.businessId, memberId: conv.userId, motivo: dto.motivo, detalle: dto.detalle.trim(), ticket },
    });
    await this.adminLog.orbiConversacionAbierta({ adminId, conversationId, businessId: conv.businessId, motivo: dto.motivo, ticket: ticket ?? undefined });

    const mensajes = conv.version === 2 ? await this.mensajesV2(conv.id, conv.businessId) : mensajesV1(conv.messages);
    return {
      id: conv.id,
      titulo: conv.title,
      businessId: conv.businessId,
      memberId: conv.userId,
      mensajes: mensajes.map((m) => ({ ...m, texto: redact(m.texto) })),
    };
  }

  // Versión 2: los mensajes van en orbi_messages, por partes. Solo se leen las
  // de tipo 'texto' (lo que se dijeron); el pensamiento, la actividad de las
  // herramientas y los avisos no son conversación.
  private async mensajesV2(conversationId: string, businessId: string): Promise<MensajeLeido[]> {
    const filas = await this.prisma.orbiMessage.findMany({
      where: { conversationId, businessId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, parts: true, createdAt: true },
    });
    return filas
      .map((f) => ({
        rol: (f.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        texto: (Array.isArray(f.parts) ? f.parts : [])
          .filter((p): p is { tipo: 'texto'; texto: string } => !!p && typeof p === 'object' && (p as { tipo?: unknown }).tipo === 'texto' && typeof (p as { texto?: unknown }).texto === 'string')
          .map((p) => p.texto)
          .join('\n'),
        fecha: f.createdAt.toISOString(),
      }))
      .filter((m) => m.texto !== '');
  }
}

// Versión 1: los mensajes van en el Json de la conversación. Los de rol 'tool'
// son resultados de herramientas (datos internos, no conversación) y los de
// asistente que solo llaman herramientas vienen con el texto vacío.
function mensajesV1(messages: unknown): MensajeLeido[] {
  return (Array.isArray(messages) ? messages : [])
    .filter((m): m is { role: 'user' | 'assistant'; content: string; timestamp?: string } => {
      if (!m || typeof m !== 'object') return false;
      const { role, content } = m as { role?: unknown; content?: unknown };
      return (role === 'user' || role === 'assistant') && typeof content === 'string' && content !== '';
    })
    .map((m) => ({ rol: m.role, texto: m.content, fecha: m.timestamp ?? null }));
}
