import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRES_ADDON_KEY } from '../decorators/requires-addon.decorator';
import { AuthContext } from '../types/auth-context.type';

interface RequestWithUser {
  user?: AuthContext;
}

// Mismo patrón que BusinessModeGuard (business-mode.guard.ts), pero acá el
// dato NO viaja en el JWT (a diferencia de businessMode) — el add-on se
// puede activar/vencer sin que el usuario tenga que volver a loguearse, así
// que se chequea contra la base en cada request.
@Injectable()
export class AddonGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredAddon = this.reflector.getAllAndOverride<string | undefined>(REQUIRES_ADDON_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredAddon) return true;

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    // Un platform_admin no pertenece a ningún negocio — nunca aplica esta
    // restricción (mismo criterio que BusinessModeGuard).
    if (!user || user.type === 'platform_admin') return true;

    const addon = await this.prisma.businessAddon.findFirst({
      where: {
        businessId: user.businessId,
        type: requiredAddon,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!addon) {
      throw new ForbiddenException(`ADDON_REQUIRED:${requiredAddon}`);
    }
    return true;
  }
}
