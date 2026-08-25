import type { LlmToolDefinition } from '../llm/llm-adapter.interface';
import type { OrbiSurface } from '../dto/orbi-chat.dto';

export interface ToolExecutionContext {
  businessId: string;
  userId: string;
  surface: OrbiSurface;
  permissions: string[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  label: string;
}

export interface OrbiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  surfaces: OrbiSurface[];
  requiredPermissions: string[];
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult>;
  toLlmDefinition(): LlmToolDefinition;
}
