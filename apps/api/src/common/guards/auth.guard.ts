import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService, JwtPayload } from '../../auth/auth.service';
import { AuthContext } from '../types/auth-context.type';

interface RequestWithUser {
  headers: Record<string, string | undefined>;
  user?: AuthContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // @OptionalAuth() (2026-08-14, guest checkout): a diferencia de @Public()
    // (que corta ACÁ arriba y nunca toca el header, ni con un Bearer válido),
    // esto SÍ intenta resolver la sesión si vino un token — pero cualquier
    // fallo (sin token, token vencido/inválido, cuenta borrada, negocio que
    // no matchea) hace que la request siga igual, simplemente sin
    // `request.user` (anónima), en vez de cortar con 401. Endpoints que se
    // comportan distinto con y sin sesión, pero nunca la exigen.
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);
    if (!token) {
      if (isOptionalAuth) return true;
      throw new UnauthorizedException('Token requerido');
    }

    let payload: JwtPayload;
    try {
      payload = this.authService.verifyToken(token);
    } catch {
      if (isOptionalAuth) return true;
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const slug = request.headers['x-business-slug'];

    try {
      request.user = await this.resolveAuthContext(payload, slug);
      return true;
    } catch (err) {
      if (isOptionalAuth) return true;
      throw err;
    }
  }

  // Extraído de canActivate() para poder reusarlo tal cual en la rama
  // opcional (mismos chequeos de pertenencia, solo cambia si un fallo tira
  // 401 o deja la request seguir como anónima — eso lo decide el caller).
  private async resolveAuthContext(payload: JwtPayload, slug: string | undefined): Promise<AuthContext> {
    if (payload.type === 'member') {
      // businessId va en el where además del sub: si alguien lograra fabricar
      // un JWT con un sub válido pero un businessId que no coincide con el real
      // (ej. clave comprometida), la búsqueda falla acá directamente en vez de
      // devolver el member y dejar que el resto del guard ignore el campo.
      const member = await this.prisma.member.findFirst({
        where: { id: payload.sub, businessId: payload.businessId },
        include: {
          role: { include: { rolePermissions: { include: { permission: true } } } },
          business: { select: { id: true, mode: true, subdomain: true } },
        },
      });
      if (!member) throw new UnauthorizedException('Token inválido o expirado');

      if (slug && member.business.subdomain !== slug) {
        throw new UnauthorizedException('Token no válido para este negocio');
      }

      return {
        type: 'member',
        memberId: member.id,
        businessId: member.businessId,
        businessMode: member.business.mode,
        roleId: member.roleId,
        roleName: member.role.name,
        permissions: member.role.rolePermissions.map((rp) => rp.permission.code),
      };
    }

    if (payload.type === 'customer') {
      // Mismo motivo que en la rama member: businessId va en el where, no solo
      // el sub.
      const customer = await this.prisma.customer.findFirst({
        where: { id: payload.sub, businessId: payload.businessId },
        include: { business: { select: { id: true, mode: true, subdomain: true } } },
      });
      if (!customer || customer.deletedAt) throw new UnauthorizedException('Token inválido o expirado');

      if (slug && customer.business.subdomain !== slug) {
        throw new UnauthorizedException('Token no válido para este negocio');
      }

      return {
        type: 'customer',
        customerId: customer.id,
        businessId: customer.businessId,
        businessMode: customer.business.mode,
      };
    }

    if (payload.type === 'platform_admin') {
      // Identidad cross-tenant: no lleva businessId ni se valida contra slug.
      // Se verifica que el admin siga existiendo y activo en cada request.
      const admin = await this.prisma.platformAdmin.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, isActive: true },
      });
      if (!admin || !admin.isActive) throw new UnauthorizedException('Token inválido o expirado');

      return {
        type: 'platform_admin',
        adminId: admin.id,
        adminRole: admin.role,
      };
    }

    throw new UnauthorizedException('Token inválido o expirado');
  }

  private extractToken(request: RequestWithUser): string | undefined {
    const auth = request.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return undefined;
    return auth.slice(7);
  }
}
