import type { Prisma } from '@prisma/client';

/**
 * Quién cuenta como "cliente" del negocio.
 *
 * Quien escribe por WhatsApp o Instagram necesita un Customer para colgar su charla (la bandeja y el bot lo usan),
 * pero no es un cliente del negocio: no se lista en Clientes, no suma a los contadores ni a los reportes, no sale en
 * el buscador ni en el selector de pedidos. Si después compra (tiene pedidos), pasa a ser un cliente más.
 *
 * Se usa dentro de un `AND: [...]` para que no pise otros `OR` (por ejemplo el de la búsqueda).
 */
export const soloClientesReales: Prisma.CustomerWhereInput = {
  OR: [{ isChatContact: false }, { orders: { some: { deletedAt: null } } }],
};
