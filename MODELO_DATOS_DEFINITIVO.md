# Orbita — Modelo de Datos Definitivo (V1) — v2

> Documento de referencia del schema de base de datos para el backend de Orbita.
> Stack: NestJS + Prisma + PostgreSQL (Supabase). Multi-tenancy por `business_id` a nivel de fila.
>
> **Estado:** Definitivo. Todas las decisiones de arquitectura están cerradas. Este documento
> traduce esas decisiones a tablas concretas listas para implementar en Prisma, y es la base
> para el backlog de tareas.
>
> **Novedades de v2** (respecto de la primera versión):
> - Suscripciones de negocios a Orbita (débito automático + licencias cedidas): `subscriptions`, `subscription_payments`.
> - Panel de super-administración de Orbita: `platform_admins`, `platform_admin_logs`.
> - Dominios: campo `subdomain` en `businesses` + tabla `custom_domains`.
> - Transferencias en POS: campos de verificación humana en `payments` + `transfer_alias` en `business_config`.
>
> **Convención de idioma:** nombres de tablas y campos en inglés (compatibilidad con Prisma,
> NestJS, librerías externas y APIs como MercadoPago). Comentarios y documentación en español.

---

## Índice

1. [Convenciones generales](#1-convenciones-generales)
2. [Mapa de módulos y dependencias](#2-mapa-de-módulos-y-dependencias)
3. [Multi-tenancy y negocio](#3-multi-tenancy-y-negocio)
   - 3.1 `businesses`
   - 3.2 `branches`
   - 3.3 `business_config`
   - 3.4 `storefront_config`
   - 3.5 `notification_config`
4. [Identidad y equipo](#4-identidad-y-equipo)
   - 4.1 `members`
   - 4.2 `roles`
   - 4.3 `permissions`
   - 4.4 `role_permissions`
5. [Clientes](#5-clientes)
   - 5.1 `customers`
   - 5.2 `addresses`
6. [Catálogo de productos](#6-catálogo-de-productos)
   - 6.1 `categories`
   - 6.2 `tags`
   - 6.3 `products`
   - 6.4 `product_tags`
   - 6.5 `product_options`
   - 6.6 `product_option_values`
   - 6.7 `product_variants`
   - 6.8 `variant_option_values`
   - 6.9 `product_images`
7. [Inventario](#7-inventario)
   - 7.1 `variant_stock`
   - 7.2 `stock_movements`
   - 7.3 `suppliers`
8. [Órdenes (POS + Online)](#8-órdenes-pos--online)
   - 8.1 `orders`
   - 8.2 `order_items`
   - 8.3 `pos_sale_details`
   - 8.4 `online_order_details`
   - 8.5 `order_status_history`
9. [Pagos y caja](#9-pagos-y-caja)
   - 9.1 `payments`
   - 9.2 `cash_sessions`
   - 9.3 `cash_movements`
10. [MercadoPago](#10-mercadopago)
    - 10.1 `mp_credentials`
    - 10.2 `mp_stores`
    - 10.3 `mp_pos`
    - 10.4 `mp_devices`
11. [Descuentos y cupones](#11-descuentos-y-cupones)
    - 11.1 `discounts`
    - 11.2 `discount_products`
    - 11.3 `discount_categories`
    - 11.4 `discount_redemptions`
12. [Devoluciones y notas de crédito](#12-devoluciones-y-notas-de-crédito)
    - 12.1 `returns`
    - 12.2 `credit_notes`
13. [Mensajería](#13-mensajería)
    - 13.1 `conversations`
    - 13.2 `messages`
    - 13.3 `message_templates`
14. [Opiniones](#14-opiniones)
    - 14.1 `reviews`
15. [Auditoría](#15-auditoría)
    - 15.1 `audit_logs`
16. [Suscripciones a Orbita](#16-suscripciones-a-orbita)
    - 16.1 `subscriptions`
    - 16.2 `subscription_payments`
17. [Super-administración de plataforma](#17-super-administración-de-plataforma)
    - 17.1 `platform_admins`
    - 17.2 `platform_admin_logs`
18. [Dominios](#18-dominios)
    - 18.1 `subdomain` (campo en `businesses`)
    - 18.2 `custom_domains`
19. [Resumen de relaciones](#19-resumen-de-relaciones)
20. [Orden de implementación](#20-orden-de-implementación)
21. [Anexo: cambios de v2 y checklist para el backlog](#21-anexo-cambios-de-v2)

---

## 1. Convenciones generales

Estas reglas aplican a **todas** las tablas del schema.

**Claves primarias.** Toda tabla usa `id UUID @default(uuid())` como PK, salvo tablas pivot que usan clave compuesta.

**Multi-tenancy.** Toda entidad persistente lleva `business_id` (FK a `businesses`), salvo: tablas pivot (heredan el tenant de su padre), `permissions` (catálogo global), y `role_permissions` (hereda de `roles`). El aislamiento entre negocios se garantiza filtrando por `business_id` en cada query — se recomienda usar Row Level Security (RLS) de Supabase como segunda capa de defensa.

**Multi-branch.** Las tablas que representan operaciones físicas llevan `branch_id` (FK a `branches`): `orders`, `variant_stock`, `stock_movements`, `cash_sessions`, `cash_movements`. El catálogo, clientes, descuentos y configuración NO llevan `branch_id` (son del negocio, no de la sucursal).

**Timestamps.** Toda tabla lleva `created_at TIMESTAMPTZ @default(now())`. Las tablas que se modifican después de creadas llevan además `updated_at TIMESTAMPTZ @updatedAt`. Las tablas de solo-inserción (movimientos, canjes, auditoría, historial) no llevan `updated_at`.

**Nomenclatura.** Tablas en plural y snake_case (`order_items`). En Prisma, los modelos van en PascalCase singular (`OrderItem`) con `@@map("order_items")`. Campos en snake_case en la DB, camelCase en Prisma con `@map`.

**Dinero.** Todos los montos usan `Decimal @db.Decimal(12, 2)`. Nunca `Float` (errores de redondeo). Moneda por defecto ARS.

**Borrado.** Se usa soft-delete (`deleted_at TIMESTAMPTZ NULLABLE`) en entidades que no deben perderse por integridad referencial o auditoría: `products`, `customers`, `orders`, `discounts`. El resto usa borrado físico. Las FK usan `onDelete: Restrict` por defecto para prevenir borrados accidentales en cascada.

**Enums.** Se usan enums de Prisma para valores cerrados (estados, tipos, canales). Se listan en cada tabla.

---

## 2. Mapa de módulos y dependencias

El orden de las flechas indica dependencia (A → B significa "A necesita que B exista primero").

```
businesses (raíz del tenant)
    ├── branches
    ├── business_config, storefront_config, notification_config
    ├── roles → permissions (catálogo global)
    │     └── members
    ├── customers → addresses
    ├── categories (árbol) + tags
    │     └── products
    │           ├── product_tags
    │           ├── product_options → product_option_values
    │           ├── product_variants → variant_option_values
    │           ├── product_images
    │           └── variant_stock (× branches)
    ├── suppliers
    │     └── stock_movements (× variants × branches)
    ├── discounts → discount_products, discount_categories
    ├── orders (× branches × customers)
    │     ├── order_items (× variants)
    │     ├── pos_sale_details / online_order_details
    │     ├── order_status_history
    │     ├── payments
    │     ├── discount_redemptions
    │     ├── returns → credit_notes
    │     └── reviews (× products × customers)
    ├── cash_sessions (× branches)
    │     └── cash_movements
    ├── mp_credentials
    │     └── mp_stores (× branches) → mp_pos → mp_devices
    ├── conversations (× customers) → messages
    ├── message_templates
    ├── audit_logs (polimórfico)
    ├── subscription → subscription_payments
    └── custom_domains

platform_admins (FUERA del multi-tenant — staff de Orbita)
    ├── subscriptions (licencias cedidas, vía granted_by)
    └── platform_admin_logs
```

---

## 3. Multi-tenancy y negocio

### 3.1 `businesses`

La raíz del sistema multi-tenant. Cada fila es un negocio que usa Orbita. Su `id` es el `business_id` que aparece en todas las demás tablas.

```prisma
model Business {
  id            String   @id @default(uuid())
  name          String                          // "Rama Indumentaria"
  industry      String                          // rubro: "Indumentaria"
  description    String?
  subdomain     String   @unique                 // "zapatoslorena" → zapatoslorena.orbita.site. ÚNICO GLOBAL (excepción a multi-tenant)
  mode          BusinessMode @default(FULL)      // full = venta online | showcase = vidriera digital
  isActive      Boolean  @default(true)
  isPaused      Boolean  @default(false)          // zona peligrosa: tienda pausada
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relaciones inversas — Prisma EXIGE declarar la inversa de CADA tabla que
  // referencia businessId, o el schema no compila. Lista completa:
  branches           Branch[]
  businessConfig     BusinessConfig?
  storefrontConfig   StorefrontConfig?
  notificationConfig NotificationConfig?
  members            Member[]
  roles              Role[]
  customers          Customer[]
  categories         Category[]
  tags               Tag[]
  products           Product[]
  suppliers          Supplier[]
  stockMovements     StockMovement[]
  orders             Order[]
  payments           Payment[]
  cashSessions       CashSession[]
  cashMovements      CashMovement[]
  mpCredentials      MpCredentials?
  discounts          Discount[]
  discountRedemptions DiscountRedemption[]
  returns            Return[]
  creditNotes        CreditNote[]
  conversations      Conversation[]
  messageTemplates   MessageTemplate[]
  reviews            Review[]
  auditLogs          AuditLog[]
  subscription       Subscription?
  customDomains      CustomDomain[]

  @@map("businesses")
}

enum BusinessMode {
  FULL       // Tienda online completa: checkout, carrito, pedidos, cupones, mensajes, opiniones
  SHOWCASE   // Vidriera digital: catálogo + botón WhatsApp, sin checkout ni pedidos online
}
```

**Notas:**
- `mode` define si el negocio opera con venta online completa o vidriera digital. Se elige en el onboarding. En modo `SHOWCASE`, el storefront oculta checkout/carrito/cupones/mensajes/opiniones y muestra botón de WhatsApp por producto.
- `isPaused` es distinto de `isActive`: pausar es temporal (el dueño cierra la tienda unos días), desactivar es de sistema.
- `subdomain` es **único a nivel global** (no por negocio) — es la única excepción a la regla multi-tenant, porque `zapatoslorena.orbita.site` debe ser único en toda la plataforma. Al cancelarse una suscripción, el subdominio se libera y puede ser tomado por otro negocio.

### 3.2 `branches`

Sucursales del negocio. **Se auto-crea una sucursal "Principal" al crear el negocio.** En V1 no hay UI de gestión de sucursales, pero la estructura existe desde el día uno (requerida por MercadoPago Point y para evitar migraciones futuras).

```prisma
model Branch {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  name        String   @default("Principal")
  address     String?
  isDefault   Boolean  @default(false)  @map("is_default")  // la sucursal auto-creada
  isActive    Boolean  @default(true)   @map("is_active")
  createdAt   DateTime @default(now())  @map("created_at")
  updatedAt   DateTime @updatedAt        @map("updated_at")

  business        Business @relation(fields: [businessId], references: [id])
  orders          Order[]
  variantStock    VariantStock[]
  stockMovements  StockMovement[]
  cashSessions    CashSession[]
  cashMovements   CashMovement[]
  mpStores        MpStore[]

  @@index([businessId])
  @@map("branches")
}
```

**Notas:**
- Toda operación física (venta, stock, caja) referencia una `branch_id`. En V1 siempre es la sucursal default, seteada automáticamente por el backend según el miembro logueado.
- Cuando en el futuro se agregue multi-sucursal, solo se crean filas nuevas — sin migración de datos.

### 3.3 `business_config`

Configuración operativa del negocio (contacto, pagos habilitados, envíos, redes). Relación 1:1 con `businesses`. Se separa de `businesses` porque son datos que cambian juntos y con frecuencia distinta a los datos raíz.

```prisma
model BusinessConfig {
  id                String   @id @default(uuid())
  businessId        String   @unique @map("business_id")

  // Contacto
  whatsapp          String?
  email             String?
  scheduleText      String?  @map("schedule_text")   // "Lun a Vie 9-18"

  // Pagos habilitados (toggles)
  acceptsMercadopago Boolean @default(true)  @map("accepts_mercadopago")
  acceptsCash        Boolean @default(true)  @map("accepts_cash")
  acceptsTransfer    Boolean @default(true)  @map("accepts_transfer")
  acceptsPickup      Boolean @default(true)  @map("accepts_pickup")

  // Transferencia: alias/CBU único del negocio donde reciben transferencias (POS)
  transferAlias      String? @map("transfer_alias")   // alias fijo del negocio (ej: "rama.indumentaria.mp")

  // Envíos
  shippingBase       Decimal? @db.Decimal(12,2) @map("shipping_base")
  freeShippingFrom   Decimal? @db.Decimal(12,2) @map("free_shipping_from")
  deliveryZones      String[] @map("delivery_zones")
  shippingPolicy     String?  @map("shipping_policy")

  // Redes sociales
  instagram          String?
  tiktok             String?
  facebook           String?

  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt       @map("updated_at")

  business           Business @relation(fields: [businessId], references: [id])

  @@map("business_config")
}
```

### 3.4 `storefront_config`

Configuración visual del storefront (branding, tema, layout). Relación 1:1 con `businesses`. Objeto grande; los sub-elementos (sliders, links) se modelan como JSON por ser puramente de presentación y no requerir consultas relacionales.

```prisma
model StorefrontConfig {
  id              String   @id @default(uuid())
  businessId      String   @unique @map("business_id")

  // Branding
  storeName       String?  @map("store_name")
  tagline         String?
  logoUrl         String?  @map("logo_url")
  faviconUrl      String?  @map("favicon_url")

  // Tema
  colorPrimary    String?  @map("color_primary")     // hex
  colorSecondary  String?  @map("color_secondary")
  colorAccent     String?  @map("color_accent")
  colorBackground String?  @map("color_background")
  colorMode       String   @default("light") @map("color_mode")  // light | dark
  fontFamily      String?  @map("font_family")
  fontScale       Decimal? @db.Decimal(3,2) @map("font_scale")

  // Layout
  headerLayout    String?  @map("header_layout")
  gridLayout      String?  @map("grid_layout")
  cardRadius      Int?     @map("card_radius")

  // Contenido dinámico (JSON: son datos de presentación, no relacionales)
  heroSlides      Json?    @map("hero_slides")   // [{ id, titulo, subtitulo, img, cta }]
  headerLinks     Json?    @map("header_links")  // [{ id, label, on }]

  // Toggles de storefront
  showRating             Boolean  @default(true)  @map("show_rating")
  showNewBadge           Boolean  @default(true)  @map("show_new_badge")
  showWhatsapp           Boolean  @default(true)  @map("show_whatsapp")
  showLowStock           Boolean  @default(true)  @map("show_low_stock")
  showOfferBadge         Boolean  @default(true)  @map("show_offer_badge")
  showSearch             Boolean  @default(true)  @map("show_search")
  showCategoriesSection  Boolean  @default(true)  @map("show_categories_section")
  showFooter             Boolean  @default(true)  @map("show_footer")
  showSocialFooter       Boolean  @default(true)  @map("show_social_footer")

  // Textos configurables de la tienda
  ctaText         String?  @map("cta_text")
  shippingText    String?  @map("shipping_text")
  whatsappText    String?  @map("whatsapp_text")
  fontFamilyBody  String?  @map("font_family_body")

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt       @map("updated_at")

  business        Business @relation(fields: [businessId], references: [id])

  @@map("storefront_config")
}
```

**Nota:** `heroSlides` y `headerLinks` son JSON porque son listas de presentación que se editan y renderizan como bloque, sin necesidad de consultarse individualmente. Si en el futuro se necesita analítica por slide, se normalizan.

### 3.5 `notification_config`

Matriz de notificaciones evento × canal. Relación 1:1 con `businesses`. Se modela como JSON por ser una matriz de toggles booleanos sin relaciones.

```prisma
model NotificationConfig {
  id          String   @id @default(uuid())
  businessId  String   @unique @map("business_id")

  // Matriz evento × canal como JSON:
  // { "nuevo_pedido": { "panel": true, "email": true, "whatsapp": false }, ... }
  matrix      Json

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")

  business    Business @relation(fields: [businessId], references: [id])

  @@map("notification_config")
}
```

---

## 4. Identidad y equipo

### 4.1 `members`

Miembros del equipo del negocio (staff). Corresponde a `business_members`. Cada miembro tiene un rol y puede loguearse al panel. Su autenticación va por Supabase Auth (`auth_user_id`).

```prisma
model Member {
  id            String   @id @default(uuid())
  businessId    String   @map("business_id")
  authUserId    String?  @unique @map("auth_user_id")  // FK → Supabase auth.users
  name          String
  email         String
  roleId        String   @map("role_id")
  status        MemberStatus @default(PENDING)
  hasTempPassword Boolean @default(false) @map("has_temp_password")
  lastAccessAt  DateTime? @map("last_access_at")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt       @map("updated_at")

  business        Business  @relation(fields: [businessId], references: [id])
  role            Role      @relation(fields: [roleId], references: [id])
  // Inversas: un miembro aparece como cajero, autor de movimientos y verificador de pagos
  cashSessions    CashSession[]
  cashMovements   CashMovement[]
  stockMovements  StockMovement[]
  verifiedPayments Payment[]

  @@unique([businessId, email])
  @@index([businessId])
  @@map("members")
}

enum MemberStatus {
  ACTIVE
  PENDING   // invitación enviada, no aceptada
}
```

### 4.2 `roles`

Roles del negocio. Se crean 4 roles default por negocio (owner, admin, cajero, empleado). Los roles default no se pueden editar ni eliminar.

```prisma
model Role {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  name        String
  description String?
  color       String?
  isDefault   Boolean  @default(false) @map("is_default")  // roles del sistema, no editables
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")

  business        Business @relation(fields: [businessId], references: [id])
  members         Member[]
  rolePermissions RolePermission[]

  @@index([businessId])
  @@map("roles")
}
```

### 4.3 `permissions`

Catálogo global de permisos. **No lleva `business_id`** — es un seed estático compartido por todos los negocios. ~19 permisos agrupados en 7 grupos (Pedidos, Clientes, Reportes, Inventario, POS, Descuentos, Configuración).

```prisma
model Permission {
  id          String   @id @default(uuid())
  group       String                  // "Pedidos", "POS", etc.
  code        String   @unique        // "orders.view", "pos.edit_price"
  label       String
  description String?

  rolePermissions RolePermission[]

  @@map("permissions")
}
```

**Nota:** el permiso `pos.edit_price` controla si un cajero puede usar `precioEditado` en el ticket (ver `order_items`). Es el permiso que faltaba en el frontend para restringir la edición de precio.

### 4.4 `role_permissions`

Pivot N:N entre roles y permisos. Hereda el tenant de `roles`.

```prisma
model RolePermission {
  roleId       String @map("role_id")
  permissionId String @map("permission_id")

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id])

  @@id([roleId, permissionId])
  @@map("role_permissions")
}
```

---

## 5. Clientes

### 5.1 `customers`

Cliente del negocio. Unifica los cuatro modelos del frontend (Cliente panel, ClienteAsociado POS, Usuario storefront, comprador). Un cliente puede existir **sin cuenta** (`auth_user_id = null`, creado en POS) o **con cuenta** (registrado en storefront).

```prisma
model Customer {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  authUserId  String?  @map("auth_user_id")   // FK → Supabase auth.users. NULL = sin cuenta (POS-only)
  firstName   String   @map("first_name")
  lastName    String?  @map("last_name")
  email       String?                          // campo de vinculación POS ↔ storefront
  phone       String?                          // indexado para futura vinculación
  dni         String?                          // facturación
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")     // soft-delete

  business      Business @relation(fields: [businessId], references: [id])
  addresses     Address[]
  orders        Order[]
  reviews       Review[]
  conversations Conversation[]

  @@unique([businessId, email])   // no dos clientes con mismo email en el mismo negocio
  @@index([businessId])
  @@index([phone])
  @@map("customers")
}
```

**Notas:**
- **Vinculación POS ↔ storefront:** cuando alguien se registra en el storefront con un email que ya existe como cliente POS, el backend setea `auth_user_id` en el registro existente. Ver flujo en la Decisión 2 del documento consolidado.
- `email` es nullable porque una venta POS puede asociar un cliente solo por nombre/teléfono.
- Sin `segment` ni `tags` en V1 (diferido).

### 5.2 `addresses`

Direcciones del cliente (1:N). Existe en el storefront, faltaba en el panel.

```prisma
model Address {
  id          String   @id @default(uuid())
  customerId  String   @map("customer_id")
  alias       String?                       // "Casa", "Trabajo"
  street      String
  floor       String?
  city        String
  zip         String?
  isDefault   Boolean  @default(false) @map("is_default")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")

  customer            Customer             @relation(fields: [customerId], references: [id], onDelete: Cascade)
  onlineOrderDetails  OnlineOrderDetails[]  // pedidos online que usan esta dirección de envío

  @@index([customerId])
  @@map("addresses")
}
```

---

## 6. Catálogo de productos

### 6.1 `categories`

Categorías del negocio, con jerarquía (árbol self-referencing vía `parent_id`). Un producto pertenece a **una** categoría (la más específica del árbol).

```prisma
model Category {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  name        String
  slug        String
  icon        String?
  color       String?
  parentId    String?  @map("parent_id")   // self-reference, árbol
  isActive    Boolean  @default(true) @map("is_active")
  position    Int      @default(0)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")

  business    Business   @relation(fields: [businessId], references: [id])
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  products    Product[]

  @@unique([businessId, slug])
  @@index([businessId])
  @@index([parentId])
  @@map("categories")
}
```

### 6.2 `tags`

Etiquetas transversales reutilizables ("Oferta", "Nuevo", "Verano"). Se modelan como tabla (no texto libre) para evitar duplicados por inconsistencia de escritura.

```prisma
model Tag {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  name        String
  createdAt   DateTime @default(now()) @map("created_at")

  business    Business     @relation(fields: [businessId], references: [id])
  productTags ProductTag[]

  @@unique([businessId, name])   // evita "verano" y "Verano" duplicados
  @@index([businessId])
  @@map("tags")
}
```

### 6.3 `products`

Producto padre. **Todo producto tiene al menos una variante** (ver nota). El stock NO vive acá — vive en `variant_stock`. El precio de referencia vive acá pero cada variante puede overridearlo.

```prisma
model Product {
  id             String   @id @default(uuid())
  businessId     String   @map("business_id")
  categoryId     String?  @map("category_id")
  name           String
  description    String?
  basePrice      Decimal  @db.Decimal(12,2) @map("base_price")     // precio de referencia
  comparePrice   Decimal? @db.Decimal(12,2) @map("compare_price")  // precio tachado (oferta)
  cost           Decimal? @db.Decimal(12,2)                        // costo (privado, para margen)
  status         ProductStatus @default(DRAFT)
  isFeatured     Boolean  @default(false) @map("is_featured")      // estrella en la grilla del panel → sección "Destacados" del storefront
  inventoryType  String   @default("standard") @map("inventory_type")  // standard | serialized | fractional | batch | simple
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt       @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")   // soft-delete

  business    Business  @relation(fields: [businessId], references: [id])
  category    Category? @relation(fields: [categoryId], references: [id])
  productTags ProductTag[]
  options     ProductOption[]
  variants    ProductVariant[]
  images      ProductImage[]
  reviews     Review[]

  @@index([businessId])
  @@index([categoryId])
  @@map("products")
}

enum ProductStatus {
  PUBLISHED
  DRAFT
  OUT_OF_STOCK
}
```

**Notas:**
- **Todo producto tiene al menos una variante.** Si el dueño crea un producto sin variantes explícitas, el backend crea una variante "default" que hereda precio y stock. El frontend no la muestra como variante, pero internamente toda venta es de una variante. Esto unifica la lógica de inventario y ventas.
- `inventoryType` en V1 siempre es `'standard'`. Existe como punto de bifurcación para sub-rubros futuros (Electrónica serializada, Corralón fraccionario, etc.).
- `cost` es privado (no se expone en storefront); sirve para calcular margen en el panel.

### 6.4 `product_tags`

Pivot N:N entre productos y tags.

```prisma
model ProductTag {
  productId String @map("product_id")
  tagId     String @map("tag_id")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([productId, tagId])
  @@map("product_tags")
}
```

### 6.5 `product_options`

Opciones de variación de un producto ("Talle", "Color", "Numeración"). Modelo relacional tipo Shopify.

```prisma
model ProductOption {
  id        String @id @default(uuid())
  productId String @map("product_id")
  name      String              // "Talle", "Color"
  position  Int    @default(0)

  product Product              @relation(fields: [productId], references: [id], onDelete: Cascade)
  values  ProductOptionValue[]

  @@index([productId])
  @@map("product_options")
}
```

### 6.6 `product_option_values`

Valores posibles de cada opción ("S", "M", "L", "Negro", "Blanco").

```prisma
model ProductOptionValue {
  id        String @id @default(uuid())
  optionId  String @map("option_id")
  value     String              // "M", "Negro"
  position  Int    @default(0)

  option              ProductOption        @relation(fields: [optionId], references: [id], onDelete: Cascade)
  variantOptionValues VariantOptionValue[]
  images              ProductImage[]

  @@index([optionId])
  @@map("product_option_values")
}
```

### 6.7 `product_variants`

Variante concreta (combinación de valores). Cada variante tiene SKU, precio y código de barras propios. El stock vive en `variant_stock` (por sucursal).

```prisma
model ProductVariant {
  id           String   @id @default(uuid())
  productId    String   @map("product_id")
  sku          String?
  barcode      String?
  price        Decimal  @db.Decimal(12,2)              // puede override basePrice del producto
  comparePrice Decimal? @db.Decimal(12,2) @map("compare_price")
  isDefault    Boolean  @default(false) @map("is_default")  // variante default de productos sin variación
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt       @map("updated_at")

  product             Product              @relation(fields: [productId], references: [id], onDelete: Cascade)
  optionValues        VariantOptionValue[]
  stock               VariantStock[]
  orderItems          OrderItem[]
  stockMovements      StockMovement[]

  @@index([productId])
  @@index([barcode])
  @@map("product_variants")
}
```

### 6.8 `variant_option_values`

Pivot: qué valores de opción tiene cada variante. Ej: la variante "M-Negro" apunta al valor "M" y al valor "Negro".

```prisma
model VariantOptionValue {
  variantId     String @map("variant_id")
  optionValueId String @map("option_value_id")

  variant     ProductVariant     @relation(fields: [variantId], references: [id], onDelete: Cascade)
  optionValue ProductOptionValue @relation(fields: [optionValueId], references: [id])

  @@id([variantId, optionValueId])
  @@map("variant_option_values")
}
```

### 6.9 `product_images`

Imágenes del producto. Pueden asociarse a un valor de opción (típicamente Color) vía `option_value_id`, para mostrar fotos distintas por color. Si `option_value_id` es null, es imagen genérica del producto.

```prisma
model ProductImage {
  id            String  @id @default(uuid())
  productId     String  @map("product_id")
  optionValueId String? @map("option_value_id")   // FK → product_option_values (ej: valor "Negro")
  url           String                             // Supabase Storage
  position      Int     @default(0)
  isPrimary     Boolean @default(false) @map("is_primary")
  createdAt     DateTime @default(now()) @map("created_at")

  product     Product             @relation(fields: [productId], references: [id], onDelete: Cascade)
  optionValue ProductOptionValue? @relation(fields: [optionValueId], references: [id])

  @@index([productId])
  @@map("product_images")
}
```

**Nota:** al usar FK a `product_option_values` (en vez de un string libre), la asociación imagen-color queda validada. El storefront filtra imágenes por el valor seleccionado, con fallback a las genéricas.

---

## 7. Inventario

### 7.1 `variant_stock`

Stock por variante **y por sucursal**. Es la fuente de verdad del inventario. Nunca hay stock "global" — siempre es por sucursal.

```prisma
model VariantStock {
  id         String   @id @default(uuid())
  variantId  String   @map("variant_id")
  branchId   String   @map("branch_id")
  quantity   Int      @default(0)
  stockMin   Int      @default(0) @map("stock_min")   // umbral de alerta
  updatedAt  DateTime @updatedAt @map("updated_at")

  variant ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  branch  Branch         @relation(fields: [branchId], references: [id])

  @@unique([variantId, branchId])
  @@index([variantId])
  @@index([branchId])
  @@map("variant_stock")
}
```

**Nota:** con una sola sucursal (caso normal de V1) hay una fila por variante. El estado "stock bajo" se calcula como `quantity <= stockMin` (no se persiste). La valorización de inventario se calcula agregando `quantity * cost`.

### 7.2 `stock_movements`

Historial de movimientos de stock (entradas, salidas, ajustes). Solo-inserción (no se edita). Cada venta genera movimientos de salida automáticos.

```prisma
model StockMovement {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  branchId    String   @map("branch_id")
  variantId   String   @map("variant_id")
  type        StockMovementType
  quantity    Int                          // negativo en salidas/ajustes hacia abajo
  reason      String                       // "Venta #1284", "Compra a proveedor", "Ajuste manual"
  supplierId  String?  @map("supplier_id") // FK opcional (en entradas)
  orderId     String?  @map("order_id")    // FK opcional (en salidas por venta)
  createdBy   String?  @map("created_by")  // FK → members
  createdAt   DateTime @default(now()) @map("created_at")

  business  Business        @relation(fields: [businessId], references: [id])
  branch    Branch          @relation(fields: [branchId], references: [id])
  variant   ProductVariant  @relation(fields: [variantId], references: [id])
  supplier  Supplier?       @relation(fields: [supplierId], references: [id])
  order     Order?          @relation(fields: [orderId], references: [id])
  creator   Member?         @relation(fields: [createdBy], references: [id])

  @@index([businessId])
  @@index([variantId])
  @@index([orderId])
  @@map("stock_movements")
}

enum StockMovementType {
  ENTRADA
  SALIDA
  AJUSTE
}
```

**Nota:** el vínculo `orderId` resuelve la ambigüedad del frontend donde el motivo "Venta #1284" era solo un string. Ahora la salida de stock por venta referencia la orden real. Al cobrar (POS u online), el backend crea los `stock_movements` de tipo SALIDA correspondientes.

### 7.3 `suppliers`

Proveedores del negocio.

```prisma
model Supplier {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  name        String
  contact     String?                       // persona de contacto
  phone       String?
  email       String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")

  business       Business        @relation(fields: [businessId], references: [id])
  stockMovements StockMovement[]

  @@index([businessId])
  @@map("suppliers")
}
```

**Nota:** `ultimaCompra` y `totalComprado` del frontend son calculados (agregando `stock_movements`), no se persisten.

---

## 8. Órdenes (POS + Online)

Modelo unificado: una tabla `orders` core compartida, con tablas satélite para los datos específicos de cada canal. Ver Decisión 1 del documento consolidado.

### 8.1 `orders`

La orden. Unifica ventas POS y pedidos online mediante el campo `channel`. Los campos comunes viven acá; los específicos de cada canal en las satélites.

```prisma
model Order {
  id            String   @id @default(uuid())
  businessId    String   @map("business_id")
  branchId      String   @map("branch_id")
  customerId    String?  @map("customer_id")   // NULL = venta anónima (POS)
  orderNumber   Int      @map("order_number")   // correlativo interno por negocio (uso operativo)
  fiscalNumber  String?  @map("fiscal_number")  // formato AFIP "PPPP-NNNNNNNN", NULL hasta facturar
  channel       OrderChannel
  status        OrderStatus @default(PENDING)
  subtotal      Decimal  @db.Decimal(12,2)
  discountTotal Decimal  @db.Decimal(12,2) @default(0) @map("discount_total")
  total         Decimal  @db.Decimal(12,2)
  notes         String?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt       @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")  // soft-delete

  business           Business             @relation(fields: [businessId], references: [id])
  branch             Branch               @relation(fields: [branchId], references: [id])
  customer           Customer?            @relation(fields: [customerId], references: [id])
  items              OrderItem[]
  payments           Payment[]
  posSaleDetails     PosSaleDetails?
  onlineOrderDetails OnlineOrderDetails?
  statusHistory      OrderStatusHistory[]
  redemptions        DiscountRedemption[]
  returns            Return[]
  creditNotes        CreditNote[]
  stockMovements     StockMovement[]
  reviews            Review[]

  @@unique([businessId, orderNumber])
  @@index([businessId])
  @@index([branchId])
  @@index([customerId])
  @@map("orders")
}

enum OrderChannel {
  POS
  ONLINE
}

enum OrderStatus {
  PENDING      // creada, esperando pago (online) o en proceso
  CONFIRMED    // pago confirmado
  PREPARING    // en preparación (online)
  SHIPPED      // enviado (online)
  DELIVERED    // entregado (online)
  COMPLETED    // completada (POS: nace aquí tras cobro)
  CANCELLED    // cancelada
}
```

**Notas sobre numeración:**
- `orderNumber`: correlativo interno de Orbita, único por negocio, autoincremental. Es lo que ve el dueño y el cliente ("Pedido #1284"). Se genera en el backend al crear la orden.
- `fiscalNumber`: nullable, se llena solo cuando se implemente facturación AFIP real (formato punto-de-venta + correlativo). En V1 queda null. Separado de `orderNumber` para no acoplar la operación diaria a la rigidez fiscal (correlatividad estricta, CAE, etc.).

**Notas sobre estados:**
- Una orden POS nace en `COMPLETED` (se cobró en el acto). No transiciona.
- Una orden ONLINE recorre `PENDING → CONFIRMED → PREPARING → SHIPPED → DELIVERED`. El backend valida las transiciones según `channel`.

### 8.2 `order_items`

Líneas de la orden. Cada línea referencia una **variante** (no un producto pelado, porque todo producto tiene variante default). Los precios se congelan al momento de la venta (snapshot).

```prisma
model OrderItem {
  id             String   @id @default(uuid())
  orderId        String   @map("order_id")
  variantId      String   @map("variant_id")
  productName    String   @map("product_name")     // snapshot del nombre
  variantLabel   String?  @map("variant_label")    // snapshot "M / Negro"
  quantity       Int
  unitPrice      Decimal  @db.Decimal(12,2) @map("unit_price")     // precio congelado
  editedPrice    Decimal? @db.Decimal(12,2) @map("edited_price")   // override manual (requiere permiso pos.edit_price)
  discountAmount Decimal  @db.Decimal(12,2) @default(0) @map("discount_amount")
  isConcept      Boolean  @default(false) @map("is_concept")       // ítem libre, NO descuenta stock
  notes          String?

  order   Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variant ProductVariant @relation(fields: [variantId], references: [id])

  @@index([orderId])
  @@index([variantId])
  @@map("order_items")
}
```

**Notas:**
- `editedPrice`: permite cambiar el precio en el ticket POS. Solo miembros con permiso `pos.edit_price`. Queda registrado y auditable.
- `isConcept`: ítem libre (ej: "Arreglo de dobladillo $2000") que no existe como producto y no descuenta stock. Resuelve la ambigüedad del frontend.
- `productName`/`variantLabel` son snapshots: si el producto se renombra o borra después, la orden histórica conserva el nombre original.

### 8.3 `pos_sale_details`

Datos específicos de ventas POS. Relación 1:1 con `orders` (solo existe cuando `channel = POS`).

```prisma
model PosSaleDetails {
  orderId       String  @id @map("order_id")
  cashSessionId String  @map("cash_session_id")
  changeAmount  Decimal? @db.Decimal(12,2) @map("change_amount")   // vuelto

  order       Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  cashSession CashSession @relation(fields: [cashSessionId], references: [id])

  @@map("pos_sale_details")
}
```

**Nota:** el `receiptNumber` que aparecía en el frontend POS se reemplaza por `orderNumber`/`fiscalNumber` de la orden. La sesión de caja se referencia para el arqueo.

### 8.4 `online_order_details`

Datos específicos de pedidos online. Relación 1:1 con `orders` (solo cuando `channel = ONLINE`). Incluye datos de envío y del comprador (snapshot).

```prisma
model OnlineOrderDetails {
  orderId           String   @id @map("order_id")
  shippingAddressId String?  @map("shipping_address_id")
  buyerName         String   @map("buyer_name")     // snapshot
  buyerEmail        String   @map("buyer_email")
  buyerPhone        String?  @map("buyer_phone")
  tracking          String?
  shippingCost      Decimal? @db.Decimal(12,2) @map("shipping_cost")

  order           Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  shippingAddress Address? @relation(fields: [shippingAddressId], references: [id])

  @@map("online_order_details")
}
```

### 8.5 `order_status_history`

Timeline de cambios de estado. **Solo para órdenes online** (POS nace y muere en COMPLETED). Solo-inserción.

```prisma
model OrderStatusHistory {
  id        String   @id @default(uuid())
  orderId   String   @map("order_id")
  status    OrderStatus
  createdAt DateTime @default(now()) @map("created_at")

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@map("order_status_history")
}
```

---

## 9. Pagos y caja

### 9.1 `payments`

Pagos de las órdenes. Reemplaza a `order_payments`. Relación 1:N con `orders` (soporta pago mixto: parte efectivo, parte tarjeta). Cubre efectivo, transferencia, y MercadoPago (online y Point).

```prisma
model Payment {
  id             String   @id @default(uuid())
  businessId     String   @map("business_id")
  orderId        String   @map("order_id")
  method         PaymentMethod
  status         PaymentStatus @default(PENDING)
  amount         Decimal  @db.Decimal(12,2)
  currency       String   @default("ARS")
  reference      String?                            // nro de transferencia, etc.

  // Campos MercadoPago (null en efectivo/transferencia manual)
  mpOrderId      String?  @map("mp_order_id")        // ID de la Order en MP
  mpPaymentId    String?  @map("mp_payment_id")      // ID del payment en MP
  mpStatus       String?  @map("mp_status")          // status raw de MP
  mpStatusDetail String?  @map("mp_status_detail")   // "accredited", "pending_waiting_payment"

  channel        OrderChannel
  paidAt         DateTime? @map("paid_at")           // cuándo se confirmó

  // Verificación manual (transferencias POS: no hay webhook, confirma un humano)
  verifiedBy     String?  @map("verified_by")         // FK → members (qué cajero confirmó la transferencia)
  verifiedAt     DateTime? @map("verified_at")

  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt       @map("updated_at")

  business Business @relation(fields: [businessId], references: [id])
  order    Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  verifier Member?  @relation(fields: [verifiedBy], references: [id])

  @@index([businessId])
  @@index([orderId])
  @@index([mpOrderId])
  @@map("payments")
}

enum PaymentMethod {
  MERCADOPAGO
  CASH
  DEBIT_CARD
  CREDIT_CARD
  TRANSFER
  QR
}

enum PaymentStatus {
  PENDING     // esperando confirmación (checkout online, Point)
  APPROVED    // pago confirmado
  REJECTED    // rechazado
  REFUNDED    // reembolsado
  CANCELLED   // cancelado
}
```

**Flujos de pago:**
- **Online con MP:** payment `PENDING` → se crea Order de MP → cliente paga → webhook → `APPROVED` + `paidAt` → orden `CONFIRMED`.
- **POS con Point:** payment `PENDING` → Order de MP al device → cliente paga en terminal → webhook → `APPROVED`.
- **POS efectivo:** payment `APPROVED` directo (el cajero confirma), sin campos MP.
- **POS transferencia:** payment `PENDING` → el sistema muestra el `transferAlias` del negocio (de `business_config`) → el cliente transfiere desde su billetera → el cajero anota el **número de operación** en `reference` → el cajero verifica el comprobante y confirma → payment `APPROVED` con `verifiedBy` = el cajero y `verifiedAt` = ahora. **No hay webhook: la confirmación es humana** y queda registrada para trazabilidad.
- **POS con QR (fallback sin Point):** payment `PENDING` → Order de MP → QR en pantalla → cliente escanea → webhook → `APPROVED`.

### 9.2 `cash_sessions`

Sesiones de caja del POS. Una sesión = un turno de un cajero en una sucursal. Soporta **múltiples cajas simultáneas** por sucursal (cada cajero abre su propia sesión).

```prisma
model CashSession {
  id            String   @id @default(uuid())
  businessId    String   @map("business_id")
  branchId      String   @map("branch_id")
  cashierId     String   @map("cashier_id")      // FK → members
  openedAt      DateTime @default(now()) @map("opened_at")
  closedAt      DateTime? @map("closed_at")
  initialAmount Decimal  @db.Decimal(12,2) @map("initial_amount")   // fondo inicial
  countedAmount Decimal? @db.Decimal(12,2) @map("counted_amount")   // conteo real al cierre
  difference    Decimal? @db.Decimal(12,2)                          // countedAmount - teórico
  status        CashSessionStatus @default(OPEN)
  notes         String?

  business       Business         @relation(fields: [businessId], references: [id])
  branch         Branch           @relation(fields: [branchId], references: [id])
  cashier        Member           @relation(fields: [cashierId], references: [id])
  posSaleDetails PosSaleDetails[]
  cashMovements  CashMovement[]

  @@index([businessId])
  @@index([branchId])
  @@map("cash_sessions")
}

enum CashSessionStatus {
  OPEN
  CLOSED
  FORCED    // cierre forzado
}
```

**Nota:** el `difference` (arqueo) se calcula al cierre: `countedAmount - (initialAmount + ventas_efectivo + ingresos - egresos)`. Los ingresos/egresos vienen de `cash_movements`.

### 9.3 `cash_movements`

Movimientos de efectivo del turno que NO son ventas: retiros, ingresos de cambio, pagos a cadetes, compra de insumos. Necesarios para que el arqueo de caja cierre correctamente.

```prisma
model CashMovement {
  id            String   @id @default(uuid())
  businessId    String   @map("business_id")
  branchId      String   @map("branch_id")
  cashSessionId String   @map("cash_session_id")
  type          CashMovementType
  amount        Decimal  @db.Decimal(12,2)
  reason        String                          // "Pago cadete", "Compra insumos"
  createdBy     String   @map("created_by")     // FK → members
  createdAt     DateTime @default(now()) @map("created_at")

  business    Business    @relation(fields: [businessId], references: [id])
  branch      Branch      @relation(fields: [branchId], references: [id])
  cashSession CashSession @relation(fields: [cashSessionId], references: [id], onDelete: Cascade)
  creator     Member      @relation(fields: [createdBy], references: [id])

  @@index([cashSessionId])
  @@map("cash_movements")
}

enum CashMovementType {
  INGRESO   // entra efectivo (ej: cambio adicional)
  EGRESO    // sale efectivo (ej: pago a cadete, retiro)
}
```

---

## 10. MercadoPago

Estructura para la integración vía Orders API (unifica checkout online y Point). OAuth por negocio. Jerarquía Point: store → point_of_sale → device.

### 10.1 `mp_credentials`

Credenciales OAuth del negocio. Relación 1:1 con `businesses`. **Los tokens se almacenan cifrados** (pgcrypto).

```prisma
model MpCredentials {
  id             String   @id @default(uuid())
  businessId     String   @unique @map("business_id")
  mpUserId       String   @map("mp_user_id")          // user_id de MP
  accessToken    String   @map("access_token")        // CIFRADO (pgp_sym_encrypt)
  refreshToken   String   @map("refresh_token")       // CIFRADO
  tokenExpiresAt DateTime @map("token_expires_at")    // refresh cada 180 días
  scopes         String[]
  isActive       Boolean  @default(true) @map("is_active")   // false si el comercio desautoriza
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt       @map("updated_at")

  business Business  @relation(fields: [businessId], references: [id])
  stores   MpStore[]

  @@map("mp_credentials")
}
```

**Notas:**
- `accessToken` y `refreshToken` se cifran con `pgp_sym_encrypt` (pgcrypto de Supabase) usando una key en variable de entorno. Nunca en texto plano.
- `tokenExpiresAt`: el flujo OAuth `authorization_code` expira cada 180 días; hay que refrescar con `refreshToken`.
- `isActive`: se escucha el webhook de desautorización de MP. Si el comercio revoca el acceso, se marca `false` y se notifica al dueño.

### 10.2 `mp_stores`

Local de MercadoPago. Mapea a una sucursal de Orbita. Necesario para Point.

```prisma
model MpStore {
  id            String   @id @default(uuid())
  credentialsId String   @map("credentials_id")
  branchId      String   @map("branch_id")     // mapea a branches de Orbita
  mpStoreId     String   @map("mp_store_id")    // ID del store en MP
  name          String?
  createdAt     DateTime @default(now()) @map("created_at")

  credentials MpCredentials @relation(fields: [credentialsId], references: [id], onDelete: Cascade)
  branch      Branch        @relation(fields: [branchId], references: [id])
  pos         MpPos[]

  @@index([credentialsId])
  @@map("mp_stores")
}
```

### 10.3 `mp_pos`

Caja de MercadoPago (point_of_sale), asociada a un store. Una sucursal con múltiples cajas físicas necesita una `mp_pos` por caja.

```prisma
model MpPos {
  id        String   @id @default(uuid())
  storeId   String   @map("store_id")
  mpPosId   String   @map("mp_pos_id")   // ID del POS en MP
  name      String?
  createdAt DateTime @default(now()) @map("created_at")

  store   MpStore    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  devices MpDevice[]

  @@index([storeId])
  @@map("mp_pos")
}
```

### 10.4 `mp_devices`

Dispositivo Point físico. Se vincula manualmente (pairing de hardware) y se pone en modo PDV vía API. **Solo un dispositivo en modo PDV por caja.**

```prisma
model MpDevice {
  id            String   @id @default(uuid())
  posId         String   @map("pos_id")
  mpDeviceId    String   @map("mp_device_id")     // ID del device en MP
  operatingMode String   @default("PDV") @map("operating_mode")   // PDV | STANDALONE
  serialNumber  String?  @map("serial_number")    // para match visual con etiqueta física
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")

  pos MpPos @relation(fields: [posId], references: [id], onDelete: Cascade)

  @@index([posId])
  @@map("mp_devices")
}
```

**Nota pendiente de sandbox:** falta confirmar contra un Point físico si el PATCH a modo PDV asocia automáticamente el device a la caja, o si requiere un paso manual adicional de vinculación. No cerrar este tramo sin probarlo.

---

## 11. Descuentos y cupones

Una sola tabla `discounts` con un campo `code` nullable unifica descuentos automáticos (sin código) y cupones (con código). Ver decisión de unificación. En V1 solo se implementa la lógica de evaluación de los 4 tipos triviales; el enum mantiene los 7 valores para no migrar en V2.

### 11.1 `discounts`

Descuento o cupón. Si `code` es null, es un descuento automático. Si tiene valor, es un cupón canjeable.

```prisma
model Discount {
  id             String   @id @default(uuid())
  businessId     String   @map("business_id")
  name           String
  code           String?                       // NULL = descuento automático | con valor = cupón

  type           DiscountType
  value          Decimal  @db.Decimal(12,2)
  scope          DiscountScope

  // Nivel de aplicación
  productLevel   String?  @map("product_level")   // 'padre' | 'variante'

  // Condiciones (para tipos con requisitos)
  minQuantity    Int?     @map("min_quantity")
  minAmount      Decimal? @db.Decimal(12,2) @map("min_amount")

  // Aplicación y vigencia
  application    DiscountApplication @default(AUTOMATIC)
  startDate      DateTime  @map("start_date")
  endDate        DateTime? @map("end_date")        // NULL = sin vencimiento
  activeDays     Int[]     @map("active_days")     // [0-6], días de la semana
  startTime      String?   @map("start_time")      // "HH:mm"
  endTime        String?   @map("end_time")

  // Límites de uso
  maxUsesTotal      Int?  @map("max_uses_total")
  maxUsesPerCustomer Int? @map("max_uses_per_customer")   // requiere tracking de canjes
  usesConsumed      Int   @default(0) @map("uses_consumed")

  // Cupón: link compartible
  linkActive     Boolean @default(false) @map("link_active")
  linkRedirect   String? @map("link_redirect")

  // Control
  priority       Int      @default(0)              // para "best discount wins"
  isPrivate      Boolean  @default(false) @map("is_private")   // cupón: no aparece en tienda
  isActive       Boolean  @default(true) @map("is_active")
  createdBy      String?  @map("created_by")        // FK → members
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt       @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")       // soft-delete

  business    Business             @relation(fields: [businessId], references: [id])
  products    DiscountProduct[]
  categories  DiscountCategory[]
  redemptions DiscountRedemption[]

  @@unique([businessId, code])   // código único por negocio (cuando no es null)
  @@index([businessId])
  @@map("discounts")
}

enum DiscountType {
  PERCENT_PRODUCT    // % sobre producto      (V1)
  AMOUNT_PRODUCT     // $ sobre producto      (V1)
  PERCENT_TICKET     // % sobre ticket        (V1)
  AMOUNT_TICKET      // $ sobre ticket        (V1)
  BUY_X_PAY_Y        // llevá X pagá Y        (V2)
  BUY_X_GET_Z        // comprá X obtené Z     (V2)
  VOLUME             // por volumen/escalas   (V2)
}

enum DiscountScope {
  PRODUCT
  CATEGORY
  TICKET
}

enum DiscountApplication {
  AUTOMATIC   // se aplica solo
  MANUAL      // el cajero lo aplica
}
```

**Notas:**
- **V1 solo implementa** `PERCENT_PRODUCT`, `AMOUNT_PRODUCT`, `PERCENT_TICKET`, `AMOUNT_TICKET`. Los otros 3 están en el enum pero su lógica de evaluación se difiere a V2. La UI los oculta.
- `estado` (activo/programado/expirado/agotado) del frontend es **derivado** de `isActive` + fechas + `usesConsumed/maxUsesTotal`. No se persiste.
- "Best discount wins": el backend evalúa en `/api/discounts/evaluate` y aplica el de mayor ahorro (con `priority` como desempate).
- Los campos de bonus (`compra_x_obtiene_z`) se omiten en V1 ya que ese tipo está diferido; se agregan cuando se implemente.

### 11.2 `discount_products`

Pivot N:N: a qué productos aplica el descuento (cuando `scope = PRODUCT`).

```prisma
model DiscountProduct {
  discountId String @map("discount_id")
  productId  String @map("product_id")

  discount Discount @relation(fields: [discountId], references: [id], onDelete: Cascade)

  @@id([discountId, productId])
  @@map("discount_products")
}
```

### 11.3 `discount_categories`

Pivot N:N: a qué categorías aplica el descuento (cuando `scope = CATEGORY`).

```prisma
model DiscountCategory {
  discountId String @map("discount_id")
  categoryId String @map("category_id")

  discount Discount @relation(fields: [discountId], references: [id], onDelete: Cascade)

  @@id([discountId, categoryId])
  @@map("discount_categories")
}
```

### 11.4 `discount_redemptions`

Registro de cada aplicación de descuento o cupón. Solo-inserción. Imprescindible para límites por cliente, tasa de canje y métricas por canal. Trackea tanto descuentos automáticos como cupones.

```prisma
model DiscountRedemption {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  orderId     String   @map("order_id")
  orderItemId String?  @map("order_item_id")   // NULL = aplicado al ticket completo
  customerId  String?  @map("customer_id")     // NULL = venta anónima
  discountId  String   @map("discount_id")
  channel     RedemptionChannel
  amount      Decimal  @db.Decimal(12,2)        // monto descontado en esta aplicación
  createdAt   DateTime @default(now()) @map("created_at")

  business Business @relation(fields: [businessId], references: [id])
  order    Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  discount Discount @relation(fields: [discountId], references: [id])

  @@index([businessId])
  @@index([discountId])
  @@index([customerId])
  @@map("discount_redemptions")
}

enum RedemptionChannel {
  POS
  STOREFRONT
}
```

**Nota:** al unificar descuentos y cupones en una sola tabla `discounts`, el canje solo necesita `discountId` (ya no `discount_id` Y `coupon_id` separados como en el diseño anterior). Simplifica la tabla.

---

## 12. Devoluciones y notas de crédito

### 12.1 `returns`

Devoluciones. Se vincula a la orden original (resuelve la ambigüedad del frontend donde faltaba `pedido_id`).

```prisma
model Return {
  id             String   @id @default(uuid())
  businessId     String   @map("business_id")
  orderId        String   @map("order_id")        // vínculo a la orden original
  orderItemId    String?  @map("order_item_id")   // línea específica devuelta
  quantity       Int
  amount         Decimal  @db.Decimal(12,2)        // a reembolsar
  reason         String
  status         ReturnStatus @default(PENDING)
  refundMethod   RefundMethod @map("refund_method")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt       @map("updated_at")

  business    Business     @relation(fields: [businessId], references: [id])
  order       Order        @relation(fields: [orderId], references: [id])
  creditNote  CreditNote?

  @@index([businessId])
  @@index([orderId])
  @@map("returns")
}

enum ReturnStatus {
  PENDING
  IN_PROCESS
  APPROVED
  REJECTED
}

enum RefundMethod {
  CREDIT_NOTE   // nota de crédito
  REFUND        // reembolso
}
```

### 12.2 `credit_notes`

Notas de crédito. Se generan desde una devolución (cuando `refundMethod = CREDIT_NOTE`) o manualmente.

```prisma
model CreditNote {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  orderId     String   @map("order_id")
  returnId    String?  @unique @map("return_id")   // 1:1 opcional con la devolución que la originó
  customerId  String?  @map("customer_id")
  amount      Decimal  @db.Decimal(12,2)
  type        CreditNoteType
  status      CreditNoteStatus @default(ISSUED)
  expiresAt   DateTime? @map("expires_at")          // fecha real (no string de display)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")

  business Business @relation(fields: [businessId], references: [id])
  order    Order    @relation(fields: [orderId], references: [id])
  return   Return?  @relation(fields: [returnId], references: [id])

  @@index([businessId])
  @@map("credit_notes")
}

enum CreditNoteType {
  BALANCE   // saldo a favor
  REFUND    // reembolso
}

enum CreditNoteStatus {
  ISSUED    // emitida
  APPLIED   // aplicada
}
```

**Nota:** `expiresAt` es un `DateTime` real, resolviendo la ambigüedad del frontend donde `vence` era un string de display ("30 jun").

---

## 13. Mensajería

Solo aplica en modo `FULL` (en vidriera digital no hay módulo de mensajes). Un hilo por cliente, con menciones opcionales a pedidos.

### 13.1 `conversations`

```prisma
model Conversation {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  customerId  String   @map("customer_id")   // FK real (antes era string nombre)
  isUnread    Boolean  @default(true) @map("is_unread")
  isArchived  Boolean  @default(false) @map("is_archived")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")

  business Business  @relation(fields: [businessId], references: [id])
  customer Customer  @relation(fields: [customerId], references: [id])
  messages Message[]

  @@index([businessId])
  @@index([customerId])
  @@map("conversations")
}
```

### 13.2 `messages`

```prisma
model Message {
  id             String   @id @default(uuid())
  conversationId String   @map("conversation_id")
  sender         MessageSender               // enum unificado (antes 'cli'/'me' vs 'cliente'/'tienda')
  text           String
  orderId        String?  @map("order_id")   // mención opcional a un pedido
  createdAt      DateTime @default(now()) @map("created_at")   // timestamp real (antes string display)

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("messages")
}

enum MessageSender {
  CUSTOMER
  STORE
}
```

**Nota:** el enum `MessageSender` unifica los remitentes que en el frontend estaban inconsistentes (panel usaba 'cli'/'me', storefront 'cliente'/'tienda'). `createdAt` es timestamp real, no string de display.

### 13.3 `message_templates`

Plantillas de mensajes con variables (`{nombre}`, `{id}`, `{tracking}`).

```prisma
model MessageTemplate {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  name        String
  text        String                          // con variables {nombre}, {tracking}, etc.
  category    TemplateCategory
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")

  business Business @relation(fields: [businessId], references: [id])

  @@index([businessId])
  @@map("message_templates")
}

enum TemplateCategory {
  PEDIDO
  RETIRO
  ENVIO
  POSTVENTA
  OTRO
}
```

---

## 14. Opiniones

### 14.1 `reviews`

Opiniones verificadas de compradores, sin rating numérico. Solo aplica en modo `FULL`. El dueño puede ocultar con razón obligatoria (Opción A de moderación). La tabla existe siempre; la lógica de negocio decide si se puebla según el modo del negocio.

```prisma
model Review {
  id           String   @id @default(uuid())
  businessId   String   @map("business_id")
  productId    String   @map("product_id")
  customerId   String   @map("customer_id")
  orderId      String   @map("order_id")        // para verificar la compra
  text         String
  status       ReviewStatus @default(VISIBLE)
  hiddenReason String?  @map("hidden_reason")   // obligatorio al ocultar
  isVerified   Boolean  @default(true) @map("is_verified")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt       @map("updated_at")

  business Business @relation(fields: [businessId], references: [id])
  product  Product  @relation(fields: [productId], references: [id])
  customer Customer @relation(fields: [customerId], references: [id])
  order    Order    @relation(fields: [orderId], references: [id])

  @@unique([customerId, productId, orderId])   // una opinión por compra
  @@index([businessId])
  @@index([productId])
  @@map("reviews")
}

enum ReviewStatus {
  VISIBLE
  HIDDEN    // ocultada por el dueño (con hiddenReason)
}
```

**Notas:**
- **Verificación:** al crear la opinión, el backend comprueba que existe un `order` de ese `customer` con ese `product` en estado `DELIVERED`/`COMPLETED`.
- **Moderación (Opción A):** el dueño puede pasar una opinión a `HIDDEN` con `hiddenReason` obligatorio. No se borra de la DB. Se puede mostrar un indicador de transparencia.
- `@@unique([customerId, productId, orderId])`: un cliente deja una opinión por producto por compra.
- **Pendiente:** definir el flujo de solicitud de opinión (email post-entrega, sección en perfil, o banner).

---

## 15. Auditoría

### 15.1 `audit_logs`

Registro genérico de auditoría, polimórfico (aplica a cualquier entidad). En el frontend solo existía para descuentos; se generaliza desde el inicio.

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  entityType  String   @map("entity_type")     // "discount", "product", "order", "price", etc.
  entityId    String   @map("entity_id")
  action      AuditAction
  memberId    String?  @map("member_id")        // quién lo hizo
  memberName  String?  @map("member_name")      // snapshot
  changes     Json?                             // [{ field, before, after }]
  createdAt   DateTime @default(now()) @map("created_at")

  business Business @relation(fields: [businessId], references: [id])

  @@index([businessId])
  @@index([entityType, entityId])
  @@map("audit_logs")
}

enum AuditAction {
  CREATE
  UPDATE
  ACTIVATE
  DEACTIVATE
  DELETE
}
```

**Nota:** `entityType` + `entityId` permiten auditar cualquier tabla. Útil especialmente para: cambios de precio en POS (`pos.edit_price`), toggles de descuentos, cambios de estado de órdenes, y modificaciones de configuración.

---

## 16. Suscripciones a Orbita

**Importante — dos tipos de pago distintos.** No confundir estas tablas con `payments`. Hay dos flujos de dinero totalmente separados en Orbita:

- **`payments`** (sección 9): lo que los clientes le pagan a los **negocios** por sus compras (ventas).
- **`subscriptions` / `subscription_payments`** (esta sección): lo que los **negocios** le pagan a **Orbita** por usar el software.

Nunca se mezclan.

### 16.1 `subscriptions`

La suscripción de un negocio a Orbita. Relación 1:1 con `businesses`. Su estado controla el acceso del negocio a la plataforma. Distingue entre suscripciones pagas (débito automático de MercadoPago) y licencias cedidas gratis por un admin de Orbita.

```prisma
model Subscription {
  id                 String   @id @default(uuid())
  businessId         String   @unique @map("business_id")
  origin             SubscriptionOrigin              // paid | comp (cortesía)
  status             SubscriptionStatus @default(ACTIVE)
  plan               String   @default("standard")   // plan contratado (para futuros planes)
  amount             Decimal  @db.Decimal(12,2)       // monto mensual (0 si comp)
  currency           String   @default("ARS")

  // Ciclo de facturación
  currentPeriodStart DateTime @map("current_period_start")
  currentPeriodEnd   DateTime @map("current_period_end")    // cuándo vence el período actual
  gracePeriodDays    Int      @default(4) @map("grace_period_days")  // política B: 3-5 días (configurable)

  // MercadoPago (solo si origin = paid)
  mpPreapprovalId    String?  @map("mp_preapproval_id")   // ID de la suscripción/preapproval en MP

  // Licencia cedida (solo si origin = comp)
  grantedBy          String?  @map("granted_by")          // FK → platform_admins (qué admin la otorgó)
  grantReason        String?  @map("grant_reason")        // "Cliente beta", "Promoción lanzamiento"

  cancelledAt        DateTime? @map("cancelled_at")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt       @map("updated_at")

  business           Business              @relation(fields: [businessId], references: [id])
  grantedByAdmin     PlatformAdmin?        @relation(fields: [grantedBy], references: [id])
  payments           SubscriptionPayment[]

  @@index([status])
  @@map("subscriptions")
}

enum SubscriptionOrigin {
  PAID   // débito automático de MercadoPago (preapproval)
  COMP   // licencia cedida gratis por un admin de Orbita (cortesía)
}

enum SubscriptionStatus {
  ACTIVE      // al día (paga) o vigente (comp)
  PAST_DUE    // un cobro automático falló, en período de gracia (solo origin = paid)
  SUSPENDED   // se agotó la gracia sin pago, o venció una licencia comp sin renovar
  CANCELLED   // dada de baja definitiva
}
```

**Notas sobre estados (política de mora B — balanceada):**
- **`ACTIVE` → `PAST_DUE`:** cuando un cobro automático de MP falla. Durante `gracePeriodDays` (3-5 días) el negocio sigue funcionando pero ve un aviso de "pago pendiente". MP reintenta el cobro.
- **`PAST_DUE` → `ACTIVE`:** si un reintento tiene éxito dentro de la gracia.
- **`PAST_DUE` → `SUSPENDED`:** si se agota la gracia sin pago. La tienda queda "temporalmente no disponible", el panel en modo lectura. El subdominio deja de servir; el dominio custom (si tiene) apunta a página de suspensión.
- **`SUSPENDED` → `ACTIVE`:** reactivación inmediata al regularizar.
- **`SUSPENDED` → `CANCELLED`:** tras un período prolongado de mora (a definir), se cancela y se libera el subdominio.

**Notas sobre licencias cedidas (`origin = COMP`):**
- Un admin de Orbita (ver sección 17) otorga la licencia desde el super-panel. `amount = 0`, `mpPreapprovalId = null`, `grantedBy` = el admin.
- La licencia tiene una fecha de fin fija (`currentPeriodEnd`). Al llegar, si el negocio no renovó manualmente (poniendo débito automático → pasa a `origin = PAID`), la suscripción pasa directo a `SUSPENDED`. **No entra en período de gracia** — la gracia es para fallos de cobro, y una comp no tiene cobro. Muere al vencer, como se definió.

### 16.2 `subscription_payments`

Historial de cada cobro mensual de suscripción. Solo-inserción. Solo aplica a suscripciones `origin = PAID` (las `COMP` no generan cobros).

```prisma
model SubscriptionPayment {
  id             String   @id @default(uuid())
  subscriptionId String   @map("subscription_id")
  amount         Decimal  @db.Decimal(12,2)
  status         SubscriptionPaymentStatus
  periodStart    DateTime @map("period_start")
  periodEnd      DateTime @map("period_end")
  mpPaymentId    String?  @map("mp_payment_id")    // ID del cobro en MP
  paidAt         DateTime? @map("paid_at")
  failedReason   String?  @map("failed_reason")     // si falló: motivo devuelto por MP
  createdAt      DateTime @default(now()) @map("created_at")

  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId])
  @@map("subscription_payments")
}

enum SubscriptionPaymentStatus {
  APPROVED
  FAILED
  PENDING
}
```

**Nota:** cada intento de cobro (exitoso o fallido) genera una fila. Los fallos alimentan la transición a `PAST_DUE` y el conteo de reintentos.

---

## 17. Super-administración de plataforma

Este es un nivel **por encima** del multi-tenant. Son los operadores de Orbita (el equipo fundador), no miembros de ningún negocio. Pueden ver todos los negocios, ceder licencias, suspender cuentas. **No confundir con el rol "admin" dentro de un negocio** (`members` + `roles`), que es local a un negocio.

### 17.1 `platform_admins`

Staff de Orbita. No lleva `business_id` — está fuera del multi-tenant. Autenticación vía Supabase Auth, separada de la de los miembros de negocios.

```prisma
model PlatformAdmin {
  id          String   @id @default(uuid())
  authUserId  String   @unique @map("auth_user_id")  // FK → Supabase auth.users
  name        String
  email       String   @unique
  role        PlatformAdminRole @default(OPERATOR)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt       @map("updated_at")

  grantedSubscriptions Subscription[]
  logs                 PlatformAdminLog[]

  @@map("platform_admins")
}

enum PlatformAdminRole {
  SUPERADMIN   // acceso total (fundadores)
  OPERATOR     // soporte / operaciones (acceso acotado)
}
```

**Nota:** en V1 los tres fundadores son `SUPERADMIN`. El rol `OPERATOR` queda para cuando sumen personal de soporte con acceso limitado.

### 17.2 `platform_admin_logs`

Auditoría de las acciones sensibles del staff de Orbita: ceder licencias, suspender negocios, etc. Solo-inserción. Separado de `audit_logs` (que es por negocio) porque estas acciones son a nivel plataforma.

```prisma
model PlatformAdminLog {
  id          String   @id @default(uuid())
  adminId     String   @map("admin_id")
  action      String                          // "grant_license", "suspend_business", "cancel_subscription"
  targetType  String   @map("target_type")     // "business", "subscription"
  targetId    String   @map("target_id")
  details     Json?                            // contexto de la acción
  createdAt   DateTime @default(now()) @map("created_at")

  admin PlatformAdmin @relation(fields: [adminId], references: [id])

  @@index([adminId])
  @@index([targetType, targetId])
  @@map("platform_admin_logs")
}
```

---

## 18. Dominios

Modelo de tres caminos (ver documento de decisión de dominios). En V1 se implementan el **camino 1 (subdominio)** y el **camino 3 (comprar vía Orbita)**. El **camino 2 (vincular dominio propio)** queda modelado en el schema pero sin UI ni flujo en V1 — se habilita en V2 sin cambiar la base de datos.

### 18.1 `subdomain` (campo en `businesses`)

El camino 1 no necesita tabla propia: es el campo `subdomain` en `businesses` (ver sección 3.1), único a nivel global. Gratis, automático, es el default. Ejemplo: `zapatoslorena.orbita.site`.

### 18.2 `custom_domains`

Dominios propios del cliente (caminos 2 y 3). La tabla se construye **completa** en V1, pero en V1 solo se generan registros con `source = 'purchased'` (camino 3). El valor `source = 'linked'` (camino 2) existe en el modelo pero ningún flujo lo crea hasta V2.

```prisma
model CustomDomain {
  id            String   @id @default(uuid())
  businessId    String   @map("business_id")
  domain        String   @unique                    // "zapatoslorena.com"
  source        DomainSource                        // purchased (V1) | linked (V2, latente)
  ownerType     String   @default("customer") @map("owner_type")  // siempre el cliente es titular
  registrar     String?                             // solo purchased: "opensrs" | "resellerclub"

  status        DomainStatus @default(PENDING)
  dnsVerified   Boolean  @default(false) @map("dns_verified")     // DNS apuntando correctamente (modelo Shopify)
  sslStatus     SslStatus @default(PROVISIONING) @map("ssl_status")  // gestionado por Vercel

  // Solo si source = purchased (Orbita gestiona vencimiento y renovación)
  purchasedAt   DateTime? @map("purchased_at")
  expiresAt     DateTime? @map("expires_at")
  autoRenew     Boolean  @default(true) @map("auto_renew")

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt       @map("updated_at")

  business Business @relation(fields: [businessId], references: [id])

  @@index([businessId])
  @@map("custom_domains")
}

enum DomainSource {
  PURCHASED   // comprado vía Orbita (camino 3) — V1. Orbita gestiona compra, renovación, SSL.
  LINKED      // el cliente trajo su dominio (camino 2) — V2 latente. Orbita solo verifica DNS + SSL.
}

enum DomainStatus {
  PENDING     // recién creado, esperando configuración/verificación DNS
  VERIFYING   // verificando DNS
  ACTIVE      // funcionando
  SUSPENDED   // suspendido (ej: negocio con suscripción suspendida)
  EXPIRED     // dominio vencido (solo purchased)
}

enum SslStatus {
  PROVISIONING   // Vercel emitiendo el certificado
  ACTIVE
  FAILED
}
```

**Notas:**
- **Verificación DNS (modelo Shopify):** el cliente apunta un registro A al IP fijo de Orbita para el dominio raíz, y un CNAME al proxy de Orbita para el `www`. El sistema verifica antes de activar (`dnsVerified`).
- **SSL (Vercel):** Orbita informa a Vercel vía API que el dominio pertenece al proyecto; Vercel emite y renueva el certificado (Let's Encrypt) automáticamente. `sslStatus` refleja ese proceso.
- **`.com.ar`:** NO se revende (restricción de NIC.ar/AFIP). Un cliente con `.com.ar` solo puede usarlo por el camino 2 (`linked`), que en V1 está latente. En V1, el camino 3 ofrece solo TLDs internacionales revendibles (`.com`, `.net`, `.io`, etc.).
- **Diferencia `purchased` vs `linked`:** en `purchased`, Orbita gestiona vencimiento y renovación (campos `expiresAt`, `autoRenew`). En `linked`, esos campos quedan null porque el cliente gestiona su dominio donde lo compró; Orbita solo hace verificación DNS + SSL.

---

## 19. Resumen de relaciones

Relaciones clave del sistema (formato: origen → destino [cardinalidad]):

**Negocio (raíz):**
- `businesses → branches` [1:N]
- `businesses → business_config / storefront_config / notification_config` [1:1 cada una]
- `businesses → members / roles / customers / products / categories / discounts / orders` [1:N]

**Equipo:**
- `roles → members` [1:N]
- `roles ↔ permissions` [N:N vía role_permissions]

**Clientes:**
- `customers → addresses` [1:N]
- `customers → orders / reviews / conversations` [1:N]

**Catálogo:**
- `categories → categories` [1:N self, árbol]
- `categories → products` [1:N]
- `products ↔ tags` [N:N vía product_tags]
- `products → product_options → product_option_values` [1:N → 1:N]
- `products → product_variants` [1:N]
- `product_variants ↔ product_option_values` [N:N vía variant_option_values]
- `products → product_images` [1:N], `product_option_values → product_images` [1:N opcional]

**Inventario:**
- `product_variants → variant_stock ← branches` [N:1 × N:1, único por par]
- `product_variants → stock_movements` [1:N]
- `suppliers → stock_movements` [1:N opcional]

**Órdenes:**
- `orders → order_items → product_variants` [1:N → N:1]
- `orders → pos_sale_details / online_order_details` [1:1 según canal]
- `orders → order_status_history` [1:N, solo online]
- `orders → payments` [1:N]
- `orders → discount_redemptions ← discounts` [1:N × N:1]
- `orders → returns → credit_notes` [1:N → 1:1]

**Caja:**
- `cash_sessions → cash_movements` [1:N]
- `cash_sessions → pos_sale_details` [1:N]

**MercadoPago:**
- `mp_credentials → mp_stores → mp_pos → mp_devices` [1:N → 1:N → 1:N]
- `mp_stores → branches` [N:1]

**Mensajería:**
- `conversations → messages` [1:N]
- `conversations → customers` [N:1]

**Opiniones:**
- `reviews → products / customers / orders` [N:1 cada una]

**Suscripciones (negocio → Orbita):**
- `businesses → subscriptions` [1:1]
- `subscriptions → subscription_payments` [1:N]
- `subscriptions → platform_admins` [N:1 opcional, vía `granted_by` en licencias comp]

**Super-administración:**
- `platform_admins → subscriptions` [1:N, licencias cedidas]
- `platform_admins → platform_admin_logs` [1:N]
- `platform_admins` NO tiene `business_id` (está fuera del multi-tenant)

**Dominios:**
- `businesses → custom_domains` [1:N]
- `businesses.subdomain` [campo único global, camino 1]

---

## 20. Orden de implementación

Se recomienda implementar el backend en este orden, respetando las dependencias:

**Fase 1 — Fundación (tenant + auth)**
1. `businesses` + `branches` (auto-crear branch default)
2. `permissions` (seed global) + `roles` + `role_permissions` + `members`
3. Integración Supabase Auth
4. `business_config` + `storefront_config` + `notification_config`

**Fase 2 — Catálogo**
5. `categories` (árbol) + `tags`
6. `products` + `product_options` + `product_option_values`
7. `product_variants` + `variant_option_values` (con variante default automática)
8. `product_images`

**Fase 3 — Inventario**
9. `variant_stock` (por branch) + `suppliers`
10. `stock_movements`

**Fase 4 — Clientes**
11. `customers` + `addresses`

**Fase 5 — Órdenes y pagos**
12. `orders` + `order_items`
13. `pos_sale_details` + `online_order_details` + `order_status_history`
14. `payments`
15. `cash_sessions` + `cash_movements`

**Fase 6 — MercadoPago**
16. `mp_credentials` (con cifrado) + OAuth
17. `mp_stores` + `mp_pos` + `mp_devices` (Point)
18. Webhooks de pago y de autorización

**Fase 7 — Descuentos**
19. `discounts` + `discount_products` + `discount_categories`
20. `discount_redemptions` + endpoint `/evaluate` (4 tipos triviales)

**Fase 8 — Postventa y comunicación**
21. `returns` + `credit_notes`
22. `conversations` + `messages` + `message_templates`
23. `reviews`

**Fase 9 — Transversal**
24. `audit_logs` (se puede integrar en paralelo desde Fase 5)

**Fase 10 — Modos**
25. Lógica de bifurcación por `business.mode` (FULL vs SHOWCASE)
26. Botón WhatsApp para vidriera digital

**Fase 11 — Suscripciones y plataforma**
27. `platform_admins` + `platform_admin_logs` + auth de super-admin
28. `subscriptions` + `subscription_payments`
29. Integración preapproval de MercadoPago (débito automático) + webhooks de cobro
30. Lógica de estados de suscripción (política B: gracia 3-5 días) y bloqueo de acceso al suspender
31. Panel de super-admin: ceder licencias comp, suspender negocios

**Fase 12 — Dominios**
32. `businesses.subdomain` (camino 1: subdominio, ya en Fase 1 pero el ruteo va acá)
33. `custom_domains` + integración registrar (OpenSRS/ResellerClub) para camino 3
34. Verificación DNS (modelo Shopify) + provisioning SSL vía API de Vercel

> **Nota:** el camino 2 (vincular dominio, `source = 'linked'`) NO se implementa en V1. La tabla ya lo soporta; se habilita en V2 agregando solo el flujo de UI (la infraestructura de verificación DNS + SSL ya queda construida en la Fase 12 para el camino 3).

---

## 21. Anexo: cambios de v2 y checklist para el backlog

### Qué agregó v2 respecto de la primera versión

| Cambio | Tablas/campos afectados | Fase |
|---|---|---|
| Suscripciones de negocios a Orbita | `subscriptions`, `subscription_payments` (nuevas) | 11 |
| Débito automático (preapproval MP) | integración en Fase 11 | 11 |
| Licencias cedidas (comp) por admin | `subscriptions.origin`, `granted_by` | 11 |
| Super-admin de plataforma | `platform_admins`, `platform_admin_logs` (nuevas) | 11 |
| Subdominio | `businesses.subdomain` (campo nuevo) | 1 / 12 |
| Dominios propios | `custom_domains` (nueva) | 12 |
| Transferencias POS | `payments.verified_by`, `payments.verified_at`, `business_config.transfer_alias` | 5 |

### Total de tablas del schema

49 tablas (46 de v1 + `subscriptions`, `subscription_payments`, `platform_admins`, `platform_admin_logs`, `custom_domains` = 51... ver conteo abajo).

**Conteo exacto:** 46 (v1) + 5 nuevas (`subscriptions`, `subscription_payments`, `platform_admins`, `platform_admin_logs`, `custom_domains`) = **51 tablas**.

### Checklist antes de arrancar el backlog

- [ ] Copiar todos los bloques Prisma a un `schema.prisma` y correr `npx prisma validate`.
- [ ] Confirmar que las relaciones inversas compilan (especialmente `Business`, `Member`, `PlatformAdmin`).
- [ ] Definir el período tras el cual una suscripción `SUSPENDED` pasa a `CANCELLED` (libera subdominio).
- [ ] Configurar cifrado de tokens (`mp_credentials`, y evaluar para preapproval) con pgcrypto.
- [ ] Definir plan(es) de suscripción y precio(s) — hoy `plan = "standard"` es placeholder.
- [ ] Registrar a los 3 fundadores como `platform_admins` con rol `SUPERADMIN` (seed).

---

## Anexo: decisiones pendientes de confirmación

Estos puntos están modelados en el schema pero requieren validación antes o durante la implementación (no bloquean el diseño del schema, sí la implementación de la feature específica):

1. **Sandbox de MercadoPago Point:** confirmar si el PATCH a modo PDV asocia el device a la caja automáticamente o requiere un paso manual adicional. Afecta el flujo de onboarding de Point, no el schema.
2. **Cifrado de tokens MP:** confirmar la estrategia de `pgp_sym_encrypt` con key en variable de entorno en Supabase (aplica a `mp_credentials` y a las credenciales de preapproval).
3. **Coordinación con CPO:** integrar la pregunta "vidriera vs venta online" en el onboarding.
4. **Período de cancelación:** definir tras cuántos días una suscripción `SUSPENDED` pasa a `CANCELLED` y libera el subdominio.
5. **Planes y precios:** hoy `plan = "standard"` es placeholder. Definir estructura de planes si habrá más de uno.

**Ya resueltos en v2** (antes estaban pendientes): flujo de solicitud de opiniones (email post-entrega + comentar en producto verificado), política de mora (opción B — gracia 3-5 días), débito automático (va en V1 vía preapproval MP), transferencias POS (número de operación + alias fijo del negocio + verificación humana), dominios (caminos 1 y 3 en V1, camino 2 latente).