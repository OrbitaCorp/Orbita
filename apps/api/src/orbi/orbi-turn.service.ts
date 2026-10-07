import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CaracteresDelContexto } from './turno/ficha-del-turno';
import type { PasoDelTurno } from './turno/motor-de-turno';

/**
 * Cómo terminó el turno. `max_rounds`: se cortó por el tope de vueltas de tools.
 * `quota`: no llegó a empezar, lo rechazó el tope diario del negocio
 * (`errorCategory: 'tope_diario'`; las filas viejas tienen null) o el cupo
 * mensual (`errorCategory: 'cupo_mensual'`).
 */
export type EstadoDelTurno = 'ok' | 'error' | 'cancelled' | 'max_rounds' | 'quota';

export interface TurnoDeOrbi {
  /** Lo genera el controller al empezar el mensaje: las acciones que proponga el turno lo guardan. */
  id: string;
  businessId: string;
  memberId: string;
  conversationId: string | null;
  module?: string;
  /** ID de modelo que informó el adapter en la última llamada. */
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  /** Llamadas al modelo del turno (cada tool es otra vuelta). */
  rounds: number;
  /** Nombres de las tools que pidió el modelo, en orden. */
  toolsUsed: string[];
  actionsProposed: number;
  /** Escrituras que el modelo pidió y no se pudieron proponer (permiso, demo, args). */
  writesRejected: number;
  status: EstadoDelTurno;
  provider?: 'gemini' | 'groq' | 'mixto';
  cachedTokens?: number;
  thinkingTokens?: number;
  /** Ms hasta el primer texto del modelo. */
  ttftMs?: number;
  // Los calcula el costeo (otra tarea); acá solo se guardan si llegan.
  costUsd?: number;
  toolsCostUsd?: number;
  credits?: number;
  errorCategory?: string;
  /** Pantalla del panel desde la que se escribió. */
  section?: string;
  contextChars?: CaracteresDelContexto;
  steps?: PasoDelTurno[];
  /** Contestó con la frase fija de fuera de alcance (prompts/alcance.ts). */
  outOfScope?: boolean;
}

/**
 * Telemetría de los turnos del Orbi del panel (spec §3.6): una fila en
 * `orbi_turns` por mensaje, para medir latencia, vueltas, tools y cuántos
 * turnos se cortan o se quedan sin vueltas.
 *
 * Sin texto a propósito: la pregunta y la respuesta ya están en la
 * conversación (que se borra con el negocio), y duplicarlas acá sería otra
 * copia de datos personales para cuidar.
 *
 * Best-effort: el controller la llama sin esperarla en el `finally` del chat.
 * Nunca lanza (sería una promesa rechazada sin manejar) y si la base falla solo
 * se loguea el tipo de error: el mensaje de Prisma puede traer valores.
 */
@Injectable()
export class OrbiTurnService {
  private readonly logger = new Logger(OrbiTurnService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(t: TurnoDeOrbi): Promise<void> {
    try {
      await this.prisma.orbiTurn.create({
        data: {
          id: t.id,
          businessId: t.businessId,
          memberId: t.memberId,
          conversationId: t.conversationId,
          // null y no 0 cuando no hay dato: un 0 se promedia como si el turno
          // hubiera sido gratis (mismo criterio que WizardAiTurn).
          module: t.module ?? null,
          model: t.model ?? null,
          promptTokens: t.promptTokens ?? null,
          completionTokens: t.completionTokens ?? null,
          latencyMs: t.latencyMs,
          rounds: t.rounds,
          toolsUsed: t.toolsUsed,
          actionsProposed: t.actionsProposed,
          writesRejected: t.writesRejected,
          status: t.status,
          provider: t.provider ?? null,
          cachedTokens: t.cachedTokens ?? null,
          thinkingTokens: t.thinkingTokens ?? null,
          ttftMs: t.ttftMs ?? null,
          costUsd: t.costUsd ?? null,
          toolsCostUsd: t.toolsCostUsd ?? null,
          credits: t.credits ?? null,
          errorCategory: t.errorCategory ?? null,
          section: t.section ?? null,
          contextChars: t.contextChars ? (t.contextChars as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          steps: t.steps ? (t.steps as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          outOfScope: t.outOfScope ?? false,
        },
      });
    } catch (e) {
      this.logger.warn(`No se pudo registrar el turno de Orbi: ${(e as Error)?.name ?? 'error'}`);
    }
  }

  /**
   * El dueño confirmó o canceló una acción que propuso este turno. Best-effort: nunca lanza.
   *
   * `confirmada` cuenta que la persona apretó Confirmar, no que la acción haya
   * salido bien: la ejecución puede fallar igual. Cómo terminó cada una está en
   * `orbi_pending_actions.status` (executed o failed).
   */
  async contarDesenlace(turnId: string, desenlace: 'confirmada' | 'rechazada'): Promise<void> {
    try {
      await this.prisma.orbiTurn.updateMany({
        where: { id: turnId },
        data: desenlace === 'confirmada' ? { actionsConfirmed: { increment: 1 } } : { actionsRejected: { increment: 1 } },
      });
    } catch (e) {
      this.logger.warn(`No se pudo contar el desenlace de una acción de Orbi: ${(e as Error)?.name ?? 'error'}`);
    }
  }
}
