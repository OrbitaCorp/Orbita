import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLATFORM_ROLE_KEY } from '../decorators/platform-role.decorator';
import { AuthContext } from '../types/auth-context.type';

interface RequestWithUser {
  user?: AuthContext;
}

/**
 * Restringe un endpoint a super admins de plataforma (fuera del multi-tenant).
 *
 * El AuthGuard global corre primero y ya pobló `req.user`: validó el JWT, que el
 * PlatformAdmin exista y esté activo. Acá se chequean dos cosas:
 *
 * 1. Que la identidad autenticada sea efectivamente un platform_admin (no un
 *    member/customer con token válido de su propio negocio).
 * 2. Si el endpoint lleva `@SoloSuperadmin()` / `@PlatformRole(...)`, que el
 *    rol del admin esté entre los permitidos. Sin ese decorador, cualquier
 *    admin de plataforma pasa: la mayoría de `/platform` es de lectura y la
 *    ve todo el equipo (ver platform-role.decorator.ts para el criterio).
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user || user.type !== 'platform_admin') {
      throw new ForbiddenException('Este recurso es exclusivo del panel de plataforma');
    }

    const rolesPermitidos = this.reflector.getAllAndOverride<string[] | undefined>(PLATFORM_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (rolesPermitidos?.length && !rolesPermitidos.includes(user.adminRole)) {
      throw new ForbiddenException('Esta acción es exclusiva de un superadmin');
    }

    return true;
  }
}
