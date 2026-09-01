import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Protege los endpoints de internal-cron/. No son parte del auth normal
 * (multi-tenant, JWT de member/customer) — los llama Cloud Scheduler como
 * "servidor a servidor", así que se marcan @Public() y en cambio se validan
 * acá contra un secret compartido, mismo criterio que MP_WEBHOOK_SECRET en
 * subscriptions.service.ts (comparación simple, no hay firma criptográfica
 * de por medio como con MP porque el llamador es 100% interno/de confianza).
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
    if (provided !== expected) {
      throw new UnauthorizedException('Secret de cron inválido');
    }
    return true;
  }
}
