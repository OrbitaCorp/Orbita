import { Controller, Get } from '@nestjs/common';
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

  // Salud de la conexión a la base: query mínima contra Prisma.
  @Get('db')
  async healthDb(): Promise<{ status: string; db: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'up' };
  }
}
