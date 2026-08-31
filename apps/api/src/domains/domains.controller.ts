import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { DomainsService } from './domains.service';
import { LinkDomainDto } from './dto/link-domain.dto';
import { PurchaseDomainDto } from './dto/purchase-domain.dto';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  @RequirePermission('config.domains.manage')
  findAll(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.domainsService.findAll(member.businessId);
  }

  @Post('link')
  @RequirePermission('config.domains.manage')
  link(@CurrentBusiness() ctx: AuthContext, @Body() dto: LinkDomainDto) {
    const member = assertMemberContext(ctx);
    return this.domainsService.linkDomain(member.businessId, dto);
  }

  @Post('purchase')
  @RequirePermission('config.domains.manage')
  purchase(@CurrentBusiness() ctx: AuthContext, @Body() dto: PurchaseDomainDto) {
    const member = assertMemberContext(ctx);
    return this.domainsService.purchase(member.businessId, dto);
  }

  @Get(':id/dns-instructions')
  @RequirePermission('config.domains.manage')
  dnsInstructions(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.domainsService.getDnsInstructions(member.businessId, id);
  }

  @Post(':id/verify-dns')
  @RequirePermission('config.domains.manage')
  verifyDns(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.domainsService.verifyDns(member.businessId, id);
  }

  @Get(':id/ssl-status')
  @RequirePermission('config.domains.manage')
  sslStatus(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.domainsService.sslStatus(member.businessId, id);
  }

  @Delete(':id')
  @RequirePermission('config.domains.manage')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.domainsService.remove(member.businessId, id);
  }
}
