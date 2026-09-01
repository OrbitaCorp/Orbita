import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { DomainsService } from './domains.service';
import { DomainPurchaseService } from './domain-purchase.service';
import { LinkDomainDto } from './dto/link-domain.dto';
import { SearchDomainPurchaseDto } from './dto/search-domain-purchase.dto';
import { CheckoutDomainPurchaseDto } from './dto/checkout-domain-purchase.dto';

@Controller('domains')
export class DomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly domainPurchaseService: DomainPurchaseService,
  ) {}

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

  // Compra real vía la API de registrador de Vercel (reemplaza el mock que
  // solo dejaba constancia del pedido) — ver domain-purchase.service.ts.
  // Búsqueda multi-TLD: "lenteslindos" → .com/.store/.shop/etc., o
  // "lenteslindos.io" → chequea solo ese, mismo criterio que las
  // plataformas de venta de dominios.
  @Post('purchase/search')
  @RequirePermission('config.domains.manage')
  searchPurchase(@Body() dto: SearchDomainPurchaseDto) {
    return this.domainPurchaseService.search(dto);
  }

  @Post('purchase/checkout')
  @RequirePermission('config.domains.manage')
  checkoutPurchase(@CurrentBusiness() ctx: AuthContext, @Body() dto: CheckoutDomainPurchaseDto) {
    const member = assertMemberContext(ctx);
    return this.domainPurchaseService.startCheckout(member.businessId, dto);
  }

  @Get('purchase/:orderId')
  @RequirePermission('config.domains.manage')
  getPurchaseOrder(@CurrentBusiness() ctx: AuthContext, @Param('orderId') orderId: string) {
    const member = assertMemberContext(ctx);
    return this.domainPurchaseService.getOrderForBusiness(member.businessId, orderId);
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
