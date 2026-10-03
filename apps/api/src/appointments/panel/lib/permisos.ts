// Permisos y alcance del panel de Turnos (CONTRATO.md § 0, "Permisos y alcance").
//
// El sistema de permisos es binario: el alcance "solo lo propio" se modela con
// el código base, y el `_all` lo extiende a todo el negocio. Lo "propio" de
// quien mira es su agenda (la fila de appointment_resources con su memberId) y
// el espacio que tenga asignado. Una fila fuera del alcance responde 404, no
// 403: no se revela que existe.
import type { MemberContext } from '../../../common/types/auth-context.type';
import type { PrismaService } from '../../../prisma/prisma.service';

/** El dueño pasa por todo, igual que en PermissionsGuard. */
export const esDueno = (m: MemberContext): boolean => m.roleName === 'owner';

/** ¿Quien mira tiene ese permiso? (el dueño, siempre). */
export const tiene = (m: MemberContext, codigo: string): boolean => esDueno(m) || m.permissions.includes(codigo);

export type CodigoTodo = 'appointments.agenda.view_all' | 'appointments.agenda.manage_all';

/**
 * Las agendas propias de quien mira, o null si alcanza todo el negocio (dueño
 * o el `_all` pedido). [] = no tiene agenda: con alcance propio no ve nada.
 */
export async function agendasPropias(
  prisma: Pick<PrismaService, 'appointmentResource'>,
  m: MemberContext,
  codigoTodo: CodigoTodo,
): Promise<string[] | null> {
  if (tiene(m, codigoTodo)) return null;
  const propia = await prisma.appointmentResource.findFirst({
    where: { businessId: m.businessId, memberId: m.memberId, deletedAt: null },
    select: { id: true, assignedSpaceId: true },
  });
  if (!propia) return [];
  return propia.assignedSpaceId ? [propia.id, propia.assignedSpaceId] : [propia.id];
}

/** ¿La agenda `resourceId` está dentro del alcance? (null = todo). */
export const dentroDelAlcance = (propias: string[] | null, resourceId: string): boolean => propias === null || propias.includes(resourceId);
