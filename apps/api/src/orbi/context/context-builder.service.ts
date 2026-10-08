import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModuleDataService } from './module-data.service';
import type { OrbiChatDto } from '../dto/orbi-chat.dto';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import { CORE_PROMPT } from '../prompts/core';
import { getWizardPrompt } from '../prompts/wizard';
import { getPanelPrompt, type InfoDelNegocio } from '../prompts/panel';
import { capaDelManual } from '../prompts/manual';
import { capaDeAlcance } from '../prompts/alcance';
import { resolverModuloDelPanel } from '../navegacion/modulo-de-orbi';

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
      let businessInfo: InfoDelNegocio | undefined;

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

      // El panel manda module 'ventas' y la pantalla en section: sin esta
      // traducción ninguna pantalla recibía su capa ni su snapshot. El permiso
      // se busca con el módulo YA resuelto, así que llegar por section no
      // saltea el gate.
      const { modulo, seccion } = resolverModuloDelPanel(dto.context.module, dto.context.section);

      const permisoNecesario = modulo && Object.prototype.hasOwnProperty.call(PERMISO_DEL_SNAPSHOT, modulo)
        ? PERMISO_DEL_SNAPSHOT[modulo]
        : undefined;
      const moduleSnapshot = dto.context.businessId && modulo && permisoNecesario && permisos.includes(permisoNecesario)
        ? await this.moduleData.getSnapshot(dto.context.businessId, modulo)
        : {};

      // Caché implícita de Gemini: reusa el prefijo idéntico más largo entre
      // requests, y solo si pasa los 4096 tokens. Por eso el prompt va de lo
      // fijo a lo variable: core, alcance, índice del manual y reglas de todo
      // el panel (iguales para todos los negocios y pantallas, sin fechas ni
      // horas), después la capa de la pantalla (igual para todos los
      // negocios) y recién al final el negocio y los números del snapshot. La
      // nota de la demo se suma después, en el controller. Nada que cambie por
      // negocio, pantalla, permisos u hora puede ir antes de reglasDelPanel():
      // lo cuida context-builder.spec.ts ("prefijo compartido").
      layers.push(capaDeAlcance());
      layers.push(capaDelManual());
      layers.push(getPanelPrompt(
        modulo,
        seccion,
        businessInfo,
        moduleSnapshot,
      ));
    }

    return layers.join('\n\n---\n\n');
  }
}
