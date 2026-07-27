import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { SupabaseModule } from './supabase/supabase.module';

import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { BusinessModeGuard } from './common/guards/business-mode.guard';

import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { BusinessesModule } from './businesses/businesses.module';
import { BranchesModule } from './branches/branches.module';
import { MembersModule } from './members/members.module';
import { RolesModule } from './roles/roles.module';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { MercadopagoModule } from './mercadopago/mercadopago.module';
import { DiscountsModule } from './discounts/discounts.module';
import { ReturnsModule } from './returns/returns.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessageTemplatesModule } from './message-templates/message-templates.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AuditModule } from './audit/audit.module';
import { ReportsModule } from './reports/reports.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PlatformModule } from './platform/platform.module';
import { DomainsModule } from './domains/domains.module';
import { StorefrontModule } from './storefront/storefront.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    MailModule,
    SupabaseModule,
    AuthModule,
    OnboardingModule,
    BusinessesModule,
    BranchesModule,
    MembersModule,
    RolesModule,
    CategoriesModule,
    TagsModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    OrdersModule,
    PaymentsModule,
    MercadopagoModule,
    DiscountsModule,
    ReturnsModule,
    ConversationsModule,
    MessageTemplatesModule,
    ReviewsModule,
    AuditModule,
    ReportsModule,
    SubscriptionsModule,
    PlatformModule,
    DomainsModule,
    StorefrontModule,
  ],
  controllers: [AppController],
  providers: [
    // Orden de guards: AuthGuard primero (valida token y puebla req.user), luego
    // RolesGuard/PermissionsGuard (leen req.user ya poblado) y BusinessModeGuard.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: BusinessModeGuard },
  ],
})
export class AppModule {}
