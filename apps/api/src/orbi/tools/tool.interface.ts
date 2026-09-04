import type { LlmToolDefinition } from '../llm/llm-adapter.interface';
import type { OrbiSurface } from '../dto/orbi-chat.dto';

export interface ToolExecutionContext {
  businessId: string;
  userId: string;
  surface: OrbiSurface;
  permissions: string[];
  /**
   * Las opciones reales del paso actual del wizard. Van acá para que
   * selectWizardOption pueda RECHAZAR un key que no exista, en vez de confiar
   * en que el modelo no invente uno.
   *
   * Es la diferencia entre pedirle al prompt que acierte y hacer que fallar
   * sea imposible: un key inventado llegaba hasta el front como un botón que
   * no hacía nada, y el usuario no tenía forma de saber por qué.
   */
  availableOptions?: { key: string; label: string; description?: string }[];
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
  /**
   * Restringe la tool a determinados pasos del wizard (stepName de
   * OrbiContextDto). Si no se define, está disponible en todos los pasos de
   * las surfaces donde aplica. Evita que el LLM llame una tool fuera de
   * contexto (ej. sugerir nombre de negocio en la pantalla de elegir rubro)
   * confiando solo en la instrucción del prompt — el modelo del wizard es
   * chico y no siempre la respeta si la tool sigue disponible.
   */
  steps?: string[];
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult>;
  toLlmDefinition(): LlmToolDefinition;
}
