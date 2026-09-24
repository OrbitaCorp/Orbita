import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CostAdapter, CostBreakdown, UsageItem } from './adapter.interface';

const SUPABASE_MGMT_BASE = 'https://api.supabase.com/v1';

@Injectable()
export class SupabaseCostAdapter implements CostAdapter {
  readonly slug = 'supabase';
  private readonly logger = new Logger(SupabaseCostAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get serviceRoleKey(): string | undefined {
    return this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
  }
  private get supabaseUrl(): string | undefined {
    return this.config.get<string>('SUPABASE_URL');
  }
  private get projectRef(): string | undefined {
    const url = this.supabaseUrl;
    if (!url) return undefined;
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    return match?.[1];
  }

  async fetchMonthlyCost(_month: string): Promise<CostBreakdown> {
    const ref = this.projectRef;
    const key = this.serviceRoleKey;
    if (!ref || !key) {
      this.logger.warn('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados — skip');
      return { amountUsd: 0, breakdown: {} };
    }

    const breakdown: Record<string, number> = {};

    // Supabase Management API requires a personal access token or OAuth,
    // not a service role key. The service role key only works for the Data API.
    // We use it here to at least estimate based on addon pricing.
    const addons = await this.fetchAddons(ref, key);
    if (addons) {
      for (const addon of addons) {
        breakdown[addon.type] = addon.price;
      }
    }

    // Disk usage estimate (free plan = 500MB included, $0.125/GB after)
    const disk = await this.fetchDiskUsage(ref, key);
    if (disk) {
      const freeGb = 0.5;
      const usedGb = disk / (1024 ** 3);
      const overageGb = Math.max(0, usedGb - freeGb);
      if (overageGb > 0) {
        breakdown['Database Storage Overage'] = Math.round(overageGb * 0.125 * 100) / 100;
      }
    }

    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    this.logger.log(`Supabase ${_month}: $${total.toFixed(2)}`);

    return {
      amountUsd: Math.round(total * 100) / 100,
      breakdown,
    };
  }

  async fetchCurrentUsage(): Promise<{ items: UsageItem[] }> {
    const ref = this.projectRef;
    const key = this.serviceRoleKey;
    if (!ref || !key) return { items: [] };

    const items: UsageItem[] = [];

    const disk = await this.fetchDiskUsage(ref, key);
    if (disk !== null) {
      items.push({
        category: 'Database',
        value: Math.round(disk / (1024 * 1024)),
        unit: 'MB',
        limit: 500,
      });
    }

    return { items };
  }

  private async fetchAddons(ref: string, key: string): Promise<{ type: string; price: number }[] | null> {
    try {
      const res = await fetch(`${SUPABASE_MGMT_BASE}/projects/${ref}/billing/addons`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        this.logger.debug(`Supabase addons API ${res.status} — probablemente necesita PAT, no service role key`);
        return null;
      }
      const data = await res.json() as any;
      return (data.selected_addons ?? []).map((a: any) => ({
        type: a.type ?? 'addon',
        price: a.variant?.price?.amount ?? 0,
      }));
    } catch (err) {
      this.logger.warn(`Error fetching Supabase addons: ${err}`);
      return null;
    }
  }

  private async fetchDiskUsage(ref: string, key: string): Promise<number | null> {
    try {
      const res = await fetch(`${SUPABASE_MGMT_BASE}/projects/${ref}/config/disk/util`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return null;
      const data = await res.json() as any;
      return data.metrics?.fs_used_bytes ?? null;
    } catch {
      return null;
    }
  }
}
