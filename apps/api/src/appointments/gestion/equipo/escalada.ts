// Regla anti-escalada de Equipo y Roles (CONTRATO § P3.3, como
// members-escalation.e2e-spec): nadie puede dar —a otra persona o a un rol—
// permisos que él mismo no tiene, ni tocar al dueño. El dueño puede todo.
import { ForbiddenException } from '@nestjs/common';
import type { MemberContext } from '../../../common/types/auth-context.type';
import { esDueno } from '../comun/alcance';

export function permisosQueFaltan(member: Pick<MemberContext, 'roleName' | 'permissions'>, codigos: readonly string[]): string[] {
  if (esDueno(member)) return [];
  return [...new Set(codigos.filter((c) => !member.permissions.includes(c)))];
}

export function assertPuedeDar(member: Pick<MemberContext, 'roleName' | 'permissions'>, codigos: readonly string[]): void {
  const faltan = permisosQueFaltan(member, codigos);
  if (faltan.length > 0) throw new ForbiddenException(`No podés dar permisos que vos no tenés: ${faltan.join(', ')}.`);
}

/** El rol del dueño (y el deprecado "admin", que tenía lo mismo) no se da ni se toca si no sos el dueño. */
export function assertNoEsRolDeDueno(member: Pick<MemberContext, 'roleName'>, rol: { name: string }): void {
  if ((rol.name === 'owner' || rol.name === 'admin') && !esDueno(member)) {
    throw new ForbiddenException('Solo el dueño puede dar el rol de propietario.');
  }
}
