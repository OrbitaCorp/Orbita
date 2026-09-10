import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './common/decorators/public.decorator';

// Público: el AuthGuard es global y /health respondía 401, inútil para un
// uptime check (hallazgo health-guard del 04/09). No devuelve ningún dato.
@Public()
@Controller('health')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  // Salud del proceso: no toca la base de datos.
  @Get()
  health(): { status: string } {
    return { status: 'ok' };
  }

  // Diagnóstico para configurar TRUST_PROXY_HOPS (common/utils/proxy.ts):
  // devuelve la IP que Express ve y la cadena X-Forwarded-For que llegó. Son
  // datos del propio pedido de quien pregunta, nada de otros usuarios.
  @Get('ip')
  ip(@Req() req: Request): { ip: string | null; xForwardedFor: string | null } {
    const xff = req.headers['x-forwarded-for'];
    return { ip: req.ip ?? null, xForwardedFor: Array.isArray(xff) ? xff.join(', ') : (xff ?? null) };
  }

  // Salud de la conexión a la base: query mínima contra Prisma.
  @Get('db')
  async healthDb(): Promise<{ status: string; db: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'up' };
  }
}
