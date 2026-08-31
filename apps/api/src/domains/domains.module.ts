import { Module } from '@nestjs/common';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { VercelDomainsService } from './vercel-domains.service';

@Module({
  controllers: [DomainsController],
  providers: [DomainsService, VercelDomainsService],
})
export class DomainsModule {}
