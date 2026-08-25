import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrbiController } from './orbi.controller';
import { GroqAdapter } from './llm/groq.adapter';
import { LLM_ADAPTER } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { NavigationTool } from './tools/definitions/navigation.tool';
import { ListProductsTool, CreateProductTool, GenerateDescriptionTool } from './tools/definitions/product.tools';
import { ListDiscountsTool, CreateDiscountTool, CreateCouponTool } from './tools/definitions/discount.tools';
import { ListOrdersTool, GetOrderDetailTool, UpdateOrderStatusTool } from './tools/definitions/order.tools';
import { ListCustomersTool, GetCustomerDetailTool } from './tools/definitions/customer.tools';
import { UpdateBusinessInfoTool, UpdatePaymentMethodsTool, UpdateShippingTool } from './tools/definitions/config.tools';
import { GetSalesReportTool, GetProductReportTool, GetCustomerReportTool } from './tools/definitions/report.tools';
import { SuggestBusinessNameTool, SuggestDescriptionTool, FillWizardFieldTool } from './tools/definitions/wizard.tools';
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

@Module({
  imports: [
    ProductsModule,
    DiscountsModule,
    CouponsModule,
    OrdersModule,
    CustomersModule,
    BusinessesModule,
    ReportsModule,
  ],
  controllers: [OrbiController],
  providers: [
    { provide: LLM_ADAPTER, useClass: GroqAdapter },
    ConversationService,
    ContextBuilderService,
    ToolRegistryService,
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
  ) {
    // Zona prohibida (ver spec): NO se registra ninguna tool que borre el
    // negocio, cambie de plan, modifique credenciales o remueva miembros.
    this.toolRegistry.register(new NavigationTool());

    this.toolRegistry.register(new ListProductsTool(this.productsService));
    this.toolRegistry.register(new CreateProductTool(this.productsService));
    this.toolRegistry.register(new GenerateDescriptionTool(this.productAiService));

    this.toolRegistry.register(new ListDiscountsTool(this.discountsService));
    this.toolRegistry.register(new CreateDiscountTool(this.discountsService));
    this.toolRegistry.register(new CreateCouponTool(this.couponsService));

    this.toolRegistry.register(new ListOrdersTool(this.ordersService));
    this.toolRegistry.register(new GetOrderDetailTool(this.ordersService));
    this.toolRegistry.register(new UpdateOrderStatusTool(this.ordersService));

    this.toolRegistry.register(new ListCustomersTool(this.customersService));
    this.toolRegistry.register(new GetCustomerDetailTool(this.customersService));

    this.toolRegistry.register(new UpdateBusinessInfoTool(this.businessesService));
    this.toolRegistry.register(new UpdatePaymentMethodsTool(this.businessesService));
    this.toolRegistry.register(new UpdateShippingTool(this.businessesService));

    this.toolRegistry.register(new GetSalesReportTool(this.reportsService));
    this.toolRegistry.register(new GetProductReportTool(this.reportsService));
    this.toolRegistry.register(new GetCustomerReportTool(this.reportsService));

    this.toolRegistry.register(new SuggestBusinessNameTool(this.config));
    this.toolRegistry.register(new SuggestDescriptionTool(this.config));
    this.toolRegistry.register(new FillWizardFieldTool());
  }
}
