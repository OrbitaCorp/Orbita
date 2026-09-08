# Mensajería — deuda técnica post-auditoría — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los cuatro pendientes que dejó la auditoría del módulo de mensajería (chat cliente↔tienda): autocompletar `{id}`/`{tracking}` en plantillas, definir y comunicar el límite de largo de mensaje, dar cobertura de tests al módulo (hoy tiene cero), y sacar el preview muerto de "Usar plantilla".

**Architecture:** Cuatro tasks independientes entre sí (se pueden repartir/paralelizar), sobre un módulo que ya funciona de punta a punta. Task 1 (backend, agrega `tracking` al detalle de cliente) desbloquea Task 2 (frontend, resuelve variables de plantilla contra el último pedido). Task 3 es mitad decisión de producto, mitad UX + doc. Task 4 crea `conversations.e2e-spec.ts` + un unit spec, siguiendo los patrones ya existentes. Task 5 borra código muerto en la pantalla de Plantillas.

**Tech Stack:** NestJS + Prisma (Postgres/Supabase) en `apps/api`; Next.js Pages Router + React en `apps/web` (sin runner de tests en el front — verificación = `tsc --noEmit` + `eslint` + chequeo en el navegador). Tests backend: Jest + Supertest (`test/jest-e2e.json`, `test/jest-unit.json`).

**Spec:** este documento. Los cuatro ítems salieron de la auditoría de la sesión del 2026-09-08 y del resumen entregado al equipo:

1. `{id}`/`{tracking}` en plantillas quedan literales — el vendedor los completa a mano. Autocompletar `{id}` (y `{tracking}`) con el último pedido del cliente.
2. Tope de 5000 caracteres para mensajes — elegido por consistencia con `customer-email.dto.ts`, sin spec. Definir el número real y comunicarlo en el input.
3. El módulo de mensajería no tiene ningún test (ni e2e ni unit). Todos los módulos comparables sí.
4. "Usar plantilla" desde `apps/web/src/modules/ventas/panel/mensajes/Plantillas.tsx` no envía nada — solo hace un toast. Preview muerto.

## Global Constraints

- **Aislamiento multi-tenant:** toda query nueva filtra por `businessId` (y por `customerId` cuando aplica). Un `orderId`/`conversationId` de otro negocio o de otro cliente devuelve 404, nunca datos. Verificar pertenencia en cada `findFirst`, no solo en el `findMany`.
- **Auth propia, no Supabase Auth:** JWT HS256 firmado con clave propia, `argon2id`. Los endpoints de panel usan `assertMemberContext(ctx)`, los de storefront `assertCustomerContext(ctx)`. No tocar esto.
- **Deploy del backend es MANUAL:** pushear a `main` despliega solo el frontend (Vercel). Después de cualquier cambio en `apps/api/src/` o `apps/api/prisma/` hay que correr `cd apps/api && ./deploy/deploy.sh`. Sin migración en este plan salvo que Task 1 la necesite (no la necesita — `Order.tracking` ya existe en el schema).
- **Sin runner de tests en el frontend:** no hay Jest/Vitest en `apps/web`. Los steps de "test" de tasks de frontend son `cd apps/web && npx tsc --noEmit` + `npx eslint <archivos>` + verificación manual en el navegador. No inventar un runner.
- **Reglas de código frontend (heredadas):** archivos < 300 líneas, named exports, tokens `var(--color-*)` nunca hex, sin Zustand, server-state en hooks/props. Los componentes visuales no cambian de estructura.
- **`code`:** commits en español, minúscula, con trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. El equipo trabaja directo sobre `main`.
- **`resolverVariables` — firma actual** (ya cambiada en el commit `4c30182`): `resolverVariables(texto: string, datos: { nombre?: string; tienda?: string }): string`. Vive en `apps/web/src/modules/ventas/panel/mensajes/mock/mensajes.mock.ts`. Reemplaza `{nombre}` y `{tienda}` con datos reales y deja literal cualquier otra variable (`{id}`, `{tracking}`, `{loQueSea}`).
- **Callers de `resolverVariables`:** `PlantillaPopover.tsx` (popover del composer, ruta real) y `ModalUsarPlantilla.tsx` (pantalla de Plantillas, hoy preview muerto — ver Task 5).

---

## File Structure

**Task 1 — backend, `tracking` en el detalle de cliente:**
- Modify: `apps/api/src/customers/customers.service.ts` (~L139-173: agregar `tracking` al `select`/`findMany` y al map de `orders`)
- Modify: `apps/web/src/lib/api.ts` (~L1333: agregar `tracking: string | null` al tipo `ApiCustomerDetail['orders'][number]`)
- Test: `apps/api/test/unit/` — cubierto por Task 4 (unit spec de `CustomersService` no existe; se agrega una aserción mínima al e2e de mensajería o se deja anotado). Verificación directa: e2e existente `me-orders` no cubre `/customers/:id`; se agrega assert en `conversations.e2e-spec.ts` (Task 4) o un check manual.

**Task 2 — frontend, autocompletar `{id}`/`{tracking}`:**
- Modify: `apps/web/src/modules/ventas/panel/mensajes/mock/mensajes.mock.ts` (`resolverVariables`: agregar `pedido?: { numero: number; tracking: string | null }` al segundo parámetro)
- Modify: `apps/web/src/modules/ventas/panel/mensajes/components/PlantillaPopover.tsx` (recibir `pedido` por prop, pasarlo a `resolverVariables`)
- Modify: `apps/web/src/modules/ventas/panel/mensajes/components/Composer.tsx` (recibir `pedidoReciente` por prop, pasarlo al popover)
- Modify: `apps/web/src/modules/ventas/panel/mensajes/components/ChatPanel.tsx` (calcular el pedido más reciente desde `pedidos`/`getCustomer`, pasarlo al `Composer`, avisar por toast cuál se usó)
- Modify: `apps/web/src/modules/ventas/panel/mensajes/mock/mensajes.mock.ts` (tipo `PedidoResumen`: agregar `tracking: string | null`)

**Task 3 — límite de largo:**
- Modify: `apps/api/src/conversations/dto/send-message.dto.ts` y `customer-message.dto.ts` (ajustar `@MaxLength(N)` si producto define otro número; si confirman 5000, solo el comentario)
- Modify: `apps/web/src/modules/ventas/panel/mensajes/components/Composer.tsx` (`maxLength` en el `<input>` + contador cuando falta poco)
- Modify: `apps/web/src/modules/ventas/cliente/perfil/components/MensajesCliente.tsx` (`maxLength` en el `<input>`)
- Modify: `CONTRATO_API.md` (documentar el límite de `POST /conversations/:id/messages` y `POST /me/conversation/messages`)

**Task 4 — tests del módulo:**
- Create: `apps/api/test/conversations.e2e-spec.ts`
- Create: `apps/api/test/unit/conversations.service.unit-spec.ts`

**Task 5 — sacar el preview muerto:**
- Modify: `apps/web/src/modules/ventas/panel/mensajes/Plantillas.tsx` (sacar `modalUsar`/`ModalUsarPlantilla`)
- Modify: `apps/web/src/modules/ventas/panel/mensajes/components/PlantillaCard.tsx` (sacar la acción/botón "Usar")
- Delete: `apps/web/src/modules/ventas/panel/mensajes/components/ModalUsarPlantilla.tsx` (queda sin usar)

---

## Task 1: `tracking` en el detalle de cliente (backend)

Hoy `GET /customers/:id` devuelve `orders[]` sin el código de seguimiento. Task 2 lo necesita para resolver `{tracking}`.

**Files:**
- Modify: `apps/api/src/customers/customers.service.ts`
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Produces: `ApiCustomerDetail['orders'][number]` gana `tracking: string | null`. El campo `Order.tracking` (Prisma `String?`) ya existe — no hay migración.

- [ ] **Step 1: Escribir el assert que falla (dentro del e2e de Task 4, o como check aislado)**

Si Task 4 ya existe, agregar a `conversations.e2e-spec.ts`:

```ts
it('GET /customers/:id devuelve tracking en cada pedido', async () => {
  const res = await request(app.getHttpServer())
    .get(`/api/v1/customers/${customerId}`)
    .set(auth(ownerToken))
    .expect(200);
  expect(res.body.orders[0]).toHaveProperty('tracking');
});
```

Si Task 4 todavía no está, correr este check a mano contra el detalle de un cliente con pedidos y confirmar que `tracking` NO aparece todavía.

- [ ] **Step 2: Correr y ver que falla**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json -t "devuelve tracking en cada pedido"`
Expected: FAIL — `orders[0]` no tiene la key `tracking`.

- [ ] **Step 3: Agregar `tracking` al `findMany` y al map**

En `apps/api/src/customers/customers.service.ts`, en el `this.prisma.order.findMany({...})` del detalle (bloque `Promise.all`, alrededor de L139): el `findMany` ya trae la fila entera salvo el `include`, así que `o.tracking` está disponible sin tocar el `select`. Agregar al objeto que arma `orders`:

```ts
orders: pedidos.map((o) => ({
  id: o.id,
  orderNumber: o.orderNumber,
  channel: o.channel,
  status: o.status,
  total: Number(o.total),
  itemCount: o.items.reduce((acc, it) => acc + it.quantity, 0),
  tracking: o.tracking ?? null,
  items: o.items.map((it) => ({
    productName: it.productName,
    variantLabel: it.variantLabel,
    quantity: it.quantity,
  })),
  createdAt: o.createdAt,
})),
```

- [ ] **Step 4: Actualizar el tipo del cliente HTTP**

En `apps/web/src/lib/api.ts`, en `ApiCustomerDetail`:

```ts
export type ApiCustomerDetail = ApiCustomer & {
  orders: {
    id: string; orderNumber: number; channel: 'POS' | 'ONLINE'
    status: ApiOrderStatus; total: number; itemCount: number; createdAt: string
    tracking: string | null
    items?: { productName: string; variantLabel: string | null; quantity: number }[]
  }[]
  // ...resto igual
}
```

- [ ] **Step 5: Correr el assert y ver que pasa + typecheck**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json -t "devuelve tracking en cada pedido"`
Expected: PASS
Run: `cd apps/api && npx tsc --noEmit` y `cd apps/web && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/customers/customers.service.ts apps/web/src/lib/api.ts
git commit -m "feat(clientes): exponer tracking del pedido en el detalle de cliente

Lo necesita el autocompletado de {tracking} en plantillas de mensajería.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Deploy backend**

```bash
cd apps/api && ./deploy/deploy.sh
```

---

## Task 2: autocompletar `{id}` y `{tracking}` con el último pedido (frontend)

**Decisión de diseño (sin spec — se asume este criterio):** cuando una plantilla trae `{id}` o `{tracking}`, se resuelven contra el **pedido más reciente del cliente** (`orders[0]`, ya viene ordenado `createdAt desc`). El texto cae en el borrador editable del composer, así que el vendedor puede corregirlo. Al insertar la plantilla se muestra un toast diciendo qué pedido se usó ("Plantilla completada con el pedido #1284"). Si el cliente no tiene pedidos, `{id}` queda literal. Si el pedido más reciente no tiene `tracking`, `{tracking}` queda literal.

**Files:**
- Modify: `apps/web/src/modules/ventas/panel/mensajes/mock/mensajes.mock.ts`
- Modify: `apps/web/src/modules/ventas/panel/mensajes/components/PlantillaPopover.tsx`
- Modify: `apps/web/src/modules/ventas/panel/mensajes/components/Composer.tsx`
- Modify: `apps/web/src/modules/ventas/panel/mensajes/components/ChatPanel.tsx`

**Interfaces:**
- Consumes: `ApiCustomerDetail['orders'][number].tracking` (Task 1).
- Produces: `resolverVariables(texto, { nombre?, tienda?, pedido? })` donde `pedido?: { numero: number; tracking: string | null }`.

- [ ] **Step 1: Extender `resolverVariables`**

En `apps/web/src/modules/ventas/panel/mensajes/mock/mensajes.mock.ts`:

```ts
export function resolverVariables(
  texto: string,
  datos: { nombre?: string; tienda?: string; pedido?: { numero: number; tracking: string | null } },
): string {
  const mapa: Record<string, string> = {}
  const nombre = datos.nombre?.trim().split(' ')[0]
  if (nombre) mapa.nombre = nombre
  const tienda = datos.tienda?.trim()
  if (tienda) mapa.tienda = tienda
  if (datos.pedido) {
    mapa.id = String(datos.pedido.numero)
    if (datos.pedido.tracking) mapa.tracking = datos.pedido.tracking
  }
  // {tracking} sin dato real y cualquier otra variable no reconocida quedan
  // literales para que el vendedor las complete antes de enviar.
  return texto.replace(/\{(\w+)\}/g, (orig, k: string) => mapa[k] ?? orig)
}
```

- [ ] **Step 2: Verificar el comportamiento con un check rápido**

Run:
```bash
node -e '
function resolverVariables(t,d){const m={};const n=d.nombre?.trim().split(" ")[0];if(n)m.nombre=n;const s=d.tienda?.trim();if(s)m.tienda=s;if(d.pedido){m.id=String(d.pedido.numero);if(d.pedido.tracking)m.tracking=d.pedido.tracking}return t.replace(/\{(\w+)\}/g,(o,k)=>m[k]??o)}
console.log(resolverVariables("Hola {nombre}! Pedido #{id}, seguimiento {tracking}",{nombre:"Ana Gómez",pedido:{numero:1284,tracking:"AR999"}}));
console.log(resolverVariables("Hola {nombre}! Pedido #{id}, seguimiento {tracking}",{nombre:"Ana",pedido:{numero:1284,tracking:null}}));
console.log(resolverVariables("Hola {nombre}! Pedido #{id}",{nombre:"Ana"}));
'
```
Expected:
```
Hola Ana! Pedido #1284, seguimiento AR999
Hola Ana! Pedido #1284, seguimiento {tracking}
Hola Ana! Pedido #{id}
```

- [ ] **Step 3: Pasar `pedido` por `PlantillaPopover`**

En `apps/web/src/modules/ventas/panel/mensajes/components/PlantillaPopover.tsx`, agregar a `Props`:

```ts
interface Props {
  plantillas:       Plantilla[]
  cv:               Conversacion | null
  tienda?:          string
  pedido?:          { numero: number; tracking: string | null }
  onSeleccionar:    (texto: string) => void
  onClose:          () => void
  onIrAPlantillas:  () => void
}
```

Y en el destructuring y el uso:

```ts
export function PlantillaPopover({ plantillas, cv, tienda, pedido, onSeleccionar, onClose, onIrAPlantillas }: Props) {
```

```ts
const preview = resolverVariables(p.texto, { nombre: cv?.cliente, tienda, pedido })
```

- [ ] **Step 4: Pasar `pedidoReciente` por `Composer`**

En `apps/web/src/modules/ventas/panel/mensajes/components/Composer.tsx`, agregar a `Props`:

```ts
  pedidoReciente?: { numero: number; tracking: string | null }
```

Destructuring: `export function Composer({ cv, plantillas, pedidos, pedidoReciente, onSend, onIrAPlantillas, onToast }: Props) {`

Y en el `<PlantillaPopover>`:

```tsx
<PlantillaPopover
  plantillas={plantillas}
  cv={cv}
  tienda={tienda}
  pedido={pedidoReciente}
  onSeleccionar={(texto) => { setDraft(texto); setShowPlantillas(false) }}
  onClose={() => setShowPlantillas(false)}
  onIrAPlantillas={onIrAPlantillas}
/>
```

- [ ] **Step 5: Calcular el pedido más reciente en `ChatPanel` y avisar cuál se usó**

En `apps/web/src/modules/ventas/panel/mensajes/components/ChatPanel.tsx`:

Primero, el tipo `PedidoResumen` en `mock/mensajes.mock.ts` gana `tracking`:

```ts
export interface PedidoResumen {
  id:     string
  fecha:  string
  estado: string
  total:  number
  tracking: string | null
}
```

En el `useEffect` que hace `getCustomer(cv.customerId)`, mapear el `tracking`:

```ts
setPedidos(c.orders.map(o => ({
  id: String(o.orderNumber),
  fecha: new Date(o.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  estado: ESTADO_LABEL[o.status] ?? o.status,
  total: o.total,
  tracking: o.tracking,
})))
```

Derivar el más reciente (los `orders` vienen `createdAt desc`, así que es `c.orders[0]`; para no depender del orden del map, tomar el primero de `pedidos`):

```ts
const pedidoReciente = pedidos[0]
  ? { numero: Number(pedidos[0].id), tracking: pedidos[0].tracking }
  : undefined
```

Pasar al `Composer` y avisar por toast cuando se usa una plantilla con `{id}`. La forma más simple: envolver el `onSeleccionar` del popover. Como `onSeleccionar` vive en `Composer`, agregar el aviso ahí: si el texto elegido difiere del `p.texto` original en el token `{id}` (o sea, se resolvió), tirar toast. Implementación mínima en `Composer.tsx` dentro de `onSeleccionar`:

```tsx
onSeleccionar={(texto) => {
  setDraft(texto)
  setShowPlantillas(false)
  if (pedidoReciente && /#\d/.test(texto) && !texto.includes('{id}')) {
    onToast(`Plantilla completada con el pedido #${pedidoReciente.numero} — cambialo si es de otro`)
  }
}}
```

- [ ] **Step 6: Typecheck + lint + chequeo en el navegador**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores nuevos (ignorar el warning preexistente de `home-v2.js`).
Run: `cd apps/web && npx eslint src/modules/ventas/panel/mensajes`
Expected: limpio.
Verificación manual: `preview_start` (dev server `apps/web`), login como owner con un negocio seed que tenga un cliente con pedidos, abrir Mensajes → una conversación → ícono de plantilla → elegir "Código de seguimiento". El `{tracking}` tiene que resolver al tracking real del último pedido (o quedar `{tracking}` si ese pedido no tiene), y `{id}` al número real. Toast confirmando qué pedido se usó.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/ventas/panel/mensajes/
git commit -m "feat(mensajes): autocompletar {id} y {tracking} con el ultimo pedido del cliente

La plantilla se resuelve contra orders[0] (el mas reciente); el texto cae
editable en el composer y un toast avisa que pedido se uso. Si el cliente
no tiene pedidos {id} queda literal; si el pedido no tiene tracking,
{tracking} queda literal.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: definir y comunicar el límite de largo de mensaje

**Parte producto (bloqueante para el número final):** llevar a Mateo / CPO la pregunta concreta. Contexto para la decisión: WhatsApp Business permite 4096 en mensajes de plantilla y ~65k en sesión; un chat de tienda son mensajes cortos. El default actual es **5000** (elegido por consistencia con `customer-email.dto.ts`). Rango razonable: 1000–5000. Si nadie define otra cosa, queda 5000 y se documenta como decisión tomada.

**Parte ingeniería (no bloqueante):** el input hoy no tiene tope del lado del cliente, así que un mensaje de 6000 caracteres se escribe entero y recién falla con un 400 genérico al enviar. Agregar `maxLength` + feedback.

**Files:**
- Modify: `apps/api/src/conversations/dto/send-message.dto.ts`, `customer-message.dto.ts` (solo si producto define ≠ 5000)
- Modify: `apps/web/src/modules/ventas/panel/mensajes/components/Composer.tsx`
- Modify: `apps/web/src/modules/ventas/cliente/perfil/components/MensajesCliente.tsx`
- Modify: `CONTRATO_API.md`

- [ ] **Step 1: Abrir la pregunta de producto**

Postear en el ticket de mensajería (buscar con `searchJiraIssuesUsingJql`, probablemente RBT-657 u otro de "Mensajería" / "Bandeja") un comentario con formato PENDIENTES:

```
[2026-09-08] Límite de largo de mensaje en el chat cliente↔tienda
Estado: ABIERTO
El DTO topea en 5000 caracteres, elegido por consistencia con customer-email
(body 5000), sin spec. ¿Es el número que quieren? Un chat de tienda son
mensajes cortos; 1000–2000 alcanzaría y da mejor feedback. Necesito confirmación
de CPO/CEO para cerrar. Mientras tanto queda 5000 y el input ya lo refleja.
```

- [ ] **Step 2: `maxLength` + contador en el composer del panel**

En `Composer.tsx`, definir la constante arriba del componente:

```ts
const MAX_MSG = 5000
```

En el `<input>`:

```tsx
<input
  className="ds-field"
  ref={inputRef}
  value={draft}
  onChange={handleChange}
  maxLength={MAX_MSG}
  onKeyDown={...}
  ...
/>
```

Y un contador que solo aparece cuando faltan menos de 200:

```tsx
{draft.length > MAX_MSG - 200 && (
  <span style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
    {draft.length}/{MAX_MSG}
  </span>
)}
```

- [ ] **Step 3: `maxLength` en el input del storefront**

En `MensajesCliente.tsx`, agregar `const MAX_MSG = 5000` y `maxLength={MAX_MSG}` en el `<input className="ds-field" ...>`. Mismo contador opcional si se quiere paridad.

- [ ] **Step 4: Documentar en el contrato**

En `CONTRATO_API.md`, en las entradas de `POST /conversations/:id/messages` y `POST /me/conversation/messages`, agregar: `text` — string, requerido, se hace trim, no vacío, máximo 5000 caracteres (400 si se pasa).

- [ ] **Step 5: Ajustar el DTO solo si producto definió otro número**

Si la respuesta es ≠ 5000, cambiar `@MaxLength(5000)` en los dos DTOs y `MAX_MSG` en los dos componentes al número confirmado, y actualizar el comentario del DTO para citar el ticket en vez de "consistencia con customer-email".

- [ ] **Step 6: Typecheck + commit**

Run: `cd apps/web && npx tsc --noEmit` · `cd apps/api && npx tsc --noEmit`

```bash
git add apps/web/src/modules/ventas/panel/mensajes/components/Composer.tsx apps/web/src/modules/ventas/cliente/perfil/components/MensajesCliente.tsx CONTRATO_API.md
git commit -m "feat(mensajes): tope de largo visible en el input (5000) + documentar en el contrato

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Deploy backend solo si el Step 5 tocó los DTOs.)

---

## Task 4: tests del módulo mensajería (e2e + unit)

Sigue los patrones de `apps/api/test/me-orders.e2e-spec.ts` (helpers `createTestApp`/`closeTestApp`, `SEED_USERS`, `SEED_BUSINESS_SLUG`) y `apps/api/test/unit/message-templates.service.unit-spec.ts` (Prisma mockeado a mano).

**Files:**
- Create: `apps/api/test/conversations.e2e-spec.ts`
- Create: `apps/api/test/unit/conversations.service.unit-spec.ts`

**Interfaces:**
- Consumes: `ConversationsService`, controllers `/conversations` y `/me/conversation` ya existentes.

- [ ] **Step 1: Unit spec — el mark-as-read no toca `updatedAt`**

Create `apps/api/test/unit/conversations.service.unit-spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from '../../src/conversations/conversations.service';

function svcCon(overrides: any = {}) {
  const conv = { id: 'cv-1', businessId: 'biz-1', customerId: 'cli-1', isUnread: true, isArchived: false, updatedAt: new Date() };
  const prisma = {
    conversation: {
      findFirst: jest.fn().mockResolvedValue(conv),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue(conv),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue(conv),
    },
    message: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'm-1', sender: 'STORE', text: 'hola', orderId: null, createdAt: new Date() }),
    },
    order: { findFirst: jest.fn().mockResolvedValue({ id: 'ord-1' }) },
    $executeRaw: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
  return { svc: new ConversationsService(prisma as any), prisma };
}

describe('ConversationsService (unit)', () => {
  it('getMessages() marca leída con $executeRaw, NO con conversation.update (no bumpea updatedAt)', async () => {
    const { svc, prisma } = svcCon();
    await svc.getMessages('biz-1', 'cv-1');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it('getMessages() no toca nada si la conversación ya estaba leída', async () => {
    const { svc, prisma } = svcCon({
      conversation: { findFirst: jest.fn().mockResolvedValue({ id: 'cv-1', businessId: 'biz-1', customerId: 'cli-1', isUnread: false }), },
    });
    // reponer los métodos que el override borró
    (svc as any).prisma.message = { findMany: jest.fn().mockResolvedValue([]) };
    (svc as any).prisma.$executeRaw = jest.fn();
    await svc.getMessages('biz-1', 'cv-1');
    expect((svc as any).prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('getMessages() tira 404 si la conversación es de otro negocio', async () => {
    const { svc } = svcCon({ conversation: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(svc.getMessages('biz-1', 'cv-ajena')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sendMessage() rechaza un orderId que no es del negocio/cliente', async () => {
    const { svc, prisma } = svcCon();
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(svc.sendMessage('biz-1', 'cv-1', { text: 'x', orderId: 'ord-ajeno' } as any))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('sendMyMessage() crea la conversación si no existe y la deja no-leída', async () => {
    const { svc, prisma } = svcCon({ conversation: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'cv-nueva' }),
      update: jest.fn(),
    }});
    (svc as any).prisma.message = { create: jest.fn().mockResolvedValue({ id: 'm-1', sender: 'CUSTOMER', text: 'hola', orderId: null, createdAt: new Date() }) };
    await svc.sendMyMessage('biz-1', 'cli-1', { text: 'hola' } as any);
    expect(prisma.conversation.create).toHaveBeenCalledWith({ data: { businessId: 'biz-1', customerId: 'cli-1', isUnread: true } });
  });
});
```

- [ ] **Step 2: Correr el unit spec**

Run: `cd apps/api && npx jest --config ./test/jest-unit.json conversations.service`
Expected: PASS (5 tests). Ajustar los `overrides` si algún mock quedó incompleto — el objetivo es que cada test arme solo lo que toca.

- [ ] **Step 3: e2e spec — esqueleto y setup**

Create `apps/api/test/conversations.e2e-spec.ts` con el mismo `beforeAll` que `me-orders` (owner + dos clientes en el mismo negocio + un cliente de otro negocio si el seed lo permite; si no, con dos clientes alcanza para la mayoría de los casos de aislamiento cliente↔cliente):

```ts
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Conversations / mensajería (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;
  let clienteAToken: string;
  let clienteBToken: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function nuevoCliente(tag: string) {
    const email = `conv-${tag}-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email, password: 'Test1234!', firstName: tag, lastName: 'Test' });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email, password: 'Test1234!' });
    return login.body.token as string;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const owner = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = owner.body.token;
    businessId = owner.body.business.id;
    clienteAToken = await nuevoCliente('a');
    clienteBToken = await nuevoCliente('b');
  });

  afterAll(async () => { await closeTestApp(app); });
```

- [ ] **Step 4: e2e — flujo cliente→tienda→cliente**

```ts
  it('cliente sin mensajes: GET /me/conversation devuelve id null y sin mensajes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me/conversation')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG).expect(200);
    expect(res.body).toEqual({ id: null, messages: [] });
  });

  it('el primer mensaje del cliente crea la conversación y aparece en la bandeja como no leída', async () => {
    await request(app.getHttpServer()).post('/api/v1/me/conversation/messages')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ text: 'Hola, consulta por mi pedido' }).expect(201);

    const bandeja = await request(app.getHttpServer()).get('/api/v1/conversations')
      .set(auth(ownerToken)).expect(200);
    const conv = bandeja.body.find((c: any) => c.lastMessage?.text === 'Hola, consulta por mi pedido');
    expect(conv).toBeTruthy();
    expect(conv.isUnread).toBe(true);
  });

  it('abrir la conversación (GET messages) la marca leída SIN reordenar la bandeja', async () => {
    const bandeja1 = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const conv = bandeja1.body[0];
    const updatedAtAntes = conv.updatedAt;

    await request(app.getHttpServer()).get(`/api/v1/conversations/${conv.id}/messages`).set(auth(ownerToken)).expect(200);

    const bandeja2 = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const convDespues = bandeja2.body.find((c: any) => c.id === conv.id);
    expect(convDespues.isUnread).toBe(false);
    expect(convDespues.updatedAt).toBe(updatedAtAntes); // el mark-as-read NO bumpeó updatedAt
  });

  it('la respuesta del staff vuelve a poner la conversación al día y el cliente la ve', async () => {
    const bandeja = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const conv = bandeja.body[0];
    await request(app.getHttpServer()).post(`/api/v1/conversations/${conv.id}/messages`)
      .set(auth(ownerToken)).send({ text: 'Hola! Ya lo despachamos' }).expect(201);

    const hilo = await request(app.getHttpServer()).get('/api/v1/me/conversation')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG).expect(200);
    expect(hilo.body.messages.map((m: any) => m.sender)).toEqual(['CUSTOMER', 'STORE']);
  });
```

- [ ] **Step 5: e2e — aislamiento y validación**

```ts
  it('cliente B no ve el hilo de cliente A', async () => {
    await request(app.getHttpServer()).post('/api/v1/me/conversation/messages')
      .set(auth(clienteBToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ text: 'soy otro cliente' }).expect(201);
    const hiloB = await request(app.getHttpServer()).get('/api/v1/me/conversation')
      .set(auth(clienteBToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG).expect(200);
    expect(hiloB.body.messages).toHaveLength(1);
    expect(hiloB.body.messages[0].text).toBe('soy otro cliente');
  });

  it('un customer no puede pegarle a la bandeja del panel (403)', async () => {
    await request(app.getHttpServer()).get('/api/v1/conversations')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG).expect(403);
  });

  it('GET de una conversación de otro id devuelve 404', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/conversations/00000000-0000-0000-0000-000000000000/messages')
      .set(auth(ownerToken)).expect(404);
  });

  it('mensaje vacío o de solo espacios → 400', async () => {
    const bandeja = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const convId = bandeja.body[0].id;
    await request(app.getHttpServer()).post(`/api/v1/conversations/${convId}/messages`)
      .set(auth(ownerToken)).send({ text: '   ' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/me/conversation/messages')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ text: '' }).expect(400);
  });

  it('mensaje de más de 5000 caracteres → 400', async () => {
    await request(app.getHttpServer()).post('/api/v1/me/conversation/messages')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ text: 'x'.repeat(5001) }).expect(400);
  });

  it('sendMessage del staff con un orderId que no es del cliente → 404', async () => {
    const bandeja = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const convId = bandeja.body[0].id;
    await request(app.getHttpServer()).post(`/api/v1/conversations/${convId}/messages`)
      .set(auth(ownerToken))
      .send({ text: 'sobre tu pedido', orderId: '00000000-0000-0000-0000-000000000000' }).expect(404);
  });

  it('unread-count refleja las conversaciones sin leer del negocio', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/conversations/unread-count').set(auth(ownerToken)).expect(200);
    expect(typeof res.body.count).toBe('number');
  });
```

- [ ] **Step 6: Correr el e2e completo**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --forceExit --detectOpenHandles --runInBand conversations`
Expected: todos PASS. Si el seed no permite crear pedidos para probar el caso "orderId sí válido", alcanza con el caso negativo (404) — anotarlo como TODO en el archivo, no bloquear.

- [ ] **Step 7: Correr toda la suite unit + e2e para no romper nada**

Run: `cd apps/api && npx jest --config ./test/jest-unit.json` (esperado: 194+ pass)
Run: `cd apps/api && npm run test:e2e` (esperado: verde; si algún e2e ajeno estaba frágil de antes, anotarlo, no arreglarlo acá)

- [ ] **Step 8: Commit**

```bash
git add apps/api/test/conversations.e2e-spec.ts apps/api/test/unit/conversations.service.unit-spec.ts
git commit -m "test(mensajes): cobertura e2e + unit del modulo conversations

Flujo cliente->tienda->cliente, mark-as-read que no reordena la bandeja,
aislamiento negocio/cliente, validacion de texto y de orderId de mencion.
El modulo no tenia ningun test.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Sin deploy — solo tests.)

---

## Task 5: sacar el preview muerto de "Usar plantilla"

`ModalUsarPlantilla` en `Plantillas.tsx` se abre con `cv={null}` y su `onEnviar` solo hace `onToast('Mensaje enviado: "..."')` — no manda nada. La forma real de usar una plantilla es desde el composer de una conversación (`PlantillaPopover`), que sí funciona. La acción "Usar" en la pantalla de gestión no tiene destino válido.

**Decisión:** eliminar la acción "Usar" de la pantalla de Plantillas. La pantalla queda solo para CRUD (crear/editar/borrar/previsualizar en el card).

**Files:**
- Modify: `apps/web/src/modules/ventas/panel/mensajes/Plantillas.tsx`
- Modify: `apps/web/src/modules/ventas/panel/mensajes/components/PlantillaCard.tsx`
- Delete: `apps/web/src/modules/ventas/panel/mensajes/components/ModalUsarPlantilla.tsx`

- [ ] **Step 1: Sacar `modalUsar` de `Plantillas.tsx`**

Eliminar: el import de `ModalUsarPlantilla`, el `useState` `modalUsar`/`setModalUsar`, el bloque `{modalUsar && (<ModalUsarPlantilla ... />)}`, y la prop `onUsar={(pl) => setModalUsar(pl)}` que se le pasa a `<PlantillaCard>`. Si `tienda`/`useAuth` quedaron solo para ese modal, sacarlos también (revisar si se usan en otro lado del archivo antes de borrar).

- [ ] **Step 2: Sacar el botón "Usar" de `PlantillaCard.tsx`**

Quitar la prop `onUsar` de `Props`, el botón/acción que la dispara, y cualquier import de ícono que quede sin uso. Dejar "Editar" y "Eliminar".

- [ ] **Step 3: Borrar el componente huérfano**

```bash
git rm apps/web/src/modules/ventas/panel/mensajes/components/ModalUsarPlantilla.tsx
```

Verificar que nadie más lo importa: `grep -rn "ModalUsarPlantilla" apps/web/src` → sin resultados.

- [ ] **Step 4: Typecheck + lint + navegador**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores (si `resolverVariables` quedó importado sin uso en algún lado, limpiarlo).
Run: `cd apps/web && npx eslint src/modules/ventas/panel/mensajes`
Verificación manual: entrar a Mensajes → Plantillas. Los cards muestran solo Editar/Eliminar. Crear y editar siguen andando. Ir a una conversación → el ícono de plantilla del composer sigue insertando texto resuelto.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/ventas/panel/mensajes/
git commit -m "refactor(mensajes): sacar 'Usar plantilla' de la pantalla de gestion

El modal se abria con cv=null y su onEnviar solo tiraba un toast, no
mandaba nada. Las plantillas se usan desde el composer de la conversacion
(PlantillaPopover), que si funciona. La pantalla de Plantillas queda para
CRUD.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Hallazgos de la auditoría fuera del alcance de este plan

No están en los cuatro ítems pedidos, pero quedaron anotados y probablemente merezcan su propio ticket:

- **El dueño no se entera de un mensaje nuevo si no está mirando la bandeja.** `sendMyMessage` no crea ninguna fila en `Notification`. Hay un motor de notificaciones (`docs/superpowers/plans/2026-08-14-motor-notificaciones.md`); engancharlo acá, con dedupe para que 5 mensajes seguidos no generen 5 notificaciones.
- **El dueño no puede iniciar una conversación.** No existe `POST /conversations`. El staff solo responde hilos que el cliente arrancó. El flujo post-compra que hoy le promete el producto al cliente ("te contactamos por WhatsApp") es WhatsApp, no este módulo. Definir con producto si el chat interno tiene que poder iniciarse desde el panel.
- **Compradores guest (checkout sin cuenta) no pueden usar mensajería** — no tienen `customerId`. Decisión de producto.
- **Sin paginación.** `findAllForBusiness` trae todas las conversaciones (+ join de cliente + último mensaje) en cada poll de 2.5s; `getMessages`/`myThread` traen el hilo entero. Agregar `take`/cursor y filtro de archivados.
- **No es tiempo real** — polling 2.5s de los dos lados, sin WebSocket/SSE. Aceptable para MVP, listado para visibilidad.

---

## Self-Review

**Cobertura del spec:**
1. `{id}`/`{tracking}` autocompletado → Task 1 (backend `tracking`) + Task 2 (frontend). ✅
2. Límite de largo definido y comunicado → Task 3 (pregunta a producto + `maxLength` en inputs + `CONTRATO_API.md`). ✅
3. Tests del módulo → Task 4 (e2e + unit, con regresión explícita del bug de reordenamiento y de las validaciones). ✅
4. Preview muerto de "Usar plantilla" → Task 5 (eliminar la acción + borrar el componente). ✅

**Placeholders:** los steps de código traen el código real. Los steps de verificación traen el comando exacto y el resultado esperado. Task 3 Step 1 depende de una respuesta de producto — está marcado como tal, con default explícito (5000) para no bloquear.

**Consistencia de tipos:** `resolverVariables(texto, { nombre?, tienda?, pedido? })` con `pedido?: { numero: number; tracking: string | null }` se usa igual en `mensajes.mock.ts`, `PlantillaPopover.tsx` (prop `pedido`) y `Composer.tsx` (prop `pedidoReciente` que se pasa como `pedido`). `PedidoResumen.tracking: string | null` y `ApiCustomerDetail['orders'][number].tracking: string | null` alineados. Los nombres de test (`-t "..."`) coinciden con los `it(...)` escritos.

## Execution Handoff

**Plan completo y guardado en `docs/superpowers/plans/2026-09-08-mensajeria-deuda-tecnica.md`. Dos opciones de ejecución:**

**1. Subagent-Driven (recomendado)** — dispatch un subagente fresco por task, review entre tasks, iteración rápida.

**2. Inline Execution** — ejecutar las tasks en esta sesión con executing-plans, ejecución en lote con checkpoints.

Las 5 tasks son independientes salvo Task 2, que depende de Task 1. Se pueden repartir.

**¿Qué approach?**
