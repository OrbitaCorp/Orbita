import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { isUUID } from 'class-validator';
import type { OrbiPendingAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ToolResult } from './tool.interface';
import { codigoDeCupon } from './acciones/nota-conversacion';

/**
 * Acciones que Orbi propuso y todavía no ejecutó (spec §3.4).
 *
 * Las herramientas que ESCRIBEN en la base no se ejecutan solas: se proponen,
 * la persona ve una tarjeta con lo que va a pasar, y recién cuando hace clic
 * ocurre. Es lo que contiene el daño de una inyección indirecta (RBT-695): un
 * texto malicioso en el nombre de un cliente puede convencer al modelo de
 * PEDIR un cupón del 100%, pero no puede hacer clic por el dueño.
 *
 * La propuesta vive acá y no viaja al navegador: el endpoint de confirmación
 * recibe solo el id. Si aceptara la herramienta y los argumentos desde el
 * cliente, quien quisiera escribir se saltearía a Orbi y postearía la acción.
 *
 * Antes estaba en memoria: un reinicio o una segunda instancia de Cloud Run
 * perdía las propuestas, y confirmar dos veces (doble clic, un reintento de
 * red) no tenía cómo devolver el mismo resultado. En Postgres, el consumo es un
 * UPDATE condicional (pending → executing) que solo gana un request, y el
 * resultado queda guardado para responder igual al segundo.
 */

/** Una fila de orbi_pending_actions. */
export type FilaPendiente = OrbiPendingAction;

const TTL_MS = 10 * 60 * 1000;
// Una acción que lleva más de esto en `executing` se da por trabada (el
// proceso murió a mitad de camino). No se sabe si la escritura llegó a la
// base, así que NUNCA se vuelve a ejecutar sola: se le dice a la persona que
// lo revise.
const APLICANDO_MAX_MS = 2 * 60 * 1000;

export type Consumo =
  | { tipo: 'ejecutar'; accion: FilaPendiente }
  | { tipo: 'resuelta'; result: ToolResult }
  | { tipo: 'aplicando' }
  // `tool` para decirle a la persona en qué pantalla revisarlo.
  | { tipo: 'desconocido'; tool: string }
  | { tipo: 'no_disponible' };

export type Rechazo =
  | { tipo: 'ok'; accion: FilaPendiente }
  | { tipo: 'ya_rechazada' }
  | { tipo: 'ya_aplicada'; result: ToolResult }
  | { tipo: 'no_disponible' };

@Injectable()
export class PendingActionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `conversationId` solo si es la conversación del turno, verificada o creada
   * en este turno por el controller; si no, null. La nota de confirmar o cancelar se escribe ahí, y
   * un id sin verificar sería una forma de escribir en la conversación de otro.
   */
  async crear(a: {
    tool: string;
    args: Record<string, unknown>;
    businessId: string;
    memberId: string;
    conversationId: string | null;
    /** El turno del chat que la propuso: ahí se cuenta si se confirmó o se canceló. */
    turnId: string | null;
    resumen: string;
  }): Promise<string> {
    const id = randomBytes(16).toString('hex');
    await this.prisma.orbiPendingAction.create({
      data: {
        id,
        businessId: a.businessId,
        memberId: a.memberId,
        conversationId: a.conversationId,
        turnId: a.turnId,
        tool: a.tool,
        args: a.args as Prisma.InputJsonValue,
        summary: a.resumen,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
    return id;
  }

  /**
   * Toma la acción para ejecutarla, o explica por qué no.
   *
   * El paso a `executing` es UN solo UPDATE con negocio, persona, estado y
   * vencimiento en el where: de dos confirmar simultáneos gana uno solo, y un
   * intento desde otro negocio u otra persona no toca la fila (antes, en
   * memoria, ese intento "quemaba" la acción de su dueño).
   *
   * La fila se lee ANTES de reclamarla, no después: si la lectura posterior
   * fallaba (un error transitorio de la base), la acción quedaba en
   * `executing` sin haberse ejecutado y a los 2 minutos pasaba a "no sé si se
   * aplicó" para siempre. Leerla antes es seguro porque lo que se ejecuta
   * (tool y args) no cambia nunca, y el claim sigue siendo el UPDATE
   * condicional de siempre: la lectura previa no decide quién gana.
   */
  async consumir(id: string, businessId: string, memberId: string): Promise<Consumo> {
    // Con un JWT sin memberId, Prisma sacaría ese filtro del where (undefined
    // no filtra) y cualquiera del negocio podría consumir la acción de otro.
    if (!businessId || !memberId) return { tipo: 'no_disponible' };

    const previa = await this.prisma.orbiPendingAction.findFirst({ where: { id, businessId, memberId } });
    if (!previa) return { tipo: 'no_disponible' };
    if (previa.status !== 'pending') return this.explicar(previa);

    const ahora = new Date();
    const { count } = await this.prisma.orbiPendingAction.updateMany({
      where: { id, businessId, memberId, status: 'pending', expiresAt: { gt: ahora } },
      data: { status: 'executing', startedAt: ahora },
    });
    // Después de ganar el claim no hay ninguna otra operación que pueda
    // fallar antes de ejecutar.
    if (count === 1) return { tipo: 'ejecutar', accion: { ...previa, status: 'executing', startedAt: ahora } };

    // No se pudo tomar: la ganó otro request en el medio, o estaba vencida.
    // Se relee para contestar según cómo quedó. Si esta lectura falla, la
    // fila no es de este request, así que no queda nada trabado por eso.
    const actual = await this.prisma.orbiPendingAction.findFirst({ where: { id, businessId, memberId } });
    return actual ? this.explicar(actual) : { tipo: 'no_disponible' };
  }

  /** Por qué una acción que no se pudo tomar no se ejecuta. */
  private explicar(fila: FilaPendiente): Consumo {
    switch (fila.status) {
      case 'executed':
      case 'failed':
        // Idempotente: el segundo clic recibe lo mismo que el primero.
        return { tipo: 'resuelta', result: fila.result as unknown as ToolResult };
      case 'executing': {
        const desde = fila.startedAt?.getTime() ?? 0;
        return Date.now() - desde < APLICANDO_MAX_MS
          ? { tipo: 'aplicando' }
          : { tipo: 'desconocido', tool: fila.tool };
      }
      default:
        // rejected, o pending pero vencida.
        return { tipo: 'no_disponible' };
    }
  }

  /**
   * Estado final con su resultado. Solo desde `executing`: una acción ya
   * resuelta no se reescribe. Con el negocio en el where aunque el id ya haya
   * salido de un consumir() acotado: ninguna escritura sobre esta tabla
   * depende solo de que el id sea difícil de adivinar.
   */
  async resolver(id: string, businessId: string, estado: 'executed' | 'failed', result: ToolResult): Promise<void> {
    await this.prisma.orbiPendingAction.updateMany({
      where: { id, businessId, status: 'executing' },
      data: { status: estado, result: result as unknown as Prisma.InputJsonValue, resolvedAt: new Date() },
    });
  }

  /**
   * Cancelar desde la tarjeta. No pide permisos (cancelar nunca puede estar
   * prohibido), pero sí negocio y persona en el where, igual que consumir.
   */
  async rechazar(id: string, businessId: string, memberId: string): Promise<Rechazo> {
    if (!businessId || !memberId) return { tipo: 'no_disponible' };

    const ahora = new Date();
    const { count } = await this.prisma.orbiPendingAction.updateMany({
      where: { id, businessId, memberId, status: 'pending', expiresAt: { gt: ahora } },
      data: { status: 'rejected', resolvedAt: ahora },
    });

    const fila = await this.prisma.orbiPendingAction.findFirst({ where: { id, businessId, memberId } });
    if (!fila) return { tipo: 'no_disponible' };
    if (count === 1) return { tipo: 'ok', accion: fila };

    switch (fila.status) {
      case 'rejected':
        return { tipo: 'ya_rechazada' };
      case 'executed':
      case 'failed':
        return { tipo: 'ya_aplicada', result: fila.result as unknown as ToolResult };
      default:
        // Vencida, o aplicándose en este momento: ya no hay nada que cancelar.
        return { tipo: 'no_disponible' };
    }
  }

  /**
   * Los ids que puede nombrar la nota de la conversación, validados: el número
   * de pedido sale de la base (acotado al negocio), no del resumen; el código
   * del cupón, solo si tiene el formato del DTO.
   */
  async idsParaNota(accion: FilaPendiente): Promise<{ pedido?: number; codigo?: string }> {
    const args = (accion.args ?? {}) as Record<string, unknown>;

    if (accion.tool === 'updateOrderStatus' && isUUID(args.orderId)) {
      const pedido = await this.prisma.order.findFirst({
        where: { id: args.orderId as string, businessId: accion.businessId },
        select: { orderNumber: true },
      });
      return pedido ? { pedido: pedido.orderNumber } : {};
    }

    const codigo = accion.tool === 'createCoupon' ? codigoDeCupon(args.code) : undefined;
    return codigo ? { codigo } : {};
  }
}
