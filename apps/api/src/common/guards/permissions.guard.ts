import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { MemberContext } from '../types/auth-context.type';

interface RequestWithUser {
  user?: { type: string; permissions?: string[] };
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermission) return true;

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user || user.type !== 'member') {
      throw new ForbiddenException('Este recurso es exclusivo del panel de administración');
    }

    const member = user as MemberContext;
    // El DUEÑO nunca depende de filas de permisos en la base: es su negocio,
    // tiene acceso a todo por definición. Sin esto, un permiso nuevo en el
    // catálogo (antes de correr su backfill) dejaba al owner afuera de su
    // propia pantalla — pasó con reports.dashboard.
    if (member.roleName === 'owner') return true;
    if (!member.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(`Permiso requerido: ${requiredPermission}`);
    }

    return true;
  }
}
