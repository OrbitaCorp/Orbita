import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // (Fase 4 — Alex) La pantalla de inicio del panel. Sin permiso especial:
  // cualquier miembro con acceso al panel ve el dashboard (los links de las
  // alertas después respetan los permisos de cada sección).
  @Get('dashboard')
  dashboard(
    @CurrentBusiness() ctx: AuthContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const member = assertMemberContext(ctx);
    return this.reportsService.dashboard(member.businessId, from, to);
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

  // (Fase 4 — Alex) Reporte de la cartera de clientes. Mismo permiso que el
  // resto de los reportes del módulo.
  @Get('customers')
  @RequirePermission('reports.view')
  customers(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.reportsService.customers(member.businessId);
  }

  @Get('inventory')
  inventory() {
    void this.reportsService;
    return { message: 'not implemented' };
  }
}
