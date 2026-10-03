import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { esMes, rangoDeMesArgentina } from '../../common/utils/hora-argentina';
import { CupoOrbiService, porcentajeDe, type CupoDelNegocio } from '../../orbi/cupo/cupo-orbi.service';

// Uso de Orbi para el super panel (spec 2026-10-03 §5). Todo sale de
// orbi_turns y se agrega en SQL: un mes con miles de turnos no se trae a
// memoria. Acá SÍ viajan USD, tokens y créditos (el panel del negocio solo ve
// porcentajes, D9).

const MENSAJE_SIN_TOOLS = 'Charla, sin tools';
const PAGINA = 50;

export interface ResumenDeUso {
  mes: string;
  /** ORBI_LECTURA_CONVERSACIONES === 'on': si el super admin puede abrir el texto de un chat. */
  lecturaHabilitada: boolean;
  kpis: {
    mensajes: number;
    costoUsd: number;
    creditos: number;
    promptTokens: number;
    cachedTokens: number;
    completionTokens: number;
    thinkingTokens: number;
    latenciaP50: number | null;
    latenciaP95: number | null;
    ttftP50: number | null;
    errores: number;
    frenadosPorCupo: number;
    conGroq: number;
    accionesPropuestas: number;
    accionesConfirmadas: number;
    accionesRechazadas: number;
    escriturasRechazadas: number;
  };
  serie: { dia: string; mensajes: number; costoUsd: number }[];
  acciones: { tools: string; mensajes: number; costoPromedioUsd: number; costoTotalUsd: number; entradaPromedio: number; latenciaPromedio: number }[];
  negocios: { businessId: string; nombre: string; mensajes: number; costoUsd: number; creditos: number; cupo: number; porcentaje: number }[];
}

export interface DetalleDeNegocio {
  mes: string;
  businessId: string;
  nombre: string;
  cupo: CupoDelNegocio;
  usados: number;
  porcentaje: number;
  ajustes: { id: string; creditos: number; motivo: string; admin: string; fecha: string }[];
  miembros: {
    memberId: string;
    nombre: string;
    mensajes: number;
    costoUsd: number;
    creditos: number;
    promptTokens: number;
    completionTokens: number;
    latenciaP50: number | null;
    topePorcentaje: number | null;
  }[];
}

export interface FichaDeTurno {
  id: string;
  fecha: string;
  memberId: string;
  miembro: string;
  conversationId: string | null;
  section: string | null;
  module: string | null;
  model: string | null;
  provider: string | null;
  status: string;
  errorCategory: string | null;
  promptTokens: number | null;
  cachedTokens: number | null;
  completionTokens: number | null;
  thinkingTokens: number | null;
  latencyMs: number;
  ttftMs: number | null;
  rounds: number;
  toolsUsed: string[];
  actionsProposed: number;
  actionsConfirmed: number;
  actionsRejected: number;
  writesRejected: number;
  costUsd: number | null;
  toolsCostUsd: number | null;
  credits: number | null;
  contextChars: unknown;
  steps: unknown;
}

type FilaKpis = ResumenDeUso['kpis'];

const KPIS_VACIOS: FilaKpis = {
  mensajes: 0, costoUsd: 0, creditos: 0, promptTokens: 0, cachedTokens: 0, completionTokens: 0, thinkingTokens: 0,
  latenciaP50: null, latenciaP95: null, ttftP50: null, errores: 0, frenadosPorCupo: 0, conGroq: 0,
  accionesPropuestas: 0, accionesConfirmadas: 0, accionesRechazadas: 0, escriturasRechazadas: 0,
};

// Los percentiles y promedios de Postgres vuelven null sin filas (o como
// string si el driver los trae como numeric): se normalizan a number | null.
function aNumero(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Decimal de Prisma (cost_usd) → number. Nunca pasa por el JSON como string.
function decimalANumero(v: { toString(): string } | null): number | null {
  return v === null ? null : aNumero(v.toString());
}

@Injectable()
export class OrbiUsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cupo: CupoOrbiService,
    private readonly config: ConfigService,
  ) {}

  private rango(mes: string): { desde: Date; hasta: Date } {
    if (!esMes(mes)) throw new BadRequestException('El mes tiene que tener la forma AAAA-MM.');
    return rangoDeMesArgentina(mes);
  }

  async resumen(mes: string): Promise<ResumenDeUso> {
    const { desde, hasta } = this.rango(mes);

    // El orden de estas cuatro consultas es el que mockea el spec.
    const [kpis, serie, acciones, negocios] = await Promise.all([
      this.prisma.$queryRaw<Partial<FilaKpis>[]>`
        SELECT count(*)::int AS mensajes,
               coalesce(sum(cost_usd),0)::float AS "costoUsd", coalesce(sum(credits),0)::int AS creditos,
               coalesce(sum(prompt_tokens),0)::int AS "promptTokens", coalesce(sum(cached_tokens),0)::int AS "cachedTokens",
               coalesce(sum(completion_tokens),0)::int AS "completionTokens", coalesce(sum(thinking_tokens),0)::int AS "thinkingTokens",
               percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE status <> 'quota') AS "latenciaP50",
               percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE status <> 'quota') AS "latenciaP95",
               percentile_cont(0.5) WITHIN GROUP (ORDER BY ttft_ms) AS "ttftP50",
               count(*) FILTER (WHERE status = 'error')::int AS errores, count(*) FILTER (WHERE status = 'quota')::int AS "frenadosPorCupo",
               count(*) FILTER (WHERE provider IN ('groq','mixto'))::int AS "conGroq",
               coalesce(sum(actions_proposed),0)::int AS "accionesPropuestas", coalesce(sum(actions_confirmed),0)::int AS "accionesConfirmadas",
               coalesce(sum(actions_rejected),0)::int AS "accionesRechazadas", coalesce(sum(writes_rejected),0)::int AS "escriturasRechazadas"
        FROM orbi_turns WHERE created_at >= ${desde} AND created_at < ${hasta}`,
      this.prisma.$queryRaw<{ dia: string; mensajes: number; costoUsd: number }[]>`
        SELECT to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS dia,
               count(*)::int AS mensajes, coalesce(sum(cost_usd),0)::float AS "costoUsd"
        FROM orbi_turns WHERE created_at >= ${desde} AND created_at < ${hasta} GROUP BY 1 ORDER BY 1`,
      // La combinación de tools (sin repetir, ordenadas) de cada mensaje.
      this.prisma.$queryRaw<
        { tools: string; mensajes: number; costoPromedioUsd: number | null; costoTotalUsd: number; entradaPromedio: number | null; latenciaPromedio: number | null }[]
      >`
        SELECT coalesce(array_to_string(ARRAY(SELECT DISTINCT unnest(tools_used) ORDER BY 1), ' + '), '') AS tools,
               count(*)::int AS mensajes, avg(cost_usd)::float AS "costoPromedioUsd", coalesce(sum(cost_usd),0)::float AS "costoTotalUsd",
               avg(prompt_tokens)::float AS "entradaPromedio", avg(latency_ms)::float AS "latenciaPromedio"
        FROM orbi_turns WHERE created_at >= ${desde} AND created_at < ${hasta} AND status <> 'quota'
        GROUP BY 1 ORDER BY "costoTotalUsd" DESC LIMIT 20`,
      this.prisma.$queryRaw<{ businessId: string; nombre: string; mensajes: number; costoUsd: number; creditos: number }[]>`
        SELECT t.business_id AS "businessId", b.name AS nombre, count(*)::int AS mensajes,
               coalesce(sum(t.cost_usd),0)::float AS "costoUsd", coalesce(sum(t.credits),0)::int AS creditos
        FROM orbi_turns t JOIN businesses b ON b.id = t.business_id
        WHERE t.created_at >= ${desde} AND t.created_at < ${hasta}
        GROUP BY 1, 2 ORDER BY "costoUsd" DESC LIMIT 50`,
    ]);

    const k = { ...KPIS_VACIOS, ...(kpis[0] ?? {}) };
    const cupos = await Promise.all(negocios.map((n) => this.cupo.cupoDelNegocio(n.businessId, mes)));

    return {
      mes,
      lecturaHabilitada: this.config.get<string>('ORBI_LECTURA_CONVERSACIONES') === 'on',
      kpis: { ...k, latenciaP50: aNumero(k.latenciaP50), latenciaP95: aNumero(k.latenciaP95), ttftP50: aNumero(k.ttftP50) },
      serie: serie.map((s) => ({ dia: s.dia, mensajes: s.mensajes, costoUsd: s.costoUsd })),
      acciones: acciones
        .map((a) => ({
          tools: a.tools === '' ? MENSAJE_SIN_TOOLS : a.tools,
          mensajes: a.mensajes,
          costoPromedioUsd: aNumero(a.costoPromedioUsd) ?? 0,
          costoTotalUsd: aNumero(a.costoTotalUsd) ?? 0,
          entradaPromedio: aNumero(a.entradaPromedio) ?? 0,
          latenciaPromedio: aNumero(a.latenciaPromedio) ?? 0,
        }))
        .sort((x, y) => y.costoTotalUsd - x.costoTotalUsd),
      negocios: negocios.map((n, i) => ({
        businessId: n.businessId,
        nombre: n.nombre,
        mensajes: n.mensajes,
        costoUsd: n.costoUsd,
        creditos: n.creditos,
        cupo: cupos[i].total,
        porcentaje: porcentajeDe(n.creditos, cupos[i].total),
      })),
    };
  }

  async negocio(businessId: string, mes: string): Promise<DetalleDeNegocio> {
    const { desde, hasta } = this.rango(mes);
    const negocio = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
    if (!negocio) throw new NotFoundException('Negocio no encontrado');

    const [cupo, uso, ajustes, topes, filas] = await Promise.all([
      this.cupo.cupoDelNegocio(businessId, mes),
      this.cupo.usados(businessId, mes),
      this.cupo.ajustesDelMes(businessId, mes),
      this.cupo.topes(businessId),
      this.prisma.$queryRaw<
        { memberId: string; mensajes: number; costoUsd: number; creditos: number; promptTokens: number; completionTokens: number; latenciaP50: unknown }[]
      >`
        SELECT member_id AS "memberId", count(*)::int AS mensajes,
               coalesce(sum(cost_usd),0)::float AS "costoUsd", coalesce(sum(credits),0)::int AS creditos,
               coalesce(sum(prompt_tokens),0)::int AS "promptTokens", coalesce(sum(completion_tokens),0)::int AS "completionTokens",
               percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE status <> 'quota') AS "latenciaP50"
        FROM orbi_turns
        WHERE business_id = ${businessId} AND created_at >= ${desde} AND created_at < ${hasta}
        GROUP BY 1 ORDER BY creditos DESC`,
    ]);

    const adminIds = [...new Set(ajustes.map((a) => a.adminId))];
    const memberIds = filas.map((f) => f.memberId);
    const [admins, miembros] = await Promise.all([
      adminIds.length > 0
        ? this.prisma.platformAdmin.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true, email: true } })
        : Promise.resolve([]),
      memberIds.length > 0
        ? this.prisma.member.findMany({ where: { id: { in: memberIds }, businessId }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    const nombreAdmin = new Map(admins.map((a) => [a.id, a.name || a.email]));
    const nombreMiembro = new Map(miembros.map((m) => [m.id, m.name]));

    return {
      mes,
      businessId,
      nombre: negocio.name,
      cupo,
      usados: uso.negocio,
      porcentaje: porcentajeDe(uso.negocio, cupo.total),
      ajustes: ajustes.map((a) => ({
        id: a.id,
        creditos: a.creditos,
        motivo: a.motivo,
        admin: nombreAdmin.get(a.adminId) ?? a.adminId,
        fecha: a.createdAt.toISOString(),
      })),
      miembros: filas.map((f) => ({
        memberId: f.memberId,
        nombre: nombreMiembro.get(f.memberId) ?? f.memberId,
        mensajes: f.mensajes,
        costoUsd: f.costoUsd,
        creditos: f.creditos,
        promptTokens: f.promptTokens,
        completionTokens: f.completionTokens,
        latenciaP50: aNumero(f.latenciaP50),
        topePorcentaje: topes.get(f.memberId) ?? null,
      })),
    };
  }

  /** Mensajes de un negocio (y de un miembro, si se pide), del más nuevo al más viejo, de a 50. */
  async turnos(f: { businessId: string; memberId?: string; mes: string; antesDe?: string }): Promise<{ turnos: FichaDeTurno[]; siguiente: string | null }> {
    const { desde, hasta } = this.rango(f.mes);
    let tope = hasta;
    if (f.antesDe) {
      const antes = new Date(f.antesDe);
      if (Number.isNaN(antes.getTime())) throw new BadRequestException('La fecha de corte no es válida.');
      if (antes < hasta) tope = antes;
    }

    // Se pide uno de más para saber si hay otra página sin un count aparte.
    const filas = await this.prisma.orbiTurn.findMany({
      where: {
        businessId: f.businessId,
        ...(f.memberId ? { memberId: f.memberId } : {}),
        createdAt: { gte: desde, lt: tope },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGINA + 1,
    });
    const hayMas = filas.length > PAGINA;
    const pagina = hayMas ? filas.slice(0, PAGINA) : filas;

    const ids = [...new Set(pagina.map((t) => t.memberId))];
    const miembros =
      ids.length > 0 ? await this.prisma.member.findMany({ where: { id: { in: ids }, businessId: f.businessId }, select: { id: true, name: true } }) : [];
    const nombres = new Map(miembros.map((m) => [m.id, m.name]));

    return {
      turnos: pagina.map((t) => ({
        id: t.id,
        fecha: t.createdAt.toISOString(),
        memberId: t.memberId,
        miembro: nombres.get(t.memberId) ?? t.memberId,
        conversationId: t.conversationId,
        section: t.section,
        module: t.module,
        model: t.model,
        provider: t.provider,
        status: t.status,
        errorCategory: t.errorCategory,
        promptTokens: t.promptTokens,
        cachedTokens: t.cachedTokens,
        completionTokens: t.completionTokens,
        thinkingTokens: t.thinkingTokens,
        latencyMs: t.latencyMs,
        ttftMs: t.ttftMs,
        rounds: t.rounds,
        toolsUsed: t.toolsUsed,
        actionsProposed: t.actionsProposed,
        actionsConfirmed: t.actionsConfirmed,
        actionsRejected: t.actionsRejected,
        writesRejected: t.writesRejected,
        costUsd: decimalANumero(t.costUsd),
        toolsCostUsd: decimalANumero(t.toolsCostUsd),
        credits: t.credits,
        contextChars: t.contextChars,
        steps: t.steps,
      })),
      siguiente: hayMas ? pagina[PAGINA - 1].createdAt.toISOString() : null,
    };
  }
}
