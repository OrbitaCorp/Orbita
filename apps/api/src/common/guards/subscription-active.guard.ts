import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ALLOW_WHEN_PAUSED_KEY } from '../decorators/allow-when-paused.decorator';
import { AuthContext } from '../types/auth-context.type';

interface RequestWithUser {
  user?: AuthContext;
  method: string;
}

// Modo "solo lectura" de una tienda suspendida por falta de pago, O dada de
// baja voluntariamente (dentro de la ventana de 60 días antes del borrado —
// RBT, ciclo de vida de suscripciones, 2026-09): el panel entero sigue siendo
// visible (todos los GET pasan siempre), pero ninguna acción que modifique
// datos funciona hasta que se resuelva el pago o se reactive la baja — salvo
// las rutas marcadas @AllowWhenPaused() (activar/cambiar de plan, cancelar o
// deshacer la cancelación, pausar/reactivar la tienda a mano, el perfil
// propio de acceso).
//
// A propósito basado en Subscription.status === 'SUSPENDED', NO en
// Business.isPaused: ese campo está sobrecargado (también lo escribe el
// dueño al pausar la tienda a mano desde Configuración — ver
// businesses.service.ts pause()) — una pausa voluntaria/vacaciones no
// debería dejar al dueño sin poder editar nada. Solo el estado real de la
// suscripción bloquea.
//
// Mismo criterio que AddonGuard: solo aplica a member (un customer o un
// platform_admin nunca están sujetos a la suscripción de un negocio — de
// hecho un platform_admin no tiene businessId) y consulta la base fresca en
// cada request, no el JWT — el estado puede cambiar sin que el dueño vuelva
// a loguearse (un cron nocturno o un pago de MP lo puede tocar en cualquier
// momento). A diferencia de AddonGuard (opt-in: bloquea solo lo marcado),
// este es opt-OUT: bloquea por default, @AllowWhenPaused() es la excepción.
@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permitido = this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_WHEN_PAUSED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (permitido) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    // Cualquier lectura (GET) pasa siempre — "ver todo" es justamente lo que
    // el modo solo-lectura tiene que seguir permitiendo.
    if (request.method === 'GET') return true;

    const { user } = request;
    if (!user || user.type !== 'member') return true;

    const business = await this.prisma.business.findUnique({
      where: { id: user.businessId },
      select: { cancelledAt: true, subscription: { select: { status: true } } },
    });
    // `cancelledAt` se chequea aparte de `subscription.status` (no solo este
    // último) por las dudas de que la fila de Subscription no exista todavía
    // en algún negocio viejo/de prueba — cancelBusiness() setea los dos
    // juntos siempre que puede, pero un negocio sin Subscription real no
    // debería quedar afuera de este bloqueo solo por eso.
    if (business?.cancelledAt || business?.subscription?.status === 'CANCELLED') {
      throw new ForbiddenException('SUBSCRIPTION_CANCELLED');
    }
    if (business?.subscription?.status === 'SUSPENDED') {
      throw new ForbiddenException('SUBSCRIPTION_SUSPENDED');
    }
    return true;
  }
}
