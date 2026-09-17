import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ÚNICA definición de "sucursal principal" del negocio: la fila de `branches`
 * con `isDefault: true` (hallazgo `sucursal-principal-doble` de la auditoría
 * interna).
 *
 * Antes convivían dos definiciones distintas:
 *
 * 1. El flag explícito `isDefault`, que lo pone el alta del negocio
 *    (`onboarding.service.ts#registerBusiness`) y que usaban productos,
 *    inventario, la dirección de retiro de la tienda y el panel de
 *    Configuración.
 * 2. "La más antigua por `createdAt`", derivada, que usaban la tienda
 *    (`storefront.service.ts#sucursalDeVenta`) y los pedidos del panel que
 *    llegan sin `branch_id` (`orders.service.ts#create`).
 *
 * Hoy devuelven la misma fila porque la principal es justo la que crea el alta
 * — pero son dos reglas, no una: en cuanto la principal se reasigne (o una
 * migración cree una sucursal con `createdAt` anterior), el panel carga stock
 * en una sucursal y la tienda vende contra otra, mostrando "sin stock"
 * productos que sí tienen.
 *
 * Gana `isDefault` y no "la más antigua" por dos motivos:
 *
 * - Es **explícita y reasignable**: vive en la fila, el dueño la va a poder
 *   mover el día que exista multi-sucursal de verdad, sin tener que falsear
 *   fechas de creación. "La más antigua" no la elige nadie y no se puede
 *   cambiar sin borrar y recrear sucursales.
 * - Ya la usaban **más consumidores** (productos, inventario, el retiro en
 *   local del storefront y Configuración del panel), así que unificar para
 *   este lado toca menos código y no cambia el comportamiento con los datos
 *   de hoy: en producción todos los negocios con sucursales tienen
 *   exactamente una `isDefault`, y en el único negocio con dos sucursales la
 *   principal es además la más vieja.
 */
export function whereSucursalPrincipal(businessId: string): Prisma.BranchWhereInput {
  return { businessId, isDefault: true };
}

/**
 * La sucursal principal del negocio, o `null` si no tiene ninguna.
 *
 * Devuelve `null` en vez de tirar la excepción a propósito: el código HTTP
 * cambia según de dónde venga el pedido (422 en el panel, que es un negocio
 * mal configurado que el dueño puede arreglar; 404 en la tienda pública, que
 * no le cuenta a un desconocido cómo está armado el negocio). Cada caller tira
 * la suya.
 */
export async function buscarSucursalPrincipal(
  prisma: PrismaService,
  businessId: string,
): Promise<{ id: string } | null> {
  return prisma.branch.findFirst({
    where: whereSucursalPrincipal(businessId),
    select: { id: true },
  });
}
