import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Protege los endpoints de internal-cron/. No son parte del auth normal
 * (multi-tenant, JWT de member/customer) — los llama Cloud Scheduler como
 * "servidor a servidor", así que se marcan @Public() y en cambio se validan
 * acá contra un secret compartido, mismo criterio que MP_WEBHOOK_SECRET en
 * subscriptions.service.ts (no hay firma criptográfica de por medio como con
 * MP porque el llamador es 100% interno/de confianza).
 *
 * La comparación es en tiempo constante (auditoría técnica del 04/09,
 * hallazgo bajo). `!==` corta en el primer byte distinto, así que el tiempo
 * de respuesta filtra cuántos caracteres del secreto acertó quien prueba —
 * con suficientes intentos se reconstruye byte por byte. Es un ataque
 * incómodo sobre HTTP, pero el arreglo es de tres líneas.
 */
@Injectable()
export class InternalCronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('CRON_SECRET');
    const provided = req.header('x-cron-secret');

    if (!expected) {
      // Sin CRON_SECRET configurado, no hay forma segura de validar — se
      // rechaza todo en vez de dejar el endpoint abierto por accidente.
      throw new UnauthorizedException('CRON_SECRET no configurado');
    }
    if (!InternalCronSecretGuard.igual(provided, expected)) {
      throw new UnauthorizedException('Secret de cron inválido');
    }
    return true;
  }

  /**
   * timingSafeEqual exige buffers del MISMO largo (si no, tira) — y el largo
   * en sí también filtra información. Se comparan los SHA-256, que siempre
   * miden 32 bytes: mismo resultado, sin ninguna rama que dependa del
   * contenido ni del tamaño.
   */
  private static igual(provided: string | undefined, expected: string): boolean {
    const hash = (v: string) => createHash('sha256').update(v).digest();
    return timingSafeEqual(hash(provided ?? ''), hash(expected));
  }
}
