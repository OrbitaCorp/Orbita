import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLimitDto } from './dto/create-limit.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { CostAdapter } from './adapters/adapter.interface';
import { InternalCostAdapter } from './adapters/internal.adapter';
import { COST_ADAPTERS } from './costs.constants';

const DEFAULT_PROVIDERS = [
  { slug: 'gcloud', name: 'Google Cloud', color: '#4285f4', apiType: 'MANUAL' as const },
  { slug: 'cloudflare', name: 'Cloudflare', color: '#f6821f', apiType: 'MANUAL' as const },
  { slug: 'supabase', name: 'Supabase', color: '#3ecf8e', apiType: 'MANUAL' as const },
  { slug: 'gemini', name: 'Gemini', color: '#886ef8', apiType: 'MANUAL' as const },
  { slug: 'vercel', name: 'Vercel', color: '#000000', apiType: 'MANUAL' as const },
  { slug: 'resend', name: 'Resend', color: '#111111', apiType: 'MANUAL' as const },
  { slug: 'groq', name: 'Groq', color: '#f55036', apiType: 'MANUAL' as const },
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
      await this.prisma.costProvider.upsert({
        where: { slug: p.slug },
        update: {},
        create: { slug: p.slug, name: p.name, color: p.color, apiType: p.apiType },
      });
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

  async getByBusiness(month: string) {
    const start = new Date(`${month}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    const events = await this.prisma.usageEvent.findMany({
      where: { timestamp: { gte: start, lt: end }, businessId: { not: null } },
      select: {
        businessId: true,
        category: true,
        estimatedCostUsd: true,
        provider: { select: { slug: true } },
      },
    });

    const byBiz: Record<string, { total: number; byCategory: Record<string, number> }> = {};
    for (const e of events) {
      const bId = e.businessId!;
      if (!byBiz[bId]) byBiz[bId] = { total: 0, byCategory: {} };
      const cost = Number(e.estimatedCostUsd ?? 0);
      byBiz[bId].total += cost;
      const key = `${e.provider.slug}:${e.category}`;
      byBiz[bId].byCategory[key] = (byBiz[bId].byCategory[key] ?? 0) + cost;
    }

    const sorted = Object.entries(byBiz)
      .map(([businessId, data]) => ({ businessId, ...data }))
      .sort((a, b) => b.total - a.total);

    const grandTotal = sorted.reduce((s, r) => s + r.total, 0) || 1;

    const businessIds = sorted.slice(0, 50).map((b) => b.businessId);
    const businesses = await this.prisma.business.findMany({
      where: { id: { in: businessIds } },
      select: { id: true, name: true },
    });
    const bizMap = new Map(businesses.map((b) => [b.id, b]));

    return {
      month,
      businesses: sorted.slice(0, 50).map((row) => ({
        businessId: row.businessId,
        businessName: bizMap.get(row.businessId)?.name ?? row.businessId,
        totalEstimatedUsd: row.total,
        byCategory: row.byCategory,
        pctOfTotal: Math.round((row.total / grandTotal) * 1000) / 10,
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
