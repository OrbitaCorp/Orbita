# Orbi — Fase 1: arreglar la base — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que Orbi del panel ejecute escrituras de forma segura, recuerde la conversación, guarde propuestas y cuota en Postgres, se pueda cortar, se mida y exista en el celular.

**Architecture:** cambios aditivos en la API NestJS (`apps/api/src/orbi`, `common/cuota`, `common/permisos`) sobre tres tablas nuevas (`orbi_pending_actions`, `daily_quota`, `orbi_turns`), y en el front Next.js (`apps/web/src/components/orbi`). El flujo propone→confirma se conserva y pasa a Postgres.

**Tech Stack:** NestJS + Prisma 6 + Jest (API); Next.js 16 pages router + zustand + vitest en entorno `node` (web).

**Spec:** [`docs/superpowers/specs/2026-09-30-orbi-fase-1-base-design.md`](../specs/2026-09-30-orbi-fase-1-base-design.md). **Cada tarea cita la sección del spec que implementa; el implementador lee esa sección completa antes de empezar.** Si el código real contradice el spec, se frena y se avisa; no se improvisa.

## Global Constraints

- **Rama:** `feat/orbi-fase-1`. Commits chicos, uno por tarea (o más). **Nunca** `git push`, ni merge a `main`, ni `deploy.sh`, ni tocar la base de producción: eso lo decide Alan al final.
- **Comandos API** (desde `apps/api`): typecheck `pnpm typecheck`; unit `pnpm exec jest --config ./test/jest-unit.json <ruta>`; src `pnpm exec jest --config ./test/jest-src.json <ruta>`; todo `pnpm test`. Un `pnpm exec jest <ruta>` sin `--config` NO funciona.
- **Comandos web** (desde `apps/web`): `pnpm exec tsc --noEmit`, `pnpm test` (vitest, entorno `node`: los tests de front son de lógica pura, sin DOM).
- **Base local = DEV** (`hhaqlzrcskmwnvhgydon`). Solo se migra dev. Producción NO se toca (`deploy/prisma-prod.sh` no se corre).
- **La migración es solo aditiva:** el SQL generado debe tener únicamente `CREATE TABLE`, `CREATE INDEX` y `ADD CONSTRAINT` sobre tablas nuevas.
- **Estilo:** comentarios en español rioplatense explicando el porqué (como el código vecino), sin emojis. Archivos con CRLF se editan conservando CRLF (`git ls-files --eol <archivo>`).
- **Orbi del wizard queda congelado:** no cambiar su comportamiento, salvo lo que el spec pide explícito (ids únicos, corte, metering, cuota compartida).
- **Sin datos personales en logs, en notas de conversación ni en `orbi_turns`.**
- **Textos de la UI en español argentino (voseo).** Botones con texto, foco visible, área táctil de 44 px, colores de tokens del tema.
- **Antes de explorar código:** `graphify query "<pregunta>"` (regla del CLAUDE.md del repo; también vale para subagentes).
- **Verificación de cierre de cada tarea:** typecheck del paquete tocado + tests de la tarea + los tests ya existentes del área en verde.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `apps/api/prisma/schema.prisma` + migración `*_orbi_fase1_base` | 3 modelos nuevos y relaciones en `Business` |
| `apps/api/src/common/cuota/cuota.module.ts`, `cuota.service.ts` | Cuota diaria compartida en Postgres (reemplaza `CuotaDiaria`) |
| `apps/api/src/common/utils/hash-ip.ts` | `hmacIp(contexto, ip)` extraído de `DemoIaService` |
| `apps/api/src/common/permisos/catalogo.ts` | `PERMISSIONS` y `CODIGOS_DEL_CATALOGO` compartidos |
| `apps/api/src/orbi/permisos-orbi.ts` | `permisosDeOrbi(user)` |
| `apps/api/src/orbi/tools/pending-action.service.ts` | Acciones pendientes en Postgres (reemplaza `PendingActionStore`) |
| `apps/api/src/orbi/tools/acciones/validar-args.ts` | Validación de argumentos con el DTO del endpoint |
| `apps/api/src/orbi/conversation/conversation.service.ts` | Append atómico |
| `apps/api/src/orbi/orbi-turn.service.ts` | Escritura de `orbi_turns` |
| `apps/api/src/orbi/navegacion/secciones.ts` | Espejo de `SECCIONES_DEL_PANEL` |
| `apps/web/src/components/orbi/sseParser.ts` | Parser SSE puro |
| `apps/web/src/components/orbi/useOrbiChat.ts`, `useOrbiStore.ts`, `OrbiMessages.tsx`, `OrbiPanel.tsx`, `types.ts` | Front del chat |
| `apps/web/src/layouts/components/Header.tsx`, `tutoriales/anclas.ts` | Botón de Orbi en el celular |

## Orden y dependencias

T1 (schema) → T2 (cuota) → T3 (permisos) → T4 (escrituras seguras) → T5 (acciones en Postgres) → T6 (memoria) → T7 (corte + metering + telemetría) → T8 (retención) → T9 (navigateTo) → T10 (parser SSE + CI) → T11 (store y abort) → T12 (tarjeta) → T13 (celular) → T14 (e2e y cierre).
Las tareas T2–T7 editan `orbi.controller.ts`: **se ejecutan en serie, nunca en paralelo.**

---

### Task 1: Modelos y migración

**Spec:** §3.4 (modelo `OrbiPendingAction`), §3.5 (`DailyQuota`), §3.6 (`OrbiTurn`), §5.

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (3 modelos + relaciones inversas en `Business`)
- Create: `apps/api/prisma/migrations/<timestamp>_orbi_fase1_base/migration.sql` (lo genera Prisma)

**Interfaces:**
- Produces: `prisma.orbiPendingAction`, `prisma.dailyQuota`, `prisma.orbiTurn` con los campos exactos del spec (los tres bloques `model` de §3.4, §3.5 y §3.6, copiados tal cual). `Business` suma `orbiPendingActions OrbiPendingAction[]` y `orbiTurns OrbiTurn[]`.

- [ ] **Step 1:** Copiar los tres modelos del spec al `schema.prisma` y sumar las dos relaciones inversas en `Business`. `DailyQuota` no lleva relación (la clave es un string con prefijo).
- [ ] **Step 2:** `cd apps/api && pnpm exec prisma validate` → debe pasar.
- [ ] **Step 3:** Generar la migración contra DEV: `pnpm exec prisma migrate dev --name orbi_fase1_base --create-only` (no la aplica).
- [ ] **Step 4:** Abrir el `migration.sql` y comprobar que solo tiene `CREATE TABLE "orbi_pending_actions"`, `"daily_quota"`, `"orbi_turns"`, sus `CREATE INDEX` y `ADD CONSTRAINT ... FOREIGN KEY` hacia `businesses`. Si hay cualquier `ALTER`/`DROP` sobre tablas existentes, frenar y avisar.
- [ ] **Step 5:** Aplicar en DEV: `pnpm exec prisma migrate deploy`; luego `pnpm exec prisma generate`.
- [ ] **Step 6:** `pnpm typecheck` en `apps/api`.
- [ ] **Step 7: Commit** — `feat(orbi): tablas de acciones pendientes, cuota diaria y turnos`.

---

### Task 2: Cuota diaria compartida

**Spec:** §3.5 completo.

**Files:**
- Create: `apps/api/src/common/utils/hash-ip.ts`, `apps/api/src/common/cuota/cuota.service.ts`, `apps/api/src/common/cuota/cuota.module.ts`
- Modify: `apps/api/src/demo/demo-ia.service.ts` (usa `hmacIp`), `apps/api/src/orbi/orbi.controller.ts`, `apps/api/src/orbi/orbi.module.ts`, `apps/api/src/products/products.controller.ts` y su módulo, `apps/api/src/image-studio/image-studio.controller.ts` y su módulo
- Delete: `apps/api/src/orbi/cuota-diaria.ts` (solo cuando no queden usos)
- Test: `apps/api/test/unit/cuota.service.unit-spec.ts`, `apps/api/test/unit/hash-ip.unit-spec.ts`; adaptar los tests que hoy usan `CuotaDiaria`

**Interfaces:**
- Produces:
  ```ts
  // hash-ip.ts
  export function hmacIp(contexto: string, ip: string | undefined): string; // HMAC-SHA256 con JWT_SECRET; mismo resultado que DemoIaService.claveDe
  // cuota.service.ts
  @Injectable() export class CuotaService {
    constructor(prisma: PrismaService);
    consumir(clave: string, limite: number): Promise<boolean>; // true = entra; false = tope alcanzado
  }
  ```
  `CuotaModule` es `@Global()` o se importa donde se use (seguir la convención de `PrismaModule`).
- Claves (una por cada instancia actual de `CuotaDiaria`, con prefijo): `orbi-panel:<businessId>`, `orbi-wizard:<hmacIp('orbi-wizard', ip)>`, y las de `ai-assist`, `ai-variants`, `ai-scan` (products) e `image-studio` (mismos límites de hoy). El `day` es `fechaArgentina()` (ver `cuota-diaria.ts` y `DemoIaService`, string `YYYY-MM-DD`).

- [ ] **Step 1: Test que falla — hash-ip.** `hmacIp('demo-ia','1.2.3.4')` es determinístico, distinto por contexto, distinto por IP, no contiene la IP en claro, y con `ip` indefinido no rompe. Además, caracterización: para varias entradas devuelve exactamente lo mismo que el `claveDe` actual de `DemoIaService` (copiar la fórmula al test contra el valor esperado, así el refactor no cambia las claves de `demo-ia`).
- [ ] **Step 2:** Correr → falla (módulo no existe). Implementar `hash-ip.ts` extrayendo la lógica de `DemoIaService.claveDe`; hacer que `DemoIaService` la use. Correr `test/unit` de demo → verde.
- [ ] **Step 3: Test que falla — CuotaService** (mock de `prisma.$queryRaw`): con fila devuelta → `true`; con `[]` → `false`; el SQL usa `ON CONFLICT (key, day) DO UPDATE SET count = daily_quota.count + 1 WHERE daily_quota.count < $3 RETURNING count` y pasa `fechaArgentina()` como `day` (verificar la query armada, no solo el resultado).
- [ ] **Step 4: Implementar `CuotaService`:**
  ```ts
  async consumir(clave: string, limite: number): Promise<boolean> {
    const dia = fechaArgentina(); // 'YYYY-MM-DD'
    const filas = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO daily_quota (key, day, count) VALUES (${clave}, ${dia}, 1)
      ON CONFLICT (key, day) DO UPDATE SET count = daily_quota.count + 1
      WHERE daily_quota.count < ${limite}
      RETURNING count`;
    return filas.length > 0;
  }
  ```
- [ ] **Step 5:** Migrar los usos: `orbi.controller.ts` (`await this.cuotaService.consumir(...)`, misma respuesta 429 y mismos límites `TURNOS_DIA_NEGOCIO`/`TURNOS_DIA_IP_WIZARD`; en el wizard la clave usa `hmacIp('orbi-wizard', ip)`), `products.controller.ts`, `image-studio.controller.ts`. Registrar `CuotaModule` en los módulos que corresponda. Los `consumir` pasan a `await`.
- [ ] **Step 6:** Buscar con Grep que no quede ningún `CuotaDiaria`/`cuota-diaria` y borrar `orbi/cuota-diaria.ts` y su test si existe. Adaptar los tests que la usaban (`test/unit/orbi.auditoria.unit-spec.ts`, tests de products/image-studio) a un `CuotaService` mockeado.
- [ ] **Step 7:** `pnpm typecheck` y `pnpm test` completos → verde.
- [ ] **Step 8: Commit** — `feat(cuota): cuota diaria compartida en Postgres para Orbi y las IA de productos`.

---

### Task 3: Permisos reales

**Spec:** §3.1 completo (mapeo, `permisosDeOrbi`, snapshot por permiso, `getCustomerDetail`).

**Files:**
- Create: `apps/api/src/common/permisos/catalogo.ts`, `apps/api/src/orbi/permisos-orbi.ts`
- Modify: `apps/api/src/onboarding/onboarding.service.ts` (importa el catálogo), todas las tools de `apps/api/src/orbi/tools/definitions/*.ts`, `apps/api/src/orbi/context/context-builder.service.ts`, `apps/api/src/orbi/orbi.controller.ts` (`chat` y `confirm`), `apps/api/test/evals/run.ts` si llama a `buildSystemPrompt`
- Test: `apps/api/src/orbi/permisos-orbi.spec.ts`, `apps/api/src/orbi/tools/tool-catalog.spec.ts`, `apps/api/src/orbi/context/context-builder.spec.ts`, `apps/api/src/orbi/tools/definitions/product.tools.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // catalogo.ts
  export const PERMISSIONS: { group: string; code: string; label: string }[]; // movido tal cual de onboarding.service.ts
  export const CODIGOS_DEL_CATALOGO: string[]; // PERMISSIONS.map(p => p.code)
  // permisos-orbi.ts
  export function permisosDeOrbi(user: { roleName?: string; permissions: string[] }): string[];
  // context-builder.service.ts
  buildSystemPrompt(dto: OrbiChatDto, permisos: string[] = []): Promise<string>;
  ```
  (Confirmar en `AuthContext`/`MemberContext` el nombre real del campo del rol y del array de permisos; el guard usa `roleName === 'owner'`.)

- [ ] **Step 1: Test que falla — catálogo** (`tool-catalog.spec.ts`), las invariantes del spec §3.2 (1, 2, 3, 5 acá; la 4 va en T4): (1) todo `requiredPermissions` de toda tool existe en `CODIGOS_DEL_CATALOGO`; (2) toda tool sin `requiresConfirmation` figura en una lista explícita `SOLO_LECTURA` declarada en el test (una tool nueva que escribe y no está marcada rompe); (3) toda tool del panel que lee datos del negocio pide al menos un permiso, con excepción `navigateTo`; (5) se mantienen las de zona prohibida y "ningún parámetro `businessId`". Reemplazar las que usaban `endsWith(':write')`.
- [ ] **Step 2: Test que falla — `permisosDeOrbi`**: owner recibe todos los códigos aunque `permissions` esté vacío; un rol común recibe exactamente los suyos.
- [ ] **Step 3: Test que falla — snapshot** (`context-builder.spec.ts`): sin permisos no hay snapshot de ningún módulo; con `reports.dashboard` el de `dashboard`; con `orders.view` el de `pedidos`; con `customers.view` `clientes`; con `catalog.view` `catalogo`; con `messages.view` `mensajes`; con un permiso ajeno, nada. Y `getCustomerDetail` no devuelve DNI, email, teléfono, direcciones ni asuntos de mails (test en `customer.tools` con un cliente mockeado con todos esos campos y aserciones de ausencia).
- [ ] **Step 4:** Correr los tres → fallan.
- [ ] **Step 5: Implementar:** mover `PERMISSIONS` al catálogo (onboarding lo importa; `prisma/seed.ts` NO se toca), crear `permisosDeOrbi`, mapear cada tool según la tabla del spec §3.1 (`createProduct`→`catalog.manage`; `createDiscount`/`createCoupon`→`discounts.manage`; `updateOrderStatus`→`orders.manage`; `updateBusinessInfo`/`updatePaymentMethods`/`updateShipping`→`config.edit`; `generateDescription`→`catalog.manage` sin confirmación; `listOrders`/`getOrderDetail`→`orders.view`; `listCustomers`/`getCustomerDetail`→`customers.view`; `listProducts`→`catalog.view`; `listDiscounts`→`discounts.view`; reportes sin cambios). `generateDescription` consume la cuota `ai-assist:<businessId>` con el mismo límite que `POST /products/ai-assist` (inyectar `CuotaService` en la tool o en su wrapper; si la tool devuelve error de cuota, `success:false`).
- [ ] **Step 6:** `buildSystemPrompt(dto, permisos = [])` con el snapshot condicionado por la tabla del spec. En `chat` y `confirm` usar `permisosDeOrbi(user)` (en vez de `user.permissions`) para `getTools`, `toolCtx.permissions`, `buildSystemPrompt` y la ejecución. **`reject` no chequea permisos** (se crea en T5). `chatWizard` y las evals siguen sin permisos.
- [ ] **Step 7:** Reducir `getCustomerDetail` a mapeo campo por campo (nombre, métricas, pedidos resumidos, localidad), igual criterio que `getOrderDetail`.
- [ ] **Step 8:** Adaptar `product.tools.spec.ts` y los demás specs que mencionan `:write`. `pnpm typecheck` y `pnpm test` → verde.
- [ ] **Step 9: Commit** — `fix(orbi): permisos reales en las tools y en el snapshot del prompt`.

---

### Task 4: Escrituras seguras

**Spec:** §3.2 completo.

**Files:**
- Create: `apps/api/src/orbi/tools/acciones/validar-args.ts`
- Modify: `apps/api/src/orbi/tools/tool.interface.ts` (opcional `validarArgs?`), las tools con `requiresConfirmation` (`product.tools.ts`, `discount.tools.ts`, `order.tools.ts`, `config.tools.ts`), `apps/api/src/orbi/tools/tool-registry.service.ts` (`proponer` async y con `soloLectura`), `apps/api/src/orbi/orbi.controller.ts`
- Test: `tool-catalog.spec.ts` (invariante 4), specs nuevos por tool, `tool-registry.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // validar-args.ts
  export async function validarConDto<T extends object>(Dto: new () => T, args: Record<string, unknown>): Promise<{ ok: true; valor: T } | { ok: false; error: string }>;
  // tool.interface.ts
  describirAccion?(args: Record<string, unknown>): string | Promise<string>; // ahora puede resolver nombres (pedido, cliente) con la base
  // tool-registry.service.ts
  proponer(name, args, ctx, stepName?, opciones?: { soloLectura?: boolean }): Promise<{ resumen: string } | { error: string } | null>;
  ```
  `proponer` devuelve `null` si la tool no se propone (lectura, sin permiso, demo), `{ error }` si el DTO rechaza los argumentos (el controller se lo pasa al modelo como resultado de la tool, sin crear tarjeta), `{ resumen }` si se puede proponer.

- [ ] **Step 1: Test que falla — describirAccion por tool** (uno por tool de escritura). Cada test arma argumentos con valores centinela distintos por propiedad de `parameters` y afirma que **cada centinela aparece en el resumen**; los textos libres salen entre comillas, sin saltos de línea y truncados a 80 caracteres. Casos específicos del spec: `updateOrderStatus` incluye número de pedido, cliente, estado actual → nuevo, y la frase de que le llega un mail al comprador (y de stock cuando corresponda); `updatePaymentMethods` incluye `transferAlias`; `updateShipping` incluye política de envío y transportistas; `createProduct` incluye estado (publicado/borrador) y descripción truncada; `createDiscount`/`createCoupon` incluyen alcance, fechas y cantidad de productos.
- [ ] **Step 2: Test que falla — validación DTO.** Para cada tool de escritura: argumentos que el DTO de su endpoint rechaza (código de cupón con caracteres inválidos o de más de 40, nombre de más de 120, `productIds` que no son UUID, `transferAlias` de más de 60) → `proponer` devuelve `{ error }` y NO `{ resumen }`.
- [ ] **Step 3: Test que falla — demo.** `proponer(..., { soloLectura: true })` devuelve `null` para una tool de escritura con permiso.
- [ ] **Step 4: Invariante 4** en `tool-catalog.spec.ts`: para toda tool con `requiresConfirmation`, generar args centinela desde `parameters` y afirmar que cada valor aparece en `describirAccion`.
- [ ] **Step 5:** Correr → fallan. Implementar `validarConDto` (`plainToInstance` con `enableImplicitConversion: false` + `validate` con `whitelist: true, forbidNonWhitelisted: true`; el error es un texto corto con el primer motivo, sin volcar el objeto). Ubicar los DTO reales de cada endpoint (`products`, `discounts`, `coupons`, `orders`, `businesses`/config) con Grep y reusarlos.
- [ ] **Step 6:** Reescribir `describirAccion` de las tools según el spec. Para `updateOrderStatus`, resolver número de pedido/cliente/estado actual con `prisma.order` **acotado por `businessId`** (la tool ya recibe `ctx`; si `describirAccion` necesita `ctx`, cambiar la firma a `describirAccion(args, ctx)`). Si el pedido no existe, `proponer` devuelve `{ error: 'Pedido no encontrado' }`.
- [ ] **Step 7:** `proponer` pasa a `async`, recibe `opciones.soloLectura`, valida con el DTO dentro de la tool (`validarArgs` opcional en la interfaz, que la tool implementa con `validarConDto`). En `orbi.controller.ts`: `await proponer(...)`; si vuelve `{ error }`, se devuelve al modelo como resultado de tool (`{ success:false, error }`), sin `action_pending`; en la demo se pasa `soloLectura: esDemo`.
- [ ] **Step 8:** `pnpm typecheck` y `pnpm test` → verde.
- [ ] **Step 9: Commit** — `feat(orbi): las escrituras muestran cada valor, validan con el DTO del endpoint y la demo no propone`.

---

### Task 5: Acciones pendientes en Postgres y confirmar/cancelar

**Spec:** §3.4 completo (proponer, confirmar, cancelar, nota) y el contrato de §4.

**Files:**
- Create: `apps/api/src/orbi/tools/pending-action.service.ts`, `apps/api/src/orbi/tools/acciones/nota-conversacion.ts`
- Modify: `apps/api/src/orbi/orbi.controller.ts` (`chat` usa el servicio; `confirm` nuevo; `reject` nuevo), `apps/api/src/orbi/dto/orbi-chat.dto.ts` (`RejectActionDto`), `apps/api/src/orbi/orbi.module.ts`
- Delete: `apps/api/src/orbi/tools/pending-action.store.ts` y `test/unit/orbi-pending-actions.unit-spec.ts` (se reemplaza)
- Test: `apps/api/test/unit/orbi-pending-actions.unit-spec.ts` (nuevo contenido), `nota-conversacion.spec.ts`, `orbi.controller.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  @Injectable() export class PendingActionService {
    crear(a: { tool: string; args: Record<string, unknown>; businessId: string; memberId: string; conversationId: string | null; resumen: string }): Promise<string>; // id = randomBytes(16).toString('hex'), expiresAt = ahora + 10 min
    consumir(id: string, businessId: string, memberId: string): Promise<
      | { tipo: 'ejecutar'; accion: FilaPendiente }
      | { tipo: 'resuelta'; result: ToolResult }
      | { tipo: 'aplicando' } | { tipo: 'desconocido' } | { tipo: 'no_disponible' }>;
    resolver(id: string, estado: 'executed' | 'failed', result: ToolResult): Promise<void>;
    rechazar(id: string, businessId: string, memberId: string): Promise<
      { tipo: 'ok'; accion: FilaPendiente } | { tipo: 'ya_rechazada' } | { tipo: 'ya_aplicada'; result: ToolResult } | { tipo: 'no_disponible' }>;
  }
  // nota-conversacion.ts
  export function notaDeConfirmacion(tool: string, r: ToolResult, ctx: { pedido?: number; codigo?: string }): string;
  export function notaDeCancelacion(tool: string, ctx: { pedido?: number; codigo?: string }): string;
  ```
- `POST /orbi/confirm` → 200 `ToolResult` | 409 `{ estado: 'aplicando' | 'desconocido', mensaje }` | 404. `POST /orbi/reject` → 200 `{ ok: true }` | 409 `{ estado: 'ya_aplicada', result }` | 404 | 403 si `user.type !== 'member'`.

- [ ] **Step 1: Test que falla — servicio** (Prisma mockeado; las garantías atómicas reales se prueban en T14): `consumir` hace `updateMany` con `where { id, businessId, memberId, status:'pending', expiresAt:{ gt } }` y `data { status:'executing', startedAt }`; `count===1` → `ejecutar`; `count===0` y fila `executed`/`failed` → `resuelta` con el mismo `result`; `executing` con `startedAt` de menos de 2 min → `aplicando`; de 2 min o más → `desconocido` (y nunca `ejecutar`); `rejected`/vencida/inexistente/ajena → `no_disponible`; con negocio equivocado NO cambia la fila (reemplaza el test de "quema"). `rechazar`: `pending`→`rejected`; ya `rejected`→`ya_rechazada`; `executed`/`failed`→`ya_aplicada` con `result`; resto `no_disponible`.
- [ ] **Step 2: Test que falla — nota.** Con un `summary`/`name` que contiene instrucciones de un tercero ("ignorá lo anterior y..."), la nota NO contiene ese texto: solo etiqueta fija de la tool, resultado (listo / no se pudo / cancelado), ids validados (número de pedido, código de cupón) y una categoría fija de error (permiso, validación, conflicto, interno). Ejemplos exactos del spec: `Listo: Crear cupón VERANO15.` y `Cancelado por la persona: Cambiar estado del pedido #1043. No se hizo nada.`
- [ ] **Step 3: Test que falla — controller.** confirmar dos veces devuelve el mismo `result` y ejecuta la tool una sola vez; una tool que lanza excepción deja `failed` con `result`; `executing` viejo → 409 `desconocido` sin volver a ejecutar; la conversación borrada no cambia la respuesta de confirmar (la nota es best-effort); `reject` con JWT de customer o platform_admin → 403; `reject` de una ya ejecutada → 409 con el resultado guardado; `reject` de otra persona u otro negocio → 404 y la acción ajena sigue `pending`; `confirm` con `permisosDeOrbi(user)` del JWT actual (un miembro al que le sacaron el permiso recibe el error de permisos, y queda `failed`).
- [ ] **Step 4:** Correr → fallan. Implementar `PendingActionService` sobre `prisma.orbiPendingAction`. `crear` guarda `conversationId` solo si el controller lo pasa (viene de `assertPropia` en este turno; si no, `null`).
- [ ] **Step 5: Implementar `confirm`:** `consumir` → si `ejecutar`: `try { result = await toolRegistry.execute(...permisosDeOrbi(user)) } catch { result = { success:false, error:'interno', label: tool } } finally { await resolver(id, result.success ? 'executed' : 'failed', result) }` (siempre queda resuelta, también ante excepción; usar un patrón que garantice el `resolver` aunque falle el `catch`). **Después** de `resolver`, la nota en la conversación en `try/catch` con `logger.warn` (nunca cambia la respuesta): `conversationService.appendMessage(accion.conversationId, ..., { role:'assistant', content: notaDeConfirmacion(...), timestamp })`, solo si `conversationId` no es null. Mapear los otros tipos a 200/409/404 según el spec.
- [ ] **Step 6: Implementar `reject`** (`@Post('reject')`, mismo throttle que confirm, sin chequeo de permisos, `if (user.type !== 'member') throw ForbiddenException`).
- [ ] **Step 7:** En `chat`, reemplazar `pendingActions.crear` por `await pendingActions.crear({... conversationId })` (solo la conversación verificada del turno; `null` en demo/wizard). Los ids `actionId` no cambian de formato.
- [ ] **Step 8:** Borrar `PendingActionStore` y su test viejo; adaptar `orbi.controller.spec.ts` y `orbi.module.ts`. `pnpm typecheck` y `pnpm test` → verde.
- [ ] **Step 9: Commit** — `feat(orbi): acciones pendientes en Postgres; confirmar idempotente y cancelar`.

---

### Task 6: Memoria de conversación

**Spec:** §3.3 (servidor).

**Files:**
- Modify: `apps/api/src/orbi/conversation/conversation.service.ts`, `apps/api/src/orbi/orbi.controller.ts` (`chat`), `apps/api/src/orbi/llm/gemini.adapter.ts`
- Test: `apps/api/test/unit/conversation.service.unit-spec.ts` (o el existente), `orbi.controller.spec.ts`, `apps/api/src/orbi/llm/gemini.adapter.spec.ts`

**Interfaces:**
- Produces: `ConversationService.appendMessage(conversationId, businessId, memberId, msg)` con el `UPDATE` atómico del spec (mismo contrato: si no afecta filas → `NotFoundException`/misma señal de hoy). `ConversationService.crear(businessId, memberId, surface)` que devuelve la conversación nueva. El primer evento del stream del panel es `event: conversation\ndata: {"id":"<uuid>"}`.

- [ ] **Step 1: Test que falla — append atómico** (mock `$executeRaw`): se ejecuta UN statement `UPDATE orbi_conversations SET messages = (SELECT COALESCE(jsonb_agg(m ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(messages || $1::jsonb) WITH ORDINALITY AS t(m, i) WHERE i > jsonb_array_length(messages || $1::jsonb) - 200), updated_at = now() WHERE id = $2 AND business_id = $3 AND user_id = $4`; si afecta 0 filas lanza el mismo error que hoy. No hay `findUnique` + `update` de lectura-modificación-escritura.
- [ ] **Step 2: Test que falla — controller.** (a) `conversation` es el PRIMER evento (antes de cualquier `text`); (b) con `conversationId` propio se usa y se carga el historial (últimos `HISTORIAL_PANEL`); (c) con id ajeno o inexistente se crea una conversación nueva y no hay error ni pista de que "existe"; (d) no se llama a `getOrCreate`; (e) al armar el historial se descartan los mensajes con contenido vacío; (f) en la demo (`esDemo`) no se emite `conversation` ni se guarda nada.
- [ ] **Step 3: Test que falla — Gemini.** `GeminiAdapter` une entradas consecutivas del mismo rol (`user,user` y `assistant,assistant`) en un solo `content` al armar `contents`, y descarta mensajes vacíos.
- [ ] **Step 4:** Correr → fallan. Implementar el `UPDATE` atómico con `$executeRaw` (cuidando el cast `::jsonb` del parámetro serializado como `JSON.stringify([msg])`). Implementar en `chat`: resolver conversación (propia → usar; si no → `crear`), emitir `event: conversation`, cargar y limpiar historial. Fusión de roles consecutivos en `GeminiAdapter`.
- [ ] **Step 5:** `pnpm typecheck` y `pnpm test` → verde.
- [ ] **Step 6: Commit** — `feat(orbi): el servidor emite el id de conversación y el historial se escribe de forma atómica`.

---

### Task 7: Cortar la respuesta, metering por proveedor, telemetría e ids únicos

**Spec:** §3.6, §3.7 (API), §3.8 (API).

**Files:**
- Create: `apps/api/src/orbi/orbi-turn.service.ts`
- Modify: `apps/api/src/orbi/llm/llm-adapter.interface.ts` (`signal?`, `LlmUsage.provider`), `gemini.adapter.ts`, `groq.adapter.ts`, `fallback.adapter.ts`, `llm-errors.ts`, `orbi.controller.ts` (`chat` y `chatWizard`), `orbi.module.ts`, `apps/web/src/modules/superadmin/Costos.tsx` (`AI_FEATURE_LABELS`)
- Test: `llm-errors.spec.ts`, `fallback.adapter.spec.ts`, `gemini.adapter.spec.ts`, `groq.adapter.spec.ts`, `orbi.controller.spec.ts`, `test/unit/orbi-turn.service.unit-spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // llm-adapter.interface.ts
  interface LlmUsage { model: string; promptTokens: number; completionTokens: number; provider: 'gemini' | 'groq' }
  streamChat(args: { messages; tools?; model?; signal?: AbortSignal }): AsyncIterable<LlmEvent>;
  // orbi-turn.service.ts
  @Injectable() export class OrbiTurnService {
    registrar(t: { businessId; memberId; conversationId: string | null; module?: string; model?: string; promptTokens?: number; completionTokens?: number; latencyMs: number; rounds: number; toolsUsed: string[]; actionsProposed: number; status: 'ok' | 'error' | 'cancelled' | 'max_rounds' }): Promise<void>; // best-effort: try/catch + log, nunca lanza
  }
  ```

- [ ] **Step 1: Test que falla — aborto en adapters.** Gemini pasa `signal` como `config.abortSignal`; Groq lo pasa en las opciones del request; ambos ponen `provider` en el evento `usage`. `esErrorDeDisponibilidad` devuelve `false` para errores de aborto (`AbortError`/`signal.aborted`); `FallbackLlmAdapter` NO cae al secundario ante un aborto.
- [ ] **Step 2: Test que falla — controller.** (a) `res.on('close')` con `!res.writableEnded` dispara el aborto; el loop no hace más llamadas al modelo ni ejecuta más tools ni crea propuestas una vez abortado; no se escribe `event: error`; el turno queda `cancelled` y NO se guarda respuesta de Orbi en la conversación; en el wizard no se llama a `logAiTurn` cuando se corta, pero el metering sí se registra. (b) `stepId` es UUID y dos pasos seguidos no repiten id. (c) Metering: un turno con `usage` de `gemini` y de `groq` hace un `track` por proveedor con `metadata: { feature: 'orbi-panel' | 'orbi-wizard', model, memberId, conversationId }`; `openai/gpt-oss-120b` cuenta como `groq` (adiós a la heurística `includes('groq')`). (d) `OrbiTurnService.registrar` se llama en el `finally` del panel con `rounds`, `toolsUsed`, `actionsProposed` y `status` correcto (`ok`, `error`, `cancelled`, `max_rounds`), sin texto de la pregunta ni de la respuesta.
- [ ] **Step 3:** Correr → fallan. Implementar: `LlmAdapter`/adapters/`fallback`/`llm-errors`; en `chat` y `chatWizard`: `const corte = new AbortController(); res.on('close', () => { if (!res.writableEnded) corte.abort(); });` pasar `signal: corte.signal`, chequear `corte.signal.aborted` antes de cada vuelta, antes de cada tool y antes de `crear()`; `catch` con `if (corte.signal.aborted)` sin log de error ni escritura al stream; acumular tokens por proveedor y hacer un `track` por proveedor; `stepId = randomUUID()`; llamar a `OrbiTurnService.registrar` sin `await` bloqueante del stream (`void this.orbiTurns.registrar(...)`).
- [ ] **Step 4:** Sumar `orbi-panel` y `orbi-wizard` a `AI_FEATURE_LABELS` de `Costos.tsx` ("Orbi (panel)", "Orbi (wizard)").
- [ ] **Step 5:** `pnpm typecheck` (api y web) y `pnpm test` (api) → verde.
- [ ] **Step 6: Commit** — `feat(orbi): cortar la respuesta cuando el cliente se va, metering por proveedor y telemetría de turnos`.

---

### Task 8: Retención y baja del negocio

**Spec:** §3.11.

**Files:**
- Modify: `apps/api/src/internal-cron/retencion-logs.service.ts` (`TablaConRetencion`, `ResultadoPurga`), `apps/api/src/subscriptions/subscriptions.service.ts` (`operacionesDeBorradoDefinitivo`), `apps/api/DEPLOYMENT.md` (§ Retención)
- Test: `retencion-logs.unit-spec.ts`, `aislamiento-consultas.unit-spec.ts` (techo, con el motivo), `purga-datos-baja.auditoria.unit-spec.ts` (lista `MODELOS`)

**Interfaces:**
- Consumes: `prisma.orbiPendingAction`, `prisma.orbiTurn`, `prisma.dailyQuota` (T1).
- Produces: variables `ORBI_PENDING_ACTIONS_RETENTION_DAYS` (30), `ORBI_TURNS_RETENTION_DAYS` (400), `DAILY_QUOTA_RETENTION_DAYS` (30; corte por `day < fechaArgentina - N días`, es un string, no un `DateTime`).

- [ ] **Step 1: Test que falla — retención.** Cada tabla nueva se purga con su variable y default; `daily_quota` corta por `day`; `ResultadoPurga` incluye las tres.
- [ ] **Step 2: Test que falla — baja definitiva.** `operacionesDeBorradoDefinitivo` incluye `orbiPendingAction` y `orbiTurn` filtrados por `businessId`, y borra las filas de `daily_quota` cuyas claves terminan en `:<businessId>` (`orbi-panel:`, `ai-assist:`, etc.); `MODELOS` de `purga-datos-baja.auditoria.unit-spec.ts` los lista.
- [ ] **Step 3:** Correr → fallan. Implementar. Ajustar el techo de `aislamiento-consultas.unit-spec.ts` explicando el motivo en un comentario.
- [ ] **Step 4:** Documentar las tres variables en `DEPLOYMENT.md` § Retención de logs y registros.
- [ ] **Step 5:** `pnpm typecheck` y `pnpm test` → verde.
- [ ] **Step 6: Commit** — `feat(orbi): retención y purga en la baja para las tablas nuevas`.

---

### Task 9: `navigateTo` con links que existen

**Spec:** §3.13.

**Files:**
- Create: `apps/web/src/modules/ventas/panel/secciones.ts` (`SECCIONES_DEL_PANEL`), `apps/api/src/orbi/navegacion/secciones.ts` (espejo)
- Modify: `apps/web/src/modules/ventas/panel/AdminSeccionShell.tsx` (`componentMap` usa la constante), `apps/api/src/orbi/tools/definitions/navigation.tool.ts`
- Test: `apps/api/src/orbi/tools/definitions/navigation.tool.spec.ts`, `apps/web/src/modules/ventas/panel/secciones.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const SECCIONES_DEL_PANEL: readonly string[]; // las claves reales de componentMap (incluye cupones, categorias, reportes, avanzado, manual, configuracion)
  export const VISTAS_DE_CONFIGURACION: readonly string[]; // valores de VistaConfig (ConfigTabs.tsx:17)
  ```
  Tool `navigateTo` con input `{ seccion: enum(SECCIONES_DEL_PANEL), vista?: enum(VISTAS_DE_CONFIGURACION) }` que devuelve `/admin/ventas/<seccion>` (+ `?vista=<vista>` solo si `seccion === 'configuracion'`).

- [ ] **Step 1: Test que falla — API.** Para cada `seccion` de la lista (y cada `vista` con `configuracion`) la ruta resultante, pasada por el mismo algoritmo que `AdminSeccionShell` (últimos dos segmentos como módulo/sección; verificar el código real y replicarlo en el test), resuelve a una sección existente; una `seccion` fuera de la lista se rechaza; `vista` con otra sección se ignora o se rechaza (elegir y documentar).
- [ ] **Step 2: Test que falla — web.** El espejo de la API coincide con la constante del front (leer los dos archivos como texto y comparar los arrays, o un snapshot con `toMatchFileSnapshot`).
- [ ] **Step 3:** Correr → fallan. Extraer `SECCIONES_DEL_PANEL` y `VISTAS_DE_CONFIGURACION` (verificando contra `componentMap` real y `ConfigTabs.tsx`); `componentMap` las usa como tipo/claves; reescribir la tool y su `description` (que hoy no ofrece `cupones`, `categorias`, `reportes`, `avanzado` ni `manual`).
- [ ] **Step 4:** `pnpm typecheck` (api y web), tests de ambos → verde.
- [ ] **Step 5: Commit** — `fix(orbi): navigateTo arma links que existen`.

---

### Task 10: Parser SSE puro y tests de front en CI

**Spec:** §3.8 (front).

**Files:**
- Create: `apps/web/src/components/orbi/sseParser.ts`, `apps/web/src/components/orbi/sseParser.test.ts`
- Modify: `apps/web/src/components/orbi/useOrbiChat.ts` (usa el parser, maneja `conversation` y `done`), `.github/workflows/ci.yml` (job `web` suma `pnpm test`, sin cambiar el nombre del check `Web — typecheck`)

**Interfaces:**
- Produces:
  ```ts
  export type EventoSse = { event: string; data: unknown };
  export function crearParserSse(): { alimentar(pedazo: string): EventoSse[]; }; // conserva la línea partida y el tipo de evento entre pedazos
  ```
  `data:` que no es JSON válido se descarta sin cortar el stream. Los eventos usados: `text`, `text_reset`, `action_start`, `action_complete`, `action_pending`, `turn`, `conversation`, `done`, `error`.

- [ ] **Step 1: Test que falla** (vitest, `sseParser.test.ts`): evento completo en un pedazo; `event:` y `data:` en pedazos distintos; línea partida a la mitad entre pedazos; línea final sin `\n` (queda retenida hasta el próximo pedazo); varios eventos en un pedazo; `data:` con JSON inválido se descarta y el siguiente evento sale bien; `\r\n` como separador.
- [ ] **Step 2:** Correr `cd apps/web && pnpm test sseParser` → falla. Implementar el parser y usarlo en `useOrbiChat.ts` (hoy el parseo está inline, con el bug del tipo de evento partido, ~línea 101).
- [ ] **Step 3:** Agregar `pnpm test` al job `web` de `.github/workflows/ci.yml`; verificar que el nombre del job/check no cambia.
- [ ] **Step 4:** `pnpm exec tsc --noEmit` y `pnpm test` en `apps/web` → verde.
- [ ] **Step 5: Commit** — `feat(orbi): parser SSE que no pierde eventos y tests de front en CI`.

---

### Task 11: Store, conversación, abort y contador de sesión

**Spec:** §3.3 (front), §3.7 (front).

**Files:**
- Modify: `apps/web/src/components/orbi/useOrbiStore.ts`, `useOrbiChat.ts`, `OrbiPanel.tsx` (botón Nueva conversación, Detener), `OrbiInput` (o donde esté el botón enviar), `apps/web/src/lib/auth/AuthContext.tsx` (logout/login), el layout del admin (`AdminLayout`, aborta al desmontar)
- Test: `apps/web/src/components/orbi/useOrbiStore.test.ts`

**Interfaces:**
- Produces (store):
  ```ts
  conversationId: string | null; setConversationId(id: string | null): void;
  sesion: number;                        // contador; reset() lo incrementa
  abortar(): void;                       // aborta el AbortController en curso
  setAbort(c: AbortController | null): void;
  reset(): void;                         // vacía mensajes, conversationId, welcomeGreetedStep; aborta; sesion += 1
  ```
  El lector del stream toma `const sesionAlEnviar = store.sesion`; si al llegar un evento `store.sesion !== sesionAlEnviar`, descarta TODOS los eventos (incluido `conversation`).

- [ ] **Step 1: Test que falla** (vitest, lógica del store sin DOM): `reset()` vacía mensajes y `conversationId`, limpia `welcomeGreetedStep` y aborta el controller en curso; `sesion` se incrementa; un evento de un stream con `sesion` vieja no escribe (probar con una función pura `debeDescartar(sesionAlEnviar, sesionActual)` o simulando el consumo de eventos con el parser de T10); `setConversationId` solo en el panel.
- [ ] **Step 2:** Correr → falla. Implementar el store; `useOrbiChat` crea un `AbortController` por envío, lo guarda con `setAbort`, manda `conversationId` en el body (el campo ya existe en `OrbiChatDto`), guarda el id del evento `conversation`, y trata `AbortError` sin "Error de conexión": la burbuja queda con lo recibido y la marca "Detenido".
- [ ] **Step 3:** UI: en el encabezado de `OrbiPanel` (solo panel) botón **Nueva conversación** (`aria-label`, 44 px de área táctil) que llama a `reset()`; el botón de enviar se convierte en **Detener** mientras hay streaming. Abortar también al cerrar el panel y al desmontar `AdminLayout`.
- [ ] **Step 4:** `AuthContext`: `logout()` aborta y llama a `reset()`; `login()` que autentica a otro miembro/negocio distinto del que está en memoria aborta y `reset()`.
- [ ] **Step 5:** `pnpm exec tsc --noEmit` y `pnpm test` en `apps/web` → verde.
- [ ] **Step 6: Commit** — `feat(orbi): recuerda la conversación, Nueva conversación y Detener`.

---

### Task 12: Tarjeta de acción con todos sus estados

**Spec:** §3.9 completo.

**Files:**
- Create: `apps/web/src/components/orbi/confirmarAccion.ts` (lógica pura de respuestas), `confirmarAccion.test.ts`
- Modify: `apps/web/src/components/orbi/OrbiMessages.tsx` (`OrbiConfirmButton`), `types.ts` (`OrbiAction.status`), `useOrbiChat.ts` (`confirmarAccion`, `rechazarAccion`), `apps/web/src/modules/ventas/panel/catalogo/ProductoLista.tsx` (escucha `orbi:accion-ejecutada`)
- Test: `confirmarAccion.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type EstadoTarjeta = 'pending' | 'active' | 'complete' | 'error' | 'rejected' | 'unknown';
  export type RespuestaConfirmar =
    | { http: 200; body: { success: boolean; data?: unknown; error?: string; label: string } }
    | { http: 404 } | { http: 409; body: { estado: 'aplicando' | 'desconocido' } } | { http: 'red' | 500 };
  export function siguienteEstado(r: RespuestaConfirmar): { estado: EstadoTarjeta; reintentar: boolean; mensaje?: string };
  ```
  Regla: 200→`complete`/`error` según `success`; 404→`error` "Esa acción ya no está disponible. Pedísela a Orbi de nuevo." (único caso con "pedísela de nuevo"); 409 `aplicando`→`active` con `reintentar: true` (mismo `actionId`, espera creciente, hasta ~5 intentos); 409 `desconocido`→`unknown`; red o 5xx→`unknown` con Reintentar del mismo `actionId`.

- [ ] **Step 1: Test que falla** (`confirmarAccion.test.ts`): cada fila de la tabla de §3.9 (200 éxito, 200 con `success:false`, 404, 409 aplicando, 409 desconocido, red, 500); nunca se le dice "pedísela de nuevo" a `unknown`; reintentar usa el MISMO `actionId`.
- [ ] **Step 2:** Correr → falla. Implementar `siguienteEstado` y la espera creciente (`[500, 1000, 2000, 4000, 8000]` ms, tope 5 intentos).
- [ ] **Step 3:** `OrbiConfirmButton` se muestra para toda acción con `actionId` y por estado: `pending` (Resumen · Confirmar · Cancelar · "No se hizo nada todavía"), `active` ("Aplicando…"), `complete` (✓ "Listo" + resultado), `error` ("No se pudo" + motivo), `rejected` ("Cancelado"), `unknown` ("No sé si se aplicó" + dónde revisarlo + Reintentar). Cancelar llama a `POST /orbi/reject`; si responde 409 `ya_aplicada`, la tarjeta pasa a `complete`/`error` con el resultado guardado y dice "Ya se aplicó". **Confirmar y Cancelar quedan deshabilitados en todas las tarjetas mientras hay streaming.**
- [ ] **Step 4:** Tras un confirmar exitoso: `window.dispatchEvent(new CustomEvent('orbi:accion-ejecutada', { detail: { tool, data } }))` y `invalidateQueries` de `['descuentos']` y `['cupones']` para `createDiscount`/`createCoupon` (verificar el `QueryClientProvider` del panel y las keys reales de las queries); `ProductoLista` escucha el evento y llama a `cargarSilencioso()` para `createProduct`.
- [ ] **Step 5:** `pnpm exec tsc --noEmit` y `pnpm test` en `apps/web` → verde.
- [ ] **Step 6: Commit** — `feat(orbi): la tarjeta de acción muestra todos sus estados y refresca la pantalla`.

---

### Task 13: Orbi en el celular

**Spec:** §3.10.

**Files:**
- Modify: `apps/web/src/layouts/components/Header.tsx` (barra de celular, `max-width: 768px`), `apps/web/src/modules/ventas/panel/tutoriales/anclas.ts`
- Test: `apps/web/src/modules/ventas/panel/tutoriales/anclas.test.ts` (si la lógica del ancla se puede aislar) o verificación manual

- [ ] **Step 1:** Botón de Orbi en la barra de celular con `aria-label="Abrir Orbi"`, `aria-expanded`, área táctil de 44 px, que abre el panel de Orbi como el del menú lateral (mismo store, `useOrbiStore.open`/equivalente).
- [ ] **Step 2:** El ancla `'orbi'` de `anclas.ts` prueba primero `[aria-label="Abrir Orbi"]` y después el `title` del botón del menú lateral. Test del selector si es lógica pura.
- [ ] **Step 3:** Verificar en el navegador (preview del dev server, `resize_window` a 320, 375 y 768 px): la barra no desborda con los 5 botones; si a 320 px no entra, ocultar el botón de tema en pantallas muy angostas. Captura de pantalla para el reporte.
- [ ] **Step 4:** `pnpm exec tsc --noEmit` y `pnpm test` en `apps/web` → verde.
- [ ] **Step 5: Commit** — `feat(orbi): botón de Orbi en la barra del celular`.

---

### Task 14: Pruebas contra Postgres real y cierre

**Spec:** §6 (tests contra Postgres real), §7, §3.12.

**Files:**
- Create: `apps/api/test/orbi-fase1.e2e-spec.ts`
- Modify: `apps/api/DEPLOYMENT.md` (si algo cambió), `docs/superpowers/plans/2026-09-30-orbi-fase-1-base.md` (tildar)

- [ ] **Step 1: e2e** (`pnpm test:e2e`, contra la base de DEV con el `.env` local; seguir el patrón de los e2e existentes para crear negocio/miembro de prueba): (a) `consumir` dos veces en paralelo (`Promise.all`) sobre la misma acción: una gana `ejecutar` y la otra `aplicando`/`resuelta`, la tool corre una sola vez; (b) `CuotaService.consumir` con `limite = 3` desde 10 llamadas concurrentes: exactamente 3 `true` y el contador queda en 3 (no se infla); (c) `appendMessage` concurrente (20 en paralelo) no pierde mensajes y respeta el tope de 200; (d) `reject` de otra persona no cambia la fila.
- [ ] **Step 2:** Correr `pnpm test:e2e -- orbi-fase1` contra DEV → verde. Limpiar los datos de prueba que se creen.
- [ ] **Step 3:** Verificación completa: `pnpm typecheck` y `pnpm test` en `apps/api`; `pnpm exec tsc --noEmit` y `pnpm test` en `apps/web`.
- [ ] **Step 4:** Prueba manual en el navegador (preview del dev server contra la API local): abrir Orbi, mandar dos mensajes y comprobar que el segundo recuerda el primero; pedir "creá un cupón VERANO15 de 15%": aparece la tarjeta con todos los valores, Confirmar aplica y muestra "Listo", la lista de cupones se actualiza; Cancelar otra tarjeta; Detener una respuesta larga; Nueva conversación. Registrar lo que se vio.
- [ ] **Step 5:** Producir el **reporte de cierre** para Alan (sin desplegar): qué quedó hecho por tarea, los comandos que faltan y quién los corre (`prisma-prod.sh migrate deploy`, `deploy.sh`), las precondiciones (billing de Gemini, consulta de permisos de roles en prod, prueba del corte a través del proxy de Firebase) y el comentario de Jira propuesto.
- [ ] **Step 6: Commit** — `test(orbi): pruebas contra Postgres de acciones, cuota e historial`.
