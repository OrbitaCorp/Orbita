import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ipDelCliente, type PedidoConIp } from '../utils/proxy';

/** Lo que resuelve el decorador: la IP real del cliente del pedido HTTP del contexto. */
export function ipDelClienteDelContexto(ctx: ExecutionContext): string | undefined {
  return ipDelCliente(ctx.switchToHttp().getRequest<PedidoConIp>());
}

/**
 * Reemplazo de `@Ip()` de Nest: la IP real del cliente (ver ipDelCliente en
 * common/utils/proxy.ts) — la que reenvió el BFF de Next.js si el secreto
 * compartido coincide, y si no `req.ip`. Usarlo en cualquier tope por IP para
 * que todos midan con la misma vara que el throttler global (auditoría
 * interna 10/09, hallazgo rate-limit-ip-proxy).
 */
export const IpDelCliente = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => ipDelClienteDelContexto(ctx),
);
