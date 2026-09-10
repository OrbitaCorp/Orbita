import { PrismaService } from '../prisma/prisma.service';

// ¿El super admin suspendió este negocio y todavía no lo reactivó?
//
// La suspensión (de la plataforma o por mora) apaga la tienda con el mismo
// `isPaused` que usa el dueño para pausarla por su cuenta, así que el campo
// solo no distingue "la pausé yo" de "me la bajaron". Lo que sí queda es el
// registro de la acción en platform_admin_logs: la última entre
// suspend_business y reactivate_business decide. Cubre también a los negocios
// sin fila de Subscription (los anteriores al gate de publish), que es donde
// suspender no deja ninguna otra marca.
//
// Auditoría interna 10/09, ítem `api.businesses`.
export async function suspendidoPorPlataforma(
  prisma: Pick<PrismaService, 'platformAdminLog'>,
  businessId: string,
): Promise<boolean> {
  const ultima = await prisma.platformAdminLog.findFirst({
    where: {
      targetType: 'business',
      targetId: businessId,
      action: { in: ['suspend_business', 'reactivate_business'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { action: true },
  });
  return ultima?.action === 'suspend_business';
}
