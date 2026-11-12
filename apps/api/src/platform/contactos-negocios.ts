import { Prisma } from '@prisma/client';

// La lista de negocios que ve el rol MARKETING del super panel (pedido del 12/11: que Milagros pueda contactar a cada
// negocio). Es OTRA lectura, no la de `listBusinesses` con columnas escondidas: el `select` de abajo es todo lo que se
// lee de la base, así que ventas, pedidos, clientes, productos, suscripción y estado ni siquiera salen de Postgres.
// Si alguna vez hace falta un dato más acá, que sea de contacto o de la dirección de la tienda, y que lo pruebe el spec.

export const SELECT_CONTACTO_DE_NEGOCIO = {
  id: true,
  name: true,
  industry: true,
  subdomain: true,
  members: {
    where: { role: { name: 'owner' } },
    select: { name: true, email: true },
    orderBy: { createdAt: 'asc' },
    take: 1,
  },
  businessConfig: { select: { email: true, whatsapp: true, instagram: true, tiktok: true, facebook: true } },
  // Solo los dominios propios que funcionan: uno pendiente, suspendido o vencido no lleva a la tienda.
  customDomains: { where: { status: 'ACTIVE' }, select: { domain: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.BusinessSelect;

export type FilaContactoDeNegocio = Prisma.BusinessGetPayload<{ select: typeof SELECT_CONTACTO_DE_NEGOCIO }>;

export interface ContactoDeNegocio {
  id: string;
  name: string;
  industry: string;
  owner: { name: string; email: string } | null;
  contact: { email: string | null; whatsapp: string | null; instagram: string | null; tiktok: string | null; facebook: string | null };
  /** El subdominio (`<subdomain>.orbita.site`) y los dominios propios activos, sin protocolo. */
  store: { subdomain: string; customDomains: string[] };
}

const texto = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Arma la fila con campos nombrados uno por uno: lo que no está acá no llega al panel aunque el select crezca. */
export function aContactoDeNegocio(b: FilaContactoDeNegocio): ContactoDeNegocio {
  const owner = b.members[0];
  const c = b.businessConfig;
  return {
    id: b.id,
    name: b.name,
    industry: b.industry,
    owner: owner ? { name: owner.name, email: owner.email } : null,
    contact: {
      email: texto(c?.email),
      whatsapp: texto(c?.whatsapp),
      instagram: texto(c?.instagram),
      tiktok: texto(c?.tiktok),
      facebook: texto(c?.facebook),
    },
    store: { subdomain: b.subdomain, customDomains: b.customDomains.map((d) => d.domain) },
  };
}

/** Búsqueda por nombre, subdominio, rubro, dominio propio o dueño/a. Los borrados no aparecen: su tienda ya no existe. */
export function filtroContactos(search?: string): Prisma.BusinessWhereInput {
  const where: Prisma.BusinessWhereInput = { deletedAt: null };
  const q = search?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { subdomain: { contains: q, mode: 'insensitive' } },
      { industry: { contains: q, mode: 'insensitive' } },
      { customDomains: { some: { domain: { contains: q, mode: 'insensitive' } } } },
      { members: { some: { role: { name: 'owner' }, OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } } },
    ];
  }
  return where;
}
