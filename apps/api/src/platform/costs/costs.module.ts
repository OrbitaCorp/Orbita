import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CostsService } from './costs.service';
import { CostsController } from './costs.controller';
import { UsageMeteringService } from './usage-metering.service';

@Module({
  controllers: [CostsController],
  providers: [CostsService, UsageMeteringService],
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
