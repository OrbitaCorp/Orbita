import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { AuthContext } from '../common/types/auth-context.type';
import { errorDemo } from '../common/guards/demo.guard';
import { DEMO_CUPO_GLOBAL, DEMO_IA_KEY, DEMO_LIMITE_IA, MENSAJE_CUPO_GLOBAL_DEMO, ResolverFuncion } from './demo-ia';
import { DemoIaService } from './demo-ia.service';

type Pedido = Parameters<DemoIaService['consumir']>[0] & { user?: AuthContext; body?: Record<string, unknown> };

// Consume la cuota semanal de la demo antes de correr una ruta @DemoIa, y la
// devuelve si la ruta falla. Solo actúa con el visitante de la demo: para
// cualquier otro miembro no hace nada. Ver demo-ia.ts.
@Injectable()
export class DemoIaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly demoIa: DemoIaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Pedido>();
    if (!(req.user?.type === 'member' && req.user.readOnly)) return next.handle();

    const resolver = this.reflector.get<ResolverFuncion | undefined>(DEMO_IA_KEY, context.getHandler());
    if (!resolver) throw errorDemo();
    const funcion = typeof resolver === 'function' ? resolver(req) : resolver;

    return from(this.demoIa.consumir(req, funcion)).pipe(
      switchMap(() =>
        next.handle().pipe(
          catchError((err: unknown) =>
            from(this.demoIa.devolver(req, funcion).catch(() => undefined)).pipe(
              switchMap(() => throwError(() => traducir(err))),
            ),
          ),
        ),
      ),
    );
  }
}

// El tope diario por negocio de cada función, visto desde la demo, es el cupo
// que comparten todos los visitantes: su mensaje de siempre ("llegaste al
// máximo por hoy") se cambia por uno que dice que es la demo.
function traducir(err: unknown): unknown {
  if (!(err instanceof HttpException)) return err;
  const cuerpo = err.getResponse();
  const codigo = typeof cuerpo === 'object' && cuerpo ? (cuerpo as { error?: unknown }).error : undefined;
  if (codigo === DEMO_LIMITE_IA) return err;
  const esCupo = err.getStatus() === HttpStatus.TOO_MANY_REQUESTS || /l[íi]mite diario/i.test(err.message);
  if (!esCupo) return err;
  return new HttpException({ error: DEMO_CUPO_GLOBAL, message: MENSAJE_CUPO_GLOBAL_DEMO }, HttpStatus.TOO_MANY_REQUESTS);
}
