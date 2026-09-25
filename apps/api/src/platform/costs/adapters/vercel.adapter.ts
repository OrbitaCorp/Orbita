import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CostAdapter, CostBreakdown, UsageItem } from './adapter.interface';

const HOBBY_LIMITS: Record<string, { limit: number; unit: string }> = {
  'Deployments': { limit: 100, unit: 'deploys/día' },
  'Fast Data Transfer': { limit: 100, unit: 'GB' },
  'Edge Requests': { limit: 1_000_000, unit: 'requests' },
  'Function Invocations': { limit: 1_000_000, unit: 'invocations' },
  'Image Optimization': { limit: 5_000, unit: 'transforms' },
  'ISR Reads': { limit: 1_000_000, unit: 'reads' },
  'ISR Writes': { limit: 200_000, unit: 'writes' },
  'Blob Storage': { limit: 1, unit: 'GB' },
  'Web Analytics Events': { limit: 50_000, unit: 'events' },
};

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

    const deploys = await this.countDeploymentsThisMonth(token);
    if (deploys !== null) {
      items.push({
        category: 'Deployments (hoy)',
        value: deploys,
        unit: 'deploys',
        limit: HOBBY_LIMITS['Deployments'].limit,
      });
    }

    const consumption = await this.fetchBillingConsumption(token);
    for (const c of consumption) {
      items.push(c);
    }

    return { items };
  }

  private async countDeploymentsThisMonth(token: string): Promise<number | null> {
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
        const data = await res.json() as any;
        count += data.deployments?.length ?? 0;
        next = data.pagination?.next;
      } while (next);

      return count;
    } catch {
      return null;
    }
  }

  private async fetchBillingConsumption(token: string): Promise<UsageItem[]> {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;
    const to = now.toISOString();

    try {
      const res = await fetch(
        `https://api.vercel.com/v1/billing/charges?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&teamId=${this.teamId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return [];

      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);

      const consumed: Record<string, { qty: number; unit: string }> = {};
      for (const line of lines) {
        try {
          const charge = JSON.parse(line);
          if (charge.ConsumedQuantity && charge.ServiceName) {
            const svc = charge.ServiceName;
            if (!consumed[svc]) consumed[svc] = { qty: 0, unit: charge.ConsumedUnit ?? 'units' };
            consumed[svc].qty += charge.ConsumedQuantity;
          }
        } catch { /* skip */ }
      }

      return Object.entries(consumed).map(([svc, data]) => {
        const known = HOBBY_LIMITS[svc];
        return {
          category: svc,
          value: Math.round(data.qty * 100) / 100,
          unit: data.unit,
          limit: known?.limit,
        };
      });
    } catch {
      return [];
    }
  }
}
