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

  getTools(surface: OrbiSurface, permissions: string[]): LlmToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.surfaces.includes(surface))
      .filter(t =>
        t.requiredPermissions.length === 0 ||
        t.requiredPermissions.every(p => permissions.includes(p)),
      )
      .map(t => t.toLlmDefinition());
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { success: false, error: `Tool "${name}" no existe`, label: name };

    if (!tool.surfaces.includes(ctx.surface)) {
      return { success: false, error: `"${name}" no disponible en ${ctx.surface}`, label: name };
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
