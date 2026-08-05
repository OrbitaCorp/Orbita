# Cuenta Cliente Storefront (RBT-628, RBT-629, RBT-630, RBT-631) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar la pantalla de cuenta del cliente final del storefront (`apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx`, hoy 100% mock) a endpoints reales: mis pedidos (RBT-628), mis direcciones (RBT-629), datos personales (RBT-630) y seguridad/sesiones (RBT-631).

**Architecture:** Cuatro módulos backend nuevos/completados, todos protegidos por `assertCustomerContext(ctx)` (ya existe en `apps/api/src/common/utils/assert-customer-context.ts`) para garantizar que un cliente SOLO vea sus propios datos dentro de SU negocio — nunca por id a ciegas. `AddressesController` (`/me/addresses`) ya está scaffoldeado (rutas + DTO), solo falta el service. Se crea un `MeController` nuevo (`/me`, `/me/change-password`, `/me/avatar`, `/me/sessions`) para datos personales y seguridad. "Mis pedidos" se sirve desde un controller nuevo `/me/orders` en el módulo `orders`, reusando el shape que ya arma `OrdersService.findOne()` para el detalle. En el frontend, cada tab de `Perfil.tsx` reemplaza su import de `mock.ts` por un hook de TanStack Query contra estos endpoints — la interfaz visual de cada tab no cambia, solo el origen del dato.

**Tech Stack:** NestJS + Prisma (Postgres/Supabase) en `apps/api`; Next.js Pages Router + TanStack Query en `apps/web`. Tests e2e con Jest + Supertest.

## Global Constraints

- **Aislamiento multi-tenant (la regla más importante de todo este plan):** un mismo email puede ser un `Customer` distinto — con contraseña, pedidos y direcciones propias — en cada negocio (`@@unique([businessId, email])` en el schema). TODA query de este plan filtra primero por `ctx.businessId` (o implícitamente, porque `customerId` ya pertenece a un solo negocio) y por `ctx.customerId` — nunca se acepta un `customerId`/`addressId`/`orderId` de otro cliente aunque el atacante lo adivine (verificar pertenencia en cada `findFirst`/`update`/`delete`, no solo filtrar en el `findMany`).
- **`assertCustomerContext(ctx)` en cada endpoint nuevo** — nunca `assertMemberContext`. Un member del panel no debe poder pegarle a `/me/*` (son rutas del storefront).
- **El backend nunca confía en datos sensibles mandados por el cliente:** el cambio de contraseña verifica la actual con `argon2.verify` antes de aceptar la nueva; el email nuevo se valida único dentro del negocio antes de guardar.
- **Reglas de código frontend (heredadas):** archivos < 300 líneas, named exports, tokens `var(--color-*)` nunca hex, sin Zustand, server-state en TanStack Query. Los componentes visuales de `Perfil.tsx` NO cambian de estructura, solo el origen del dato (de `mock.ts` a un hook).
- **`code` en el commit final:** commits en español, minúscula, con trailer `Co-Authored-By`. El equipo trabaja directo sobre `main`.
- **Migraciones de Prisma:** cualquier columna nueva (`Customer.birthDate`, `Customer.avatarUrl`, `RefreshToken.deviceInfo` ya existe pero no se usa) se agrega con `npx prisma migrate dev --name <nombre>` desde `apps/api`, nunca editando el schema y esperando que Supabase lo detecte solo.

---

## Scope Check

Esto son 4 tickets de Jira relacionados por una misma pantalla (`Perfil.tsx`) pero con backends independientes entre sí (direcciones, datos personales, sesiones y pedidos no comparten tablas). Se numeran como Tasks separadas para que cada una sea mergeable y testeable por su cuenta — si el equipo prefiere repartir el trabajo entre personas, Task 1/2/3/4 pueden ejecutarse en paralelo (no tienen dependencias entre sí; todas dependen solo de `assertCustomerContext`, que ya existe).

---

## File Structure

**Backend:**
- `apps/api/src/customers/addresses.controller.ts` — ya existe (rutas + DTO), completar los 4 handlers (modificar).
- `apps/api/src/customers/addresses.service.ts` — nuevo service dedicado a direcciones (crear).
- `apps/api/src/me/me.module.ts`, `me.controller.ts`, `me.service.ts` — datos personales + seguridad (crear).
- `apps/api/src/me/dto/update-me.dto.ts`, `change-password.dto.ts` — DTOs (crear).
- `apps/api/src/orders/customer-orders.controller.ts` — nuevo controller `/me/orders` (crear).
- `apps/api/prisma/schema.prisma` — agregar `Customer.birthDate`, `Customer.avatarUrl` (modificar + migración).
- `apps/api/src/auth/auth.service.ts` — capturar `deviceInfo` (user-agent + IP) en `createRefreshToken()` (modificar).
- `apps/api/src/auth/auth.controller.ts` — inyectar `@Req()` en `login`/`refresh` para pasar el `deviceInfo` (modificar).
- Tests e2e: `apps/api/test/me-addresses.e2e-spec.ts`, `me-profile.e2e-spec.ts`, `me-sessions.e2e-spec.ts`, `me-orders.e2e-spec.ts` (crear).

**Frontend:**
- `apps/web/src/lib/api.ts` — funciones cliente para `/me/*` (modificar).
- `apps/web/src/lib/auth/AuthContext.tsx` — agregar `changePassword`, `updateProfile`, `listSessions`, `revokeSession`, `logoutAll` al contexto (modificar).
- `apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx` — reemplazar cada mock por un hook real (modificar, por tab).
- `apps/web/src/modules/ventas/cliente/perfil/hooks/` — nuevo directorio con `useMisDirecciones.ts`, `useMisPedidos.ts`, `useDatosPersonales.ts`, `useSesiones.ts` (crear).

---

## Task 1: Mis direcciones (RBT-629)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (agregar `depto`, `entreCalles`, `provincia` a `Address` + migración)
- Modify: `apps/api/src/customers/dto/upsert-address.dto.ts` (agregar los 3 campos)
- Modify: `apps/api/src/customers/addresses.controller.ts` (completar los 4 handlers; hoy inyecta `CustomersService` y devuelve `not implemented` — cambiar la inyección a `AddressesService`)
- Create: `apps/api/src/customers/addresses.service.ts`
- Modify: `apps/api/src/customers/customers.module.ts` (registrar el nuevo service)
- Test: `apps/api/test/me-addresses.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `assertCustomerContext(ctx)`, `UpsertAddressDto` (hoy: `alias?, street!, floor?, city!, zip?, isDefault?`; se le agregan `depto?, entreCalles?, provincia?`).
- Produces: `AddressesService.findAll(customerId)`, `.create(customerId, dto)`, `.update(customerId, id, dto)`, `.remove(customerId, id)`.

> **Antes de escribir código:** leé `apps/api/src/customers/addresses.controller.ts` completo (ya tiene las 4 rutas con `assertCustomerContext` llamado pero descartado con `void customer`, e inyecta `CustomersService` — la inyección hay que cambiarla a `AddressesService`) y el `Address` model en `apps/api/prisma/schema.prisma` (`id, customerId, alias, street, floor, city, zip, isDefault, createdAt, updatedAt`, `onDelete: Cascade` desde `Customer`).

**Decisión (2026-08-02, aprobada):** el ticket RBT-629 pide `calle, piso, depto, entre calles, provincia, ciudad, CP`. El schema hoy tiene `street/floor/city/zip/alias` — faltan `depto`, `entre calles` y `provincia`. Se agregan las 3 columnas por migración (provincia importa para envíos en Argentina; la tabla está casi vacía, es una migración barata).

- [ ] **Step 0: Migración — agregar `depto`, `entreCalles`, `provincia` a `Address`**

En `apps/api/prisma/schema.prisma`, dentro de `model Address`, junto a `floor`:

```prisma
  floor       String?
  depto       String?
  entreCalles String?  @map("entre_calles")
  provincia   String?
```

Run: `cd apps/api && npx prisma migrate dev --name add_address_depto_entrecalles_provincia`
Expected: migración aplicada, `prisma generate` corre solo. Luego actualizar `UpsertAddressDto` agregando `@IsOptional() @IsString() depto?/entreCalles?/provincia?`.

- [ ] **Step 1: Test — alta y listado, aislado por cliente**

```typescript
// apps/api/test/me-addresses.e2e-spec.ts
describe('/me/addresses', () => {
  it('crea una dirección y aparece en el listado del mismo cliente', async () => {
    const alta = await request(app.getHttpServer()).post('/api/v1/me/addresses').set(auth(customerToken)).send({
      alias: 'Casa', street: 'Falsa 123', city: 'CABA', zip: '1000', isDefault: true,
    });
    expect(alta.status).toBe(201);
    const lista = await request(app.getHttpServer()).get('/api/v1/me/addresses').set(auth(customerToken));
    expect(lista.body.some((a: any) => a.id === alta.body.id)).toBe(true);
  });

  it('un cliente no ve ni puede editar direcciones de otro cliente', async () => {
    const otra = await request(app.getHttpServer()).post('/api/v1/me/addresses').set(auth(otherCustomerToken)).send({
      street: 'Otra calle', city: 'CABA',
    });
    const editar = await request(app.getHttpServer())
      .put(`/api/v1/me/addresses/${otra.body.id}`)
      .set(auth(customerToken)) // cliente DISTINTO al dueño
      .send({ street: 'Hackeada', city: 'CABA' });
    expect(editar.status).toBe(404); // no revela que existe, mismo criterio que el resto de la API
  });

  it('marcar una dirección como default desmarca la anterior', async () => {
    const a1 = await request(app.getHttpServer()).post('/api/v1/me/addresses').set(auth(customerToken)).send({ street: 'A', city: 'CABA', isDefault: true });
    const a2 = await request(app.getHttpServer()).post('/api/v1/me/addresses').set(auth(customerToken)).send({ street: 'B', city: 'CABA', isDefault: true });
    const lista = await request(app.getHttpServer()).get('/api/v1/me/addresses').set(auth(customerToken));
    const a1Actualizada = lista.body.find((a: any) => a.id === a1.body.id);
    expect(a1Actualizada.isDefault).toBe(false);
    expect(a2.body.isDefault).toBe(true);
  });
});
```

- [ ] **Step 2: Correr → fallan** (los 4 handlers devuelven `{ message: 'not implemented' }`).

Run: `cd apps/api && npx jest --config test/jest-e2e.json me-addresses.e2e-spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `AddressesService`**

```typescript
// apps/api/src/customers/addresses.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAddressDto } from './dto/upsert-address.dto'; // confirmar el nombre real del archivo DTO

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(customerId: string) {
    return this.prisma.address.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
  }

  async create(customerId: string, dto: UpsertAddressDto) {
    if (dto.isDefault) await this.desmarcarDefaultAnterior(customerId);
    return this.prisma.address.create({ data: { customerId, ...dto } });
  }

  async update(customerId: string, id: string, dto: UpsertAddressDto) {
    await this.assertPertenece(customerId, id);
    if (dto.isDefault) await this.desmarcarDefaultAnterior(customerId);
    return this.prisma.address.update({ where: { id }, data: dto });
  }

  async remove(customerId: string, id: string) {
    await this.assertPertenece(customerId, id);
    await this.prisma.address.delete({ where: { id } });
    return { ok: true };
  }

  private async assertPertenece(customerId: string, id: string) {
    const direccion = await this.prisma.address.findFirst({ where: { id, customerId } });
    if (!direccion) throw new NotFoundException('Dirección no encontrada');
  }

  private async desmarcarDefaultAnterior(customerId: string) {
    await this.prisma.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
  }
}
```

- [ ] **Step 4: Wire del controller**

En `addresses.controller.ts`, reemplazar cada `return { message: 'not implemented' }` por la llamada al service, usando `assertCustomerContext(ctx).customerId`:

```typescript
@Get()
findAll(@CurrentUser() ctx: AuthContext) {
  const { customerId } = assertCustomerContext(ctx);
  return this.addressesService.findAll(customerId);
}
// mismo patrón para create/update/remove, pasando customerId + dto/id
```

- [ ] **Step 5: Registrar `AddressesService` en el módulo**

En `apps/api/src/customers/customers.module.ts`, agregar `AddressesService` a `providers` (y a `controllers` si `AddressesController` no estaba ya registrado ahí).

- [ ] **Step 6: Correr → pasan.** Run mismo comando del Step 2. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/customers apps/api/test/me-addresses.e2e-spec.ts
git commit -m "feat(cuenta-cliente): CRUD real de direcciones en /me/addresses (RBT-629)"
```

---

## Task 2: Datos personales + Seguridad (RBT-630 + parte de RBT-631)

**Files:**
- Create: `apps/api/src/me/me.module.ts`, `me.controller.ts`, `me.service.ts`
- Create: `apps/api/src/me/dto/update-me.dto.ts`, `apps/api/src/me/dto/change-password.dto.ts`
- Modify: `apps/api/prisma/schema.prisma` (agregar `Customer.birthDate`, `Customer.avatarUrl`)
- Modify: `apps/api/src/app.module.ts` (registrar `MeModule`)
- Test: `apps/api/test/me-profile.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `assertCustomerContext`, `argon2` (ya usado en `auth.service.ts`), `SupabaseService`/patrón de `BusinessesService.uploadToStorage()` para el avatar.
- Produces: `MeService.getProfile(customerId)`, `.updateProfile(customerId, businessId, dto)`, `.changePassword(customerId, dto)`, `.uploadAvatar(customerId, file)`.

> **Nota de RBT-630:** el campo `dni` YA existe en `Customer` (`dni String?`). `birthDate` y `avatarUrl` NO existen — hace falta una migración Prisma antes de escribir el service.

- [ ] **Step 1: Migración — agregar `birthDate` y `avatarUrl` a `Customer`**

En `apps/api/prisma/schema.prisma`, dentro de `model Customer`, agregar junto a `dni`:

```prisma
  dni       String?
  birthDate DateTime? @map("birth_date")
  avatarUrl String?   @map("avatar_url")
```

Run: `cd apps/api && npx prisma migrate dev --name add_customer_birthdate_avatar`
Expected: migración aplicada sin errores, `npx prisma generate` corre automático.

- [ ] **Step 2: Test — actualizar datos personales, email único por negocio**

```typescript
// apps/api/test/me-profile.e2e-spec.ts
it('actualiza nombre/telefono/fecha de nacimiento', async () => {
  const res = await request(app.getHttpServer()).patch('/api/v1/me').set(auth(customerToken)).send({
    firstName: 'Nuevo Nombre', phone: '+54 9 11 0000-0000', birthDate: '1995-03-20',
  });
  expect(res.status).toBe(200);
  expect(res.body.firstName).toBe('Nuevo Nombre');
});

it('cambiar el email a uno ya usado por otro cliente DEL MISMO negocio → 400', async () => {
  const res = await request(app.getHttpServer()).patch('/api/v1/me').set(auth(customerToken)).send({
    email: otherCustomerEmailSameBusiness,
  });
  expect(res.status).toBe(400);
});

it('cambiar el email a uno usado por un cliente de OTRO negocio → permitido (aislamiento por negocio)', async () => {
  const res = await request(app.getHttpServer()).patch('/api/v1/me').set(auth(customerToken)).send({
    email: customerEmailFromOtherBusinessSeed,
  });
  expect(res.status).toBe(200);
});
```

- [ ] **Step 3: Correr → fallan** (la ruta no existe todavía → 404).

Run: `cd apps/api && npx jest --config test/jest-e2e.json me-profile.e2e-spec.ts -t "actualiza nombre|cambiar el email"`
Expected: FAIL.

- [ ] **Step 4: `UpdateMeDto`**

```typescript
// apps/api/src/me/dto/update-me.dto.ts
import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateMeDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() dni?: string;
  @IsOptional() @IsDateString() birthDate?: string;
}
```

- [ ] **Step 5: `MeService.updateProfile()`**

```typescript
// apps/api/src/me/me.service.ts (fragmento)
async updateProfile(customerId: string, businessId: string, dto: UpdateMeDto) {
  if (dto.email) {
    const existente = await this.prisma.customer.findFirst({
      where: { businessId, email: dto.email, id: { not: customerId }, deletedAt: null },
    });
    if (existente) throw new BadRequestException('Ese email ya está en uso en esta tienda.');
  }
  return this.prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.email && { email: dto.email, emailVerified: false }), // cambiar email exige re-verificar, mismo criterio que el registro
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.dni !== undefined && { dni: dto.dni }),
      ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
    },
  });
}
```

- [ ] **Step 6: Wire del controller**

```typescript
// apps/api/src/me/me.controller.ts (fragmento)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Patch()
  updateProfile(@CurrentUser() ctx: AuthContext, @Body() dto: UpdateMeDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.meService.updateProfile(customerId, businessId, dto);
  }
}
```

- [ ] **Step 7: Correr → pasan.** Run mismo comando del Step 3. Expected: PASS.

- [ ] **Step 8: Test + implementación — cambio de contraseña**

```typescript
it('cambia la contraseña con la actual correcta', async () => {
  const res = await request(app.getHttpServer()).post('/api/v1/me/change-password').set(auth(customerToken)).send({
    currentPassword: 'PasswordSemilla123!', newPassword: 'NuevaPassword456!',
  });
  expect(res.status).toBe(200);
});

it('rechaza si la contraseña actual está mal', async () => {
  const res = await request(app.getHttpServer()).post('/api/v1/me/change-password').set(auth(customerToken)).send({
    currentPassword: 'Incorrecta', newPassword: 'NuevaPassword456!',
  });
  expect(res.status).toBe(401);
});
```

```typescript
// apps/api/src/me/dto/change-password.dto.ts
import { IsString, MinLength } from 'class-validator';
export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) newPassword!: string;
}
```

```typescript
// MeService (fragmento)
async changePassword(customerId: string, dto: ChangePasswordDto) {
  const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  if (!customer.passwordHash || !(await argon2.verify(customer.passwordHash, dto.currentPassword))) {
    throw new UnauthorizedException('La contraseña actual no es correcta.');
  }
  const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
  await this.prisma.customer.update({ where: { id: customerId }, data: { passwordHash } });
  return { message: 'Contraseña actualizada.' };
}
```

Run: `cd apps/api && npx jest --config test/jest-e2e.json me-profile.e2e-spec.ts`
Expected: todos PASS.

- [ ] **Step 9: Avatar — endpoint de subida**

Espejar `BusinessesService.uploadStorefrontImage()`/`uploadToStorage()` (`apps/api/src/businesses/businesses.service.ts`) para el avatar del cliente — mismo patrón (Multer `FileInterceptor`, conversión a webp, subida a Supabase Storage), pero apuntando a un bucket/carpeta de avatares y guardando la URL en `Customer.avatarUrl` en vez de `StorefrontConfig.logoUrl`.

```typescript
// me.controller.ts (fragmento)
@Post('avatar')
@UseInterceptors(FileInterceptor('file'))
uploadAvatar(@CurrentUser() ctx: AuthContext, @UploadedFile() file?: Express.Multer.File) {
  const { customerId } = assertCustomerContext(ctx);
  if (!file) throw new BadRequestException('Falta el archivo.');
  return this.meService.uploadAvatar(customerId, file);
}
```

> No dupliques la lógica de conversión/subida a ciegas: si `uploadToStorage()` de `BusinessesService` es privado, extraelo a un helper compartido (ej. `apps/api/src/supabase/storage-upload.util.ts`) reusado por ambos services — mismo criterio de refactor opcional que en el plan de cupones.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/me apps/api/prisma apps/api/test/me-profile.e2e-spec.ts apps/api/src/app.module.ts
git commit -m "feat(cuenta-cliente): datos personales, avatar y cambio de contraseña en /me (RBT-630)"
```

---

## Task 3: Sesiones activas (resto de RBT-631)

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts` (capturar `deviceInfo`, agregar `listSessions`/`revokeSession`/`revokeAllSessions`)
- Modify: `apps/api/src/auth/auth.controller.ts` (inyectar `@Req()`)
- Modify: `apps/api/src/me/me.controller.ts`, `me.module.ts` (exponer las rutas de sesiones, delegando a `AuthService`)
- Test: `apps/api/test/me-sessions.e2e-spec.ts`

**Interfaces:**
- Consumes: modelo `RefreshToken` (`deviceInfo Json?` ya existe en el schema, sin usar).
- Produces: `AuthService.createRefreshToken(userId, userType, businessId, deviceInfo?)` (firma extendida), `AuthService.listSessions(userId, userType, currentTokenHash?)`, `AuthService.revokeSession(userId, userType, sessionId)`, `AuthService.revokeAllSessions(userId, userType, exceptTokenHash?)`.

> **Decisión de diseño ya tomada por este plan (no hace falta volver a decidirla):** cada `refresh()` rota el token y crea una fila NUEVA en `refresh_tokens` (con `replacedAt` apuntando a la vieja). Listar "sesiones activas" como "todas las filas no revocadas" mostraría una fila por cada refresh silencioso del frontend, no una por dispositivo real. Para este plan, "sesión activa" = la ÚLTIMA fila de cada cadena de rotación (una fila sin que ninguna otra fila viva la haya reemplazado) — alcanza con listar filas con `revokedAt: null` y `expiresAt > now()`, porque `refresh()` ya revoca la fila vieja al rotar. No hace falta trackear una cadena explícita.

- [ ] **Step 1: Capturar `deviceInfo` al crear la sesión**

En `apps/api/src/auth/auth.service.ts`, extender la firma:

```typescript
private async createRefreshToken(
  userId: string,
  userType: 'MEMBER' | 'CUSTOMER' | 'PLATFORM_ADMIN',
  businessId: string | null,
  deviceInfo?: { userAgent?: string; ip?: string },
): Promise<string> {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = this.hashToken(rawToken);
  const days = userType === 'CUSTOMER' ? CUSTOMER_REFRESH_DAYS : MEMBER_REFRESH_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await this.prisma.refreshToken.create({
    data: { tokenHash, userId, userType, businessId, expiresAt, deviceInfo: deviceInfo ?? undefined },
  });
  return rawToken;
}
```

Y propagar `deviceInfo` desde cada llamada a `createRefreshToken` dentro de `login()`, `refresh()`, `googleLoginStorefront()`, `googleLoginApex()` — todas necesitan recibir `deviceInfo` como parámetro nuevo desde el controller.

- [ ] **Step 2: Pasar `deviceInfo` desde el controller**

En `apps/api/src/auth/auth.controller.ts`, agregar `@Req() req: Request` (de `express`) a `login` y `refresh`, y construir:

```typescript
const deviceInfo = { userAgent: req.headers['user-agent'], ip: req.ip };
```

pasándolo a `this.authService.login(dto, businessSlug, deviceInfo)` (extender también la firma de `login()`/`refresh()` en el service para aceptarlo y reenviarlo a `createRefreshToken`).

- [ ] **Step 3: Test — listar y revocar sesiones**

```typescript
// apps/api/test/me-sessions.e2e-spec.ts
it('lista las sesiones activas del cliente logueado', async () => {
  const res = await request(app.getHttpServer()).get('/api/v1/me/sessions').set(auth(customerToken));
  expect(res.status).toBe(200);
  expect(res.body.length).toBeGreaterThanOrEqual(1);
  expect(res.body[0]).toHaveProperty('deviceInfo');
  expect(res.body.some((s: any) => s.isCurrent)).toBe(true);
});

it('revoca una sesión específica (no la actual)', async () => {
  // loguearse una segunda vez para tener dos sesiones
  const segundoLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: customerEmail, password: customerPassword });
  const sesiones = await request(app.getHttpServer()).get('/api/v1/me/sessions').set(auth(customerToken));
  const otraSesion = sesiones.body.find((s: any) => !s.isCurrent);
  const revocar = await request(app.getHttpServer()).delete(`/api/v1/me/sessions/${otraSesion.id}`).set(auth(customerToken));
  expect(revocar.status).toBe(200);
  const refreshConSesionRevocada = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: segundoLogin.body.refreshToken });
  expect(refreshConSesionRevocada.status).toBe(401);
});

it('cerrar sesión en todos los dispositivos revoca todo menos, opcionalmente, la actual', async () => {
  const res = await request(app.getHttpServer()).post('/api/v1/me/sessions/revoke-all').set(auth(customerToken));
  expect(res.status).toBe(200);
});
```

- [ ] **Step 4: Correr → fallan.** Expected: FAIL (rutas no existen).

- [ ] **Step 5: Implementar en `AuthService`**

```typescript
async listSessions(userId: string, userType: 'MEMBER' | 'CUSTOMER', currentTokenHash?: string) {
  const sesiones = await this.prisma.refreshToken.findMany({
    where: { userId, userType, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  return sesiones.map((s) => ({
    id: s.id, deviceInfo: s.deviceInfo, createdAt: s.createdAt, expiresAt: s.expiresAt,
    isCurrent: currentTokenHash ? s.tokenHash === currentTokenHash : false,
  }));
}

async revokeSession(userId: string, userType: 'MEMBER' | 'CUSTOMER', sessionId: string) {
  const sesion = await this.prisma.refreshToken.findFirst({ where: { id: sessionId, userId, userType } });
  if (!sesion) throw new NotFoundException('Sesión no encontrada');
  await this.prisma.refreshToken.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  return { ok: true };
}

async revokeAllSessions(userId: string, userType: 'MEMBER' | 'CUSTOMER', exceptTokenHash?: string) {
  await this.prisma.refreshToken.updateMany({
    where: { userId, userType, revokedAt: null, ...(exceptTokenHash && { tokenHash: { not: exceptTokenHash } }) },
    data: { revokedAt: new Date() },
  });
  return { ok: true };
}
```

- [ ] **Step 6: Wire en `MeController`**

```typescript
@Get('sessions')
listSessions(@CurrentUser() ctx: AuthContext, @Req() req: Request) {
  const { customerId } = assertCustomerContext(ctx);
  const currentTokenHash = this.hashCurrentRefreshTokenFromCookie(req); // reusar el helper de lectura de cookie que ya usa el flujo de refresh
  return this.authService.listSessions(customerId, 'CUSTOMER', currentTokenHash);
}

@Delete('sessions/:id')
revokeSession(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
  const { customerId } = assertCustomerContext(ctx);
  return this.authService.revokeSession(customerId, 'CUSTOMER', id);
}

@Post('sessions/revoke-all')
revokeAll(@CurrentUser() ctx: AuthContext, @Req() req: Request) {
  const { customerId } = assertCustomerContext(ctx);
  const currentTokenHash = this.hashCurrentRefreshTokenFromCookie(req);
  return this.authService.revokeAllSessions(customerId, 'CUSTOMER', currentTokenHash);
}
```

> **Verificar antes de escribir:** cómo lee hoy el refresh token de la cookie el flujo existente (`AuthContext.tsx` bootstrap menciona una cookie httpOnly) — buscar dónde se lee esa cookie en el backend (probablemente en `auth.controller.ts::refresh()` o un middleware) y reusar exactamente esa lectura para identificar "la sesión actual", en vez de inventar un mecanismo nuevo.

- [ ] **Step 7: Correr → pasan.** Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/auth apps/api/src/me apps/api/test/me-sessions.e2e-spec.ts
git commit -m "feat(cuenta-cliente): listar y revocar sesiones activas, deviceInfo en refresh_tokens (RBT-631)"
```

---

## Task 4: Mis pedidos (RBT-628)

**Files:**
- Create: `apps/api/src/orders/customer-orders.controller.ts`
- Modify: `apps/api/src/orders/orders.module.ts` (registrar el controller nuevo)
- Test: `apps/api/test/me-orders.e2e-spec.ts`

**Interfaces:**
- Consumes: `OrdersService.findOne()` (ya existe, devuelve items/pagos/onlineOrderDetails/statusHistory), `assertCustomerContext`.
- Produces: `GET /me/orders` → lista resumida; `GET /me/orders/:id` → detalle, verificando pertenencia.

> **Antes de escribir código:** buscá si el panel ya tiene una función que mapee `OrderStatus` → etiqueta en español + color (`estadoTipo: 'success'|'warning'|'error'|'neutral'`) — es muy probable que `apps/web/src/modules/ventas/panel/pedidos/types/pedidos.types.ts` o un componente vecino ya tenga ese mapeo (aunque sea del lado del frontend). Si existe SOLO del lado del frontend, replicá el mismo criterio de mapeo del lado del backend en este nuevo endpoint (no inventes estados nuevos) — o devolvé el `status` crudo y hacé el mapeo a label/color en el hook del frontend (Task 5), que es más barato que duplicar la regla en dos lenguajes. Se recomienda esto último: el backend devuelve `status` tal cual el enum; el frontend mapea a label/color, igual que probablemente ya hace el panel.

- [ ] **Step 1: Test — listado y aislamiento**

```typescript
// apps/api/test/me-orders.e2e-spec.ts
it('lista solo los pedidos del cliente logueado, en su negocio', async () => {
  const res = await request(app.getHttpServer()).get('/api/v1/me/orders').set(auth(customerToken));
  expect(res.status).toBe(200);
  expect(res.body.data.every((o: any) => o.customerId === seedCustomerId)).toBe(true);
});

it('no puede ver el detalle de un pedido de otro cliente', async () => {
  const otroPedido = await crearPedidoParaOtroCliente(); // helper del harness, o prisma directo
  const res = await request(app.getHttpServer()).get(`/api/v1/me/orders/${otroPedido.id}`).set(auth(customerToken));
  expect(res.status).toBe(404);
});

it('trae el resumen: cantidad de pedidos y total gastado', async () => {
  const res = await request(app.getHttpServer()).get('/api/v1/me/orders').set(auth(customerToken));
  expect(res.body).toHaveProperty('resumen.cantidadPedidos');
  expect(res.body).toHaveProperty('resumen.totalGastado');
});
```

- [ ] **Step 2: Correr → fallan** (404, la ruta no existe).

- [ ] **Step 3: Implementar el controller**

```typescript
// apps/api/src/orders/customer-orders.controller.ts
@Controller('me/orders')
export class CustomerOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(@CurrentUser() ctx: AuthContext) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    const pedidos = await this.ordersService.findAllForCustomer(businessId, customerId); // método nuevo, ver Step 4
    const cantidadPedidos = pedidos.length;
    const totalGastado = pedidos.reduce((acc, p) => acc + Number(p.total), 0);
    return { data: pedidos, resumen: { cantidadPedidos, totalGastado } };
  }

  @Get(':id')
  async findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.ordersService.findOneForCustomer(businessId, customerId, id);
  }
}
```

- [ ] **Step 4: Agregar `findAllForCustomer`/`findOneForCustomer` a `OrdersService`**

```typescript
// orders.service.ts (fragmentos nuevos)
findAllForCustomer(businessId: string, customerId: string) {
  return this.prisma.order.findMany({
    where: { businessId, customerId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, orderNumber: true, status: true, total: true, createdAt: true, customerId: true },
  });
}

async findOneForCustomer(businessId: string, customerId: string, id: string) {
  const pedido = await this.prisma.order.findFirst({ where: { id, businessId, customerId } });
  if (!pedido) throw new NotFoundException('Pedido no encontrado');
  return this.findOne(businessId, id); // reusa el shape rico ya existente, ahora que se confirmó la pertenencia
}
```

- [ ] **Step 5: Registrar el controller**

En `apps/api/src/orders/orders.module.ts`, agregar `CustomerOrdersController` a `controllers` (junto al `OrdersController` existente).

- [ ] **Step 6: Correr → pasan.** Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/orders apps/api/test/me-orders.e2e-spec.ts
git commit -m "feat(cuenta-cliente): listado y detalle de mis pedidos en /me/orders (RBT-628)"
```

---

## Task 5: Frontend — rewire de `Perfil.tsx`

**Files:**
- Modify: `apps/web/src/lib/api.ts` (funciones cliente `/me/*`)
- Modify: `apps/web/src/lib/auth/AuthContext.tsx` (agregar `changePassword`, `updateProfile`, `listSessions`, `revokeSession`, `logoutAll`)
- Create: `apps/web/src/modules/ventas/cliente/perfil/hooks/useMisDirecciones.ts`, `useMisPedidos.ts`, `useDatosPersonales.ts`, `useSesiones.ts`
- Modify: `apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx` (por tab)

**Interfaces:**
- Consumes: las funciones de `lib/api.ts` de este task.
- Produces: hooks con la MISMA forma de datos que hoy consumen los tabs de `Perfil.tsx` (para minimizar el diff visual) — mapeando el shape del backend al shape que hoy tienen `Direccion`, `PedidoResumen`, `Usuario` en `apps/web/src/lib/storefront/types.ts`.

> **Antes de escribir código:** releé `Perfil.tsx` completo (427 líneas) para confirmar exactamente qué variables locales lee cada tab de `DIRECCIONES`/`HISTORIAL_MOCK`/`USUARIO_MOCK`, y reemplazalas 1 a 1 — no reescribas el JSX de los tabs, solo el origen del array/objeto.

- [ ] **Step 1: Funciones cliente en `lib/api.ts`**

```typescript
export type MeDireccion = { id: string; alias: string | null; street: string; floor: string | null; depto: string | null; entreCalles: string | null; provincia: string | null; city: string; zip: string | null; isDefault: boolean }
export function meListAddresses() { return meRequest<MeDireccion[]>('/me/addresses') }
export function meCreateAddress(input: Omit<MeDireccion, 'id'>) { return meRequest<MeDireccion>('/me/addresses', { method: 'POST', body: JSON.stringify(input) }) }
export function meUpdateAddress(id: string, input: Omit<MeDireccion, 'id'>) { return meRequest<MeDireccion>(`/me/addresses/${id}`, { method: 'PUT', body: JSON.stringify(input) }) }
export function meDeleteAddress(id: string) { return meRequest<{ ok: boolean }>(`/me/addresses/${id}`, { method: 'DELETE' }) }

export type MeOrderSummary = { id: string; orderNumber: number; status: string; total: number; createdAt: string }
export function meListOrders() { return meRequest<{ data: MeOrderSummary[]; resumen: { cantidadPedidos: number; totalGastado: number } }>('/me/orders') }

export function meUpdateProfile(input: Partial<{ firstName: string; lastName: string; email: string; phone: string; dni: string; birthDate: string }>) {
  return meRequest('/me', { method: 'PATCH', body: JSON.stringify(input) })
}
export function meChangePassword(input: { currentPassword: string; newPassword: string }) {
  return meRequest('/me/change-password', { method: 'POST', body: JSON.stringify(input) })
}
export type MeSession = { id: string; deviceInfo: { userAgent?: string; ip?: string } | null; createdAt: string; expiresAt: string; isCurrent: boolean }
export function meListSessions() { return meRequest<MeSession[]>('/me/sessions') }
export function meRevokeSession(id: string) { return meRequest<{ ok: boolean }>(`/me/sessions/${id}`, { method: 'DELETE' }) }
export function meRevokeAllSessions() { return meRequest<{ ok: boolean }>('/me/sessions/revoke-all', { method: 'POST' }) }
```

(`meRequest` es un helper análogo a `panelRequest` ya existente en el mismo archivo — mismo criterio de manejo de `ApiError`, credenciales/cookies incluidas.)

- [ ] **Step 2: Hooks de TanStack Query**

```typescript
// apps/web/src/modules/ventas/cliente/perfil/hooks/useMisDirecciones.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { meListAddresses, meCreateAddress, meUpdateAddress, meDeleteAddress } from '@/lib/api'

export function useMisDirecciones() {
  return useQuery({ queryKey: ['me', 'addresses'], queryFn: meListAddresses })
}
export function useCrearDireccion() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: meCreateAddress, onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'addresses'] }) })
}
// useEditarDireccion / useEliminarDireccion: mismo patrón (mutation + invalidate)
```

Repetir el mismo patrón (`useQuery` + `useMutation` + invalidate) para `useMisPedidos.ts`, `useDatosPersonales.ts` (usa `AuthContext.updateProfile`, no un hook propio, porque el perfil ya vive en el `user` del contexto), `useSesiones.ts`.

- [ ] **Step 3: Extender `AuthContext.tsx`**

Agregar a `AuthContextValue` y su implementación (mismo patrón `fetch` a `/api/auth/*` que ya usan `login`/`register`):

```typescript
changePassword: (currentPassword: string, newPassword: string) => Promise<void>
updateProfile: (input: Partial<AuthUser['customer']>) => Promise<void>
listSessions: () => Promise<MeSession[]>
revokeSession: (id: string) => Promise<void>
logoutAll: () => Promise<void>
```

- [ ] **Step 4: Rewire tab por tab en `Perfil.tsx`**

- `pedidos`: `HISTORIAL_MOCK.map(...)` → `useMisPedidos().data?.data.map(...)`, mapeando `status` (enum backend) a la misma etiqueta/color que hoy usa `estadoTipo` (definir la función de mapeo una sola vez, ej. en `apps/web/src/modules/ventas/cliente/perfil/estadoPedido.ts`).
- `direcciones`: `DIRECCIONES.map(...)` → `useMisDirecciones().data`; el botón "Editar" (hoy sin `onClick`) pasa a abrir el mismo form de alta pre-cargado, llamando a `useEditarDireccion`; `handleGuardarDir` deja de ser un `setTimeout` fake y llama a `useCrearDireccion().mutate(...)`.
- `datos`: `USUARIO_MOCK` → `useAuth().user` (tipo `customer`); `handleGuardarDatos` llama a `useAuth().updateProfile(...)`. El input de avatar pasa a subir el archivo real vía un nuevo `meUploadAvatar` (multipart, análogo al patrón de subida de imagen del panel).
- `seguridad`: el botón "Actualizar contraseña" (hoy sin `onClick`) pasa a llamar a `useAuth().changePassword(...)`; la tabla hardcodeada de "Sesión activa" pasa a `useSesiones().data`, mostrando cada fila con su `deviceInfo`/`isCurrent`, con un botón "Cerrar" por fila que llama a `useAuth().revokeSession(id)`; "Cerrar sesión en todos los dispositivos" pasa a llamar a `useAuth().logoutAll()` en vez de solo redirigir.
- **Bug de paso, ya detectado en la investigación previa:** tanto el botón de "Cerrar sesión" del sidebar como el de "seguridad" hoy solo hacen `router.push('${base}/login')` sin invalidar la sesión real — al tocar este tab, cambiarlos para llamar a `useAuth().logout()` (el sidebar) y a `logoutAll()` (seguridad) ANTES de redirigir.

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 6: Verificación en navegador**

Seguir el workflow de preview: levantar el dev server, loguearse como un cliente de storefront (seed existente), navegar a `/tienda/{slug}/perfil`, probar cada tab (alta de dirección, edición de datos, cambio de contraseña, ver sesiones, cerrar sesión), confirmar sin errores de consola.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib apps/web/src/modules/ventas/cliente/perfil
git commit -m "feat(cuenta-cliente): conectar Perfil.tsx a los endpoints reales de /me (RBT-628/629/630/631)"
```

---

## Self-Review

**Spec coverage:**
- ✅ RBT-628 (Mis pedidos: listar + detalle + resumen) → Task 4.
- ✅ RBT-629 (Direcciones: alta/edición/baja, usadas en checkout vía `shippingAddressId` que ya existe) → Task 1.
- ✅ RBT-630 (Datos personales: nombre/apellido/email único/teléfono/fecha nacimiento/DNI/foto) → Task 2.
- ✅ RBT-631 (Cambio de contraseña, sesiones activas con dispositivo/IP/última actividad, cerrar sesión actual y todas, metadata de sesión en Auth base) → Task 2 (password) + Task 3 (sesiones).
- ✅ Aislamiento multi-tenant explícito en cada task (Global Constraints + tests de "no ve datos de otro cliente").

**Placeholder scan:** ningún paso deja "TODO"/"manejar errores acá" sin código. Las notas "verificar antes de escribir" apuntan a confirmar nombres exactos contra archivos reales (riesgo real de una plan basada en exploración resumida), no a lógica sin definir.

**Type consistency:** `MeDireccion`/`MeOrderSummary`/`MeSession` se usan con el mismo nombre en Task 5 que en los DTOs de Tasks 1/3/4. `assertCustomerContext` se usa igual en las 4 tasks backend.

**Riesgos / decisiones para revisar:**
1. **Migración de `Customer.birthDate`/`avatarUrl`** (Task 2) toca una tabla en producción con datos reales — correr primero en un entorno de desarrollo/staging antes de aplicar contra la base compartida de Supabase que se mencionó en la conversación de mail (`DATABASE_URL` apunta a un pooler compartido).
2. **"Sesión actual" requiere leer la cookie de refresh token** (Task 3, Step 6) — el mecanismo exacto de esa cookie no se confirmó en la investigación previa; hay que leerlo directamente de `auth.controller.ts`/middleware antes de escribir el helper.
3. **Orden de ejecución sugerido:** Task 1 y Task 4 son las más aisladas y rápidas (direcciones y pedidos, sin tocar Auth). Task 2 y 3 tocan `AuthService`/schema — más riesgo, conviene hacerlas después con más tiempo de revisión. Task 5 depende de que 1-4 estén mergeadas.
