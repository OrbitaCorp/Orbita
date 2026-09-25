export interface CostBreakdown {
  amountUsd: number;
  breakdown: Record<string, number>;
}

export interface UsageItem {
  category: string;
  value: number;
  unit: string;
  limit?: number;
}

export interface CostAdapter {
  readonly slug: string;

  fetchMonthlyCost(month: string): Promise<CostBreakdown>;

  fetchCurrentUsage?(): Promise<{ items: UsageItem[] }>;
}
