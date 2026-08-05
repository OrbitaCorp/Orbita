# Cupones CRUD (RBT-615) + Servicio de Métricas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el backend de cupones (crear/editar/eliminar/activar, listado scopeado por negocio) y el servicio de métricas de descuentos/cupones, y conectar el frontend del panel (hoy 100% mock) a esos endpoints reales.

**Architecture:** Cupones y descuentos comparten la tabla `discounts` (Prisma model `Discount`): un descuento tiene `code = null`, un cupón `code != null`. Se crea un **módulo `coupons` dedicado** (controller + service + DTOs) que consulta esa tabla con `code: { not: null }`, en espejo del `DiscountsService` existente (que filtra `code: null`). Las **métricas** se implementan en el `DiscountsService`/controller ya existente (la ruta `GET /discounts/metrics` ya está como stub) agregando sobre `DiscountRedemption`. El frontend gana un adaptador ES↔EN (`couponApi.ts`) y funciones cliente en `lib/api.ts`, igual que se hizo con descuentos (`discountApi.ts`).

**Tech Stack:** NestJS + Prisma (Postgres/Supabase) en `apps/api`; Next.js Pages Router + TanStack Query en `apps/web`. Tests e2e con Jest + Supertest contra la DB de dev compartida.

## Global Constraints

- **Aislamiento por negocio (RF-15):** TODA query de cupones y métricas filtra por `businessId` del contexto de sesión (`assertMemberContext(ctx)`), nunca por id "a ciegas". Un cupón/descuento nunca puede leer/tocar datos de otro negocio.
- **Cupones = `code != null`; descuentos = `code = null`.** Ambos en la tabla `discounts`. Ningún query de cupones puede devolver descuentos ni viceversa.
- **Código único por negocio:** el schema ya tiene `@@unique([businessId, code])`. Además validar en el service para devolver un 400 legible antes de que salte el error de Prisma.
- **Soft-delete:** borrar = `deletedAt = now()` + `isActive = false` (un cupón pudo aplicarse a ventas históricas vía `DiscountRedemption`). Nunca `delete` físico.
- **Solo los 4 tipos triviales de V1** (`PERCENT_PRODUCT`, `AMOUNT_PRODUCT`, `PERCENT_TICKET`, `AMOUNT_TICKET`). Cupones no tiene tipos avanzados.
- **Reglas de código frontend (heredadas):** archivos < 300 líneas, named exports, tokens `var(--color-*)` nunca hex, sin Zustand, server-state en TanStack Query. La interfaz de cada hook NO cambia (los componentes que los consumen no se tocan salvo `CuponesCrear` para el manejo de error).
- **ValidationPipe global:** `whitelist: true, transform: true` (sin `forbidNonWhitelisted`). Campos de más en el request se descartan en silencio.
- **`code` en el commit final:** commits en `main` (el equipo trabaja directo sobre main y prueba en producción). Mensajes en español, en minúscula, con el trailer `Co-Authored-By`.

---

## File Structure

**Backend — nuevo módulo `coupons`:**
- `apps/api/src/coupons/dto/upsert-coupon.dto.ts` — DTO de alta/edición de cupón.
- `apps/api/src/coupons/dto/find-coupons-query.dto.ts` — DTO de filtros del listado.
- `apps/api/src/coupons/coupons.service.ts` — CRUD sobre `discounts` con `code != null`.
- `apps/api/src/coupons/coupons.controller.ts` — endpoints REST `/coupons`.
- `apps/api/src/coupons/coupons.module.ts` — módulo Nest.
- `apps/api/src/app.module.ts` — registrar `CouponsModule` (modificar).
- `apps/api/test/coupons.e2e-spec.ts` — e2e del CRUD de cupones.

**Backend — métricas (en el módulo `discounts` existente):**
- `apps/api/src/discounts/dto/metrics-query.dto.ts` — DTO de filtros de métricas.
- `apps/api/src/discounts/discounts-metrics.service.ts` — servicio de agregación sobre `DiscountRedemption`.
- `apps/api/src/discounts/discounts.controller.ts` — reemplazar el stub `metrics()` (modificar).
- `apps/api/src/discounts/discounts.module.ts` — proveer `DiscountsMetricsService` (modificar).
- `apps/api/test/discounts-metrics.e2e-spec.ts` — e2e de métricas.

**Frontend:**
- `apps/web/src/lib/api.ts` — funciones cliente de cupones y métricas (modificar).
- `apps/web/src/modules/ventas/panel/descuentos/hooks/couponApi.ts` — adaptador ES↔EN de cupones (crear).
- `apps/web/src/modules/ventas/panel/descuentos/hooks/useCupones.ts` — rewire a API real (modificar).
- `.../hooks/useCupon.ts`, `useCrearCupon.ts`, `useEditarCupon.ts`, `useToggleCupon.ts`, `useEliminarCupon.ts` — rewire (modificar).
- `.../hooks/useMetricas.ts` — rewire a `/discounts/metrics` (modificar).
- `.../CuponesCrear.tsx` — ya tiene el manejo de error (hecho en commit previo); solo se verifica que el mensaje del backend llegue.

**Fuera de alcance (quedan mock/stub, se documentan en PENDIENTES):**
- `useDuplicarCupon`, `useDuplicarDescuento` — el backend no implementa `duplicar`.
- `useMetricasDetalle`, `useAuditoria` — endpoints `/:id/metrics` y `/:id/audit` siguen stub.
- `useToggleLink`, `useEnviarLinkEmail` (link compartible / envío por email) — `setLink`/`sendLink` siguen stub. El estado del link (`linkActive`/`linkRedirect`) SÍ se persiste vía el upsert de cupón (son columnas de `Discount`).
- **Canje real (RBT-616):** `validate`/`apply` y la escritura de `DiscountRedemption` al confirmar la orden. Sin esto, las métricas devuelven todo en cero (correcto, no es bug).

---

## Nota sobre "datos reales" en métricas

`DiscountRedemption` se puebla al confirmar una venta con descuento (RBT-616 + checkout del storefront), que **hoy es un stub**. Por lo tanto, con datos reales, el endpoint de métricas va a devolver un `MetricasResumen` **todo en cero / arrays vacíos**. Eso es lo correcto y lo que el usuario aceptó explícitamente: la pantalla deja de leer un mock inventado y pasa a leer la base (vacía). Los tests e2e siembran una `DiscountRedemption` a mano (vía `PrismaService`) para verificar que la agregación es correcta cuando SÍ hay datos.

---

## Task A1: DTOs de cupones

**Files:**
- Create: `apps/api/src/coupons/dto/upsert-coupon.dto.ts`
- Create: `apps/api/src/coupons/dto/find-coupons-query.dto.ts`

**Interfaces:**
- Produces: `UpsertCouponDto` (campos: `code`, `name`, `type`, `value`, `scope`, `productLevel?`, `minAmount?`, `maxUsesTotal?`, `maxUsesPerCustomer?`, `isPrivate?`, `startDate`, `endDate?`, `linkActive?`, `linkRedirect?`, `productIds?`, `categoryIds?`).
- Produces: `FindCouponsQueryDto` (campos: `status?`, `type?`, `search?`, `page?`, `limit?`).

- [ ] **Step 1: Escribir `UpsertCouponDto`**

```typescript
import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsArray, IsIn, Min } from 'class-validator';

export class UpsertCouponDto {
  @IsString() code!: string; // requerido (a diferencia de descuentos)
  @IsString() name!: string;
  @IsIn(['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET']) type!: string;
  @IsNumber() value!: number;
  @IsIn(['PRODUCT', 'CATEGORY', 'TICKET']) scope!: string;
  @IsOptional() @IsIn(['padre', 'variante']) productLevel?: string;
  @IsOptional() @IsNumber() minAmount?: number;
  @IsOptional() @IsInt() @Min(1) maxUsesTotal?: number;
  @IsOptional() @IsInt() @Min(1) maxUsesPerCustomer?: number;
  @IsOptional() @IsBoolean() isPrivate?: boolean;
  @IsString() startDate!: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsBoolean() linkActive?: boolean;
  @IsOptional() @IsString() linkRedirect?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) productIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) categoryIds?: string[];
}
```

- [ ] **Step 2: Escribir `FindCouponsQueryDto`**

```typescript
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// El estado (activo/inactivo/programado/expirado/agotado) se deriva al leer, no
// es columna. 'agotado' NO es filtrable en SQL (requiere comparar dos columnas)
// — mismo criterio que descuentos, ver find-discounts-query.dto.ts.
export class FindCouponsQueryDto {
  @IsOptional() @IsIn(['activo', 'inactivo', 'programado', 'expirado']) status?: string;
  @IsOptional() @IsIn(['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET']) type?: string;
  @IsOptional() @IsString() search?: string; // busca en name Y code
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/coupons/dto
git commit -m "feat(cupones): DTOs de alta/edicion y filtros del listado"
```

---

## Task A2: CouponsService — findAll + findOne

**Files:**
- Create: `apps/api/src/coupons/coupons.service.ts`
- Test: `apps/api/test/coupons.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `FindCouponsQueryDto`.
- Produces: `CouponsService.findAll(businessId: string, q: FindCouponsQueryDto)` → `{ data: CouponRow[]; total: number; page: number; limit: number }`; `CouponsService.findOne(businessId: string, id: string)` → `CouponDetail`.
- Donde `CouponRow` incluye: `id, code, name, type, value, scope, alcanceResumen, startDate, endDate, maxUsesTotal, maxUsesPerCustomer, usesConsumed, isPrivate, isActive, estado, linkActive, createdAt`. `CouponDetail` agrega: `productLevel, minAmount, linkRedirect, productIds, categoryIds, createdBy, updatedAt`.

> **Patrón a espejar:** `apps/api/src/discounts/discounts.service.ts` — copiá `estadoDe()`, `whereDeEstado()` y `resumenesDeAlcance()` tal cual (son idénticos para cupones), cambiando solo el filtro base a `code: { not: null }`. NO dupliques a ciegas: si querés, extraé esos 3 helpers a un util compartido `apps/api/src/discounts/discount-status.util.ts` y reusalo en ambos services (refactor opcional, mismo comportamiento).

- [ ] **Step 1: Escribir el test de listado por negocio**

```typescript
// En apps/api/test/coupons.e2e-spec.ts, dentro del describe principal.
// (Reutilizá el harness de discounts.e2e-spec.ts: bootstrap de app, auth(ownerToken),
//  PREFIJO para limpieza, y el afterAll que borra por name startsWith PREFIJO.)
it('lista solo cupones (code != null) del negocio, no descuentos', async () => {
  // Alta de un cupón
  await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
    code: `${PREFIJO}-BIENVENIDO`, name: `${PREFIJO} bienvenida`, type: 'PERCENT_TICKET',
    value: 10, scope: 'TICKET', startDate: new Date(Date.now() - 86400000).toISOString(),
  });
  const res = await request(app.getHttpServer()).get('/api/v1/coupons').set(auth(ownerToken));
  expect(res.status).toBe(200);
  expect(res.body.data.every((c: any) => c.code !== null)).toBe(true);
  expect(res.body.data.some((c: any) => c.code === `${PREFIJO}-BIENVENIDO`)).toBe(true);
});
```

- [ ] **Step 2: Correr el test → falla**

Run: `cd apps/api && npx jest --config test/jest-e2e.json coupons.e2e-spec.ts -t "lista solo cupones"`
Expected: FAIL (404 — la ruta `/coupons` todavía no existe).

- [ ] **Step 3: Implementar `findAll` + `findOne`**

Espejar `DiscountsService.findAll/findOne`, con estas diferencias exactas:
- `where` base: `{ businessId, code: { not: null }, deletedAt: null }`.
- `search` filtra por `OR: [{ name: { contains, mode: 'insensitive' } }, { code: { contains, mode: 'insensitive' } }]`.
- El shape de `data` incluye `code`, `isPrivate`, `maxUsesPerCustomer`, `linkActive` (además de los campos comunes). `findOne` agrega `linkRedirect`, `productIds`, `categoryIds`.

```typescript
// Firma y esqueleto (el cuerpo de mapeo espeja discounts.service.ts):
async findAll(businessId: string, q: FindCouponsQueryDto) {
  const page = q.page ?? 1; const limit = q.limit ?? 20; const now = new Date();
  const where: Prisma.DiscountWhereInput = { businessId, code: { not: null }, deletedAt: null };
  if (q.type) where.type = q.type as Prisma.DiscountWhereInput['type'];
  if (q.search) where.OR = [
    { name: { contains: q.search, mode: 'insensitive' } },
    { code: { contains: q.search, mode: 'insensitive' } },
  ];
  if (q.status) Object.assign(where, this.whereDeEstado(q.status as EstadoCupon, now));
  const [rows, total] = await this.prisma.$transaction([
    this.prisma.discount.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { products: true, categories: true } }),
    this.prisma.discount.count({ where }),
  ]);
  const resumenes = await this.resumenesDeAlcance(businessId, rows);
  return {
    data: rows.map((d) => ({
      id: d.id, code: d.code, name: d.name, type: d.type, value: Number(d.value), scope: d.scope,
      alcanceResumen: resumenes.get(d.id) ?? '', startDate: d.startDate, endDate: d.endDate,
      maxUsesTotal: d.maxUsesTotal, maxUsesPerCustomer: d.maxUsesPerCustomer, usesConsumed: d.usesConsumed,
      isPrivate: d.isPrivate, isActive: d.isActive, estado: this.estadoDe(d, now),
      linkActive: d.linkActive, createdAt: d.createdAt,
    })),
    total, page, limit,
  };
}
```

- [ ] **Step 4: Registrar la ruta (adelanto mínimo de A5 para poder testear)**

Crear un `coupons.controller.ts` mínimo con solo `@Get()` → `findAll` y `@Get(':id')` → `findOne`, y `coupons.module.ts`, y registrarlo en `app.module.ts`. (El resto de endpoints se agregan en A5; se adelanta lo mínimo para que el test de A2 pase.)

- [ ] **Step 5: Correr el test → pasa**

Run: `cd apps/api && npx jest --config test/jest-e2e.json coupons.e2e-spec.ts -t "lista solo cupones"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/coupons apps/api/src/app.module.ts apps/api/test/coupons.e2e-spec.ts
git commit -m "feat(cupones): listado y detalle scopeados por negocio (code != null)"
```

---

## Task A3: CouponsService — create + update (código único + validaciones)

**Files:**
- Modify: `apps/api/src/coupons/coupons.service.ts`
- Test: `apps/api/test/coupons.e2e-spec.ts`

**Interfaces:**
- Produces: `CouponsService.create(businessId, memberId, dto: UpsertCouponDto)` → `CouponDetail`; `CouponsService.update(businessId, id, dto)` → `CouponDetail`.

- [ ] **Step 1: Tests de create (código único + pertenencia)**

```typescript
it('crea un cupón y aparece en el detalle', async () => {
  const res = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
    code: `${PREFIJO}-X10`, name: `${PREFIJO} x10`, type: 'PERCENT_TICKET', value: 10,
    scope: 'TICKET', startDate: new Date(Date.now() - 86400000).toISOString(), maxUsesPerCustomer: 1,
  });
  expect(res.status).toBe(201);
  expect(res.body.code).toBe(`${PREFIJO}-X10`);
  expect(res.body.maxUsesPerCustomer).toBe(1);
});

it('código repetido en el mismo negocio → 400', async () => {
  const body = { code: `${PREFIJO}-DUP`, name: `${PREFIJO} dup`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET', startDate: new Date(Date.now() - 86400000).toISOString() };
  await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send(body);
  const dup = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({ ...body, name: `${PREFIJO} dup 2` });
  expect(dup.status).toBe(400);
});
```

- [ ] **Step 2: Correr → fallan** (405/404 o 201 en el dup). Run: `npx jest --config test/jest-e2e.json coupons.e2e-spec.ts -t "crea un cupón|código repetido"`. Expected: FAIL.

- [ ] **Step 3: Implementar `create` + `update` + helpers de validación**

- `validarReglas(dto)`: espejar `DiscountsService.validarReglas` (rangos de value según porcentaje/monto; coherencia scope↔productIds/categoryIds; `productLevel` requerido si scope=PRODUCT; endDate > startDate).
- `validarPertenencia(businessId, dto)`: espejar el de descuentos (productos/categorías del negocio).
- **Nuevo — código único:** antes de crear, `findFirst({ where: { businessId, code: dto.code, deletedAt: null } })` → si existe, `throw new BadRequestException('Ya existe un cupón con ese código.')`. En `update`, el mismo check con `id: { not: id }`.
- `datosDe(dto)`: como el de descuentos PERO seteando `code: dto.code`, `isPrivate: dto.isPrivate ?? false`, `linkActive: dto.linkActive ?? false`, `linkRedirect: dto.linkRedirect ?? null`, `maxUsesPerCustomer: dto.maxUsesPerCustomer ?? null`, `application: 'MANUAL'` (los cupones se aplican por código, no automáticamente — el motor los excluye via `code: null` + `application: AUTOMATIC`).
- `create` y `update` usan `$transaction` para reemplazar `discountProduct`/`discountCategory`, idéntico a descuentos.

```typescript
async create(businessId: string, memberId: string, dto: UpsertCouponDto) {
  this.validarReglas(dto);
  await this.validarPertenencia(businessId, dto);
  const dupNombre = await this.prisma.discount.findFirst({ where: { businessId, code: { not: null }, name: dto.name, deletedAt: null } });
  if (dupNombre) throw new BadRequestException('Ya existe un cupón con ese nombre.');
  const dupCodigo = await this.prisma.discount.findFirst({ where: { businessId, code: dto.code, deletedAt: null } });
  if (dupCodigo) throw new BadRequestException('Ya existe un cupón con ese código.');
  const creado = await this.prisma.$transaction(async (tx) => {
    const c = await tx.discount.create({ data: { businessId, ...this.datosDe(dto), createdBy: memberId } });
    if (dto.productIds?.length) await tx.discountProduct.createMany({ data: dto.productIds.map((productId) => ({ discountId: c.id, productId })) });
    if (dto.categoryIds?.length) await tx.discountCategory.createMany({ data: dto.categoryIds.map((categoryId) => ({ discountId: c.id, categoryId })) });
    return c;
  });
  return this.findOne(businessId, creado.id);
}
```

- [ ] **Step 4: Wire de rutas** (adelanto de A5): agregar `@Post()` y `@Put(':id')` al controller.

- [ ] **Step 5: Correr → pasan.** Run mismo `-t`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/coupons apps/api/test/coupons.e2e-spec.ts
git commit -m "feat(cupones): alta y edicion con codigo unico por negocio (RF-11/RF-15)"
```

---

## Task A4: CouponsService — toggle + remove

**Files:**
- Modify: `apps/api/src/coupons/coupons.service.ts`
- Test: `apps/api/test/coupons.e2e-spec.ts`

**Interfaces:**
- Produces: `CouponsService.toggle(businessId, id)` → `CouponDetail`; `CouponsService.remove(businessId, id)` → `{ ok: true }`.

- [ ] **Step 1: Tests toggle + baja**

```typescript
it('toggle invierte isActive y el estado', async () => {
  const c = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({ code: `${PREFIJO}-TG`, name: `${PREFIJO} tg`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET', startDate: new Date(Date.now() - 86400000).toISOString() });
  const off = await request(app.getHttpServer()).patch(`/api/v1/coupons/${c.body.id}/toggle`).set(auth(ownerToken));
  expect(off.body.estado).toBe('inactivo');
});

it('baja: soft-delete, deja de aparecer en el listado', async () => {
  const c = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({ code: `${PREFIJO}-DEL`, name: `${PREFIJO} del`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET', startDate: new Date(Date.now() - 86400000).toISOString() });
  await request(app.getHttpServer()).delete(`/api/v1/coupons/${c.body.id}`).set(auth(ownerToken));
  const list = await request(app.getHttpServer()).get('/api/v1/coupons').set(auth(ownerToken));
  expect(list.body.data.some((x: any) => x.id === c.body.id)).toBe(false);
});
```

- [ ] **Step 2: Correr → fallan.** Expected: FAIL (404 en toggle/delete).

- [ ] **Step 3: Implementar `toggle` + `remove`** espejando `DiscountsService.toggle/remove` con el filtro `code: { not: null }`:

```typescript
async remove(businessId: string, id: string) {
  const existente = await this.prisma.discount.findFirst({ where: { id, businessId, code: { not: null }, deletedAt: null }, select: { id: true } });
  if (!existente) throw new NotFoundException('Cupón no encontrado');
  await this.prisma.discount.updateMany({ where: { id, businessId }, data: { deletedAt: new Date(), isActive: false } });
  return { ok: true };
}
```

- [ ] **Step 4: Wire de rutas** (adelanto A5): `@Patch(':id/toggle')`, `@Delete(':id')`.

- [ ] **Step 5: Correr → pasan.** Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(cupones): activar/desactivar y baja (soft-delete)"
```

---

## Task A5: CouponsController + módulo completos

**Files:**
- Modify: `apps/api/src/coupons/coupons.controller.ts` (consolidar todos los endpoints)
- Modify: `apps/api/src/coupons/coupons.module.ts`
- Verify: `apps/api/src/app.module.ts` (import de `CouponsModule`)

**Interfaces:**
- Produces: rutas REST bajo `/coupons`: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PATCH /:id/toggle`, `DELETE /:id`.

> **Patrón a espejar:** `discounts.controller.ts`. Usar `@CurrentBusiness() ctx: AuthContext` + `const member = assertMemberContext(ctx)` en cada handler, y `@Roles('owner', 'admin')` en create/update/toggle/remove (igual que descuentos).

- [ ] **Step 1: Consolidar el controller**

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { CouponsService } from './coupons.service';
import { UpsertCouponDto } from './dto/upsert-coupon.dto';
import { FindCouponsQueryDto } from './dto/find-coupons-query.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindCouponsQueryDto) {
    const m = assertMemberContext(ctx);
    return this.couponsService.findAll(m.businessId, query);
  }

  @Get(':id')
  findOne(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const m = assertMemberContext(ctx);
    return this.couponsService.findOne(m.businessId, id);
  }

  @Post()
  @Roles('owner', 'admin')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertCouponDto) {
    const m = assertMemberContext(ctx);
    return this.couponsService.create(m.businessId, m.memberId, dto);
  }

  @Put(':id')
  @Roles('owner', 'admin')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertCouponDto) {
    const m = assertMemberContext(ctx);
    return this.couponsService.update(m.businessId, id, dto);
  }

  @Patch(':id/toggle')
  @Roles('owner', 'admin')
  toggle(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const m = assertMemberContext(ctx);
    return this.couponsService.toggle(m.businessId, id);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const m = assertMemberContext(ctx);
    return this.couponsService.remove(m.businessId, id);
  }
}
```

- [ ] **Step 2: Módulo + registro**

```typescript
// coupons.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module'; // confirmar el path real (ver discounts.module.ts)
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({ imports: [PrismaModule], controllers: [CouponsController], providers: [CouponsService] })
export class CouponsModule {}
```
En `app.module.ts`: agregar `CouponsModule` al array `imports` (espejar cómo está `DiscountsModule`).

- [ ] **Step 3: Correr TODA la suite de cupones**

Run: `cd apps/api && npx jest --config test/jest-e2e.json coupons.e2e-spec.ts`
Expected: PASS (todos los tests de A2–A4).

- [ ] **Step 4: Test de aislamiento entre negocios**

```typescript
it('un member de otro negocio no ve estos cupones', async () => {
  // Usar el segundo negocio del seed (auth(otherOwnerToken) si el harness lo expone).
  // Si el seed no tiene un 2º negocio con owner, este test se documenta como pendiente
  // y se cubre manualmente. Asegurar al menos que GET /coupons con otro businessId
  // no devuelve los códigos con PREFIJO de este negocio.
  const res = await request(app.getHttpServer()).get('/api/v1/coupons').set(auth(otherOwnerToken));
  expect(res.body.data.some((c: any) => String(c.code).startsWith(PREFIJO))).toBe(false);
});
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(cupones): controller + modulo REST /coupons registrado en AppModule"
```

---

## Task A6: Frontend — funciones cliente de cupones en `lib/api.ts`

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Produces: tipos `ApiCouponType`, `ApiCouponScope`, `ApiCouponEstado`, `ApiCouponRow`, `ApiCouponDetail`, `ApiUpsertCouponInput`, `CouponListFilters`; funciones `panelListCoupons`, `panelGetCoupon`, `panelCreateCoupon`, `panelUpdateCoupon`, `panelToggleCoupon`, `panelDeleteCoupon`.

> **Patrón a espejar:** el bloque `panelListDiscounts`/`panelGetDiscount`/... que ya existe en `lib/api.ts` (agregado para descuentos). Copiar la estructura cambiando `discount`→`coupon`, ruta `/discounts`→`/coupons`, y agregando los campos de cupón (`code`, `isPrivate`, `maxUsesPerCustomer`, `linkActive`, `linkRedirect`).

- [ ] **Step 1: Agregar tipos + funciones al final de `lib/api.ts`**

```typescript
export type ApiCouponType = 'PERCENT_PRODUCT' | 'AMOUNT_PRODUCT' | 'PERCENT_TICKET' | 'AMOUNT_TICKET'
export type ApiCouponScope = 'PRODUCT' | 'CATEGORY' | 'TICKET'
export type ApiCouponEstado = 'activo' | 'inactivo' | 'programado' | 'expirado' | 'agotado'

export type ApiCouponRow = {
  id: string; code: string; name: string; type: ApiCouponType; value: number; scope: ApiCouponScope
  alcanceResumen: string; startDate: string; endDate: string | null
  maxUsesTotal: number | null; maxUsesPerCustomer: number | null; usesConsumed: number
  isPrivate: boolean; isActive: boolean; estado: ApiCouponEstado; linkActive: boolean; createdAt: string
}
export type ApiCouponDetail = ApiCouponRow & {
  productLevel: 'padre' | 'variante' | null; minAmount: number | null
  linkRedirect: string | null; productIds: string[]; categoryIds: string[]; createdBy: string; updatedAt: string
}
export type ApiUpsertCouponInput = {
  code: string; name: string; type: ApiCouponType; value: number; scope: ApiCouponScope
  productLevel?: 'padre' | 'variante'; minAmount?: number
  maxUsesTotal?: number; maxUsesPerCustomer?: number; isPrivate?: boolean
  startDate: string; endDate?: string; linkActive?: boolean; linkRedirect?: string
  productIds?: string[]; categoryIds?: string[]
}
export type CouponListFilters = {
  status?: Exclude<ApiCouponEstado, 'agotado'>; type?: ApiCouponType; search?: string; page?: number; limit?: number
}

export function panelListCoupons(filters: CouponListFilters = {}) {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.type) qs.set('type', filters.type)
  if (filters.search) qs.set('search', filters.search)
  if (filters.page) qs.set('page', String(filters.page))
  if (filters.limit) qs.set('limit', String(filters.limit))
  const query = qs.toString()
  return panelRequest<{ data: ApiCouponRow[]; total: number; page: number; limit: number }>(`/coupons${query ? `?${query}` : ''}`)
}
export function panelGetCoupon(id: string) { return panelRequest<ApiCouponDetail>(`/coupons/${id}`) }
export function panelCreateCoupon(input: ApiUpsertCouponInput) { return panelRequest<ApiCouponDetail>('/coupons', { method: 'POST', body: JSON.stringify(input) }) }
export function panelUpdateCoupon(id: string, input: ApiUpsertCouponInput) { return panelRequest<ApiCouponDetail>(`/coupons/${id}`, { method: 'PUT', body: JSON.stringify(input) }) }
export function panelToggleCoupon(id: string) { return panelRequest<ApiCouponDetail>(`/coupons/${id}/toggle`, { method: 'PATCH' }) }
export function panelDeleteCoupon(id: string) { return panelRequest<{ ok: boolean }>(`/coupons/${id}`, { method: 'DELETE' }) }
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(cupones): cliente API del panel para /coupons"
```

---

## Task A7: Frontend — adaptador `couponApi.ts` + rewire de los 6 hooks

**Files:**
- Create: `apps/web/src/modules/ventas/panel/descuentos/hooks/couponApi.ts`
- Modify: `useCupones.ts`, `useCupon.ts`, `useCrearCupon.ts`, `useEditarCupon.ts`, `useToggleCupon.ts`, `useEliminarCupon.ts`

**Interfaces:**
- Consumes: funciones de A6, tipo `Cupon` (`types/cupones.ts`), `TipoCupon`, `AlcanceDescuento`.
- Produces: `filaApiACupon(row): Cupon`, `detalleApiACupon(detail): Cupon`, `cuponInputAApi(input): ApiUpsertCouponInput`, `tipoCuponFiltroEsSoportado`, y helpers de mapeo tipo↔(TipoCupon×alcance).

> **Patrón a espejar:** `hooks/discountApi.ts`. Diferencia clave del tipo de cupón: el backend usa `DiscountType` (PERCENT_/AMOUNT_ × PRODUCT/TICKET) mientras el frontend usa `TipoCupon` = `'porcentaje' | 'monto_fijo'` combinado con `alcance`. Mapeo:
> - `porcentaje` + `ticket` → `PERCENT_TICKET`; `porcentaje` + (`producto`|`categoria`) → `PERCENT_PRODUCT`
> - `monto_fijo` + `ticket` → `AMOUNT_TICKET`; `monto_fijo` + (`producto`|`categoria`) → `AMOUNT_PRODUCT`
> - inverso: `PERCENT_*` → `porcentaje`, `AMOUNT_*` → `monto_fijo`; `*_TICKET` → alcance `ticket`, `*_PRODUCT`/`*_CATEGORY` → alcance según `scope`.
> `scope`: `ticket`→TICKET, `categoria`→CATEGORY, `producto`→PRODUCT.

- [ ] **Step 1: Escribir `couponApi.ts`** con los 3 mappers y el guard. Campos a mapear en `filaApiACupon`: `codigo=code`, `tipoDescuento=API→TipoCupon`, `alcance=scope→AlcanceDescuento`, `usosMaxTotal=maxUsesTotal`, `usosMaxPorCliente=maxUsesPerCustomer`, `usosConsumidos=usesConsumed`, `privado=isPrivate`, `fechaExpiracion=endDate`, `estado`, `link_activo=linkActive`, `link_redirect=null en la fila` (solo el detalle trae linkRedirect), `link_creado_at=null` (no existe en el schema — se documenta), `creadoPor=''` (placeholder, la fila no lo muestra), `createdAt`, `updatedAt=createdAt`. `detalleApiACupon` completa `productosIds`, `categoriasIds`, `montoMinimo=minAmount`, `nivelProducto=productLevel`, `link_redirect`, `creadoPor=createdBy`, `updatedAt`.

- [ ] **Step 2: `cuponInputAApi`** — mapea el payload que arma `CuponesCrear.handleSubmit` (`{ codigo, nombre, tipoDescuento, valor, alcance, productosIds, categoriasIds, montoMinimo, usosMaxTotal, usosMaxPorCliente, fechaInicio, fechaExpiracion, privado, link_activo, link_redirect }`) a `ApiUpsertCouponInput`:

```typescript
export function cuponInputAApi(input: CuponInput): ApiUpsertCouponInput {
  return {
    code: input.codigo, name: input.nombre,
    type: tipoCuponAApi(input.tipoDescuento, input.alcance),
    value: input.valor, scope: ALCANCE_A_API[input.alcance],
    productLevel: input.alcance === 'producto' ? 'padre' : undefined,
    minAmount: input.montoMinimo ?? undefined,
    maxUsesTotal: input.usosMaxTotal ?? undefined,
    maxUsesPerCustomer: input.usosMaxPorCliente ?? undefined,
    isPrivate: input.privado,
    startDate: input.fechaInicio, endDate: input.fechaExpiracion ?? undefined,
    linkActive: input.link_activo, linkRedirect: input.link_redirect ?? undefined,
    productIds: input.alcance === 'producto' ? input.productosIds : undefined,
    categoryIds: input.alcance === 'categoria' ? input.categoriasIds : undefined,
  }
}
```

- [ ] **Step 3: Rewire de los 6 hooks** — espejar exactamente el rewire hecho en descuentos:
  - `useCupones` → `panelListCoupons(...)` + `filaApiACupon`, con el guard `tipoCuponFiltroEsSoportado` y el `status !== 'agotado'` (igual que `useDescuentos`). Mantener la interfaz `(filtros: CuponesFiltros) → PaginatedResponse<Cupon>`.
  - `useCupon(id)` → `panelGetCoupon` + `detalleApiACupon`.
  - `useCrearCupon` → `panelCreateCoupon(cuponInputAApi(input))` + `detalleApiACupon`; onSuccess invalida `['cupones']`.
  - `useEditarCupon` → `panelUpdateCoupon`; invalida `['cupones']` y `['cupon', id]`.
  - `useToggleCupon` → `panelToggleCoupon(id)` (ignora `activo`, el backend invierte); invalida `['cupones']` y `['cupon', id]`.
  - `useEliminarCupon` → `panelDeleteCoupon(id)`; invalida `['cupones']`.

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 5: Verificar el manejo de error de `CuponesCrear`** — ya tiene `try/catch` + banner (commit previo). Confirmar que `err instanceof ApiError` toma el `message` del backend (código duplicado → "Ya existe un cupón con ese código."). No requiere cambio de código, solo lectura.

- [ ] **Step 6: Actualizar `PENDIENTES.md`** — marcar RESUELTO: "cupones conectados al backend real (RBT-615)"; y dejar ABIERTO lo que sigue mock (duplicar, link/email, canje RBT-616). Actualizar `components.md` del módulo (hooks de cupón ya no son mock).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/ventas/panel/descuentos/hooks apps/api/PENDIENTES.md apps/web/src/modules/ventas/panel/descuentos/components.md
git commit -m "feat(cupones): conecto los hooks del panel al backend real (RBT-615)"
```

---

## Task B1: DTO de filtros de métricas + helper de ventana temporal

**Files:**
- Create: `apps/api/src/discounts/dto/metrics-query.dto.ts`

**Interfaces:**
- Produces: `MetricsQueryDto` (`rango`, `fechaDesde?`, `fechaHasta?`, `canal`, `tipo`); `ventanaDe(dto): { desde: Date; hasta: Date; desdePrevio: Date; hastaPrevio: Date }` (para el KPI comparado).

- [ ] **Step 1: Escribir el DTO**

```typescript
import { IsIn, IsOptional, IsString } from 'class-validator';

export class MetricsQueryDto {
  @IsOptional() @IsIn(['hoy', '7d', '30d', '90d', '12m', 'personalizado']) rango?: string;
  @IsOptional() @IsString() fechaDesde?: string;
  @IsOptional() @IsString() fechaHasta?: string;
  // 'pos' queda como opción muerta (RedemptionChannel aún la tiene, pero no se
  // generan redenciones POS). Se acepta para no romper el filtro del front.
  @IsOptional() @IsIn(['todos', 'pos', 'storefront']) canal?: string;
  @IsOptional() @IsIn(['todos', 'descuentos', 'cupones']) tipo?: string;
}
```

- [ ] **Step 2: Escribir `ventanaDe`** (función exportada en el mismo archivo o en el service): traduce `rango` a `{ desde, hasta }` y calcula la ventana previa de igual duración para `variacion`. `hoy`=inicio del día; `7d/30d/90d`=N días atrás; `12m`=12 meses; `personalizado`=usa fechaDesde/fechaHasta. **No usar `Date.now()` en tests**; en runtime está permitido.

- [ ] **Step 3: Typecheck.** Run: `cd apps/api && npx tsc --noEmit`. Expected: sin errores.

- [ ] **Step 4: Commit** `git add apps/api/src/discounts/dto/metrics-query.dto.ts && git commit -m "feat(metricas): DTO de filtros + ventana temporal comparada"`

---

## Task B2: DiscountsMetricsService — agregación

**Files:**
- Create: `apps/api/src/discounts/discounts-metrics.service.ts`
- Test: `apps/api/test/discounts-metrics.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `MetricsQueryDto`, `ventanaDe`.
- Produces: `DiscountsMetricsService.resumen(businessId, dto): Promise<MetricasResumen>` donde `MetricasResumen = { kpis, grafico, rendimiento }` con la forma EXACTA de `apps/web/.../types/metricas.ts` (campos en inglés desde el backend; el front ya los consume así vía el mock — mantener las mismas keys: `revenueSacrificado`, `ventasConDescuento{cantidad,total,porcentaje}`, `ticketPromedio{conDescuento,sinDescuento}`, `tasaCanje{emitidos,canjeados,porcentaje}`, `grafico{fechas,revenueSacrificado,usos}`, `rendimiento[]{id,nombre,entidad,tipoLabel,usos,revenueSacrificado,revenueConDesc,ticketPromedio,estado}`).

**Reglas de agregación (fuente: `DiscountRedemption` filtrado por `businessId` + ventana + canal + tipo):**
- Filtro `tipo`: `descuentos` → redenciones cuyo `discount.code = null`; `cupones` → `discount.code != null`; `todos` → ambos.
- Filtro `canal`: `pos`/`storefront` → `channel`; `todos` → sin filtro.
- `kpis.revenueSacrificado`: `{ valor: SUM(amount) ventana, valorPrevio: SUM(amount) ventana previa, variacion: % }`.
- `kpis.ventasConDescuento`: `cantidad` = COUNT(DISTINCT orderId) en ventana; `total` = SUM(order.total) de esas órdenes; `porcentaje` = cantidad / COUNT(órdenes del negocio en ventana) × 100.
- `kpis.ticketPromedio`: `conDescuento` = AVG(order.total) de órdenes con ≥1 redención; `sinDescuento` = AVG(order.total) de órdenes sin redención (en ventana).
- `kpis.tasaCanje`: `emitidos` = COUNT de cupones (`code != null`) cuya vigencia solapa la ventana; `canjeados` = COUNT(DISTINCT discountId con code != null) en redenciones de la ventana; `porcentaje` = canjeados/emitidos × 100. (Si `tipo=descuentos`, tasaCanje va en cero — no aplica.)
- `grafico`: buckets por día de la ventana: `revenueSacrificado[i]` = SUM(amount) del día i; `usos[i]` = COUNT(redenciones) del día i. `fechas[i]` = ISO del día.
- `rendimiento[]`: agrupado por `discountId`: `usos`=COUNT; `revenueSacrificado`=SUM(amount); `revenueConDesc`=SUM(order.total DISTINCT por orden donde aplicó); `ticketPromedio`=revenueConDesc/COUNT(DISTINCT orderId); `entidad`= 'cupon' si code!=null else 'descuento'; `tipoLabel`= label del tipo; `estado`= estado derivado del discount.
- **Caso sin datos:** todos los SUM/COUNT en 0, arrays de `grafico` con longitud = días de la ventana llenos de 0, `rendimiento: []`. Ningún divisor por cero (guardar con `x === 0 ? 0 : a/b`).

- [ ] **Step 1: Test de "sin datos → ceros bien formados"**

```typescript
it('sin redenciones: KPIs en cero y grafico con longitud de la ventana', async () => {
  const res = await request(app.getHttpServer()).get('/api/v1/discounts/metrics?rango=7d').set(auth(ownerToken));
  expect(res.status).toBe(200);
  expect(res.body.kpis.revenueSacrificado.valor).toBe(0);
  expect(res.body.grafico.fechas.length).toBe(res.body.grafico.usos.length);
  expect(res.body.rendimiento).toEqual(expect.any(Array));
});
```

- [ ] **Step 2: Test de "con una redención sembrada → agrega bien"**

```typescript
it('una redención sembrada aparece en revenueSacrificado y en rendimiento', async () => {
  const prisma = app.get(PrismaService);
  // Crear un descuento + una orden mínima + una redención, todos con businessId del owner.
  // (Detallar en el plan de ejecución: necesita un Order válido; reusar el helper de
  //  creación de orden del harness de orders si existe, o crear la orden vía prisma directo.)
  // ...seed...
  const res = await request(app.getHttpServer()).get('/api/v1/discounts/metrics?rango=30d').set(auth(ownerToken));
  expect(res.body.kpis.revenueSacrificado.valor).toBeGreaterThan(0);
  expect(res.body.rendimiento.length).toBeGreaterThan(0);
});
```

> Si sembrar una `Order` completa resulta demasiado pesado para el e2e, degradar este test a un unit test del método de agregación pasándole filas `DiscountRedemption` mockeadas, y dejar el e2e solo con el caso "sin datos". Documentarlo.

- [ ] **Step 3: Correr → fallan** (404, `metrics` es stub). Expected: FAIL.

- [ ] **Step 4: Implementar `resumen()`** con las reglas de arriba. Usar `prisma.discountRedemption.findMany` con `include: { order: true, discount: true }` acotado por `businessId` + ventana, y agregar en memoria (los volúmenes por negocio son chicos). Guardas contra división por cero en todos los porcentajes/promedios.

- [ ] **Step 5: Wire del endpoint** (Task B3) y correr → pasan.

- [ ] **Step 6: Commit** `git commit -am "feat(metricas): servicio de agregacion sobre DiscountRedemption"`

---

## Task B3: Reemplazar el stub `metrics()` del controller + registrar el service

**Files:**
- Modify: `apps/api/src/discounts/discounts.controller.ts` (método `metrics`)
- Modify: `apps/api/src/discounts/discounts.module.ts` (providers)

**Interfaces:**
- Produces: `GET /discounts/metrics` → `MetricasResumen`.

- [ ] **Step 1: Reemplazar el handler**

```typescript
@Get('metrics')
metrics(@CurrentBusiness() ctx: AuthContext, @Query() query: MetricsQueryDto) {
  const m = assertMemberContext(ctx);
  return this.metricsService.resumen(m.businessId, query);
}
```
Inyectar `DiscountsMetricsService` en el constructor del controller; agregarlo a `providers` del módulo.

- [ ] **Step 2: Correr la suite de métricas**

Run: `cd apps/api && npx jest --config test/jest-e2e.json discounts-metrics.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 3: Correr la suite de descuentos existente (no regresión)**

Run: `npx jest --config test/jest-e2e.json discounts.e2e-spec.ts`
Expected: 22/22 PASS.

- [ ] **Step 4: Commit** `git commit -am "feat(metricas): GET /discounts/metrics real (reemplaza el stub)"`

---

## Task B4: Frontend — cliente de métricas + rewire `useMetricas`

**Files:**
- Modify: `apps/web/src/lib/api.ts` (función `panelGetMetrics`)
- Modify: `apps/web/src/modules/ventas/panel/descuentos/hooks/useMetricas.ts`

**Interfaces:**
- Consumes: `MetricasFiltros`, `MetricasResumen` (types del front).
- Produces: `panelGetMetrics(filtros): Promise<MetricasResumen>`; `useMetricas` devuelve la MISMA forma que hoy (los componentes `MetricasKPIs`/`MetricasGrafico`/`MetricasTabla` no se tocan).

- [ ] **Step 1: `panelGetMetrics` en `lib/api.ts`** — arma el querystring desde `MetricasFiltros` (`rango`, `canal`, `tipo`, `fechaDesde?`, `fechaHasta?`) y pega a `/discounts/metrics`. El tipo de retorno debe coincidir con `MetricasResumen` del front (mismas keys que devuelve el backend en B2).

- [ ] **Step 2: Rewire `useMetricas`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { panelGetMetrics } from '@/lib/api'
import type { MetricasFiltros } from '../types'

export function useMetricas(filtros?: Partial<MetricasFiltros>) {
  return useQuery({
    queryKey: ['metricas', filtros],
    queryFn: () => panelGetMetrics(filtros ?? {}),
    staleTime: 30_000,
  })
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores. (Si el shape del backend difiere de `MetricasResumen`, ajustar el mapeo en `panelGetMetrics` — NO cambiar los componentes.)

- [ ] **Step 4: Verificación en navegador (si hay acceso al panel)** — seguir el workflow de preview; confirmar que la pantalla de Rendimiento carga (con ceros) sin errores de consola. Si el panel no es accesible localmente (subdominios), documentar que la verificación queda pendiente y confiar en el typecheck + e2e del backend.

- [ ] **Step 5: Actualizar `PENDIENTES.md`** — métricas conectadas a datos reales; dejar anotado que muestran cero hasta que exista el canje (RBT-616 + checkout). `useMetricasDetalle`/`useAuditoria` siguen mock (endpoints stub).

- [ ] **Step 6: Commit** `git commit -am "feat(metricas): pantalla de rendimiento contra datos reales del backend"`

---

## Self-Review

**Spec coverage:**
- ✅ Crear/editar/eliminar cupones → A3, A4.
- ✅ "Revisar sus endpoints, que estén correctos" → no existían; A1–A5 los construyen.
- ✅ Lista solo cupones del negocio correspondiente (hoy mock) → A2 (`code != null` + `businessId`) + A7 (rewire).
- ✅ Tabla con acciones → los componentes (`CuponesTabla`) ya existen; A7 les da datos reales vía hooks (interfaz intacta).
- ✅ Alineación de headers en tablas → **ya hecho** fuera de este plan (fix en `DescuentosTabla`; `CuponesTabla` ya alineaba).
- ✅ Métricas/rendimiento con datos reales (descuentos y cupones) → B1–B4.

**Placeholder scan:** los cuerpos de service que se "espejan" de `discounts.service.ts` referencian un archivo real y existente del mismo repo (patrón establecido), no un TODO. La lógica NUEVA (código único, agregación de métricas, mappers de cupón) está escrita explícitamente.

**Type consistency:** `MetricasResumen` del backend (B2) usa las mismas keys que `types/metricas.ts` del front (B4). El mapeo de tipo de cupón (A7) es consistente en ambas direcciones. `Exclude<ApiCouponEstado,'agotado'>` en `CouponListFilters` = mismo criterio que descuentos.

**Riesgos / decisiones para revisar:**
1. **Módulo `coupons` separado vs extender `discounts`.** Elegí separado (controller/service propios, misma tabla). Si preferís un solo módulo, se colapsa A5 en `discounts`.
2. **Métricas devuelven cero** hasta que exista el canje real (RBT-616). Confirmado que es aceptable.
3. **Test de agregación con `Order` sembrada** puede ser pesado en e2e; el plan permite degradarlo a unit test si complica.
4. **`link_creado_at`** del tipo `Cupon` no tiene columna en el schema — se mapea a `null`. Si se quiere real, es una migración aparte (fuera de alcance).
5. **Aislamiento entre negocios (A5 step 4)** depende de que el seed tenga un 2º owner; si no, ese test queda documentado como manual.
