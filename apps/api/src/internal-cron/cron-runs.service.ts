import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';

/** Lo que devuelve un disparo: o corrió, o se salteó y por qué. */
export type ResultadoCorrida =
  | { ok: true; corrio: true; runKey: string }
  | { ok: true; corrio: false; motivo: 'ya_corrio' | 'en_curso'; runKey: string };

// Media hora sin terminar = la corrida anterior se murió (la instancia de
// Cloud Run se apagó, el proceso se cayó). Ninguno de los tres jobs tarda ni
// cerca de eso, así que pasado ese tiempo se puede retomar sin miedo a estar
// pisando una corrida viva.
const MINUTOS_PARA_RETOMAR = 30;

/**
 * Idempotencia y candado de los jobs de Cloud Scheduler.
 *
 * Cloud Scheduler REINTENTA cuando una corrida devuelve error o tarda de más,
 * y nada impedía que el reintento repitiera el trabajo entero: el resumen
 * diario le manda un mail a cada negocio, así que un reintento significaba el
 * mail duplicado para todos. Dos disparos simultáneos, lo mismo.
 *
 * La marca es una fila en `cron_runs` con `@@unique([job, runKey])`, donde
 * `runKey` es la ventana lógica del trabajo (el día para los diarios, la
 * semana para el semanal). Quien logra crear la fila corre; el resto se
 * saltea. El unique de Postgres es lo que resuelve la carrera entre dos
 * disparos que llegan juntos — no hay chequeo previo que valga sin él.
 *
 * Una corrida que falla queda con `ok: false` y se puede reintentar: es lo
 * que se quiere, porque el trabajo no se hizo (o se hizo a medias, y estos
 * tres jobs son de "hacer lo que falta").
 */
@Injectable()
export class CronRunsService {
  private readonly logger = new Logger(CronRunsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Día calendario en Buenos Aires: "2026-09-10". */
  static claveDelDia(ahora = new Date()): string {
    return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  }

  /** Semana ISO: "2026-W37". Lunes a domingo, como el reporte semanal. */
  static claveDeLaSemana(ahora = new Date()): string {
    const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
    // Jueves de esa semana: define el año ISO al que pertenece.
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semana = Math.ceil(((d.getTime() - inicioAnio.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
  }

  /**
   * Corre `trabajo` una sola vez por ventana. Devuelve si corrió o por qué no.
   * Un error del trabajo se registra y se vuelve a lanzar: Cloud Scheduler
   * tiene que ver el fallo para reintentar.
   */
  async correrUnaVez(job: string, runKey: string, trabajo: () => Promise<void>): Promise<ResultadoCorrida> {
    const permiso = await this.tomar(job, runKey);
    if (permiso !== 'corre') return { ok: true, corrio: false, motivo: permiso, runKey };

    try {
      await trabajo();
      await this.prisma.cronRun.update({
        where: { job_runKey: { job, runKey } },
        data: { finishedAt: new Date(), ok: true, detalle: null },
      });
      return { ok: true, corrio: true, runKey };
    } catch (e) {
      await this.prisma.cronRun.update({
        where: { job_runKey: { job, runKey } },
        data: { finishedAt: new Date(), ok: false, detalle: describeError(e).slice(0, 500) },
      });
      throw e;
    }
  }

  private async tomar(job: string, runKey: string): Promise<'corre' | 'ya_corrio' | 'en_curso'> {
    try {
      await this.prisma.cronRun.create({ data: { job, runKey } });
      return 'corre';
    } catch (e) {
      // P2002 = ya existe la fila de esta ventana. No es un error: es el otro
      // disparo, o el mismo de antes.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') throw e;
    }

    const previa = await this.prisma.cronRun.findUnique({ where: { job_runKey: { job, runKey } } });
    if (!previa) return 'corre'; // se borró entre medio; que corra

    if (previa.ok === true) {
      this.logger.log(`${job} ${runKey}: ya corrió, no se repite`);
      return 'ya_corrio';
    }

    const colgadaDesde = Date.now() - previa.startedAt.getTime() > MINUTOS_PARA_RETOMAR * 60_000;
    if (previa.finishedAt === null && !colgadaDesde) {
      this.logger.warn(`${job} ${runKey}: hay otra corrida en curso, este disparo no hace nada`);
      return 'en_curso';
    }

    // Falló, o quedó colgada hace rato: se reintenta sobre la misma fila.
    await this.prisma.cronRun.update({
      where: { id: previa.id },
      data: { startedAt: new Date(), finishedAt: null, ok: null, detalle: null },
    });
    this.logger.log(`${job} ${runKey}: reintento de una corrida ${previa.ok === false ? 'fallida' : 'colgada'}`);
    return 'corre';
  }
}
