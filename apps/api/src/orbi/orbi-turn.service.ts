import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Cómo terminó el turno. `max_rounds`: se cortó por el tope de vueltas de tools. */
export type EstadoDelTurno = 'ok' | 'error' | 'cancelled' | 'max_rounds';

export interface TurnoDeOrbi {
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
  status: EstadoDelTurno;
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
          status: t.status,
        },
      });
    } catch (e) {
      this.logger.warn(`No se pudo registrar el turno de Orbi: ${(e as Error)?.name ?? 'error'}`);
    }
  }
}
