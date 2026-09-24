import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CostAdapter, CostBreakdown, UsageItem } from './adapter.interface';

@Injectable()
export class CloudflareCostAdapter implements CostAdapter {
  readonly slug = 'cloudflare';
  private readonly logger = new Logger(CloudflareCostAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get apiToken(): string | undefined {
    return this.config.get<string>('CF_WORKERS_AI_API_TOKEN');
  }
  private get accountId(): string | undefined {
    return this.config.get<string>('R2_ACCOUNT_ID');
  }

  async fetchMonthlyCost(month: string): Promise<CostBreakdown> {
    const token = this.apiToken;
    const accountId = this.accountId;
    if (!token || !accountId) {
      this.logger.warn('CF_WORKERS_AI_API_TOKEN o R2_ACCOUNT_ID no configurados — skip');
      return { amountUsd: 0, breakdown: {} };
    }

    const breakdown: Record<string, number> = {};

    const r2 = await this.fetchR2Metrics(accountId, token);
    if (r2) breakdown['R2 Storage'] = r2;

    const workersAi = await this.fetchWorkersAiUsage(accountId, token, month);
    if (workersAi) breakdown['Workers AI'] = workersAi;

    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    this.logger.log(`Cloudflare ${month}: $${total.toFixed(4)} (R2=$${(r2 ?? 0).toFixed(4)}, AI=$${(workersAi ?? 0).toFixed(4)})`);

    return {
      amountUsd: Math.round(total * 10000) / 10000,
      breakdown,
    };
  }

  async fetchCurrentUsage(): Promise<{ items: UsageItem[] }> {
    const token = this.apiToken;
    const accountId = this.accountId;
    if (!token || !accountId) return { items: [] };

    const items: UsageItem[] = [];
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json() as any;
        items.push({
          category: 'R2 Buckets',
          value: data.result?.length ?? 0,
          unit: 'buckets',
        });
      }
    } catch { /* skip */ }

    return { items };
  }

  private async fetchR2Metrics(accountId: string, token: string): Promise<number | null> {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/metrics`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return null;
      const data = await res.json() as any;
      const stats = data.result;
      if (!stats) return null;

      let totalBytes = 0;
      for (const cls of ['standard', 'infrequentAccess']) {
        for (const state of ['published', 'uploaded']) {
          totalBytes += stats[cls]?.[state]?.payloadSize ?? 0;
          totalBytes += stats[cls]?.[state]?.metadataSize ?? 0;
        }
      }
      // R2 pricing: $0.015/GB/month for standard storage
      const gb = totalBytes / (1024 ** 3);
      return Math.round(gb * 0.015 * 10000) / 10000;
    } catch (err) {
      this.logger.warn(`Error fetching R2 metrics: ${err}`);
      return null;
    }
  }

  private async fetchWorkersAiUsage(accountId: string, token: string, month: string): Promise<number | null> {
    // Workers AI doesn't have a billing endpoint — we use GraphQL analytics
    const [y, m] = month.split('-').map(Number);
    const start = `${month}-01`;
    const endDate = new Date(Date.UTC(y, m, 1));
    const end = endDate.toISOString().slice(0, 10);

    try {
      const query = `{
        viewer {
          accounts(filter: {accountTag: "${accountId}"}) {
            aiGatewayGeneral(
              filter: { datetimeHour_geq: "${start}T00:00:00Z", datetimeHour_lt: "${end}T00:00:00Z" }
              limit: 1000
            ) {
              sum { totalTokens totalRequests }
            }
          }
        }
      }`;

      const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) return null;
      const data = await res.json() as any;
      const entries = data?.data?.viewer?.accounts?.[0]?.aiGatewayGeneral ?? [];

      let totalTokens = 0;
      for (const e of entries) {
        totalTokens += e.sum?.totalTokens ?? 0;
      }

      // Workers AI pricing varies by model; rough average ~$0.01/1K tokens
      // for text models. This is an estimate.
      return Math.round((totalTokens / 1000) * 0.01 * 10000) / 10000;
    } catch (err) {
      this.logger.warn(`Error fetching Workers AI usage: ${err}`);
      return null;
    }
  }
}
