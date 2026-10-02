import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import type { LlmAdapter, LlmMessage, LlmToolCall, LlmToolDefinition, LlmUsage } from '../llm/llm-adapter.interface';
import type { ToolRegistryService } from '../tools/tool-registry.service';
import type { ToolExecutionContext, ToolResult } from '../tools/tool.interface';
import { ESCRITURA_EN_DEMO, ESCRITURA_NO_DISPONIBLE, MAX_VUELTAS_TOOLS, MENSAJE_VUELTAS, RESPUESTA_DE_PROPUESTA, vueltaDeTools } from './vuelta';

// El loop de un turno del panel: vueltas al modelo, tools que se proponen o se
// ejecutan, y el corte por tope de vueltas. Lo corren OrbiController (con un
// emisor que escribe SSE) y las evals del panel (con uno que anota lo que se
// juzga): un solo loop, así la eval mide lo que corre en producción.

const logger = new Logger('OrbiMotorDeTurno');

/** Tokens de un turno, separados por quién respondió cada llamada. */
export type ConsumoPorProveedor = Map<LlmUsage['provider'], { model: string; promptTokens: number; completionTokens: number }>;

/**
 * Suma el `usage` de una llamada al proveedor que la contestó. El fallback se
 * decide por llamada, así que un turno puede tener vueltas de Gemini y de Groq
 * (spec §3.6). El modelo que queda es el de la última llamada de ese proveedor.
 */
export function sumarConsumo(consumo: ConsumoPorProveedor, u: LlmUsage): void {
  const previo = consumo.get(u.provider);
  consumo.set(u.provider, {
    model: u.model,
    promptTokens: (previo?.promptTokens ?? 0) + u.promptTokens,
    completionTokens: (previo?.completionTokens ?? 0) + u.completionTokens,
  });
}

/** Lo que el loop cuenta mientras corre. Es del que llama: si el turno tira (error o corte), lo avanzado queda acá para la telemetría. */
export interface ProgresoDelTurno {
  /** La respuesta que ve la persona (la que se guarda en la conversación). */
  texto: string;
  estado: 'ok' | 'max_rounds';
  llamadasAlModelo: number;
  toolsPedidas: string[];
  propuestas: number;
  consumo: ConsumoPorProveedor;
  modeloReportado?: string;
}

export function nuevoProgresoDelTurno(): ProgresoDelTurno {
  return { texto: '', estado: 'ok', llamadasAlModelo: 0, toolsPedidas: [], propuestas: 0, consumo: new Map() };
}

/** Lo que el loop va contando hacia afuera, en el orden en que pasa. */
export interface EmisorDelTurno {
  /** El modelo pidió una tool (antes de decidir si se propone, se rechaza o se ejecuta). */
  toolPedida?(p: { call: LlmToolCall }): void;
  /** Texto que ve la persona, en vivo (sin tools) o de una al final de la vuelta (con tools). */
  texto(chunk: string): void;
  /** Sin tools: lo que ya se mostró de esta vuelta era un preámbulo y se borra. */
  reiniciarTexto(): void;
  /** Una escritura quedó propuesta: la tarjeta. */
  propuesta(p: { id: string; actionId: string; call: LlmToolCall; resumen: string }): void;
  /** Una lectura arranca y termina (siempre en ese orden y de a una). */
  lecturaInicio(p: { id: string; call: LlmToolCall }): void;
  lecturaFin(p: { id: string; call: LlmToolCall; resultado: ToolResult }): void;
  /** El modelo pidió una escritura que no se propuso (argumentos inválidos, sin permiso, demo). */
  escrituraRechazada?(p: { call: LlmToolCall }): void;
  /** El turno terminó con una respuesta (también al cortar por vueltas). */
  fin(): void;
}

export interface TurnoACorrer {
  llm: Pick<LlmAdapter, 'streamChat'>;
  registry: Pick<ToolRegistryService, 'proponer' | 'requiereConfirmacion' | 'execute'>;
  /** El historial que va al modelo. Se le suman las calls y resultados de cada vuelta. */
  messages: LlmMessage[];
  tools: LlmToolDefinition[];
  modelo?: string;
  toolCtx: ToolExecutionContext;
  stepName?: string;
  /** Demo pública: no se propone nada y las escrituras se rechazan. */
  soloLectura: boolean;
  /** El cliente se fue: se deja de gastar (antes de cada llamada, tool y propuesta). */
  signal?: AbortSignal;
  /** Guarda la acción pendiente de una propuesta y devuelve su id. */
  crearPendiente(p: { call: LlmToolCall; resumen: string }): Promise<string>;
  emisor: EmisorDelTurno;
  progreso: ProgresoDelTurno;
}

export async function correrTurno(t: TurnoACorrer): Promise<void> {
  const { emisor, progreso, signal, messages, tools } = t;

  // Con herramientas en juego el texto de la vuelta se BUFEREA en vez de
  // streamearse, para que el preámbulo que Gemini dice antes de llamar la tool
  // nunca llegue a la pantalla.
  const hayTools = tools.length > 0;

  let continueLoop = true;
  let vueltas = 0;
  while (continueLoop) {
    if (++vueltas > MAX_VUELTAS_TOOLS) {
      // Una respuesta que encadena más vueltas que el tope se corta con un
      // mensaje en vez de seguir llamando al modelo.
      logger.warn(`Orbi cortó una respuesta a las ${MAX_VUELTAS_TOOLS} vueltas de herramientas`);
      emisor.texto(MENSAJE_VUELTAS);
      emisor.fin();
      progreso.texto += MENSAJE_VUELTAS;
      progreso.estado = 'max_rounds';
      break;
    }
    // Cada vuelta es una llamada paga: si el cliente ya se fue, no se pide.
    signal?.throwIfAborted();
    progreso.llamadasAlModelo++;
    continueLoop = false;
    let textoVuelta = '';
    let resetEnviado = false;
    // Las calls de esta vuelta vuelven al historial juntas, al terminar el
    // stream (ver vueltaDeTools: tool calls paralelas de Gemini).
    const vuelta = vueltaDeTools();
    for await (const event of t.llm.streamChat({ messages, tools: hayTools ? tools : undefined, model: t.modelo, signal })) {
      if (event.type === 'text') {
        textoVuelta += event.chunk;
        if (!hayTools && !resetEnviado) emisor.texto(event.chunk);
      } else if (event.type === 'tool_call') {
        // Con el cliente ido, ni se propone ni se ejecuta nada.
        signal?.throwIfAborted();
        progreso.toolsPedidas.push(event.call.name);
        emisor.toolPedida?.({ call: event.call });
        // Si se bufereó, no hay nada que resetear: el preámbulo se descarta
        // acá sin que la persona lo haya visto nunca.
        if (hayTools) {
          textoVuelta = '';
        } else if (textoVuelta.trim() && !resetEnviado) {
          emisor.reiniciarTexto();
          resetEnviado = true;
        }
        // UUID y no `step-${Date.now()}`: dos pasos en el mismo milisegundo
        // repetían id y el front pisaba una tarjeta con la otra (spec §3.8).
        const stepId = randomUUID();

        // Las herramientas que ESCRIBEN no se ejecutan acá: se proponen. La
        // persona ve un botón con lo que va a pasar y la escritura ocurre
        // recién si hace clic (POST /orbi/confirm).
        //
        // Es la defensa contra la inyección indirecta de RBT-695: el texto que
        // escribe un cliente de la tienda vuelve al contexto del modelo como
        // resultado de listOrders o getOrderDetail, y puede convencerlo de
        // PEDIR un cupón del 100% — pero no puede hacer clic por el dueño.
        //
        // En la demo no se propone nada (soloLectura): el visitante tiene rol
        // owner, así que los permisos no lo frenan.
        const propuesta = await t.registry.proponer(event.call.name, event.call.arguments, t.toolCtx, t.stepName, { soloLectura: t.soloLectura });

        // Los argumentos no pasan la validación (o el pedido no existe): no
        // hay tarjeta ni acción pendiente. El modelo recibe el motivo como
        // resultado fallido de la tool, para corregir o contarle qué faltó.
        if (propuesta && 'error' in propuesta) {
          emisor.escrituraRechazada?.({ call: event.call });
          vuelta.responder(event.call, JSON.stringify({ success: false, error: propuesta.error }));
          continueLoop = true;
          continue;
        }

        // Una escritura que no se pudo proponer (demo, sin permiso, otra
        // surface) NO se ejecuta directo: solo /orbi/confirm escribe.
        if (!propuesta && t.registry.requiereConfirmacion(event.call.name)) {
          emisor.escrituraRechazada?.({ call: event.call });
          vuelta.responder(event.call, JSON.stringify({ success: false, error: t.soloLectura ? ESCRITURA_EN_DEMO : ESCRITURA_NO_DISPONIBLE }));
          continueLoop = true;
          continue;
        }

        if (propuesta) {
          // proponer() es async (lee la base para armar la tarjeta): el
          // cliente pudo irse mientras. Una propuesta que nadie va a ver
          // quedaría pendiente hasta vencer.
          signal?.throwIfAborted();
          const actionId = await t.crearPendiente({ call: event.call, resumen: propuesta.resumen });
          progreso.propuestas++;
          emisor.propuesta({ id: stepId, actionId, call: event.call, resumen: propuesta.resumen });
          // Que diga PENDIENTE y no que falló (reintentaría) ni que salió bien
          // (le contaría a la persona que ya está hecho).
          vuelta.responder(event.call, JSON.stringify(RESPUESTA_DE_PROPUESTA));
          continueLoop = true;
          continue;
        }

        // Mismo motivo que antes de crear la pendiente: proponer() fue async.
        signal?.throwIfAborted();
        emisor.lecturaInicio({ id: stepId, call: event.call });
        // Acá solo llegan lecturas. soloLectura igual, como segunda barrera de
        // la demo (ver ToolRegistryService#execute).
        const resultado = await t.registry.execute(event.call.name, event.call.arguments, t.toolCtx, t.stepName, { soloLectura: t.soloLectura });
        emisor.lecturaFin({ id: stepId, call: event.call, resultado });
        vuelta.responder(event.call, JSON.stringify(resultado));
        continueLoop = true;
      } else if (event.type === 'usage') {
        // Se suma aunque el cliente ya se haya ido: la llamada se factura.
        sumarConsumo(progreso.consumo, event.usage);
        progreso.modeloReportado = event.usage.model;
      } else if (event.type === 'done') {
        if (!continueLoop) {
          // Vuelta final: si se bufereó, recién acá sale el texto — de una, y
          // solo el de la respuesta de verdad.
          if (hayTools && textoVuelta) emisor.texto(textoVuelta);
          progreso.texto += textoVuelta;
          emisor.fin();
        }
      }
    }
    // Terminó el stream de la vuelta: recién ahora sus calls y resultados
    // entran al historial, todos en un solo turno del modelo.
    vuelta.volcarEn(messages);
  }
}
