import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CostAdapter, CostBreakdown, UsageItem } from './adapter.interface';

interface UsageDayRequests {
  request_hit_count: number;
  request_miss_count: number;
  bandwidth_outgoing_bytes: number;
  bandwidth_incoming_bytes: number;
  function_execution_successful_gb_hours: number;
  function_execution_error_gb_hours: number;
  function_execution_timeout_gb_hours: number;
  function_invocation_successful_count: number;
  function_invocation_error_count: number;
  function_invocation_timeout_count: number;
}

interface UsageDayBuilds {
  build_completed_count: number;
  build_failed_count: number;
  build_build_seconds: number;
}

const HOBBY_LIMITS = {
  edgeRequests:         { limit: 1_000_000, unit: 'requests' },
  functionInvocations:  { limit: 1_000_000, unit: 'invocaciones' },
  fastDataTransfer:     { limit: 100,       unit: 'GB' },
  fastOriginTransfer:   { limit: 10,        unit: 'GB' },
  fluidMemory:          { limit: 1_000,     unit: 'GB-Hrs' },
  buildMinutes:         { limit: 6_000,     unit: 'min' },
  deploymentsPerDay:    { limit: 100,       unit: 'deploys/día' },
} as const;

@Injectable()
export class VercelCostAdapter implements CostAdapter {
  readonly slug = 'vercel';
  private readonly logger = new Logger(VercelCostAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get token(): string | undefined {
    return this.config.get<string>('VERCEL_TOKEN');
  }
  private get teamId(): string {
    return this.config.get<string>('VERCEL_TEAM_ID') ?? 'team_GDb8FqCjzYMRIVrvwuGIgG0S';
  }

  async fetchMonthlyCost(month: string): Promise<CostBreakdown> {
    const token = this.token;
    if (!token) {
      this.logger.warn('VERCEL_TOKEN no configurado — skip');
      return { amountUsd: 0, breakdown: {} };
    }

    const from = `${month}-01T00:00:00.000Z`;
    const [y, m] = month.split('-').map(Number);
    const toDate = new Date(Date.UTC(y, m, 1));
    const to = toDate.toISOString();

    const url = `https://api.vercel.com/v1/billing/charges?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&teamId=${this.teamId}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        this.logger.warn(`Vercel billing API respondió ${res.status}`);
        return { amountUsd: 0, breakdown: {} };
      }

      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);

      let total = 0;
      const breakdown: Record<string, number> = {};

      for (const line of lines) {
        try {
          const charge = JSON.parse(line);
          const cost = charge.BilledCost ?? charge.EffectiveCost ?? 0;
          total += cost;
          const service = charge.ServiceName ?? 'other';
          breakdown[service] = (breakdown[service] ?? 0) + cost;
        } catch {
          // skip malformed lines
        }
      }

      this.logger.log(`Vercel ${month}: $${total.toFixed(2)} (${lines.length} line items)`);
      return {
        amountUsd: Math.round(total * 100) / 100,
        breakdown,
      };
    } catch (err) {
      this.logger.error(`Error fetching Vercel billing: ${err}`);
      return { amountUsd: 0, breakdown: {} };
    }
  }

  async fetchCurrentUsage(): Promise<{ items: UsageItem[] }> {
    const token = this.token;
    if (!token) return { items: [] };

    const items: UsageItem[] = [];

    const [requestsData, buildsData, deploysToday] = await Promise.all([
      this.fetchUsageType<UsageDayRequests>(token, 'requests'),
      this.fetchUsageType<UsageDayBuilds>(token, 'builds'),
      this.countDeploymentsToday(token),
    ]);

    if (requestsData) {
      const edgeReqs = requestsData.reduce(
        (sum, d) => sum + (d.request_hit_count ?? 0) + (d.request_miss_count ?? 0), 0,
      );
      items.push({
        category: 'Edge Requests',
        value: edgeReqs,
        unit: HOBBY_LIMITS.edgeRequests.unit,
        limit: HOBBY_LIMITS.edgeRequests.limit,
      });

      const fnInvocations = requestsData.reduce(
        (sum, d) =>
          sum +
          (d.function_invocation_successful_count ?? 0) +
          (d.function_invocation_error_count ?? 0) +
          (d.function_invocation_timeout_count ?? 0),
        0,
      );
      items.push({
        category: 'Function Invocations',
        value: fnInvocations,
        unit: HOBBY_LIMITS.functionInvocations.unit,
        limit: HOBBY_LIMITS.functionInvocations.limit,
      });

      const bandwidthOutGB = requestsData.reduce(
        (sum, d) => sum + (d.bandwidth_outgoing_bytes ?? 0), 0,
      ) / (1024 ** 3);
      items.push({
        category: 'Fast Data Transfer',
        value: Math.round(bandwidthOutGB * 100) / 100,
        unit: HOBBY_LIMITS.fastDataTransfer.unit,
        limit: HOBBY_LIMITS.fastDataTransfer.limit,
      });

      const bandwidthInGB = requestsData.reduce(
        (sum, d) => sum + (d.bandwidth_incoming_bytes ?? 0), 0,
      ) / (1024 ** 3);
      items.push({
        category: 'Fast Origin Transfer',
        value: Math.round(bandwidthInGB * 100) / 100,
        unit: HOBBY_LIMITS.fastOriginTransfer.unit,
        limit: HOBBY_LIMITS.fastOriginTransfer.limit,
      });

      const gbHours = requestsData.reduce(
        (sum, d) =>
          sum +
          (d.function_execution_successful_gb_hours ?? 0) +
          (d.function_execution_error_gb_hours ?? 0) +
          (d.function_execution_timeout_gb_hours ?? 0),
        0,
      );
      items.push({
        category: 'Fluid Provisioned Memory',
        value: Math.round(gbHours * 100) / 100,
        unit: HOBBY_LIMITS.fluidMemory.unit,
        limit: HOBBY_LIMITS.fluidMemory.limit,
      });
    }

    if (buildsData) {
      const buildMin = buildsData.reduce(
        (sum, d) => sum + (d.build_build_seconds ?? 0), 0,
      ) / 60;
      items.push({
        category: 'Build Minutes',
        value: Math.round(buildMin * 10) / 10,
        unit: HOBBY_LIMITS.buildMinutes.unit,
        limit: HOBBY_LIMITS.buildMinutes.limit,
      });
    }

    if (deploysToday !== null) {
      items.push({
        category: 'Deployments (hoy)',
        value: deploysToday,
        unit: HOBBY_LIMITS.deploymentsPerDay.unit,
        limit: HOBBY_LIMITS.deploymentsPerDay.limit,
      });
    }

    return { items };
  }

  private async fetchUsageType<T>(token: string, type: string): Promise<T[] | null> {
    try {
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;
      const to = now.toISOString();

      const url =
        `https://api.vercel.com/v2/usage?type=${type}` +
        `&from=${encodeURIComponent(from)}` +
        `&to=${encodeURIComponent(to)}` +
        `&teamId=${this.teamId}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.logger.warn(`Vercel /v2/usage?type=${type} respondió ${res.status}`);
        return null;
      }
      const json = (await res.json()) as { data: T[] };
      return json.data ?? [];
    } catch (err) {
      this.logger.warn(`Error fetching Vercel usage type=${type}: ${err}`);
      return null;
    }
  }

  private async countDeploymentsToday(token: string): Promise<number | null> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const since = startOfDay.getTime();
      let count = 0;
      let next: number | undefined;

      do {
        const params = new URLSearchParams({
          teamId: this.teamId,
          since: String(since),
          limit: '100',
        });
        if (next) params.set('until', String(next));

        const res = await fetch(
          `https://api.vercel.com/v6/deployments?${params}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return null;
        const data = (await res.json()) as any;
        count += data.deployments?.length ?? 0;
        next = data.pagination?.next;
      } while (next);

      return count;
    } catch {
      return null;
    }
  }
}
