import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { Db } from './contexto.service';

/**
 * Corre `fn` en la transacción que pasó quien llama (la de la reserva) o, si
 * no pasó ninguna, en una propia. Así las operaciones que se enchufan en la
 * reserva valen igual sueltas y adentro del `$transaction` de P1.
 */
export function enTransaccion<T>(prisma: PrismaService, tx: Db | undefined, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (tx && tx !== prisma) return fn(tx as Prisma.TransactionClient);
  return prisma.$transaction((t) => fn(t));
}

/**
 * Lock de Postgres hasta el fin de la transacción, por clave. Serializa dos
 * reservas que quieren usar el mismo pack, la misma membresía o la misma
 * tarjeta de sellos al mismo tiempo (mismo mecanismo que § 1.1 a).
 */
export async function bloquear(tx: Prisma.TransactionClient, clave: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${clave}))`;
}
