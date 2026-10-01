import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import {
  SECCIONES_DEL_PANEL,
  VISTAS_DE_CONFIGURACION,
  type SeccionDelPanel,
} from '../../navegacion/secciones';
import { rutaDelPanel } from '../../navegacion/ruta';

// Qué es cada sección, para que el modelo elija bien. Tipado con la lista
// completa: si se agrega una sección al panel y acá falta, no compila.
const QUE_ES: Record<SeccionDelPanel, string> = {
  dashboard: 'resumen del negocio',
  pedidos: 'pedidos',
  catalogo: 'productos',
  categorias: 'categorías de productos',
  clientes: 'clientes',
  reportes: 'reportes de ventas',
  configuracion: 'ajustes del negocio (ver vista)',
  descuentos: 'descuentos',
  cupones: 'cupones',
  mensajes: 'mensajes de clientes',
  perfil: 'perfil de la persona',
  avanzado: 'opciones avanzadas',
  manual: 'manual de uso',
};

const SECCIONES_TXT = SECCIONES_DEL_PANEL.map(s => `${s} (${QUE_ES[s]})`).join(', ');

/**
 * Lleva a la persona a una pantalla del panel.
 *
 * El panel resuelve /admin/ventas/<seccion> tomando los DOS ÚLTIMOS segmentos
 * como módulo y sección (AdminSeccionShell), y las subsecciones de
 * Configuración van por ?vista=. Antes esta tool armaba
 * /admin/ventas/<modulo>/<seccion> y un link a configuracion + envios terminaba
 * en "Página no encontrada". Por eso acá solo se arman links de la lista real
 * (SECCIONES_DEL_PANEL, espejo del front) y lo demás se rechaza con un error
 * que le dice al modelo qué opciones hay.
 *
 * `vista` con una sección que no es configuracion se RECHAZA (no se ignora):
 * ignorarla llevaría a la persona a una pantalla distinta de la que pidió sin
 * avisarle.
 */
export class NavigationTool implements OrbiTool {
  name = 'navigateTo';
  description =
    'Navegar al usuario a una sección del panel administrativo. Usalo cuando el usuario pregunte dónde encontrar algo o necesite ir a otra pantalla. ' +
    `Secciones: ${SECCIONES_TXT}. ` +
    `Solo para configuracion, el parámetro vista elige la subsección: ${VISTAS_DE_CONFIGURACION.join(', ')} (sin vista abre "negocio").`;
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      seccion: {
        type: 'string',
        enum: [...SECCIONES_DEL_PANEL],
        description: 'Sección destino del panel',
      },
      vista: {
        type: 'string',
        enum: [...VISTAS_DE_CONFIGURACION],
        description: 'Subsección de Configuración (opcional, solo con seccion "configuracion"). Ej: envios, pagos, apariencia',
      },
    },
    required: ['seccion'],
  };

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { seccion, vista } = args;
    const label = 'Navegación';

    // El enum del schema no se hace cumplir solo: el modelo puede mandar
    // cualquier cosa, incluidos tipos raros o caracteres de ruta.
    if (typeof seccion !== 'string' || !(SECCIONES_DEL_PANEL as readonly string[]).includes(seccion)) {
      return {
        success: false,
        error: `La sección ${JSON.stringify(seccion)} no existe en el panel. Secciones válidas: ${SECCIONES_DEL_PANEL.join(', ')}.`,
        label,
      };
    }

    if (vista !== undefined && vista !== null) {
      if (seccion !== 'configuracion') {
        return {
          success: false,
          error: `vista solo se usa con la sección configuracion, no con ${seccion}. Llamá de nuevo sin vista.`,
          label,
        };
      }
      if (typeof vista !== 'string' || !(VISTAS_DE_CONFIGURACION as readonly string[]).includes(vista)) {
        return {
          success: false,
          error: `La vista ${JSON.stringify(vista)} no existe en configuracion. Vistas válidas: ${VISTAS_DE_CONFIGURACION.join(', ')}.`,
          label,
        };
      }
      return {
        success: true,
        label: `Navegando a ${seccion} → ${vista}`,
        data: { path: rutaDelPanel(seccion, vista), seccion, vista },
      };
    }

    return {
      success: true,
      label: `Navegando a ${seccion}`,
      data: { path: rutaDelPanel(seccion), seccion },
    };
  }
}
