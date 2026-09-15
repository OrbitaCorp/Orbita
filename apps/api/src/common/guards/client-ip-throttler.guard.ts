import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ipDelCliente, type PedidoConIp } from '../utils/proxy';

/**
 * Throttler global por IP, pero con la IP REAL del cliente.
 *
 * El ThrottlerGuard de @nestjs/throttler trackea por `req.ip`. Con `trust
 * proxy` configurado (main.ts) eso ya es la IP real cuando el navegador
 * llama a la API directo, pero los pedidos que pasan por el BFF de Next.js
 * en Vercel (login, refresh, registro, alta) llegan todos con la IP de
 * Vercel y compartían un solo balde de 60/min entre TODOS los usuarios
 * (auditoría interna 10/09, hallazgo rate-limit-ip-proxy). Acá el tracker
 * es `ipDelCliente`: la IP que reenvió el BFF solo si el secreto compartido
 * coincide, y si no `req.ip` como siempre. Sin BFF_IP_SECRET configurado se
 * comporta exactamente igual que el guard original.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    return ipDelCliente(req as PedidoConIp) || 'unknown';
  }
}
