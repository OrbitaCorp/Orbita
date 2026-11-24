import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** La fila del recurso como queda tomada: el cupo y si está activo, leídos con el candado puesto. */
export interface FilaRecurso { id: string; cupo: number; activo: boolean; nombre: string }

/**
 * El candado del motor: SELECT … FOR UPDATE sobre la fila del recurso. Todo lo
 * que cuenta lugares o cambia qué se puede reservar lo toma primero (crear,
 * mover, cancelar con su promoción, darle el lugar a quien espera, anotar en
 * la espera, y editar o borrar el recurso), así entra de a uno hasta que la
 * transacción termina. Devuelve la fila fresca: el cupo que hay que usar para
 * contar es este, no el que se leyó antes de tomarlo.
 */
export async function tomarRecurso(tx: Prisma.TransactionClient, businessId: string, recursoId: string): Promise<FilaRecurso> {
  const filas = await tx.$queryRaw<FilaRecurso[]>`
    SELECT "id", "cupo", "activo", "nombre" FROM "reservas_recursos"
    WHERE "id" = ${recursoId} AND "business_id" = ${businessId} AND "eliminado_en" IS NULL
    FOR UPDATE`;
  if (filas.length === 0) throw new NotFoundException('Ese recurso no existe.');
  return filas[0];
}

/** Las opciones de toda transacción que toma el candado. */
export const TRANSACCION_CON_CANDADO = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 } as const;
