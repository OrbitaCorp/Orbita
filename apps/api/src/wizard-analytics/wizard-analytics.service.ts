import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LLM_ADAPTER, type LlmAdapter } from '../orbi/llm/llm-adapter.interface';
import { IngestEventsDto } from './dto/ingest-events.dto';
import { esEventoConocido } from './events';
import { redact } from './redact';
import {
  buildFriction,
  buildFunnel,
  contarInsuficientes,
  MUESTRA_MINIMA,
  type FieldStat,
  type StepCount,
} from './friction';

// Nota sobre $queryRaw: platform.service evita raw a propósito para las series
// diarias, que se leen bien con Prisma normal. Acá hay dos cosas que Prisma no
// sabe hacer y que traer a memoria sería absurdo — la MEDIANA de duración por
// campo (percentile_cont) y el ÚLTIMO evento de cada sesión (DISTINCT ON) —.
// Traerse 30 días de eventos crudos al proceso para calcularlas en JS sería
// mover cientos de miles de filas por red en cada carga del tablero. El
// schema ya está atado a Postgres (usa String[] nativo), así que el raw no
// agrega una dependencia nueva: solo la hace explícita.

const DIA_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class WizardAnalyticsService {
  private readonly logger = new Logger(WizardAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_ADAPTER) private readonly llm: LlmAdapter,
  ) {}

  // ── Escritura ──────────────────────────────────────────────────────────────

  /**
   * Ingesta de un lote de eventos. Nunca tira error al cliente: si algo del
   * lote está mal, se descarta esa fila y listo — que la analítica se rompa
   * jamás puede ensuciar la experiencia de alguien tratando de darse de alta.
   */
  async ingest(dto: IngestEventsDto): Promise<{ guardados: number }> {
    const filas = dto.events
      .filter((e) => esEventoConocido(e.type))
      .map((e) => ({
        sessionId: dto.sessionId,
        anonId: dto.anonId,
        device: dto.device ?? null,
        type: e.type,
        step: e.step ?? null,
        stepName: e.stepName ?? null,
        field: e.field ?? null,
        rubro: e.rubro ?? null,
        durationMs: e.durationMs ?? null,
        meta: sanitizarMeta(e.meta),
      }));

    if (filas.length === 0) return { guardados: 0 };

    await this.prisma.wizardEvent.createMany({ data: filas });
    return { guardados: filas.length };
  }

  /** Un turno de Orbi en el wizard. Lo llama el controller de Orbi, no el front. */
  async logAiTurn(data: {
    sessionId?: string;
    anonId?: string;
    step?: number;
    stepName?: string;
    rubro?: string;
    question: string;
    answer: string;
    latencyMs: number;
    toolsUsed: string[];
    errored: boolean;
  }): Promise<string | null> {
    try {
      const turn = await this.prisma.wizardAiTurn.create({
        data: {
          sessionId: data.sessionId ?? null,
          anonId: data.anonId ?? null,
          step: data.step ?? null,
          stepName: data.stepName ?? null,
          rubro: data.rubro ?? null,
          question: redact(data.question),
          answer: redact(data.answer),
          latencyMs: data.latencyMs,
          toolsUsed: data.toolsUsed,
          errored: data.errored,
        },
        select: { id: true },
      });
      return turn.id;
    } catch (error) {
      // Que no se pueda registrar la métrica no puede tumbar la respuesta de
      // Orbi que el usuario está esperando en pantalla.
      this.logger.error(`No se pudo registrar el turno de Orbi: ${error}`);
      return null;
    }
  }

  async rateAiTurn(turnId: string, rating: number): Promise<void> {
    await this.prisma.wizardAiTurn.updateMany({ where: { id: turnId }, data: { rating } });
  }

  // ── Lectura: el embudo ─────────────────────────────────────────────────────

  async funnel(days: number) {
    const desde = this.desde(days);

    const pasos = await this.prisma.wizardEvent.groupBy({
      by: ['step', 'stepName'],
      where: { createdAt: { gte: desde }, type: 'step_view', step: { not: null } },
      _count: { sessionId: true },
    });

    // groupBy cuenta filas, no sesiones distintas. Para el embudo hace falta
    // gente, no eventos: alguien que va y vuelve tres veces al paso 2 es UNA
    // persona en el paso 2.
    const distintas = await this.prisma.$queryRaw<{ step: number; sessions: number }[]>`
      SELECT step, COUNT(DISTINCT session_id)::int AS sessions
      FROM wizard_events
      WHERE created_at >= ${desde} AND type = 'step_view' AND step IS NOT NULL
      GROUP BY step ORDER BY step
    `;

    const nombrePorPaso = new Map(pasos.map((p) => [p.step, p.stepName ?? '']));
    const counts: StepCount[] = distintas.map((d) => ({
      step: d.step,
      stepName: nombrePorPaso.get(d.step) ?? `paso ${d.step}`,
      sessions: Number(d.sessions),
    }));

    const [sesiones, completaron] = await Promise.all([
      this.contarSesiones(desde),
      this.contarSesiones(desde, 'wizard_complete'),
    ]);

    return {
      pasos: buildFunnel(counts),
      sesiones,
      completaron,
      pctConversion: sesiones === 0 ? 0 : Math.round((completaron / sesiones) * 1000) / 10,
    };
  }

  /** El ranking de "qué dato le cuesta más a la gente". */
  async friction(days: number) {
    const desde = this.desde(days);

    const filas = await this.prisma.$queryRaw<
      {
        field: string;
        step_name: string | null;
        sesiones: number;
        mediana_segundos: number;
        sesiones_con_error: number;
        sesiones_abandonadas: number;
        reintentos_promedio: number;
      }[]
    >`
      WITH ev AS (
        SELECT * FROM wizard_events
        WHERE created_at >= ${desde} AND field IS NOT NULL
      ),
      blur AS (
        SELECT
          field,
          MIN(step_name) AS step_name,
          COUNT(DISTINCT session_id)::int AS sesiones,
          COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms), 0)::float8 / 1000 AS mediana_segundos,
          (COUNT(*)::float8 / NULLIF(COUNT(DISTINCT session_id), 0)) AS reintentos_promedio
        FROM ev WHERE type = 'field_blur' GROUP BY field
      ),
      errores AS (
        SELECT field, COUNT(DISTINCT session_id)::int AS sesiones_con_error
        FROM ev WHERE type = 'field_error' GROUP BY field
      ),
      -- El último campo que tocó cada sesión. Si esa sesión además nunca
      -- llegó al pago, ese campo es donde se le apagó la luz.
      ultimo AS (
        SELECT DISTINCT ON (session_id) session_id, field
        FROM ev ORDER BY session_id, created_at DESC
      ),
      abandono AS (
        SELECT u.field, COUNT(*)::int AS sesiones_abandonadas
        FROM ultimo u
        WHERE NOT EXISTS (
          SELECT 1 FROM wizard_events c
          WHERE c.session_id = u.session_id AND c.type = 'wizard_complete'
        )
        GROUP BY u.field
      )
      SELECT
        b.field,
        b.step_name,
        b.sesiones,
        ROUND(b.mediana_segundos::numeric, 1)::float8 AS mediana_segundos,
        COALESCE(e.sesiones_con_error, 0) AS sesiones_con_error,
        COALESCE(a.sesiones_abandonadas, 0) AS sesiones_abandonadas,
        ROUND(COALESCE(b.reintentos_promedio, 1)::numeric, 2)::float8 AS reintentos_promedio
      FROM blur b
      LEFT JOIN errores e ON e.field = b.field
      LEFT JOIN abandono a ON a.field = b.field
    `;

    const stats: FieldStat[] = filas.map((f) => ({
      field: f.field,
      stepName: f.step_name ?? '',
      sesiones: Number(f.sesiones),
      medianaSegundos: Number(f.mediana_segundos),
      sesionesConError: Number(f.sesiones_con_error),
      sesionesAbandonadas: Number(f.sesiones_abandonadas),
      reintentosPromedio: Number(f.reintentos_promedio),
    }));

    // Se devuelve también lo que quedó AFUERA por muestra chica: el panel
    // necesita poder decir "hay datos, pero todavía son pocos" en vez de
    // mostrar un vacío que se lee como "esto no funciona".
    return {
      campos: buildFriction(stats),
      insuficientes: contarInsuficientes(stats),
      muestraMinima: MUESTRA_MINIMA,
    };
  }

  // ── Lectura: Orbi ──────────────────────────────────────────────────────────

  async aiOverview(days: number) {
    const desde = this.desde(days);

    const [sesionesTotales, turnos, latencias, pulgares, conversion, señales] = await Promise.all([
      this.contarSesiones(desde),
      this.prisma.wizardAiTurn.aggregate({
        where: { createdAt: { gte: desde } },
        _count: { _all: true },
        _sum: { latencyMs: true },
      }),
      this.prisma.$queryRaw<{ p50: number | null; p95: number | null }[]>`
        SELECT
          percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)::float8 AS p50,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::float8 AS p95
        FROM wizard_ai_turns WHERE created_at >= ${desde} AND latency_ms IS NOT NULL
      `,
      this.prisma.wizardAiTurn.groupBy({
        by: ['rating'],
        where: { createdAt: { gte: desde }, rating: { not: null } },
        _count: { _all: true },
      }),
      // La pregunta que importa: ¿la gente que usa Orbi termina el wizard más
      // que la que no? Es lo único que dice si la IA sirve o solo entretiene.
      this.prisma.$queryRaw<{ uso_orbi: boolean; sesiones: number; completaron: number }[]>`
        WITH s AS (
          SELECT session_id,
            BOOL_OR(type = 'orbi_message') AS uso_orbi,
            BOOL_OR(type = 'wizard_complete') AS completo
          FROM wizard_events WHERE created_at >= ${desde} GROUP BY session_id
        )
        SELECT uso_orbi, COUNT(*)::int AS sesiones,
               COUNT(*) FILTER (WHERE completo)::int AS completaron
        FROM s GROUP BY uso_orbi
      `,
      this.prisma.wizardEvent.groupBy({
        by: ['type'],
        where: {
          createdAt: { gte: desde },
          type: { in: ['orbi_open', 'orbi_message', 'orbi_suggestion_applied', 'orbi_suggestion_overridden'] },
        },
        _count: { _all: true },
      }),
    ]);

    const sesionesConOrbi = await this.contarSesiones(desde, 'orbi_message');
    const contar = (t: string) => señales.find((s) => s.type === t)?._count._all ?? 0;
    const aplicadas = contar('orbi_suggestion_applied');
    const pisadas = contar('orbi_suggestion_overridden');
    const con = conversion.find((c) => c.uso_orbi) ?? { sesiones: 0, completaron: 0 };
    const sin = conversion.find((c) => !c.uso_orbi) ?? { sesiones: 0, completaron: 0 };

    return {
      turnos: turnos._count._all,
      sesionesConOrbi,
      pctAdopcion: sesionesTotales === 0 ? 0 : pct(sesionesConOrbi, sesionesTotales),
      turnosPorSesion: sesionesConOrbi === 0 ? 0 : Math.round((turnos._count._all / sesionesConOrbi) * 10) / 10,
      latenciaP50Ms: Math.round(latencias[0]?.p50 ?? 0),
      latenciaP95Ms: Math.round(latencias[0]?.p95 ?? 0),
      pulgarArriba: pulgares.find((p) => p.rating === 1)?._count._all ?? 0,
      pulgarAbajo: pulgares.find((p) => p.rating === -1)?._count._all ?? 0,
      aperturas: contar('orbi_open'),
      sugerenciasAplicadas: aplicadas,
      sugerenciasPisadas: pisadas,
      // Aplicó la sugerencia y NO la pisó después: la señal implícita más
      // honesta que tenemos de que la respuesta estuvo bien.
      pctSugerenciasQueSobrevivieron: aplicadas === 0 ? 0 : pct(aplicadas - pisadas, aplicadas),
      conversionConOrbi: pct(Number(con.completaron), Number(con.sesiones)),
      conversionSinOrbi: pct(Number(sin.completaron), Number(sin.sesiones)),
    };
  }

  /** De qué habla la gente con Orbi, según el clasificador. */
  async aiTopics(days: number) {
    const desde = this.desde(days);

    const [porTema, sinClasificar] = await Promise.all([
      this.prisma.wizardAiTurn.groupBy({
        by: ['topic'],
        where: { createdAt: { gte: desde }, topic: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.wizardAiTurn.count({ where: { createdAt: { gte: desde }, topic: null } }),
    ]);

    const bienRespondidas = await this.prisma.wizardAiTurn.groupBy({
      by: ['topic'],
      where: { createdAt: { gte: desde }, topic: { not: null }, answeredWell: true },
      _count: { _all: true },
    });

    const temas = porTema
      .map((t) => {
        const bien = bienRespondidas.find((b) => b.topic === t.topic)?._count._all ?? 0;
        return {
          topic: t.topic as string,
          turnos: t._count._all,
          pctBienRespondidas: pct(bien, t._count._all),
        };
      })
      .sort((a, b) => b.turnos - a.turnos);

    return { temas, sinClasificar };
  }

  /** Las últimas preguntas, en crudo (redactadas). Leerlas vale más que cualquier gráfico. */
  async aiRecentQuestions(days: number, limit = 50) {
    return this.prisma.wizardAiTurn.findMany({
      where: { createdAt: { gte: this.desde(days) } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true, question: true, answer: true, stepName: true, rubro: true,
        topic: true, answeredWell: true, rating: true, latencyMs: true, createdAt: true,
      },
    });
  }

  // ── Clasificador ───────────────────────────────────────────────────────────

  // Las categorías son fijas a propósito: si el modelo inventa una etiqueta
  // nueva por turno, el gráfico se vuelve una nube de 200 categorías de 1 y no
  // se puede leer. Cuando aparezca un tema que no entra en ninguna, cae en
  // "otro" — y que "otro" crezca ES la señal de que hay que agregar una.
  static readonly TEMAS = [
    'no-entiende-un-campo',
    'pide-ideas-de-nombre-o-descripcion',
    'duda-de-precio-o-plan',
    'duda-de-que-hace-orbita',
    'problema-tecnico',
    'quiere-que-orbi-lo-complete',
    'fuera-de-tema',
    'otro',
  ] as const;

  /**
   * Etiqueta los turnos que todavía no tienen tema. Lo dispara Cloud Scheduler
   * de madrugada (ver internal-cron.controller): hacerlo en caliente le
   * sumaría latencia a la respuesta que el usuario está esperando, y el dato
   * no lo necesita nadie hasta que alguien abra el tablero.
   */
  async classifyPendingTurns(limit = 200): Promise<{ clasificados: number }> {
    const pendientes = await this.prisma.wizardAiTurn.findMany({
      where: { topic: null },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      select: { id: true, question: true, answer: true },
    });

    let clasificados = 0;
    for (const turno of pendientes) {
      try {
        const veredicto = await this.clasificarTurno(turno.question, turno.answer);
        if (!veredicto) continue;
        await this.prisma.wizardAiTurn.update({
          where: { id: turno.id },
          data: { topic: veredicto.topic, answeredWell: veredicto.answeredWell },
        });
        clasificados++;
      } catch (error) {
        this.logger.warn(`No se pudo clasificar el turno ${turno.id}: ${error}`);
      }
    }

    this.logger.log(`Clasificador de Orbi: ${clasificados}/${pendientes.length} turnos etiquetados`);
    return { clasificados };
  }

  private async clasificarTurno(question: string, answer: string) {
    const system = [
      'Sos un clasificador. Analizás un intercambio entre alguien que está dando de alta su negocio',
      'en Órbita (un wizard de onboarding) y el asistente Orbi.',
      '',
      'Devolvés SOLO un JSON, sin markdown y sin texto alrededor, con esta forma exacta:',
      '{"topic":"<una de la lista>","answeredWell":<true|false>}',
      '',
      `Lista de temas permitidos: ${WizardAnalyticsService.TEMAS.join(', ')}.`,
      '',
      'answeredWell es true solo si la respuesta resuelve concretamente lo que se preguntó.',
      'Si divaga, se va por las ramas, contesta otra cosa o dice que no puede: false.',
    ].join('\n');

    let salida = '';
    for await (const evento of this.llm.streamChat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `PREGUNTA: ${question}\n\nRESPUESTA: ${answer}` },
      ],
    })) {
      if (evento.type === 'text') salida += evento.chunk;
    }

    const json = salida.match(/\{[\s\S]*\}/);
    if (!json) return null;

    const parsed = JSON.parse(json[0]) as { topic?: string; answeredWell?: boolean };
    const topic = (WizardAnalyticsService.TEMAS as readonly string[]).includes(parsed.topic ?? '')
      ? (parsed.topic as string)
      : 'otro';

    return { topic, answeredWell: parsed.answeredWell === true };
  }

  // ── Auxiliares ─────────────────────────────────────────────────────────────

  private desde(days: number): Date {
    return new Date(Date.now() - days * DIA_MS);
  }

  private async contarSesiones(desde: Date, type?: string): Promise<number> {
    const filas = await this.prisma.wizardEvent.findMany({
      where: { createdAt: { gte: desde }, ...(type ? { type } : {}) },
      distinct: ['sessionId'],
      select: { sessionId: true },
    });
    return filas.length;
  }
}

function pct(parte: number, total: number): number {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

// El `meta` es lo único de forma libre que acepta la ingesta, así que se poda
// acá: solo primitivas, claves y valores cortos, y los strings pasan por la
// redacción igual. Es la última barrera para que no se cuele por accidente
// texto tipeado por el usuario en un campo del formulario.
function sanitizarMeta(meta?: Record<string, unknown>): Prisma.InputJsonObject | undefined {
  if (!meta) return undefined;

  const limpio: Record<string, string | number | boolean> = {};
  for (const [clave, valor] of Object.entries(meta).slice(0, 10)) {
    if (clave.length > 30) continue;
    if (typeof valor === 'boolean' || (typeof valor === 'number' && Number.isFinite(valor))) {
      limpio[clave] = valor;
    } else if (typeof valor === 'string') {
      limpio[clave] = redact(valor.slice(0, 40));
    }
  }
  return Object.keys(limpio).length ? (limpio as Prisma.InputJsonObject) : undefined;
}
