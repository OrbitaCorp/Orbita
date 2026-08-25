import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';

export class NavigationTool implements OrbiTool {
  name = 'navigateTo';
  description = 'Navegar al usuario a un módulo o sección específica del panel administrativo. Usalo cuando el usuario pregunte dónde encontrar algo o necesite ir a otro módulo.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      module: {
        type: 'string',
        description: 'Módulo destino: dashboard, pedidos, catalogo, clientes, mensajes, descuentos, configuracion, perfil',
      },
      section: {
        type: 'string',
        description: 'Sección dentro del módulo (opcional). Ej: para configuracion puede ser "envios", "pagos", "apariencia"',
      },
    },
    required: ['module'],
  };

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const module = args.module as string;
    const section = args.section as string | undefined;
    const path = section ? `/admin/ventas/${module}/${section}` : `/admin/ventas/${module}`;

    return {
      success: true,
      label: `Navegando a ${module}${section ? ' → ' + section : ''}`,
      data: { path, module, section },
    };
  }
}
