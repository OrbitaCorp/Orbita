# Graph Report - Orbita-Frontend  (2026-07-30)

## Corpus Check
- 635 files · ~347,368 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4463 nodes · 8637 edges · 281 communities (258 shown, 23 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0a546570`
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
- Module Cluster 166
- Module Cluster 167
- Module Cluster 168
- Module Cluster 169
- Module Cluster 170
- Module Cluster 172
- Module Cluster 173
- Module Cluster 174
- Module Cluster 175
- Module Cluster 176
- Module Cluster 177
- Module Cluster 178
- Module Cluster 179
- Module Cluster 180
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
- Module Cluster 199
- Module Cluster 200
- Module Cluster 201
- Fase 5 — Inventario (Inventory/Suppliers)
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
- Module Cluster 222
- Module Cluster 226
- Module Cluster 227
- Module Cluster 229
- Module Cluster 236

## God Nodes (most connected - your core abstractions)
1. `AuthContext` - 112 edges
2. `CurrentBusiness` - 93 edges
3. `assertMemberContext()` - 92 edges
4. `PrismaService` - 88 edges
5. `Roles()` - 57 edges
6. `RequirePermission()` - 56 edges
7. `fmtMoney()` - 50 edges
8. `panelRequest()` - 49 edges
9. `Public()` - 39 edges
10. `Button()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  apps/api/src/main.ts → apps/api/src/app.module.ts
- `RequestWithUser` --references--> `AuthContext`  [EXTRACTED]
  apps/api/src/common/guards/auth.guard.ts → apps/api/src/common/types/auth-context.type.ts
- `PedidoMencionPopover()` --calls--> `fmt()`  [EXTRACTED]
  apps/web/src/modules/ventas/cliente/perfil/components/MensajesCliente.tsx → apps/web/src/lib/storefront/utils.ts
- `Perfil()` --calls--> `fmt()`  [EXTRACTED]
  apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx → apps/web/src/lib/storefront/utils.ts
- `InicioDevolucion()` --calls--> `openWpp()`  [EXTRACTED]
  apps/web/src/modules/ventas/cliente/pedido/Devolucion.tsx → apps/web/src/lib/storefront/utils.ts

## Import Cycles
- None detected.

## Communities (281 total, 23 thin omitted)

### Community 0 - "Design System Components"
Cohesion: 0.08
Nodes (49): AlcanceCard, AlcanceSelector(), CARDS, Props, BeneficioBonusSelector(), OPCIONES, Props, CategoriaLista() (+41 more)

### Community 1 - "Discounts UI Components"
Cohesion: 0.10
Nodes (30): ApiDiscountApplication, ApiDiscountDetail, ApiDiscountRow, ApiDiscountScope, ApiDiscountType, ApiUpsertDiscountInput, panelCreateDiscount(), panelListDiscounts() (+22 more)

### Community 2 - "Messaging Module"
Cohesion: 0.11
Nodes (26): BadgeEstado(), CuponCardMobile(), ESTADO_ACCENT, fmtRangoCompacto(), fmtValor(), MONO, Props, FilaCupon() (+18 more)

### Community 4 - "Catalog Categories UI"
Cohesion: 0.07
Nodes (23): BusinessDetail, BusinessList, BusinessRow, BusinessStatus, DomainsList, Overview, OwnerRow, platformApi (+15 more)

### Community 5 - "Branches API Module"
Cohesion: 0.09
Nodes (33): buildUrl(), descCupon(), LinkCompartibleModal(), MONO, TipoDestino, CuponesCrear(), Props, CuponesListado() (+25 more)

### Community 6 - "Design System Charts"
Cohesion: 0.05
Nodes (52): fmt(), MetricasDrawer(), MiniKpi2Props, Props, CANALES, MetricasFiltros(), Props, RANGOS (+44 more)

### Community 7 - "Discount Coupon Cards"
Cohesion: 0.08
Nodes (49): ApiRole, createRole(), deleteRole(), getPermissionsCatalog(), getRoles(), updateRole(), Err(), Inp() (+41 more)

### Community 8 - "Discount Badge & Metrics"
Cohesion: 0.11
Nodes (18): HeroBgPattern, renderHeroBgPattern(), useDarkMode(), arrowStyle(), badgeColor(), CATS, DESTACADOS, HeroCarousel() (+10 more)

### Community 9 - "API Auth Decorators"
Cohesion: 0.05
Nodes (42): BM25, detect_domain(), _load_csv(), Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query, Load CSV and return list of dicts, Core search function using BM25 (+34 more)

### Community 10 - "Shared Web Components"
Cohesion: 0.13
Nodes (5): AuthError, googleLoginUrl(), Login(), Registro(), AdminLogin()

### Community 11 - "Team Config Forms"
Cohesion: 0.12
Nodes (19): RegisterBusinessDto, IsEmail, IsString, MinLength, PendingWizardDto, StartPendingCheckoutDto, IsArray, IsBoolean (+11 more)

### Community 12 - "POS History Filters"
Cohesion: 0.12
Nodes (22): panelDeleteDiscount(), panelToggleDiscount(), ESTADO_ACCENT, FilaDescuento(), FilaDescuentoCard(), fmtFecha(), fmtRangoCompacto(), HEADS (+14 more)

### Community 13 - "MercadoPago DTOs"
Cohesion: 0.06
Nodes (31): CreditNotesController, Body, Controller, Get, Post, CreateCreditNoteDto, IsIn, IsNumber (+23 more)

### Community 14 - "Discount Tables UI"
Cohesion: 0.07
Nodes (26): CategoriesController, Body, Controller, Delete, Get, Param, Patch, Post (+18 more)

### Community 15 - "Returns & Credit Notes API"
Cohesion: 0.12
Nodes (14): BandejaProps, SK, Props, BandejaLista(), FILTROS, Props, ChatPanel(), ConversacionItem() (+6 more)

### Community 16 - "Discount Filters & Coupons"
Cohesion: 0.08
Nodes (27): Modal(), ModalProps, ModalVariant, variantBg, variantColor, variantIcon, ApiCustomer, ApiCustomerDetail (+19 more)

### Community 17 - "Design System Cards"
Cohesion: 0.04
Nodes (78): Button(), Card(), CardProps, paddingMap, BarChart(), BarChartProps, BarItem, DonutChart() (+70 more)

### Community 18 - "Orders API DTOs"
Cohesion: 0.06
Nodes (29): AppController, Controller, Get, orderedImageUrls(), pickPrimaryImageUrl(), ProductImageLite, PrismaService, Injectable (+21 more)

### Community 19 - "Discount Detail Views"
Cohesion: 0.04
Nodes (47): FindMovementsQueryDto, IsIn, IsInt, IsOptional, IsUUID, Max, Min, Type (+39 more)

### Community 20 - "Backend Implementation Phases"
Cohesion: 0.07
Nodes (40): CONFIG, Props, CuponesTabla(), Props, DescuentosFiltros(), selectStyle, DescuentosTabla(), Props (+32 more)

### Community 21 - "Onboarding Business DTOs"
Cohesion: 0.05
Nodes (41): 1. Accessibility (CRITICAL), 2. Touch & Interaction (CRITICAL), 3. Performance (HIGH), 4. Layout & Responsive (HIGH), 5. Typography & Color (MEDIUM), 6. Animation (MEDIUM), 7. Style Selection (MEDIUM), 8. Charts & Data (LOW) (+33 more)

### Community 22 - "Shared Sales Components"
Cohesion: 0.06
Nodes (33): ColumnaTabla, DataTable(), Direccion, Paginacion, Props, EmptyState(), Props, CONFIRM_COLOR (+25 more)

### Community 23 - "Businesses API Module"
Cohesion: 0.11
Nodes (16): MeReturnDto, IsIn, IsInt, IsOptional, IsString, IsUUID, IsOptional, IsString (+8 more)

### Community 24 - "Platform Admin DTOs"
Cohesion: 0.09
Nodes (18): IsArray, IsOptional, IsString, UpsertRoleDto, PermissionsController, Controller, Get, RolesController (+10 more)

### Community 25 - "POS Cash Register UI"
Cohesion: 0.06
Nodes (34): PlatformAdminGuard, Injectable, PlatformAdminContext, GrantCompDto, IsString, ListBusinessesQueryDto, IsIn, IsInt (+26 more)

### Community 26 - "Design System Inputs"
Cohesion: 0.07
Nodes (16): Inner, MapPicker(), Props, checkEmail(), checkSubdomain(), BA, Cuenta, EstadoSub (+8 more)

### Community 27 - "NestJS Module Registry"
Cohesion: 0.05
Nodes (64): Avatar(), AvatarProps, Badge(), BadgeConfig, BadgeProps, BadgeStatus, config, ButtonProps (+56 more)

### Community 28 - "Auth Module & Controller"
Cohesion: 0.03
Nodes (94): ApiAppearanceConfig, ApiDiscountEstado, ApiHeaderLink, ApiHeroSlide, ApiPermission, ApiProductDetail, ApiProductFull, ApiProductImage (+86 more)

### Community 30 - "Storefront Public UI"
Cohesion: 0.11
Nodes (12): BranchesService, Injectable, CreateBranchDto, IsBoolean, IsOptional, IsString, IsBoolean, IsLatitude (+4 more)

### Community 31 - "POS Modals & Drawers"
Cohesion: 0.11
Nodes (16): Get, CurrentUser, CustomerContext, assertCustomerContext(), AddressesController, Body, Controller, Delete (+8 more)

### Community 32 - "Categories API Controller"
Cohesion: 0.11
Nodes (23): ApiCategoryNode, panelCreateCategory(), panelDeleteCategory(), panelGetCategoryTree(), panelUpdateCategory(), aCatNode(), catBtn, CatCampos (+15 more)

### Community 33 - "Auth Context Decorators"
Cohesion: 0.09
Nodes (18): CreateReviewDto, IsString, IsUUID, HideReviewDto, IsString, ProductReviewsController, Controller, ReviewsController (+10 more)

### Community 34 - "Map Picker Component"
Cohesion: 0.06
Nodes (26): Skeleton(), SkeletonProps, Categoria, dataUrlToBlob(), getRubrosCatalog(), Rubro, Subrubro, WizardData (+18 more)

### Community 35 - "POS Catalog Grid"
Cohesion: 0.07
Nodes (25): ConversationsController, Body, Controller, Get, Param, Patch, Post, ConversationsModule (+17 more)

### Community 36 - "Branches API Controller"
Cohesion: 0.16
Nodes (13): ApiCategory, ApiProductRow, panelListProducts(), Props, DetalleProductos(), Props, CategoriaNode(), Props (+5 more)

### Community 37 - "Conversations API Controller"
Cohesion: 0.09
Nodes (31): Breadcrumb(), Crumb, CheckoutStepper(), Props, STEPS, NAV_LINKS_DEFAULT, Props, StorefrontHeader() (+23 more)

### Community 38 - "Storefront Product Cards"
Cohesion: 0.10
Nodes (15): CreateMpOrderDto, IsOptional, IsUUID, MercadopagoController, Body, Controller, Get, Post (+7 more)

### Community 39 - "POS Ticket Items"
Cohesion: 0.31
Nodes (6): AuthController, Body, Controller, Headers, Post, Throttle

### Community 40 - "Reviews API DTOs"
Cohesion: 0.11
Nodes (22): apToUpdateDto(), cardRadiusARadio(), COLOR_MODE_A_MODO, dtoToAp(), ESCALA_A_FONT_SCALE, fontScaleAEscala(), MODO_A_COLOR_MODE, AP_DEFAULTS (+14 more)

### Community 41 - "Tags API Module"
Cohesion: 0.09
Nodes (15): EmptyState(), EmptyStateProps, Input(), InputProps, Column, PaginationProps, Table(), TableProps (+7 more)

### Community 42 - "Discount Category List"
Cohesion: 0.12
Nodes (16): buildUrl(), LinkCompartibleSection(), MONO, Props, TipoDestino, abrigos, accesorios, calzado (+8 more)

### Community 43 - "Storefront Checkout Stepper"
Cohesion: 0.12
Nodes (18): AcceptInvitationDto, IsString, MinLength, ForgotPasswordDto, IsEmail, LoginDto, IsEmail, IsString (+10 more)

### Community 44 - "Discount Application Selector"
Cohesion: 0.33
Nodes (3): PrimerPasoProps, SERVICIOS, TurnosSetup()

### Community 45 - "TypeScript Reference Types"
Cohesion: 0.09
Nodes (9): SubscriptionsService, Injectable, SubscriptionsWebhookController, Body, Controller, Headers, Post, Query (+1 more)

### Community 46 - "POS Payment Hooks"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 47 - "API Package Dependencies"
Cohesion: 0.14
Nodes (15): badgeBase, BadgeTipo(), esDescuento(), Props, PropsTipoCupon, PropsTipoDescuento, Props, DIA_LABELS (+7 more)

### Community 48 - "API Dev Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, argon2, class-transformer, class-validator, express, handlebars, mercadopago, @nestjs/common (+23 more)

### Community 49 - "POS Cobro Payment UI"
Cohesion: 0.06
Nodes (33): devDependencies, jest, @nestjs/cli, @nestjs/schematics, @nestjs/testing, prisma, supertest, ts-jest (+25 more)

### Community 50 - "Domains API Controller"
Cohesion: 0.07
Nodes (28): 1. Listado de Descuentos y Cupones, 1. Porcentaje sobre producto/categoría, 2. Detalle de Descuento (solo lectura), 2. Monto fijo sobre producto/categoría, 3. Crear / Editar Descuento, 3. Porcentaje sobre el ticket, 4. Crear / Editar Cupón, 4. Monto fijo sobre el ticket (+20 more)

### Community 51 - "Message Templates DTOs"
Cohesion: 0.22
Nodes (8): InviteMemberDto, IsEmail, IsString, IsUUID, IsOptional, IsString, IsUUID, UpdateMemberDto

### Community 52 - "API TypeScript Config"
Cohesion: 0.10
Nodes (36): AnnouncementBar(), FloatingWhatsapp(), Props, getStorefrontCategories(), getStorefrontConfig(), getStorefrontProduct(), getStorefrontProducts(), hueFromId() (+28 more)

### Community 53 - "Config Appearance Settings"
Cohesion: 0.10
Nodes (20): [2026-07-27] Códigos de barras eliminados del producto, [2026-07-27] Duplicar producto: qué se copia y qué no, [2026-07-27] GET /reports/products implementado (el resto de reports sigue stub), [2026-07-27] Mock del catálogo eliminado y buscador del sidebar conectado, [2026-07-27] Panel de productos: decisiones de la UI, [2026-07-27] Reconciliación de variantes en PUT /products/:id — criterio definido, [2026-07-27] Valor de inventario a costo, con fallback a precio, [2026-07-28] `app.use(json(...))` quedó ANTES de `enableCors()` — tapaba errores reales con "blocked by CORS" (+12 more)

### Community 54 - "Storefront Public Controller"
Cohesion: 0.06
Nodes (43): BranchesController, Body, Controller, Delete, Get, Param, Post, Put (+35 more)

### Community 55 - "Cash Register API Module"
Cohesion: 0.11
Nodes (19): [2026-07-29] 9 campos nuevos en StorefrontConfig para que Apariencia sea "100% funcional", [2026-07-29] Alcance de esta fase: checkout/carrito/pedidos/cupones/reseñas/login de cliente NO se tocaron, [2026-07-29] Bug real encontrado y corregido en el pipeline de quitar fondo (sharp `joinChannel`), [2026-07-29] Detalle público de producto no expone `cost` ni stock exacto, [2026-07-29] `dtoToAp()` rompía en producción cuando heroSlides/headerLinks venían `null`, [2026-07-29] Footer real: se sacó la dirección hardcodeada, no hay campo real detrás, [2026-07-29] Normalización del modelo u2netp: constantes tomadas del código fuente oficial, no inventadas, [2026-07-29] Nuevo toggle `showSocialFooter` en vez de granularidad por cada elemento del footer (+11 more)

### Community 56 - "Payments Verify DTOs"
Cohesion: 0.26
Nodes (9): CuponResumen(), Props, PreviewCupon(), Props, CARDS, Props, TipoCard, TipoCuponSelector() (+1 more)

### Community 57 - "Storefront Me DTOs"
Cohesion: 0.11
Nodes (14): DomainsController, Body, Controller, Get, Param, Post, DomainsModule, Module (+6 more)

### Community 58 - "Store Preview Component"
Cohesion: 0.11
Nodes (15): IsIn, IsString, UpsertMessageTemplateDto, MessageTemplatesController, Body, Controller, Delete, Get (+7 more)

### Community 59 - "POS Returns Modal"
Cohesion: 0.13
Nodes (12): IsString, UpsertTagDto, TagsController, Body, Controller, Delete, Get, Param (+4 more)

### Community 60 - "Module Cluster 60"
Cohesion: 0.08
Nodes (25): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+17 more)

### Community 61 - "Module Cluster 61"
Cohesion: 0.15
Nodes (12): panelUploadStorefrontImage(), ColorBlock(), hline(), IconT, pageWrap, patternPreview(), SLIDE_GRADS, SlideBgColorPicker() (+4 more)

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
Cohesion: 0.21
Nodes (12): Composer(), HashTrigger, Props, fmtMonto(), PedidoMencionPopover(), Props, PlantillaPopover(), CHAT_MSGS_BY_CV (+4 more)

### Community 66 - "Module Cluster 66"
Cohesion: 0.14
Nodes (12): AppModule, Module, HttpExceptionFilter, HttpRequestLike, HttpResponseLike, bootstrap(), NOTE: Not covered automatically — requires a PENDING member with hasTempPassword, MockIdentity (+4 more)

### Community 67 - "Module Cluster 67"
Cohesion: 0.13
Nodes (13): IsOptional, IsString, VerifyPaymentDto, PaymentsController, Body, Controller, Get, Param (+5 more)

### Community 68 - "Module Cluster 68"
Cohesion: 0.10
Nodes (23): FullModeOnly(), Public(), Get, Param, StorefrontProductsQueryDto, IsBoolean, IsInt, IsOptional (+15 more)

### Community 69 - "Módulo: Custom Domains"
Cohesion: 0.17
Nodes (11): FindOrdersQueryDto, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min (+3 more)

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
Cohesion: 0.24
Nodes (3): AuthService, Injectable, GoogleIdentity

### Community 74 - "Module Cluster 74"
Cohesion: 0.20
Nodes (8): ComprobanteBase(), ComprobanteBaseProps, ComprobanteEmisor, ComprobanteItem, ComprobanteTotal, fmtMonto(), FECHA_HOY, HORA_HOY

### Community 75 - "Module Cluster 75"
Cohesion: 0.20
Nodes (7): AuditController, Controller, Get, AuditModule, Module, AuditService, Injectable

### Community 76 - "Module Cluster 76"
Cohesion: 0.19
Nodes (9): CustomerAuthResponse, LoginResponse, MemberAuthResponse, PlatformAdminAuthResponse, Body, Post, GoogleOAuthExchangeStore, StoredSession (+1 more)

### Community 77 - "Module Cluster 77"
Cohesion: 0.10
Nodes (22): IconType, Modulo, MODULOS, Props, resItem, resLabel, RUBROS, SECCION_MODULO (+14 more)

### Community 78 - "Module Cluster 78"
Cohesion: 0.06
Nodes (34): Aceptar invitación de miembro (contraseña temporal), Actualizar negocio, Aislamiento multi-tenant, Apariencia del storefront, Catálogo de permisos, Config operativa (contacto, pagos, envíos, redes), Contexto del usuario logueado, Crear / actualizar sucursal (+26 more)

### Community 79 - "Module Cluster 79"
Cohesion: 0.07
Nodes (26): CustomersController, Body, Controller, Get, Param, Post, Put, Query (+18 more)

### Community 80 - "Paginacion.tsx"
Cohesion: 0.21
Nodes (14): bffFetch(), hacerRefresh(), tokenStore, tryRefresh(), AuthContext, AuthContextValue, authHeaders(), AuthProvider() (+6 more)

### Community 81 - "Module Cluster 81"
Cohesion: 0.12
Nodes (17): devDependencies, babel-plugin-react-compiler, eslint, eslint-config-next, tailwindcss, @types/aos, @types/node, @types/react (+9 more)

### Community 82 - "Module Cluster 82"
Cohesion: 0.24
Nodes (15): BackendResult, callBackend(), clearRefreshCookie(), cookieDomain(), firstHeader(), readRefreshCookie(), serializeCookie(), setRefreshCookie() (+7 more)

### Community 83 - "Module Cluster 83"
Cohesion: 0.09
Nodes (23): CreateProductDto, ProductOptionInput, ProductVariantInput, IsArray, IsBoolean, IsIn, IsInt, IsNumber (+15 more)

### Community 84 - "Module Cluster 84"
Cohesion: 0.12
Nodes (20): Props, ModalPlantilla(), Props, ModalUsarPlantilla(), Props, CATEGORIA_LABELS, PlantillaCard(), Props (+12 more)

### Community 85 - "Module Cluster 85"
Cohesion: 0.12
Nodes (17): dependencies, exceljs, leaflet, lucide-react, next, react, react-dom, @types/leaflet (+9 more)

### Community 86 - "Module Cluster 86"
Cohesion: 0.17
Nodes (12): Cambiar estado de la orden, Crear orden (POS u online), Enviar comprobante, Fase 5 — Órdenes y pagos, Listar órdenes, Módulo: Cash Movements, Módulo: Orders, Módulo: Payments (+4 more)

### Community 87 - "Module Cluster 87"
Cohesion: 0.11
Nodes (19): Actualizar estado de devolución, Bandeja de conversaciones, Crear devolución, Crear opinión, CRUD de plantillas, Elegibilidad para opinar (deeplink de email post-entrega), Enviar mensaje, Fase 8 — Postventa y comunicación (+11 more)

### Community 88 - "Module Cluster 88"
Cohesion: 0.22
Nodes (7): MembersController, Body, Controller, Delete, Param, Post, Put

### Community 89 - "Module Cluster 89"
Cohesion: 0.16
Nodes (7): ReportsController, Controller, Get, ReportsModule, Module, ReportsService, Injectable

### Community 90 - "Module Cluster 90"
Cohesion: 0.12
Nodes (17): [2026-07-16] `Branch` no persiste lat/lng — dirección es solo texto libre, [2026-07-16] Bug de infraestructura: `apps/web` nunca tuvo su propio `pnpm install`, [2026-07-16] Bug de infraestructura: el navegador de prueba (Browser pane) no hidrata NINGUNA página del frontend, [2026-07-16] Bug de infraestructura: `$transaction` de `registerBusiness()` excedía el timeout (P2028), [2026-07-16] `Business.industry` se crea vacío (`''`) en el registro, [2026-07-16] `POST /onboarding/register-business` compartía servicio con el seed script — no se hizo, [2026-07-16] `PUT /onboarding/business` como endpoint separado de `PUT /business`, gateado por `isActive`, [2026-07-16] RBT-293 — Persistencia completa del wizard de onboarding (+9 more)

### Community 92 - "Module Cluster 92"
Cohesion: 0.20
Nodes (10): BcItem, CUPONES_VISTA_LABELS, DESCUENTOS_VISTA_LABELS, Header(), Notif, NOTIFS, Props, seccionLabels (+2 more)

### Community 93 - "Module Cluster 93"
Cohesion: 0.16
Nodes (18): badgeColor(), ProductCard(), Props, CATEGORIAS, DESCUENTOS_EXCLUSIVOS, PRODUCTOS, Categoria, Cupon (+10 more)

### Community 94 - "Module Cluster 94"
Cohesion: 0.13
Nodes (15): DIRECCIONES, HISTORIAL_MOCK, MensajeCliente, MENSAJES_MOCK, USUARIO_MOCK, Burbuja(), ESTADO_COLOR, MensajesCliente() (+7 more)

### Community 95 - "Module Cluster 95"
Cohesion: 0.31
Nodes (7): Avatar(), Props, btnOutline, ChatHeader(), Props, Props, Conversacion

### Community 96 - "Module Cluster 96"
Cohesion: 0.12
Nodes (16): Ambigüedades, Campos calculados (NO persistir) — `TotalesPOS`, Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas, `MetodoPago` (PaymentMethod, embebido), `MovimientoCaja` (CashMovement) (+8 more)

### Community 97 - "Module Cluster 97"
Cohesion: 0.09
Nodes (24): panelGetDiscount(), DetalleConfiguracion(), fmt(), getRows(), Props, DetalleEncabezado(), Props, DetalleRendimiento() (+16 more)

### Community 98 - "Module Cluster 98"
Cohesion: 0.12
Nodes (15): Checklist antes de dar por terminada cada fase, CLAUDE.md — Módulo de Descuentos y Cupones, Componentes a crear, Componentes internos (`components/`), Componentes potencialmente compartidos, Contexto, Datos mock, Endpoints futuros (referencia para hooks) (+7 more)

### Community 99 - "Module Cluster 99"
Cohesion: 0.11
Nodes (17): Buscar disponibilidad de dominio, Comprar dominio (camino 3), Dashboard, Estado de SSL, Fase 12 — Dominios, Fase 6 — MercadoPago, Fase 9 — Transversal, Fase (Reportes) (+9 more)

### Community 100 - "Module Cluster 100"
Cohesion: 0.12
Nodes (16): Actualizar / eliminar producto, Crear / editar / eliminar categoría, Crear producto (transacción completa), CRUD de tags, Códigos de barras, Eliminar / reordenar / marcar principal, Fase 2 — Catálogo, Listar categorías (árbol) (+8 more)

### Community 101 - "Module Cluster 101"
Cohesion: 0.13
Nodes (15): Ambigüedades, Campos calculados (NO persistir), `Cupon` (Coupon) — con código, canjeable, Datos que consume, Datos que envía, ⚠️ Decisión de arquitectura no anticipada por este análisis: `Descuento` y `Cupon` se UNIFICAN, `Descuento` (Discount) — automático o manual, sin código, Endpoints necesarios (confirmados en `descuentos/CLAUDE.md`) (+7 more)

### Community 102 - "Module Cluster 102"
Cohesion: 0.08
Nodes (25): [2026-07-12] GUIA_PRUEBA_MANUAL_FASES_1_2.md no existe en apps/api, [2026-07-13] `apps/api/scripts/reset-unlinked-customer.ts` no existe, [2026-07-13] Bug de infraestructura: `@supabase/supabase-js` no funciona en Node 20 sin polyfill de WebSocket, [2026-07-13] `pnpm add` en un subproyecto pnpm puede podar dependencias de otro `pnpm install` previo, [2026-07-14] Análisis pre-implementación: 7 fallas detectadas, 4 resueltas, [2026-07-14] Módulo completo sin implementar — `CustomersService` es un stub, [2026-07-18] Error intermitente: "new row violates row-level security policy" al subir a Storage — sin causa raíz confirmada, autoresuelto, 2026-07-24 — Auditoría de mis fases + arreglos (Alex) (+17 more)

### Community 104 - "Module Cluster 104"
Cohesion: 0.15
Nodes (12): File Structure, Fuera de alcance de este plan (decisión a confirmar con el equipo, no tomada acá), Global Constraints, Motor de Descuentos + CRUD (RBT-613, RBT-614) Implementation Plan, Self-Review (completado al escribir este plan), Task 1: DTO de filtros del listado, Task 2: Motor de evaluación — funciones puras, Task 3: `DiscountsService` — lectura (findAll, findOne) + controller (+4 more)

### Community 105 - "Module Cluster 105"
Cohesion: 0.15
Nodes (14): CheckoutBuyerInput, CheckoutDto, CheckoutItemInput, IsArray, IsEmail, IsIn, IsInt, IsObject (+6 more)

### Community 106 - "Module Cluster 106"
Cohesion: 0.12
Nodes (20): NAV_LINKS, Navbar(), OrbitSystem(), RING_SIZES, SatDef, SATS, AVATARS, Hero() (+12 more)

### Community 107 - "PedidoTable.tsx"
Cohesion: 0.29
Nodes (4): Msg, OrbiChat(), Props, QuickAction

### Community 108 - "Module Cluster 108"
Cohesion: 0.14
Nodes (14): Ambigüedades, `Apariencia` / `StorefrontConfig` (1:1 con Negocio), `ConfigNotificaciones` (1:1 con Negocio), Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas, `Miembro` (BusinessMember) (+6 more)

### Community 109 - "Module Cluster 109"
Cohesion: 0.09
Nodes (24): Roles(), DiscountsController, Body, Controller, Delete, Get, Param, Patch (+16 more)

### Community 110 - "Module Cluster 110"
Cohesion: 0.10
Nodes (14): Appt, CalendarCard(), DAYS, INITIAL_APPTS, NEW_BOOKINGS, NUMS, WEEK_GRID, UnifiedPanelCard() (+6 more)

### Community 111 - "Module Cluster 111"
Cohesion: 0.20
Nodes (9): collection, compilerOptions, assets, deleteOutDir, watchAssets, $schema, sourceRoot, background-removal/models/**/*.onnx (+1 more)

### Community 112 - "Module Cluster 112"
Cohesion: 0.22
Nodes (6): BackgroundRemovalModule, Module, BackgroundRemovalService, MEAN, STD, Injectable

### Community 113 - "businesses.controller.ts"
Cohesion: 0.08
Nodes (26): ChangeModeDto, IsIn, PauseBusinessDto, IsBoolean, IsBoolean, IsOptional, Transform, UploadStorefrontImageDto (+18 more)

### Community 114 - "Module Cluster 114"
Cohesion: 0.22
Nodes (8): exclude, extends, dist, node_modules, prisma, **/*spec.ts, test, ./tsconfig.json

### Community 115 - "businesses.service.ts"
Cohesion: 0.15
Nodes (13): [2026-07-29] Alcance: solo los 4 tipos "triviales" de V1, [2026-07-29] `couponCode` en `evaluate()` todavía no hace nada, [2026-07-29] Cómo se combinan un descuento de ítem y uno de ticket (no estaba en el spec), [2026-07-29] El repo local quedó sin compilar tras un `git pull` (deps + cliente Prisma), [2026-07-29] Endpoints de `/discounts` que siguen stub, [2026-07-29] `evaluate()` no registra el canje — bloqueante para RF-07, [2026-07-29] `evaluate()` usa el precio de la BASE, no el del request, [2026-07-29] Los tests e2e de Auth comparten un fixture mutable: fallan por contaminación, no por bugs (+5 more)

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
Cohesion: 0.24
Nodes (7): PresentationSections(), SLIDES, Window, Testimonial, TESTIMONIALS, Upcoming, UpcomingItem

### Community 120 - "MembersService"
Cohesion: 0.29
Nodes (7): Abrir caja, Cerrar caja, Forzar cierre, Historial de sesiones, Módulo: Cash Sessions, Resumen de turno, Sesión abierta actual

### Community 121 - "Module Cluster 121"
Cohesion: 0.39
Nodes (7): FacebookIcon(), IconProps, InstagramIcon(), TiktokIcon(), Contact, Props, StorefrontFooter()

### Community 122 - "ListBusinessesQueryDto"
Cohesion: 0.29
Nodes (5): ConfirmSubscriptionDto, IsNotEmpty, IsString, Body, Post

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
Cohesion: 0.18
Nodes (17): CreateOrderDto, OrderBuyerInput, OrderItemInput, OrderPaymentInput, IsArray, IsBoolean, IsEmail, IsIn (+9 more)

### Community 129 - "Module Cluster 129"
Cohesion: 0.05
Nodes (42): CartItemForEngine, computeItemDiscountAmount(), computeTicketDiscountAmount(), EligibleDiscount, esTipoSoportado(), evaluateCart(), EvaluationResult, ItemDiscountResult (+34 more)

### Community 130 - "Module Cluster 130"
Cohesion: 0.06
Nodes (51): ApiError, ApiOrderDetail, ApiOrdersPage, ApiOrderSummary, ApiProductListItem, createOrder(), getCustomers(), getOrder() (+43 more)

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
Cohesion: 0.40
Nodes (4): AccionesGuardado(), Props, ModalPreviewConfirmacion(), Props

### Community 141 - "Module Cluster 141"
Cohesion: 0.13
Nodes (14): NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS, IsArray, IsBoolean, IsEmail, IsNumber, IsOptional, IsString (+6 more)

### Community 142 - "Module Cluster 142"
Cohesion: 0.18
Nodes (10): 1. POST /auth/accept-invitation, 2. POST /auth/reset-password, 3. Registro de customerWithoutAccount — idempotencia limitada, 4. Registro exitoso — residuo en Supabase, Auth (auth.e2e-spec.ts) — 17 tests, Branches (branches.e2e-spec.ts) — 8 tests, Business (business.e2e-spec.ts) — 17 tests, Casos no cubiertos (+2 more)

### Community 143 - "Module Cluster 143"
Cohesion: 0.40
Nodes (5): btnStyle(), CSSProps, OPCIONES_POR_PAGINA, PagBtn(), Props

### Community 145 - "OrdersService"
Cohesion: 0.40
Nodes (5): [2026-07-17] Aislamiento multi-tenant en AuthGuard y login/register, [2026-07-17] `register()` verifica la contraseña implícitamente al hacer `signInWithPassword`, [2026-07-28] Un deploy de Railway forzaba relogin a todos los usuarios — el BFF borraba la cookie de refresh ante CUALQUIER error, no solo un token inválido, [2026-07-29] CAUSA RAÍZ del relogin en cada recarga: dos refresh concurrentes sobre un token de un solo uso, Fase 1 — Auth (corrección crítica)

### Community 146 - "RegisterDto"
Cohesion: 0.25
Nodes (4): JwtPayload, AuthGuard, RequestWithUser, Injectable

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
Cohesion: 0.04
Nodes (42): AuthModule, Global, Module, BranchesModule, Module, BusinessesModule, Module, CategoriesModule (+34 more)

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
Cohesion: 0.40
Nodes (3): MailModule, Global, Module

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
Cohesion: 0.40
Nodes (5): Endpoints de super-admin (plataforma), Endpoints públicos (sin auth), Endpoints que requieren `modo = FULL` (403 en SHOWCASE), Gaps resueltos, Resumen y anexos

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
Cohesion: 0.50
Nodes (3): ImgUploader(), ImgUploaderProps, smallBtn

### Community 180 - "Module Cluster 180"
Cohesion: 0.29
Nodes (6): fontFamily, letterSpacing, lineHeight, prose, TextStyleKey, textStyles

### Community 183 - "Module Cluster 183"
Cohesion: 0.19
Nodes (9): RequireAuth(), apexUrl(), storefrontBase(), tenantUrl(), ERROR_MESSAGES, GoogleCallback(), Status, Estado (+1 more)

### Community 186 - "Module Cluster 186"
Cohesion: 0.33
Nodes (6): [2026-07-12] Login de member enviando header X-Business-Slug: prioriza member, [2026-07-12] POST /auth/accept-invitation y POST /auth/reset-password sin test e2e, [2026-07-12] Tests e2e crean usuarios reales en Supabase que no se limpian, [2026-07-20] Suite e2e corre contra una base Supabase compartida real, no una DB de test efímera, [2026-07-20] Throttler real activo en tests — deshabilitado explícitamente vía skipIf, Tests E2E

### Community 187 - "RegisterDto"
Cohesion: 0.33
Nodes (5): RegisterDto, IsEmail, IsOptional, IsString, MinLength

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
Cohesion: 0.50
Nodes (5): panelGetAppearance(), Apariencia(), FontSelect(), fontStack(), loadFont()

### Community 193 - "Module Cluster 193"
Cohesion: 0.24
Nodes (8): cols, Footer(), LegalKey, LEGAL_CONTENT, LegalKey, LegalModal(), Props, LegalModal()

### Community 195 - "Module Cluster 195"
Cohesion: 0.25
Nodes (8): [2026-07-20] Credenciales de Google OAuth son placeholders — no funciona contra Google real, [2026-07-20] Decisión: vincular password a cuenta creada por Google, no rechazar el registro, [2026-07-20] Exchange code de Google OAuth vive en memoria — asume deployment single-instance, [2026-07-20] Fixtures del seed no reseteaban `googleId` entre corridas — corregido, [2026-07-20] Librería y decisiones de diseño confirmadas antes de implementar, [2026-07-20] `state` de OAuth firmado con el mismo secret que los JWT (`JWT_SECRET`), [2026-07-20] Tests de Google OAuth cubiertos — 9/9, más los 8 de aislamiento sin regresión, RBT-287 — Google OAuth

### Community 197 - "Module Cluster 197"
Cohesion: 0.40
Nodes (4): Arquitectura / decisiones técnicas, Auth: NO usa Supabase Auth, graphify, Órbita — contexto del proyecto

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
Cohesion: 0.50
Nodes (4): [2026-07-13] Bug propio detectado y corregido en el momento: protección de borrado de Supplier basada en un supuesto incorrecto sobre el FK, [2026-07-13] Filtro `lowStock` y paginación de `GET /inventory/stock` se resuelven en memoria, [2026-07-13] `POST /inventory/adjustment` bloquea si el resultado da stock negativo, Fase 5 — Inventario (Inventory/Suppliers)

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

### Community 236 - "Module Cluster 236"
Cohesion: 0.10
Nodes (19): Comportamiento actual, Comportamiento actual, Comportamiento actual, Comportamiento esperado, Comportamiento esperado, Comportamiento esperado, Conclusión, Contexto técnico (+11 more)

## Knowledge Gaps
- **1315 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `mail/templates/**/*.hbs` (+1310 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthContext` connect `Storefront Public Controller` to `Storefront Checkout Stepper`, `Module Cluster 109`, `Discount Tables UI`, `Module Cluster 79`, `businesses.controller.ts`, `RegisterDto`, `Discount Detail Views`, `Module Cluster 88`, `Platform Admin DTOs`, `POS Returns Modal`, `POS Modals & Drawers`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `Orders API DTOs` to `Module Cluster 129`, `Team Config Forms`, `Module Cluster 141`, `Discount Tables UI`, `MercadoPago DTOs`, `RegisterDto`, `Discount Detail Views`, `Module Cluster 152`, `POS Cash Register UI`, `Platform Admin DTOs`, `Members Invitation DTOs`, `Storefront Public UI`, `Auth Context Decorators`, `POS Catalog Grid`, `Storefront Product Cards`, `Storefront Checkout Stepper`, `TypeScript Reference Types`, `Message Templates DTOs`, `Storefront Me DTOs`, `Store Preview Component`, `POS Returns Modal`, `Module Cluster 64`, `Module Cluster 66`, `Module Cluster 67`, `Module Cluster 68`, `Módulo: Custom Domains`, `Module Cluster 70`, `Module Cluster 75`, `Module Cluster 79`, `Module Cluster 83`, `Module Cluster 89`, `Module Cluster 91`, `@types/multer`, `Module Cluster 112`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `Roles()` connect `Module Cluster 109` to `Auth Context Decorators`, `Module Cluster 67`, `Storefront Product Cards`, `Module Cluster 75`, `MercadoPago DTOs`, `businesses.controller.ts`, `Storefront Public Controller`, `Module Cluster 88`, `Storefront Me DTOs`, `Store Preview Component`, `Platform Admin DTOs`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _1315 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Design System Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07960199004975124 - nodes in this community are weakly interconnected._
- **Should `Discounts UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.10338680926916222 - nodes in this community are weakly interconnected._
- **Should `Messaging Module` be split into smaller, more focused modules?**
  _Cohesion score 0.10588235294117647 - nodes in this community are weakly interconnected._