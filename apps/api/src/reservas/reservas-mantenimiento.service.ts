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

  /**
   * Saca de la lista de espera a quien esperaba un horario que ya empezó:
   * nadie le va a dar ese lugar (el motor no promueve en un horario que ya
   * empezó) y, sin esto, la fila queda "esperando" para siempre. Devuelve
   * cuántas cerró.
   */
  async cerrarEsperasPasadas(ahora = new Date()): Promise<{ cerradas: number }> {
    const pasadas = await this.prisma.reservaEspera.findMany({
      where: { estado: 'ESPERANDO', inicio: { lte: ahora } },
      select: { id: true, businessId: true },
      take: 500,
    });
    if (pasadas.length === 0) return { cerradas: 0 };
    // El where repite el estado: si justo tomó el lugar entre la lectura y acá, no se toca.
    const r = await this.prisma.reservaEspera.updateMany({
      where: { id: { in: pasadas.map((p) => p.id) }, estado: 'ESPERANDO', inicio: { lte: ahora } },
      data: { estado: 'CANCELADA' },
    });
    if (r.count > 0) this.logger.log(`Esperas de horarios que ya empezaron, cerradas: ${r.count}`);
    return { cerradas: r.count };
  }
}
