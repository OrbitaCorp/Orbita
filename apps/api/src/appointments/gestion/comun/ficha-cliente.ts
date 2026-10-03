// La ficha del cliente (`customers`) desde Turnos: buscarla o crearla con la
// regla del CONTRATO § 0 "Cliente". La usan las inscripciones a clases (P3.1)
// y el alta de clientes del panel (P3.2).
import type { Customer, Prisma } from '@prisma/client';

/** "Ana María Paz" → firstName "Ana", lastName "María Paz". */
export function partirNombre(nombre: string): { firstName: string; lastName: string | null } {
  const partes = nombre.trim().split(/\s+/);
  return { firstName: partes[0] ?? '', lastName: partes.length > 1 ? partes.slice(1).join(' ') : null };
}

export const nombreDe = (c: { firstName: string; lastName: string | null }): string => [c.firstName, c.lastName].filter(Boolean).join(' ');

/**
 * Busca la ficha por (businessId, phone) sin borrar; si no, por (businessId,
 * email) cuando hay email; si no existe, la crea sin contraseña. El email se
 * guarda solo si ningún otro cliente del negocio lo tiene (la unique
 * (businessId, email) incluye a los borrados).
 */
export async function buscarOCrearCliente(
  tx: Prisma.TransactionClient,
  businessId: string,
  datos: { name: string; phone: string; email?: string | null },
): Promise<Customer> {
  if (datos.phone) {
    const porTelefono = await tx.customer.findFirst({ where: { businessId, phone: datos.phone, deletedAt: null }, orderBy: { createdAt: 'asc' } });
    if (porTelefono) return porTelefono;
  }
  if (datos.email) {
    const porEmail = await tx.customer.findFirst({ where: { businessId, email: datos.email } });
    if (porEmail && !porEmail.deletedAt) return porEmail;
    if (porEmail) return tx.customer.create({ data: { businessId, ...partirNombre(datos.name), phone: datos.phone || null } });
  }
  return tx.customer.create({ data: { businessId, ...partirNombre(datos.name), phone: datos.phone || null, email: datos.email || null } });
}
