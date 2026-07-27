import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthContext } from '../types/auth-context.type';

interface RequestWithUser {
  user?: AuthContext;
}

/**
 * Restringe un endpoint a super admins de plataforma (fuera del multi-tenant).
 *
 * El AuthGuard global corre primero y ya pobló `req.user`: validó el JWT, que el
 * PlatformAdmin exista y esté activo. Acá solo se chequea que la identidad
 * autenticada sea efectivamente un platform_admin (no un member/customer con
 * token válido de su propio negocio).
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user || user.type !== 'platform_admin') {
      throw new ForbiddenException('Este recurso es exclusivo del panel de plataforma');
    }
    return true;
  }
}
