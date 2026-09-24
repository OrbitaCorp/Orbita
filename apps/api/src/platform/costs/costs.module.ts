import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CostsService } from './costs.service';
import { CostsController } from './costs.controller';
import { UsageMeteringService } from './usage-metering.service';
import { VercelCostAdapter } from './adapters/vercel.adapter';
import { CloudflareCostAdapter } from './adapters/cloudflare.adapter';
import { SupabaseCostAdapter } from './adapters/supabase.adapter';
import { InternalCostAdapter } from './adapters/internal.adapter';

export const COST_ADAPTERS = 'COST_ADAPTERS';

@Module({
  controllers: [CostsController],
  providers: [
    CostsService,
    UsageMeteringService,
    VercelCostAdapter,
    CloudflareCostAdapter,
    SupabaseCostAdapter,
    InternalCostAdapter,
    {
      provide: COST_ADAPTERS,
      useFactory: (vercel: VercelCostAdapter, cloudflare: CloudflareCostAdapter, supabase: SupabaseCostAdapter) =>
        [vercel, cloudflare, supabase],
      inject: [VercelCostAdapter, CloudflareCostAdapter, SupabaseCostAdapter],
    },
  ],
  exports: [UsageMeteringService],
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
