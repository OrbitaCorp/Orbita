import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { currentMonth, inicioDelMesDeCostos } from './mes-de-costos';

@Injectable()
export class AlertasDeCostoService {
  private readonly logger = new Logger(AlertasDeCostoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compara cada límite activo con el gasto del mes (cost_snapshots, que el sync
   * nocturno acaba de actualizar) y crea una cost_alert por cada umbral cruzado,
   * una sola vez por mes. Antes los límites solo se mostraban: nadie se enteraba.
   *
   * Mismo criterio que getLimits: se compara el snapshot del proveedor contra el
   * threshold sin mirar `type` (los USAGE también se evalúan así), y los límites
   * sin proveedor no tienen contra qué compararse, por eso se excluyen.
   */
  async revisar(ahora: Date = new Date()): Promise<{ creadas: number }> {
    // Mes y borde del "una vez por mes" salen del mismo helper UTC que usan los
    // snapshots: si mezcláramos hora argentina, durante unas horas el mes del
    // snapshot y el de la deduplicación no coincidirían.
    const mes = currentMonth(ahora);
    const inicio = inicioDelMesDeCostos(ahora);
    const limites = await this.prisma.costLimit.findMany({
      where: { active: true, providerId: { not: null } },
    });
    let creadas = 0;
    for (const l of limites) {
      // El where ya filtra; esto es cinturón y tirantes (y el tipo de providerId).
      if (!l.active || !l.providerId) continue;
      const snap = await this.prisma.costSnapshot.findFirst({ where: { providerId: l.providerId, month: mes } });
      const actual = snap ? Number(snap.amountUsd) : 0;
      const umbral = Number(l.threshold);
      if (umbral <= 0) continue;
      const pct = (actual / umbral) * 100;
      for (const p of [...l.alertAtPercent].sort((a, b) => a - b)) {
        if (pct < p) break;
        const ya = await this.prisma.costAlert.findFirst({
          where: { limitId: l.id, percentReached: p, notifiedAt: { gte: inicio } },
          select: { id: true },
        });
        if (ya) continue;
        await this.prisma.costAlert.create({ data: { limitId: l.id, percentReached: p, currentValue: actual } });
        creadas++;
      }
    }
    if (creadas) this.logger.warn(`Costos: ${creadas} alertas nuevas de límite`);
    return { creadas };
  }
}
