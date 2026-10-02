import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { LLM_ADAPTER, type LlmAdapter } from '../llm/llm-adapter.interface';
import { esErrorDeAborto } from '../llm/llm-errors';
import {
  clasificarError,
  codigoParaElFront,
  MENSAJE_FALLA_PASAJERA,
  MENSAJE_MANTENIMIENTO_PANEL,
  MENSAJE_MANTENIMIENTO_WIZARD,
  sanitizarDetalle,
  type CategoriaDeFalla,
  type FallaClasificada,
} from './clasificar-error';

/** Cuánto hacia atrás se miran las fallas para decidir si son "sostenidas". */
export const VENTANA_MIN = 10;
/** Fallas seguidas (sin una sola respuesta buena en el medio) de al menos DOS actores distintos. */
export const UMBRAL_FALLAS = 5;
/** Si falla siempre lo mismo para una sola persona/negocio hace falta más: una cuenta rota no apaga a todos. */
export const UMBRAL_FALLAS_UN_ACTOR = 12;
const CACHE_MS = 15_000;
const OK_CADA_MS = 30_000;
const RECORDATORIO_MS = 24 * 60 * 60 * 1000;
const REVISAR_RECORDATORIO_CADA_MS = 60_000;
/** Si ningún mail salió, se reintenta en 15 minutos y no en 24 horas. */
const REINTENTO_DE_AVISO_MS = 15 * 60 * 1000;
const SONDA_TIMEOUT_MS = 20_000;

export type SuperficieDeOrbi = 'panel' | 'wizard';

export type CodigoDeErrorDeOrbi = 'ORBI_MAINTENANCE' | 'ORBI_PROVIDER_DOWN' | 'ORBI_ERROR';

function mensajeDeMantenimiento(surface: SuperficieDeOrbi): string {
  return surface === 'wizard' ? MENSAJE_MANTENIMIENTO_WIZARD : MENSAJE_MANTENIMIENTO_PANEL;
}

export interface EstadoDeOrbi {
  status: 'ACTIVE' | 'MAINTENANCE';
  reason: string | null;
  detail: string | null;
  trippedAt: Date | null;
  /** 'auto' o el id del admin que lo puso. */
  trippedBy: string | null;
  lastOkAt: Date | null;
}

const ACTIVO: EstadoDeOrbi = { status: 'ACTIVE', reason: null, detail: null, trippedAt: null, trippedBy: null, lastOkAt: null };

/** Cómo se llama cada causa en el mail. */
export const MOTIVO_LEGIBLE: Record<string, string> = {
  PROVIDER_CREDITS: 'Se agotó el saldo de la cuenta del proveedor de IA (Gemini)',
  PROVIDER_AUTH: 'La clave del proveedor de IA (Gemini) fue rechazada',
  MODEL_NOT_FOUND: 'El modelo de IA configurado ya no existe en el proveedor',
  PROVIDER_QUOTA: 'El proveedor de IA está limitando las llamadas (cuota)',
  PROVIDER_DOWN: 'El proveedor de IA no responde (caída o red)',
  REQUEST_INVALID: 'El proveedor de IA rechaza las consultas de Orbi',
  INTERNAL: 'Orbi falla por un error interno',
  MANUAL: 'Un administrador lo puso en mantenimiento',
};

/**
 * Mantenimiento automático de Orbi (spec 2026-10-01-orbi-mantenimiento-automatico).
 *
 * Una sola fila global decide si Orbi atiende (panel y wizard). Se apaga solo
 * en dos casos y NO se enciende solo: lo rehabilita un admin de plataforma,
 * después de una llamada de prueba real al proveedor.
 *
 *  1. Falla que no se arregla sola (saldo agotado, key inválida, modelo dado de
 *     baja): a la primera. Reintentar no sirve y cada intento es un cliente
 *     viendo un error.
 *  2. Falla sostenida: ≥ UMBRAL_FALLAS en VENTANA_MIN minutos, de ≥ 2 actores
 *     distintos y SIN ninguna respuesta buena en el medio. Una respuesta buena
 *     corta la racha, así un 1 % de errores en un sistema con tráfico no lo
 *     apaga nunca. (Con tráfico bajo, una sola persona insistiendo no cuenta
 *     hasta UMBRAL_FALLAS_UN_ACTOR.)
 *
 * Todo lo de acá es best-effort: si la base o el mail fallan, Orbi sigue
 * funcionando (fail-open) y solo se loguea. Medir la salud no puede romper lo
 * que mide.
 */
@Injectable()
export class OrbiSaludService {
  private readonly logger = new Logger(OrbiSaludService.name);
  private cache: { en: number; estado: EstadoDeOrbi } | null = null;
  private ultimoOkEscrito = 0;
  private ultimaRevisionDeRecordatorio = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    @Inject(LLM_ADAPTER) private readonly llm: LlmAdapter,
  ) {}

  // ── Lectura ──────────────────────────────────────────────────────────────

  private async leer(): Promise<EstadoDeOrbi> {
    const fila = await this.prisma.orbiServiceState.findUnique({ where: { id: 'global' } });
    if (!fila) return ACTIVO;
    return {
      status: fila.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'ACTIVE',
      reason: fila.reason,
      detail: fila.detail,
      trippedAt: fila.trippedAt,
      trippedBy: fila.trippedBy,
      lastOkAt: fila.lastOkAt,
    };
  }

  /** Con cache de 15 s por instancia: cada mensaje de Orbi lo consulta. Si la base falla, Orbi sigue (fail-open). */
  async estado(): Promise<EstadoDeOrbi> {
    const ahora = Date.now();
    if (this.cache && ahora - this.cache.en < CACHE_MS) return this.cache.estado;
    try {
      const estado = await this.leer();
      this.cache = { en: ahora, estado };
      return estado;
    } catch (e) {
      this.logger.warn(`No se pudo leer el estado de Orbi (se asume activo): ${(e as Error)?.name ?? 'error'}`);
      return ACTIVO;
    }
  }

  /** Lo llama cada chat ANTES de abrir el stream: llega como un 503 normal con `error: 'ORBI_MAINTENANCE'`, que el front entiende. */
  async exigirDisponible(surface: SuperficieDeOrbi): Promise<void> {
    const estado = await this.estado();
    if (estado.status !== 'MAINTENANCE') return;
    void this.recordatorioSiCorresponde();
    // `error` y no `code`: el filtro global da forma { error, statusCode, message } y descartaría otros campos.
    throw new ServiceUnavailableException({ error: 'ORBI_MAINTENANCE', message: mensajeDeMantenimiento(surface) });
  }

  /**
   * Para que el chat sepa al abrirse si Orbi atiende, sin mandar un mensaje.
   * Es público (lo usa el alta de negocios): dice si está disponible y nada
   * de la causa.
   */
  async disponibilidad(surface: SuperficieDeOrbi): Promise<{ disponible: true } | { disponible: false; mensaje: string }> {
    const estado = await this.estado();
    if (estado.status !== 'MAINTENANCE') return { disponible: true };
    return { disponible: false, mensaje: mensajeDeMantenimiento(surface) };
  }

  /**
   * Registra la falla y arma el evento `error` del stream. Si ESTA falla (u
   * otra instancia en paralelo) dejó a Orbi en mantenimiento, la persona ve el
   * aviso de mantenimiento y no "probá en unos minutos", que sería falso.
   */
  async avisoDeFalla(e: { error: unknown; surface: SuperficieDeOrbi; actor: string }): Promise<{ code: CodigoDeErrorDeOrbi; message: string }> {
    const falla = await this.registrarFalla(e);
    if (!esErrorDeAborto(e.error) && (await this.estado()).status === 'MAINTENANCE') {
      return { code: 'ORBI_MAINTENANCE', message: mensajeDeMantenimiento(e.surface) };
    }
    return { code: codigoParaElFront(falla.categoria), message: MENSAJE_FALLA_PASAJERA };
  }

  // ── Resultados de cada llamada ───────────────────────────────────────────

  /** El proveedor contestó bien. Escribe a lo sumo cada 30 s por instancia. */
  async registrarOk(): Promise<void> {
    const ahora = Date.now();
    if (ahora - this.ultimoOkEscrito < OK_CADA_MS) return;
    this.ultimoOkEscrito = ahora;
    try {
      const fecha = new Date(ahora);
      await this.prisma.orbiServiceState.upsert({
        where: { id: 'global' },
        update: { lastOkAt: fecha },
        create: { id: 'global', lastOkAt: fecha },
      });
    } catch (e) {
      this.logger.warn(`No se pudo registrar la respuesta buena de Orbi: ${(e as Error)?.name ?? 'error'}`);
    }
  }

  /**
   * Una llamada de Orbi falló por algo que NO es del usuario (los 4xx de
   * validación, la cuota diaria y las cancelaciones no pasan por acá).
   * Devuelve cómo se clasificó, para que el controller elija qué decirle a la
   * persona. Nunca lanza.
   */
  async registrarFalla(e: { error: unknown; surface: SuperficieDeOrbi; actor: string }): Promise<FallaClasificada> {
    const falla = clasificarError(e.error);
    // El cliente se fue a mitad de la respuesta: no es una falla de nadie.
    if (esErrorDeAborto(e.error)) return falla;
    try {
      await this.prisma.orbiProviderFailure.create({
        data: {
          surface: e.surface,
          category: falla.categoria,
          httpStatus: falla.httpStatus ?? null,
          actor: e.actor,
          detail: falla.detalle,
        },
      });
      if (falla.inmediata) {
        await this.activar({ reason: falla.categoria, detail: falla.detalle, por: 'auto' });
      } else {
        await this.evaluarFallaSostenida(falla);
      }
    } catch (err) {
      this.logger.warn(`No se pudo registrar la falla de Orbi: ${(err as Error)?.name ?? 'error'}`);
    }
    return falla;
  }

  private async evaluarFallaSostenida(ultima: FallaClasificada): Promise<void> {
    const estado = await this.leer(); // sin cache: lastOkAt tiene que estar fresco
    if (estado.status === 'MAINTENANCE') return;
    const ventana = Date.now() - VENTANA_MIN * 60_000;
    const desde = new Date(Math.max(ventana, estado.lastOkAt?.getTime() ?? 0));
    const porActor = await this.prisma.orbiProviderFailure.groupBy({
      by: ['actor'],
      where: { createdAt: { gt: desde } },
      _count: { _all: true },
    });
    const total = porActor.reduce((n, a) => n + a._count._all, 0);
    const actores = porActor.length;
    if ((total >= UMBRAL_FALLAS && actores >= 2) || total >= UMBRAL_FALLAS_UN_ACTOR) {
      await this.activar({
        reason: ultima.categoria,
        detail: sanitizarDetalle(`${total} fallas de ${actores} ${actores === 1 ? 'actor' : 'actores'} en ${VENTANA_MIN} min sin ninguna respuesta buena. Última: ${ultima.detalle}`),
        por: 'auto',
      });
    }
  }

  // ── Activar / rehabilitar ────────────────────────────────────────────────

  /**
   * Pasa a mantenimiento. La transición ACTIVE → MAINTENANCE es atómica
   * (updateMany condicionado): con varias instancias de Cloud Run fallando a
   * la vez, solo UNA gana y manda los mails. Devuelve si esta llamada ganó.
   */
  async activar(p: { reason: CategoriaDeFalla | 'MANUAL'; detail: string; por: string }): Promise<boolean> {
    const ahora = new Date();
    await this.prisma.orbiServiceState.createMany({ data: [{ id: 'global' }], skipDuplicates: true });
    const r = await this.prisma.orbiServiceState.updateMany({
      where: { id: 'global', status: 'ACTIVE' },
      data: { status: 'MAINTENANCE', reason: p.reason, detail: sanitizarDetalle(p.detail), trippedAt: ahora, trippedBy: p.por, lastNotifiedAt: ahora },
    });
    this.cache = null;
    if (r.count === 0) return false;
    this.logger.error(`Orbi pasó a MANTENIMIENTO (${p.reason}, por ${p.por}): ${sanitizarDetalle(p.detail)}`);
    void this.avisarAAdmins({ reason: p.reason, detail: p.detail, desde: ahora, recordatorio: false });
    return true;
  }

  /** Un admin lo pone en mantenimiento a mano (por ejemplo, antes de tocar algo). */
  async activarManual(adminId: string, motivo?: string): Promise<boolean> {
    return this.activar({ reason: 'MANUAL', detail: motivo?.trim() || 'Puesto en mantenimiento desde el panel de plataforma.', por: adminId });
  }

  /**
   * Una llamada real y mínima al proveedor con el mismo modelo del panel.
   * Si no responde, NO se rehabilita: reabrir con el proveedor todavía caído
   * es volver a mostrarle el error a los clientes.
   */
  async sondear(): Promise<{ ok: true } | { ok: false; categoria: CategoriaDeFalla; detalle: string }> {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), SONDA_TIMEOUT_MS);
    try {
      const modelo = this.config.get<string>('ORBI_MODEL_PANEL') ?? this.config.get<string>('ORBI_MODEL') ?? undefined;
      let hubo = false;
      for await (const ev of this.llm.streamChat({
        messages: [{ role: 'user', content: 'Respondé solo con la palabra: ok' }],
        model: modelo,
        signal: control.signal,
      })) {
        if (ev.type === 'text' || ev.type === 'usage') hubo = true;
      }
      if (!hubo) return { ok: false, categoria: 'PROVIDER_DOWN', detalle: 'El proveedor no devolvió nada.' };
      return { ok: true };
    } catch (e) {
      const f = control.signal.aborted ? ({ categoria: 'PROVIDER_DOWN', detalle: 'El proveedor no respondió a tiempo.' } as const) : clasificarError(e);
      return { ok: false, categoria: f.categoria, detalle: f.detalle };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Vuelve a ACTIVE solo si la llamada de prueba salió bien. */
  async rehabilitar(adminId: string): Promise<{ ok: true } | { ok: false; categoria: CategoriaDeFalla; detalle: string }> {
    const sonda = await this.sondear();
    if (!sonda.ok) return sonda;
    const ahora = new Date();
    await this.prisma.orbiServiceState.upsert({
      where: { id: 'global' },
      update: { status: 'ACTIVE', reason: null, detail: null, trippedAt: null, trippedBy: adminId, lastOkAt: ahora, lastNotifiedAt: null },
      create: { id: 'global', status: 'ACTIVE', lastOkAt: ahora, trippedBy: adminId },
    });
    this.cache = null;
    this.logger.log(`Orbi rehabilitado por el admin ${adminId}`);
    return { ok: true };
  }

  // ── Avisos a administradores ─────────────────────────────────────────────

  /** Mientras siga en mantenimiento, un recordatorio cada 24 h (sin cron: lo dispara el primer pedido que llegue). */
  private async recordatorioSiCorresponde(): Promise<void> {
    const ahora = Date.now();
    if (ahora - this.ultimaRevisionDeRecordatorio < REVISAR_RECORDATORIO_CADA_MS) return;
    this.ultimaRevisionDeRecordatorio = ahora;
    try {
      const corte = new Date(ahora - RECORDATORIO_MS);
      const r = await this.prisma.orbiServiceState.updateMany({
        where: { id: 'global', status: 'MAINTENANCE', OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: corte } }] },
        data: { lastNotifiedAt: new Date(ahora) },
      });
      if (r.count === 0) return;
      const estado = await this.leer();
      await this.avisarAAdmins({
        reason: estado.reason ?? 'INTERNAL',
        detail: estado.detail ?? '',
        desde: estado.trippedAt ?? new Date(ahora),
        recordatorio: true,
      });
    } catch (e) {
      this.logger.warn(`No se pudo mandar el recordatorio de Orbi: ${(e as Error)?.name ?? 'error'}`);
    }
  }

  private async avisarAAdmins(p: { reason: string; detail: string; desde: Date; recordatorio: boolean }): Promise<void> {
    let enviados = 0;
    try {
      const admins = await this.prisma.platformAdmin.findMany({ where: { isActive: true }, select: { email: true } });
      const data = {
        motivo: MOTIVO_LEGIBLE[p.reason] ?? p.reason,
        detalle: sanitizarDetalle(p.detail),
        desde: new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(p.desde),
        recordatorio: p.recordatorio,
        panelUrl: `${process.env.FRONTEND_URL ?? 'https://orbita.site'}/superadmin?seccion=orbi`,
      };
      for (const a of admins) {
        try {
          if (await this.mail.sendOrbiMantenimiento(a.email, data)) enviados++;
        } catch (e) {
          this.logger.warn(`No se pudo avisar a un admin del mantenimiento de Orbi: ${(e as Error)?.name ?? 'error'}`);
        }
      }
      if (admins.length === 0) this.logger.error('Orbi está en mantenimiento y no hay admins de plataforma activos a quienes avisar.');
    } catch (e) {
      this.logger.error(`No se pudo avisar del mantenimiento de Orbi: ${(e as Error)?.name ?? 'error'}`);
    }
    if (enviados === 0) {
      // Que el aviso se reintente en 15 minutos y no recién mañana.
      await this.prisma.orbiServiceState
        .updateMany({ where: { id: 'global', status: 'MAINTENANCE' }, data: { lastNotifiedAt: new Date(Date.now() - RECORDATORIO_MS + REINTENTO_DE_AVISO_MS) } })
        .catch(() => undefined);
    }
  }

  // ── Para el panel de plataforma ──────────────────────────────────────────

  async resumen(): Promise<{
    estado: EstadoDeOrbi;
    fallasUltimaHora: number;
    ultimasFallas: { surface: string; category: string; httpStatus: number | null; detail: string; createdAt: Date }[];
  }> {
    const estado = await this.leer();
    const [fallasUltimaHora, ultimasFallas] = await Promise.all([
      this.prisma.orbiProviderFailure.count({ where: { createdAt: { gt: new Date(Date.now() - 60 * 60_000) } } }),
      this.prisma.orbiProviderFailure.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { surface: true, category: true, httpStatus: true, detail: true, createdAt: true },
      }),
    ]);
    return { estado, fallasUltimaHora, ultimasFallas };
  }
}
