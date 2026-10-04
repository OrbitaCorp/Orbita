import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CostsService } from './costs.service';
import { CostsController } from './costs.controller';
import { UsageMeteringService } from './usage-metering.service';
import { VercelCostAdapter } from './adapters/vercel.adapter';
import { CloudflareCostAdapter } from './adapters/cloudflare.adapter';
import { SupabaseCostAdapter } from './adapters/supabase.adapter';
import { InternalCostAdapter } from './adapters/internal.adapter';
import { GcloudCostAdapter } from './adapters/gcloud.adapter';

import { AlertasDeCostoService } from './alertas-de-costo.service';
import { COST_ADAPTERS } from './costs.constants';

@Module({
  controllers: [CostsController],
  providers: [
    CostsService,
    AlertasDeCostoService,
    UsageMeteringService,
    VercelCostAdapter,
    CloudflareCostAdapter,
    SupabaseCostAdapter,
    InternalCostAdapter,
    GcloudCostAdapter,
    {
      provide: COST_ADAPTERS,
      useFactory: (vercel: VercelCostAdapter, cloudflare: CloudflareCostAdapter, supabase: SupabaseCostAdapter, gcloud: GcloudCostAdapter) =>
        [vercel, cloudflare, supabase, gcloud],
      inject: [VercelCostAdapter, CloudflareCostAdapter, SupabaseCostAdapter, GcloudCostAdapter],
    },
  ],
  exports: [UsageMeteringService, CostsService, AlertasDeCostoService],
})
export class CostsModule implements OnModuleInit {
  private readonly logger = new Logger(CostsModule.name);

  constructor(private readonly costs: CostsService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.costs.seedProviders();
    } catch (err) {
      this.logger.error(`Error sembrando proveedores de costo: ${err}`);
    }
  }
}
