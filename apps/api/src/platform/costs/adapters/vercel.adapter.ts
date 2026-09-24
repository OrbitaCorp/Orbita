import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CostAdapter, CostBreakdown } from './adapter.interface';

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
}
