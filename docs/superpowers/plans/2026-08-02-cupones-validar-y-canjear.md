# Cupones: Validar y Canjear (RBT-616) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `POST /discounts/validate` de verdad (existe, vigente, no agotado, límite por cliente) y registrar el canje (`DiscountRedemption` + `Discount.usesConsumed`) automáticamente cuando se crea la orden, tal como dice la actualización del ticket RBT-616 ("Tarea 9.3... la redención se registra automáticamente al crear la orden (9.4)").

**Architecture:** Se espeja `DiscountsService.evaluate()` (que ya filtra descuentos automáticos y llama a `evaluateCart()` del motor) para un método nuevo `validateCoupon()` que filtra por `code` en vez de `application: 'AUTOMATIC'`, y suma el chequeo de `maxUsesPerCustomer` (contando `DiscountRedemption` por `discountId`+`customerId`, algo que hoy no existe en ningún lado). El motor de cálculo (`discount-engine.ts::evaluateCart`) NO se toca — ya soporta un array de un solo descuento. `OrdersService.create()` deja de rechazar `dto.discountCode`: lo valida server-side (nunca confía en un monto mandado por el cliente, mismo criterio que ya usa con los precios de variantes) y, dentro de la misma transacción que crea la orden, escribe el `DiscountRedemption` y incrementa `usesConsumed`.

**Tech Stack:** NestJS + Prisma (Postgres/Supabase) en `apps/api`. Tests e2e con Jest + Supertest.

## Global Constraints

- **Aislamiento por negocio:** toda validación de cupón y todo canje filtran por `businessId` — nunca por `code` a ciegas (dos negocios pueden tener el mismo código).
- **El backend nunca confía en un monto de descuento mandado por el cliente.** El monto se recalcula siempre server-side con `evaluateCart()`, igual que ya se hace con los precios de producto en `orders.service.ts`.
- **Redención = 1 registro por orden**, no por ítem: `usesConsumed` se incrementa en 1 por orden que use el cupón, independientemente de cuántos ítems tenga el carrito.
- **Límite por cliente (`maxUsesPerCustomer`) solo aplica si hay `customerId`** (una venta anónima de POS no lo chequea — no tiene con quién comparar).
- **Una orden cancelada NO revierte automáticamente `usesConsumed`** — se documenta como decisión explícita en PENDIENTES.md (Task 5), no un bug pendiente.
- **`code` en el commit final:** commits en español, minúscula, con trailer `Co-Authored-By`. El equipo trabaja directo sobre `main`.
- **No tocar el motor (`discount-engine.ts`)** — ya soporta lo necesario. Si algo no encaja, es señal de que el mapeo de datos está mal, no de que el motor necesite cambiar.

---

## File Structure

**Backend — extender `discounts` (validate):**
- `apps/api/src/discounts/dto/validate-coupon.dto.ts` — ya existe (`code`, `items: unknown[]`, `customerId?`); tipar `items` correctamente (modificar).
- `apps/api/src/discounts/discounts.service.ts` — agregar `validateCoupon()` (modificar).
- `apps/api/src/discounts/discounts.controller.ts` — reemplazar el stub `validate()` (modificar).
- `apps/api/test/coupons-validate.e2e-spec.ts` — nuevo archivo de tests (crear).

**Backend — canje en `orders`:**
- `apps/api/src/orders/orders.service.ts` — quitar el reject de `discountCode`, agregar la lógica de canje en `create()` (modificar).
- `apps/api/test/orders-coupon-redemption.e2e-spec.ts` — nuevo archivo de tests (crear).

**Docs:**
- `apps/api/PENDIENTES.md` — marcar RBT-616 resuelto, documentar la decisión de "no revertir usesConsumed en cancelación" (modificar).

---

## Task 1: `DiscountsService.validateCoupon()` + tipar `ValidateCouponDto`

**Files:**
- Modify: `apps/api/src/discounts/dto/validate-coupon.dto.ts`
- Modify: `apps/api/src/discounts/discounts.service.ts`
- Test: `apps/api/test/coupons-validate.e2e-spec.ts` (crear)

**Interfaces:**
- Consumes: `PrismaService`, `evaluateCart()` del motor (`apps/api/src/discounts/discount-engine.ts`), el mismo shape `EligibleDiscount`/`CartItemForEngine` que ya usa `evaluate()`.
- Produces: `DiscountsService.validateCoupon(businessId: string, dto: ValidateCouponDto): Promise<{ valid: boolean; reason?: string; discount?: { id: string; code: string; name: string; discountTotal: number; itemDiscounts: ...; ticketDiscount: number } }>`.

> **Antes de escribir código:** leé `apps/api/src/discounts/discounts.service.ts::evaluate()` completo (es el método que se espeja) y `apps/api/src/discounts/discount-engine.ts` completo (para conocer los tipos exactos `EligibleDiscount`, `CartItemForEngine`, `EvaluationResult`). Los nombres de campos de abajo asumen lo que reportó una exploración previa del código — confirmalos contra el archivo real antes de copiar.

- [ ] **Step 1: Tipar `ValidateCouponDto.items`**

Reemplazar el `items: unknown[]` por el mismo tipo que usa `EvaluateDiscountsDto` (buscar ese DTO en `apps/api/src/discounts/dto/` y reusar su clase de ítem, ej. `CartItemInputDto`, vía `@ValidateNested({ each: true }) @Type(() => CartItemInputDto)`).

```typescript
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CartItemInputDto } from './evaluate-discounts.dto'; // ajustar el nombre real tras confirmarlo

export class ValidateCouponDto {
  @IsString() code!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CartItemInputDto) items!: CartItemInputDto[];
  @IsOptional() @IsUUID() customerId?: string;
}
```

- [ ] **Step 2: Test — cupón inexistente o de otro negocio → `valid: false`**

```typescript
it('cupón inexistente → valid:false, no revela si el código pertenece a otro negocio', async () => {
  const res = await request(app.getHttpServer())
    .post('/api/v1/discounts/validate')
    .set(auth(customerToken)) // helper de auth de storefront ya existente en otros e2e (ver auth.e2e-spec / customer login)
    .send({ code: 'NOEXISTE', items: [{ variantId: seedVariantId, quantity: 1 }] });
  expect(res.status).toBe(200);
  expect(res.body.valid).toBe(false);
});
```

- [ ] **Step 3: Correr → falla** (sigue devolviendo `{ message: 'not implemented' }`).

Run: `cd apps/api && npx jest --config test/jest-e2e.json coupons-validate.e2e-spec.ts -t "cupón inexistente"`
Expected: FAIL.

- [ ] **Step 4: Implementar `validateCoupon()`**

Espejar `evaluate()` cambiando el `where` base y agregando el chequeo de uso por cliente:

```typescript
async validateCoupon(businessId: string, dto: ValidateCouponDto) {
  const now = new Date();
  const coupon = await this.prisma.discount.findFirst({
    where: { businessId, code: dto.code.trim(), deletedAt: null },
  });
  if (!coupon || !coupon.isActive) return { valid: false, reason: 'No existe un cupón activo con ese código.' };
  if (coupon.startDate > now) return { valid: false, reason: 'Este cupón todavía no está vigente.' };
  if (coupon.endDate && coupon.endDate < now) return { valid: false, reason: 'Este cupón ya expiró.' };
  if (coupon.maxUsesTotal != null && coupon.usesConsumed >= coupon.maxUsesTotal) {
    return { valid: false, reason: 'Este cupón agotó sus usos disponibles.' };
  }
  if (dto.customerId && coupon.maxUsesPerCustomer != null) {
    const usosDelCliente = await this.prisma.discountRedemption.count({
      where: { discountId: coupon.id, customerId: dto.customerId },
    });
    if (usosDelCliente >= coupon.maxUsesPerCustomer) {
      return { valid: false, reason: 'Ya usaste este cupón el máximo de veces permitido.' };
    }
  }

  // Resolver variantes → precio/producto/categoría real (NUNCA confiar en lo que manda el cliente).
  // Espejar exactamente el bloque de resolución de variantes de evaluate() acá.
  const cartItems = await this.resolverItemsDelCarrito(businessId, dto.items); // método privado ya existente en evaluate(), reusar

  if (coupon.minAmount != null) {
    const subtotal = cartItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    if (subtotal < Number(coupon.minAmount)) {
      return { valid: false, reason: `El monto mínimo para este cupón es $${coupon.minAmount}.` };
    }
  }

  const eligible = this.aEligibleDiscount(coupon); // mapear Discount → EligibleDiscount, mismo helper que evaluate()
  const resultado = evaluateCart(cartItems, [eligible]);

  return {
    valid: true,
    discount: {
      id: coupon.id,
      code: coupon.code!,
      name: coupon.name,
      discountTotal: resultado.discountTotal,
      itemDiscounts: resultado.itemDiscounts,
      ticketDiscount: resultado.ticketDiscount,
    },
  };
}
```

> **Nota:** si `evaluate()` no tiene un método privado reusable para "resolver variantes" o "mapear Discount → EligibleDiscount", extraelos como métodos privados compartidos en este mismo task (refactor mínimo, mismo criterio que "NO dupliques a ciegas" del plan de cupones CRUD).

- [ ] **Step 5: Wire del controller**

```typescript
@Post('validate')
validate(@CurrentBusiness() ctx: AuthContext, @Body() dto: ValidateCouponDto) {
  if (ctx.type === 'platform_admin') throw new ForbiddenException('Este recurso pertenece a un negocio.');
  return this.discountsService.validateCoupon(ctx.businessId, dto);
}
```

(Mismo patrón de acceso que el `evaluate()` vecino — abierto a member y a customer, solo bloquea platform_admin.)

- [ ] **Step 6: Correr → pasa.** Run mismo comando del Step 3. Expected: PASS.

- [ ] **Step 7: Tests adicionales — vigencia, agotado, límite por cliente**

```typescript
it('cupón expirado → valid:false', async () => { /* crear cupón con endDate en el pasado, validar, esperar valid:false */ });
it('cupón que ya alcanzó maxUsesTotal → valid:false', async () => { /* crear cupón con maxUsesTotal:1, usesConsumed:1 vía prisma directo, validar */ });
it('cliente que ya usó su límite personal → valid:false', async () => {
  // crear cupón maxUsesPerCustomer:1, sembrar un DiscountRedemption con ese discountId+customerId, validar con el mismo customerId
});
it('cupón vigente y dentro de límites → valid:true con discountTotal > 0', async () => { /* caso feliz */ });
```

Run: `cd apps/api && npx jest --config test/jest-e2e.json coupons-validate.e2e-spec.ts`
Expected: todos PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/discounts apps/api/test/coupons-validate.e2e-spec.ts
git commit -m "feat(cupones): validar codigo real contra vigencia, agotamiento y limite por cliente (RBT-616)"
```

---

## Task 2: Canje automático al crear la orden

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts`
- Test: `apps/api/test/orders-coupon-redemption.e2e-spec.ts` (crear)

**Interfaces:**
- Consumes: `DiscountsService` (inyectar en `OrdersModule`/`OrdersService` si no está ya), el mismo helper de resolución de cupón del Task 1 (idealmente exponer un método interno no-HTTP, ej. `DiscountsService.resolverCuponParaOrden(businessId, code, customerId?, items)` que devuelva `{ discount, discountTotal }` o lance `BadRequestException` con el motivo — reusa la misma lógica de `validateCoupon()` sin la envoltura `{valid, reason}`).
- Produces: `OrdersService.create()` acepta `dto.discountCode` de nuevo; la orden creada trae `discountTotal`/`total` correctos y existe un `DiscountRedemption` + `Discount.usesConsumed` incrementado.

> **Antes de escribir código:** leé `apps/api/src/orders/orders.service.ts::create()` completo tal cual está HOY (los números de línea de la exploración previa pueden haber cambiado). Confirmá: (a) si ya usa `$transaction` para crear la orden, o si hay que envolverla; (b) qué canales (`POS`/`ONLINE`) acepta hoy realmente — el reject de `discountCode` puede convivir con otras validaciones de canal que no hay que tocar.

- [ ] **Step 1: Exponer el helper interno en `DiscountsService`**

```typescript
// En discounts.service.ts, reusando el cuerpo de validateCoupon() sin la envoltura HTTP:
async resolverCuponParaOrden(
  businessId: string,
  code: string,
  customerId: string | undefined,
  items: CartItemInputDto[],
): Promise<{ discountId: string; discountTotal: number }> {
  const resultado = await this.validateCoupon(businessId, { code, customerId, items });
  if (!resultado.valid || !resultado.discount) {
    throw new BadRequestException(resultado.reason ?? 'Cupón inválido.');
  }
  return { discountId: resultado.discount.id, discountTotal: resultado.discount.discountTotal };
}
```

- [ ] **Step 2: Inyectar `DiscountsService` en `OrdersModule`/`OrdersService`**

Revisar `apps/api/src/orders/orders.module.ts`: si `DiscountsModule` no exporta `DiscountsService`, agregarlo a `exports` ahí, e importar `DiscountsModule` en `OrdersModule`.

- [ ] **Step 3: Test — orden con `discountCode` válido escribe la redención**

```typescript
it('crear orden con discountCode válido registra el canje y descuenta el total', async () => {
  const cupon = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
    code: `${PREFIJO}-CANJE`, name: `${PREFIJO} canje`, type: 'PERCENT_TICKET', value: 10,
    scope: 'TICKET', startDate: new Date(Date.now() - 86400000).toISOString(),
  });
  const orden = await request(app.getHttpServer()).post('/api/v1/orders').set(auth(ownerToken)).send({
    channel: 'ONLINE', customerId: seedCustomerId,
    items: [{ variantId: seedVariantId, quantity: 1 }],
    discountCode: `${PREFIJO}-CANJE`,
  });
  expect(orden.status).toBe(201);
  expect(Number(orden.body.discountTotal)).toBeGreaterThan(0);

  const prisma = app.get(PrismaService);
  const redencion = await prisma.discountRedemption.findFirst({ where: { orderId: orden.body.id } });
  expect(redencion).not.toBeNull();
  expect(redencion!.discountId).toBe(cupon.body.id);

  const cuponActualizado = await prisma.discount.findUnique({ where: { id: cupon.body.id } });
  expect(cuponActualizado!.usesConsumed).toBe(1);
});

it('crear orden con discountCode inválido → 400, no crea la orden ni la redención', async () => {
  const res = await request(app.getHttpServer()).post('/api/v1/orders').set(auth(ownerToken)).send({
    channel: 'ONLINE', customerId: seedCustomerId,
    items: [{ variantId: seedVariantId, quantity: 1 }],
    discountCode: 'NOEXISTE',
  });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 4: Correr → fallan** (sigue el `BadRequestException` de "fase posterior").

Run: `cd apps/api && npx jest --config test/jest-e2e.json orders-coupon-redemption.e2e-spec.ts`
Expected: FAIL.

- [ ] **Step 5: Implementar en `create()`**

Quitar el bloque:
```typescript
if (dto.discountCode) {
  throw new BadRequestException('Los cupones de descuento se aplican en una fase posterior.');
}
```

Y en su lugar, ANTES de calcular `total` final (donde hoy se hardcodea `discountTotal: new Prisma.Decimal(0)`):

```typescript
let discountId: string | null = null;
let discountTotal = new Prisma.Decimal(0);
if (dto.discountCode) {
  const resuelto = await this.discounts.resolverCuponParaOrden(
    businessId, dto.discountCode, dto.customerId, dto.items.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
  );
  discountId = resuelto.discountId;
  discountTotal = new Prisma.Decimal(resuelto.discountTotal);
}
```

Y dentro de la transacción que crea la orden (envolver en `$transaction` si `create()` no lo hace ya), después de `tx.order.create(...)`:

```typescript
if (discountId) {
  await tx.discountRedemption.create({
    data: {
      businessId, orderId: ordenCreada.id, discountId,
      customerId: dto.customerId ?? null,
      channel: dto.channel === 'ONLINE' ? 'STOREFRONT' : 'POS',
      amount: discountTotal,
    },
  });
  await tx.discount.update({ where: { id: discountId }, data: { usesConsumed: { increment: 1 } } });
}
```

Usar `discountTotal` (ya calculado) en el `data` de `tx.order.create()` en vez del `Prisma.Decimal(0)` hardcodeado, y restarlo del `total` final.

- [ ] **Step 6: Correr → pasan.** Run mismo comando del Step 4. Expected: PASS.

- [ ] **Step 7: Regresión — suite completa de orders y de cupones**

Run: `cd apps/api && npx jest --config test/jest-e2e.json orders.e2e-spec.ts coupons.e2e-spec.ts coupons-validate.e2e-spec.ts discounts-metrics.e2e-spec.ts`
Expected: todos PASS (en particular, confirmar que `discounts-metrics.e2e-spec.ts` sigue pasando — ya no depende de sembrar la redención a mano para el caso "con datos", aunque no hace falta borrar ese test).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/orders apps/api/src/discounts apps/api/test/orders-coupon-redemption.e2e-spec.ts
git commit -m "feat(cupones): canje automatico al crear la orden con discountCode (RBT-616)"
```

---

## Task 3: Documentación

**Files:**
- Modify: `apps/api/PENDIENTES.md`

- [ ] **Step 1: Actualizar la sección "Fase 3 — Descuentos y Cupones"**

Marcar RESUELTO el punto "Canje real (RBT-616)" con fecha de hoy, y agregar una entrada nueva:

```markdown
### [2026-08-02] Cupones: canje real al crear la orden (RBT-616)
**Estado:** RESUELTO (2026-08-02).
`POST /discounts/validate` valida vigencia, agotamiento y límite por cliente contra la base real.
`OrdersService.create()` ya no rechaza `discountCode`: lo valida server-side y, en la misma
transacción que crea la orden, escribe `DiscountRedemption` e incrementa `Discount.usesConsumed`.
Con esto, las métricas de `GET /discounts/metrics` (RBT-614) dejan de estar siempre en cero.

**Decisión abierta documentada:** una orden CANCELADA no revierte automáticamente `usesConsumed`
ni borra su `DiscountRedemption` (la redención ya ocurrió al crear la orden, no al confirmarla —
así lo pide el ticket actualizado). Si el negocio quiere que cancelar libere el uso del cupón,
es una tarea aparte: escuchar la transición a `CANCELLED` en `updateStatus()` y decrementar.

**Bloqueado para uso real (no es un bug de esta tarea):** el checkout real del storefront
(RBT-617/618/619/620, a cargo de Mateo Rojas) todavía es 100% mock — no llama a
`/discounts/validate` ni crea órdenes reales. Esta tarea queda completa y testeada por e2e,
pero no será visible para un cliente real hasta que el checkout la consuma.
```

- [ ] **Step 2: Commit**

```bash
git commit -am "docs: actualizar PENDIENTES.md con el cierre de RBT-616"
```

---

## Self-Review

**Spec coverage:**
- ✅ Validar existencia/vigencia/límites/uno-por-cliente → Task 1.
- ✅ Calcular el descuento sobre el carrito → Task 1 (reusa el motor sin cambios).
- ✅ Registrar el uso cuando se confirma/crea la venta → Task 2 (al crear, según texto actualizado del ticket).

**Placeholder scan:** los bloques marcados "espejar evaluate()" apuntan a un método real y existente del mismo archivo (patrón ya usado en el plan de cupones CRUD), no un TODO — pero a diferencia de ese plan anterior, acá SÍ hace falta que el implementador lea `evaluate()` completo antes de copiar, porque esta plan fue escrita a partir de un resumen de exploración, no de una lectura línea por línea del archivo actual. Se dejaron notas explícitas de "confirmar contra el archivo real" en los puntos de mayor riesgo (Task 1 antes de Step 1, Task 2 antes de Step 1).

**Riesgos / decisiones para revisar:**
1. **Nombre exacto de la clase de ítem de carrito** (`CartItemInputDto` es un nombre supuesto) — confirmar contra `evaluate-discounts.dto.ts` real.
2. **Si `OrdersService.create()` ya usa `$transaction`** — la plan asume que hay que envolver o extender uno existente; verificar antes de tocar.
3. **Coordinar con Mateo Rojas (RBT-617-621):** una vez que este plan esté mergeado, avisarle que `discountCode` en `POST /orders` ya funciona y que `/discounts/validate` está listo para que el checkout lo llame antes de confirmar la compra.
