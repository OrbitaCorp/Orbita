import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FULL_MODE_ONLY_KEY } from '../decorators/full-mode-only.decorator';
import { AuthContext } from '../types/auth-context.type';

interface RequestWithUser {
  user?: AuthContext;
}

@Injectable()
export class BusinessModeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isFullModeOnly = this.reflector.getAllAndOverride<boolean>(FULL_MODE_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isFullModeOnly) return true;

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    // Un platform_admin no tiene businessMode (no pertenece a un negocio); nunca
    // aplica esta restricción.
    if (user && user.type !== 'platform_admin' && user.businessMode === 'SHOWCASE') {
      throw new ForbiddenException('SHOWCASE_MODE');
    }

    return true;
  }
}
