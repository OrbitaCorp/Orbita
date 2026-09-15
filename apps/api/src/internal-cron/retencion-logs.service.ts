import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Piso de la retención: por debajo de un mes se pierde la trazabilidad de cualquier reclamo reciente. */
export const RETENCION_MINIMA_DIAS = 30;

export type TablaConRetencion = 'platform_admin_logs' | 'audit_logs' | 'email_logs';

/** Por tabla: cuántas filas se borraron, o por qué no se borró nada. */
export type ResultadoPurga = Record<TablaConRetencion, number | 'apagada' | 'fallo'>;

interface Regla {
  tabla: TablaConRetencion;
  variable: string;
  porDefecto: number;
  borrar: (corte: Date) => Promise<{ count: number }>;
}

/**
 * Retención de los registros que crecían para siempre (hallazgo
 * `logs-sin-retencion` de la auditoría interna, detectado el 10/09 en
 * trans.logging).
 *
 * Solo la analítica del wizard tenía borrado automático. platform_admin_logs,
 * audit_logs y email_logs no los limpiaba nadie, y son justo las tres tablas
 * que guardan quién hizo qué y a quién se le mandó cada mail: valen mucho los
 * primeros meses (un reclamo, una discusión por un cobro, un "yo no fui") y
 * nada pasado el año.
 *
 * Decisión (Ale la puede cambiar por env var, ver DEPLOYMENT.md § Retención
 * de logs y registros):
 *  - platform_admin_logs, 365 días: acciones del super admin sobre negocios y
 *    suscripciones. Un año cubre cualquier revisión anual.
 *  - audit_logs, 365 días: el registro de "solo agregado" de cada negocio
 *    (ver audit.service.ts). Esta purga por antigüedad es la ÚNICA excepción
 *    permitida a esa regla — borra por fecha, nunca por negocio, entidad ni
 *    acción — y audit.auditoria.unit-spec.ts lo vigila.
 *  - email_logs, 180 días: solo sirve para "¿le llegó el mail del pedido?", y
 *    a los seis meses ya nadie pregunta.
 * Mínimo 30 en las tres; "0" u "off" apaga la purga de esa tabla.
 *
 * Lo corre el mantenimiento nocturno (internal-cron.controller), después de la
 * purga del wizard. deleteMany directo, sin lotes: hoy son cientos de filas
 * por tabla y el corte avanza un día por corrida, así que cada noche se van
 * las de un solo día. Ninguna de las tres tiene índice por created_at solo;
 * con estos volúmenes el barrido no se nota, y si algún día se nota, el índice
 * es una migración chica.
 */
@Injectable()
export class RetencionLogsService {
  private readonly logger = new Logger(RetencionLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Días de retención según la variable: vacía o inválida → el default; "off",
   * "0" o negativo → null (esa tabla no se purga); cualquier otro número, nunca
   * menos de RETENCION_MINIMA_DIAS.
   */
  static diasDeRetencion(variable: string, porDefecto: number): number | null {
    const crudo = (process.env[variable] ?? '').trim().toLowerCase();
    if (crudo === '') return porDefecto;
    if (crudo === 'off') return null;
    const dias = Number(crudo);
    if (!Number.isFinite(dias)) return porDefecto;
    if (dias <= 0) return null;
    return Math.max(RETENCION_MINIMA_DIAS, Math.floor(dias));
  }

  /** Borra lo más viejo que la retención de cada tabla. Nunca tira: una tabla que falla no frena a las otras. */
  async purgar(): Promise<ResultadoPurga> {
    const ahora = Date.now();
    const resultado = {} as ResultadoPurga;

    for (const regla of this.reglas()) {
      const dias = RetencionLogsService.diasDeRetencion(regla.variable, regla.porDefecto);
      if (dias === null) {
        resultado[regla.tabla] = 'apagada';
        this.logger.log(`Retención de ${regla.tabla}: apagada por ${regla.variable}, no se borra nada`);
        continue;
      }

      const corte = new Date(ahora - dias * DIA_MS);
      try {
        const { count } = await regla.borrar(corte);
        resultado[regla.tabla] = count;
        this.logger.log(`Retención de ${regla.tabla} (${dias} días): ${count} filas borradas`);
      } catch (e) {
        // Se anota y se sigue con la próxima tabla: mañana vuelve a intentar, y
        // lo que no se borró hoy cae entonces.
        resultado[regla.tabla] = 'fallo';
        this.logger.error(`Retención de ${regla.tabla}: no se pudo purgar — ${describeError(e)}`);
      }
    }

    return resultado;
  }

  private reglas(): Regla[] {
    return [
      {
        tabla: 'platform_admin_logs',
        variable: 'PLATFORM_ADMIN_LOGS_RETENTION_DAYS',
        porDefecto: 365,
        borrar: (corte) => this.prisma.platformAdminLog.deleteMany({ where: { createdAt: { lt: corte } } }),
      },
      {
        tabla: 'audit_logs',
        variable: 'AUDIT_LOGS_RETENTION_DAYS',
        porDefecto: 365,
        borrar: (corte) => this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: corte } } }),
      },
      {
        tabla: 'email_logs',
        variable: 'EMAIL_LOGS_RETENTION_DAYS',
        porDefecto: 180,
        borrar: (corte) => this.prisma.emailLog.deleteMany({ where: { createdAt: { lt: corte } } }),
      },
    ];
  }
}
