import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { CostAdapter, CostBreakdown, UsageItem } from './adapter.interface';

const MONITORING_BASE = 'https://monitoring.googleapis.com/v3';

// Capa gratuita mensual de Cloud Run (facturación por request, región Tier 1).
const CLOUD_RUN_FREE = {
  requests: 2_000_000,
  vcpuSeconds: 180_000,
  gibSeconds: 360_000,
} as const;

@Injectable()
export class GcloudCostAdapter implements CostAdapter {
  readonly slug = 'gcloud';
  private readonly logger = new Logger(GcloudCostAdapter.name);
  private readonly auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/monitoring.read'],
  });

  constructor(private readonly config: ConfigService) {}

  private get projectId(): string {
    return this.config.get<string>('GCP_PROJECT_ID') ?? 'orbita-api-corp';
  }
  private get serviceName(): string {
    return this.config.get<string>('K_SERVICE') ?? 'orbita-api';
  }

  // El costo en USD de Google Cloud se carga a mano; este adaptador solo aporta uso.
  async fetchMonthlyCost(_month: string): Promise<CostBreakdown> {
    return { amountUsd: 0, breakdown: {} };
  }

  async fetchCurrentUsage(): Promise<{ items: UsageItem[] }> {
    const svc = `resource.labels.service_name="${this.serviceName}"`;
    const [requests, vcpu, mem, egress] = await Promise.all([
      this.monthlyTotal('run.googleapis.com/request_count', svc, 'ALIGN_SUM'),
      this.monthlyTotal('run.googleapis.com/container/cpu/allocation_time', svc, 'ALIGN_DELTA'),
      this.monthlyTotal('run.googleapis.com/container/memory/allocation_time', svc, 'ALIGN_DELTA'),
      this.monthlyTotal('run.googleapis.com/container/network/sent_bytes_count', svc, 'ALIGN_DELTA'),
    ]);

    const items: UsageItem[] = [];
    if (requests !== null) {
      items.push({ category: 'Cloud Run · Requests', value: Math.round(requests), unit: 'requests', limit: CLOUD_RUN_FREE.requests });
    }
    if (vcpu !== null) {
      items.push({ category: 'Cloud Run · CPU', value: Math.round(vcpu), unit: 'vCPU-s', limit: CLOUD_RUN_FREE.vcpuSeconds });
    }
    if (mem !== null) {
      items.push({ category: 'Cloud Run · Memoria', value: Math.round(mem), unit: 'GiB-s', limit: CLOUD_RUN_FREE.gibSeconds });
    }
    if (egress !== null) {
      items.push({ category: 'Cloud Run · Salida de red', value: Math.round((egress / 1024 ** 3) * 100) / 100, unit: 'GB' });
    }
    return { items };
  }

  private async monthlyTotal(metric: string, extraFilter: string, aligner: string): Promise<number | null> {
    try {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const params = new URLSearchParams({
        filter: `metric.type="${metric}" AND ${extraFilter}`,
        'interval.startTime': start.toISOString(),
        'interval.endTime': now.toISOString(),
        'aggregation.alignmentPeriod': `${Math.floor((now.getTime() - start.getTime()) / 1000) + 60}s`,
        'aggregation.perSeriesAligner': aligner,
        'aggregation.crossSeriesReducer': 'REDUCE_SUM',
      });
      const client = await this.auth.getClient();
      const { token } = await client.getAccessToken();
      const res = await fetch(`${MONITORING_BASE}/projects/${this.projectId}/timeSeries?${params}`, {
        headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': this.projectId },
      });
      if (!res.ok) {
        this.logger.warn(`Cloud Monitoring ${metric} respondió ${res.status}`);
        return null;
      }
      const data = (await res.json()) as any;
      let total = 0;
      for (const ts of data.timeSeries ?? []) {
        for (const p of ts.points ?? []) {
          total += Number(p.value?.doubleValue ?? p.value?.int64Value ?? 0);
        }
      }
      return total;
    } catch (err) {
      this.logger.warn(`Error consultando Cloud Monitoring (${metric}): ${err}`);
      return null;
    }
  }
}
