import { Injectable, Logger } from '@nestjs/common';
import type { OrbiTool, ToolExecutionContext, ToolResult } from './tool.interface';
import type { OrbiSurface } from '../dto/orbi-chat.dto';
import type { LlmToolDefinition } from '../llm/llm-adapter.interface';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, OrbiTool>();

  register(tool: OrbiTool) {
    this.tools.set(tool.name, tool);
    this.logger.log(`Registered tool: ${tool.name}`);
  }

  getTools(surface: OrbiSurface, permissions: string[], stepName?: string): LlmToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.surfaces.includes(surface))
      .filter(t => !t.steps || (stepName !== undefined && t.steps.includes(stepName)))
      .filter(t =>
        t.requiredPermissions.length === 0 ||
        t.requiredPermissions.every(p => permissions.includes(p)),
      )
      .map(t => t.toLlmDefinition());
  }

  /**
   * ¿Esta llamada hay que proponerla en vez de ejecutarla?
   *
   * Devuelve el resumen para el botón, o null si la tool se puede correr
   * directo (lecturas, o cualquier cosa que no pase las validaciones — en ese
   * caso execute() la va a rechazar igual, con su mensaje de error, y no tiene
   * sentido pedirle a nadie que confirme algo que va a fallar).
   */
  proponer(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
    stepName?: string,
  ): { resumen: string } | null {
    const tool = this.tools.get(name);
    if (!tool?.requiresConfirmation) return null;

    // Mismas puertas que execute(): no tiene sentido proponerle a alguien una
    // acción que no tendría permiso de ejecutar. Y así el mensaje de error que
    // recibe el modelo es el mismo por los dos caminos.
    if (!tool.surfaces.includes(ctx.surface)) return null;
    if (tool.steps && (stepName === undefined || !tool.steps.includes(stepName))) return null;
    if (tool.requiredPermissions.some(p => !ctx.permissions.includes(p))) return null;

    return {
      resumen: tool.describirAccion?.(args) ?? `Ejecutar: ${tool.name}`,
    };
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
    stepName?: string,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { success: false, error: `Tool "${name}" no existe`, label: name };

    if (!tool.surfaces.includes(ctx.surface)) {
      return { success: false, error: `"${name}" no disponible en ${ctx.surface}`, label: name };
    }

    if (tool.steps && (stepName === undefined || !tool.steps.includes(stepName))) {
      return { success: false, error: `"${name}" no disponible en este paso`, label: name };
    }

    if (tool.requiredPermissions.length > 0) {
      const missing = tool.requiredPermissions.filter(p => !ctx.permissions.includes(p));
      if (missing.length > 0) {
        return { success: false, error: `Permisos insuficientes: ${missing.join(', ')}`, label: name };
      }
    }

    return tool.execute(args, ctx);
  }
}
