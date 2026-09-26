import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CostAdapter, CostBreakdown, UsageItem } from './adapter.interface';

const SUPABASE_MGMT_BASE = 'https://api.supabase.com/v1';

@Injectable()
export class SupabaseCostAdapter implements CostAdapter {
  readonly slug = 'supabase';
  private readonly logger = new Logger(SupabaseCostAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get pat(): string | undefined {
    return this.config.get<string>('SUPABASE_PAT');
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
    const token = this.pat;
    if (!ref || !token) {
      this.logger.warn('SUPABASE_URL o SUPABASE_PAT no configurados — skip');
      return { amountUsd: 0, breakdown: {} };
    }

    const breakdown: Record<string, number> = {};

    const addons = await this.fetchAddons(ref, token);
    if (addons) {
      for (const addon of addons) {
        breakdown[addon.type] = addon.price;
      }
    }

    const disk = await this.fetchDiskUsage(ref, token);
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
    const token = this.pat;
    if (!ref || !token) return { items: [] };

    const items: UsageItem[] = [];

    const disk = await this.fetchDiskUsage(ref, token);
    const diskConfig = await this.fetchDiskConfig(ref, token);
    if (disk !== null) {
      const usedMb = Math.round(disk / (1024 * 1024));
      const limitMb = diskConfig ? diskConfig * 1024 : 500;
      items.push({
        category: 'Database Size',
        value: usedMb,
        unit: 'MB',
        limit: limitMb,
      });
    }

    const storageBytes = await this.execSql<{ bytes: number | string }>(
      ref, token,
      `select coalesce(sum((metadata->>'size')::bigint), 0) as bytes from storage.objects`,
    );
    if (storageBytes) {
      const usedMb = Math.round(Number(storageBytes[0]?.bytes ?? 0) / (1024 * 1024));
      items.push({ category: 'File Storage', value: usedMb, unit: 'MB', limit: 1024 });
    }

    const mau = await this.execSql<{ count: number | string }>(
      ref, token,
      `select count(*) as count from auth.users where last_sign_in_at >= date_trunc('month', now())`,
    );
    if (mau) {
      items.push({
        category: 'Monthly Active Users',
        value: Number(mau[0]?.count ?? 0),
        unit: 'users',
        limit: 50_000,
      });
    }

    // Egress, Log Ingestion y Log Query del Free Plan no tienen endpoint público en la
    // Management API de Supabase (ni REST ni SQL vía pg-meta) — se omiten en vez de
    // mostrar un 0 falso que sugeriría consumo nulo.

    return { items };
  }

  private async fetchAddons(ref: string, key: string): Promise<{ type: string; price: number }[] | null> {
    try {
      const res = await fetch(`${SUPABASE_MGMT_BASE}/projects/${ref}/billing/addons`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        this.logger.debug(`Supabase addons API respondió ${res.status}`);
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

  private async fetchDiskConfig(ref: string, key: string): Promise<number | null> {
    try {
      const res = await fetch(`${SUPABASE_MGMT_BASE}/projects/${ref}/config/disk`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return null;
      const data = await res.json() as any;
      return data.attributes?.size_gb ?? null;
    } catch {
      return null;
    }
  }

  private async execSql<T = Record<string, unknown>>(
    ref: string, key: string, sql: string,
  ): Promise<T[] | null> {
    try {
      const res = await fetch(`${SUPABASE_MGMT_BASE}/projects/${ref}/database/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });
      if (!res.ok) {
        this.logger.debug(`Supabase database/query respondió ${res.status} para: ${sql}`);
        return null;
      }
      return await res.json() as T[];
    } catch (err) {
      this.logger.warn(`Error ejecutando SQL en Supabase: ${err}`);
      return null;
    }
  }
}
