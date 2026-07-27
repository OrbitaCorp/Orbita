# Graph Report - Orbita-Frontend  (2026-07-20)

## Corpus Check
- 673 files · ~313,425 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4498 nodes · 8342 edges · 296 communities (274 shown, 22 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4136196c`
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
- Module Cluster 69
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
- Module Cluster 80
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
- Module Cluster 103
- Module Cluster 104
- Module Cluster 105
- Module Cluster 106
- Module Cluster 107
- Module Cluster 108
- Module Cluster 109
- Module Cluster 110
- Module Cluster 111
- Module Cluster 112
- Module Cluster 113
- Module Cluster 114
- Module Cluster 115
- Module Cluster 116
- Module Cluster 117
- Module Cluster 118
- Module Cluster 119
- Module Cluster 120
- Module Cluster 121
- Module Cluster 122
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
- Module Cluster 145
- Module Cluster 146
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
- Module Cluster 157
- Module Cluster 158
- Module Cluster 159
- Module Cluster 160
- Module Cluster 161
- Module Cluster 162
- Module Cluster 163
- Module Cluster 164
- Module Cluster 165
- Module Cluster 166
- Module Cluster 167
- Module Cluster 168
- Module Cluster 169
- Module Cluster 170
- Module Cluster 171
- Module Cluster 172
- Module Cluster 173
- Module Cluster 174
- Module Cluster 175
- Module Cluster 176
- Module Cluster 177
- Module Cluster 178
- Module Cluster 179
- Module Cluster 180
- Module Cluster 181
- Module Cluster 182
- Module Cluster 183
- Module Cluster 184
- Module Cluster 185
- Module Cluster 186
- Module Cluster 187
- Module Cluster 188
- Module Cluster 189
- Module Cluster 190
- Module Cluster 191
- Module Cluster 192
- Module Cluster 193
- Module Cluster 194
- Module Cluster 195
- Module Cluster 196
- Module Cluster 197
- Module Cluster 198
- Module Cluster 199
- Module Cluster 200
- Module Cluster 201
- Module Cluster 202
- Module Cluster 203
- Module Cluster 204
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
- Module Cluster 220
- Module Cluster 221
- Module Cluster 222
- Module Cluster 223
- Module Cluster 224
- Module Cluster 225
- Module Cluster 226
- Module Cluster 227
- Module Cluster 228
- Module Cluster 229
- @supabase/supabase-js
- supertest
- @types/multer

## God Nodes (most connected - your core abstractions)
1. `AuthContext` - 93 edges
2. `CurrentBusiness` - 76 edges
3. `assertMemberContext()` - 76 edges
4. `Roles()` - 72 edges
5. `PrismaService` - 71 edges
6. `fmtMoney()` - 46 edges
7. `RequirePermission()` - 40 edges
8. `Button()` - 38 edges
9. `Public()` - 36 edges
10. `AuthService` - 30 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  apps/api/src/main.ts → apps/api/src/app.module.ts
- `RequestWithUser` --references--> `AuthContext`  [EXTRACTED]
  apps/api/src/common/guards/auth.guard.ts → apps/api/src/common/types/auth-context.type.ts
- `PedidoMencionPopover()` --calls--> `fmt()`  [EXTRACTED]
  apps/web/src/modules/ventas/cliente/perfil/components/MensajesCliente.tsx → apps/web/src/lib/storefront/utils.ts
- `Perfil()` --calls--> `fmt()`  [EXTRACTED]
  apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx → apps/web/src/lib/storefront/utils.ts
- `ListaView()` --calls--> `fmtMoney()`  [EXTRACTED]
  apps/web/src/modules/ventas/panel/catalogo/ProductoLista.tsx → apps/web/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (296 total, 22 thin omitted)

### Community 0 - "Design System Components"
Cohesion: 0.07
Nodes (45): AlcanceCard, AlcanceSelector(), CARDS, Props, BeneficioBonusSelector(), OPCIONES, Props, CategoriaLista() (+37 more)

### Community 1 - "Discounts UI Components"
Cohesion: 0.05
Nodes (70): Avatar(), AvatarProps, Badge(), BadgeConfig, BadgeProps, BadgeStatus, config, KpiCard() (+62 more)

### Community 2 - "Messaging Module"
Cohesion: 0.05
Nodes (50): catBtn, CatCampos, Categorias(), CatModal(), cl, countAll(), ICON_MAP, IconComp (+42 more)

### Community 3 - "Inventory API DTOs"
Cohesion: 0.06
Nodes (30): BusinessesController, Body, Controller, Post, Put, UploadedFile, UseInterceptors, BusinessesService (+22 more)

### Community 4 - "Catalog Categories UI"
Cohesion: 0.08
Nodes (15): AppController, Controller, Get, AuditController, Controller, Get, AuditModule, Module (+7 more)

### Community 5 - "Branches API Module"
Cohesion: 0.09
Nodes (28): badgeBase, BadgeTipo(), esDescuento(), Props, PropsTipoCupon, CuponCardMobile(), ESTADO_ACCENT, fmtRangoCompacto() (+20 more)

### Community 6 - "Design System Charts"
Cohesion: 0.05
Nodes (51): CONFIG, Props, fmt(), MetricasDrawer(), MiniKpi2Props, Props, CANALES, MetricasFiltros() (+43 more)

### Community 7 - "Discount Coupon Cards"
Cohesion: 0.09
Nodes (45): createRole(), deleteRole(), updateRole(), Err(), Inp(), InpProps, Lbl(), PasswordField() (+37 more)

### Community 8 - "Discount Badge & Metrics"
Cohesion: 0.11
Nodes (17): ColorBlock(), IconT, pageWrap, SLIDE_GRADS, AP_DEFAULTS, EscalaFuente, FONT_DESCRIPCIONES, GOOGLE_FONTS (+9 more)

### Community 9 - "API Auth Decorators"
Cohesion: 0.05
Nodes (42): BM25, detect_domain(), _load_csv(), Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query, Load CSV and return list of dicts, Core search function using BM25 (+34 more)

### Community 10 - "Shared Web Components"
Cohesion: 0.10
Nodes (24): authedFetch(), AuthError, bffFetch(), googleLoginUrl(), tokenStore, tryRefresh(), AuthContext, AuthContextValue (+16 more)

### Community 11 - "Team Config Forms"
Cohesion: 0.06
Nodes (42): CAJEROS_MOCK, ESTADOS_FILTER, FiltrosHistorial(), Props, ESTADO_CFG, FMT, formatFechaHora(), LABEL_METODO (+34 more)

### Community 12 - "POS History Filters"
Cohesion: 0.11
Nodes (29): ESTADO_ACCENT, FilaDescuento(), FilaDescuentoCard(), fmtFecha(), fmtRangoCompacto(), HEADS, HEADS_ORD, MONO (+21 more)

### Community 13 - "MercadoPago DTOs"
Cohesion: 0.06
Nodes (31): CreditNotesController, Body, Controller, Get, Post, CreateCreditNoteDto, IsIn, IsNumber (+23 more)

### Community 14 - "Discount Tables UI"
Cohesion: 0.08
Nodes (23): CategoriesController, Body, Controller, Get, Patch, Post, Query, CategoriesService (+15 more)

### Community 15 - "Returns & Credit Notes API"
Cohesion: 0.09
Nodes (28): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeStyles, variantStyles, pageWrap, Props (+20 more)

### Community 16 - "Discount Filters & Coupons"
Cohesion: 0.06
Nodes (42): Props, DescuentosFiltros(), selectStyle, DescuentosTabla(), btnPrimario, btnSecundario, CuponesListado(), Props (+34 more)

### Community 17 - "Design System Cards"
Cohesion: 0.08
Nodes (35): Card(), CardProps, paddingMap, CardSectionProps, BarChart(), BarChartProps, BarItem, DonutChart() (+27 more)

### Community 18 - "Orders API DTOs"
Cohesion: 0.11
Nodes (16): SendReceiptDto, IsEmail, IsOptional, IsIn, UpdateOrderStatusDto, OrdersController, Body, Controller (+8 more)

### Community 19 - "Discount Detail Views"
Cohesion: 0.05
Nodes (45): FindMovementsQueryDto, IsIn, IsInt, IsOptional, IsUUID, Max, Min, Type (+37 more)

### Community 20 - "Backend Implementation Phases"
Cohesion: 0.12
Nodes (20): AccionesGuardado(), Props, BadgeEstado(), CuponResumen(), DetalleEncabezado(), Props, DetalleVigencia(), DIAS (+12 more)

### Community 21 - "Onboarding Business DTOs"
Cohesion: 0.05
Nodes (41): 1. Accessibility (CRITICAL), 2. Touch & Interaction (CRITICAL), 3. Performance (HIGH), 4. Layout & Responsive (HIGH), 5. Typography & Color (MEDIUM), 6. Animation (MEDIUM), 7. Style Selection (MEDIUM), 8. Charts & Data (LOW) (+33 more)

### Community 22 - "Shared Sales Components"
Cohesion: 0.08
Nodes (27): EmptyState(), Props, FORMATO, MontoDisplay(), MontoSize, Props, SIZE_PX, btnStyle() (+19 more)

### Community 23 - "Businesses API Module"
Cohesion: 0.09
Nodes (30): fechaLarga(), fmtMoney(), saludoHora(), ClienteCard(), iconBtn, ListaView(), pageWrap, relTime() (+22 more)

### Community 24 - "Platform Admin DTOs"
Cohesion: 0.10
Nodes (14): IsArray, IsOptional, IsString, UpsertRoleDto, PermissionsController, Controller, Get, RolesController (+6 more)

### Community 25 - "POS Cash Register UI"
Cohesion: 0.09
Nodes (21): GrantCompDto, IsString, SuspendBusinessDto, IsOptional, IsString, IsEmail, IsIn, IsString (+13 more)

### Community 26 - "Design System Inputs"
Cohesion: 0.07
Nodes (16): Inner, MapPicker(), Props, checkEmail(), checkSubdomain(), BA, Cuenta, EstadoSub (+8 more)

### Community 27 - "NestJS Module Registry"
Cohesion: 0.09
Nodes (21): CashController, Body, Controller, Get, Param, Post, CashModule, Module (+13 more)

### Community 28 - "Auth Module & Controller"
Cohesion: 0.10
Nodes (32): ApiPermission, ApiRole, changeBusinessMode(), completeOnboarding(), getBusiness(), getBusinessConfig(), getOnboardingSession(), getPermissionsCatalog() (+24 more)

### Community 29 - "Members Invitation DTOs"
Cohesion: 0.08
Nodes (24): 0. Decisiones cerradas, 1. Inventario de pantallas y componentes, 2. Pantalla — Apertura de caja `/tienda/pos/open`, 4. Pantalla — Cierre de caja `/tienda/pos/close`, 5.1 Lista, 5.2 Detalle de sesión (modal o vista), 5.3 Estados, 5.4 Permisos (+16 more)

### Community 30 - "Storefront Public UI"
Cohesion: 0.09
Nodes (20): BranchesController, Body, Controller, Delete, Get, Param, Post, Put (+12 more)

### Community 31 - "POS Modals & Drawers"
Cohesion: 0.11
Nodes (17): Get, CurrentUser, assertCustomerContext(), AddressesController, Body, Controller, Delete, Get (+9 more)

### Community 32 - "Categories API Controller"
Cohesion: 0.08
Nodes (25): ConteoCierre(), FMT, inputBase, labelStyle, parseMonto(), Props, DiferenciaIndicador(), FMT (+17 more)

### Community 33 - "Auth Context Decorators"
Cohesion: 0.10
Nodes (18): CreateReviewDto, IsString, IsUUID, HideReviewDto, IsString, ProductReviewsController, Controller, ReviewsController (+10 more)

### Community 34 - "Map Picker Component"
Cohesion: 0.09
Nodes (18): Msg, OrbiChat(), Props, QuickAction, Categoria, getRubrosCatalog(), Rubro, Subrubro (+10 more)

### Community 35 - "POS Catalog Grid"
Cohesion: 0.22
Nodes (15): DrawerPausados(), ModalVariante(), TicketPOS(), POSApertura(), POSCierre(), POSCobro(), SK, abreviarNombre() (+7 more)

### Community 36 - "Branches API Controller"
Cohesion: 0.08
Nodes (31): Get, Delete, Param, Put, CurrentBusiness, RequirePermission(), assertMemberContext(), Body (+23 more)

### Community 37 - "Conversations API Controller"
Cohesion: 0.14
Nodes (18): Breadcrumb(), Crumb, Props, StorefrontFooter(), NAV_LINKS, Props, StorefrontHeader(), CUPONES_MOCK (+10 more)

### Community 38 - "Storefront Product Cards"
Cohesion: 0.06
Nodes (27): CreateMpOrderDto, IsOptional, IsUUID, CreateMpPosDto, IsOptional, IsString, IsUUID, CreateMpStoreDto (+19 more)

### Community 39 - "POS Ticket Items"
Cohesion: 0.15
Nodes (20): CatalogoPOS(), GRID, Props, FiltrosCatalogo(), Props, GrillaProductos(), Props, FORMATO (+12 more)

### Community 40 - "Reviews API DTOs"
Cohesion: 0.09
Nodes (31): btnQty, FORMATO, Props, TicketItemRow(), FORMATO, Props, DescuentoDesglose, FilaProps (+23 more)

### Community 41 - "Tags API Module"
Cohesion: 0.10
Nodes (14): EmptyState(), EmptyStateProps, Input(), InputProps, KpiCardProps, Skeleton(), SkeletonProps, Column (+6 more)

### Community 42 - "Discount Category List"
Cohesion: 0.13
Nodes (12): DetalleProductos(), Props, abrigos, accesorios, calzado, pantalones, productosMock, TODO: Reemplazar por GET /api/productos/arbol (+4 more)

### Community 43 - "Storefront Checkout Stepper"
Cohesion: 0.09
Nodes (24): JwtPayload, AcceptInvitationDto, IsString, MinLength, ForgotPasswordDto, IsEmail, LoginDto, IsEmail (+16 more)

### Community 44 - "Discount Application Selector"
Cohesion: 0.07
Nodes (24): ConversationsController, Body, Controller, Get, Param, Patch, Post, ConversationsModule (+16 more)

### Community 45 - "TypeScript Reference Types"
Cohesion: 0.11
Nodes (9): SubscriptionsModule, Module, PlanConfig, SubscriptionsService, Injectable, SubscriptionsWebhookController, Body, Controller (+1 more)

### Community 46 - "POS Payment Hooks"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 47 - "API Package Dependencies"
Cohesion: 0.07
Nodes (34): AplicacionCard, AplicacionSelector(), CARDS, Props, PropsTipoDescuento, ConfigVolumen(), EscalaForm, DetalleRendimiento() (+26 more)

### Community 48 - "API Dev Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, argon2, class-transformer, class-validator, handlebars, jsonwebtoken, mercadopago, @nestjs/common (+19 more)

### Community 49 - "POS Cobro Payment UI"
Cohesion: 0.07
Nodes (29): devDependencies, jest, @nestjs/cli, @nestjs/schematics, @nestjs/testing, prisma, ts-jest, ts-node (+21 more)

### Community 50 - "Domains API Controller"
Cohesion: 0.07
Nodes (28): 1. Listado de Descuentos y Cupones, 1. Porcentaje sobre producto/categoría, 2. Detalle de Descuento (solo lectura), 2. Monto fijo sobre producto/categoría, 3. Crear / Editar Descuento, 3. Porcentaje sobre el ticket, 4. Crear / Editar Cupón, 4. Monto fijo sobre el ticket (+20 more)

### Community 51 - "Message Templates DTOs"
Cohesion: 0.10
Nodes (17): InviteMemberDto, IsEmail, IsString, IsUUID, IsOptional, IsString, IsUUID, UpdateMemberDto (+9 more)

### Community 52 - "API TypeScript Config"
Cohesion: 0.10
Nodes (17): AnnouncementBar(), badgeColor(), ProductCard(), Props, CATEGORIAS, PRODUCTOS, thumbGradientAlt(), TALLES (+9 more)

### Community 53 - "Config Appearance Settings"
Cohesion: 0.12
Nodes (17): CheckoutStepper(), Props, STEPS, ProdImage(), ProdImageProps, Props, Thumb(), CARRITO_INICIAL (+9 more)

### Community 54 - "Storefront Public Controller"
Cohesion: 0.30
Nodes (8): useMovimientosCaja(), crearTicketMock(), MOCK_TICKETS, useCrearTicket(), useTicketsRecientes(), formatHora(), POSReporte(), SK

### Community 55 - "Cash Register API Module"
Cohesion: 0.10
Nodes (20): AppRole, RequestWithUser, RequestWithUser, RequestWithUser, AuthContext, CustomerContext, MemberContext, CustomerEmailDto (+12 more)

### Community 56 - "Payments Verify DTOs"
Cohesion: 0.13
Nodes (23): FMT, InputMonto(), parseMonto(), Props, quickAmounts(), LABELS_METODO, Metodo, METODOS_PAGO (+15 more)

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
Cohesion: 0.06
Nodes (30): 10. Prompts sugeridos para Claude Code, 1. Qué es este módulo, 2. Stack y dependencias, 3. Estructura de archivos del módulo, 4. Componentes compartidos (`ventas/_shared/`), 5. Convenciones de código, 6. State management, 7. Types del módulo (`types.ts`) (+22 more)

### Community 62 - "Module Cluster 62"
Cohesion: 0.11
Nodes (14): Toast(), ToastProps, ToastVariant, variantMap, CfgField(), CfgFieldProps, Toggle(), cajaPeligro (+6 more)

### Community 63 - "Module Cluster 63"
Cohesion: 0.08
Nodes (24): Componentes compartidos nuevos en `_shared/components/`, Componentes de configuración por tipo, Componentes de detalle, Componentes de métricas, Componentes de vigencia y previews, components.md — Módulo Descuentos y Cupones (Fases 1–5), En `components/` (internos del módulo), En `_shared/components/` (compartidos con otros módulos) (+16 more)

### Community 64 - "Module Cluster 64"
Cohesion: 0.07
Nodes (30): Caja, `CategoriaPOS`, Catálogo / Productos, Cliente, `ClienteAsociado`, Cobro, `Descuento`, Descuentos (+22 more)

### Community 65 - "Module Cluster 65"
Cohesion: 0.15
Nodes (5): MailModule, Global, Module, MailService, Injectable

### Community 66 - "Module Cluster 66"
Cohesion: 0.15
Nodes (11): AppModule, Module, HttpExceptionFilter, HttpResponseLike, bootstrap(), NOTE: Not covered automatically — requires a PENDING member with hasTempPassword, MockIdentity, closeTestApp() (+3 more)

### Community 67 - "Module Cluster 67"
Cohesion: 0.13
Nodes (13): IsOptional, IsString, VerifyPaymentDto, PaymentsController, Body, Controller, Get, Param (+5 more)

### Community 68 - "Module Cluster 68"
Cohesion: 0.07
Nodes (29): FullModeOnly(), Public(), Get, Get, Param, MeReturnDto, IsIn, IsInt (+21 more)

### Community 69 - "Module Cluster 69"
Cohesion: 0.11
Nodes (18): FMT, ItemHistorial, MetodoReembolso, MOCK, ModalDevolucion(), ModalDevolucionContent(), MotivoDevolucion, MOTIVOS (+10 more)

### Community 70 - "Module Cluster 70"
Cohesion: 0.07
Nodes (27): RegisterBusinessDto, IsEmail, IsString, MinLength, IsArray, IsBoolean, IsIn, IsOptional (+19 more)

### Community 71 - "Module Cluster 71"
Cohesion: 0.10
Nodes (19): Fase 0 — Prerrequisitos, Fase 10 — Postventa y comunicación, Fase 11 — Auditoría y reportes, Fase 12 — Modos y vidriera digital, Fase 13 — Suscripciones y plataforma, Fase 14 — Dominios, Fase 15 — Storefront público, Fase 16 — Integración frontend ↔ backend (+11 more)

### Community 72 - "Module Cluster 72"
Cohesion: 0.08
Nodes (23): AuthModule, Global, Module, CustomerAuthResponse, LoginResponse, MemberAuthResponse, GoogleExchangeDto, IsNotEmpty (+15 more)

### Community 73 - "Module Cluster 73"
Cohesion: 0.24
Nodes (3): AuthService, Injectable, GoogleIdentity

### Community 74 - "Module Cluster 74"
Cohesion: 0.14
Nodes (14): AddImageDto, IsBoolean, IsOptional, IsUUID, ImageOrderItem, ReorderImagesDto, IsArray, IsInt (+6 more)

### Community 75 - "Module Cluster 75"
Cohesion: 0.13
Nodes (12): DiscountsModule, Module, DiscountsService, Injectable, SendDiscountLinkDto, IsEmail, IsOptional, IsUUID (+4 more)

### Community 77 - "Module Cluster 77"
Cohesion: 0.13
Nodes (10): dataUrlToBlob(), WizardData, SetupUnificado(), initialWizard, OnboardingState, useOnboardingStore, FEATURES, FECHA_HOY (+2 more)

### Community 78 - "Module Cluster 78"
Cohesion: 0.10
Nodes (20): Aceptar invitación de miembro (contraseña temporal), Aislamiento multi-tenant, Catálogo de permisos, Contexto del usuario logueado, Crear / editar / eliminar rol, Editar miembro, Eliminar miembro, Fase 1 — Fundación (tenant + auth) (+12 more)

### Community 79 - "Module Cluster 79"
Cohesion: 0.09
Nodes (19): CustomersController, Body, Controller, Get, Param, Post, Put, Query (+11 more)

### Community 80 - "Module Cluster 80"
Cohesion: 0.12
Nodes (22): buildUrl(), descCupon(), LinkCompartibleModal(), MONO, Props, TipoDestino, TODO: Reemplazar por GET /api/clientes?busqueda=..., useClientes() (+14 more)

### Community 81 - "Module Cluster 81"
Cohesion: 0.12
Nodes (17): devDependencies, babel-plugin-react-compiler, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/aos, @types/react (+9 more)

### Community 82 - "Module Cluster 82"
Cohesion: 0.26
Nodes (14): BackendResult, callBackend(), clearRefreshCookie(), cookieDomain(), firstHeader(), readRefreshCookie(), serializeCookie(), setRefreshCookie() (+6 more)

### Community 83 - "Module Cluster 83"
Cohesion: 0.18
Nodes (15): Props, HashTrigger, Props, Props, Props, fmtMonto(), PedidoMencionPopover(), Props (+7 more)

### Community 84 - "Module Cluster 84"
Cohesion: 0.18
Nodes (13): ModalPlantilla(), ModalUsarPlantilla(), CATEGORIA_LABELS, PlantillaCard(), Props, CategoriaPlantilla, CATEGORIAS_PLANTILLA, DATOS_EJEMPLO (+5 more)

### Community 85 - "Module Cluster 85"
Cohesion: 0.12
Nodes (17): dependencies, leaflet, lucide-react, next, react, react-dom, @tanstack/react-query, @types/leaflet (+9 more)

### Community 86 - "Module Cluster 86"
Cohesion: 0.11
Nodes (19): Abrir caja, Cambiar estado de la orden, Cerrar caja, Crear orden (POS u online), Enviar comprobante, Fase 5 — Órdenes y pagos, Forzar cierre, Historial de sesiones (+11 more)

### Community 87 - "Module Cluster 87"
Cohesion: 0.11
Nodes (19): Actualizar estado de devolución, Bandeja de conversaciones, Crear devolución, Crear opinión, CRUD de plantillas, Elegibilidad para opinar (deeplink de email post-entrega), Enviar mensaje, Fase 8 — Postventa y comunicación (+11 more)

### Community 88 - "Module Cluster 88"
Cohesion: 0.09
Nodes (21): IconType, Modulo, MODULOS, Props, resItem, resLabel, RUBROS, SECCION_MODULO (+13 more)

### Community 89 - "Module Cluster 89"
Cohesion: 0.17
Nodes (7): ReportsController, Controller, Get, ReportsModule, Module, ReportsService, Injectable

### Community 90 - "Module Cluster 90"
Cohesion: 0.12
Nodes (17): [2026-07-16] `Branch` no persiste lat/lng — dirección es solo texto libre, [2026-07-16] Bug de infraestructura: `apps/web` nunca tuvo su propio `pnpm install`, [2026-07-16] Bug de infraestructura: el navegador de prueba (Browser pane) no hidrata NINGUNA página del frontend, [2026-07-16] Bug de infraestructura: `$transaction` de `registerBusiness()` excedía el timeout (P2028), [2026-07-16] `Business.industry` se crea vacío (`''`) en el registro, [2026-07-16] `POST /onboarding/register-business` compartía servicio con el seed script — no se hizo, [2026-07-16] `PUT /onboarding/business` como endpoint separado de `PUT /business`, gateado por `isActive`, [2026-07-16] RBT-293 — Persistencia completa del wizard de onboarding (+9 more)

### Community 91 - "Module Cluster 91"
Cohesion: 0.31
Nodes (6): AuthController, Body, Controller, Post, Headers, Throttle

### Community 92 - "Module Cluster 92"
Cohesion: 0.13
Nodes (13): AdminLayout(), BcItem, CUPONES_VISTA_LABELS, DESCUENTOS_VISTA_LABELS, Header(), Notif, NOTIFS, POS_VISTA_LABELS (+5 more)

### Community 93 - "Module Cluster 93"
Cohesion: 0.22
Nodes (13): DESCUENTOS_EXCLUSIVOS, Categoria, Cupon, DescuentoExclusivo, Direccion, ItemCarrito, Pedido, PedidoResumen (+5 more)

### Community 94 - "Module Cluster 94"
Cohesion: 0.14
Nodes (14): HISTORIAL_MOCK, MensajeCliente, MENSAJES_MOCK, USUARIO_MOCK, Burbuja(), ESTADO_COLOR, MensajesCliente(), PedidoMencionPopover() (+6 more)

### Community 95 - "Module Cluster 95"
Cohesion: 0.15
Nodes (10): BandejaProps, SK, Props, BandejaLista(), ChatPanel(), MsgTabs(), MsgTabsProps, TABS (+2 more)

### Community 96 - "Module Cluster 96"
Cohesion: 0.12
Nodes (16): Ambigüedades, Campos calculados (NO persistir) — `TotalesPOS`, Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas, `MetodoPago` (PaymentMethod, embebido), `MovimientoCaja` (CashMovement) (+8 more)

### Community 97 - "Module Cluster 97"
Cohesion: 0.12
Nodes (18): Props, ACCION_LABEL, formatTimestamp(), HistorialCambios(), Props, PreviewCupon(), Props, DIA_LABELS (+10 more)

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
Cohesion: 0.13
Nodes (14): [2026-07-12] GUIA_PRUEBA_MANUAL_FASES_1_2.md no existe en apps/api, [2026-07-13] `apps/api/scripts/reset-unlinked-customer.ts` no existe, [2026-07-13] Bug de infraestructura: `@supabase/supabase-js` no funciona en Node 20 sin polyfill de WebSocket, [2026-07-13] `pnpm add` en un subproyecto pnpm puede podar dependencias de otro `pnpm install` previo, [2026-07-14] Análisis pre-implementación: 7 fallas detectadas, 4 resueltas, [2026-07-14] Módulo completo sin implementar — `CustomersService` es un stub, [2026-07-17] Aislamiento multi-tenant en AuthGuard y login/register, [2026-07-17] `register()` verifica la contraseña implícitamente al hacer `signInWithPassword` (+6 more)

### Community 103 - "Module Cluster 103"
Cohesion: 0.12
Nodes (22): Cajero, FormApertura(), formatFecha(), getIniciales(), parseMonto(), Props, abreviarNombre(), btnBase (+14 more)

### Community 104 - "Module Cluster 104"
Cohesion: 0.20
Nodes (12): CreateProductDto, ProductOptionInput, ProductVariantInput, IsArray, IsIn, IsInt, IsNumber, IsOptional (+4 more)

### Community 105 - "Module Cluster 105"
Cohesion: 0.15
Nodes (14): CheckoutBuyerInput, CheckoutDto, CheckoutItemInput, IsArray, IsEmail, IsIn, IsInt, IsObject (+6 more)

### Community 106 - "Module Cluster 106"
Cohesion: 0.24
Nodes (7): cols, Footer(), LegalKey, ScrollSequence(), ScrollToTop(), Props, SectionDivider()

### Community 107 - "Module Cluster 107"
Cohesion: 0.13
Nodes (14): 1) ProductoCard, 2) MatrizVariantes, 3) useCarrito, 4) useCheckout, Componentes compartidos en `_shared`, Componentes POS especificos, Core de venta, Criterio para promover a `_shared` (+6 more)

### Community 108 - "Module Cluster 108"
Cohesion: 0.14
Nodes (14): Ambigüedades, `Apariencia` / `StorefrontConfig` (1:1 con Negocio), `ConfigNotificaciones` (1:1 con Negocio), Datos que consume, Datos que envía, Endpoints necesarios, Entidades identificadas, `Miembro` (BusinessMember) (+6 more)

### Community 109 - "Module Cluster 109"
Cohesion: 0.25
Nodes (6): DiscountsController, Controller, Delete, Get, Param, Patch

### Community 110 - "Module Cluster 110"
Cohesion: 0.16
Nodes (7): UnifiedPanelCard(), useCounter(), BadgeVariant, MOB_STARS, Step, StepItem, STEPS

### Community 111 - "Module Cluster 111"
Cohesion: 0.22
Nodes (8): collection, compilerOptions, assets, deleteOutDir, watchAssets, $schema, sourceRoot, mail/templates/**/*.hbs

### Community 112 - "Module Cluster 112"
Cohesion: 0.16
Nodes (12): Modal(), ModalProps, ModalVariant, variantBg, variantColor, variantIcon, DEST, EmailMasivoModal() (+4 more)

### Community 113 - "Module Cluster 113"
Cohesion: 0.10
Nodes (21): Arquitectura técnica — POS, Caja/, CatalogoPOS/, Cobro/, Componentes de `_shared/` que usa el POS, Componentes principales, Datos del servidor (Hooks), Estado (Stores Zustand) (+13 more)

### Community 114 - "Module Cluster 114"
Cohesion: 0.22
Nodes (8): exclude, extends, dist, node_modules, prisma, **/*spec.ts, test, ./tsconfig.json

### Community 115 - "Module Cluster 115"
Cohesion: 0.15
Nodes (13): 10) Cierre de caja, 11) Historial de cajas, 12) Requisitos transversales, 1) Caja cerrada, 2) Apertura de caja, 3) Cobro rapido, 4) Modal de cobro, 5) Post-venta (+5 more)

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

### Community 120 - "Module Cluster 120"
Cohesion: 0.11
Nodes (17): arrowStyle(), badgeColor(), CATS, DESTACADOS, HERO_EYEBROWS, HERO_HUES, HERO_PRECIOS, HERO_PRODS (+9 more)

### Community 121 - "Module Cluster 121"
Cohesion: 0.18
Nodes (9): Avatar(), Props, btnOutline, ChatHeader(), Props, Composer(), CHAT_MSGS_BY_CV, ChatMsg (+1 more)

### Community 122 - "Module Cluster 122"
Cohesion: 0.15
Nodes (13): Cierre de caja, Cobro rápido, Dependencias cruzadas, Devolución / intercambio, Historial, Integración con backend (transversal), Limpieza de código (no spec), Necesita de **Alex** (permisos / pedidos / devoluciones) (+5 more)

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
Cohesion: 0.21
Nodes (14): CreateOrderDto, OrderItemInput, OrderPaymentInput, IsArray, IsBoolean, IsIn, IsInt, IsNumber (+6 more)

### Community 128 - "Module Cluster 128"
Cohesion: 0.17
Nodes (10): Put, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString (+2 more)

### Community 129 - "Module Cluster 129"
Cohesion: 0.18
Nodes (11): CartItemInput, EvaluateDiscountsDto, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString (+3 more)

### Community 130 - "Module Cluster 130"
Cohesion: 0.20
Nodes (8): ComprobanteBase(), ComprobanteBaseProps, ComprobanteEmisor, ComprobanteItem, ComprobanteTotal, fmtMonto(), FECHA_HOY, HORA_HOY

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
Cohesion: 0.20
Nodes (5): SupabaseModule, Global, Module, SupabaseService, Injectable

### Community 141 - "Module Cluster 141"
Cohesion: 0.18
Nodes (9): FindProductsQueryDto, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min (+1 more)

### Community 142 - "Module Cluster 142"
Cohesion: 0.18
Nodes (10): 1. POST /auth/accept-invitation, 2. POST /auth/reset-password, 3. Registro de customerWithoutAccount — idempotencia limitada, 4. Registro exitoso — residuo en Supabase, Auth (auth.e2e-spec.ts) — 17 tests, Branches (branches.e2e-spec.ts) — 8 tests, Business (business.e2e-spec.ts) — 17 tests, Casos no cubiertos (+2 more)

### Community 143 - "Module Cluster 143"
Cohesion: 0.15
Nodes (14): NAV_LINKS, Navbar(), OrbitSystem(), RING_SIZES, SatDef, SATS, AVATARS, Hero() (+6 more)

### Community 145 - "Module Cluster 145"
Cohesion: 0.29
Nodes (9): CardProps, FMT, formatHora(), inicial(), PausadoCard(), Props, totalTicket(), PausadosState (+1 more)

### Community 146 - "Module Cluster 146"
Cohesion: 0.18
Nodes (11): Apertura de caja, Cierre de caja, Cobro rápido, Devolución, Egreso / ingreso de caja, Forzar cierre, Historial de cajas, Intercambio (+3 more)

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
Cohesion: 0.06
Nodes (27): BranchesModule, Module, BusinessesModule, Module, CategoriesModule, Module, BusinessModeGuard, Injectable (+19 more)

### Community 154 - "Module Cluster 154"
Cohesion: 0.13
Nodes (16): HeaderLinkDto, IsBoolean, IsString, HeroSlideDto, IsString, IsArray, IsBoolean, IsIn (+8 more)

### Community 155 - "Module Cluster 155"
Cohesion: 0.28
Nodes (5): PageLoader(), Props, Props, StorefrontLoader(), queryClient

### Community 156 - "Module Cluster 156"
Cohesion: 0.22
Nodes (6): CustomRange, DateRangePopover(), fmtShort(), Periodo, PERIODOS, PeriodoSelectorProps

### Community 157 - "Module Cluster 157"
Cohesion: 0.20
Nodes (10): Flujo 1 — Apertura de caja, Flujo 2 — Cobro de una venta simple, Flujo 3 — Pausar y retomar una venta, Flujo 4 — Devolución en mostrador, Flujo 5 — Intercambio / cambio de producto, Flujo 6 — Egreso / ingreso de efectivo, Flujo 7 — Cierre de caja, Flujo 8 — Forzar cierre (dueño) (+2 more)

### Community 159 - "Module Cluster 159"
Cohesion: 0.20
Nodes (10): 6.1 `categories`, 6.2 `tags`, 6.3 `products`, 6.4 `product_tags`, 6.5 `product_options`, 6.6 `product_option_values`, 6.7 `product_variants`, 6.8 `variant_option_values` (+2 more)

### Community 160 - "Module Cluster 160"
Cohesion: 0.22
Nodes (9): [2026-07-12] `accept-invitation` usa `memberId` como token, sin expiración ni secreto, [2026-07-12] Email de recovery duplicado de Supabase, [2026-07-12] Validación de JWT vía llamada a Supabase, no localmente, [2026-07-13] `AuthService.login()` enmascara cualquier excepción como "Credenciales inválidas", [2026-07-18] Frontend no actualizado para el nuevo flujo de auth, [2026-07-18] Migración de Supabase Auth a sistema propio completada, [2026-07-18] `SupabaseService` aún existe pero ya no se usa en auth, [2026-07-18] Swagger/OpenAPI pendiente de actualizar para nuevos endpoints auth (+1 more)

### Community 161 - "Module Cluster 161"
Cohesion: 0.15
Nodes (13): 3.10 Modal de devolución (mostrador), 3.11 Modal egreso / ingreso de efectivo, 3.12 Permisos relevantes (POS), 3.1 Header del turno (persistente), 3.2 Búsqueda y catálogo (columna izquierda), 3.3 Ticket actual (columna derecha), 3.4 Descuentos a nivel ticket, 3.5 Totales (siempre visibles) (+5 more)

### Community 162 - "Module Cluster 162"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, start, version

### Community 163 - "Module Cluster 163"
Cohesion: 0.22
Nodes (7): Appt, CalendarCard(), DAYS, INITIAL_APPTS, NEW_BOOKINGS, NUMS, WEEK_GRID

### Community 164 - "Module Cluster 164"
Cohesion: 0.22
Nodes (9): Actualizar negocio, Apariencia del storefront, Config operativa (contacto, pagos, envíos, redes), Eliminar negocio (zona peligrosa), Módulo: Businesses, Notificaciones, Obtener negocio actual, Pausar tienda (zona peligrosa) (+1 more)

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
Cohesion: 0.39
Nodes (6): FILTROS, Props, ConversacionItem(), Props, Conversacion, FiltroBandeja

### Community 171 - "Module Cluster 171"
Cohesion: 0.23
Nodes (5): Componentes compartidos usados por el POS, DataTable, ModalConfirmacion, SelectorCliente, SelectorVariante

### Community 172 - "Module Cluster 172"
Cohesion: 0.25
Nodes (8): Ajuste de stock, CRUD de proveedores, Entrada de stock, Fase 3 — Inventario, Historial de movimientos, Módulo: Inventory, Módulo: Suppliers, Stock general (por sucursal)

### Community 173 - "Module Cluster 173"
Cohesion: 0.25
Nodes (8): Crear / actualizar cliente, CRUD de direcciones (storefront, cuenta propia), Email a clientes (individual/masivo), Fase 4 — Clientes, Listar clientes, Módulo: Addresses, Módulo: Customers, Obtener cliente (con pedidos)

### Community 174 - "Module Cluster 174"
Cohesion: 0.29
Nodes (6): description, name, prisma, seed, private, version

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
Cohesion: 0.29
Nodes (7): [2026-07-20] Atajo para entrar al panel sin pagar, [2026-07-20] El negocio ahora se crea ANTES del pago — revierte la decisión del 2026-07-17, [2026-07-20] El webhook no valida la firma de MercadoPago, [2026-07-20] Periodicidad: la documentación dice mensual, el producto es trimestral, [2026-07-20] Se usa preapproval (Suscripciones de MP), no Checkout API/Orders, [2026-07-20] `SubscriptionPayment` no se llena todavía, Fase 13 — Suscripciones (cobro negocio → Órbita)

### Community 180 - "Module Cluster 180"
Cohesion: 0.29
Nodes (6): fontFamily, letterSpacing, lineHeight, prose, TextStyleKey, textStyles

### Community 181 - "Module Cluster 181"
Cohesion: 0.33
Nodes (3): PrimerPasoProps, SERVICIOS, TurnosSetup()

### Community 182 - "Module Cluster 182"
Cohesion: 0.29
Nodes (7): 9. Plan de implementación (fases), Fase 0 — Infraestructura, Fase 1 — POSApertura, Fase 2 — POSCobro (por capas), Fase 3 — POSCierre, Fase 4 — POSHistorial, Fase 5 — Pulido

### Community 183 - "Module Cluster 183"
Cohesion: 0.22
Nodes (8): ApiError, confirmSubscription(), tenantUrl(), ERROR_MESSAGES, GoogleCallback(), Status, Estado, PagoRetornoPage()

### Community 184 - "Module Cluster 184"
Cohesion: 0.29
Nodes (7): Dependencias externas (otros módulos), Flujo principal (un día de cajero), Módulo POS — Documentación, Pantallas, Quién lo usa, Qué es el POS, Índice de documentación

### Community 185 - "Module Cluster 185"
Cohesion: 0.29
Nodes (7): Buscar disponibilidad de dominio, Comprar dominio (camino 3), Estado de SSL, Fase 12 — Dominios, Listar dominios del negocio, Módulo: Custom Domains, Verificar DNS

### Community 186 - "Module Cluster 186"
Cohesion: 0.33
Nodes (6): [2026-07-12] Login de member enviando header X-Business-Slug: prioriza member, [2026-07-12] POST /auth/accept-invitation y POST /auth/reset-password sin test e2e, [2026-07-12] Tests e2e crean usuarios reales en Supabase que no se limpian, [2026-07-20] Suite e2e corre contra una base Supabase compartida real, no una DB de test efímera, [2026-07-20] Throttler real activo en tests — deshabilitado explícitamente vía skipIf, Tests E2E

### Community 187 - "Module Cluster 187"
Cohesion: 0.33
Nodes (5): IsArray, IsOptional, IsString, IsUUID, ValidateCouponDto

### Community 188 - "Module Cluster 188"
Cohesion: 0.33
Nodes (6): 3.1 `businesses`, 3.2 `branches`, 3.3 `business_config`, 3.4 `storefront_config`, 3.5 `notification_config`, 3. Multi-tenancy y negocio

### Community 189 - "Module Cluster 189"
Cohesion: 0.33
Nodes (6): 8.1 `orders`, 8.2 `order_items`, 8.3 `pos_sale_details`, 8.4 `online_order_details`, 8.5 `order_status_history`, 8. Órdenes (POS + Online)

### Community 190 - "Module Cluster 190"
Cohesion: 0.40
Nodes (3): PERMISSIONS, prisma, ROLE_PERMISSIONS

### Community 191 - "Module Cluster 191"
Cohesion: 0.60
Nodes (4): config, isPassthrough(), middleware(), slugFromHost()

### Community 192 - "Module Cluster 192"
Cohesion: 0.50
Nodes (4): LiveChatCard(), Msg, Source, SOURCES

### Community 193 - "Module Cluster 193"
Cohesion: 0.38
Nodes (5): LEGAL_CONTENT, LegalKey, LegalModal(), Props, LegalModal()

### Community 194 - "Module Cluster 194"
Cohesion: 0.25
Nodes (7): descuento(), CARACT, COLORES, HUES, ProductoDetalle(), RESENAS, TALLES

### Community 195 - "Module Cluster 195"
Cohesion: 0.25
Nodes (8): [2026-07-20] Credenciales de Google OAuth son placeholders — no funciona contra Google real, [2026-07-20] Decisión: vincular password a cuenta creada por Google, no rechazar el registro, [2026-07-20] Exchange code de Google OAuth vive en memoria — asume deployment single-instance, [2026-07-20] Fixtures del seed no reseteaban `googleId` entre corridas — corregido, [2026-07-20] Librería y decisiones de diseño confirmadas antes de implementar, [2026-07-20] `state` de OAuth firmado con el mismo secret que los JWT (`JWT_SECRET`), [2026-07-20] Tests de Google OAuth cubiertos — 9/9, más los 8 de aislamiento sin regresión, RBT-287 — Google OAuth

### Community 196 - "Module Cluster 196"
Cohesion: 0.33
Nodes (6): useDarkMode(), Apariencia(), FontSelect(), StorePreview(), fontStack(), loadFont()

### Community 197 - "Module Cluster 197"
Cohesion: 0.40
Nodes (4): Arquitectura / decisiones técnicas, Auth: NO usa Supabase Auth, graphify, Órbita — contexto del proyecto

### Community 198 - "Module Cluster 198"
Cohesion: 0.40
Nodes (5): Crear / actualizar sucursal, Eliminar sucursal, Listar sucursales, Módulo: Branches, Obtener sucursal

### Community 199 - "Module Cluster 199"
Cohesion: 0.40
Nodes (5): 10.1 `mp_credentials`, 10.2 `mp_stores`, 10.3 `mp_pos`, 10.4 `mp_devices`, 10. MercadoPago

### Community 200 - "Module Cluster 200"
Cohesion: 0.40
Nodes (5): 11.1 `discounts`, 11.2 `discount_products`, 11.3 `discount_categories`, 11.4 `discount_redemptions`, 11. Descuentos y cupones

### Community 201 - "Module Cluster 201"
Cohesion: 0.40
Nodes (5): 4.1 `members`, 4.2 `roles`, 4.3 `permissions`, 4.4 `role_permissions`, 4. Identidad y equipo

### Community 202 - "Module Cluster 202"
Cohesion: 0.29
Nodes (6): AparienciaProps, ConfigTabs(), ConfigTabsProps, TABS, VistaConfig, EquipoProps

### Community 203 - "Module Cluster 203"
Cohesion: 0.47
Nodes (4): DetalleConfiguracion(), fmt(), getRows(), Props

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

### Community 220 - "Module Cluster 220"
Cohesion: 0.50
Nodes (4): [2026-07-13] Bug propio detectado y corregido en el momento: protección de borrado de Supplier basada en un supuesto incorrecto sobre el FK, [2026-07-13] Filtro `lowStock` y paginación de `GET /inventory/stock` se resuelven en memoria, [2026-07-13] `POST /inventory/adjustment` bloquea si el resultado da stock negativo, Fase 5 — Inventario (Inventory/Suppliers)

### Community 221 - "Module Cluster 221"
Cohesion: 0.50
Nodes (3): ImgUploader(), ImgUploaderProps, smallBtn

## Knowledge Gaps
- **1395 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `mail/templates/**/*.hbs` (+1390 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useDarkMode()` connect `Module Cluster 196` to `Module Cluster 120`, `Module Cluster 92`, `Module Cluster 109`?**
  _High betweenness centrality (0.282) - this node is a cross-community bridge._
- **Why does `Roles()` connect `Inventory API DTOs` to `Module Cluster 128`, `Catalog Categories UI`, `MercadoPago DTOs`, `Orders API DTOs`, `Platform Admin DTOs`, `NestJS Module Registry`, `Storefront Public UI`, `Auth Context Decorators`, `Branches API Controller`, `Storefront Product Cards`, `Module Cluster 179`, `Message Templates DTOs`, `Cash Register API Module`, `Storefront Me DTOs`, `Store Preview Component`, `Module Cluster 67`, `Module Cluster 75`, `Module Cluster 79`, `Module Cluster 109`?**
  _High betweenness centrality (0.260) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Shared Web Components` to `Discount Coupon Cards`, `Module Cluster 77`, `Auth Module & Controller`, `Module Cluster 92`, `Module Cluster 62`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _1395 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Design System Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07270865335381464 - nodes in this community are weakly interconnected._
- **Should `Discounts UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.051462904911180773 - nodes in this community are weakly interconnected._
- **Should `Messaging Module` be split into smaller, more focused modules?**
  _Cohesion score 0.04528158295281583 - nodes in this community are weakly interconnected._