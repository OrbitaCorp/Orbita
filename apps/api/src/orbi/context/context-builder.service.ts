import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModuleDataService } from './module-data.service';
import type { OrbiChatDto } from '../dto/orbi-chat.dto';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import { CORE_PROMPT } from '../prompts/core';
import { getWizardPrompt } from '../prompts/wizard';
import { getPanelPrompt } from '../prompts/panel';

// Permiso que hace falta para meterle al prompt el snapshot de cada módulo. Es
// el mismo que exige la pantalla equivalente por HTTP: el snapshot son números
// del negocio (facturación, clientes, mensajes) y no tiene que salir de acá para
// alguien que por el panel no los vería.
const PERMISO_DEL_SNAPSHOT: Record<string, string> = {
  dashboard: 'reports.dashboard',
  pedidos: 'orders.view',
  clientes: 'customers.view',
  catalogo: 'catalog.view',
  mensajes: 'messages.view',
};

@Injectable()
export class ContextBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleData: ModuleDataService,
  ) {}

  /**
   * `permisos`: los efectivos de quien pregunta (ver permisosDeOrbi). Sin
   * permisos no hay snapshot, nunca "todo": el wizard y las evals llaman sin
   * pasarlos y no reciben datos de ningún negocio.
   */
  async buildSystemPrompt(dto: OrbiChatDto, permisos: string[] = []): Promise<string> {
    const layers: string[] = [CORE_PROMPT];

    if (dto.context.surface === OrbiSurface.WIZARD) {
      layers.push(getWizardPrompt(
        dto.context.stepName,
        dto.context.rubro,
        dto.context.availableOptions,
        dto.context.formState,
      ));
    } else {
      let businessInfo: { name: string; industry: string; mode: string } | undefined;

      if (dto.context.businessId) {
        try {
          const biz = await this.prisma.business.findUnique({
            where: { id: dto.context.businessId },
            select: { name: true, industry: true, mode: true },
          });
          if (biz) {
            businessInfo = { name: biz.name, industry: biz.industry, mode: biz.mode };
          }
        } catch { /* non-critical */ }
      }

      const permisoNecesario = dto.context.module ? PERMISO_DEL_SNAPSHOT[dto.context.module] : undefined;
      const moduleSnapshot = dto.context.businessId && dto.context.module && permisoNecesario && permisos.includes(permisoNecesario)
        ? await this.moduleData.getSnapshot(dto.context.businessId, dto.context.module)
        : {};

      layers.push(getPanelPrompt(
        dto.context.module,
        dto.context.section,
        businessInfo,
        moduleSnapshot,
      ));
    }

    return layers.join('\n\n---\n\n');
  }
}
