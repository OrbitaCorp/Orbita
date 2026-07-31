# Motor de Descuentos + CRUD (RBT-613, RBT-614) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el motor de evaluación de descuentos automáticos y el CRUD de descuentos del panel (`apps/api/src/discounts/`), reemplazando los stubs actuales, para los 4 tipos "simples" de descuento (V1 del enum `DiscountType`).

**Architecture:** `DiscountsService` gana dos responsabilidades independientes: (1) CRUD Prisma-backed sobre `Discount` (solo filas con `code = null`, o sea "descuentos", no cupones), y (2) un motor de evaluación puro (sin efectos secundarios, sin persistencia) que recibe un carrito y devuelve qué descuentos automáticos aplican y cuánto descuentan, implementando la regla fija "mejor descuento gana" por ítem y por ticket. El motor vive en un archivo aparte (`discount-engine.ts`) como funciones puras, testeadas vía los mismos e2e que el resto del backend (no se introduce un runner de tests unitario nuevo — se sigue el patrón existente del proyecto).

**Tech Stack:** NestJS, Prisma (Postgres), class-validator, Jest + Supertest (`test/*.e2e-spec.ts`, contra la DB real de Supabase — mismo patrón que `orders.service.ts`/`orders.e2e-spec.ts`).

## Global Constraints

- Archivos del backend en español para nombres de negocio, código/identificadores en inglés — seguir el estilo ya usado en `orders.service.ts`, `customers.service.ts`.
- Multi-tenant: **todo** query filtra por `businessId` explícito (nunca confiar en que el caller ya filtró).
- `PermissionsGuard`/`RolesGuard` ya deciden quién puede pegarle a cada endpoint (`@Roles('owner','admin')` ya está puesto en `discounts.controller.ts` para create/update/toggle/etc. — **no tocar los decoradores existentes**, ya reflejan RF-04 del spec: el cajero es solo lectura).
- Los DTOs de `discounts/dto/*` **ya existen** (fueron escritos junto con el controller stub) — no crear nuevos donde ya hay uno, solo `find-discounts-query.dto.ts` es nuevo (no existe todavía).
- `Prisma.Decimal` para todo monto — nunca operar montos como `number` en la capa de persistencia (mismo criterio que `orders.service.ts`).
- Correr `npx tsc --noEmit -p tsconfig.json` desde `apps/api/` después de cada task antes de dar el paso por terminado.

## Fuera de alcance de este plan (decisión a confirmar con el equipo, no tomada acá)

El enum `DiscountType` en el schema marca 4 valores `// (V1)` y 3 `// (V2)`:

```
PERCENT_PRODUCT // (V1)   AMOUNT_PRODUCT // (V1)
PERCENT_TICKET  // (V1)   AMOUNT_TICKET  // (V1)
BUY_X_PAY_Y     // (V2)   BUY_X_GET_Z    // (V2)   VOLUME // (V2)
```

`UpsertDiscountDto.type` ya solo valida los 4 tipos V1. El spec funcional (`implemetancion-descuentos.md`) describe los 7 tipos como parte del módulo, pero el schema y el DTO ya cortaron el alcance real a V1. Este plan implementa **únicamente los 4 tipos V1** — llevá-X-pagá-Y, comprá-X-obtené-Z y volumen quedan sin motor de evaluación ni alta por este plan. Si el equipo decide que van en esta ronda, es un plan aparte (tocan `UpsertDiscountDto`, el schema no cambia — los campos `condicion`/`bonus_*` ya existen en el modelo Prisma vía `minQuantity`/`bonus*` — pero el DTO y el engine sí).

También quedan **fuera** (siguen devolviendo `{ message: 'not implemented' }`, sin tocar): `duplicate`, `metrics`, `metricsById`, `audit`, `setLink`, `sendLink`. Ninguno está en el título de RBT-613/614. `audit` en particular depende de `AuditService`, que es otro stub sin dueño asignado todavía — implementarlo acá mezclaría alcance de otro módulo.

## File Structure

- **Create:** `apps/api/src/discounts/dto/find-discounts-query.dto.ts` — filtros de listado (no existía).
- **Create:** `apps/api/src/discounts/discount-engine.ts` — funciones puras del motor de evaluación (matching + cálculo + "mejor gana"). Sin Prisma, sin NestJS — solo tipos y funciones, para que sea trivial de leer y de extender cuando se aborden los tipos V2.
- **Modify:** `apps/api/src/discounts/discounts.service.ts` — hoy 100% stub. Gana `findAll`, `findOne`, `create`, `update`, `toggle`, `evaluate`.
- **Modify:** `apps/api/src/discounts/discounts.controller.ts` — reemplazar los `return { message: 'not implemented' }` de los 6 endpoints de este plan por llamadas reales al service. Los decoradores (`@Roles`, rutas) ya están bien, no tocar.
- **Test:** `apps/api/test/discounts.e2e-spec.ts` — nuevo, cubre CRUD + evaluate contra la DB real (patrón `orders.e2e-spec.ts` / `platform-panel.e2e-spec.ts`).

---

### Task 1: DTO de filtros del listado

**Files:**
- Create: `apps/api/src/discounts/dto/find-discounts-query.dto.ts`

**Interfaces:**
- Produces: `FindDiscountsQueryDto` con `{ status?, type?, search?, page?, limit? }` — lo consume `DiscountsService.findAll()` en la Task 2.

- [ ] **Step 1: Escribir el DTO**

```typescript
// apps/api/src/discounts/dto/find-discounts-query.dto.ts
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Filtros del listado de descuentos (tab "Descuentos" del panel — NO cupones).
// 'status' es derivado (no existe como columna): activo/inactivo/programado/expirado
// se calculan a partir de isActive + startDate/endDate en el service.
export class FindDiscountsQueryDto {
  @IsOptional()
  @IsIn(['activo', 'inactivo', 'programado', 'expirado'])
  status?: 'activo' | 'inactivo' | 'programado' | 'expirado';

  @IsOptional()
  @IsIn(['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET'])
  type?: string;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
```

- [ ] **Step 2: Verificar que compila**

Run (desde `apps/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores relacionados a este archivo (puede haber ruido de otros archivos si el resto del plan no está aplicado — ignorar por ahora, este archivo no se importa todavía en ningún lado).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/discounts/dto/find-discounts-query.dto.ts
git commit -m "feat(descuentos): DTO de filtros del listado (RBT-614)"
```

---

### Task 2: Motor de evaluación — funciones puras

**Files:**
- Create: `apps/api/src/discounts/discount-engine.ts`
- Test: se prueba indirectamente vía Task 6 (e2e sobre `POST /discounts/evaluate`) — este archivo no tiene tests propios porque no toca DB ni framework; su corrección se verifica end-to-end.

**Interfaces:**
- Consumes: nada (funciones puras, tipos propios).
- Produces (usado por `DiscountsService.evaluate()` en Task 6):
  - `type CartItemForEngine = { variantId: string; productId: string; categoryId: string; quantity: number; unitPrice: number }`
  - `type EligibleDiscount = { id: string; name: string; type: 'PERCENT_PRODUCT'|'AMOUNT_PRODUCT'|'PERCENT_TICKET'|'AMOUNT_TICKET'; value: number; scope: 'PRODUCT'|'CATEGORY'|'TICKET'; productLevel: 'padre'|'variante'|null; minAmount: number|null; priority: number; productIds: string[]; categoryIds: string[] }`
  - `function evaluateCart(items: CartItemForEngine[], discounts: EligibleDiscount[]): EvaluationResult`
  - `type EvaluationResult = { itemDiscounts: Array<{ variantId: string; discountId: string; discountName: string; amount: number }>; ticketDiscount: { discountId: string; discountName: string; amount: number } | null; subtotal: number; discountTotal: number; total: number }`

- [ ] **Step 1: Escribir el motor**

```typescript
// apps/api/src/discounts/discount-engine.ts
//
// Motor de evaluación de descuentos automáticos — funciones puras, sin efectos
// secundarios (RNF-07: idempotente, misma entrada → misma salida). Solo cubre
// los 4 tipos V1 del enum DiscountType (ver plan: BUY_X_PAY_Y / BUY_X_GET_Z /
// VOLUME quedan fuera). El caller (DiscountsService.evaluate) es responsable de
// traer de la DB solo descuentos activos, vigentes, automáticos y con code=null
// — este módulo no conoce vigencia ni persistencia, solo matching + cálculo.

export type CartItemForEngine = {
  variantId: string;
  productId: string; // producto padre de la variante
  categoryId: string;
  quantity: number;
  unitPrice: number;
};

export type EligibleDiscount = {
  id: string;
  name: string;
  type: 'PERCENT_PRODUCT' | 'AMOUNT_PRODUCT' | 'PERCENT_TICKET' | 'AMOUNT_TICKET';
  value: number;
  scope: 'PRODUCT' | 'CATEGORY' | 'TICKET';
  productLevel: 'padre' | 'variante' | null;
  minAmount: number | null;
  priority: number;
  productIds: string[]; // IDs de producto padre o de variante, según productLevel
  categoryIds: string[];
};

export type ItemDiscountResult = {
  variantId: string;
  discountId: string;
  discountName: string;
  amount: number; // monto total descontado en ese ítem (ya multiplicado por quantity)
};

export type TicketDiscountResult = {
  discountId: string;
  discountName: string;
  amount: number;
};

export type EvaluationResult = {
  itemDiscounts: ItemDiscountResult[];
  ticketDiscount: TicketDiscountResult | null;
  subtotal: number;
  discountTotal: number;
  total: number;
};

function itemMatchesDiscount(item: CartItemForEngine, d: EligibleDiscount): boolean {
  if (d.scope === 'PRODUCT') {
    const key = d.productLevel === 'padre' ? item.productId : item.variantId;
    return d.productIds.includes(key);
  }
  if (d.scope === 'CATEGORY') {
    return d.categoryIds.includes(item.categoryId);
  }
  return false; // scope TICKET no matchea a nivel ítem
}

// Monto descontado de UN ítem completo (unitPrice * quantity, ya con el tope
// "no puede superar el precio del producto" para AMOUNT_PRODUCT aplicado por unidad).
function computeItemDiscountAmount(item: CartItemForEngine, d: EligibleDiscount): number {
  if (d.type === 'PERCENT_PRODUCT') {
    return round2((item.unitPrice * item.quantity * d.value) / 100);
  }
  if (d.type === 'AMOUNT_PRODUCT') {
    const perUnit = Math.min(d.value, item.unitPrice);
    return round2(perUnit * item.quantity);
  }
  return 0; // los tipos TICKET no se calculan a nivel ítem
}

function computeTicketDiscountAmount(subtotal: number, d: EligibleDiscount): number {
  if (d.type === 'PERCENT_TICKET') return round2((subtotal * d.value) / 100);
  if (d.type === 'AMOUNT_TICKET') return round2(Math.min(d.value, subtotal));
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// "Mejor gana": si dos descuentos empatan en monto, gana el de mayor `priority`;
// si también empatan, gana el que se creó primero (orden estable — el caller ya
// entrega `discounts` ordenado por createdAt asc, así que Array.find /
// comparación estable alcanza sin criterio de desempate extra acá).
function pickBest<T extends { amount: number; discount: EligibleDiscount }>(candidates: T[]): T | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => {
    if (c.amount > best.amount) return c;
    if (c.amount === best.amount && c.discount.priority > best.discount.priority) return c;
    return best;
  });
}

export function evaluateCart(items: CartItemForEngine[], discounts: EligibleDiscount[]): EvaluationResult {
  const subtotal = round2(items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0));

  const itemLevel = discounts.filter((d) => d.scope === 'PRODUCT' || d.scope === 'CATEGORY');
  const ticketLevel = discounts.filter((d) => d.scope === 'TICKET');

  const itemDiscounts: ItemDiscountResult[] = [];
  for (const item of items) {
    const candidates = itemLevel
      .filter((d) => itemMatchesDiscount(item, d))
      .map((d) => ({ amount: computeItemDiscountAmount(item, d), discount: d }))
      .filter((c) => c.amount > 0);
    const best = pickBest(candidates);
    if (best) {
      itemDiscounts.push({
        variantId: item.variantId,
        discountId: best.discount.id,
        discountName: best.discount.name,
        amount: best.amount,
      });
    }
  }

  const ticketCandidates = ticketLevel
    .filter((d) => d.minAmount == null || subtotal >= d.minAmount)
    .map((d) => ({ amount: computeTicketDiscountAmount(subtotal, d), discount: d }))
    .filter((c) => c.amount > 0);
  const bestTicket = pickBest(ticketCandidates);
  const ticketDiscount: TicketDiscountResult | null = bestTicket
    ? { discountId: bestTicket.discount.id, discountName: bestTicket.discount.name, amount: bestTicket.amount }
    : null;

  const discountTotal = round2(
    itemDiscounts.reduce((acc, d) => acc + d.amount, 0) + (ticketDiscount?.amount ?? 0),
  );

  return {
    itemDiscounts,
    ticketDiscount,
    subtotal,
    discountTotal,
    total: round2(subtotal - discountTotal),
  };
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit -p tsconfig.json` (desde `apps/api/`)
Expected: sin errores en `discount-engine.ts` (todavía no lo importa nadie, así que no puede fallar por integración).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/discounts/discount-engine.ts
git commit -m "feat(descuentos): motor de evaluacion puro para los 4 tipos V1 (RBT-613)"
```

---

### Task 3: `DiscountsService` — lectura (findAll, findOne) + controller

**Files:**
- Modify: `apps/api/src/discounts/discounts.service.ts`
- Modify: `apps/api/src/discounts/discounts.controller.ts`
- Test: `apps/api/test/discounts.e2e-spec.ts` (crear el archivo en esta task, arranca con estos dos endpoints)

**Interfaces:**
- Consumes: `FindDiscountsQueryDto` (Task 1).
- Produces: `DiscountsService.findAll(businessId, query)` y `.findOne(businessId, id)` — los consume el controller directo; no los reusa ninguna otra task de este plan.

- [ ] **Step 1: Escribir el e2e que falla (findAll + findOne)**

```typescript
// apps/api/test/discounts.e2e-spec.ts
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';

describe('Discounts (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let createdId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = res.body.token;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('GET /api/v1/discounts', () => {
    it('con token owner → 200, lista paginada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/discounts')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('total');
    });

    it('sin token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/discounts');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/discounts/:id', () => {
    it('con id inexistente → 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/discounts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(404);
    });
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run (desde `apps/api/`): `npx jest --config ./test/jest-e2e.json --forceExit discounts`
Expected: FAIL — `findAll`/`findOne` todavía devuelven `{ message: 'not implemented' }` con status 200 en vez de la forma esperada (o el 404 de `findOne` no se cumple porque hoy siempre responde 200).

- [ ] **Step 3: Implementar `findAll` y `findOne` en el service**

```typescript
// apps/api/src/discounts/discounts.service.ts — reemplaza el contenido completo
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FindDiscountsQueryDto } from './dto/find-discounts-query.dto';

// (RBT-613/614) CRUD de descuentos (tab "Descuentos" del panel — code=null;
// los cupones, code≠null, son RBT-615/616, no este archivo) + motor de
// evaluación. Ver docs/superpowers/plans/2026-07-29-motor-descuentos-crud.md
// para el alcance exacto (4 tipos V1, sin duplicate/metrics/audit/link).

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  // El estado ('activo'/'inactivo'/'programado'/'expirado') es derivado — no
  // existe como columna. Mismo criterio que Order/OrderStatus: se calcula al leer.
  private estadoDe(d: { isActive: boolean; startDate: Date; endDate: Date | null }, now: Date): 'activo' | 'inactivo' | 'programado' | 'expirado' {
    if (!d.isActive) return 'inactivo';
    if (d.startDate > now) return 'programado';
    if (d.endDate && d.endDate < now) return 'expirado';
    return 'activo';
  }

  async findAll(businessId: string, q: FindDiscountsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const now = new Date();

    const where: Prisma.DiscountWhereInput = { businessId, code: null, deletedAt: null };
    if (q.type) where.type = q.type as Prisma.DiscountWhereInput['type'];
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.discount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.discount.count({ where }),
    ]);

    // El filtro por 'status' es derivado, así que se aplica en memoria después
    // de traer la página — con volúmenes de "hasta 200 descuentos" (RNF-02) esto
    // no pesa; si el catálogo crece mucho, se puede promover a columna calculada.
    const data = rows
      .map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        value: Number(d.value),
        scope: d.scope,
        application: d.application,
        startDate: d.startDate,
        endDate: d.endDate,
        activeDays: d.activeDays,
        maxUsesTotal: d.maxUsesTotal,
        usesConsumed: d.usesConsumed,
        isActive: d.isActive,
        estado: this.estadoDe(d, now),
        createdAt: d.createdAt,
      }))
      .filter((d) => !q.status || d.estado === q.status);

    return { data, total, page, limit };
  }

  async findOne(businessId: string, id: string) {
    const d = await this.prisma.discount.findFirst({
      where: { id, businessId, code: null, deletedAt: null },
      include: { products: true, categories: true },
    });
    if (!d) throw new NotFoundException('Descuento no encontrado');

    return {
      id: d.id,
      name: d.name,
      type: d.type,
      value: Number(d.value),
      scope: d.scope,
      productLevel: d.productLevel,
      minQuantity: d.minQuantity,
      minAmount: d.minAmount != null ? Number(d.minAmount) : null,
      application: d.application,
      startDate: d.startDate,
      endDate: d.endDate,
      activeDays: d.activeDays,
      startTime: d.startTime,
      endTime: d.endTime,
      maxUsesTotal: d.maxUsesTotal,
      maxUsesPerCustomer: d.maxUsesPerCustomer,
      usesConsumed: d.usesConsumed,
      isActive: d.isActive,
      priority: d.priority,
      estado: this.estadoDe(d, new Date()),
      productIds: d.products.map((p) => p.productId),
      categoryIds: d.categories.map((c) => c.categoryId),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
```

- [ ] **Step 4: Wire el controller**

En `apps/api/src/discounts/discounts.controller.ts`, reemplazar SOLO estos dos métodos (dejar el resto tal cual, siguen stub):

```typescript
  @Get()
  findAll(@CurrentBusiness() businessId: string, @Query() query: FindDiscountsQueryDto) {
    return this.discountsService.findAll(businessId, query);
  }

  // ...

  @Get(':id')
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.discountsService.findOne(businessId, id);
  }
```

Agregar los imports que falten al tope del archivo:

```typescript
import { Query } from '@nestjs/common'; // sumar a la línea de imports de @nestjs/common existente
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { FindDiscountsQueryDto } from './dto/find-discounts-query.dto';
```

(`CurrentBusiness` ya existe — lo usa `branches.controller.ts`/`categories.controller.ts`; confirmar la firma exacta leyendo `common/decorators/current-business.decorator.ts` antes de este paso si el nombre del decorador no calza 1:1.)

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx jest --config ./test/jest-e2e.json --forceExit discounts`
Expected: PASS (los 3 tests de este task).

- [ ] **Step 6: Typecheck completo**

Run (desde `apps/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: 0 errores.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/discounts/discounts.service.ts apps/api/src/discounts/discounts.controller.ts apps/api/test/discounts.e2e-spec.ts
git commit -m "feat(descuentos): listado y detalle (RBT-614)"
```

---

### Task 4: `DiscountsService` — alta y edición (create, update)

**Files:**
- Modify: `apps/api/src/discounts/discounts.service.ts`
- Modify: `apps/api/src/discounts/discounts.controller.ts`
- Test: `apps/api/test/discounts.e2e-spec.ts`

**Interfaces:**
- Consumes: `UpsertDiscountDto` (ya existe, no se toca).
- Produces: `DiscountsService.create(businessId, memberId, dto)`, `.update(businessId, id, dto)` — ambos devuelven la forma de `findOne()`.

- [ ] **Step 1: Sumar los tests que fallan**

Agregar dentro de `describe('Discounts (e2e)', ...)`, después del bloque de `GET /:id`:

```typescript
  describe('POST /api/v1/discounts', () => {
    it('con token owner, tipo PERCENT_TICKET → 201, crea el descuento', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test e2e — 10% ticket',
          type: 'PERCENT_TICKET',
          value: 10,
          scope: 'TICKET',
          minAmount: 1000,
          startDate: new Date().toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test e2e — 10% ticket');
      expect(res.body.estado).toBe('activo');
      createdId = res.body.id;
    });

    it('value > 100 en tipo porcentaje → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test e2e — invalido',
          type: 'PERCENT_TICKET',
          value: 150,
          scope: 'TICKET',
          startDate: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
    });

    it('scope PRODUCT sin productIds → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test e2e — sin productos',
          type: 'PERCENT_PRODUCT',
          value: 10,
          scope: 'PRODUCT',
          startDate: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
    });

    it('con token empleado (sin permiso) → 403', async () => {
      const empRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_USERS.employee.email, password: SEED_USERS.employee.password });

      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${empRes.body.token}`)
        .send({ name: 'x', type: 'PERCENT_TICKET', value: 5, scope: 'TICKET', startDate: new Date().toISOString() });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/v1/discounts/:id', () => {
    it('con token owner, cambiando value → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/discounts/${createdId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test e2e — 15% ticket',
          type: 'PERCENT_TICKET',
          value: 15,
          scope: 'TICKET',
          minAmount: 1000,
          startDate: new Date().toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.value).toBe(15);
    });
  });
```

Importar `SEED_USERS.employee` — ya existe en `test/helpers/test-users.ts` (agregado en la sesión de super admin).

- [ ] **Step 2: Correr y confirmar que falla**

Run: `npx jest --config ./test/jest-e2e.json --forceExit discounts`
Expected: FAIL en los 5 tests nuevos (create/update siguen stub).

- [ ] **Step 3: Implementar `create` y `update`**

Agregar a `DiscountsService` (después de `findOne`):

```typescript
  // Reglas de validación cruzada de RF-11 que class-validator no cubre solo
  // con decoradores por campo (dependen de más de un campo a la vez).
  private validarReglas(dto: UpsertDiscountDto): void {
    if ((dto.type === 'PERCENT_PRODUCT' || dto.type === 'PERCENT_TICKET') && (dto.value <= 0 || dto.value > 100)) {
      throw new BadRequestException('El porcentaje debe estar entre 1 y 100.');
    }
    if ((dto.type === 'AMOUNT_PRODUCT' || dto.type === 'AMOUNT_TICKET') && dto.value <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0.');
    }
    if (dto.scope !== 'TICKET' && !dto.productIds?.length && !dto.categoryIds?.length) {
      throw new BadRequestException('Elegí al menos un producto o una categoría para este alcance.');
    }
    if (dto.scope === 'PRODUCT' && !dto.productLevel) {
      throw new BadRequestException('Indicá si aplica a producto padre o a variante específica.');
    }
    if (dto.endDate && new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio.');
    }
  }

  async create(businessId: string, memberId: string, dto: UpsertDiscountDto) {
    this.validarReglas(dto);

    const existente = await this.prisma.discount.findFirst({ where: { businessId, code: null, name: dto.name, deletedAt: null } });
    if (existente) throw new BadRequestException('Ya existe un descuento con ese nombre.');

    const created = await this.prisma.$transaction(async (tx) => {
      const discount = await tx.discount.create({
        data: {
          businessId,
          name: dto.name,
          type: dto.type as Prisma.DiscountCreateInput['type'],
          value: new Prisma.Decimal(dto.value),
          scope: dto.scope as Prisma.DiscountCreateInput['scope'],
          productLevel: dto.productLevel ?? null,
          minQuantity: dto.minQuantity ?? null,
          minAmount: dto.minAmount != null ? new Prisma.Decimal(dto.minAmount) : null,
          application: (dto.application as Prisma.DiscountCreateInput['application']) ?? 'AUTOMATIC',
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          activeDays: dto.activeDays ?? [],
          startTime: dto.startTime ?? null,
          endTime: dto.endTime ?? null,
          maxUsesTotal: dto.maxUsesTotal ?? null,
          maxUsesPerCustomer: dto.maxUsesPerCustomer ?? null,
          isPrivate: dto.isPrivate ?? false,
          priority: dto.priority ?? 0,
          createdBy: memberId,
        },
      });
      if (dto.productIds?.length) {
        await tx.discountProduct.createMany({ data: dto.productIds.map((productId) => ({ discountId: discount.id, productId })) });
      }
      if (dto.categoryIds?.length) {
        await tx.discountCategory.createMany({ data: dto.categoryIds.map((categoryId) => ({ discountId: discount.id, categoryId })) });
      }
      return discount;
    });

    return this.findOne(businessId, created.id);
  }

  async update(businessId: string, id: string, dto: UpsertDiscountDto) {
    this.validarReglas(dto);

    const existing = await this.prisma.discount.findFirst({ where: { id, businessId, code: null, deletedAt: null } });
    if (!existing) throw new NotFoundException('Descuento no encontrado');

    const duplicado = await this.prisma.discount.findFirst({
      where: { businessId, code: null, name: dto.name, deletedAt: null, id: { not: id } },
    });
    if (duplicado) throw new BadRequestException('Ya existe un descuento con ese nombre.');

    await this.prisma.$transaction(async (tx) => {
      await tx.discount.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type as Prisma.DiscountUpdateInput['type'],
          value: new Prisma.Decimal(dto.value),
          scope: dto.scope as Prisma.DiscountUpdateInput['scope'],
          productLevel: dto.productLevel ?? null,
          minQuantity: dto.minQuantity ?? null,
          minAmount: dto.minAmount != null ? new Prisma.Decimal(dto.minAmount) : null,
          application: (dto.application as Prisma.DiscountUpdateInput['application']) ?? 'AUTOMATIC',
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          activeDays: dto.activeDays ?? [],
          startTime: dto.startTime ?? null,
          endTime: dto.endTime ?? null,
          maxUsesTotal: dto.maxUsesTotal ?? null,
          maxUsesPerCustomer: dto.maxUsesPerCustomer ?? null,
          isPrivate: dto.isPrivate ?? false,
          priority: dto.priority ?? 0,
        },
      });
      // Reemplazo completo de la selección de productos/categorías (más simple
      // y menos propenso a bugs que un diff — el volumen de filas es chico).
      await tx.discountProduct.deleteMany({ where: { discountId: id } });
      await tx.discountCategory.deleteMany({ where: { discountId: id } });
      if (dto.productIds?.length) {
        await tx.discountProduct.createMany({ data: dto.productIds.map((productId) => ({ discountId: id, productId })) });
      }
      if (dto.categoryIds?.length) {
        await tx.discountCategory.createMany({ data: dto.categoryIds.map((categoryId) => ({ discountId: id, categoryId })) });
      }
    });

    return this.findOne(businessId, id);
  }
```

Sumar los imports que falten al tope de `discounts.service.ts`: `BadRequestException` (de `@nestjs/common`, sumar a la línea existente) y `UpsertDiscountDto` (de `./dto/upsert-discount.dto`).

- [ ] **Step 4: Wire el controller**

Reemplazar `create` y `update` en `discounts.controller.ts`:

```typescript
  @Post()
  @Roles('owner', 'admin')
  create(@CurrentBusiness() businessId: string, @CurrentUser() ctx: AuthContext, @Body() dto: UpsertDiscountDto) {
    const member = assertMemberContext(ctx);
    return this.discountsService.create(businessId, member.memberId, dto);
  }

  @Put(':id')
  @Roles('owner', 'admin')
  update(@CurrentBusiness() businessId: string, @Param('id') id: string, @Body() dto: UpsertDiscountDto) {
    return this.discountsService.update(businessId, id, dto);
  }
```

Sumar imports: `CurrentUser` (`../common/decorators/current-user.decorator`), `AuthContext` (`../common/types/auth-context.type`), `assertMemberContext` (`../common/utils/assert-member-context`) — los tres ya existen en el proyecto (los usa `orders.controller.ts`); confirmar la ruta exacta de `assertMemberContext` leyendo cómo lo importa `orders.controller.ts` si no calza.

- [ ] **Step 5: Correr y confirmar que pasa**

Run: `npx jest --config ./test/jest-e2e.json --forceExit discounts`
Expected: PASS (todos los tests del archivo hasta acá).

- [ ] **Step 6: Typecheck completo**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 0 errores.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/discounts/discounts.service.ts apps/api/src/discounts/discounts.controller.ts apps/api/test/discounts.e2e-spec.ts
git commit -m "feat(descuentos): alta y edicion con validaciones cruzadas (RBT-614, RF-11)"
```

---

### Task 5: `DiscountsService` — activar/desactivar (toggle)

**Files:**
- Modify: `apps/api/src/discounts/discounts.service.ts`
- Modify: `apps/api/src/discounts/discounts.controller.ts`
- Test: `apps/api/test/discounts.e2e-spec.ts`

- [ ] **Step 1: Sumar el test que falla**

```typescript
  describe('PATCH /api/v1/discounts/:id/toggle', () => {
    it('con token owner → 200, invierte isActive', async () => {
      const before = await request(app.getHttpServer())
        .get(`/api/v1/discounts/${createdId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/discounts/${createdId}/toggle`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(!before.body.isActive);
    });
  });
```

- [ ] **Step 2: Correr y confirmar que falla**

Run: `npx jest --config ./test/jest-e2e.json --forceExit discounts`
Expected: FAIL — `toggle` sigue devolviendo el stub.

- [ ] **Step 3: Implementar `toggle`**

```typescript
  async toggle(businessId: string, id: string) {
    const existing = await this.prisma.discount.findFirst({ where: { id, businessId, code: null, deletedAt: null } });
    if (!existing) throw new NotFoundException('Descuento no encontrado');

    await this.prisma.discount.update({ where: { id }, data: { isActive: !existing.isActive } });
    return this.findOne(businessId, id);
  }
```

- [ ] **Step 4: Wire el controller**

```typescript
  @Patch(':id/toggle')
  @Roles('owner', 'admin')
  toggle(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.discountsService.toggle(businessId, id);
  }
```

- [ ] **Step 5: Correr y confirmar que pasa**

Run: `npx jest --config ./test/jest-e2e.json --forceExit discounts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/discounts/discounts.service.ts apps/api/src/discounts/discounts.controller.ts apps/api/test/discounts.e2e-spec.ts
git commit -m "feat(descuentos): activar/desactivar (RBT-614)"
```

---

### Task 6: `DiscountsService.evaluate()` — integra el motor con la DB

**Files:**
- Modify: `apps/api/src/discounts/discounts.service.ts`
- Modify: `apps/api/src/discounts/discounts.controller.ts`
- Test: `apps/api/test/discounts.e2e-spec.ts`

**Interfaces:**
- Consumes: `evaluateCart` de `discount-engine.ts` (Task 2), `EvaluateDiscountsDto` (ya existe).
- Produces: `DiscountsService.evaluate(businessId, dto)` — respuesta `EvaluationResult` (mismo shape que exporta el engine) más `businessId` implícito ya aplicado en el filtro.

- [ ] **Step 1: Sumar los tests que fallan**

Necesita un producto+variante+categoría reales del negocio seed para armar un carrito. Agregar al inicio del `describe` un `beforeAll` que los resuelva (el negocio seed `zapatoslorena` ya tiene catálogo cargado por otras suites — si `ProductoLista`/`products.e2e-spec.ts` no garantiza datos, buscar cualquier variante existente vía Prisma directo en el test):

```typescript
  describe('POST /api/v1/discounts/evaluate', () => {
    let variantId: string;
    let unitPrice: number;
    let discountId: string;

    beforeAll(async () => {
      // Toma la primera variante que exista en el negocio seed — el catálogo
      // ya está poblado por el seed/otras suites, no hace falta crear producto acá.
      const res = await request(app.getHttpServer())
        .get('/api/v1/products?limit=1')
        .set('Authorization', `Bearer ${ownerToken}`);
      const variant = res.body.data[0].variants[0];
      variantId = variant.id;
      unitPrice = Number(variant.price);

      const discRes = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test e2e — 20% producto',
          type: 'PERCENT_PRODUCT',
          value: 20,
          scope: 'PRODUCT',
          productLevel: 'variante',
          productIds: [variantId],
          startDate: new Date(Date.now() - 86400000).toISOString(),
        });
      discountId = discRes.body.id;
    });

    it('carrito con ítem que matchea el descuento → devuelve el descuento aplicado', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts/evaluate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          channel: 'STOREFRONT',
          items: [{ variantId, quantity: 2, unitPrice }],
        });

      expect(res.status).toBe(201);
      expect(res.body.itemDiscounts).toHaveLength(1);
      expect(res.body.itemDiscounts[0].discountId).toBe(discountId);
      expect(res.body.itemDiscounts[0].amount).toBeCloseTo(unitPrice * 2 * 0.2, 2);
      expect(res.body.total).toBeCloseTo(res.body.subtotal - res.body.discountTotal, 2);
    });

    it('carrito sin ítems que matcheen → sin descuentos', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts/evaluate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ channel: 'STOREFRONT', items: [{ variantId: '00000000-0000-0000-0000-000000000099', quantity: 1, unitPrice: 1000 }] });

      expect(res.status).toBe(201);
      expect(res.body.itemDiscounts).toHaveLength(0);
      expect(res.body.discountTotal).toBe(0);
    });

    it('es idempotente: dos llamadas iguales devuelven el mismo resultado (RNF-07)', async () => {
      const payload = { channel: 'STOREFRONT' as const, items: [{ variantId, quantity: 1, unitPrice }] };
      const r1 = await request(app.getHttpServer()).post('/api/v1/discounts/evaluate').set('Authorization', `Bearer ${ownerToken}`).send(payload);
      const r2 = await request(app.getHttpServer()).post('/api/v1/discounts/evaluate').set('Authorization', `Bearer ${ownerToken}`).send(payload);
      expect(r1.body).toEqual(r2.body);
    });
  });
```

**Nota para quien ejecute esta task:** si `GET /api/v1/products` no expone `variants[].price` en ese shape exacto, ajustar el `beforeAll` leyendo la respuesta real de `products.service.ts` — no está garantizado 1:1, es el único punto de este plan que depende de un contrato ya escrito por otro módulo.

- [ ] **Step 2: Correr y confirmar que falla**

Run: `npx jest --config ./test/jest-e2e.json --forceExit discounts`
Expected: FAIL — `evaluate` sigue stub.

- [ ] **Step 3: Implementar `evaluate`**

```typescript
  async evaluate(businessId: string, dto: EvaluateDiscountsDto) {
    const variantIds = dto.items.map((it) => it.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { businessId, deletedAt: null } },
      select: { id: true, productId: true, product: { select: { categoryId: true } } },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=domingo, igual que Date.getDay()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Solo descuentos automáticos, no-cupón, activos y vigentes AHORA. Cupones
    // (code != null) se evalúan por /discounts/validate (RBT-616), no acá.
    const rows = await this.prisma.discount.findMany({
      where: {
        businessId,
        code: null,
        deletedAt: null,
        isActive: true,
        application: 'AUTOMATIC',
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { products: true, categories: true },
      orderBy: { createdAt: 'asc' },
    });

    const vigentes = rows.filter((d) => {
      if (d.activeDays.length > 0 && !d.activeDays.includes(dayOfWeek)) return false;
      if (d.startTime && hhmm < d.startTime) return false;
      if (d.endTime && hhmm > d.endTime) return false;
      if (d.maxUsesTotal != null && d.usesConsumed >= d.maxUsesTotal) return false;
      return d.type === 'PERCENT_PRODUCT' || d.type === 'AMOUNT_PRODUCT' || d.type === 'PERCENT_TICKET' || d.type === 'AMOUNT_TICKET';
    });

    const eligible: EligibleDiscount[] = vigentes.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type as EligibleDiscount['type'],
      value: Number(d.value),
      scope: d.scope as EligibleDiscount['scope'],
      productLevel: d.productLevel as EligibleDiscount['productLevel'],
      minAmount: d.minAmount != null ? Number(d.minAmount) : null,
      priority: d.priority,
      productIds: d.products.map((p) => p.productId),
      categoryIds: d.categories.map((c) => c.categoryId),
    }));

    const items: CartItemForEngine[] = dto.items.map((it) => {
      const v = variantById.get(it.variantId);
      return {
        variantId: it.variantId,
        productId: v?.productId ?? '',
        categoryId: v?.product.categoryId ?? '',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      };
    });

    return evaluateCart(items, eligible);
  }
```

Sumar imports al tope de `discounts.service.ts`: `EvaluateDiscountsDto` (`./dto/evaluate-discounts.dto`), `evaluateCart`, `CartItemForEngine`, `EligibleDiscount` (`./discount-engine`).

- [ ] **Step 4: Wire el controller**

```typescript
  @Post('evaluate')
  evaluate(@CurrentBusiness() businessId: string, @Body() dto: EvaluateDiscountsDto) {
    return this.discountsService.evaluate(businessId, dto);
  }
```

(Sin `@Roles` — lo consume tanto el panel como, eventualmente, el storefront público vía `X-Business-Slug`; cualquier member o customer autenticado del negocio puede evaluar un carrito.)

- [ ] **Step 5: Correr y confirmar que pasa**

Run: `npx jest --config ./test/jest-e2e.json --forceExit discounts`
Expected: PASS — los 3 tests de este task y toda la suite completa (`discounts.e2e-spec.ts`) en verde.

- [ ] **Step 6: Typecheck completo + suite completa**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 0 errores.

Run: `npx jest --config ./test/jest-e2e.json --forceExit` (suite e2e completa, no solo `discounts`)
Expected: todo en verde — confirma que nada de lo tocado rompió otro módulo (`orders`, `platform-panel`, etc.).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/discounts/discounts.service.ts apps/api/src/discounts/discounts.controller.ts apps/api/test/discounts.e2e-spec.ts
git commit -m "feat(descuentos): motor de evaluacion conectado a evaluate() (RBT-613)"
```

---

### Task 7: Cierre — PENDIENTES.md

**Files:**
- Modify: `apps/api/PENDIENTES.md`

**Interfaces:** ninguna — task de documentación, sin código.

- [ ] **Step 1: Agregar la entrada**

Agregar al final de `apps/api/PENDIENTES.md`, siguiendo el formato del archivo (ver secciones anteriores para el estilo exacto):

```markdown
## Fase 3 — Descuentos (RBT-613, RBT-614)

### [2026-07-29] Motor de descuentos y CRUD: solo los 4 tipos V1
**Estado:** RESUELTO (2026-07-29) — implementados `PERCENT_PRODUCT`, `AMOUNT_PRODUCT`,
`PERCENT_TICKET`, `AMOUNT_TICKET`. `BUY_X_PAY_Y`, `BUY_X_GET_Z` y `VOLUME` (marcados `// (V2)`
en el schema) quedan sin motor ni alta — `UpsertDiscountDto` ya los excluía de antes. El spec
funcional (`implemetancion-descuentos.md`) los describe como parte del módulo sin marcar V1/V2,
así que esto es una decisión de scope tomada al ejecutar el plan, no del spec — confirmar con
el equipo si van en una próxima ronda.

### [2026-07-29] `duplicate`, `metrics`, `metricsById`, `audit`, `setLink`, `sendLink` siguen stub
**Estado:** DIFERIDO — ninguno estaba en el título de RBT-613/614. `audit` en particular
depende de `AuditService` (`apps/api/src/audit/`), que es otro stub sin dueño asignado — se
evitó implementarlo acá para no mezclar alcance de otro módulo.

### [2026-07-29] `evaluate()` no descuenta stock ni registra `DiscountRedemption`
**Estado:** DIFERIDO — por diseño (RNF-07: idempotente, sin efectos secundarios). El canje real
(incrementar `usesConsumed`, crear `DiscountRedemption`) pasa cuando se confirma la venta —
hoy `orders.service.ts` rechaza `discountCode` explícitamente ("se aplica en fase posterior").
Bloqueante para RF-07 hasta que el módulo Pedidos integre el resultado de `evaluate()`/`validate()`
al confirmar un pedido.
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/PENDIENTES.md
git commit -m "docs: registrar decisiones de scope de RBT-613/614 en PENDIENTES"
```

---

## Self-Review (completado al escribir este plan)

**Cobertura del spec:** RF-01 (Task 6), RF-02 "mejor gana" (Task 2, `pickBest`), RF-03 (la respuesta de `evaluate` ya trae nombre+ítem+monto, lo consume el frontend del POS/Storefront en otra tarea), RF-04 (decoradores `@Roles` ya existentes, no tocados), RF-05 programado (Task 3, `estadoDe`), RF-08 (todo el cálculo vive en `discount-engine.ts`, cero lógica de descuentos en frontend), RF-09/RF-10 explícitamente diferidos (Task 7), RF-11 (Task 4, `validarReglas`), RF-13/RF-14 (Task 2, `itemMatchesDiscount` — padre/variante/categoría dinámica), RF-15 (todo query filtra por `businessId`), RNF-07 idempotencia (Task 6, test explícito). RF-06, RF-07, RF-12, RF-16, RF-17, RF-18 pertenecen a RBT-615/616 (cupones) o a integración con Pedidos/POS — fuera de este plan a propósito.

**Placeholders:** ninguno — cada step tiene código completo o el comando exacto a correr.

**Consistencia de tipos:** `EligibleDiscount`/`CartItemForEngine`/`EvaluationResult` se definen una sola vez en `discount-engine.ts` (Task 2) y Task 6 los importa tal cual, sin redefinir.
