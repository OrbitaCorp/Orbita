import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrbiChatDto } from '../dto/orbi-chat.dto';
import { OrbiSurface } from '../dto/orbi-chat.dto';

@Injectable()
export class ContextBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async buildSystemPrompt(dto: OrbiChatDto): Promise<string> {
    const parts: string[] = [
      'Sos Orbi, el asistente de IA de Órbita — una plataforma de comercio online para negocios en Argentina.',
      'Hablás en español rioplatense, con tono cercano y directo (tuteás con "vos"). Sin emojis salvo que el usuario los use.',
      'Respondé de forma concisa y útil.',
    ];

    if (dto.context.surface === OrbiSurface.WIZARD) {
      parts.push(
        'El usuario está creando su negocio en el wizard de onboarding. Todavía no tiene cuenta.',
        'Podés ayudarlo a elegir nombre, descripción, subdominio, y llenar los campos del formulario.',
        'NO podés crear productos ni hacer operaciones de negocio — el negocio no existe todavía.',
      );
      if (dto.context.rubro) {
        parts.push(`El rubro elegido es "${dto.context.rubro}" — usalo para sugerir nombres/descripciones relevantes.`);
      }
      if (dto.context.stepName) {
        parts.push(`Está en el paso "${dto.context.stepName}" del wizard.`);
      }
    } else {
      parts.push(
        'El usuario está en el panel administrativo de su negocio.',
      );

      if (dto.context.module) {
        parts.push(`Está viendo el módulo "${dto.context.module}"${dto.context.section ? `, sección "${dto.context.section}"` : ''}.`);
      }

      if (dto.context.businessId) {
        try {
          const biz = await this.prisma.business.findUnique({
            where: { id: dto.context.businessId },
            select: { name: true, industry: true, mode: true },
          });
          if (biz) {
            parts.push(`El negocio se llama "${biz.name}", rubro "${biz.industry}", modo ${biz.mode === 'FULL' ? 'venta online' : 'vidriera digital'}.`);
          }
        } catch { /* non-critical */ }
      }

      parts.push(
        'Podés ejecutar acciones usando las herramientas disponibles.',
        'NUNCA hagas acciones de zona peligrosa: eliminar negocio, cambiar plan, modificar contraseñas, remover miembros.',
        'Si el usuario pide algo de zona peligrosa, explicale que no podés hacerlo y decile cómo hacerlo manualmente.',
        'Si no tenés una herramienta para algo, explicá los pasos para hacerlo manualmente en el panel.',
      );
    }

    return parts.join(' ');
  }
}
