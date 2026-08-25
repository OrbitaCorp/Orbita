# Orbita — Contrato de API (V1)

> Contrato REST del backend de Orbita (NestJS). Derivado de `ANALISIS_FRONTEND.md`
> (qué vistas existen y qué consumen/envían) y `MODELO_DATOS_DEFINITIVO.md` (51 tablas,
> arquitectura cerrada). **No es código** — es la especificación de endpoints que el backend
> debe implementar y que el frontend va a consumir cuando reemplace los mocks.
>
> **Regla de oro:** ningún endpoint existe si no hay una vista del frontend que lo consuma, y
> ningún campo de request/response existe si no está en el modelo de datos (o es un derivado
> calculado por el backend, marcado como tal).

---

## Convenciones globales

Estas reglas aplican a **todos** los endpoints salvo que se indique lo contrario.

### Prefijo y versión
Todas las rutas cuelgan de `/api/v1/`.

### Autenticación
- **Bearer token** (JWT propio, HS256, firmado por el backend) en header
  `Authorization: Bearer <token>`.
- Toda ruta requiere token **salvo** las marcadas como **Pública** (storefront público + auth).
- Cada negocio gestiona sus propias credenciales de forma **aislada**: no existe un concepto de
  usuario global. Un mismo email puede tener contraseñas distintas (o ninguna) en cada negocio —
  `passwordHash` vive en `members`/`customers`, no en una tabla de auth compartida.
- El JWT lleva el payload `{ sub: userId, type: 'member' | 'customer', businessId }`. El backend
  valida el token localmente (sin llamada de red) y resuelve el contexto directamente del
  payload — no hace falta buscar en otra tabla para saber si es member o customer.
- Los requests con header `X-Business-Slug` son validados contra el `businessId` del token: si no
  coinciden, `401`. Esto impide reusar un token emitido para el negocio A en requests dirigidos
  al negocio B.

### Multi-tenant
- `business_id` **se extrae del token** (vía el `member`/`customer` asociado). **Nunca** viaja en
  la URL ni en el body.
- **Excepción:** las rutas de super-admin (`/platform/*`) operan sobre cualquier negocio y sí
  reciben el `businessId` como parámetro.
- **Excepción:** el storefront público identifica el negocio por `slug` (subdominio) o dominio
  custom en la URL, sin token.

### Autorización (roles y permisos)
- Los roles default por negocio son **owner, admin, cajero, empleado** (`roles`, §4.2).
- Los permisos son un **catálogo global** (`permissions`, §4.3, ~19 permisos en 7 grupos:
  Pedidos, Clientes, Reportes, Inventario, POS, Descuentos, Configuración).
- Cada endpoint indica el **permiso mínimo** requerido (código `permissions.code`, ej.
  `orders.view`, `pos.edit_price`). El backend valida que el rol del miembro tenga ese permiso.

### Paginación
Listados que pueden crecer aceptan `page` y `limit` en query y devuelven:
```typescript
{
  data: T[],
  total: number,   // total de registros sin paginar
  page: number,
  limit: number
}
```
Default: `page=1`, `limit=20`. `limit` máximo recomendado: 100.

### Errores
Formato estándar de error:
```typescript
{
  error: string,        // código corto, ej. "NOT_FOUND", "VALIDATION_ERROR", "FORBIDDEN"
  statusCode: number,   // HTTP status
  message?: string      // detalle humano opcional (ej. "El cupón ya expiró")
}
```
Códigos comunes: `400` validación, `401` sin token / token inválido, `403` sin permiso o modo
incorrecto, `404` no encontrado, `409` conflicto (ej. subdominio ocupado), `422` regla de
negocio.

### Multi-branch
Donde aplica operación física (órdenes, stock, caja), se acepta `branch_id` como **query param
opcional**. Default: la sucursal del miembro logueado (en V1, siempre la sucursal `Principal`
auto-creada). Tablas con `branch_id`: `orders`, `variant_stock`, `stock_movements`,
`cash_sessions`, `cash_movements`.

### Modo del negocio (FULL vs SHOWCASE)
`businesses.mode` (§3.1) define el modo:
- **FULL:** tienda online completa (checkout, carrito, cupones, mensajes, opiniones).
- **SHOWCASE:** vidriera digital (catálogo + botón WhatsApp; sin checkout ni pedidos online).

Los endpoints marcados **Solo FULL** devuelven **`403`** con
`{ error: "SHOWCASE_MODE", message: "Esta función requiere modo tienda online (FULL)." }`
cuando el negocio está en modo SHOWCASE. Endpoints afectados: checkout/carrito, cupones
públicos, mensajería, opiniones. Ver la lista consolidada al final del documento.

### Montos y fechas
- **Montos:** number (serialización de `Decimal(12,2)`). Moneda por defecto ARS.
- **Fechas:** ISO 8601 string (`DateTime` de Prisma → `2026-07-10T18:00:00.000Z`).

### Campos calculados
Cuando un campo del frontend es un **derivado** (no está en el schema), la respuesta lo incluye
pero el contrato lo marca `// calculado`. Ejemplos: `estado` de un descuento, "stock bajo",
KPIs de reportes, totales de carrito. El backend los computa; no se persisten.

---

# Fase 1 — Fundación (tenant + auth)

## Módulo: Auth

Auth propio, aislado por negocio (no hay usuario global ni proveedor externo). Hashing con
**argon2id**, tokens con **JWT HS256** firmados con un secret propio del backend
(`JWT_SECRET`), y **refresh tokens** con rotación (hasheados con SHA-256 en `refresh_tokens`,
revocados al usarse). Hay **dos tipos de sujeto**: `member` (staff, login sin `X-Business-Slug`
resuelve contra cualquier negocio donde tenga cuenta) y `customer` (cliente de storefront,
siempre requiere `X-Business-Slug`). Un mismo email puede ser member de un negocio y customer
de otro, con contraseñas independientes — ver "Aislamiento multi-tenant" más abajo.

**Protección de fuerza bruta**: 5 intentos fallidos consecutivos bloquean la cuenta (member o
customer, por separado en cada negocio) durante 15 minutos (`423`/`403` con mensaje
"bloqueada"). Además, `POST /auth/login` tiene rate limiting por IP (20 requests/minuto).

### Registrar cliente (storefront)
- **Método**: POST
- **Ruta**: `/api/v1/auth/register`
- **Auth**: Pública
- **Headers**: `X-Business-Slug` **requerido**
- **Modo**: FULL + SHOWCASE (en SHOWCASE puede registrarse pero sin checkout)
- **Descripción**: alta de cuenta de cliente en el storefront de un negocio. **No loguea
  automáticamente** — el frontend debe llamar a `POST /auth/login` después.
- **Request body**:
```typescript
{
  firstName: string
  lastName?: string
  email: string
  phone?: string
  password: string
}
```
- **Response (201)**:
```typescript
{ message: string }   // ej. "Cuenta creada. Ya podés iniciar sesión."
```
- **Errores**: 400 (sin `X-Business-Slug`, email inválido/password débil, "Ya tenés cuenta en
  esta tienda"), 404 (slug no existe).
- **Tabla(s)**: `customers` (crea o vincula, con `passwordHash`).
- **Notas**: **vinculación POS↔storefront** — si ya existe un `customer` con ese email en el
  negocio (creado en POS, `passwordHash = null`), **no duplica**: setea `passwordHash` sobre el
  registro existente. `@@unique([businessId, email])` lo garantiza.

### Login
- **Método**: POST
- **Ruta**: `/api/v1/auth/login`
- **Auth**: Pública
- **Rate limit**: 20 req/min por IP
- **Descripción**: valida credenciales y emite JWT + refresh token.
  - **Con header `X-Business-Slug`**: busca primero como `member` de ese negocio, luego como
    `customer` de ese negocio. Si no encuentra ninguno → `403 NO_ACCOUNT_IN_BUSINESS`.
  - **Sin header** (login de panel, `orbita.com/panel`): busca como `member` en cualquier
    negocio (por email). No devuelve nunca `type: customer` en este modo.
- **Request body**:
```typescript
{ email: string, password: string }
```
- **Response (201)** — `type: 'member'`:
```typescript
{
  type: 'member',
  token: string,
  refreshToken: string,
  member: { id: string, name: string, email: string, status: string },
  role: string,
  permissions: string[],
  business: { id: string, name: string, subdomain: string, mode: string }
}
```
- **Response (201)** — `type: 'customer'`:
```typescript
{
  type: 'customer',
  token: string,
  refreshToken: string,
  customer: { id: string, firstName: string, lastName: string | null, email: string | null },
  business: { id: string, name: string, subdomain: string, mode: string }
}
```
- **Errores**: `401` credenciales inválidas (incluye email inexistente y `passwordHash = null` —
  no se distingue el motivo, para no revelar si el email existe), `403 NO_ACCOUNT_IN_BUSINESS`
  (con slug, no hay member ni customer en ese negocio), `403`/mensaje "bloqueada" (lockout por 5
  intentos fallidos).
- **Tabla(s)**: `members` / `customers`; crea fila en `refresh_tokens`.

### Refrescar token
- **Método**: POST
- **Ruta**: `/api/v1/auth/refresh`
- **Auth**: Pública (el refresh token reemplaza al access token vencido)
- **Descripción**: rota el refresh token (revoca el usado, emite uno nuevo) y devuelve un JWT
  nuevo. Vigencia del refresh token: **7 días para member, 30 días para customer**.
- **Request body**: `{ refreshToken: string }`
- **Response (201)**: `{ token: string, refreshToken: string }`
- **Errores**: 401 (refresh token inválido, revocado o expirado).
- **Tabla(s)**: `refresh_tokens` (revoca el viejo, crea uno nuevo).

### Logout
- **Método**: POST
- **Ruta**: `/api/v1/auth/logout`
- **Auth**: Pública (no requiere `Authorization` — opera sobre el refresh token del body)
- **Descripción**: revoca el refresh token recibido. Si no se manda `refreshToken`, es un no-op
  silencioso (siempre `201`).
- **Request body**: `{ refreshToken?: string }`
- **Response (201)**: sin body relevante.
- **Tabla(s)**: `refresh_tokens` (marca `revokedAt`).

### Recuperar contraseña
- **Método**: POST
- **Ruta**: `/api/v1/auth/forgot-password`
- **Auth**: Pública
- **Headers**: `X-Business-Slug` **opcional** — presente = storefront (busca member y luego
  customer de ESE negocio); ausente = panel de dueño (apex, busca member globalmente, mismo
  criterio que `login()`). Un customer nunca se busca sin slug.
- **Descripción**: genera un código numérico de 6 dígitos (hasheado en DB, `password_reset_tokens`)
  y lo envía por email. No arma ningún link — el código se tipea a mano en el frontend.
- **Request body**: `{ email: string }`
- **Response (201)**: sin body relevante — siempre `201` aunque el negocio o el email no
  existan (no revela información).
- **Tabla(s)**: `password_reset_tokens` (expira a los 15 minutos).

### Verificar código de recuperación
- **Método**: POST
- **Ruta**: `/api/v1/auth/verify-reset-code`
- **Auth**: Pública
- **Descripción**: confirma que el código es válido SIN consumirlo (`usedAt` sigue `null`) —
  permite mostrar el paso de "contraseña nueva" antes de gastar el código. Máximo 5 intentos
  incorrectos por código (`attempts` en `password_reset_tokens`); superado el límite, ni el
  código correcto es aceptado.
- **Request body**: `{ email: string, code: string }` (`code` de 6 dígitos)
- **Response (201)**: sin body relevante.
- **Errores**: 400 (código inválido, expirado, ya usado, o intentos agotados — mismo mensaje
  genérico en los 4 casos).

### Resetear contraseña
- **Método**: POST
- **Ruta**: `/api/v1/auth/reset-password`
- **Auth**: Pública (con email + código de recuperación en el body)
- **Request body**: `{ email: string, code: string, newPassword: string }`
- **Response (201)**: `{ userType: 'MEMBER' | 'CUSTOMER' | 'PLATFORM_ADMIN' }` — el frontend lo
  usa para saber si redirigir al panel de dueño o al login de la tienda.
- **Errores**: 400 (mismo criterio que `verify-reset-code`: inválido, expirado, ya usado, o
  intentos agotados).
- **Tabla(s)**: `password_reset_tokens` (marca `usedAt`), `members`/`customers` (nuevo
  `passwordHash`, resetea `failedLoginAttempts`/`lockedUntil`).

### Aceptar invitación de miembro (contraseña temporal)
- **Método**: POST
- **Ruta**: `/api/v1/auth/accept-invitation`
- **Auth**: Pública (con token de invitación)
- **Descripción**: el miembro invitado setea su contraseña definitiva (hasheada con argon2) y
  activa su cuenta.
- **Request body**: `{ token: string, password: string }`
- **Response (201)**: `{ token: string, member: { id, name, email, role } }`
- **Tabla(s)**: `members` (pasa `status` de `PENDING` a `ACTIVE`, `hasTempPassword` a `false`,
  setea `passwordHash`, quema `invitationToken`).
- **Notas**: ver el POST `/members/invite` que origina la invitación.

### Contexto del usuario logueado
- **Método**: GET
- **Ruta**: `/api/v1/auth/me`
- **Auth**: Requerida
- **Descripción**: devuelve el perfil del sujeto autenticado — member o customer, según el
  `type` del JWT. **Ruta única** (no hay `/me/customer` ni `/me/member` separadas); el
  frontend distingue por el campo `type` de la respuesta.
- **Response (200)** — member:
```typescript
{
  type: 'member',
  member: { id: string, name: string, email: string },
  role: string,
  permissions: string[],
  business: { id: string, name: string, subdomain: string, mode: string }
}
```
- **Response (200)** — customer:
```typescript
{
  type: 'customer',
  customer: { id: string, firstName: string, lastName: string | null, email: string | null },
  business: { id: string, name: string, subdomain: string, mode: string }
}
```
- **Tabla(s)**: `members` o `customers` según `type`.

### Aislamiento multi-tenant
- Las credenciales son **por negocio**: el mismo email puede tener contraseñas distintas (o
  ninguna) como member de un negocio y como customer de otro. No existe una tabla de usuarios
  global — `passwordHash`, `failedLoginAttempts` y `lockedUntil` viven directamente en
  `members`/`customers`.
- Un JWT emitido para el negocio A es **rechazado** (`401`) si se usa en un request que declara
  `X-Business-Slug` de un negocio B — el guard compara el `businessId` del payload contra el
  negocio resuelto por el slug.
- El lockout por fuerza bruta es también por negocio: 5 intentos fallidos contra la cuenta de un
  negocio no afectan la cuenta del mismo email en otro negocio.
- **Excepción explícita — `POST /onboarding/register-business`**: a diferencia de todo lo
  anterior, el **registro de un negocio nuevo** (alta de owner vía onboarding) valida el email
  de forma **global**, no por negocio: si ese email ya es member de *cualquier* negocio de la
  plataforma, el registro devuelve `409 "Este email ya tiene un negocio registrado en
  Orbita"`, aunque el schema (`@@unique([businessId, email])`) permitiría técnicamente
  credenciales independientes por negocio. Es una **decisión de producto para V1** —
  "un email = un negocio" en el flujo de autoservicio — no una limitación del modelo de datos.
  `login()` y el resto de auth siguen aislados por negocio sin excepción; esta regla aplica
  únicamente al alta de un negocio nuevo. Ver `PENDIENTES.md` → "Onboarding" para el detalle.
- **Tabla(s)**: `members`, `roles`, `role_permissions`, `permissions`, `businesses`.

---

## Módulo: Businesses

### Obtener negocio actual
- **Método**: GET
- **Ruta**: `/api/v1/business`
- **Auth**: Requerida (rol mínimo: cualquiera del panel)
- **Descripción**: datos raíz del negocio del token.
- **Response (200)**:
```typescript
{
  id: string, name: string, industry: string, description: string | null,
  subdomain: string, mode: 'FULL' | 'SHOWCASE',
  isActive: boolean, isPaused: boolean
}
```
- **Tabla(s)**: `businesses`.

### Actualizar negocio
- **Método**: PUT
- **Ruta**: `/api/v1/business`
- **Auth**: Requerida (permiso `config.edit`, rol owner/admin)
- **Descripción**: edita nombre, rubro y descripción.
- **Request body**:
```typescript
{ name?: string, industry?: string, description?: string }
```
- **Response (200)**: el `business` actualizado.
- **Tabla(s)**: `businesses`.
- **Notas**: el campo `mode` se gestiona en un endpoint separado (pendiente de implementar,
  ver PENDIENTES.md) con validaciones propias — no se edita junto con los demás campos del
  negocio. Cambiar `mode` a SHOWCASE oculta checkout/mensajes/opiniones en el storefront (la
  bifurcación la aplican los endpoints "Solo FULL").

### Config operativa (contacto, pagos, envíos, redes)
- **Método**: GET / PUT
- **Ruta**: `/api/v1/business/config`
- **Auth**: Requerida (GET: panel; PUT: `config.edit`)
- **Descripción**: lee/edita `business_config` (ConfigGeneral).
- **Request body (PUT)**:
```typescript
{
  whatsapp?: string, email?: string, scheduleText?: string,
  acceptsMercadopago?: boolean, acceptsCash?: boolean, acceptsTransfer?: boolean, acceptsPickup?: boolean,
  transferAlias?: string,
  shippingBase?: number, freeShippingFrom?: number, deliveryZones?: string[], shippingPolicy?: string,
  instagram?: string, tiktok?: string, facebook?: string
}
```
- **Response (200)**: el `business_config` completo.
- **Tabla(s)**: `business_config`.

### Apariencia del storefront
- **Método**: GET / PUT
- **Ruta**: `/api/v1/business/storefront-config`
- **Auth**: Requerida (GET: panel; PUT: `config.edit`)
- **Descripción**: lee/edita `storefront_config` (Apariencia: branding, tema, layout, toggles).
- **Request body (PUT)**:
```typescript
{
  storeName?: string, tagline?: string, logoUrl?: string, faviconUrl?: string,
  colorPrimary?: string, colorSecondary?: string, colorAccent?: string, colorBackground?: string,
  colorMode?: 'light' | 'dark', fontFamily?: string, fontScale?: number,
  headerLayout?: string, gridLayout?: string, cardRadius?: number,
  heroSlides?: { id: string, titulo: string, subtitulo: string, img: string | null, cta: string }[],  // JSON
  headerLinks?: { id: string, label: string, on: boolean }[],  // JSON
  showReviews?: boolean, showNewBadge?: boolean, showWhatsapp?: boolean
}
```
- **Response (200)**: el `storefront_config` completo.
- **Tabla(s)**: `storefront_config`.
- **Notas**: `logoUrl`/`faviconUrl`/`heroSlides[].img` son URLs de Supabase Storage (subir vía
  el módulo de imágenes o un endpoint de upload genérico). `showReviews` (renombrado desde
  `showRating`) controla si el storefront muestra la **sección de opiniones de texto** — ya no hay
  puntuación numérica. El backend expone el campo del schema como `showReviews`; si el schema aún
  lo tiene mapeado como `show_rating`, se lee/escribe con alias.

### Notificaciones
- **Método**: GET / PUT
- **Ruta**: `/api/v1/business/notification-config`
- **Auth**: Requerida (GET: panel; PUT: `config.edit`)
- **Descripción**: matriz evento×canal (Notificaciones).
- **Request body (PUT)**:
```typescript
{ matrix: Record<string, { panel: boolean, email: boolean, whatsapp: boolean }> }
```
- **Response (200)**: `{ matrix: {...} }`
- **Tabla(s)**: `notification_config` (campo `matrix` JSON).

### Publicar tienda
- **Método**: POST
- **Ruta**: `/api/v1/business/publish`
- **Auth**: Requerida (rol owner/admin)
- **Descripción**: publica la tienda (acción del Dashboard "Publicar tienda"). Setea `isActive`.
- **Response (200)**: `{ url: string, published: boolean }`  // url = subdominio público
- **Tabla(s)**: `businesses` (`isActive`).

### Pausar tienda (zona peligrosa)
- **Método**: POST
- **Ruta**: `/api/v1/business/pause`
- **Auth**: Requerida (rol owner)
- **Descripción**: pausa temporal de la tienda (`isPaused = true`).
- **Request body**: `{ paused: boolean }`
- **Response (200)**: `{ isPaused: boolean }`
- **Tabla(s)**: `businesses` (`isPaused`).

### Eliminar negocio (zona peligrosa)
- **Método**: DELETE
- **Ruta**: `/api/v1/business`
- **Auth**: Requerida (rol owner)
- **Descripción**: baja del espacio del negocio.
- **Response (200)**: `{ ok: true }`
- **Tabla(s)**: `businesses` (+ cascada según política; libera `subdomain`).
- **Notas**: operación destructiva; el frontend exige confirmación. Interactúa con
  `subscriptions` (cancelación).

---

## Módulo: Branches

> En V1 solo hay una sucursal `Principal` auto-creada. Los endpoints quedan preparados para
> multi-sucursal futuro sin migración.

### Listar sucursales
- **Método**: GET
- **Ruta**: `/api/v1/branches`
- **Auth**: Requerida (panel)
- **Response (200)**: `Branch[]` → `{ id, name, address, isDefault, isActive }[]`
- **Tabla(s)**: `branches`.

### Obtener sucursal
- **Método**: GET
- **Ruta**: `/api/v1/branches/:id`
- **Auth**: Requerida (panel)
- **Response (200)**: `Branch`
- **Tabla(s)**: `branches`.

### Crear / actualizar sucursal
- **Método**: POST `/api/v1/branches` · PUT `/api/v1/branches/:id`
- **Auth**: Requerida (rol owner únicamente)
- **Descripción**: preparados para V2 (en V1 la UI de gestión de sucursales no existe).
- **Request body**: `{ name: string, address?: string, isActive?: boolean }`
- **Response (200/201)**: `Branch`
- **Tabla(s)**: `branches`.
- **Notas**: crear/editar/eliminar una sucursal es una operación estructural que afecta
  stock, caja y reportes de todo el negocio — más cerca de "zona peligrosa" que de gestión
  operativa, por eso el rol mínimo es owner (no admin).

### Eliminar sucursal
- **Método**: DELETE
- **Ruta**: `/api/v1/branches/:id`
- **Auth**: Requerida (rol owner únicamente)
- **Descripción**: elimina una sucursal no-default sin registros asociados.
- **Response (200)**: `{ ok: true }`
- **Errores**: 422 (es la sucursal default/`Principal`), 422 (tiene registros asociados:
  stock, órdenes, caja).
- **Tabla(s)**: `branches`.

---

## Módulo: Members

### Listar miembros
- **Método**: GET
- **Ruta**: `/api/v1/members`
- **Auth**: Requerida (permiso `config.team.view`)
- **Response (200)**:
```typescript
{
  id: string, name: string, email: string,
  role: { id: string, name: string },
  status: 'ACTIVE' | 'PENDING', hasTempPassword: boolean, lastAccessAt: string | null
}[]
```
- **Tabla(s)**: `members`, `roles`.

### Invitar miembro
- **Método**: POST
- **Ruta**: `/api/v1/members/invite`
- **Auth**: Requerida (permiso `config.team.manage`, rol owner/admin)
- **Descripción**: crea el miembro en estado `PENDING` con contraseña temporal y dispara el email
  de invitación.
- **Request body**: `{ name: string, email: string, roleId: string }`
- **Response (201)**:
```typescript
{ id: string, name: string, email: string, status: 'PENDING', hasTempPassword: true }
```
- **Errores**: 400, 409 (email ya es miembro del negocio).
- **Tabla(s)**: `members` (`status = PENDING`, `has_temp_password = true`).
- **Notas**: la aceptación va por `POST /auth/accept-invitation`.

### Editar miembro
- **Método**: PUT
- **Ruta**: `/api/v1/members/:id`
- **Auth**: Requerida (permiso `config.team.manage`)
- **Request body**: `{ name?: string, roleId?: string }`
- **Response (200)**: el `member` actualizado.
- **Tabla(s)**: `members`.

### Eliminar miembro
- **Método**: DELETE
- **Ruta**: `/api/v1/members/:id`
- **Auth**: Requerida (permiso `config.team.manage`, rol owner)
- **Response (200)**: `{ ok: true }`
- **Errores**: 422 (no se puede eliminar al owner).
- **Tabla(s)**: `members`.

---

## Módulo: Roles + Permissions

### Listar roles
- **Método**: GET
- **Ruta**: `/api/v1/roles`
- **Auth**: Requerida (permiso `config.team.view`)
- **Response (200)**:
```typescript
{
  id: string, name: string, description: string | null, color: string | null,
  isDefault: boolean,
  permissions: string[],   // codes asignados
  memberCount: number      // calculado
}[]
```
- **Tabla(s)**: `roles`, `role_permissions`, `members` (para el count).

### Crear / editar / eliminar rol
- **Método**: POST `/api/v1/roles` · PUT `/api/v1/roles/:id` · DELETE `/api/v1/roles/:id`
- **Auth**: Requerida (permiso `config.team.manage`, rol owner/admin)
- **Request body (POST/PUT)**:
```typescript
{ name: string, description?: string, color?: string, permissions: string[] }  // permission codes
```
- **Response (200/201)**: el `role` con sus permisos.
- **Errores**: 422 (no se puede editar/eliminar un rol `isDefault`).
- **Tabla(s)**: `roles`, `role_permissions`.

### Catálogo de permisos
- **Método**: GET
- **Ruta**: `/api/v1/permissions`
- **Auth**: Requerida (panel)
- **Descripción**: catálogo **global** de permisos (mismo para todos los negocios).
- **Response (200)**:
```typescript
{ id: string, group: string, code: string, label: string, description: string | null }[]
```
- **Tabla(s)**: `permissions`.

---

# Fase 2 — Catálogo

## Módulo: Categories

### Listar categorías (árbol)
- **Método**: GET
- **Ruta**: `/api/v1/categories`
- **Auth**: Requerida (panel)
- **Descripción**: devuelve el árbol de categorías (jerarquía vía `parentId`).
- **Query params**: `{ flat?: boolean }`  // flat=true devuelve lista plana; default árbol anidado
- **Response (200)**:
```typescript
{
  id: string, name: string, slug: string, icon: string | null, color: string | null,
  parentId: string | null, isActive: boolean, position: number,
  productCount: number,      // calculado
  children?: Category[]      // si árbol
}[]
```
- **Tabla(s)**: `categories`, `products` (para el count).

### Crear / editar / eliminar categoría
- **Método**: POST `/api/v1/categories` · PUT `/api/v1/categories/:id` · DELETE `/api/v1/categories/:id`
- **Auth**: Requerida (permiso `catalog.manage`)
- **Request body (POST/PUT)**:
```typescript
{ name: string, slug?: string, icon?: string, color?: string, parentId?: string | null, isActive?: boolean }
```
- **Response (200/201)**: la `category`.
- **Errores**: 400 (slug duplicado en el negocio — `@@unique([businessId, slug])`), 422 (eliminar
  con productos o subcategorías asociadas).
- **Tabla(s)**: `categories`.

### Reordenar categorías
- **Método**: PATCH
- **Ruta**: `/api/v1/categories/reorder`
- **Auth**: Requerida (permiso `catalog.manage`)
- **Request body**: `{ items: { id: string, position: number, parentId: string | null }[] }`
- **Response (200)**: `{ ok: true }`
- **Tabla(s)**: `categories` (`position`, `parentId`).

---

## Módulo: Tags

### CRUD de tags
- **Método**: GET `/api/v1/tags` · POST `/api/v1/tags` · PUT `/api/v1/tags/:id` · DELETE `/api/v1/tags/:id`
- **Auth**: Requerida (GET: panel; escritura: `catalog.manage`)
- **Request body (POST/PUT)**: `{ name: string }`
- **Response (200)**: `{ id: string, name: string }` (o `Tag[]` en GET)
- **Errores**: 400 (nombre duplicado — `@@unique([businessId, name])`).
- **Tabla(s)**: `tags`.

---

## Módulo: Products

### Listar productos
- **Método**: GET
- **Ruta**: `/api/v1/products`
- **Auth**: Requerida (permiso `catalog.view`)
- **Descripción**: listado paginado del catálogo (ProductoLista).
- **Query params**: `{ search?: string, categoryId?: string, status?: 'PUBLISHED'|'DRAFT'|'OUT_OF_STOCK', page?: number, limit?: number }`
- **Response (200)**: `Paginated<Product>` donde cada `Product`:
```typescript
{
  id: string, name: string, description: string | null,
  categoryId: string | null, categoryName: string | null,  // categoryName calculado (join)
  basePrice: number, comparePrice: number | null, cost: number | null,
  status: 'PUBLISHED' | 'DRAFT' | 'OUT_OF_STOCK',
  totalStock: number,     // calculado (suma de variant_stock de la sucursal)
  variantCount: number,   // calculado
  primaryImageUrl: string | null,   // calculado (product_images.isPrimary)
  createdAt: string
}
```
- **Tabla(s)**: `products`, `product_variants`, `variant_stock`, `product_images`, `categories`.

### Obtener producto (con variantes)
- **Método**: GET
- **Ruta**: `/api/v1/products/:id`
- **Auth**: Requerida (permiso `catalog.view`)
- **Response (200)**:
```typescript
{
  id: string, name: string, description: string | null, categoryId: string | null,
  basePrice: number, comparePrice: number | null, cost: number | null, status: string,
  tags: { id: string, name: string }[],
  options: { id: string, name: string, position: number, values: { id: string, value: string, position: number }[] }[],
  variants: {
    id: string, sku: string | null, barcode: string | null, price: number,
    comparePrice: number | null, isDefault: boolean,
    optionValues: { optionValueId: string, value: string }[],
    stock: { branchId: string, quantity: number, stockMin: number }[]
  }[],
  images: { id: string, url: string, position: number, isPrimary: boolean, optionValueId: string | null }[]
}
```
- **Tabla(s)**: `products`, `product_tags`, `product_options`, `product_option_values`,
  `product_variants`, `variant_option_values`, `variant_stock`, `product_images`.

### Crear producto (transacción completa)
- **Método**: POST
- **Ruta**: `/api/v1/products`
- **Auth**: Requerida (permiso `catalog.manage`)
- **Descripción**: crea el producto y toda su estructura de variantes en **una transacción**
  (ProductoNuevo, wizard de 4 pasos).
- **Request body**:
```typescript
{
  name: string, description?: string, categoryId: string,  // obligatoria (RBT-...): sin categoría el producto no queda agrupado en ningún lado del catálogo del cliente
  basePrice: number, comparePrice?: number, cost?: number,
  status?: 'PUBLISHED' | 'DRAFT',
  tagIds?: string[],
  options?: { name: string, values: string[] }[],   // ej. { name:"Talle", values:["S","M","L"] }
  variants: {                                        // combinaciones (producto cartesiano resuelto en el front)
    sku?: string, barcode?: string, price: number, comparePrice?: number,
    optionValues: string[],       // valores que definen esta variante, ej. ["M","Negro"]
    initialStock?: number, stockMin?: number
  }[]
}
```
- **Response (201)**: el producto completo (igual que GET `/products/:id`).
- **Errores**: 400 (validación), 422 (categoría inexistente).
- **Tabla(s)**: `products`, `product_options`, `product_option_values`, `product_variants`,
  `variant_option_values`, `variant_stock`, `product_tags` — **todo en transacción**.
- **Notas**: **todo producto tiene al menos una variante**. Si `variants` viene vacío o el
  producto es "sin variación", el backend crea una variante `isDefault` que hereda `basePrice` y
  el stock inicial. El stock inicial se escribe en `variant_stock` para la sucursal default.

### Actualizar / eliminar producto
- **Método**: PUT `/api/v1/products/:id` · DELETE `/api/v1/products/:id`
- **Auth**: Requerida (permiso `catalog.manage`)
- **Request body (PUT)**: igual que POST (reconciliando variantes existentes por `id`).
- **Response (200)**: el producto actualizado.
- **Tabla(s)**: idem crear. DELETE es **soft-delete** (`products.deletedAt`).

### Códigos de barras
- **Método**: GET
- **Ruta**: `/api/v1/products/barcodes`
- **Auth**: Requerida (permiso `catalog.view`)
- **Descripción**: datos para imprimir etiquetas por SKU/código de barras (CodigosBarras).
- **Query params**: `{ variantIds?: string[], categoryId?: string }`
- **Response (200)**:
```typescript
{ variantId: string, sku: string | null, barcode: string | null, productName: string, variantLabel: string | null, price: number }[]
```
- **Tabla(s)**: `product_variants`, `products`.

---

## Módulo: Product Images

### Subir imagen
- **Método**: POST
- **Ruta**: `/api/v1/products/:id/images`
- **Auth**: Requerida (permiso `catalog.manage`)
- **Descripción**: sube una imagen a Supabase Storage y la registra. Asociación opcional a un
  valor de opción (para fotos por color).
- **Request body**: `multipart/form-data` con `file` + `{ optionValueId?: string, isPrimary?: boolean }`
- **Response (201)**:
```typescript
{ id: string, url: string, position: number, isPrimary: boolean, optionValueId: string | null }
```
- **Tabla(s)**: `product_images` (`url` = URL pública de Supabase Storage).

### Eliminar / reordenar / marcar principal
- **Método**: DELETE `/api/v1/products/:id/images/:imageId` · PATCH `/api/v1/products/:id/images/reorder`
- **Auth**: Requerida (permiso `catalog.manage`)
- **Request body (reorder)**: `{ items: { id: string, position: number }[], primaryId?: string }`
- **Response (200)**: `{ ok: true }`
- **Tabla(s)**: `product_images` (`position`, `isPrimary`).

---

# Fase 3 — Inventario

## Módulo: Inventory

### Stock general (por sucursal)
- **Método**: GET
- **Ruta**: `/api/v1/inventory/stock`
- **Auth**: Requerida (permiso `inventory.view`)
- **Descripción**: listado de stock por variante para una sucursal (StockGeneral).
- **Query params**: `{ branch_id?: string, search?: string, lowStock?: boolean, page?: number, limit?: number }`
- **Response (200)**: `Paginated<StockRow>`:
```typescript
{
  variantId: string, productId: string, productName: string, variantLabel: string | null,
  sku: string | null, quantity: number, stockMin: number,
  isLowStock: boolean,   // calculado: quantity <= stockMin
  price: number
}
```
- **Tabla(s)**: `variant_stock`, `product_variants`, `products`.

### Entrada de stock
- **Método**: POST
- **Ruta**: `/api/v1/inventory/entry`
- **Auth**: Requerida (permiso `inventory.manage`)
- **Descripción**: registra ingreso de mercadería (EntradaStock).
- **Request body**:
```typescript
{ variantId: string, branch_id?: string, quantity: number, supplierId?: string, reason?: string }
```
- **Response (201)**: el `StockMovement` creado + el nuevo `quantity`.
- **Tabla(s)**: `stock_movements` (`type = ENTRADA`), `variant_stock` (incrementa `quantity`).
- **Notas**: crea el movimiento **y** actualiza `variant_stock` en una transacción.

### Ajuste de stock
- **Método**: POST
- **Ruta**: `/api/v1/inventory/adjustment`
- **Auth**: Requerida (permiso `inventory.manage`)
- **Descripción**: ajuste manual +/- (AjusteStock).
- **Request body**: `{ variantId: string, branch_id?: string, quantity: number, reason: string }`  // quantity puede ser negativo
- **Response (201)**: el `StockMovement` + nuevo `quantity`.
- **Tabla(s)**: `stock_movements` (`type = AJUSTE`), `variant_stock`.

### Historial de movimientos
- **Método**: GET
- **Ruta**: `/api/v1/inventory/movements`
- **Auth**: Requerida (permiso `inventory.view`)
- **Query params**: `{ variantId?: string, type?: 'ENTRADA'|'SALIDA'|'AJUSTE', branch_id?: string, from?: string, to?: string, page?, limit? }`
- **Response (200)**: `Paginated<StockMovement>`:
```typescript
{
  id: string, variantId: string, productName: string,   // productName calculado (snapshot vía join)
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE', quantity: number, reason: string,
  supplierId: string | null, orderId: string | null,
  createdBy: string | null, createdByName: string | null,  // calculado (join members)
  createdAt: string
}
```
- **Tabla(s)**: `stock_movements`, `product_variants`, `members`.
- **Notas**: las **salidas por venta** las genera automáticamente el backend al cobrar (ver
  módulo Orders), con `orderId` seteado y `reason = "Venta #<orderNumber>"`.

---

## Módulo: Suppliers

### CRUD de proveedores
- **Método**: GET `/api/v1/suppliers` · POST · PUT `/api/v1/suppliers/:id` · DELETE `/api/v1/suppliers/:id`
- **Auth**: Requerida (GET: `inventory.view`; escritura: `inventory.manage`)
- **Request body (POST/PUT)**: `{ name: string, contact?: string, phone?: string, email?: string }`
- **Response (200)**:
```typescript
{
  id: string, name: string, contact: string | null, phone: string | null, email: string | null,
  lastPurchase: string | null,   // calculado (max stock_movements.createdAt)
  totalPurchased: number         // calculado (suma de entradas)
}
```
- **Tabla(s)**: `suppliers`, `stock_movements` (para los calculados).

---

# Fase 4 — Clientes

## Módulo: Customers

### Listar clientes
- **Método**: GET
- **Ruta**: `/api/v1/customers`
- **Auth**: Requerida (permiso `customers.view`)
- **Query params**: `{ search?: string, page?: number, limit?: number }`
- **Response (200)**: `Paginated<Customer>`:
```typescript
{
  id: string, firstName: string, lastName: string | null, email: string | null,
  phone: string | null, dni: string | null, hasAccount: boolean,  // hasAccount = passwordHash != null
  orderCount: number,      // calculado
  totalSpent: number,      // calculado
  avgTicket: number,       // calculado
  lastOrderAt: string | null,  // calculado
  createdAt: string
}
```
- **Tabla(s)**: `customers`, `orders` (para los calculados).
- **Notas**: `segment` y `tags` **no existen en V1** (diferidos); no filtrar ni devolver por segmento.

### Obtener cliente (con pedidos)
- **Método**: GET
- **Ruta**: `/api/v1/customers/:id`
- **Auth**: Requerida (permiso `customers.view`)
- **Descripción**: detalle + pedidos del cliente (ClienteDetalle).
- **Response (200)**: `Customer` (con calculados) + `orders: OrderSummary[]` + `addresses: Address[]`
  + `emails: { id, subject, template, status, createdAt }[]` (últimos 20 de `email_logs`).
  *Corrección Fase 3*: la pestaña Actividad del perfil consume los envíos registrados por
  `MailService`, así que el detalle los devuelve.
- **Tabla(s)**: `customers`, `orders`, `addresses`, `email_logs`.
- **Notas**: la tab "notas" del frontend (`ClienteNota`) **queda fuera de V1**: no hay tabla ni
  endpoint de notas. La respuesta no incluye notas.

### Crear / actualizar cliente
- **Método**: POST `/api/v1/customers` · PUT `/api/v1/customers/:id`
- **Auth**: Requerida (permiso `customers.manage`)
- **Request body**: `{ firstName: string, lastName?: string, email?: string, phone?: string, dni?: string }`
- **Response (200/201)**: el `customer`.
- **Tabla(s)**: `customers`.
- **Notas**: **vinculación POS↔storefront** — si se crea con un `email` que ya existe en el
  negocio, **no duplica**: devuelve/actualiza el cliente existente (`@@unique([businessId, email])`).
  Los clientes POS se crean con `passwordHash = null`.

### Email a clientes (individual/masivo)
- **Método**: POST
- **Ruta**: `/api/v1/customers/email`
- **Auth**: Requerida (permiso `customers.manage`)
- **Descripción**: envío de email individual (ModalEmail) o masivo (EmailMasivoModal).
- **Request body**: `{ customerIds: string[], subject: string, body: string }`
- **Response (200)**: `{ sent: number }`
- **Tabla(s)**: `email_logs` (cada envío queda registrado con destinatario, asunto, plantilla y
  resultado `SENT | FAILED | SIMULATED`). *Corrección Fase 3*: la versión anterior de este
  contrato decía que V1 no persistía envíos y delegaba la trazabilidad en el proveedor (Resend);
  la tarjeta "Email: servicio central con plantillas" pide registrar cada envío y la pestaña
  Actividad del perfil de cliente lo consume, así que el registro pasó a ser propio. El log lo
  escribe `MailService` de forma transversal — aplica a TODOS los emails del sistema, no solo a
  este endpoint.

---

## Módulo: Addresses

> Anidadas bajo el cliente. En el storefront, el cliente gestiona **sus propias** direcciones
> vía `/me/addresses`; en el panel se leen dentro del detalle del cliente.

### CRUD de direcciones (storefront, cuenta propia)
- **Método**: GET `/api/v1/me/addresses` · POST · PUT `/api/v1/me/addresses/:id` · DELETE `/api/v1/me/addresses/:id`
- **Auth**: Requerida (contexto customer)
- **Modo**: FULL + SHOWCASE
- **Request body (POST/PUT)**:
```typescript
{ alias?: string, street: string, floor?: string, city: string, zip?: string, isDefault?: boolean }
```
- **Response (200)**: `Address` → `{ id, alias, street, floor, city, zip, isDefault }`
- **Tabla(s)**: `addresses` (scoped al `customer` del token).

---

# Fase 5 — Órdenes y pagos

## Módulo: Orders

### Listar órdenes
- **Método**: GET
- **Ruta**: `/api/v1/orders`
- **Auth**: Requerida (permiso `orders.view`)
- **Descripción**: tabla de pedidos con filtros/tabs (PedidoLista, PedidoHistorial); también la
  cola de preparación filtra por estado.
- **Query params**: `{ status?: OrderStatus, channel?: 'POS'|'ONLINE', search?: string, branch_id?: string, from?: string, to?: string, page?, limit? }`
- **Response (200)**: `Paginated<OrderSummary>`:
```typescript
{
  id: string, orderNumber: number, channel: 'POS' | 'ONLINE', status: OrderStatus,
  customerId: string | null, customerName: string | null,  // snapshot/join
  total: number, itemCount: number,  // itemCount calculado
  createdAt: string
}
```
- **Tabla(s)**: `orders`, `order_items`, `customers`.

### Obtener orden
- **Método**: GET
- **Ruta**: `/api/v1/orders/:id`
- **Auth**: Requerida (permiso `orders.view`)
- **Response (200)**:
```typescript
{
  id: string, orderNumber: number, fiscalNumber: string | null,
  channel: 'POS' | 'ONLINE', status: OrderStatus,
  customerId: string | null, subtotal: number, discountTotal: number, total: number, notes: string | null,
  items: {
    id: string, variantId: string, productName: string, variantLabel: string | null,
    quantity: number, unitPrice: number, editedPrice: number | null,
    discountAmount: number, isConcept: boolean, notes: string | null
  }[],
  payments: Payment[],
  posSaleDetails?: { cashSessionId: string, changeAmount: number | null },
  onlineOrderDetails?: {
    shippingAddressId: string | null, buyerName: string, buyerEmail: string,
    buyerPhone: string | null, tracking: string | null, shippingCost: number | null
  },
  statusHistory: { status: OrderStatus, createdAt: string }[]
}
```
- **Tabla(s)**: `orders`, `order_items`, `payments`, `pos_sale_details`, `online_order_details`,
  `order_status_history`.

### Crear orden (POS u online)
- **Método**: POST
- **Ruta**: `/api/v1/orders`
- **Auth**: Requerida (POS: permiso `pos.sell`) · Pública vía checkout para online (ver Nota)
- **Descripción**: crea una orden. El `channel` en el body decide el flujo y qué satélite se crea.
- **Request body**:
```typescript
{
  channel: 'POS' | 'ONLINE',
  branch_id?: string,
  customerId?: string,        // null = venta anónima (POS)
  items: {
    variantId: string, quantity: number,
    editedPrice?: number,     // solo con permiso pos.edit_price
    isConcept?: boolean, notes?: string
  }[],
  discountCode?: string,      // cupón aplicado (se re-evalúa server-side)
  notes?: string,
  // Solo POS:
  cashSessionId?: string,
  payments?: { method: PaymentMethod, amount: number, reference?: string }[],  // pago mixto
  // Solo ONLINE:
  shippingAddressId?: string,
  buyer?: { name: string, email: string, phone?: string },
  shippingCost?: number
}
```
- **Response (201)**: la orden completa (igual que GET `/orders/:id`).
- **Errores**: 400 (validación), 403 (`editedPrice` sin permiso `pos.edit_price`), 422 (stock
  insuficiente en variante no-concepto).
- **Tabla(s)**:
  - **POS**: `orders` (status `COMPLETED`), `order_items`, `pos_sale_details`, `payments`,
    `stock_movements` (SALIDA por cada ítem no-`isConcept`), `discount_redemptions` (si hubo
    descuento). **Todo en transacción.**
  - **ONLINE**: `orders` (status `PENDING`), `order_items`, `online_order_details`, `payments`
    (PENDING). El stock se descuenta al confirmar el pago (webhook).
- **Notas**: `editedPrice` requiere `pos.edit_price` y queda auditado (`audit_logs`). El descuento
  se re-evalúa en backend vía la lógica de `/discounts/evaluate` (no se confía en el total del
  cliente). La creación online normalmente entra por el módulo **Storefront público** (checkout).

### Cambiar estado de la orden
- **Método**: PATCH
- **Ruta**: `/api/v1/orders/:id/status`
- **Auth**: Requerida (permiso `orders.manage`)
- **Descripción**: transición de estado (PedidoDetalle, ColaPreparacion). Valida transiciones
  según canal.
- **Request body**: `{ status: OrderStatus }`
- **Response (200)**: la orden actualizada.
- **Errores**: 422 (transición inválida — ej. una orden POS `COMPLETED` no transiciona; una
  online sigue `PENDING→CONFIRMED→PREPARING→SHIPPED→DELIVERED`).
- **Tabla(s)**: `orders` (`status`), `order_status_history` (inserta fila).
- **Notas**: la **cola de preparación** (tablero de 3 columnas) mapea 1:1 a `OrderStatus`, sin
  sub-estados ni tabla extra:
  - **"preparar"** = `PREPARING`
  - **"listo"** = `SHIPPED` (listo para despachar/retirar)
  - **"despachado"** = `DELIVERED`

  Mover una tarjeta en el kanban es un `PATCH /orders/:id/status` con el estado correspondiente.

### Enviar comprobante
- **Método**: POST
- **Ruta**: `/api/v1/orders/:id/receipt`
- **Auth**: Requerida (permiso `orders.view`)
- **Descripción**: genera/envía el comprobante (ModalComprobante, ModalEmail).
- **Request body**: `{ email?: string }`  // si se envía, manda por email; si no, devuelve URL
- **Response (200)**: `{ url: string, sent: boolean }`
- **Tabla(s)**: `orders` (solo lectura; genera PDF/URL).

---

## Módulo: Payments

> El **POST** de pagos no es un endpoint público: los pagos se crean **dentro** de la creación de
> la orden (POS) o los confirma el **webhook de MP** (online). Acá van la lectura y la
> verificación manual de transferencias.

### Pagos de una orden
- **Método**: GET
- **Ruta**: `/api/v1/orders/:orderId/payments`
- **Auth**: Requerida (permiso `orders.view`)
- **Response (200)**: `Payment[]`:
```typescript
{
  id: string, method: PaymentMethod, status: PaymentStatus, amount: number, currency: string,
  reference: string | null, channel: 'POS' | 'ONLINE', paidAt: string | null,
  mpPaymentId: string | null, verifiedBy: string | null, verifiedAt: string | null
}
```
- **Tabla(s)**: `payments`.

### Verificar transferencia manualmente
- **Método**: PATCH
- **Ruta**: `/api/v1/payments/:id/verify`
- **Auth**: Requerida (permiso `pos.sell` o `orders.manage`)
- **Descripción**: el cajero confirma que recibió una transferencia (POS transferencia — **no hay
  webhook**, la confirmación es humana).
- **Request body**: `{ reference?: string }`  // nro de operación anotado por el cajero
- **Response (200)**: el `payment` con `status = APPROVED`, `verifiedBy` = el miembro, `verifiedAt` = ahora.
- **Errores**: 422 (el pago no es transferencia / ya está aprobado).
- **Tabla(s)**: `payments` (`status`, `verifiedBy`, `verifiedAt`, `paidAt`).

---

## Módulo: Cash Sessions

### Abrir caja
- **Método**: POST
- **Ruta**: `/api/v1/cash-sessions`
- **Auth**: Requerida (permiso `pos.cash`)
- **Descripción**: abre una sesión de caja (POSApertura). Soporta múltiples cajas simultáneas por
  sucursal.
- **Request body**: `{ branch_id?: string, initialAmount: number, notes?: string }`
- **Response (201)**:
```typescript
{ id: string, branchId: string, cashierId: string, openedAt: string, initialAmount: number, status: 'OPEN' }
```
- **Tabla(s)**: `cash_sessions` (`cashierId` = el miembro del token).

### Sesión abierta actual
- **Método**: GET
- **Ruta**: `/api/v1/cash-sessions/current`
- **Auth**: Requerida (permiso `pos.cash`)
- **Descripción**: la sesión `OPEN` del cajero logueado (para saber si ya tiene caja abierta).
- **Response (200)**: `CashSession | null`
- **Tabla(s)**: `cash_sessions`.

### Cerrar caja
- **Método**: POST
- **Ruta**: `/api/v1/cash-sessions/:id/close`
- **Auth**: Requerida (permiso `pos.cash`)
- **Descripción**: cierra con conteo real y calcula diferencia (POSCierre).
- **Request body**: `{ countedAmount: number }`
- **Response (200)**:
```typescript
{
  id: string, closedAt: string, status: 'CLOSED',
  initialAmount: number, countedAmount: number,
  theoreticalAmount: number,  // calculado: initial + ventas efectivo + ingresos - egresos
  difference: number          // calculado: counted - theoretical
}
```
- **Tabla(s)**: `cash_sessions` (`closedAt`, `countedAmount`, `difference`, `status`), lee
  `payments` (efectivo) y `cash_movements`.

### Forzar cierre
- **Método**: POST
- **Ruta**: `/api/v1/cash-sessions/:id/force-close`
- **Auth**: Requerida (permiso `pos.cash.manage`, rol owner/admin)
- **Descripción**: cierre forzado de una sesión ajena (Historial).
- **Response (200)**: la sesión con `status = FORCED`.
- **Tabla(s)**: `cash_sessions`.

### Historial de sesiones
- **Método**: GET
- **Ruta**: `/api/v1/cash-sessions`
- **Auth**: Requerida (permiso `pos.cash`)
- **Query params**: `{ branch_id?: string, status?: 'OPEN'|'CLOSED'|'FORCED', from?: string, to?: string, page?, limit? }`
- **Response (200)**: `Paginated<CashSession>` (con `cashierName` calculado y desglose de totales).
- **Tabla(s)**: `cash_sessions`, `members`, `payments`, `cash_movements`.

### Resumen de turno
- **Método**: GET
- **Ruta**: `/api/v1/cash-sessions/:id/summary`
- **Auth**: Requerida (permiso `pos.cash`)
- **Descripción**: resumen del turno (POSReporte): ventas por método, ingresos/egresos, totales.
- **Response (200)**:
```typescript
{
  session: CashSession,
  salesByMethod: { method: PaymentMethod, count: number, total: number }[],  // calculado
  cashMovements: { ingresos: number, egresos: number },                       // calculado
  theoreticalAmount: number, difference: number | null
}
```
- **Tabla(s)**: `cash_sessions`, `payments`, `cash_movements`, `orders`.

---

## Módulo: Cash Movements

### Registrar ingreso/egreso
- **Método**: POST
- **Ruta**: `/api/v1/cash-sessions/:id/movements`
- **Auth**: Requerida (permiso `pos.cash`)
- **Descripción**: movimiento de efectivo que no es venta (ModalEgresoIngreso).
- **Request body**: `{ type: 'INGRESO' | 'EGRESO', amount: number, reason: string }`
- **Response (201)**: `{ id, type, amount, reason, createdBy, createdAt }`
- **Errores**: 422 (la sesión no está `OPEN`).
- **Tabla(s)**: `cash_movements` (`createdBy` = el miembro del token).

---

# Fase 6 — MercadoPago

## Módulo: MercadoPago

> Integración vía Orders API (unifica checkout online y Point). OAuth por negocio. Los tokens se
> guardan **cifrados** (`pgp_sym_encrypt`). Jerarquía Point: store → pos → device.

### Conectar cuenta (OAuth — iniciar)
- **Método**: GET
- **Ruta**: `/api/v1/mercadopago/oauth/connect`
- **Auth**: Requerida (rol owner/admin)
- **Descripción**: devuelve la URL de autorización de MP para iniciar el OAuth.
- **Response (200)**: `{ authUrl: string }`
- **Tabla(s)**: ninguna (redirige a MP).

### Callback OAuth
- **Método**: GET
- **Ruta**: `/api/v1/mercadopago/oauth/callback`
- **Auth**: Pública (MP redirige acá con `code`; se valida `state`)
- **Query params**: `{ code: string, state: string }`
- **Response (200/redirect)**: intercambia el `code` por tokens y los guarda cifrados.
- **Tabla(s)**: `mp_credentials` (crea/actualiza, tokens cifrados).

### Desconectar cuenta
- **Método**: POST
- **Ruta**: `/api/v1/mercadopago/oauth/disconnect`
- **Auth**: Requerida (rol owner/admin)
- **Response (200)**: `{ ok: true }`
- **Tabla(s)**: `mp_credentials` (`isActive = false`).

### Estado de conexión
- **Método**: GET
- **Ruta**: `/api/v1/mercadopago/status`
- **Auth**: Requerida (panel)
- **Response (200)**: `{ connected: boolean, mpUserId: string | null, scopes: string[] }`
- **Tabla(s)**: `mp_credentials`.

### Webhook de pagos
- **Método**: POST
- **Ruta**: `/api/v1/webhooks/mercadopago/payments`
- **Auth**: Pública (validación por firma HMAC de MP)
- **Descripción**: recibe notificaciones de pago (online y Point). Confirma el `payment` y la orden.
- **Response (200)**: `{ received: true }`  // siempre 200 rápido
- **Tabla(s)**: `payments` (`status`, `mpPaymentId`, `mpStatus`, `paidAt`), `orders` (a
  `CONFIRMED`), `stock_movements` (SALIDA al confirmar online).

### Webhook de autorización/desautorización
- **Método**: POST
- **Ruta**: `/api/v1/webhooks/mercadopago/oauth`
- **Auth**: Pública (firma MP)
- **Descripción**: si el comercio revoca el acceso, marca las credenciales inactivas.
- **Response (200)**: `{ received: true }`
- **Tabla(s)**: `mp_credentials` (`isActive`).

### Point: crear store
- **Método**: POST
- **Ruta**: `/api/v1/mercadopago/point/stores`
- **Auth**: Requerida (rol owner/admin)
- **Request body**: `{ branch_id?: string, name?: string }`
- **Response (201)**: `{ id, mpStoreId, branchId, name }`
- **Tabla(s)**: `mp_stores` (mapea a la sucursal).

### Point: crear POS (caja)
- **Método**: POST
- **Ruta**: `/api/v1/mercadopago/point/pos`
- **Auth**: Requerida (rol owner/admin)
- **Request body**: `{ storeId: string, name?: string }`
- **Response (201)**: `{ id, mpPosId, storeId, name }`
- **Tabla(s)**: `mp_pos`.

### Point: listar devices
- **Método**: GET
- **Ruta**: `/api/v1/mercadopago/point/devices`
- **Auth**: Requerida (rol owner/admin)
- **Query params**: `{ posId?: string }`
- **Response (200)**: `{ id, mpDeviceId, posId, operatingMode, serialNumber, isActive }[]`
- **Tabla(s)**: `mp_devices`.

### Point: activar modo PDV
- **Método**: PATCH
- **Ruta**: `/api/v1/mercadopago/point/devices/:id/mode`
- **Auth**: Requerida (rol owner/admin)
- **Request body**: `{ mode: 'PDV' | 'STANDALONE' }`
- **Response (200)**: el `device` actualizado.
- **Tabla(s)**: `mp_devices` (`operatingMode`).
- **Notas**: el comportamiento del PATCH a modo PDV (si asocia el device a la caja
  automáticamente o requiere un paso manual extra) se valida contra un Point físico durante la
  implementación de MercadoPago (nota operativa del modelo, §10.4). El contrato del endpoint no
  cambia según ese resultado.

### Crear Order de MP (checkout online / Point)
- **Método**: POST
- **Ruta**: `/api/v1/mercadopago/orders`
- **Auth**: Requerida (POS: `pos.sell`) o vía checkout público
- **Descripción**: crea la Order de MP para cobrar (checkout online: link/QR; Point: al device).
- **Request body**: `{ orderId: string, deviceId?: string }`  // deviceId para Point
- **Response (201)**: `{ mpOrderId: string, initPoint?: string, qr?: string }`
- **Tabla(s)**: `payments` (`mpOrderId`, `status = PENDING`).

---

# Fase 7 — Descuentos

## Módulo: Discounts

> **Tabla unificada `discounts`**: si `code` es null es descuento automático; con código es cupón.
> **V1 solo implementa 4 tipos** (`PERCENT_PRODUCT`, `AMOUNT_PRODUCT`, `PERCENT_TICKET`,
> `AMOUNT_TICKET`). Los tipos diferidos (`BUY_X_PAY_Y`, `BUY_X_GET_Z`, `VOLUME`) devuelven 400 al
> crearse.

### Listar descuentos/cupones
- **Método**: GET
- **Ruta**: `/api/v1/discounts`
- **Auth**: Requerida (permiso `discounts.view`)
- **Query params**: `{ status?: 'active'|'scheduled'|'expired'|'exhausted', type?: DiscountType, isCoupon?: boolean, search?: string, page?, limit? }`
- **Response (200)**: `Paginated<Discount>`:
```typescript
{
  id: string, name: string, code: string | null,   // code null = descuento automático
  type: DiscountType, value: number, scope: DiscountScope,
  application: 'AUTOMATIC' | 'MANUAL', isPrivate: boolean, isActive: boolean, priority: number,
  startDate: string, endDate: string | null,
  maxUsesTotal: number | null, maxUsesPerCustomer: number | null, usesConsumed: number,
  status: 'active' | 'scheduled' | 'expired' | 'exhausted',  // calculado
  scopeSummary: string   // calculado
}
```
- **Tabla(s)**: `discounts`, `discount_products`, `discount_categories`.

### Obtener descuento
- **Método**: GET
- **Ruta**: `/api/v1/discounts/:id`
- **Auth**: Requerida (permiso `discounts.view`)
- **Response (200)**: el `Discount` completo + `productIds: string[]` + `categoryIds: string[]`.
- **Tabla(s)**: `discounts`, `discount_products`, `discount_categories`.

### Crear / editar descuento
- **Método**: POST `/api/v1/discounts` · PUT `/api/v1/discounts/:id`
- **Auth**: Requerida (permiso `discounts.manage`)
- **Request body**:
```typescript
{
  name: string,
  code?: string,             // presente = cupón; ausente = descuento automático
  type: 'PERCENT_PRODUCT' | 'AMOUNT_PRODUCT' | 'PERCENT_TICKET' | 'AMOUNT_TICKET',  // solo 4 en V1
  value: number, scope: 'PRODUCT' | 'CATEGORY' | 'TICKET',
  productLevel?: 'padre' | 'variante',
  minQuantity?: number, minAmount?: number,
  application?: 'AUTOMATIC' | 'MANUAL',
  startDate: string, endDate?: string,
  activeDays?: number[], startTime?: string, endTime?: string,
  maxUsesTotal?: number, maxUsesPerCustomer?: number,
  isPrivate?: boolean, priority?: number,
  productIds?: string[], categoryIds?: string[]
}
```
- **Response (200/201)**: el `Discount`.
- **Errores**: **400 `{ error: "DISCOUNT_TYPE_UNAVAILABLE", message: "Tipo de descuento no disponible en esta versión" }`**
  si `type` es un tipo diferido. 400 (código duplicado — `@@unique([businessId, code])`).
- **Tabla(s)**: `discounts`, `discount_products`, `discount_categories`, `audit_logs`.

### Toggle activo / duplicar / eliminar
- **Método**: PATCH `/api/v1/discounts/:id/toggle` · POST `/api/v1/discounts/:id/duplicate` · DELETE `/api/v1/discounts/:id`
- **Auth**: Requerida (permiso `discounts.manage`)
- **Response (200)**: el `Discount` (toggle/duplicate) o `{ ok: true }` (delete, soft-delete).
- **Tabla(s)**: `discounts` (`isActive`/`deletedAt`), `audit_logs`.

### Evaluar carrito
- **Método**: POST
- **Ruta**: `/api/v1/discounts/evaluate`
- **Auth**: Requerida (POS: `pos.sell`) · o pública desde checkout storefront (con `slug`)
- **Modo**: FULL + SHOWCASE (en SHOWCASE no hay carrito, pero el POS sí evalúa)
- **Descripción**: recibe el carrito y devuelve descuentos aplicables + totales. **Fuente única de
  verdad de precios** (reemplaza el 10% hardcodeado del frontend). Aplica "best discount wins"
  (mayor ahorro; `priority` como desempate).
- **Request body**:
```typescript
{
  items: { variantId: string, quantity: number, unitPrice: number }[],
  customerId?: string,
  couponCode?: string,
  channel: 'POS' | 'STOREFRONT'
}
```
- **Response (200)**:
```typescript
{
  discounts: { discountId: string, name: string, amount: number, appliesTo: string }[],  // calculado
  subtotal: number, discountTotal: number, total: number   // calculado
}
```
- **Tabla(s)**: lee `discounts`, `discount_products`, `discount_categories` (no escribe; el
  `discount_redemptions` se registra al crear la orden).

### Validar cupón
- **Método**: POST
- **Ruta**: `/api/v1/discounts/validate`
- **Auth**: Requerida (POS: `pos.sell`) · o pública desde checkout
- **Descripción**: valida un código de cupón contra el carrito (POS SelectorCupón).
- **Request body**: `{ code: string, items: {...}[], customerId?: string }`
- **Response (200)**: `{ valid: boolean, discount?: Discount, reason?: string }`
- **Errores**: 404 (código inexistente), 422 (expirado / agotado / no cumple mínimo).
- **Tabla(s)**: `discounts`, `discount_redemptions` (para chequear `maxUsesPerCustomer`).

### Métricas
- **Método**: GET
- **Ruta**: `/api/v1/discounts/metrics` · `/api/v1/discounts/:id/metrics`
- **Auth**: Requerida (permiso `discounts.view`)
- **Query params**: `{ from?: string, to?: string, branch_id?: string, channel?: 'POS'|'STOREFRONT' }`
- **Response (200)**: KPIs y rendimiento (todos **calculados** sobre `discount_redemptions` + `orders`):
```typescript
{ revenueSacrificed: number, redemptionRate: number, avgTicket: number, byDiscount: {...}[] }
```
- **Tabla(s)**: `discount_redemptions`, `orders`.

### Auditoría de un descuento
- **Método**: GET
- **Ruta**: `/api/v1/discounts/:id/audit`
- **Auth**: Requerida (permiso `discounts.view`)
- **Response (200)**: `AuditLog[]` filtrado por `entityType = "discount"` y `entityId = :id`.
- **Tabla(s)**: `audit_logs`.

### Link compartible del cupón
- **Método**: PATCH `/api/v1/discounts/:id/link` · POST `/api/v1/discounts/:id/send-link`
- **Auth**: Requerida (permiso `discounts.manage`)
- **Descripción**: activar/desactivar link compartible (LinkCompartible) y enviarlo por email.
- **Request body (PATCH)**: `{ linkActive: boolean, linkRedirect?: string }`
- **Request body (send-link)**: `{ customerId?: string, email?: string }`
- **Response (200)**: el `Discount` (PATCH) o `{ sent: true }` (send-link).
- **Tabla(s)**: `discounts` (`linkActive`, `linkRedirect`).

---

# Fase 8 — Postventa y comunicación

## Módulo: Returns + Credit Notes

### Listar devoluciones
- **Método**: GET
- **Ruta**: `/api/v1/returns`
- **Auth**: Requerida (permiso `orders.view`)
- **Query params**: `{ status?: 'PENDING'|'IN_PROCESS'|'APPROVED'|'REJECTED', page?, limit? }`
- **Response (200)**: `Paginated<Return>`:
```typescript
{
  id: string, orderId: string, orderNumber: number,  // orderNumber calculado (join)
  orderItemId: string | null, quantity: number, amount: number, reason: string,
  status: 'PENDING' | 'IN_PROCESS' | 'APPROVED' | 'REJECTED',
  refundMethod: 'CREDIT_NOTE' | 'REFUND', createdAt: string
}
```
- **Tabla(s)**: `returns`, `orders`.
- *Corrección Fase 3*: la respuesta suma `customerName`, `customerEmail` y `productName`
  (calculados del join con la orden) para que la pantalla no tenga que salir a buscarlos, y un `counts` por estado para
  las pestañas (mismo criterio que `/orders`).

### Crear devolución
- **Método**: POST
- **Ruta**: `/api/v1/returns`
- **Auth**: Requerida (permiso `orders.manage`)
- **Descripción**: crea una devolución **vinculada a una orden** (Devoluciones).
- **Request body**:
```typescript
{ orderId: string, orderItemId?: string, quantity: number, amount: number, reason: string, refundMethod: 'CREDIT_NOTE' | 'REFUND' }
```
- **Response (201)**: el `Return`.
- **Errores**: 422 (cantidad mayor a la comprada).
- **Tabla(s)**: `returns`.

### Actualizar estado de devolución
- **Método**: PATCH
- **Ruta**: `/api/v1/returns/:id`
- **Auth**: Requerida (permiso `orders.manage`)
- **Request body**: `{ status?: ReturnStatus, refundMethod?: RefundMethod }`
- **Response (200)**: el `Return`.
- **Notas**: al aprobar con `refundMethod = CREDIT_NOTE`, el backend **autogenera** la nota de
  crédito vinculada (opción que este contrato ya preveía). *Corrección Fase 3*: al aprobar
  también reingresa el stock del renglón devuelto (con su movimiento de inventario) y avisa al
  cliente por email; al rechazar acepta `rejectionMessage` (viaja solo en el email de aviso,
  no se persiste). APPROVED y REJECTED son estados finales.
- **Tabla(s)**: `returns`, `variant_stock`, `stock_movements`, `credit_notes`, `email_logs`.

### Listar / emitir notas de crédito
- **Método**: GET `/api/v1/credit-notes` · POST `/api/v1/credit-notes`
- **Auth**: Requerida (GET: `orders.view`; POST: `orders.manage`)
- **Descripción**: NotasCredito. La nota se genera desde una devolución (`refundMethod =
  CREDIT_NOTE`) o manualmente.
- **Request body (POST)**:
```typescript
{ orderId: string, returnId?: string, customerId?: string, amount: number, type: 'BALANCE' | 'REFUND' }
```
- **Response (200/201)**: `CreditNote`:
```typescript
{
  id: string, orderId: string, returnId: string | null, customerId: string | null,
  amount: number, type: 'BALANCE' | 'REFUND', status: 'ISSUED' | 'APPLIED',
  expiresAt: string | null, createdAt: string   // expiresAt = DateTime real (no string display)
}
```
- **Errores**: 409 (ya existe nota para esa devolución — `returnId` es `@unique`).
- **Tabla(s)**: `credit_notes`.

- *Corrección Fase 3*: el GET suma `orderNumber`/`customerName` calculados y un bloque
  `metrics: { totalEmitido, activas, porVencer, aplicadas }` para la cabecera de la pantalla.
  Además, la nota se emite con vencimiento a 6 meses (política inicial).

---

## Módulo: Conversations + Messages

> **Solo modo FULL** (en vidriera digital no hay mensajería). Un hilo por cliente.

### Bandeja de conversaciones
- **Método**: GET
- **Ruta**: `/api/v1/conversations`
- **Auth**: Requerida (permiso `messages.view`)
- **Modo**: **Solo FULL**
- **Query params**: `{ filter?: 'all' | 'unread' | 'archived', page?, limit? }`
- **Response (200)**: `Paginated<Conversation>`:
```typescript
{
  id: string, customerId: string, customerName: string,  // customerName calculado (join)
  preview: string,       // calculado (último mensaje truncado)
  lastMessageAt: string, // calculado
  isUnread: boolean, isArchived: boolean
}
```
- **Tabla(s)**: `conversations`, `messages`, `customers`.

### Mensajes de una conversación
- **Método**: GET
- **Ruta**: `/api/v1/conversations/:id/messages`
- **Auth**: Requerida (permiso `messages.view`)
- **Modo**: **Solo FULL**
- **Response (200)**: `Message[]`:
```typescript
{ id: string, sender: 'CUSTOMER' | 'STORE', text: string, orderId: string | null, createdAt: string }
```
- **Tabla(s)**: `messages`.

### Enviar mensaje
- **Método**: POST
- **Ruta**: `/api/v1/conversations/:id/messages`
- **Auth**: Requerida (permiso `messages.send`)
- **Modo**: **Solo FULL**
- **Request body**: `{ text: string, orderId?: string }`  // orderId = mención opcional a pedido
- **Response (201)**: el `Message` con `sender = STORE`.
- **Tabla(s)**: `messages`, `conversations` (`isUnread`, `updatedAt`).

### Marcar leído / archivar
- **Método**: PATCH
- **Ruta**: `/api/v1/conversations/:id`
- **Auth**: Requerida (permiso `messages.view`)
- **Modo**: **Solo FULL**
- **Request body**: `{ isUnread?: boolean, isArchived?: boolean }`
- **Response (200)**: la `Conversation`.
- **Tabla(s)**: `conversations`.

### Hilo del cliente (storefront)
- **Método**: GET `/api/v1/me/conversation` · POST `/api/v1/me/conversation/messages`
- **Auth**: Requerida (contexto customer)
- **Modo**: **Solo FULL**
- **Descripción**: el cliente ve/escribe su hilo único con la tienda (MensajesCliente).
- **Request body (POST)**: `{ text: string }`
- **Response (200)**: `{ conversation: Conversation, messages: Message[] }` (GET) o el `Message` (POST).
- **Tabla(s)**: `conversations`, `messages` (scoped al `customer` del token; se crea la
  conversación si no existe).

---

## Módulo: Message Templates

### CRUD de plantillas
- **Método**: GET `/api/v1/message-templates` · POST · PUT `/api/v1/message-templates/:id` · DELETE `/api/v1/message-templates/:id`
- **Auth**: Requerida (permiso `messages.view` / `messages.manage`)
- **Modo**: **Solo FULL**
- **Request body (POST/PUT)**:
```typescript
{ name: string, text: string, category: 'PEDIDO' | 'RETIRO' | 'ENVIO' | 'POSTVENTA' | 'OTRO' }
```
- **Response (200)**: `MessageTemplate` → `{ id, name, text, category }`
- **Tabla(s)**: `message_templates`.
- **Notas**: la resolución de variables (`{nombre}`, `{tracking}`) es runtime en el cliente/envío,
  no se persiste resuelta.

---

## Módulo: Reviews

> **Solo modo FULL.** Opiniones **de texto verificadas, sin rating numérico**.

### Crear opinión
- **Método**: POST
- **Ruta**: `/api/v1/reviews`
- **Auth**: Requerida (contexto customer)
- **Modo**: **Solo FULL**
- **Descripción**: el cliente publica una opinión; el backend **verifica la compra**.
- **Request body**: `{ productId: string, orderId: string, text: string }`
- **Response (201)**: `{ id, productId, text, status: 'VISIBLE', createdAt }`
- **Errores**: 403 (no compró el producto: no hay orden `DELIVERED`/`COMPLETED` del cliente con ese
  producto), 409 (ya opinó — `@@unique([customerId, productId, orderId])`).
- **Tabla(s)**: `reviews`, `orders`, `order_items` (para verificar la compra).

### Listar opiniones de un producto (público)
- **Método**: GET
- **Ruta**: `/api/v1/products/:id/reviews`
- **Auth**: Pública
- **Modo**: **Solo FULL**
- **Query params**: `{ page?, limit? }`
- **Response (200)**: `Paginated<Review>`:
```typescript
{ id: string, customerName: string, text: string, createdAt: string }  // sin rating
```
- **Tabla(s)**: `reviews`, `customers` (solo `status = VISIBLE`).

### Ocultar opinión (moderación)
- **Método**: PATCH
- **Ruta**: `/api/v1/reviews/:id/hide`
- **Auth**: Requerida (permiso `reviews.manage`)
- **Modo**: **Solo FULL**
- **Descripción**: el dueño oculta una opinión con **razón obligatoria** (Opción A de moderación).
- **Request body**: `{ hiddenReason: string }`
- **Response (200)**: el `Review` con `status = HIDDEN`.
- **Errores**: 400 (`hiddenReason` vacío).
- **Tabla(s)**: `reviews` (`status`, `hiddenReason`).

### Elegibilidad para opinar (deeplink de email post-entrega)
- **Método**: GET
- **Ruta**: `/api/v1/reviews/eligibility`
- **Auth**: Requerida (contexto customer)
- **Modo**: **Solo FULL**
- **Descripción**: el email post-entrega linkea acá para abrir el formulario si el cliente puede opinar.
- **Query params**: `{ orderId: string, productId: string }`
- **Response (200)**: `{ eligible: boolean, alreadyReviewed: boolean, product: { id, name } }`
- **Tabla(s)**: `orders`, `order_items`, `reviews`.

---

# Fase 9 — Transversal

## Módulo: Audit Logs

> **Solo lectura.** La escritura la hacen los otros módulos internamente (cambios de precio POS,
> toggles de descuentos, cambios de estado, config).

### Listar auditoría
- **Método**: GET
- **Ruta**: `/api/v1/audit-logs`
- **Auth**: Requerida (permiso `config.audit.view`, rol owner/admin)
- **Query params**: `{ entityType?: string, entityId?: string, memberId?: string, action?: AuditAction, from?: string, to?: string, page?, limit? }`
- **Response (200)**: `Paginated<AuditLog>`:
```typescript
{
  id: string, entityType: string, entityId: string,
  action: 'CREATE' | 'UPDATE' | 'ACTIVATE' | 'DEACTIVATE' | 'DELETE',
  memberId: string | null, memberName: string | null,
  changes: { field: string, before: any, after: any }[] | null,  // JSON
  createdAt: string
}
```
- **Tabla(s)**: `audit_logs`.

---

# Fase (Reportes)

## Módulo: Reports

> Todas las respuestas son **agregaciones calculadas** por el backend; no hay tablas de reportes.

### Dashboard
- **Método**: GET
- **Ruta**: `/api/v1/reports/dashboard`
- **Auth**: Requerida (permiso `reports.view`)
- **Query params**: `{ from?: string, to?: string, branch_id?: string, deltaWindow?: 'day'|'period' }`
- **Descripción**: KPIs, alertas, serie de ventas, top productos, distribución por canal,
  actividad reciente (Dashboard).
- **Response (200)**:
```typescript
{
  kpis: { sales: number, orders: number, avgTicket: number, newCustomers: number,
          deltas: { sales: number, orders: number, avgTicket: number, newCustomers: number } },
  alerts: { pendingOrders: number, lowStock: number, paymentsToConfirm: number },
  salesSeries: { labels: string[], values: number[] },
  topProducts: { variantId: string, name: string, units: number, amount: number }[],
  channelDistribution: { pos: number, online: number },
  recentActivity: OrderSummary[]
}
```
- **Tabla(s)**: `orders`, `order_items`, `payments`, `variant_stock`, `customers` (todo agregado).
- **Notas**:
  - **Deltas** = comparación contra el **mismo período anterior** de igual duración. Si el rango
    es "esta semana", el delta compara contra la semana pasada; si es "hoy", contra ayer.
    `deltaWindow` (`day`/`period`) define esa ventana.
  - **"Clientes nuevos"** = clientes cuyo **primer pedido** (por `created_at` de su primera
    `order`) cae dentro del rango consultado. Misma regla en `/reports/customers`.

### Reportes específicos
- **Método**: GET
- **Ruta**: `/api/v1/reports/sales` · `/products` · `/customers` · `/inventory`
- **Auth**: Requerida (permiso `reports.view`)
- **Query params**: `{ from?, to?, branch_id? }`
- **Response (200)**: series/desgloses según cada reporte (ReporteVentas, ReporteProductos,
  ReporteClientes, ReporteInventario) — todos calculados.
- **Tabla(s)**: `orders`, `order_items`, `customers`, `variant_stock`, `products`.

---

# Fase 11 — Suscripciones y plataforma

## Módulo: Subscriptions (negocio ↔ Orbita)

> Lo que el **negocio le paga a Orbita** por el software. **No confundir** con `payments`
> (clientes → negocio). Los cobros los maneja el webhook de preapproval de MP.

### Estado de la suscripción
- **Método**: GET
- **Ruta**: `/api/v1/subscription`
- **Auth**: Requerida (rol owner/admin)
- **Descripción**: estado de la suscripción del negocio a Orbita.
- **Response (200)**:
```typescript
{
  id: string, origin: 'PAID' | 'COMP', status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED',
  plan: string, amount: number, currency: string,
  currentPeriodStart: string, currentPeriodEnd: string, gracePeriodDays: number,
  grantReason: string | null   // si origin = COMP
}
```
- **Tabla(s)**: `subscriptions`.

### Historial de facturación
- **Método**: GET
- **Ruta**: `/api/v1/subscription/payments`
- **Auth**: Requerida (rol owner/admin)
- **Query params**: `{ page?, limit? }`
- **Response (200)**: `Paginated<SubscriptionPayment>`:
```typescript
{ id: string, amount: number, status: 'APPROVED' | 'FAILED' | 'PENDING',
  periodStart: string, periodEnd: string, paidAt: string | null, failedReason: string | null }
```
- **Tabla(s)**: `subscription_payments`.

### Webhook de cobro de suscripción (preapproval MP)
- **Método**: POST
- **Ruta**: `/api/v1/webhooks/mercadopago/preapproval`
- **Auth**: Pública (firma MP)
- **Descripción**: recibe el resultado de cada débito automático; actualiza el estado de la
  suscripción (política de gracia B: 3-5 días).
- **Response (200)**: `{ received: true }`
- **Tabla(s)**: `subscription_payments`, `subscriptions` (`status` según éxito/fallo).

---

## Módulo: Platform Admin

> **Auth de super-admin** (`platform_admins`), **separada del multi-tenant**. Operan sobre
> cualquier negocio. Todas requieren contexto `platform_admin`.

### Listar negocios (plataforma)
- **Método**: GET
- **Ruta**: `/api/v1/platform/businesses`
- **Auth**: Super-admin
- **Query params**: `{ search?: string, status?: string, page?, limit? }`
- **Response (200)**: `Paginated<{ id, name, subdomain, mode, isActive, subscription: { status, origin } }>`
- **Tabla(s)**: `businesses`, `subscriptions`.

### Detalle de negocio (plataforma)
- **Método**: GET
- **Ruta**: `/api/v1/platform/businesses/:businessId`
- **Auth**: Super-admin
- **Response (200)**: datos del negocio + suscripción + métricas básicas.
- **Tabla(s)**: `businesses`, `subscriptions`, `subscription_payments`.

### Suspender / reactivar negocio
- **Método**: POST
- **Ruta**: `/api/v1/platform/businesses/:businessId/suspend` · `/reactivate`
- **Auth**: Super-admin
- **Request body (suspend)**: `{ reason?: string }`
- **Response (200)**: `{ ok: true }`
- **Tabla(s)**: `subscriptions` (`status = SUSPENDED`/`ACTIVE`), `platform_admin_logs`.

### Ceder licencia de cortesía (comp)
- **Método**: POST
- **Ruta**: `/api/v1/platform/subscriptions/:businessId/grant-comp`
- **Auth**: Super-admin
- **Descripción**: otorga licencia gratis (`origin = COMP`, `amount = 0`) con fecha de fin fija.
- **Request body**: `{ currentPeriodEnd: string, grantReason: string }`
- **Response (200)**: la `Subscription`.
- **Tabla(s)**: `subscriptions` (`grantedBy` = el admin), `platform_admin_logs`.

### CRUD de admins de plataforma
- **Método**: GET `/api/v1/platform/admins` · POST · PUT `/api/v1/platform/admins/:id` · DELETE `/api/v1/platform/admins/:id`
- **Auth**: Super-admin (rol `SUPERADMIN` para escritura)
- **Request body (POST/PUT)**: `{ name: string, email: string, role: 'SUPERADMIN' | 'OPERATOR' }`
- **Response (200)**: `PlatformAdmin` → `{ id, name, email, role, isActive }`
- **Tabla(s)**: `platform_admins`.

---

# Fase 12 — Dominios

## Módulo: Custom Domains

> **En V1 solo el camino 3 (comprar vía Orbita, `source = PURCHASED`, solo TLDs internacionales).**
> El camino 2 (`LINKED`, vincular dominio propio) está modelado pero **no se implementa en V1**
> (queda documentado como V2). El camino 1 (subdominio) es el campo `businesses.subdomain`, no
> necesita este módulo.

### Listar dominios del negocio
- **Método**: GET
- **Ruta**: `/api/v1/domains`
- **Auth**: Requerida (rol owner/admin)
- **Response (200)**: `CustomDomain[]`:
```typescript
{
  id: string, domain: string, source: 'PURCHASED' | 'LINKED',
  status: 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED',
  dnsVerified: boolean, sslStatus: 'PROVISIONING' | 'ACTIVE' | 'FAILED',
  purchasedAt: string | null, expiresAt: string | null, autoRenew: boolean
}
```
- **Tabla(s)**: `custom_domains`.

### Buscar disponibilidad de dominio
- **Método**: GET
- **Ruta**: `/api/v1/domains/search`
- **Auth**: Requerida (rol owner/admin)
- **Query params**: `{ q: string }`  // nombre a buscar
- **Response (200)**: `{ domain: string, available: boolean, price: number, tld: string }[]`
- **Tabla(s)**: ninguna (consulta al registrar OpenSRS/ResellerClub).
- **Notas**: solo TLDs internacionales revendibles (`.com`, `.net`, `.io`, …). **`.com.ar` NO se
  revende** (restricción NIC.ar) — ese caso es camino 2 (V2).

### Comprar dominio (camino 3)
- **Método**: POST
- **Ruta**: `/api/v1/domains/purchase`
- **Auth**: Requerida (rol owner)
- **Request body**: `{ domain: string, autoRenew?: boolean }`
- **Response (201)**: el `CustomDomain` (`source = PURCHASED`, `status = PENDING`).
- **Tabla(s)**: `custom_domains`.

### Verificar DNS
- **Método**: POST
- **Ruta**: `/api/v1/domains/:id/verify-dns`
- **Auth**: Requerida (rol owner/admin)
- **Descripción**: verifica que el A/CNAME apunten a Orbita (modelo Shopify).
- **Response (200)**: `{ dnsVerified: boolean, status: DomainStatus }`
- **Tabla(s)**: `custom_domains` (`dnsVerified`, `status`).

### Estado de SSL
- **Método**: GET
- **Ruta**: `/api/v1/domains/:id/ssl-status`
- **Auth**: Requerida (rol owner/admin)
- **Response (200)**: `{ sslStatus: 'PROVISIONING' | 'ACTIVE' | 'FAILED' }`  // gestionado por Vercel
- **Tabla(s)**: `custom_domains`.

> **Camino 2 (LINKED) — V2, no implementar todavía.** El schema soporta `source = LINKED` (el
> cliente trae su dominio; Orbita solo verifica DNS + SSL, sin gestionar compra/renovación). La
> infraestructura de verificación DNS + SSL del camino 3 ya lo deja casi listo; en V2 se agrega
> solo el flujo de UI. No exponer endpoints de `LINKED` en V1.

---

# Storefront público

## Módulo: Storefront (sin auth)

> Endpoints **públicos** que sirven la tienda. Identifican el negocio por `slug` (subdominio) o
> dominio custom en la URL, **sin token**. Los que implican compra/carrito son **Solo FULL**.

### Config + apariencia de la tienda
- **Método**: GET
- **Ruta**: `/api/v1/storefront/:slug`
- **Auth**: Pública
- **Modo**: FULL + SHOWCASE
- **Descripción**: config pública para renderizar la tienda (todas las vistas del storefront).
- **Response (200)** (forma real, `StorefrontService.getConfig()`):
```typescript
{
  business: { id, name, subdomain, mode: 'FULL' | 'SHOWCASE', isActive, isPaused },
  appearance: { ...branding, tema, layout, heroSlides, headerLinks, toggles... } | null,
  contact: { whatsapp, email, scheduleText, instagram, tiktok, facebook } | null,
  // Agregado (2026-08-09) — antes el checkout no tenía forma de saber qué
  // activó el negocio de verdad. `acceptsMercadopago` viaja tal cual está
  // configurado, pero el checkout NO lo ofrece como opción real todavía: sin
  // conexión OAuth con la cuenta de Mercado Pago del negocio (fase aparte),
  // ofrecerlo sería mentirle al cliente.
  payment: {
    acceptsMercadopago: boolean, acceptsCash: boolean, acceptsTransfer: boolean, acceptsPickup: boolean,
    transferAlias: string | null,      // null si acceptsTransfer es false
    cashDiscountPercent: number | null, // null si acceptsCash es false o no se cargó
    pickupAddress: string | null,       // dirección de la sucursal default, null si acceptsPickup es false
  } | null,
  shipping: {
    shippingBase: number | null, freeShippingFrom: number | null,
    deliveryZones: string[], shippingPolicy: string | null,
  } | null,   // campos null = "no cargado": el checkout no muestra ni calcula nada con eso
}
```
- **Errores**: 404 (slug inexistente), 403 (negocio pausado/suspendido → página de "no disponible").
- **Tabla(s)**: `businesses`, `business_config`, `storefront_config`, `branches` (dirección de retiro).

### Listar productos (público)
- **Método**: GET
- **Ruta**: `/api/v1/storefront/:slug/products`
- **Auth**: Pública
- **Modo**: FULL + SHOWCASE
- **Query params**: `{ categoryId?: string, search?: string, featured?: boolean, onSale?: boolean,
  inStock?: boolean, minPrice?: number, maxPrice?: number,
  sort?: 'relevancia'|'precio-asc'|'precio-desc'|'bestselling', page?, limit? }`
  — `onSale` = `comparePrice` activo y mayor al precio actual (mismo criterio del badge
  "Oferta"). `bestselling` ordena por unidades históricas vendidas (sin ventana de tiempo,
  agregado sobre `order_items`) — usado por el link "Más vendidos" del header.
- **Response (200)**: `Paginated<StorefrontProduct>`:
```typescript
{
  id: string, name: string, categoryId: string | null,
  price: number,             // ver "Decisión 2026-08-14" más abajo — NO siempre es basePrice
  comparePrice: number | null,
  badge: 'Nuevo' | 'Oferta' | null,  // calculado (comparePrice != null → Oferta; antigüedad → Nuevo)
  inStock: boolean,          // calculado (variant_stock > 0)
  primaryImageUrl: string | null,
  // Swatches de la opción "visual" del producto (ej. Color), si tiene una —
  // [] si no. `imageUrl` puede ser null (ese valor puntual no tiene foto
  // tagueada; el frontend cae a un degradé). Agregado 2026-08-25 para la
  // card del catálogo (hover/click sobre un swatch cambia la foto de la
  // card, ProductCard.tsx) — máximo 2 se muestran ahí, el resto queda
  // atrás de un "+N".
  variantes: { valor: string, imageUrl: string | null }[]
}
```
- **Tabla(s)**: `products`, `product_variants`, `variant_stock`, `product_images`, `product_options`,
  `product_option_values`.
- **Notas**: **sin `rating`** (eliminado del modelo). El badge es derivado.
- **Decisión 2026-08-13**: un producto donde NINGUNA variante activa tiene stock en la sucursal
  de venta no aparece en este listado — antes solo se excluía con `inStock=true` explícito, así
  que por default se veían cards de productos agotados con los botones de compra habilitados que
  después no agregaban nada. Un producto con ALGUNAS variantes sin stock (ej. talle S agotado,
  M disponible) sigue apareciendo — esas variantes se tachan recién en el detalle, acá no hay
  forma de saber cuál eligió el cliente todavía.
- **Decisión 2026-08-14 — `price` no es literalmente `Product.basePrice`**: para un producto SIN
  opciones, `price` es el precio de la variante que realmente se va a cobrar
  (`precioRepresentativo()` en `storefront.service.ts`: primero la variante `isDefault`, si no la
  que tiene stock, si no la primera por `createdAt`) — nunca el campo `basePrice` suelto, que puede
  desincronizarse del precio real de la variante (encontrado con datos reales: un producto sin
  opciones había terminado con dos variantes por un problema de edición en el panel, con
  `basePrice` distinto del precio de ambas — el cliente veía un precio en la card y otro al
  agregar al carrito). Para un producto CON opciones, `price` sigue siendo `basePrice` sin cambios
  (no hay una única variante que representar; cada combinación tiene su propio precio, lo resuelve
  el selector). Mismo criterio aplicado en el detalle de producto (`GET .../products/:id`, `price`
  a nivel producto).

### Detalle de producto (público)
- **Método**: GET
- **Ruta**: `/api/v1/storefront/:slug/products/:id`
- **Auth**: Pública
- **Modo**: FULL + SHOWCASE
- **Response (200)**: producto con variantes, opciones e imágenes (para ProductoDetalle), + reseñas
  visibles si el modo es FULL. Cada variante incluye `inStock: boolean`, `lowStock: boolean` y
  `maxQty: number` — **decisión 2026-08-13**: `maxQty = Math.min(stockReal, 20)`. Antes el stock
  real nunca se exponía ("solo booleanos"); ahora se expone el número exacto, pero únicamente
  cuando es bajo (el tope de 20 hace indistinguible "hay 20" de "hay 5000") — sirve tanto para
  mostrar "Quedan N" en la UI como de tope duro por línea de carrito (antifraude). Las variantes
  con `isActive: false` (combinación no ofrecida) no aparecen en la respuesta.
- **Tabla(s)**: `products`, `product_variants`, `product_options`, `product_option_values`,
  `product_images`, `variant_stock`, `reviews`.
- **Sucursal usada para el stock**: la más antigua del negocio (`Branch` con `createdAt` menor),
  mismo criterio que usa `OrdersService.create()` para validar al comprar — antes el storefront
  sumaba el stock de TODAS las sucursales mientras el checkout validaba contra una sola, lo que
  podía mostrar un producto disponible y rechazarlo al pagar (bug corregido 2026-08-13, ver
  comentario en Jira RBT-619).

### Validar carrito (público)
- **Método**: POST
- **Ruta**: `/api/v1/storefront/:slug/cart/validate`
- **Auth**: Pública
- **Modo**: **Solo FULL**
- **Descripción**: revalida el carrito guardado en `localStorage` del cliente contra el estado
  real del catálogo — se dispara al hidratar el carrito y al abrirlo (drawer del header o
  `/carrito`). Nunca falla por un ítem individual: un `variantId` borrado/inexistente devuelve
  `ok: false` en vez de un error, para que el frontend pueda tacharlo sin romper el resto.
- **Request body**:
```typescript
{ items: { variantId: string, quantity: number }[] }
```
- **Response (200)**: un resultado por ítem pedido, mismo orden:
```typescript
{
  variantId: string,
  ok: boolean,
  motivo?: 'NO_DISPONIBLE' | 'SIN_STOCK' | 'STOCK_INSUFICIENTE',
  // NO_DISPONIBLE: producto borrado/despublicado, variante desactivada, o el id no existe.
  // SIN_STOCK: variante activa pero con 0 unidades en la sucursal de venta.
  // STOCK_INSUFICIENTE: hay stock pero menos del `quantity` pedido.
  nombre: string | null, variante: string | null,   // null si NO_DISPONIBLE
  precio: number | null, precioAnt: number | null,  // precio REAL actual, nunca el que mandó el cliente
  maxQty: number,        // 0 si no disponible; si no, Math.min(stockReal, 20)
  imgUrl: string | null,
}[]
```
- **Tabla(s)**: `products`, `product_variants`, `variant_stock` (misma sucursal de venta que el
  detalle de producto y el checkout).

### Categorías (público)
- **Método**: GET
- **Ruta**: `/api/v1/storefront/:slug/categories`
- **Auth**: Pública
- **Modo**: FULL + SHOWCASE
- **Response (200)**: `{ id, name, slug, productCount }[]`  // productCount calculado
- **Tabla(s)**: `categories`, `products`.

### Checkout (crear pedido online)
- **Método**: POST
- **Ruta**: `/api/v1/storefront/:slug/checkout`
- **Auth**: **Pública — contexto customer opcional** (vuelve a ser `@Public()` el 2026-08-14; la
  decisión del 2026-08-09 de exigir sesión seguía siendo correcta para el caso logueado —
  "Mis pedidos", validar que `shippingAddressId` es del cliente — pero bloqueaba comprar sin
  cuenta por completo. Ahora conviven los dos caminos: con token de cliente, exactamente el mismo
  comportamiento que antes (se valida que el `businessId` del token coincida con el del slug,
  `shippingAddressId` se valida contra su dueño); sin token, el pedido nace con `customerId: null`
  ("venta anónima", mismo concepto que ya existía para POS) y **no puede** mandar
  `shippingAddressId` — un invitado no tiene `Customer` al que colgarle un `Address`
  (`Address.customerId` no es nullable), así que se rechaza con 422 y se coordina el envío por
  WhatsApp después de confirmar.
- **Modo**: **Solo FULL**
- **Descripción**: crea la orden ONLINE reutilizando `OrdersService.create()` (mismo motor que usa
  el alta manual del panel) — congela precios reales, valida stock, resuelve/canjea `couponCode`
  si viene, y aplica `manualDiscountPercent` = `BusinessConfig.cashDiscountPercent` cuando
  `paymentMethod` es `CASH`.
- **Request body** (forma real, `CheckoutDto`):
```typescript
{
  items: { variantId: string, quantity: number }[],
  buyer: { name: string, email: string, phone?: string },
  shippingAddressId?: string,   // referencia a Me/Addresses (RBT-629) — NO arma direcciones sueltas
  paymentMethod: 'MERCADOPAGO' | 'CASH' | 'TRANSFER' | 'PICKUP',
  couponCode?: string
}
```
- **Response (201)**: la orden completa (mismo shape que `GET /orders/:id` del panel — items,
  subtotal, discountTotal, total, status: 'PENDING', etc.).
- **Errores**: 403 (negocio del token ≠ negocio del slug), 404 (`shippingAddressId` no existe o no
  es de este cliente, o alguna variante no existe/está en borrador/desactivada — ver nota
  siguiente), 422 (`shippingAddressId` mandado por un invitado sin sesión, `paymentMethod` no
  habilitado en `BusinessConfig` — **`MERCADOPAGO` siempre rechaza**, ver nota en `getConfig()` de
  arriba —, stock insuficiente, cupón inválido).
- **Bug corregido 2026-08-13**: `OrdersService.create()` no validaba `ProductVariant.isActive` ni
  `Product.status`, así que un producto en borrador o una combinación desactivada se podían
  comprar igual desde acá. Ahora `create()` acepta un tercer parámetro opcional
  `{ publicCheckout?: boolean }`; este endpoint lo pasa en `true`, lo que suma `isActive: true` y
  `status IN (PUBLISHED, OUT_OF_STOCK)` al filtro de variantes. El alta manual del panel (mismo
  `create()`, sin ese flag) sigue permitiendo cargar un pedido sobre un producto en borrador
  a propósito (el dueño puede querer vender algo que todavía no publicó).
- **Pendiente**: no hay columna dedicada para el método de pago elegido — queda en `Order.notes`
  como texto legible ("Método de pago elegido: Efectivo."). Anotado en RBT-619.
- **Tabla(s)**: `orders` (PENDING), `order_items`, `online_order_details`, `order_status_history`,
  `discount_redemptions` (si hubo cupón). Sin `payments`: eso se registra recién cuando el dueño
  confirma el pago (Mercado Pago Connect / confirmación manual son fases aparte).

### Seguimiento de pedido (público)
- **Método**: GET
- **Ruta**: `/api/v1/storefront/:slug/orders/:id/tracking` — **por id (UUID), no por
  `orderNumber`** (esta sección documentaba `orderNumber` desde antes de que el endpoint
  existiera; se construyó el 2026-08-14 junto con guest checkout, indexado por `id` porque es lo
  que el frontend ya tiene a mano apenas termina el checkout o vuelve de Mercado Pago —
  `checkoutStorefront()` devuelve `pedido.id`, y el `volverA` de Mercado Pago lo lleva en la URL).
- **Auth**: Pública. Con contexto customer, se valida que el pedido sea de ESE cliente (no hace
  falta `email`). Sin sesión, hay que mandar `?email=` y tiene que coincidir con
  `OnlineOrderDetails.buyerEmail` del pedido — cualquier mismatch (o pedido de otro cliente)
  devuelve 404, nunca 403, para no filtrar que el id existe.
- **Modo**: **Solo FULL**
- **Query params**: `{ email?: string }`  // obligatorio si no hay sesión de cliente
- **Response (200)**: mismo shape rico que devuelve `OrdersService.findOne()` (items, pagos,
  `onlineOrderDetails`, `statusHistory`, etc. — usado hoy por `Confirmacion.tsx`).
- **Tabla(s)**: `orders`, `order_items`, `payments`, `order_status_history`, `online_order_details`.

### Cupones públicos
- **Método**: GET
- **Ruta**: `/api/v1/storefront/:slug/coupons`
- **Auth**: Pública
- **Modo**: **Solo FULL**
- **Descripción**: cupones no privados vigentes (CuponesPublicos).
- **Response (200)**: `{ code: string, name: string, type: DiscountType, value: number, scope: DiscountScope, endDate: string | null, minAmount: number | null }[]`
- **Tabla(s)**: `discounts` (donde `code != null`, `isPrivate = false`, `isActive`, vigente).

### Descuento exclusivo (por link privado)
- **Método**: GET
- **Ruta**: `/api/v1/storefront/:slug/exclusive-discount/:code`
- **Auth**: Pública
- **Modo**: **Solo FULL**
- **Descripción**: resuelve un cupón privado accedido por link compartible (DescuentoExclusivo).
- **Response (200)**: el descuento, o 404 si no existe/expiró.
- **Tabla(s)**: `discounts` (`linkActive = true`).

### Pedidos del cliente logueado
- **Método**: GET
- **Ruta**: `/api/v1/me/orders`
- **Auth**: Requerida (contexto customer)
- **Modo**: **Solo FULL**
- **Descripción**: historial de pedidos del cliente (Perfil).
- **Response (200)**: `Paginated<OrderSummary>`
- **Tabla(s)**: `orders`.

### Solicitar devolución / cancelar (cliente)
- **Método**: POST
- **Ruta**: `/api/v1/me/orders/:id/return` · `/api/v1/me/orders/:id/cancel`
- **Auth**: Requerida (contexto customer)
- **Modo**: **Solo FULL**
- **Request body (return)**: `{ orderItemId?: string, quantity: number, reason: string, refundMethod: 'CREDIT_NOTE' | 'REFUND' }`
- **Response (200/201)**: el `Return` (o cancelación de la orden).
- **Tabla(s)**: `returns` (o `orders.status = CANCELLED`).

### Actualizar perfil (cliente)
- **Método**: PUT
- **Ruta**: `/api/v1/me/profile`
- **Auth**: Requerida (contexto customer)
- **Modo**: FULL + SHOWCASE
- **Request body**: `{ firstName?: string, lastName?: string, phone?: string }`
- **Response (200)**: el `customer` actualizado.
- **Tabla(s)**: `customers`.

---

# Resumen y anexos

## Endpoints que requieren `modo = FULL` (403 en SHOWCASE)

En modo SHOWCASE (vidriera digital) devuelven `403 { error: "SHOWCASE_MODE" }`:

- **Checkout / carrito**: `POST /storefront/:slug/checkout`, `GET /storefront/:slug/orders/:orderNumber/tracking`
- **Cupones**: `GET /storefront/:slug/coupons`, `GET /storefront/:slug/exclusive-discount/:code`
- **Mensajería**: todo `Conversations + Messages` (`/conversations*`, `/me/conversation*`), todo
  `Message Templates` (`/message-templates*`)
- **Opiniones**: todo `Reviews` (`POST /reviews`, `GET /products/:id/reviews`,
  `PATCH /reviews/:id/hide`, `GET /reviews/eligibility`)
- **Pedidos del cliente**: `GET /me/orders`, `POST /me/orders/:id/return`, `POST /me/orders/:id/cancel`

> El **POS del panel** siempre funciona (vende presencial) — el modo SHOWCASE solo apaga la venta
> **online**. Por eso `POST /orders` (canal POS), `/discounts/evaluate` (canal POS) y `/discounts/validate`
> siguen disponibles en SHOWCASE; lo que se bloquea es el checkout público online.

## Endpoints públicos (sin auth)

- **Auth**: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
  `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/verify-reset-code`,
  `POST /auth/reset-password`, `POST /auth/accept-invitation`
- **Storefront**: `GET /storefront/:slug`, `/storefront/:slug/products`,
  `/storefront/:slug/products/:id`, `/storefront/:slug/categories`, `/storefront/:slug/coupons`,
  `/storefront/:slug/exclusive-discount/:code`, `POST /storefront/:slug/checkout`,
  `GET /storefront/:slug/orders/:orderNumber/tracking`, `GET /products/:id/reviews`
- **Webhooks (firma en vez de token)**: `POST /webhooks/mercadopago/payments`,
  `/webhooks/mercadopago/oauth`, `/webhooks/mercadopago/preapproval`
- **OAuth callback**: `GET /mercadopago/oauth/callback`

## Endpoints de super-admin (plataforma)

Requieren contexto `platform_admin` (auth separada del multi-tenant):

- `GET /platform/businesses`, `GET /platform/businesses/:businessId`
- `POST /platform/businesses/:businessId/suspend`, `/reactivate`
- `POST /platform/subscriptions/:businessId/grant-comp`
- `GET/POST/PUT/DELETE /platform/admins`

## Gaps resueltos

Todos los gaps detectados durante el diseño quedaron cerrados. Resumen de cada resolución:

1. **`storefront_config.showRating` → `showReviews`** ✅ — el toggle se renombró a `showReviews`
   ("Opiniones de clientes"): ahora controla la **sección de opiniones de texto**, no puntuaciones
   (que ya no existen). El contrato usa `showReviews` en el body de apariencia. (El frontend ya
   migró el toggle a `mostrarResenas` en esta sesión.)

2. **Notas del cliente (`ClienteNota`)** ✅ — **fuera de V1**. No hay tabla ni endpoint de notas; el
   detalle de cliente no las incluye. Si se necesita más adelante, se modela como tabla nueva.

3. **Historial de emails a clientes** ✅ — **no se persiste**. `POST /customers/email` envía y la
   trazabilidad queda a cargo del proveedor de email (Resend/SendGrid) vía su propio historial. Sin
   tabla propia en V1.

4. **Cola de preparación** ✅ — mapeo 1:1 a `OrderStatus`: "preparar" = `PREPARING`, "listo" =
   `SHIPPED`, "despachado" = `DELIVERED`. `PATCH /orders/:id/status` cubre el kanban; sin sub-estado
   ni tabla extra.

5. **Ventana de deltas del dashboard** ✅ — regla: **mismo período anterior de igual duración**
   (esta semana vs. semana pasada; hoy vs. ayer). Parametrizado con `deltaWindow`.

6. **Definición de "cliente nuevo"** ✅ — clientes cuyo **primer pedido** cae en el rango consultado.
   Documentado en `/reports/dashboard` y `/reports/customers`.

7. **Favorito de producto en POS** ✅ — **diferido a V2**. No va en V1: ningún endpoint devuelve
   `favorito`. Cuando se implemente, se modela como `product_favorites(member_id, product_id)` por
   miembro.

8. **Tickets pausados server-side** ✅ — **V1 client-side only** (`localStorage`, `usePausadosStore`).
   Sin tabla ni endpoint. Multi-dispositivo (tabla `parked_tickets`) queda para un incremento futuro.
