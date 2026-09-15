import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ipDelCliente, type PedidoConIp } from '../utils/proxy';

/**
 * Segundo balde de throttling, keyeado por email en vez de IP (RBT-662).
 *
 * El throttle global y el `@Throttle()` por ruta trackean solo por IP (ver
 * comentario en AuthController), lo que deja pasar un ataque de fuerza bruta
 * contra UNA cuenta puntual si el atacante rota de IP en cada intento: cada
 * IP nueva arranca su propio balde de cero. Este guard corre EN PARALELO al
 * de IP (no lo reemplaza) y cuenta los intentos por email, sin importar
 * desde qué IP vinieron — mismos límites que ya define `@Throttle()` en cada
 * ruta, solo que sobre una clave distinta.
 *
 * No cubre (ni puede cubrir con un rate-limit simple) un spray de bajo
 * volumen contra MUCHAS cuentas distintas — eso queda fuera del alcance de
 * esta guard; ver LOW-001 (chequeo contra contraseñas filtradas) como
 * mitigación complementaria para ese caso.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req.body as { email?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    // Sin email, cae a la IP real del cliente (la que reenvió el BFF si el
    // secreto coincide) — no a la de Vercel (hallazgo rate-limit-ip-proxy).
    return email || ipDelCliente(req as PedidoConIp) || 'unknown';
  }
}
