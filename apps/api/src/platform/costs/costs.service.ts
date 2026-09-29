import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLimitDto } from './dto/create-limit.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { CostAdapter } from './adapters/adapter.interface';
import { InternalCostAdapter, PRICING } from './adapters/internal.adapter';
import { COST_ADAPTERS } from './costs.constants';

const DEFAULT_PROVIDERS = [
  { slug: 'gcloud', name: 'Google Cloud', color: '#4285f4', apiType: 'MANUAL' as const },
  { slug: 'cloudflare', name: 'Cloudflare', color: '#f6821f', apiType: 'MANUAL' as const },
  { slug: 'supabase', name: 'Supabase', color: '#3ecf8e', apiType: 'MANUAL' as const },
  { slug: 'gemini', name: 'Gemini', color: '#886ef8', apiType: 'MANUAL' as const },
  { slug: 'vercel', name: 'Vercel', color: '#000000', apiType: 'MANUAL' as const },
  { slug: 'resend', name: 'Resend', color: '#111111', apiType: 'MANUAL' as const },
  { slug: 'groq', name: 'Groq', color: '#f55036', apiType: 'MANUAL' as const },
  { slug: 'serper', name: 'Serper (Google Images)', color: '#ea4335', apiType: 'MANUAL' as const },
  { slug: 'tavily', name: 'Tavily Search', color: '#00d2ff', apiType: 'MANUAL' as const },
];

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthsAgo(n: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(d.toISOString().slice(0, 7));
  }
  return result;
}

@Injectable()
export class CostsService {
  private readonly logger = new Logger(CostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(COST_ADAPTERS) private readonly adapters: CostAdapter[],
    @Optional() private readonly internalAdapter?: InternalCostAdapter,
  ) {}

  async seedProviders(): Promise<void> {
    for (const p of DEFAULT_PROVIDERS) {
      const provider = await this.prisma.costProvider.upsert({
        where: { slug: p.slug },
        update: {},
        create: { slug: p.slug, name: p.name, color: p.color, apiType: p.apiType },
      });

      if (p.slug === 'serper' || p.slug === 'tavily') {
        const existingLimit = await this.prisma.costLimit.findFirst({
          where: { providerId: provider.id, type: 'USAGE' },
        });
        if (!existingLimit) {
          await this.prisma.costLimit.create({
            data: {
              providerId: provider.id,
              type: 'USAGE',
              category: 'search_query',
              threshold: p.slug === 'serper' ? 2500 : 1000,
              unit: 'queries',
              alertAtPercent: [80, 100],
            },
          });
        }
      }
    }
    this.logger.log(`Seed: ${DEFAULT_PROVIDERS.length} proveedores verificados`);
  }

  async getOverview(months: number) {
    const range = monthsAgo(months);
    const cur = range[0];
    const prev = range[1] ?? null;

    const providers = await this.prisma.costProvider.findMany({
      where: { active: true },
      include: {
        snapshots: {
          where: { month: { in: range } },
          orderBy: { month: 'asc' },
        },
      },
    });

    let totalCurrent = new Prisma.Decimal(0);
    let totalPrevious = new Prisma.Decimal(0);

    const byProvider = providers.map((p) => {
      const currentSnap = p.snapshots.find((s) => s.month === cur);
      const prevSnap = prev ? p.snapshots.find((s) => s.month === prev) : null;
      const currentAmt = currentSnap?.amountUsd ?? new Prisma.Decimal(0);
      const prevAmt = prevSnap?.amountUsd ?? new Prisma.Decimal(0);

      totalCurrent = totalCurrent.add(currentAmt);
      totalPrevious = totalPrevious.add(prevAmt);

      const curN = Number(currentAmt);
      const prevN = Number(prevAmt);
      const deltaPercent = prevN > 0
        ? Math.round(((curN - prevN) / prevN) * 10000) / 100
        : 0;

      const sparkline = range
        .slice()
        .reverse()
        .map((m) => {
          const s = p.snapshots.find((snap) => snap.month === m);
          return s ? Number(s.amountUsd) : 0;
        });

      return {
        slug: p.slug,
        name: p.name,
        color: p.color,
        amountUsd: curN,
        previousAmountUsd: prevN,
        deltaPercent,
        sparkline,
      };
    });

    const totalCurrentN = Number(totalCurrent);
    const totalPreviousN = Number(totalPrevious);

    return {
      month: cur,
      totalUsd: totalCurrentN,
      previousTotalUsd: totalPreviousN,
      deltaPercent: totalPreviousN > 0
        ? Math.round(((totalCurrentN - totalPreviousN) / totalPreviousN) * 10000) / 100
        : 0,
      providers: byProvider,
    };
  }

  async getHistory(months: number) {
    const range = monthsAgo(months);

    const snapshots = await this.prisma.costSnapshot.findMany({
      where: { month: { in: range } },
      include: { provider: { select: { slug: true, name: true, color: true } } },
      orderBy: { month: 'asc' },
    });

    const grouped: Record<string, Record<string, number>> = {};
    for (const s of snapshots) {
      if (!grouped[s.month]) grouped[s.month] = {};
      grouped[s.month][s.provider.slug] = Number(s.amountUsd);
    }

    return {
      months: range
        .slice()
        .reverse()
        .map((m) => ({
          month: m,
          totalUsd: Object.values(grouped[m] ?? {}).reduce((a, b) => a + b, 0),
          byProvider: grouped[m] ?? {},
        })),
    };
  }

  async getProviderDetail(slug: string, month: string) {
    const provider = await this.prisma.costProvider.findUnique({ where: { slug } });
    if (!provider) throw new NotFoundException(`Proveedor '${slug}' no encontrado`);

    const snapshot = await this.prisma.costSnapshot.findUnique({
      where: { providerId_month: { providerId: provider.id, month } },
    });

    return {
      slug: provider.slug,
      name: provider.name,
      color: provider.color,
      month,
      amountUsd: snapshot ? Number(snapshot.amountUsd) : 0,
      breakdown: (snapshot?.breakdown as Record<string, number>) ?? {},
      source: snapshot?.source ?? 'MANUAL',
    };
  }

  // Consumo de IA (Gemini y Groq) del mes agrupado por función, proveedor y modelo:
  // `metadata.feature` lo pone cada ayuda al registrar el uso (ai-assist, ai-variants,
  // ai-scan…); los eventos del chat de Orbi no traen feature y se agrupan como
  // 'orbi-chat'. El costo sale del estimatedCostUsd del evento si lo trae y, si no, de
  // tokens × precio de PRICING (la misma tabla del adapter interno).
  async getAiUsageByFeature(month: string) {
    const start = new Date(`${month}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    const events = await this.prisma.usageEvent.findMany({
      where: {
        timestamp: { gte: start, lt: end },
        category: { in: ['prompt_tokens', 'completion_tokens'] },
        provider: { slug: { in: ['gemini', 'groq'] } },
      },
      select: {
        category: true,
        quantity: true,
        estimatedCostUsd: true,
        metadata: true,
        provider: { select: { slug: true } },
      },
    });

    type Fila = { feature: string; provider: string; model: string | null; requests: number; promptTokens: number; completionTokens: number; costUsd: number };
    const filas = new Map<string, Fila>();
    for (const e of events) {
      const meta = (e.metadata && typeof e.metadata === 'object' && !Array.isArray(e.metadata) ? e.metadata : {}) as Record<string, unknown>;
      const feature = typeof meta.feature === 'string' ? meta.feature : 'orbi-chat';
      const model = typeof meta.model === 'string' ? meta.model : null;
      const provider = e.provider.slug;
      const clave = `${feature}|${provider}|${model ?? ''}`;
      const fila = filas.get(clave) ?? { feature, provider, model, requests: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 };
      const cantidad = Number(e.quantity);
      if (e.category === 'prompt_tokens') {
        // Una llamada registra un evento de entrada y uno de salida: se cuenta por las de entrada.
        fila.requests += 1;
        fila.promptTokens += cantidad;
      } else {
        fila.completionTokens += cantidad;
      }
      fila.costUsd += e.estimatedCostUsd != null ? Number(e.estimatedCostUsd) : cantidad * (PRICING[provider]?.[e.category] ?? 0);
      filas.set(clave, fila);
    }

    const rows = [...filas.values()]
      .map((f) => ({ ...f, costUsd: Math.round(f.costUsd * 1_000_000) / 1_000_000 }))
      .sort((a, b) => b.costUsd - a.costUsd);
    return { month, rows, totalUsd: Math.round(rows.reduce((s, r) => s + r.costUsd, 0) * 1_000_000) / 1_000_000 };
  }

  // Top de negocios por consumo. El costo sale del estimatedCostUsd del evento y, si no lo
  // trae (los de tokens no lo traen), de cantidad × PRICING. Además de lo medido en
  // usage_events se suma la huella en la base (productos, clientes, pedidos): un negocio sin
  // IA ni emails igual ocupa datos, y así deja de aparecer todo en cero.
  async getByBusiness(month: string) {
    const start = new Date(`${month}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    const [events, businesses, products, customers, orders] = await Promise.all([
      this.prisma.usageEvent.findMany({
        where: { timestamp: { gte: start, lt: end }, businessId: { not: null } },
        select: {
          businessId: true,
          category: true,
          quantity: true,
          estimatedCostUsd: true,
          provider: { select: { slug: true } },
        },
      }),
      this.prisma.business.findMany({ select: { id: true, name: true } }),
      this.prisma.product.groupBy({ by: ['businessId'], _count: { _all: true } }),
      this.prisma.customer.groupBy({ by: ['businessId'], _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ['businessId'], _count: { _all: true } }),
    ]);

    type Fila = {
      total: number;
      byCategory: Record<string, number>;
      aiRequests: number;
      aiTokens: number;
      emails: number;
    };
    const byBiz = new Map<string, Fila>();
    for (const e of events) {
      const bId = e.businessId!;
      const fila = byBiz.get(bId) ?? { total: 0, byCategory: {}, aiRequests: 0, aiTokens: 0, emails: 0 };
      const cantidad = Number(e.quantity);
      const cost = e.estimatedCostUsd != null
        ? Number(e.estimatedCostUsd)
        : cantidad * (PRICING[e.provider.slug]?.[e.category] ?? 0);
      fila.total += cost;
      const key = `${e.provider.slug}:${e.category}`;
      fila.byCategory[key] = (fila.byCategory[key] ?? 0) + cost;
      if (e.category === 'prompt_tokens') fila.aiRequests += 1;
      if (e.category === 'prompt_tokens' || e.category === 'completion_tokens') fila.aiTokens += cantidad;
      if (e.category === 'email_sent') fila.emails += cantidad;
      byBiz.set(bId, fila);
    }

    const conteo = (rows: { businessId: string; _count: { _all: number } }[]) =>
      new Map(rows.map((r) => [r.businessId, r._count._all]));
    const nProducts = conteo(products);
    const nCustomers = conteo(customers);
    const nOrders = conteo(orders);

    const filas = businesses.map((b) => {
      const uso = byBiz.get(b.id) ?? { total: 0, byCategory: {}, aiRequests: 0, aiTokens: 0, emails: 0 };
      const productos = nProducts.get(b.id) ?? 0;
      const clientes = nCustomers.get(b.id) ?? 0;
      const pedidos = nOrders.get(b.id) ?? 0;
      return { businessId: b.id, businessName: b.name, ...uso, productos, clientes, pedidos, huella: productos + clientes + pedidos };
    });
    filas.sort((a, b) => b.total - a.total || b.huella - a.huella);

    const grandTotal = filas.reduce((s, r) => s + r.total, 0) || 1;

    return {
      month,
      businesses: filas.slice(0, 50).map((row) => ({
        businessId: row.businessId,
        businessName: row.businessName,
        totalEstimatedUsd: row.total,
        byCategory: row.byCategory,
        pctOfTotal: Math.round((row.total / grandTotal) * 1000) / 10,
        aiRequests: row.aiRequests,
        aiTokens: row.aiTokens,
        emails: row.emails,
        productos: row.productos,
        clientes: row.clientes,
        pedidos: row.pedidos,
      })),
    };
  }

  async getLimits() {
    const limits = await this.prisma.costLimit.findMany({
      where: { active: true },
      include: { provider: { select: { slug: true, name: true, color: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const cur = currentMonth();
    const snapshots = await this.prisma.costSnapshot.findMany({
      where: { month: cur },
    });
    const snapByProvider = new Map(snapshots.map((s) => [s.providerId, Number(s.amountUsd)]));

    return limits.map((l) => {
      const currentValue = l.providerId ? (snapByProvider.get(l.providerId) ?? 0) : 0;
      const threshold = Number(l.threshold);
      return {
        id: l.id,
        provider: l.provider ? { slug: l.provider.slug, name: l.provider.name, color: l.provider.color } : null,
        type: l.type,
        category: l.category,
        threshold,
        unit: l.unit,
        alertAtPercent: l.alertAtPercent,
        currentValue,
        percent: threshold > 0 ? Math.round((currentValue / threshold) * 1000) / 10 : 0,
        active: l.active,
      };
    });
  }

  async createLimit(dto: CreateLimitDto) {
    let providerId: string | null = null;
    if (dto.providerSlug) {
      const provider = await this.prisma.costProvider.findUnique({ where: { slug: dto.providerSlug } });
      if (!provider) throw new NotFoundException(`Proveedor '${dto.providerSlug}' no encontrado`);
      providerId = provider.id;
    }

    return this.prisma.costLimit.create({
      data: {
        providerId,
        type: dto.type as 'SPEND' | 'USAGE',
        category: dto.category ?? null,
        threshold: dto.threshold,
        unit: dto.unit,
        alertAtPercent: dto.alertAtPercent,
      },
    });
  }

  async deleteLimit(id: string) {
    await this.prisma.costLimit.delete({ where: { id } });
    return { ok: true };
  }

  async getAlerts(month: string) {
    const start = new Date(`${month}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    const alerts = await this.prisma.costAlert.findMany({
      where: { notifiedAt: { gte: start, lt: end } },
      include: {
        limit: {
          include: { provider: { select: { slug: true, name: true, color: true } } },
        },
      },
      orderBy: { notifiedAt: 'desc' },
    });

    return alerts.map((a) => ({
      id: a.id,
      limit: {
        id: a.limit.id,
        provider: a.limit.provider ? { name: a.limit.provider.name, color: a.limit.provider.color } : null,
        type: a.limit.type,
        threshold: Number(a.limit.threshold),
        unit: a.limit.unit,
      },
      percentReached: a.percentReached,
      currentValue: Number(a.currentValue),
      notifiedAt: a.notifiedAt.toISOString(),
      acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
    }));
  }

  async acknowledgeAlert(id: string) {
    await this.prisma.costAlert.update({
      where: { id },
      data: { acknowledgedAt: new Date() },
    });
    return { ok: true };
  }

  async createManualSnapshot(dto: CreateSnapshotDto) {
    const provider = await this.prisma.costProvider.findUnique({
      where: { slug: dto.providerSlug },
    });
    if (!provider) throw new NotFoundException(`Proveedor '${dto.providerSlug}' no encontrado`);

    return this.prisma.costSnapshot.upsert({
      where: { providerId_month: { providerId: provider.id, month: dto.month } },
      update: {
        amountUsd: dto.amountUsd,
        breakdown: dto.breakdown ?? {},
        source: 'MANUAL',
        fetchedAt: new Date(),
      },
      create: {
        providerId: provider.id,
        month: dto.month,
        amountUsd: dto.amountUsd,
        breakdown: dto.breakdown ?? {},
        source: 'MANUAL',
      },
    });
  }

  async getUsage() {
    const result: Record<string, { slug: string; items: { category: string; value: number; unit: string; limit?: number }[] }> = {};

    for (const adapter of this.adapters) {
      if (typeof adapter.fetchCurrentUsage === 'function') {
        try {
          const usage = await adapter.fetchCurrentUsage();
          if (usage.items.length > 0) {
            result[adapter.slug] = { slug: adapter.slug, items: usage.items };
          }
        } catch (err) {
          this.logger.warn(`Error obteniendo usage de ${adapter.slug}: ${err}`);
        }
      }
    }

    // Gemini, Groq, Serper y Tavily: se arman con los usage_events propios.
    try {
      const start = new Date();
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);

      const targetProviders = await this.prisma.costProvider.findMany({
        where: { slug: { in: ['gemini', 'groq', 'serper', 'tavily'] } },
        select: { id: true, slug: true },
      });

      if (targetProviders.length > 0) {
        const rows = await this.prisma.usageEvent.groupBy({
          by: ['providerId', 'category'],
          where: {
            providerId: { in: targetProviders.map((p) => p.id) },
            timestamp: { gte: start },
          },
          _sum: { quantity: true },
          _count: { _all: true },
        });

        // Gemini
        const geminiId = targetProviders.find((p) => p.slug === 'gemini')?.id;
        if (geminiId) {
          const geminiRows = rows.filter((r) => r.providerId === geminiId);
          if (geminiRows.length > 0) {
            const prompt = geminiRows.find((r) => r.category === 'prompt_tokens');
            const completion = geminiRows.find((r) => r.category === 'completion_tokens');
            result['gemini'] = {
              slug: 'gemini',
              items: [
                { category: 'Requests (mes)', value: prompt?._count._all ?? 0, unit: 'requests' },
                { category: 'Tokens de entrada (mes)', value: Number(prompt?._sum.quantity ?? 0), unit: 'tokens' },
                { category: 'Tokens de salida (mes)', value: Number(completion?._sum.quantity ?? 0), unit: 'tokens' },
              ],
            };
          }
        }

        // Groq
        const groqId = targetProviders.find((p) => p.slug === 'groq')?.id;
        if (groqId) {
          const groqRows = rows.filter((r) => r.providerId === groqId);
          if (groqRows.length > 0) {
            const prompt = groqRows.find((r) => r.category === 'prompt_tokens');
            const completion = groqRows.find((r) => r.category === 'completion_tokens');
            result['groq'] = {
              slug: 'groq',
              items: [
                { category: 'Requests (mes)', value: prompt?._count._all ?? 0, unit: 'requests' },
                { category: 'Tokens de entrada (mes)', value: Number(prompt?._sum.quantity ?? 0), unit: 'tokens' },
                { category: 'Tokens de salida (mes)', value: Number(completion?._sum.quantity ?? 0), unit: 'tokens' },
              ],
            };
          }
        }

        // Serper (Google Images)
        const serperId = targetProviders.find((p) => p.slug === 'serper')?.id;
        if (serperId) {
          const serperRows = rows.filter((r) => r.providerId === serperId);
          const queries = serperRows.find((r) => r.category === 'search_query');
          const errors = serperRows.filter((r) => r.category === 'search_error' || r.category === 'quota_exceeded');
          const errorCount = errors.reduce((acc, r) => acc + (r._count._all ?? 0), 0);
          const queryCount = Number(queries?._sum.quantity ?? 0);

          if (queryCount > 0 || errorCount > 0) {
            result['serper'] = {
              slug: 'serper',
              items: [
                { category: 'Búsquedas de imágenes (mes)', value: queryCount, unit: 'queries', limit: 2500 },
                ...(errorCount > 0 ? [{ category: 'Fallos / Quota', value: errorCount, unit: 'errores' }] : []),
              ],
            };
          }
        }

        // Tavily Search
        const tavilyId = targetProviders.find((p) => p.slug === 'tavily')?.id;
        if (tavilyId) {
          const tavilyRows = rows.filter((r) => r.providerId === tavilyId);
          const queries = tavilyRows.find((r) => r.category === 'search_query');
          const errors = tavilyRows.filter((r) => r.category === 'search_error' || r.category === 'quota_exceeded');
          const errorCount = errors.reduce((acc, r) => acc + (r._count._all ?? 0), 0);
          const queryCount = Number(queries?._sum.quantity ?? 0);

          if (queryCount > 0 || errorCount > 0) {
            result['tavily'] = {
              slug: 'tavily',
              items: [
                { category: 'Búsquedas web (mes)', value: queryCount, unit: 'queries', limit: 1000 },
                ...(errorCount > 0 ? [{ category: 'Fallos / Quota', value: errorCount, unit: 'errores' }] : []),
              ],
            };
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Error obteniendo usage de proveedores internos: ${err}`);
    }

    // Resend: la API key es solo de envío (no puede leer cuota), así que se arma con email_logs.
    // El plan gratis corta a las 00:00 UTC (100/día) y el 1° de cada mes (3.000/mes).
    try {
      const now = new Date();
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const [monthRows, sentToday] = await Promise.all([
        this.prisma.emailLog.groupBy({
          by: ['status'],
          where: { createdAt: { gte: startOfMonth } },
          _count: { _all: true },
        }),
        this.prisma.emailLog.count({ where: { status: 'SENT', createdAt: { gte: startOfDay } } }),
      ]);
      const sentMonth = monthRows.find((r) => r.status === 'SENT')?._count._all ?? 0;
      const failedMonth = monthRows.find((r) => r.status === 'FAILED')?._count._all ?? 0;
      if (sentMonth > 0 || failedMonth > 0) {
        result['resend'] = {
          slug: 'resend',
          items: [
            { category: 'Emails enviados (hoy)', value: sentToday, unit: 'emails', limit: 100 },
            { category: 'Emails enviados (mes)', value: sentMonth, unit: 'emails', limit: 3000 },
            ...(failedMonth > 0 ? [{ category: 'Envíos fallidos (mes)', value: failedMonth, unit: 'emails' }] : []),
          ],
        };
      }
    } catch (err) {
      this.logger.warn(`Error obteniendo usage de resend: ${err}`);
    }

    return { providers: result, updatedAt: new Date().toISOString() };
  }

  async reportQuotaExceeded(providerSlug: string, reason: string): Promise<void> {
    try {
      const provider = await this.prisma.costProvider.findUnique({
        where: { slug: providerSlug },
        include: { limits: true },
      });
      if (!provider) return;

      let limit = provider.limits.find((l) => l.type === 'USAGE');
      if (!limit) {
        limit = await this.prisma.costLimit.create({
          data: {
            providerId: provider.id,
            type: 'USAGE',
            category: 'search_query',
            threshold: providerSlug === 'serper' ? 2500 : 1000,
            unit: 'queries',
            alertAtPercent: [80, 100],
          },
        });
      }

      const existingAlert = await this.prisma.costAlert.findFirst({
        where: { limitId: limit.id, acknowledgedAt: null },
      });

      if (!existingAlert) {
        await this.prisma.costAlert.create({
          data: {
            limitId: limit.id,
            percentReached: 100,
            currentValue: limit.threshold,
            notifiedAt: new Date(),
          },
        });
        this.logger.warn(`Alerta de cuota superada registrada para ${providerSlug}: ${reason}`);
      }
    } catch (err) {
      this.logger.error(`Error reportando cuota superada para ${providerSlug}: ${err}`);
    }
  }

  async syncAll() {
    if (!this.adapters.length) {
      return {
        synced: [] as string[],
        errors: [] as string[],
        message: 'Sin adapters configurados',
      };
    }

    const month = currentMonth();
    const synced: string[] = [];
    const errors: string[] = [];

    for (const adapter of this.adapters) {
      try {
        const result = await adapter.fetchMonthlyCost(month);
        if (result.amountUsd === 0 && Object.keys(result.breakdown).length === 0) {
          continue;
        }

        const provider = await this.prisma.costProvider.findUnique({
          where: { slug: adapter.slug },
        });
        if (!provider) {
          this.logger.warn(`Adapter ${adapter.slug}: no existe el provider en la DB`);
          errors.push(`${adapter.slug}: provider no encontrado`);
          continue;
        }

        await this.prisma.costSnapshot.upsert({
          where: { providerId_month: { providerId: provider.id, month } },
          update: {
            amountUsd: result.amountUsd,
            breakdown: result.breakdown,
            source: 'API',
            fetchedAt: new Date(),
          },
          create: {
            providerId: provider.id,
            month,
            amountUsd: result.amountUsd,
            breakdown: result.breakdown,
            source: 'API',
          },
        });

        await this.prisma.costProvider.update({
          where: { id: provider.id },
          data: { apiType: 'AUTO' },
        });

        synced.push(adapter.slug);
        this.logger.log(`Sync ${adapter.slug}: $${result.amountUsd} para ${month}`);
      } catch (err) {
        this.logger.error(`Error sincronizando ${adapter.slug}: ${err}`);
        errors.push(`${adapter.slug}: ${err}`);
      }
    }

    // Internal adapters: aggregate usage_events for gemini/groq/resend
    if (this.internalAdapter) {
      try {
        const internalResults = await this.internalAdapter.syncAllInternal(month);
        for (const [slug, result] of internalResults) {
          const provider = await this.prisma.costProvider.findUnique({ where: { slug } });
          if (!provider) continue;

          await this.prisma.costSnapshot.upsert({
            where: { providerId_month: { providerId: provider.id, month } },
            update: {
              amountUsd: result.amountUsd,
              breakdown: result.breakdown,
              source: 'API',
              fetchedAt: new Date(),
            },
            create: {
              providerId: provider.id,
              month,
              amountUsd: result.amountUsd,
              breakdown: result.breakdown,
              source: 'API',
            },
          });
          synced.push(slug);
        }
      } catch (err) {
        this.logger.error(`Error sincronizando adapters internos: ${err}`);
        errors.push(`internal: ${err}`);
      }
    }

    return {
      synced,
      errors,
      message: synced.length
        ? `Sincronizados: ${synced.join(', ')}`
        : 'Ningún adapter devolvió datos',
    };
  }
}
