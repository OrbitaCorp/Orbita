import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModuleDataService } from './module-data.service';
import type { OrbiChatDto } from '../dto/orbi-chat.dto';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import { CORE_PROMPT } from '../prompts/core';
import { getWizardPrompt } from '../prompts/wizard';
import { contextoDelPanel, reglasDelPanel, type InfoDelNegocio } from '../prompts/panel';
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

const SEPARADOR_DE_CAPAS = '\n\n---\n\n';

/** Ver ContextBuilderService#armarPrompt. */
export type PromptDelTurno = { sistema: string; contexto: string };

@Injectable()
export class ContextBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleData: ModuleDataService,
  ) {}

  /**
   * El prompt del turno en dos partes:
   * - `sistema`: lo fijo, que va como systemInstruction. En el panel es core,
   *   alcance, índice del manual y reglas de todo el panel: idéntico para todos
   *   los negocios, pantallas, permisos y horas.
   * - `contexto`: lo que cambia por negocio y pantalla (la capa de la pantalla,
   *   el negocio y los números del snapshot). Va como primer mensaje de la
   *   conversación (mensajesDelTurno, turno/mensajes-del-turno.ts), no en el
   *   system: así systemInstruction + tools quedan byte a byte iguales entre
   *   requests y entran en la caché implícita de Gemini, que reusa el prefijo
   *   idéntico más largo y solo desde 4096 tokens. El system fijo solo no llega
   *   (~2.350 tokens); con las tools del dueño, sí. En el wizard es vacío.
   *
   * `permisos`: los efectivos de quien pregunta (ver permisosDeOrbi). Sin
   * permisos no hay snapshot, nunca "todo": el wizard y las evals llaman sin
   * pasarlos y no reciben datos de ningún negocio.
   */
  async armarPrompt(dto: OrbiChatDto, permisos: string[] = []): Promise<PromptDelTurno> {
    if (dto.context.surface === OrbiSurface.WIZARD) {
      return {
        sistema: [CORE_PROMPT, getWizardPrompt(
          dto.context.stepName,
          dto.context.rubro,
          dto.context.availableOptions,
          dto.context.formState,
        )].join(SEPARADOR_DE_CAPAS),
        contexto: '',
      };
    }

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

    // Nada que cambie por negocio, pantalla, permisos u hora puede ir en
    // `sistema`: lo cuida context-builder.spec.ts ("caché de Gemini"). La nota
    // de la demo se suma al contexto, en el controller.
    return {
      sistema: [CORE_PROMPT, capaDeAlcance(), capaDelManual(), reglasDelPanel()].join(SEPARADOR_DE_CAPAS),
      contexto: contextoDelPanel(modulo, seccion, businessInfo, moduleSnapshot),
    };
  }

  /**
   * El prompt entero en un solo texto: `sistema` y después `contexto`, en el
   * orden en que los lee el modelo. Es lo que se mandaba como system antes de
   * separarlos. Lo usan el wizard (que no tiene contexto aparte), las evals que
   * miran el contenido y los tests. El panel NO lo manda así: arma los
   * mensajes con armarPrompt + mensajesDelTurno.
   */
  async buildSystemPrompt(dto: OrbiChatDto, permisos: string[] = []): Promise<string> {
    const { sistema, contexto } = await this.armarPrompt(dto, permisos);
    return contexto ? `${sistema}\n\n${contexto}` : sistema;
  }
}
