import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrbiController } from './orbi.controller';
import { llmAdapterProvider } from './llm/llm-adapter.provider';
import { ConversationService } from './conversation/conversation.service';
import { SesionesController } from './sesiones/sesiones.controller';
import { SesionesService } from './sesiones/sesiones.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ModuleDataService } from './context/module-data.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { PendingActionService } from './tools/pending-action.service';
import { OrbiTurnService } from './orbi-turn.service';
import { NavigationTool } from './tools/definitions/navigation.tool';
import { LeerTemaDelManualTool } from './tools/definitions/manual.tools';
import { EstadoPrimerosPasosTool, AccesoDelEquipoTool } from './tools/definitions/estado.tools';
import { ListProductsTool, CreateProductTool, GenerateDescriptionTool } from './tools/definitions/product.tools';
import { ListDiscountsTool, CreateDiscountTool, CreateCouponTool } from './tools/definitions/discount.tools';
import { ListOrdersTool, GetOrderDetailTool, UpdateOrderStatusTool } from './tools/definitions/order.tools';
import { ListCustomersTool, GetCustomerDetailTool } from './tools/definitions/customer.tools';
import { UpdateBusinessInfoTool, UpdatePaymentMethodsTool, UpdateShippingTool } from './tools/definitions/config.tools';
import { GetSalesReportTool, GetProductReportTool, GetCustomerReportTool } from './tools/definitions/report.tools';
import { GetResumenDelPeriodoTool } from './tools/definitions/periodo.tools';
import { SuggestBusinessNameTool, SuggestDescriptionTool, SuggestSubdomainTool, SelectWizardOptionTool, FillWizardFieldTool } from './tools/definitions/wizard.tools';
import { ProductsModule } from '../products/products.module';
import { ProductsService } from '../products/products.service';
import { ProductAiService } from '../products/product-ai.service';
import { DiscountsModule } from '../discounts/discounts.module';
import { DiscountsService } from '../discounts/discounts.service';
import { CouponsModule } from '../coupons/coupons.module';
import { CouponsService } from '../coupons/coupons.service';
import { OrdersModule } from '../orders/orders.module';
import { OrdersService } from '../orders/orders.service';
import { CustomersModule } from '../customers/customers.module';
import { CustomersService } from '../customers/customers.service';
import { BusinessesModule } from '../businesses/businesses.module';
import { BusinessesService } from '../businesses/businesses.service';
import { ReportsModule } from '../reports/reports.module';
import { ReportsService } from '../reports/reports.service';
import { WizardAnalyticsModule } from '../wizard-analytics/wizard-analytics.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { OnboardingService } from '../onboarding/onboarding.service';
import { CostsModule } from '../platform/costs/costs.module';
import { UsageMeteringService } from '../platform/costs/usage-metering.service';
import { OrbiSaludModule } from './salud/orbi-salud.module';
import { CupoOrbiModule } from './cupo/cupo-orbi.module';
import { OrbiUsoController } from './cupo/orbi-uso.controller';
import { CuotaService } from '../common/cuota/cuota.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    ProductsModule,
    DiscountsModule,
    CouponsModule,
    OrdersModule,
    CustomersModule,
    BusinessesModule,
    ReportsModule,
    WizardAnalyticsModule,
    OnboardingModule,
    CostsModule,
    OrbiSaludModule,
    CupoOrbiModule,
  ],
  controllers: [OrbiController, SesionesController, OrbiUsoController],
  providers: [
    llmAdapterProvider,
    ConversationService,
    ContextBuilderService,
    ModuleDataService,
    ToolRegistryService,
    PendingActionService,
    OrbiTurnService,
    SesionesService,
  ],
})
export class OrbiModule {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly config: ConfigService,
    private readonly productsService: ProductsService,
    private readonly productAiService: ProductAiService,
    private readonly discountsService: DiscountsService,
    private readonly couponsService: CouponsService,
    private readonly ordersService: OrdersService,
    private readonly customersService: CustomersService,
    private readonly businessesService: BusinessesService,
    private readonly reportsService: ReportsService,
    private readonly onboardingService: OnboardingService,
    // CuotaModule es global: la cuota diaria de la IA de productos.
    private readonly cuotaService: CuotaService,
    // PrismaModule es global. Lo usan createProduct y updateOrderStatus para
    // armar la tarjeta con datos legibles (categoría, pedido y cliente),
    // siempre acotados al negocio del token.
    private readonly prisma: PrismaService,
    // CostsModule exporta el medidor de consumo: lo usan las tools del alta que llaman al LLM.
    private readonly usageMetering: UsageMeteringService,
  ) {
    // Zona prohibida (ver spec): NO se registra ninguna tool que borre el
    // negocio, cambie de plan, modifique credenciales o remueva miembros.
    this.toolRegistry.register(new NavigationTool());
    this.toolRegistry.register(new LeerTemaDelManualTool());

    this.toolRegistry.register(new ListProductsTool(this.productsService));
    this.toolRegistry.register(new CreateProductTool(this.productsService, this.prisma));
    this.toolRegistry.register(new GenerateDescriptionTool(this.productAiService, this.cuotaService));

    this.toolRegistry.register(new ListDiscountsTool(this.discountsService));
    this.toolRegistry.register(new CreateDiscountTool(this.discountsService));
    this.toolRegistry.register(new CreateCouponTool(this.couponsService));

    this.toolRegistry.register(new ListOrdersTool(this.ordersService));
    this.toolRegistry.register(new GetOrderDetailTool(this.ordersService));
    this.toolRegistry.register(new UpdateOrderStatusTool(this.ordersService, this.prisma));

    this.toolRegistry.register(new ListCustomersTool(this.customersService));
    this.toolRegistry.register(new GetCustomerDetailTool(this.customersService));

    this.toolRegistry.register(new UpdateBusinessInfoTool(this.businessesService));
    this.toolRegistry.register(new UpdatePaymentMethodsTool(this.businessesService));
    this.toolRegistry.register(new UpdateShippingTool(this.businessesService));

    this.toolRegistry.register(new GetSalesReportTool(this.reportsService));
    this.toolRegistry.register(new GetProductReportTool(this.reportsService));
    this.toolRegistry.register(new GetCustomerReportTool(this.reportsService));
    this.toolRegistry.register(new GetResumenDelPeriodoTool(this.reportsService));

    // El estado real del negocio para las dudas del manual (fase 6).
    this.toolRegistry.register(new EstadoPrimerosPasosTool(this.businessesService, this.prisma));
    this.toolRegistry.register(new AccesoDelEquipoTool(this.prisma));

    this.toolRegistry.register(new SuggestBusinessNameTool(this.config, this.onboardingService, this.usageMetering));
    this.toolRegistry.register(new SuggestDescriptionTool(this.config, this.usageMetering));
    this.toolRegistry.register(new SuggestSubdomainTool(this.onboardingService));
    this.toolRegistry.register(new SelectWizardOptionTool());
    this.toolRegistry.register(new FillWizardFieldTool());
  }
}
