import { Injectable, Logger } from '@nestjs/common';
import type { OrbiTool, ToolExecutionContext, ToolResult } from './tool.interface';
import type { OrbiSurface } from '../dto/orbi-chat.dto';
import type { LlmToolDefinition } from '../llm/llm-adapter.interface';
import { AccionInvalida } from './acciones/validar-args';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, OrbiTool>();

  register(tool: OrbiTool) {
    this.tools.set(tool.name, tool);
    this.logger.log(`Registered tool: ${tool.name}`);
  }

  // `soloLectura`: el visitante de la demo pública — no ve las tools que
  // escriben (tampoco podría confirmarlas: DemoGuard corta /orbi/confirm).
  getTools(surface: OrbiSurface, permissions: string[], stepName?: string, opciones?: { soloLectura?: boolean }): LlmToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.surfaces.includes(surface))
      .filter(t => !(opciones?.soloLectura && t.requiresConfirmation))
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
   * - `null`: no se propone. Lecturas (se corren directo), o una escritura que
   *   no pasa las puertas (surface, paso, permisos, demo): no tiene sentido
   *   pedirle a nadie que confirme algo que va a fallar. El chat distingue los
   *   dos casos con requiereConfirmacion() y a la escritura NO la ejecuta: le
   *   devuelve el fallo al modelo.
   * - `{ error }`: los argumentos no pasan el DTO del endpoint, o un dato de
   *   la base no existe (el pedido, la categoría). No hay tarjeta: el
   *   controller le devuelve el motivo al modelo como resultado de la tool.
   * - `{ resumen }`: se propone, con la tarjeta que muestra cada valor.
   *
   * `soloLectura` es el visitante de la demo pública: tiene rol owner, así que
   * los permisos no lo frenan. Antes solo getTools() lo respetaba, y si el
   * modelo llamaba igual una escritura se armaba una tarjeta que después daba
   * 403 en /orbi/confirm.
   */
  async proponer(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
    stepName?: string,
    opciones?: { soloLectura?: boolean },
  ): Promise<{ resumen: string } | { error: string } | null> {
    const tool = this.tools.get(name);
    if (!tool?.requiresConfirmation) return null;
    if (opciones?.soloLectura) return null;

    // Mismas puertas que execute(): no tiene sentido proponerle a alguien una
    // acción que no tendría permiso de ejecutar. Y así el mensaje de error que
    // recibe el modelo es el mismo por los dos caminos.
    if (!tool.surfaces.includes(ctx.surface)) return null;
    if (tool.steps && (stepName === undefined || !tool.steps.includes(stepName))) return null;
    if (tool.requiredPermissions.some(p => !ctx.permissions.includes(p))) return null;

    // Un argumento que la tool no declara no se escribe, pero tampoco se ve en
    // la tarjeta: mejor que el modelo se entere de que lo inventó (mismo
    // criterio que forbidNonWhitelisted en validarConDto).
    const declarados = Object.keys((tool.parameters as { properties?: Record<string, unknown> }).properties ?? {});
    const desconocido = Object.keys(args).find(k => !declarados.includes(k));
    if (desconocido !== undefined) {
      return { error: `Argumento inválido: "${name}" no acepta el parámetro ${desconocido}` };
    }

    try {
      if (tool.validarArgs) {
        const validacion = await tool.validarArgs(args, ctx);
        if (!validacion.ok) return { error: validacion.error };
      }
      const resumen = tool.describirAccion ? await tool.describirAccion(args, ctx) : `Ejecutar: ${tool.name}`;
      return { resumen };
    } catch (e) {
      if (e instanceof AccionInvalida) return { error: e.message };
      // Un error inesperado (la base no respondió) no puede tumbar el chat
      // entero. Se loguea sin argumentos ni mensaje: pueden traer datos de
      // clientes.
      this.logger.warn(`No se pudo armar la propuesta de ${name}: ${(e as Error)?.name ?? 'error'}`);
      return { error: 'No pude preparar esa acción. Probá de nuevo en un rato.' };
    }
  }

  /**
   * ¿La tool escribe? El chat lo pregunta cuando proponer() devuelve null:
   * una escritura que no pasó las puertas (demo, permiso, surface) NO se
   * ejecuta directo, el modelo recibe el fallo. Así la garantía de que nada se
   * escribe sin clic no depende de que execute() repita cada puerta.
   */
  requiereConfirmacion(name: string): boolean {
    return this.tools.get(name)?.requiresConfirmation === true;
  }

  /**
   * ¿La tarjeta que la persona aprobó sigue describiendo lo que va a pasar?
   *
   * El resumen se arma al proponer, con la base de ESE momento: la tarjeta del
   * pedido dice "se descuenta el stock" o "le llega un mail" según el estado
   * que tenía. Si entre la propuesta y el clic el pedido cambió, confirmar
   * haría algo distinto de lo que se vio. Se recalcula con los mismos
   * argumentos y el mismo negocio (ctx.businessId) y se compara.
   *
   * - Sin describirAccion no hay nada que recalcular: true.
   * - AccionInvalida (el pedido ya no existe): false.
   * - Cualquier otro error se propaga: el confirm lo resuelve como interno.
   */
  async sigueVigente(name: string, args: Record<string, unknown>, ctx: ToolExecutionContext, resumenGuardado: string): Promise<boolean> {
    const tool = this.tools.get(name);
    if (!tool?.describirAccion) return true;
    try {
      return (await tool.describirAccion(args, ctx)) === resumenGuardado;
    } catch (e) {
      if (e instanceof AccionInvalida) return false;
      throw e;
    }
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
    stepName?: string,
    opciones?: { soloLectura?: boolean },
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { success: false, error: `Tool "${name}" no existe`, label: name };

    // Segunda barrera para la demo: el chat ya no ejecuta directo una
    // escritura que no se propuso (ver requiereConfirmacion), pero si eso se
    // rompiera, una escritura pedida en la demo se ESCRIBIRÍA sin tarjeta
    // (DemoGuard solo frena rutas HTTP, y las tools llaman a los services
    // directo).
    if (opciones?.soloLectura && tool.requiresConfirmation) {
      return { success: false, error: 'En la demo no se pueden hacer cambios', label: name };
    }

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
