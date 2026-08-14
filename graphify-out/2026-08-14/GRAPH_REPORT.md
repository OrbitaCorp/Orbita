# Graph Report - Orbita-Frontend  (2026-08-03)

## Corpus Check
- 673 files · ~390,195 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4762 nodes · 9431 edges · 291 communities (272 shown, 19 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c487c15b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Design System Components
- Discounts UI Components
- Messaging Module
- Inventory API DTOs
- Catalog Categories UI
- Branches API Module
- Design System Charts
- Discount Coupon Cards
- Discount Badge & Metrics
- API Auth Decorators
- Shared Web Components
- Team Config Forms
- POS History Filters
- MercadoPago DTOs
- Discount Tables UI
- Returns & Credit Notes API
- Discount Filters & Coupons
- Design System Cards
- Orders API DTOs
- Discount Detail Views
- Backend Implementation Phases
- Onboarding Business DTOs
- Shared Sales Components
- Businesses API Module
- Platform Admin DTOs
- POS Cash Register UI
- Design System Inputs
- NestJS Module Registry
- Auth Module & Controller
- Members Invitation DTOs
- Storefront Public UI
- POS Modals & Drawers
- Categories API Controller
- Auth Context Decorators
- Map Picker Component
- POS Catalog Grid
- Branches API Controller
- Conversations API Controller
- Storefront Product Cards
- POS Ticket Items
- Reviews API DTOs
- Tags API Module
- Discount Category List
- Storefront Checkout Stepper
- Discount Application Selector
- TypeScript Reference Types
- POS Payment Hooks
- API Package Dependencies
- API Dev Dependencies
- POS Cobro Payment UI
- Domains API Controller
- Message Templates DTOs
- API TypeScript Config
- Config Appearance Settings
- Storefront Public Controller
- Cash Register API Module
- Payments Verify DTOs
- Storefront Me DTOs
- Store Preview Component
- POS Returns Modal
- Module Cluster 60
- Module Cluster 61
- Module Cluster 62
- Module Cluster 63
- Module Cluster 64
- Module Cluster 65
- Module Cluster 66
- Module Cluster 67
- Module Cluster 68
- Módulo: Custom Domains
- Module Cluster 70
- Module Cluster 71
- Module Cluster 72
- Module Cluster 73
- Module Cluster 74
- Module Cluster 75
- Module Cluster 76
- Module Cluster 77
- Module Cluster 78
- Module Cluster 79
- Paginacion.tsx
- Module Cluster 81
- Module Cluster 82
- Module Cluster 83
- Module Cluster 84
- Module Cluster 85
- Module Cluster 86
- Module Cluster 87
- Module Cluster 88
- Module Cluster 89
- Module Cluster 90
- Module Cluster 91
- Module Cluster 92
- Module Cluster 93
- Module Cluster 94
- Module Cluster 95
- Module Cluster 96
- Module Cluster 97
- Module Cluster 98
- Module Cluster 99
- Module Cluster 100
- Module Cluster 101
- Module Cluster 102
- @types/multer
- Module Cluster 104
- Module Cluster 105
- Module Cluster 106
- PedidoTable.tsx
- Module Cluster 108
- Module Cluster 109
- Module Cluster 110
- Module Cluster 111
- Module Cluster 112
- businesses.controller.ts
- Module Cluster 114
- businesses.service.ts
- Module Cluster 116
- Module Cluster 117
- Module Cluster 118
- Module Cluster 119
- MembersService
- Module Cluster 121
- ListBusinessesQueryDto
- Module Cluster 123
- Module Cluster 124
- Module Cluster 125
- Module Cluster 126
- Module Cluster 127
- Module Cluster 128
- Module Cluster 129
- Module Cluster 130
- Module Cluster 131
- Module Cluster 132
- Module Cluster 133
- Module Cluster 134
- Module Cluster 135
- Module Cluster 136
- Module Cluster 137
- Module Cluster 138
- Module Cluster 139
- Module Cluster 140
- Module Cluster 141
- Module Cluster 142
- Module Cluster 143
- Module Cluster 144
- OrdersService
- RegisterDto
- Module Cluster 147
- Module Cluster 148
- Module Cluster 149
- Module Cluster 150
- Module Cluster 151
- Module Cluster 152
- Module Cluster 153
- Module Cluster 154
- Module Cluster 155
- Module Cluster 156
- MeReturnDto
- Module Cluster 158
- Module Cluster 159
- Module Cluster 160
- turnos/Setup.tsx
- Module Cluster 162
- Module Cluster 163
- mail.service.ts
- ReorderImagesDto
- Module Cluster 166
- Module Cluster 167
- Module Cluster 168
- Module Cluster 169
- Module Cluster 170
- CalendarCard.tsx
- Module Cluster 172
- Module Cluster 173
- Module Cluster 174
- Module Cluster 175
- Module Cluster 176
- Module Cluster 177
- Module Cluster 178
- Module Cluster 179
- Module Cluster 180
- Footer.tsx
- babel-plugin-react-compiler
- Module Cluster 183
- resend
- sharp
- Module Cluster 186
- RegisterDto
- Module Cluster 188
- Module Cluster 189
- Module Cluster 190
- Module Cluster 191
- Apariencia
- Module Cluster 193
- Module Cluster 194
- Module Cluster 195
- typescript
- Module Cluster 197
- LogoutDto
- Module Cluster 199
- Module Cluster 200
- Module Cluster 201
- Fase 5 — Inventario (Inventory/Suppliers)
- RolesGuard
- MapPicker.tsx
- Module Cluster 205
- Module Cluster 206
- Module Cluster 207
- Module Cluster 208
- Module Cluster 209
- Module Cluster 210
- Module Cluster 211
- Module Cluster 212
- Module Cluster 213
- Module Cluster 214
- Module Cluster 215
- Module Cluster 216
- Module Cluster 217
- Module Cluster 218
- Module Cluster 219
- exceljs
- Module Cluster 222
- Module Cluster 226
- Module Cluster 227
- Module Cluster 229
- Module Cluster 236
- @nestjs/common
- @nestjs/schedule
- @supabase/supabase-js

## God Nodes (most connected - your core abstractions)
1. `AuthContext` - 134 edges
2. `PrismaService` - 110 edges
3. `CurrentBusiness` - 104 edges
4. `assertMemberContext()` - 102 edges
5. `panelRequest()` - 69 edges
6. `Roles()` - 62 edges
7. `RequirePermission()` - 58 edges
8. `fmtMoney()` - 52 edges
9. `AuthService` - 40 edges
10. `useAuth()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  apps/api/src/main.ts → apps/api/src/app.module.ts
- `createTestApp()` --indirect_call--> `AppModule`  [INFERRED]
  apps/api/test/helpers/test-app.ts → apps/api/src/app.module.ts
- `RequestWithUser` --references--> `AuthContext`  [EXTRACTED]
  apps/api/src/common/guards/auth.guard.ts → apps/api/src/common/types/auth-context.type.ts
- `AdminForgotPassword()` --calls--> `useAuth()`  [EXTRACTED]
  apps/web/src/pages/forgot-password.tsx → apps/web/src/lib/auth/AuthContext.tsx
- `PedidoMencionPopover()` --calls--> `fmt()`  [EXTRACTED]
  apps/web/src/modules/ventas/cliente/perfil/components/MensajesCliente.tsx → apps/web/src/lib/storefront/utils.ts

## Import Cycles
- None detected.

## Communities (291 total, 19 thin omitted)

### Community 0 - "Design System Components"
Cohesion: 0.06
Nodes (63): AccionesGuardado(), Props, AlcanceCard, AlcanceSelector(), CARDS, Props, BeneficioBonusSelector(), OPCIONES (+55 more)

### Community 1 - "Discounts UI Components"
Cohesion: 0.09
Nodes (35): ApiDiscountApplication, ApiDiscountDetail, ApiDiscountRow, ApiDiscountScope, ApiDiscountType, ApiUpsertDiscountInput, panelCreateDiscount(), panelGetDiscount() (+27 more)

### Community 2 - "Messaging Module"
Cohesion: 0.08
Nodes (38): panelDeleteCoupon(), panelToggleCoupon(), CuponCardMobile(), ESTADO_ACCENT, fmtRangoCompacto(), fmtValor(), MONO, Props (+30 more)

### Community 3 - "Inventory API DTOs"
Cohesion: 0.10
Nodes (8): BackgroundRemovalModule, Module, BackgroundRemovalService, MEAN, STD, Injectable, BusinessesService, Injectable

### Community 4 - "Catalog Categories UI"
Cohesion: 0.07
Nodes (22): BusinessDetail, BusinessList, BusinessRow, BusinessStatus, DomainsList, Overview, OwnerRow, platformApi (+14 more)

### Community 5 - "Branches API Module"
Cohesion: 0.12
Nodes (29): ApiCouponDetail, ApiCouponRow, ApiCouponScope, ApiCouponType, ApiUpsertCouponInput, panelCreateCoupon(), panelGetCoupon(), panelListCoupons() (+21 more)

### Community 6 - "Design System Charts"
Cohesion: 0.05
Nodes (48): panelGetMetrics(), fmt(), MetricasDrawer(), MiniKpi2Props, Props, CANALES, MetricasFiltros(), Props (+40 more)

### Community 7 - "Discount Coupon Cards"
Cohesion: 0.08
Nodes (47): Modal(), ModalProps, ModalVariant, variantBg, variantColor, variantIcon, Err(), Inp() (+39 more)

### Community 8 - "Discount Badge & Metrics"
Cohesion: 0.12
Nodes (16): HeroBgPattern, renderHeroBgPattern(), arrowStyle(), badgeColor(), CATS, DESTACADOS, HeroCarousel(), MAS_VENDIDOS (+8 more)

### Community 9 - "API Auth Decorators"
Cohesion: 0.05
Nodes (42): BM25, detect_domain(), _load_csv(), Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query, Load CSV and return list of dicts, Core search function using BM25 (+34 more)

### Community 10 - "Shared Web Components"
Cohesion: 0.14
Nodes (10): AuthError, bffFetch(), googleLoginUrl(), currentSlug(), slugFromHost(), storefrontBase(), ForgotPassword(), Login() (+2 more)

### Community 11 - "Team Config Forms"
Cohesion: 0.12
Nodes (19): RegisterBusinessDto, IsEmail, IsString, MinLength, PendingWizardDto, StartPendingCheckoutDto, IsArray, IsBoolean (+11 more)

### Community 12 - "POS History Filters"
Cohesion: 0.16
Nodes (18): panelDeleteDiscount(), panelToggleDiscount(), ESTADO_ACCENT, FilaDescuento(), FilaDescuentoCard(), fmtFecha(), fmtRangoCompacto(), HEADS (+10 more)

### Community 13 - "MercadoPago DTOs"
Cohesion: 0.06
Nodes (31): CreditNotesController, Body, Controller, Get, Post, CreateCreditNoteDto, IsIn, IsNumber (+23 more)

### Community 14 - "Discount Tables UI"
Cohesion: 0.08
Nodes (23): CategoriesController, Body, Controller, Get, Patch, Post, Query, CategoriesService (+15 more)

### Community 15 - "Returns & Credit Notes API"
Cohesion: 0.05
Nodes (66): ApiCouponEstado, ApiDiscountEstado, ApiHeaderLink, ApiHeroSlide, ApiPermission, ApiProductDetail, ApiProductImage, ApiRole (+58 more)

### Community 16 - "Discount Filters & Coupons"
Cohesion: 0.05
Nodes (51): ApiCustomer, ApiCustomerDetail, ApiCustomersPage, ApiProductListItem, createOrder(), getCustomer(), getCustomers(), panelGetProducts() (+43 more)

### Community 17 - "Design System Cards"
Cohesion: 0.06
Nodes (39): Toast(), ToastProps, ToastVariant, variantMap, IconType, Modulo, MODULOS, Props (+31 more)

### Community 18 - "Orders API DTOs"
Cohesion: 0.08
Nodes (18): orderedImageUrls(), pickPrimaryImageUrl(), ProductImageLite, ESTADOS_VENDIDOS, ReportsService, Injectable, StorefrontProductsQueryDto, IsBoolean (+10 more)

### Community 19 - "Discount Detail Views"
Cohesion: 0.04
Nodes (48): FindMovementsQueryDto, IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min (+40 more)

### Community 20 - "Backend Implementation Phases"
Cohesion: 0.08
Nodes (33): CONFIG, Props, Props, selectStyle, ACCION_LABEL, formatTimestamp(), HistorialCambios(), Props (+25 more)

### Community 21 - "Onboarding Business DTOs"
Cohesion: 0.05
Nodes (41): 1. Accessibility (CRITICAL), 2. Touch & Interaction (CRITICAL), 3. Performance (HIGH), 4. Layout & Responsive (HIGH), 5. Typography & Color (MEDIUM), 6. Animation (MEDIUM), 7. Style Selection (MEDIUM), 8. Charts & Data (LOW) (+33 more)

### Community 22 - "Shared Sales Components"
Cohesion: 0.05
Nodes (43): ColumnaTabla, DataTable(), Direccion, Paginacion, Props, EmptyState(), Props, ItemMenuContextual (+35 more)

### Community 23 - "Businesses API Module"
Cohesion: 0.11
Nodes (17): FullModeOnly(), MeReturnDto, IsIn, IsInt, IsOptional, IsString, IsUUID, IsOptional (+9 more)

### Community 24 - "Platform Admin DTOs"
Cohesion: 0.10
Nodes (15): IsArray, IsOptional, IsString, UpsertRoleDto, PermissionsController, Controller, Get, RolesController (+7 more)

### Community 25 - "POS Cash Register UI"
Cohesion: 0.06
Nodes (34): PlatformAdminGuard, Injectable, PlatformAdminContext, GrantCompDto, IsString, ListBusinessesQueryDto, IsIn, IsInt (+26 more)

### Community 26 - "Design System Inputs"
Cohesion: 0.06
Nodes (20): Inner, MapPicker(), Props, checkEmail(), checkSubdomain(), LEGAL_CONTENT, LegalKey, Props (+12 more)

### Community 27 - "NestJS Module Registry"
Cohesion: 0.07
Nodes (41): Avatar(), AvatarProps, Badge(), BadgeConfig, BadgeProps, BadgeStatus, config, CardSectionProps (+33 more)

### Community 28 - "Auth Module & Controller"
Cohesion: 0.07
Nodes (30): ApiProductFull, ApiTag, panelCreateTag(), panelGetProductFull(), panelGetTags(), ProductStatus, UpsertProductInput, Check() (+22 more)

### Community 29 - "Members Invitation DTOs"
Cohesion: 0.06
Nodes (51): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeStyles, variantStyles, Card(), CardProps (+43 more)

### Community 30 - "Storefront Public UI"
Cohesion: 0.11
Nodes (12): BranchesService, Injectable, CreateBranchDto, IsBoolean, IsOptional, IsString, IsBoolean, IsLatitude (+4 more)

### Community 31 - "POS Modals & Drawers"
Cohesion: 0.09
Nodes (34): Delete, Param, Put, CurrentBusiness, RequirePermission(), assertMemberContext(), Get, Put (+26 more)

### Community 32 - "Categories API Controller"
Cohesion: 0.11
Nodes (23): ApiCategoryNode, panelCreateCategory(), panelDeleteCategory(), panelGetCategoryTree(), panelUpdateCategory(), aCatNode(), catBtn, CatCampos (+15 more)

### Community 33 - "Auth Context Decorators"
Cohesion: 0.09
Nodes (18): CreateReviewDto, IsString, IsUUID, HideReviewDto, IsString, ProductReviewsController, Controller, ReviewsController (+10 more)

### Community 34 - "Map Picker Component"
Cohesion: 0.11
Nodes (17): completeOnboarding(), dataUrlToBlob(), getBusiness(), getBusinessConfig(), getOnboardingSession(), publishBusiness(), registerBusiness(), request() (+9 more)

### Community 35 - "POS Catalog Grid"
Cohesion: 0.13
Nodes (11): ConversationsModule, Module, ConversationsService, Injectable, CustomerMessageDto, IsString, MeConversationController, Body (+3 more)

### Community 36 - "Branches API Controller"
Cohesion: 0.24
Nodes (10): ApiCategory, ApiProductRow, panelGetProduct(), panelListProducts(), CategoriaNode(), Props, ProductosPorCategoria, useBuscarProductosDescuento() (+2 more)

### Community 37 - "Conversations API Controller"
Cohesion: 0.11
Nodes (24): CheckoutStepper(), Props, STEPS, badgeColor(), ProductCard(), Props, ProdImage(), ProdImageProps (+16 more)

### Community 38 - "Storefront Product Cards"
Cohesion: 0.10
Nodes (15): CreateMpOrderDto, IsOptional, IsUUID, MercadopagoController, Body, Controller, Get, Post (+7 more)

### Community 39 - "POS Ticket Items"
Cohesion: 0.14
Nodes (12): AuthController, deviceInfoFrom(), Body, Controller, Get, Headers, Post, Req (+4 more)

### Community 40 - "Reviews API DTOs"
Cohesion: 0.15
Nodes (14): ApiAppearanceConfig, UpdateAppearanceInput, apToUpdateDto(), cardRadiusARadio(), COLOR_MODE_A_MODO, dtoToAp(), ESCALA_A_FONT_SCALE, fontScaleAEscala() (+6 more)

### Community 41 - "Tags API Module"
Cohesion: 0.07
Nodes (22): BarChart(), BarChartProps, BarItem, DonutChartProps, DonutSegment, LineChart(), LineChartProps, EmptyState() (+14 more)

### Community 42 - "Discount Category List"
Cohesion: 0.10
Nodes (19): buildUrl(), LinkCompartibleSection(), MONO, Props, TipoDestino, TODO: Reemplazar por POST /api/descuentos/:id/duplicar, descuentosMock, TODO: Reemplazar por GET /api/descuentos (+11 more)

### Community 43 - "Storefront Checkout Stepper"
Cohesion: 0.08
Nodes (29): DeviceInfo, JwtPayload, AcceptInvitationDto, IsString, Length, MinLength, ForgotPasswordDto, IsEmail (+21 more)

### Community 44 - "Discount Application Selector"
Cohesion: 0.12
Nodes (19): ApiProductStats, panelGetCategoriesFlat(), panelGetProductStats(), ProductStatusFilter, ESTADO, ProductoEstadoBadge(), estadoVisual(), iconBtn (+11 more)

### Community 45 - "TypeScript Reference Types"
Cohesion: 0.07
Nodes (14): ConfirmSubscriptionDto, IsNotEmpty, IsString, Body, Post, SubscriptionsService, Injectable, SubscriptionsWebhookController (+6 more)

### Community 46 - "POS Payment Hooks"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 47 - "API Package Dependencies"
Cohesion: 0.14
Nodes (15): badgeBase, BadgeTipo(), esDescuento(), Props, PropsTipoCupon, PropsTipoDescuento, Props, DIA_LABELS (+7 more)

### Community 48 - "API Dev Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, argon2, class-transformer, class-validator, express, google-auth-library, jsonwebtoken, mercadopago (+23 more)

### Community 49 - "POS Cobro Payment UI"
Cohesion: 0.06
Nodes (33): devDependencies, jest, @nestjs/cli, @nestjs/schematics, @nestjs/testing, prisma, supertest, ts-jest (+25 more)

### Community 50 - "Domains API Controller"
Cohesion: 0.07
Nodes (28): 1. Listado de Descuentos y Cupones, 1. Porcentaje sobre producto/categoría, 2. Detalle de Descuento (solo lectura), 2. Monto fijo sobre producto/categoría, 3. Crear / Editar Descuento, 3. Porcentaje sobre el ticket, 4. Crear / Editar Cupón, 4. Monto fijo sobre el ticket (+20 more)

### Community 51 - "Message Templates DTOs"
Cohesion: 0.15
Nodes (12): ChangePasswordDto, IsString, MinLength, IsDateString, IsEmail, IsOptional, IsString, UpdateMeDto (+4 more)

### Community 52 - "API TypeScript Config"
Cohesion: 0.10
Nodes (34): AnnouncementBar(), FloatingWhatsapp(), Props, getStorefrontCategories(), getStorefrontConfig(), getStorefrontProduct(), getStorefrontProducts(), hueFromId() (+26 more)

### Community 53 - "Config Appearance Settings"
Cohesion: 0.10
Nodes (20): [2026-07-27] Códigos de barras eliminados del producto, [2026-07-27] Duplicar producto: qué se copia y qué no, [2026-07-27] GET /reports/products implementado (el resto de reports sigue stub), [2026-07-27] Mock del catálogo eliminado y buscador del sidebar conectado, [2026-07-27] Panel de productos: decisiones de la UI, [2026-07-27] Reconciliación de variantes en PUT /products/:id — criterio definido, [2026-07-27] Valor de inventario a costo, con fallback a precio, [2026-07-28] `app.use(json(...))` quedó ANTES de `enableCors()` — tapaba errores reales con "blocked by CORS" (+12 more)

### Community 54 - "Storefront Public Controller"
Cohesion: 0.09
Nodes (26): BusinessesController, Body, Controller, Get, Post, Put, UploadedFile, UseInterceptors (+18 more)

### Community 55 - "Cash Register API Module"
Cohesion: 0.11
Nodes (19): [2026-07-29] 9 campos nuevos en StorefrontConfig para que Apariencia sea "100% funcional", [2026-07-29] Alcance de esta fase: checkout/carrito/pedidos/cupones/reseñas/login de cliente NO se tocaron, [2026-07-29] Bug real encontrado y corregido en el pipeline de quitar fondo (sharp `joinChannel`), [2026-07-29] Detalle público de producto no expone `cost` ni stock exacto, [2026-07-29] `dtoToAp()` rompía en producción cuando heroSlides/headerLinks venían `null`, [2026-07-29] Footer real: se sacó la dirección hardcodeada, no hay campo real detrás, [2026-07-29] Normalización del modelo u2netp: constantes tomadas del código fuente oficial, no inventadas, [2026-07-29] Nuevo toggle `showSocialFooter` en vez de granularidad por cada elemento del footer (+11 more)

### Community 56 - "Payments Verify DTOs"
Cohesion: 0.14
Nodes (10): CurrentUser, CustomerContext, assertCustomerContext(), Get, Delete, Param, CustomerOrdersController, Controller (+2 more)

### Community 57 - "Storefront Me DTOs"
Cohesion: 0.11
Nodes (14): DomainsController, Body, Controller, Get, Param, Post, DomainsModule, Module (+6 more)

### Community 58 - "Store Preview Component"
Cohesion: 0.11
Nodes (15): IsIn, IsString, UpsertMessageTemplateDto, MessageTemplatesController, Body, Controller, Delete, Get (+7 more)

### Community 59 - "POS Returns Modal"
Cohesion: 0.15
Nodes (9): IsString, UpsertTagDto, TagsController, Body, Controller, Get, Post, TagsService (+1 more)

### Community 60 - "Module Cluster 60"
Cohesion: 0.08
Nodes (25): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+17 more)

### Community 61 - "Module Cluster 61"
Cohesion: 0.12
Nodes (16): panelUpdateAppearance(), panelUploadStorefrontImage(), ColorBlock(), hline(), IconT, pageWrap, patternPreview(), SLIDE_GRADS (+8 more)

### Community 62 - "Module Cluster 62"
Cohesion: 0.09
Nodes (22): panelGetBusiness(), panelGetBusinessConfig(), panelUpdateBusinessConfig(), pauseBusiness(), updateBusiness(), AparienciaProps, CfgField(), CfgFieldProps (+14 more)

### Community 63 - "Module Cluster 63"
Cohesion: 0.08
Nodes (24): Componentes compartidos nuevos en `_shared/components/`, Componentes de configuración por tipo, Componentes de detalle, Componentes de métricas, Componentes de vigencia y previews, components.md — Módulo Descuentos y Cupones (Fases 1–5), En `components/` (internos del módulo), En `_shared/components/` (compartidos con otros módulos) (+16 more)

### Community 64 - "Module Cluster 64"
Cohesion: 0.13
Nodes (13): IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, UpdateOnboardingBusinessDto, CATEGORIAS (+5 more)

### Community 65 - "Module Cluster 65"
Cohesion: 0.06
Nodes (23): handlebars, MailService, Injectable, CreateOrderDto, OrderBuyerInput, OrderItemInput, OrderPaymentInput, IsArray (+15 more)

### Community 66 - "Module Cluster 66"
Cohesion: 0.19
Nodes (5): NOTE: Not covered automatically — requires a PENDING member with hasTempPassword, MockIdentity, closeTestApp(), createTestApp(), SEED_USERS

### Community 67 - "Module Cluster 67"
Cohesion: 0.13
Nodes (13): IsOptional, IsString, VerifyPaymentDto, PaymentsController, Body, Controller, Get, Param (+5 more)

### Community 68 - "Module Cluster 68"
Cohesion: 0.22
Nodes (10): Public(), Get, Param, StorefrontController, Body, Controller, Get, Param (+2 more)

### Community 69 - "Módulo: Custom Domains"
Cohesion: 0.11
Nodes (21): Breadcrumb(), Crumb, FacebookIcon(), IconProps, InstagramIcon(), TiktokIcon(), Contact, Props (+13 more)

### Community 70 - "Module Cluster 70"
Cohesion: 0.15
Nodes (8): OnboardingController, Body, Controller, Get, Post, Query, OnboardingService, Injectable

### Community 71 - "Module Cluster 71"
Cohesion: 0.10
Nodes (19): Fase 0 — Prerrequisitos, Fase 10 — Postventa y comunicación, Fase 11 — Auditoría y reportes, Fase 12 — Modos y vidriera digital, Fase 13 — Suscripciones y plataforma, Fase 14 — Dominios, Fase 15 — Storefront público, Fase 16 — Integración frontend ↔ backend (+11 more)

### Community 72 - "Module Cluster 72"
Cohesion: 0.13
Nodes (12): GoogleExchangeDto, IsNotEmpty, IsString, GoogleAuthController, RedirectableResponse, Controller, Get, Query (+4 more)

### Community 73 - "Module Cluster 73"
Cohesion: 0.19
Nodes (3): AuthService, Injectable, GoogleIdentity

### Community 74 - "Module Cluster 74"
Cohesion: 0.14
Nodes (12): CouponsService, Injectable, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional (+4 more)

### Community 75 - "Module Cluster 75"
Cohesion: 0.20
Nodes (7): AuditController, Controller, Get, AuditModule, Module, AuditService, Injectable

### Community 76 - "Module Cluster 76"
Cohesion: 0.19
Nodes (9): CustomerAuthResponse, LoginResponse, MemberAuthResponse, PlatformAdminAuthResponse, Body, Post, GoogleOAuthExchangeStore, StoredSession (+1 more)

### Community 77 - "Module Cluster 77"
Cohesion: 0.19
Nodes (8): AddressesService, Injectable, CustomersModule, Module, IsBoolean, IsOptional, IsString, UpsertAddressDto

### Community 78 - "Module Cluster 78"
Cohesion: 0.13
Nodes (15): Catálogo de permisos, Crear / actualizar sucursal, Crear / editar / eliminar rol, Editar miembro, Eliminar miembro, Eliminar sucursal, Fase 1 — Fundación (tenant + auth), Invitar miembro (+7 more)

### Community 79 - "Module Cluster 79"
Cohesion: 0.07
Nodes (27): CustomersController, Body, Controller, Get, Param, Post, Put, Query (+19 more)

### Community 80 - "Paginacion.tsx"
Cohesion: 0.22
Nodes (11): hacerRefresh(), tokenStore, tryRefresh(), AuthContext, AuthContextValue, authHeaders(), AuthProvider(), AuthStatus (+3 more)

### Community 81 - "Module Cluster 81"
Cohesion: 0.12
Nodes (17): devDependencies, babel-plugin-react-compiler, eslint, eslint-config-next, tailwindcss, @types/aos, @types/node, @types/react (+9 more)

### Community 82 - "Module Cluster 82"
Cohesion: 0.18
Nodes (18): BackendResult, callBackend(), clearRefreshCookie(), cookieDomain(), firstHeader(), readRefreshCookie(), serializeCookie(), setRefreshCookie() (+10 more)

### Community 83 - "Module Cluster 83"
Cohesion: 0.06
Nodes (40): AddImageDto, IsBoolean, IsOptional, IsUUID, Transform, CreateProductDto, ProductOptionInput, ProductVariantInput (+32 more)

### Community 84 - "Module Cluster 84"
Cohesion: 0.06
Nodes (54): BandejaProps, SK, Props, Avatar(), Props, BandejaLista(), FILTROS, Props (+46 more)

### Community 85 - "Module Cluster 85"
Cohesion: 0.12
Nodes (17): dependencies, exceljs, leaflet, lucide-react, next, react, react-dom, @types/leaflet (+9 more)

### Community 86 - "Module Cluster 86"
Cohesion: 0.11
Nodes (19): Abrir caja, Cambiar estado de la orden, Cerrar caja, Crear orden (POS u online), Enviar comprobante, Fase 5 — Órdenes y pagos, Forzar cierre, Historial de sesiones (+11 more)

### Community 87 - "Module Cluster 87"
Cohesion: 0.11
Nodes (19): Actualizar estado de devolución, Bandeja de conversaciones, Crear devolución, Crear opinión, CRUD de plantillas, Elegibilidad para opinar (deeplink de email post-entrega), Enviar mensaje, Fase 8 — Postventa y comunicación (+11 more)

### Community 88 - "Module Cluster 88"
Cohesion: 0.06
Nodes (30): ChangeModeDto, IsIn, PauseBusinessDto, IsBoolean, IsBoolean, IsOptional, Transform, UploadStorefrontImageDto (+22 more)

### Community 89 - "Module Cluster 89"
Cohesion: 0.33
Nodes (4): ReportsController, Controller, Get, Query

### Community 90 - "Module Cluster 90"
Cohesion: 0.12
Nodes (17): [2026-07-16] `Branch` no persiste lat/lng — dirección es solo texto libre, [2026-07-16] Bug de infraestructura: `apps/web` nunca tuvo su propio `pnpm install`, [2026-07-16] Bug de infraestructura: el navegador de prueba (Browser pane) no hidrata NINGUNA página del frontend, [2026-07-16] Bug de infraestructura: `$transaction` de `registerBusiness()` excedía el timeout (P2028), [2026-07-16] `Business.industry` se crea vacío (`''`) en el registro, [2026-07-16] `POST /onboarding/register-business` compartía servicio con el seed script — no se hizo, [2026-07-16] `PUT /onboarding/business` como endpoint separado de `PUT /business`, gateado por `isActive`, [2026-07-16] RBT-293 — Persistencia completa del wizard de onboarding (+9 more)

### Community 91 - "Module Cluster 91"
Cohesion: 0.15
Nodes (10): CouponsController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 92 - "Module Cluster 92"
Cohesion: 0.14
Nodes (12): useDarkMode(), AdminLayout(), BcItem, CUPONES_VISTA_LABELS, DESCUENTOS_VISTA_LABELS, Header(), Notif, NOTIFS (+4 more)

### Community 93 - "Module Cluster 93"
Cohesion: 0.13
Nodes (22): CATEGORIAS, CUPONES_MOCK, HISTORIAL_MOCK, MensajeCliente, MENSAJES_MOCK, PRODUCTOS, USUARIO_MOCK, Categoria (+14 more)

### Community 94 - "Module Cluster 94"
Cohesion: 0.21
Nodes (8): BranchesController, Body, Controller, Delete, Get, Param, Post, Put

### Community 95 - "Module Cluster 95"
Cohesion: 0.07
Nodes (24): Msg, OrbiChat(), Props, QuickAction, Categoria, getRubrosCatalog(), Rubro, Subrubro (+16 more)

### Community 96 - "Module Cluster 96"
Cohesion: 0.12
Nodes (16): Ambigüedades, Campos calculados (NO persistir) — `TotalesPOS`, Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas, `MetodoPago` (PaymentMethod, embebido), `MovimientoCaja` (CashMovement) (+8 more)

### Community 97 - "Module Cluster 97"
Cohesion: 0.07
Nodes (37): BadgeEstado(), CuponesTabla(), DescuentosFiltros(), DescuentosTabla(), DetalleConfiguracion(), fmt(), getRows(), Props (+29 more)

### Community 98 - "Module Cluster 98"
Cohesion: 0.12
Nodes (15): Checklist antes de dar por terminada cada fase, CLAUDE.md — Módulo de Descuentos y Cupones, Componentes a crear, Componentes internos (`components/`), Componentes potencialmente compartidos, Contexto, Datos mock, Endpoints futuros (referencia para hooks) (+7 more)

### Community 99 - "Module Cluster 99"
Cohesion: 0.12
Nodes (15): Dashboard, Endpoints de super-admin (plataforma), Endpoints públicos (sin auth), Endpoints que requieren `modo = FULL` (403 en SHOWCASE), Fase 6 — MercadoPago, Fase 9 — Transversal, Fase (Reportes), Gaps resueltos (+7 more)

### Community 100 - "Module Cluster 100"
Cohesion: 0.12
Nodes (16): Actualizar / eliminar producto, Crear / editar / eliminar categoría, Crear producto (transacción completa), CRUD de tags, Códigos de barras, Eliminar / reordenar / marcar principal, Fase 2 — Catálogo, Listar categorías (árbol) (+8 more)

### Community 101 - "Module Cluster 101"
Cohesion: 0.13
Nodes (15): Ambigüedades, Campos calculados (NO persistir), `Cupon` (Coupon) — con código, canjeable, Datos que consume, Datos que envía, ⚠️ Decisión de arquitectura no anticipada por este análisis: `Descuento` y `Cupon` se UNIFICAN, `Descuento` (Discount) — automático o manual, sin código, Endpoints necesarios (confirmados en `descuentos/CLAUDE.md`) (+7 more)

### Community 102 - "Module Cluster 102"
Cohesion: 0.10
Nodes (20): [2026-07-12] GUIA_PRUEBA_MANUAL_FASES_1_2.md no existe en apps/api, [2026-07-13] `apps/api/scripts/reset-unlinked-customer.ts` no existe, [2026-07-13] Bug propio detectado y corregido en el momento: protección de borrado de Supplier basada en un supuesto incorrecto sobre el FK, [2026-07-13] Filtro `lowStock` y paginación de `GET /inventory/stock` se resuelven en memoria, [2026-07-13] `POST /inventory/adjustment` bloquea si el resultado da stock negativo, 2026-07-24 — Auditoría de mis fases + arreglos (Alex), 2026-07-24 — Clientes: modelo y lista con métricas (Fase 2, tarjeta 3 — Alex), 2026-07-24 — Exportaciones y email masivo (Fase 2, tarjetas 7 y 8 — Alex) (+12 more)

### Community 103 - "@types/multer"
Cohesion: 0.22
Nodes (7): AddressesController, Body, Controller, Delete, Param, Post, Put

### Community 104 - "Module Cluster 104"
Cohesion: 0.15
Nodes (12): File Structure, Fuera de alcance de este plan (decisión a confirmar con el equipo, no tomada acá), Global Constraints, Motor de Descuentos + CRUD (RBT-613, RBT-614) Implementation Plan, Self-Review (completado al escribir este plan), Task 1: DTO de filtros del listado, Task 2: Motor de evaluación — funciones puras, Task 3: `DiscountsService` — lectura (findAll, findOne) + controller (+4 more)

### Community 105 - "Module Cluster 105"
Cohesion: 0.15
Nodes (14): CheckoutBuyerInput, CheckoutDto, CheckoutItemInput, IsArray, IsEmail, IsIn, IsInt, IsObject (+6 more)

### Community 106 - "Module Cluster 106"
Cohesion: 0.24
Nodes (10): NAV_LINKS, Navbar(), ScrollSequence(), ScrollToTop(), Props, SectionDivider(), ThemeContext, ThemeContextValue (+2 more)

### Community 107 - "PedidoTable.tsx"
Cohesion: 0.19
Nodes (7): MeController, Controller, Get, Headers, Post, UploadedFile, UseInterceptors

### Community 108 - "Module Cluster 108"
Cohesion: 0.14
Nodes (14): Ambigüedades, `Apariencia` / `StorefrontConfig` (1:1 con Negocio), `ConfigNotificaciones` (1:1 con Negocio), Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas, `Miembro` (BusinessMember) (+6 more)

### Community 109 - "Module Cluster 109"
Cohesion: 0.20
Nodes (8): ComprobanteBase(), ComprobanteBaseProps, ComprobanteEmisor, ComprobanteItem, ComprobanteTotal, fmtMonto(), FECHA_HOY, HORA_HOY

### Community 110 - "Module Cluster 110"
Cohesion: 0.18
Nodes (7): UnifiedPanelCard(), useCounter(), BadgeVariant, MOB_STARS, Step, StepItem, STEPS

### Community 111 - "Module Cluster 111"
Cohesion: 0.20
Nodes (9): collection, compilerOptions, assets, deleteOutDir, watchAssets, $schema, sourceRoot, background-removal/models/**/*.onnx (+1 more)

### Community 112 - "Module Cluster 112"
Cohesion: 0.12
Nodes (13): Branding, MailMeta, FindOrdersQueryDto, IsIn, IsInt, IsOptional, IsString, IsUUID (+5 more)

### Community 113 - "businesses.controller.ts"
Cohesion: 0.04
Nodes (47): AuthModule, Global, Module, BranchesModule, Module, BusinessesModule, Module, CategoriesModule (+39 more)

### Community 114 - "Module Cluster 114"
Cohesion: 0.22
Nodes (8): exclude, extends, dist, node_modules, prisma, **/*spec.ts, test, ./tsconfig.json

### Community 115 - "businesses.service.ts"
Cohesion: 0.13
Nodes (12): CartItemForEngine, DiscountsService, Injectable, IsArray, IsBoolean, IsIn, IsInt, IsNumber (+4 more)

### Community 116 - "Module Cluster 116"
Cohesion: 0.14
Nodes (14): 14.1 `reviews`, 14. Opiniones, 15.1 `audit_logs`, 15. Auditoría, 19. Resumen de relaciones, 1. Convenciones generales, 20. Orden de implementación, 2. Mapa de módulos y dependencias (+6 more)

### Community 117 - "Module Cluster 117"
Cohesion: 0.15
Nodes (13): Ambigüedades, Campos calculados (NO persistir), Datos que consume, Datos que envía, `Devolucion` (Return), Endpoints necesarios, Entidades identificadas, `LineaPedido` (OrderItem) (+5 more)

### Community 118 - "Module Cluster 118"
Cohesion: 0.15
Nodes (4): ALL_PRODUCTS, CATS, SEARCH_TARGETS, StoreCard()

### Community 119 - "Module Cluster 119"
Cohesion: 0.19
Nodes (9): PresentationSections(), SLIDES, Window, RUBROS, RubrosCarousel(), Testimonial, TESTIMONIALS, Upcoming (+1 more)

### Community 120 - "MembersService"
Cohesion: 0.24
Nodes (7): AppModule, Module, HttpExceptionFilter, HttpRequestLike, HttpResponseLike, bootstrap(), Catch

### Community 121 - "Module Cluster 121"
Cohesion: 0.18
Nodes (11): Aceptar invitación de miembro (contraseña temporal), Aislamiento multi-tenant, Contexto del usuario logueado, Login, Logout, Módulo: Auth, Recuperar contraseña, Refrescar token (+3 more)

### Community 122 - "ListBusinessesQueryDto"
Cohesion: 0.18
Nodes (10): Cuenta Cliente Storefront (RBT-628, RBT-629, RBT-630, RBT-631) Implementation Plan, File Structure, Global Constraints, Scope Check, Self-Review, Task 1: Mis direcciones (RBT-629), Task 2: Datos personales + Seguridad (RBT-630 + parte de RBT-631), Task 3: Sesiones activas (resto de RBT-631) (+2 more)

### Community 123 - "Module Cluster 123"
Cohesion: 0.31
Nodes (10): AddCarritoOptions, buildItemKey(), CarritoItem, CarritoProductBase, useCarrito(), CheckoutCupon, CheckoutManualDiscount, CheckoutTotals (+2 more)

### Community 124 - "Module Cluster 124"
Cohesion: 0.17
Nodes (12): Ambigüedades, Campos calculados (NO persistir), `Categoria` (Category), Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas, Módulo 3: `panel/catalogo` (+4 more)

### Community 125 - "Module Cluster 125"
Cohesion: 0.17
Nodes (12): Ambigüedades, Campos calculados (NO persistir), Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas, `Movimiento` (StockMovement), Módulo 4: `panel/inventario` (+4 more)

### Community 126 - "Module Cluster 126"
Cohesion: 0.17
Nodes (12): Ambigüedades, Campos calculados (NO persistir), `ChatMsg` (Message), `Conversacion` (Conversation), Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas (+4 more)

### Community 127 - "Module Cluster 127"
Cohesion: 0.22
Nodes (9): Actualizar negocio, Apariencia del storefront, Config operativa (contacto, pagos, envíos, redes), Eliminar negocio (zona peligrosa), Módulo: Businesses, Notificaciones, Obtener negocio actual, Pausar tienda (zona peligrosa) (+1 more)

### Community 128 - "Module Cluster 128"
Cohesion: 0.19
Nodes (12): FindCouponsQueryDto, IsIn, IsInt, IsOptional, IsString, Max, Min, Type (+4 more)

### Community 129 - "Module Cluster 129"
Cohesion: 0.09
Nodes (26): EligibleDiscount, CartItemInput, EvaluateDiscountsDto, IsArray, IsInt, IsOptional, IsString, IsUUID (+18 more)

### Community 130 - "Module Cluster 130"
Cohesion: 0.05
Nodes (66): DIM, Loader(), LoaderProps, LoaderSize, ApiError, ApiOrderDetail, ApiOrdersPage, ApiOrderStatus (+58 more)

### Community 131 - "Module Cluster 131"
Cohesion: 0.17
Nodes (11): 1. Crear el archivo del rubro, 2. Definir las opciones del primer paso, 3. Armar el componente del primer paso, 4. Exportar con SetupUnificado, 5. Crear la página, 6. Registrar el rubro en ElegirRubro, Cuándo usar `toggleFn`, Cómo agregar un nuevo rubro al onboarding (+3 more)

### Community 132 - "Module Cluster 132"
Cohesion: 0.17
Nodes (12): Actualizar perfil (cliente), Categorías (público), Checkout (crear pedido online), Config + apariencia de la tienda, Cupones públicos, Descuento exclusivo (por link privado), Detalle de producto (público), Listar productos (público) (+4 more)

### Community 133 - "Module Cluster 133"
Cohesion: 0.17
Nodes (12): Callback OAuth, Conectar cuenta (OAuth — iniciar), Crear Order de MP (checkout online / Point), Desconectar cuenta, Estado de conexión, Módulo: MercadoPago, Point: activar modo PDV, Point: crear POS (caja) (+4 more)

### Community 134 - "Module Cluster 134"
Cohesion: 0.18
Nodes (10): Anexo: componentes `_shared` relevantes al modelo, Análisis Frontend → Modelo de datos (`apps/web/src/modules/ventas/`), Cambios detectados (actualización post-`MODELO_DATOS_DEFINITIVO.md`), Datos que el mock tiene pero son de UI (NO persistir), Datos que faltan en el mock pero la lógica de negocio necesita, Decisiones pendientes, Entidades compartidas entre módulos, ⚠️ Inconsistencia detectada (no del frontend — dentro del propio `MODELO_DATOS_DEFINITIVO.md`) (+2 more)

### Community 135 - "Module Cluster 135"
Cohesion: 0.18
Nodes (11): Ambigüedades, Campos calculados (NO persistir), `Cliente` (Customer), `ClienteNota` (CustomerNote) — inferida de la tab "notas", Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas (+3 more)

### Community 136 - "Module Cluster 136"
Cohesion: 0.18
Nodes (11): `Categoria` (storefront), `Cupon` (storefront) y `DescuentoExclusivo`, `Direccion` (Address) — **falta en el panel**, Entidades identificadas (⚠️ modelo storefront, distinto del panel), `ItemCarrito`, `MensajeCliente`, `Pedido` (storefront) + `TimelineStep`, `PedidoResumen` (+3 more)

### Community 137 - "Module Cluster 137"
Cohesion: 0.17
Nodes (11): Arquitectura / decisiones técnicas, Auth: NO usa Supabase Auth, Ejemplo de entrada, Formato, Google OAuth (RBT-287), Instrucciones permanentes para trabajar en apps/api/, Mantener PENDIENTES.md actualizado, Qué NO va en PENDIENTES.md (+3 more)

### Community 138 - "Module Cluster 138"
Cohesion: 0.18
Nodes (11): [2026-07-12] `assertMemberContext()` agregado en Businesses/Branches, [2026-07-12] Bug de infraestructura: `tsconfig.build.json` compilaba `prisma/`, [2026-07-12] Catálogo de eventos de notificación hardcodeado, [2026-07-12] `DELETE /business` (eliminar negocio) sigue sin implementar, [2026-07-12] Endpoint dedicado para cambiar `business.mode` — no implementado, [2026-07-12] Endpoint `POST /businesses` (creación de negocio) no implementado, [2026-07-12] `PUT /business` no acepta el campo `mode`, [2026-07-12] Rol mínimo para operaciones de sucursal (+3 more)

### Community 139 - "Module Cluster 139"
Cohesion: 0.18
Nodes (9): Base de datos (Prisma), Configuración de entorno, Desarrollo, Endpoints de salud, Estructura, Instalación, Orbita API — Backend NestJS + Prisma, Próximo paso (+1 more)

### Community 140 - "Module Cluster 140"
Cohesion: 0.12
Nodes (16): Cupones CRUD (RBT-615) + Servicio de Métricas — Implementation Plan, File Structure, Global Constraints, Nota sobre "datos reales" en métricas, Self-Review, Task A1: DTOs de cupones, Task A2: CouponsService — findAll + findOne, Task A3: CouponsService — create + update (código único + validaciones) (+8 more)

### Community 141 - "Module Cluster 141"
Cohesion: 0.13
Nodes (14): NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS, IsArray, IsBoolean, IsEmail, IsNumber, IsOptional, IsString (+6 more)

### Community 142 - "Module Cluster 142"
Cohesion: 0.18
Nodes (10): 1. POST /auth/accept-invitation, 2. POST /auth/reset-password, 3. Registro de customerWithoutAccount — idempotencia limitada, 4. Registro exitoso — residuo en Supabase, Auth (auth.e2e-spec.ts) — 17 tests, Branches (branches.e2e-spec.ts) — 8 tests, Business (business.e2e-spec.ts) — 17 tests, Casos no cubiertos (+2 more)

### Community 143 - "Module Cluster 143"
Cohesion: 0.33
Nodes (10): computeItemDiscountAmount(), computeTicketDiscountAmount(), esTipoSoportado(), evaluateCart(), EvaluationResult, ItemDiscountResult, itemMatchesDiscount(), pickBest() (+2 more)

### Community 145 - "OrdersService"
Cohesion: 0.40
Nodes (5): [2026-07-17] Aislamiento multi-tenant en AuthGuard y login/register, [2026-07-17] `register()` verifica la contraseña implícitamente al hacer `signInWithPassword`, [2026-07-28] Un deploy de Railway forzaba relogin a todos los usuarios — el BFF borraba la cookie de refresh ante CUALQUIER error, no solo un token inválido, [2026-07-29] CAUSA RAÍZ del relogin en cada recarga: dos refresh concurrentes sobre un token de un solo uso, Fase 1 — Auth (corrección crítica)

### Community 147 - "Module Cluster 147"
Cohesion: 0.25
Nodes (10): DateRangePicker(), DIAS, fmtFull(), GridProps, inRange(), MESES, MonthGrid(), navBtn (+2 more)

### Community 148 - "Module Cluster 148"
Cohesion: 0.18
Nodes (11): Auditoría de un descuento, Crear / editar descuento, Evaluar carrito, Fase 7 — Descuentos, Link compartible del cupón, Listar descuentos/cupones, Métricas, Módulo: Discounts (+3 more)

### Community 149 - "Module Cluster 149"
Cohesion: 0.18
Nodes (11): Autenticación, Autorización (roles y permisos), Campos calculados, Convenciones globales, Errores, Modo del negocio (FULL vs SHOWCASE), Montos y fechas, Multi-branch (+3 more)

### Community 150 - "Module Cluster 150"
Cohesion: 0.18
Nodes (11): Ceder licencia de cortesía (comp), CRUD de admins de plataforma, Detalle de negocio (plataforma), Estado de la suscripción, Fase 11 — Suscripciones y plataforma, Historial de facturación, Listar negocios (plataforma), Módulo: Platform Admin (+3 more)

### Community 151 - "Module Cluster 151"
Cohesion: 0.20
Nodes (10): scripts, build, dev, postinstall, prisma:generate, prisma:migrate:dev, prisma:validate, seed (+2 more)

### Community 152 - "Module Cluster 152"
Cohesion: 0.17
Nodes (10): DiscountsMetricsService, RedencionConRefs, round2(), TIPO_LABEL, Injectable, ventanaDe(), MetricsQueryDto, IsIn (+2 more)

### Community 153 - "Module Cluster 153"
Cohesion: 0.13
Nodes (14): ConversationsController, Body, Controller, Get, Param, Patch, Post, SendMessageDto (+6 more)

### Community 154 - "Module Cluster 154"
Cohesion: 0.11
Nodes (18): HeaderLinkDto, IsBoolean, IsString, HeroSlideDto, IsIn, IsOptional, IsString, IsArray (+10 more)

### Community 155 - "Module Cluster 155"
Cohesion: 0.28
Nodes (5): PageLoader(), Props, Props, StorefrontLoader(), queryClient

### Community 156 - "Module Cluster 156"
Cohesion: 0.22
Nodes (6): CustomRange, DateRangePopover(), fmtShort(), Periodo, PERIODOS, PeriodoSelectorProps

### Community 157 - "MeReturnDto"
Cohesion: 0.20
Nodes (8): OrbitSystem(), RING_SIZES, SatDef, SATS, AVATARS, Hero(), PILLS, STARS

### Community 159 - "Module Cluster 159"
Cohesion: 0.20
Nodes (10): 6.1 `categories`, 6.2 `tags`, 6.3 `products`, 6.4 `product_tags`, 6.5 `product_options`, 6.6 `product_option_values`, 6.7 `product_variants`, 6.8 `variant_option_values` (+2 more)

### Community 160 - "Module Cluster 160"
Cohesion: 0.22
Nodes (9): [2026-07-12] `accept-invitation` usa `memberId` como token, sin expiración ni secreto, [2026-07-12] Email de recovery duplicado de Supabase, [2026-07-12] Validación de JWT vía llamada a Supabase, no localmente, [2026-07-13] `AuthService.login()` enmascara cualquier excepción como "Credenciales inválidas", [2026-07-18] Frontend no actualizado para el nuevo flujo de auth, [2026-07-18] Migración de Supabase Auth a sistema propio completada, [2026-07-18] `SupabaseService` aún existe pero ya no se usa en auth, [2026-07-18] Swagger/OpenAPI pendiente de actualizar para nuevos endpoints auth (+1 more)

### Community 161 - "turnos/Setup.tsx"
Cohesion: 0.50
Nodes (4): LiveChatCard(), Msg, Source, SOURCES

### Community 162 - "Module Cluster 162"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, start, version

### Community 163 - "Module Cluster 163"
Cohesion: 0.25
Nodes (8): [2026-07-14] Análisis pre-implementación: 7 fallas detectadas, 4 resueltas, [2026-07-14] Módulo completo sin implementar — `CustomersService` es un stub, [2026-08-02] Cuenta cliente — Datos personales (RBT-630), [2026-08-02] Cuenta cliente — Frontend de `Perfil.tsx` conectado (RBT-628/629/630/631, Task 5), [2026-08-02] Cuenta cliente — Mis direcciones (RBT-629), [2026-08-02] Cuenta cliente — Mis pedidos (RBT-628), [2026-08-02] Cuenta cliente — Seguridad y sesiones (RBT-631), Fase 6 — Clientes (Customers/Addresses)

### Community 164 - "mail.service.ts"
Cohesion: 0.10
Nodes (16): InviteMemberDto, IsEmail, IsString, IsUUID, IsOptional, IsString, IsUUID, UpdateMemberDto (+8 more)

### Community 165 - "ReorderImagesDto"
Cohesion: 0.29
Nodes (5): tenantUrl(), ERROR_MESSAGES, GoogleCallback(), Status, Estado

### Community 166 - "Module Cluster 166"
Cohesion: 0.25
Nodes (8): Ambigüedades, Campos calculados (NO persistir), Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas, Módulo 1: `panel/reportes`, Vistas encontradas

### Community 167 - "Module Cluster 167"
Cohesion: 0.25
Nodes (8): Ambigüedades, Campos calculados (NO persistir), Datos que consume (`@/lib/storefront/mock.ts`), Datos que envía, Endpoints necesarios, Módulo 10: `cliente/*` (Storefront público), Relaciones, Vistas encontradas

### Community 168 - "Module Cluster 168"
Cohesion: 0.25
Nodes (7): breakpoints, grid, layout, radius, spacing, SpacingKey, zIndex

### Community 169 - "Module Cluster 169"
Cohesion: 0.36
Nodes (7): DashboardCard(), DATA, Period, PERIODS, SALES_POOL, StatCard(), useCountUp()

### Community 170 - "Module Cluster 170"
Cohesion: 0.25
Nodes (7): Cupones: Validar y Canjear (RBT-616) Implementation Plan, File Structure, Global Constraints, Self-Review, Task 1: `DiscountsService.validateCoupon()` + tipar `ValidateCouponDto`, Task 2: Canje automático al crear la orden, Task 3: Documentación

### Community 171 - "CalendarCard.tsx"
Cohesion: 0.22
Nodes (7): Appt, CalendarCard(), DAYS, INITIAL_APPTS, NEW_BOOKINGS, NUMS, WEEK_GRID

### Community 172 - "Module Cluster 172"
Cohesion: 0.25
Nodes (8): Ajuste de stock, CRUD de proveedores, Entrada de stock, Fase 3 — Inventario, Historial de movimientos, Módulo: Inventory, Módulo: Suppliers, Stock general (por sucursal)

### Community 173 - "Module Cluster 173"
Cohesion: 0.25
Nodes (8): Crear / actualizar cliente, CRUD de direcciones (storefront, cuenta propia), Email a clientes (individual/masivo), Fase 4 — Clientes, Listar clientes, Módulo: Addresses, Módulo: Customers, Obtener cliente (con pedidos)

### Community 174 - "Module Cluster 174"
Cohesion: 0.20
Nodes (9): description, engines, node, name, packageManager, prisma, seed, private (+1 more)

### Community 175 - "Module Cluster 175"
Cohesion: 0.29
Nodes (7): [2026-07-13] Al eliminar un miembro no se borra su usuario de Supabase Auth, [2026-07-13] `AppRole` usa 'cashier'/'employee' (inglés) pero los roles seedeados son 'cajero'/'empleado' (español), [2026-07-13] Autorización por rol (`@Roles()`), no por permiso, pese a lo que dice el contrato, [2026-07-13] Catálogo de permisos seed no incluye `catalog.*` ni `config.team.view`, [2026-07-18] "PUT /roles/:id/permissions" cubierto por el reemplazo completo en `PUT /roles/:id`, [2026-07-20] Pestaña Roles del panel Equipo integrada con la API real (+fix del modal), Fase 3 — Equipo (Roles/Permissions/Members)

### Community 176 - "Module Cluster 176"
Cohesion: 0.29
Nodes (7): [2026-07-13] Bug de infraestructura: no existía el bucket de Supabase Storage `product-images`, [2026-07-13] Matching de `variant.optionValues` con las opciones es posicional, no por nombre, [2026-07-13] No existe endpoint separado `PUT /products/:id/tags`, [2026-07-13] Producto sin variantes: variante default con stock inicial en 0, [2026-07-13] `PUT /products/:id` no reconcilia variantes/opciones/stock — solo campos escalares y tags, [2026-07-13] `totalStock` en `GET /products` suma todas las sucursales, no solo la default, Fase 4 — Catálogo (Categories/Tags/Products)

### Community 177 - "Module Cluster 177"
Cohesion: 0.29
Nodes (7): [2026-07-20] 15 casos de TOCTOU: `update`/`delete` por `id` sin `businessId` en el where — corregidos, [2026-07-20] `AuthGuard` no validaba `businessId` del JWT contra la DB — defensa en profundidad agregada, [2026-07-20] `forgot-password` sin rate limit específico — agregado, [2026-07-20] Gap de producto: `forgot-password` no tenía modo "sin slug" para dueños — agregado, [2026-07-20] `PlatformAdminGuard` es un stub que siempre devuelve `true` — sin endpoints que lo usen todavía, [2026-07-20] Test e2e preexistente falla por datos de seed no idempotentes — no relacionado a esta sesión, RBT-290 — Auditoría de aislamiento multi-tenant

### Community 178 - "Module Cluster 178"
Cohesion: 0.15
Nodes (13): [2026-07-20] Atajo para entrar al panel sin pagar, [2026-07-20] El negocio ahora se crea ANTES del pago — revierte la decisión del 2026-07-17, [2026-07-20] (histórico) El webhook no validaba la firma de MercadoPago, [2026-07-20] Periodicidad: la documentación dice mensual, el producto es trimestral, [2026-07-20] Se usa preapproval (Suscripciones de MP), no Checkout API/Orders, [2026-07-27] Cron de limpieza de negocios draft abandonados, [2026-07-27] El webhook ahora valida la firma de MercadoPago, [2026-07-27] `SubscriptionPayment` + máquina de mora — implementados (+5 more)

### Community 179 - "Module Cluster 179"
Cohesion: 0.20
Nodes (5): SupabaseModule, Global, Module, SupabaseService, Injectable

### Community 180 - "Module Cluster 180"
Cohesion: 0.29
Nodes (6): fontFamily, letterSpacing, lineHeight, prose, TextStyleKey, textStyles

### Community 181 - "Footer.tsx"
Cohesion: 0.40
Nodes (4): cols, Footer(), LegalKey, LegalModal()

### Community 183 - "Module Cluster 183"
Cohesion: 0.35
Nodes (5): useAuth(), RequireAuth(), apexUrl(), PanelHome(), Panel()

### Community 184 - "resend"
Cohesion: 0.33
Nodes (3): PrimerPasoProps, SERVICIOS, TurnosSetup()

### Community 186 - "Module Cluster 186"
Cohesion: 0.33
Nodes (6): [2026-07-12] Login de member enviando header X-Business-Slug: prioriza member, [2026-07-12] POST /auth/accept-invitation y POST /auth/reset-password sin test e2e, [2026-07-12] Tests e2e crean usuarios reales en Supabase que no se limpian, [2026-07-20] Suite e2e corre contra una base Supabase compartida real, no una DB de test efímera, [2026-07-20] Throttler real activo en tests — deshabilitado explícitamente vía skipIf, Tests E2E

### Community 187 - "RegisterDto"
Cohesion: 0.29
Nodes (7): Buscar disponibilidad de dominio, Comprar dominio (camino 3), Estado de SSL, Fase 12 — Dominios, Listar dominios del negocio, Módulo: Custom Domains, Verificar DNS

### Community 188 - "Module Cluster 188"
Cohesion: 0.33
Nodes (6): 3.1 `businesses`, 3.2 `branches`, 3.3 `business_config`, 3.4 `storefront_config`, 3.5 `notification_config`, 3. Multi-tenancy y negocio

### Community 189 - "Module Cluster 189"
Cohesion: 0.33
Nodes (6): 8.1 `orders`, 8.2 `order_items`, 8.3 `pos_sale_details`, 8.4 `online_order_details`, 8.5 `order_status_history`, 8. Órdenes (POS + Online)

### Community 190 - "Module Cluster 190"
Cohesion: 0.29
Nodes (6): @prisma/client, main(), PERMISSIONS, prisma, ROLE_PERMISSIONS, @prisma/client

### Community 191 - "Module Cluster 191"
Cohesion: 0.60
Nodes (4): config, isPassthrough(), middleware(), slugFromHost()

### Community 192 - "Apariencia"
Cohesion: 0.40
Nodes (6): panelGetAppearance(), Apariencia(), FontSelect(), StorePreview(), fontStack(), loadFont()

### Community 193 - "Module Cluster 193"
Cohesion: 0.18
Nodes (10): AP_DEFAULTS, BG_PATTERNS, EscalaFuente, FONT_DESCRIPCIONES, GOOGLE_FONTS, HeaderLink, HeroSlide, LayoutGrid (+2 more)

### Community 195 - "Module Cluster 195"
Cohesion: 0.25
Nodes (8): [2026-07-20] Credenciales de Google OAuth son placeholders — no funciona contra Google real, [2026-07-20] Decisión: vincular password a cuenta creada por Google, no rechazar el registro, [2026-07-20] Exchange code de Google OAuth vive en memoria — asume deployment single-instance, [2026-07-20] Fixtures del seed no reseteaban `googleId` entre corridas — corregido, [2026-07-20] Librería y decisiones de diseño confirmadas antes de implementar, [2026-07-20] `state` de OAuth firmado con el mismo secret que los JWT (`JWT_SECRET`), [2026-07-20] Tests de Google OAuth cubiertos — 9/9, más los 8 de aislamiento sin regresión, RBT-287 — Google OAuth

### Community 197 - "Module Cluster 197"
Cohesion: 0.40
Nodes (4): Arquitectura / decisiones técnicas, Auth: NO usa Supabase Auth, graphify, Órbita — contexto del proyecto

### Community 198 - "LogoutDto"
Cohesion: 0.20
Nodes (10): [2026-07-27] Se reemplazó @nestjs-modules/mailer (SMTP) por el SDK de Resend, [2026-07-30] Bug real: "Email masivo enviado a 0 clientes" — plantilla nueva sin copiar a dist/ + catch que tragaba el error en silencio, [2026-07-30] Diseño de marca real para todos los emails (antes salían en HTML crudo), [2026-07-30] Email masivo: loading → éxito → cierre automático, [2026-07-30] Mismo tratamiento (dos columnas + mensaje más grande) aplicado a las otras modales que redactan email con plantillas, [2026-07-30] Plantillas nuevas del servicio central + aviso de contraseña cambiada, [2026-07-30] Servicio central de emails (Fase 3): registro de envíos en `email_logs` — corrige una decisión del contrato, [2026-07-31] Email masivo: se sacó el spinner del botón — nuevo componente `Loader` chico y reutilizable (no el PageLoader de pantalla completa) (+2 more)

### Community 199 - "Module Cluster 199"
Cohesion: 0.40
Nodes (5): 10.1 `mp_credentials`, 10.2 `mp_stores`, 10.3 `mp_pos`, 10.4 `mp_devices`, 10. MercadoPago

### Community 200 - "Module Cluster 200"
Cohesion: 0.40
Nodes (5): 11.1 `discounts`, 11.2 `discount_products`, 11.3 `discount_categories`, 11.4 `discount_redemptions`, 11. Descuentos y cupones

### Community 201 - "Module Cluster 201"
Cohesion: 0.40
Nodes (5): 4.1 `members`, 4.2 `roles`, 4.3 `permissions`, 4.4 `role_permissions`, 4. Identidad y equipo

### Community 202 - "Fase 5 — Inventario (Inventory/Suppliers)"
Cohesion: 0.40
Nodes (5): [2026-07-13] Bug de infraestructura: `@supabase/supabase-js` no funciona en Node 20 sin polyfill de WebSocket, [2026-07-13] `pnpm add` en un subproyecto pnpm puede podar dependencias de otro `pnpm install` previo, [2026-07-18] Error intermitente: "new row violates row-level security policy" al subir a Storage — sin causa raíz confirmada, autoresuelto, [2026-08-02] Cliente de Prisma desactualizado respecto a schema.prisma (bloqueaba el build de tests), Infraestructura / Entorno de desarrollo

### Community 204 - "MapPicker.tsx"
Cohesion: 0.15
Nodes (5): AppController, Controller, Get, PrismaService, Injectable

### Community 205 - "Module Cluster 205"
Cohesion: 0.50
Nodes (3): duration, easing, transitions

### Community 206 - "Module Cluster 206"
Cohesion: 0.50
Nodes (3): ColorToken, dark, light

### Community 207 - "Module Cluster 207"
Cohesion: 0.50
Nodes (4): 13.1 `conversations`, 13.2 `messages`, 13.3 `message_templates`, 13. Mensajería

### Community 208 - "Module Cluster 208"
Cohesion: 0.50
Nodes (4): 21. Anexo: cambios de v2 y checklist para el backlog, Checklist antes de arrancar el backlog, Qué agregó v2 respecto de la primera versión, Total de tablas del schema

### Community 209 - "Module Cluster 209"
Cohesion: 0.50
Nodes (4): 7.1 `variant_stock`, 7.2 `stock_movements`, 7.3 `suppliers`, 7. Inventario

### Community 210 - "Module Cluster 210"
Cohesion: 0.50
Nodes (4): 9.1 `payments`, 9.2 `cash_sessions`, 9.3 `cash_movements`, 9. Pagos y caja

### Community 211 - "Module Cluster 211"
Cohesion: 0.67
Nodes (3): aos, aos, HomePage()

### Community 216 - "Module Cluster 216"
Cohesion: 0.67
Nodes (3): 12.1 `returns`, 12.2 `credit_notes`, 12. Devoluciones y notas de crédito

### Community 217 - "Module Cluster 217"
Cohesion: 0.67
Nodes (3): 16.1 `subscriptions`, 16.2 `subscription_payments`, 16. Suscripciones a Orbita

### Community 218 - "Module Cluster 218"
Cohesion: 0.67
Nodes (3): 17.1 `platform_admins`, 17.2 `platform_admin_logs`, 17. Super-administración de plataforma

### Community 219 - "Module Cluster 219"
Cohesion: 0.67
Nodes (3): 18.1 `subdomain` (campo en `businesses`), 18.2 `custom_domains`, 18. Dominios

### Community 222 - "Module Cluster 222"
Cohesion: 0.25
Nodes (8): [2026-07-30] Descuentos: estado 'agotado' derivado, [2026-07-30] EvaluateDiscountsDto dejó de arrastrar el POS, [2026-07-31] Cupones/Descuentos: features que siguen mock/stub, [2026-07-31] Cupones: módulo CRUD construido (RBT-615), [2026-07-31] El código de un cupón dado de baja NO se puede reusar, [2026-07-31] Métricas: servicio de agregación real (RBT-614), [2026-08-02] Cupones: validar y canjear (RBT-616), Fase 3 — Descuentos y Cupones (RBT-613/614/615)

### Community 236 - "Module Cluster 236"
Cohesion: 0.10
Nodes (19): Comportamiento actual, Comportamiento actual, Comportamiento actual, Comportamiento esperado, Comportamiento esperado, Comportamiento esperado, Conclusión, Contexto técnico (+11 more)

## Knowledge Gaps
- **1378 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `mail/templates/**/*.hbs` (+1373 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `MapPicker.tsx` to `Module Cluster 128`, `Module Cluster 129`, `Inventory API DTOs`, `Team Config Forms`, `Module Cluster 141`, `Discount Tables UI`, `MercadoPago DTOs`, `RegisterDto`, `Discount Detail Views`, `Orders API DTOs`, `Module Cluster 152`, `POS Cash Register UI`, `Platform Admin DTOs`, `Storefront Public UI`, `Auth Context Decorators`, `POS Catalog Grid`, `mail.service.ts`, `Storefront Product Cards`, `Storefront Checkout Stepper`, `TypeScript Reference Types`, `Message Templates DTOs`, `Module Cluster 179`, `Storefront Me DTOs`, `Store Preview Component`, `POS Returns Modal`, `Module Cluster 64`, `Module Cluster 65`, `Module Cluster 66`, `Module Cluster 67`, `Module Cluster 70`, `Module Cluster 74`, `Module Cluster 75`, `Module Cluster 77`, `Module Cluster 79`, `Module Cluster 83`, `Module Cluster 88`, `Module Cluster 112`, `businesses.service.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `AuthContext` connect `Storefront Public Controller` to `Discount Tables UI`, `Discount Detail Views`, `Platform Admin DTOs`, `POS Modals & Drawers`, `mail.service.ts`, `POS Ticket Items`, `Storefront Checkout Stepper`, `Message Templates DTOs`, `Payments Verify DTOs`, `POS Returns Modal`, `Module Cluster 77`, `Module Cluster 79`, `Module Cluster 83`, `Module Cluster 88`, `Module Cluster 89`, `Module Cluster 91`, `Module Cluster 94`, `@types/multer`, `PedidoTable.tsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `HomePage()` connect `Module Cluster 211` to `Module Cluster 106`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _1378 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Design System Components` be split into smaller, more focused modules?**
  _Cohesion score 0.059499489274770175 - nodes in this community are weakly interconnected._
- **Should `Discounts UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08846153846153847 - nodes in this community are weakly interconnected._
- **Should `Messaging Module` be split into smaller, more focused modules?**
  _Cohesion score 0.07607843137254902 - nodes in this community are weakly interconnected._