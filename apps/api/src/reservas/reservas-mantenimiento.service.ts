import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Lo que pasa solo con el tiempo. Lo dispara Cloud Scheduler (cada 5 minutos,
// colgado del disparo de Instagram: ver InternalCronController) y cualquiera
// puede llamarlo a mano. Es idempotente y recorre todos los negocios: por eso
// está en EXCEPCIONES de aislamiento-consultas.unit-spec.ts.
//
// Nada de la integridad depende de que esto corra: una retenida vencida deja
// de ocupar lugar en el momento en que vence (DisponibilidadService la filtra
// y ReservasService la vence antes de contar). Acá solo se deja prolijo el
// estado y el historial.
@Injectable()
export class ReservasMantenimientoService {
  private readonly logger = new Logger(ReservasMantenimientoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Marca VENCIDA toda retenida cuyo tiempo pasó. Devuelve cuántas. */
  async vencerRetenidas(ahora = new Date()): Promise<{ vencidas: number }> {
    const vencidas = await this.prisma.reserva.findMany({
      where: { estado: 'RETENIDA', retenidaHasta: { lt: ahora } },
      select: { id: true, businessId: true },
      take: 500,
    });
    if (vencidas.length === 0) return { vencidas: 0 };
    const ids = vencidas.map((v) => v.id);
    // El where repite el estado y la fecha: si una se confirmó entre la lectura y acá, no se toca.
    const r = await this.prisma.reserva.updateMany({
      where: { id: { in: ids }, estado: 'RETENIDA', retenidaHasta: { lt: ahora } },
      data: { estado: 'VENCIDA', version: { increment: 1 } },
    });
    await this.prisma.reservaHistorial.createMany({
      data: vencidas.map((v) => ({ businessId: v.businessId, reservaId: v.id, de: 'RETENIDA' as const, a: 'VENCIDA' as const, quien: 'SISTEMA' as const, motivo: 'Se venció el tiempo para confirmar.' })),
    });
    if (r.count > 0) this.logger.log(`Reservas retenidas vencidas: ${r.count}`);
    return { vencidas: r.count };
  }
}
