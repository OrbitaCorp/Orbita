import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  dashboard() {
    void this.reportsService;
    return { message: 'not implemented' };
  }

  // El resumen del mes para el historial de pedidos. Pide el mismo permiso que
  // la lista (orders.view) porque es una pantalla del modulo de pedidos.
  @Get('sales')
  @RequirePermission('orders.view')
  sales(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.reportsService.sales(member.businessId);
  }

  @Get('products')
  @RequirePermission('reports.view')
  products(@CurrentBusiness() ctx: AuthContext, @Query('days') days?: string) {
    const member = assertMemberContext(ctx);
    const parsed = days ? Number(days) : undefined;
    const ventana = parsed && Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 365) : undefined;
    return this.reportsService.products(member.businessId, ventana);
  }

  @Get('customers')
  customers() {
    void this.reportsService;
    return { message: 'not implemented' };
  }

  @Get('inventory')
  inventory() {
    void this.reportsService;
    return { message: 'not implemented' };
  }
}
