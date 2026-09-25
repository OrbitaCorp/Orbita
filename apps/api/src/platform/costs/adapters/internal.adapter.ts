import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CostAdapter, CostBreakdown } from './adapter.interface';

const PRICING: Record<string, Record<string, number>> = {
  gemini: {
    // gemini-3.6-flash: $0.10/1M input, $0.40/1M output (blended ~$0.25/1M)
    'prompt_tokens': 0.10 / 1_000_000,
    'completion_tokens': 0.40 / 1_000_000,
  },
  groq: {
    // llama-3.3-70b: $0.59/1M input, $0.79/1M output
    'prompt_tokens': 0.59 / 1_000_000,
    'completion_tokens': 0.79 / 1_000_000,
  },
  resend: {
    // Resend: free tier 100/day, $0.001/email after (rough estimate)
    'email_sent': 0,
  },
};

@Injectable()
export class InternalCostAdapter implements CostAdapter {
  readonly slug = '__internal__';
  private readonly logger = new Logger(InternalCostAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async fetchMonthlyCostForSlug(slug: string, month: string): Promise<CostBreakdown> {
    const provider = await this.prisma.costProvider.findUnique({ where: { slug } });
    if (!provider) return { amountUsd: 0, breakdown: {} };

    const start = new Date(`${month}-01`);
    const [y, m] = month.split('-').map(Number);
    const end = new Date(Date.UTC(y, m, 1));

    const events = await this.prisma.usageEvent.findMany({
      where: {
        providerId: provider.id,
        timestamp: { gte: start, lt: end },
      },
      select: { category: true, quantity: true, estimatedCostUsd: true },
    });

    let total = 0;
    const breakdown: Record<string, number> = {};

    const prices = PRICING[slug] ?? {};

    for (const e of events) {
      const cost = e.estimatedCostUsd
        ? Number(e.estimatedCostUsd)
        : Number(e.quantity) * (prices[e.category] ?? 0);
      total += cost;
      breakdown[e.category] = (breakdown[e.category] ?? 0) + cost;
    }

    this.logger.log(`Internal ${slug} ${month}: $${total.toFixed(6)} (${events.length} events)`);
    return {
      amountUsd: Math.round(total * 10000) / 10000,
      breakdown,
    };
  }

  async fetchMonthlyCost(_month: string): Promise<CostBreakdown> {
    return { amountUsd: 0, breakdown: {} };
  }

  async syncAllInternal(month: string): Promise<Map<string, CostBreakdown>> {
    const results = new Map<string, CostBreakdown>();
    for (const slug of Object.keys(PRICING)) {
      const result = await this.fetchMonthlyCostForSlug(slug, month);
      if (result.amountUsd > 0 || Object.keys(result.breakdown).length > 0) {
        results.set(slug, result);
      }
    }
    return results;
  }
}
