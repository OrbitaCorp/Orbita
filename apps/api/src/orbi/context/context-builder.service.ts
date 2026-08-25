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
      'Formato: frases cortas. Separá ideas o preguntas distintas en párrafos propios (salto de línea en blanco entre ellas) en vez de amontonarlas en un solo bloque. Nunca más de 2-3 oraciones por párrafo.',
    ];

    if (dto.context.surface === OrbiSurface.WIZARD) {
      if (dto.context.stepName === 'elegir-rubro') {
        parts.push(
          'El usuario está en la pantalla donde tiene que elegir el RUBRO (tipo de negocio) de la lista en pantalla, antes de crear la cuenta. Todavía no eligió ninguno.',
          'Tu única tarea acá es charlar con él para entender a qué se dedica y ayudarlo a identificar qué rubro de la lista le corresponde (ej. "tienda de ropa", "peluquería", "cafetería", "taller mecánico").',
          'NO sugieras nombres de negocio ni descripciones todavía — eso es en el paso siguiente, una vez que elija el rubro. No tenés herramientas para eso en esta pantalla.',
          'Cuando tengas claro qué rubro le corresponde, decíselo con confianza y decile que lo seleccione de la lista para continuar.',
        );
      } else {
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
