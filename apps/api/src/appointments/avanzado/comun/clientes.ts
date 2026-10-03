import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Db } from './contexto.service';
import { normalizarTelefonoBasico } from './telefono';

export interface ClienteNuevo {
  name: string;
  phone?: string;
  email?: string;
}

export interface ClienteResuelto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  /** Tiene cuenta en el sitio (contraseña o Google): es lo que pide la tarjeta de sellos. */
  hasAccount: boolean;
}

export const nombreDe = (c: { firstName: string; lastName: string | null }): string =>
  `${c.firstName} ${c.lastName ?? ''}`.trim();

const SELECT = { id: true, firstName: true, lastName: true, phone: true, email: true, passwordHash: true, googleId: true } as const;

type FilaCliente = { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null; passwordHash: string | null; googleId: string | null };

const aResuelto = (c: FilaCliente): ClienteResuelto => ({
  id: c.id,
  name: nombreDe(c),
  phone: normalizarTelefonoBasico(c.phone),
  email: c.email,
  hasAccount: !!c.passwordHash || !!c.googleId,
});

/**
 * `customerId` (una ficha del negocio) o `customer` (uno nuevo), exactamente
 * uno. El nuevo sigue CONTRATO § 0 "Cliente": se busca por teléfono, después
 * por email, y si no está se crea (sin contraseña). El email solo se guarda si
 * ningún otro cliente del negocio lo tiene.
 */
export async function resolverCliente(
  tx: Db,
  businessId: string,
  entrada: { customerId?: string; customer?: ClienteNuevo },
): Promise<ClienteResuelto> {
  if (!!entrada.customerId === !!entrada.customer) throw new BadRequestException('Elegí un cliente o cargá uno nuevo.');

  if (entrada.customerId) {
    const c = await tx.customer.findFirst({ where: { id: entrada.customerId, businessId, deletedAt: null }, select: SELECT });
    if (!c) throw new NotFoundException('Ese cliente no existe.');
    return aResuelto(c);
  }

  const nuevo = entrada.customer!;
  const phone = normalizarTelefonoBasico(nuevo.phone);
  const email = nuevo.email?.trim().toLowerCase() || null;
  if (!phone && !email) throw new BadRequestException('Cargá un teléfono o un email para el cliente.');

  const porTelefono = phone
    ? await tx.customer.findFirst({ where: { businessId, phone, deletedAt: null }, select: SELECT, orderBy: { createdAt: 'asc' } })
    : null;
  if (porTelefono) return aResuelto(porTelefono);
  const porEmail = email
    ? await tx.customer.findFirst({ where: { businessId, email, deletedAt: null }, select: SELECT })
    : null;
  if (porEmail) return aResuelto(porEmail);

  const [firstName, ...resto] = nuevo.name.trim().split(/\s+/);
  // El email es único por negocio (también entre borrados): si ya lo usa otra
  // ficha, la nueva queda sin email antes que fallar.
  const emailLibre = email ? !(await tx.customer.findFirst({ where: { businessId, email }, select: { id: true } })) : false;
  const creado = await tx.customer.create({
    data: { businessId, firstName, lastName: resto.join(' ') || null, phone: phone || null, email: emailLibre ? email : null },
    select: SELECT,
  });
  return aResuelto(creado);
}
