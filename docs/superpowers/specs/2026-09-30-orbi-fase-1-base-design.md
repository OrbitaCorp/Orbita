# Orbi — Fase 1: arreglar la base

**Fecha:** 2026-09-30
**Estado:** Borrador revisado (dos revisiones adversariales contra el código, 2026-09-30)
**Estudio de origen:** [Orbi en el panel — estudio preliminar](https://claude.ai/code/artifact/bc83b3c9-001c-4322-b61e-afd94c273e1f), sección "Plan por fases", punto 1.

---

## 1. Por qué esta fase va primero

Hoy, en producción, Orbi del panel:

- **No puede ejecutar nada.** Las tools de escritura piden permisos que no existen
  (`products:write`, `orders:write`, `discounts:write`, `config:write`); los roles reales
  usan `catalog.manage`, `orders.manage`, `discounts.manage`, `config.edit`. El filtro de
  `ToolRegistryService.getTools` las descarta para todos, incluido el dueño.
- **Deja leer lo que el rol no permite.** Las tools de lectura y el snapshot del módulo
  que va al system prompt no piden ningún permiso.
- **No recuerda la conversación.** El front nunca recibe el id de la conversación, así
  que cada mensaje llega al modelo sin historial.
- **Confirma de forma frágil.** Las propuestas y la cuota diaria viven en memoria de una
  instancia; Cloud Run corre hasta 10 y escala a cero.
- **Sigue gastando si la persona se va.** Ni el front ni la API cortan una respuesta en
  curso.
- **Esconde el resultado.** Al confirmar, la tarjeta desaparece; no hay Cancelar.
- **No se mide** y **no existe en el celular.**

**Ojo:** arreglar los permisos habilita las escrituras **por primera vez** en producción.
Por eso esta fase también endurece todo lo que una escritura necesita antes de existir:
qué muestra la tarjeta, validación de argumentos, idempotencia y qué queda en el historial.

## 2. Alcance

| # | Cambio | Dónde |
|---|---|---|
| 1 | Permisos reales en todas las tools y en el snapshot; el dueño pasa siempre | API |
| 2 | Escrituras seguras antes de habilitarlas: tarjeta con todos los valores, validación con el DTO del endpoint, demo sin propuestas, menos datos personales en lecturas | API |
| 3 | Memoria de conversación: el servidor emite el id, el front lo guarda y lo devuelve; "Nueva conversación"; historial bien formado; escritura atómica del historial | API + front |
| 4 | Acciones pendientes en Postgres: consumo atómico, confirmar idempotente, estado desconocido acotado, cancelar, nota segura en la conversación | API + front |
| 5 | Cuota diaria compartida en Postgres para Orbi y para las otras IA que hoy usan `CuotaDiaria` | API |
| 6 | Telemetría por turno y metering por proveedor | API |
| 7 | Cortar una respuesta en curso: botón Detener, al cerrar, al cambiar de conversación; el servidor corta y no factura de más | API + front |
| 8 | Ids únicos por paso; lector del stream que no pierde eventos | API + front |
| 9 | Tarjeta de acción con todos sus estados; refrescar la pantalla afectada | front |
| 10 | Botón de Orbi en la barra del celular | front |
| 11 | Retención y purga en la baja del negocio para las tablas nuevas | API |
| 12 | Precondiciones operativas: billing de Gemini, migración aplicada en la base correcta, permisos de los roles | operación |
| 13 | `navigateTo` arma links que existen (hoy las secciones de Configuración dan "Página no encontrada") | API + front |

**Fuera de alcance:** sesiones con lista y títulos, tabla de mensajes aparte, pensamiento
y actividad en el stream (fase 3); modos de permisos y riesgo por tool (fase 4); cupo por
plan y barra de uso (fase 5); tools nuevas; router de modelos; retención de
`orbi_conversations` (problema previo, ticket aparte).

## 3. Diseño

### 3.1 Permisos reales

**Catálogo compartido.** `PERMISSIONS` de `onboarding.service.ts` (hoy no exportado) se
mueve a `apps/api/src/common/permisos/catalogo.ts`, que importan onboarding y Orbi.
`prisma/seed.ts` conserva su copia deliberada (no puede importar de `src`).

**Mapeo de tools:**

| Tool | Hoy | Pasa a pedir | Confirma |
|---|---|---|---|
| `createProduct` | `products:write` | `catalog.manage` | sí |
| `createDiscount`, `createCoupon` | `discounts:write` | `discounts.manage` | sí |
| `updateOrderStatus` | `orders:write` | `orders.manage` | sí |
| `updateBusinessInfo`, `updatePaymentMethods`, `updateShipping` | `config:write` | `config.edit` | sí |
| `generateDescription` | nada | `catalog.manage` | no (no persiste); consume la cuota `ai-assist` como `POST /products/ai-assist` |
| `listOrders`, `getOrderDetail` | nada | `orders.view` | no |
| `listCustomers`, `getCustomerDetail` | nada | `customers.view` | no |
| `listProducts` | nada | `catalog.view` | no |
| `listDiscounts` | nada | `discounts.view` | no |
| `getSalesReport`, `getProductReport`, `getCustomerReport` | `reports.view` | sin cambios | no |
| `navigateTo` | nada | sin cambios | no |

`generateDescription` pide `catalog.manage` porque el mismo servicio por HTTP lo exige, y
el rol Empleado tiene `catalog.view`: con `view` tendría por Orbi una IA paga que por HTTP
se le niega.

**El dueño pasa siempre**, igual que `PermissionsGuard` (`roleName === 'owner'`):

```ts
// apps/api/src/orbi/permisos-orbi.ts
export function permisosDeOrbi(user: MemberContext): string[] {
  return user.roleName === 'owner' ? CODIGOS_DEL_CATALOGO : user.permissions;
}
```

Se usa en `chat` y en `confirm`. **`reject` no chequea permisos**: cancelar nunca puede
estar prohibido.

**Snapshot por permiso.** `buildSystemPrompt(dto, permisos: string[] = [])`: sin
permisos no hay snapshot (nunca "todo"). El wizard y las evals lo llaman sin permisos.

| Módulo | Permiso |
|---|---|
| `dashboard` | `reports.dashboard` |
| `pedidos` | `orders.view` |
| `clientes` | `customers.view` |
| `catalogo` | `catalog.view` |
| `mensajes` | `messages.view` |

**Cambio visible para empleados:** el rol Empleado no tiene `discounts.view`,
`reports.view` ni `reports.dashboard`. Con este cambio Orbi deja de mostrarle descuentos,
reportes y los números del dashboard. Es intencional: hoy los ve solo porque Orbi no
chequeaba.

**Menos datos personales en lecturas.** `getCustomerDetail` hoy devuelve el objeto
completo (DNI, email, teléfono, direcciones, asuntos de mails). Pasa a mapear campo por
campo: nombre, métricas, pedidos resumidos y localidad. Mismo criterio que ya se aplicó a
`getOrderDetail`.

### 3.2 Escrituras seguras antes de habilitarlas

**La tarjeta muestra cada valor que se va a escribir.** Hoy varios `describirAccion`
esconden justo lo que un texto de terceros podría cambiar:

| Tool | Hoy muestra | Tiene que mostrar |
|---|---|---|
| `updateOrderStatus` | "Marcar el pedido como X" | Número de pedido, cliente, estado actual → nuevo, y que le llega un mail al comprador y se mueve stock cuando corresponda |
| `updateBusinessInfo` | Nombres de los campos | Cada valor nuevo, entre comillas y truncado |
| `updatePaymentMethods` | Medios, sin `transferAlias` | También el alias de transferencia (es público en la tienda) |
| `updateShipping` | Parcial | También la política de envío y los transportistas |
| `createProduct` | Nombre y precio | También estado (publicado o borrador) y descripción truncada |
| `createDiscount`, `createCoupon` | Código y valor | También alcance, fechas y cantidad de productos |

Textos libres entre comillas, sin saltos de línea y truncados a 80 caracteres.

**Validación con el DTO del endpoint.** Hoy las tools pasan argumentos crudos a los
services y se saltean la validación HTTP (regex y tope de 40 del código de cupón, tope de
120 del nombre, `IsUUID` en `productIds`, tope de 60 de `transferAlias`). Cada tool de
escritura valida sus argumentos con el **mismo DTO** de su endpoint
(`plainToInstance` + `validate`) dentro de `proponer`. Si no pasa, no se propone y el
modelo recibe el error de validación.

**La demo no propone.** El visitante de la demo tiene rol owner, así que
`permisosDeOrbi` le da todo. `proponer` recibe `soloLectura` y devuelve `null` (hoy solo
`getTools` lo respeta, y si el modelo llama igual una tool de escritura se crea una tarjeta
que después da 403).

**Invariantes del catálogo** (`tool-catalog.spec.ts`), que reemplazan las de `:write`:

1. Todo permiso que pide una tool existe en `CODIGOS_DEL_CATALOGO`.
2. **Toda tool sin `requiresConfirmation` está en una lista explícita de solo lectura.**
   Una tool nueva que escribe y se olvida del flag rompe el test.
3. Toda tool del panel que lee datos del negocio pide al menos un permiso (excepción
   listada: `navigateTo`).
4. Para toda tool con `requiresConfirmation`, cada propiedad de `parameters` cargada con
   un valor centinela aparece en el resumen de `describirAccion`.
5. Se mantienen: zona prohibida, ningún parámetro tipo `businessId`.

### 3.3 Memoria de conversación

**Servidor** (rama panel, fuera de la demo):

- `conversationId` propio → se usa y se carga el historial (últimos `HISTORIAL_PANEL`).
- Sin id, o con uno ajeno o inexistente → conversación nueva. Ajeno e inexistente se
  tratan igual. El abuso (crear filas con ids inventados) lo acotan la cuota y el throttle.
- Se deja de usar `getOrCreate` en el chat.
- Primer evento del stream: `event: conversation` con `{ "id": "<uuid>" }`.

**Historial bien formado.** Hoy el mensaje de la persona se guarda antes de llamar al
modelo y la respuesta solo si no hubo error, así que un turno fallido o cortado deja dos
`user` seguidos, y una respuesta vacía se guarda como `assistant` vacío. Al armar el
historial se descartan los mensajes vacíos, y `GeminiAdapter` une entradas consecutivas
del mismo rol (cualquier rol) al armar `contents`.

**Escritura atómica del historial.** `ConversationService.appendMessage` hoy lee el JSON,
agrega y reescribe todo, sin lock. Esta fase suma escritores (las notas de confirmar y
cancelar), así que pasa a un único statement:

```sql
UPDATE orbi_conversations
SET messages = (
  SELECT COALESCE(jsonb_agg(m ORDER BY i), '[]'::jsonb)
  FROM jsonb_array_elements(messages || $1::jsonb) WITH ORDINALITY AS t(m, i)
  WHERE i > jsonb_array_length(messages || $1::jsonb) - 200
), updated_at = now()
WHERE id = $2 AND business_id = $3 AND user_id = $4;
```

Si no afecta filas, la conversación no es propia o no existe (mismo contrato que hoy).

**Front:**

- El evento `conversation` guarda el id (`setConversationId`, solo en el panel).
- Botón **Nueva conversación** en el encabezado de `OrbiPanel` (solo panel): aborta el
  stream en curso y llama a `reset()`; el saludo reaparece porque `reset()` limpia
  `welcomeGreetedStep`.
- `logout()` aborta el stream en curso y llama a `reset()`. Es defensa: hoy el logout del
  panel ya recarga la página, pero el POS comparte terminal entre empleados y no hay que
  depender de eso.
- Si `login()` autentica a otro miembro o negocio distinto del que está en memoria, aborta
  y `reset()`.
- **Contador de sesión:** el lector del stream toma un número al arrancar; si cambió (por
  reset), descarta todos los eventos, incluido `conversation`. Así un stream viejo nunca
  escribe en el chat de otra persona.

### 3.4 Acciones pendientes en Postgres

```prisma
model OrbiPendingAction {
  id             String    @id              // token aleatorio de 32 hex, igual que hoy
  businessId     String    @map("business_id")
  memberId       String    @map("member_id")
  conversationId String?   @map("conversation_id")
  tool           String
  args           Json
  summary        String
  status         String    @default("pending") // pending | executing | executed | failed | rejected
  result         Json?
  expiresAt      DateTime  @map("expires_at")
  startedAt      DateTime? @map("started_at")
  resolvedAt     DateTime? @map("resolved_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, memberId, status])
  @@index([createdAt])
  @@map("orbi_pending_actions")
}
```

**Proponer:** `crear()` guarda `conversationId` solo si pasó por `assertPropia` en este
turno; si no, `null`. Si el turno ya se cortó (3.7), no se inserta nada.

**Confirmar** (`POST /orbi/confirm`, solo `actionId`):

1. Consumo atómico: `updateMany({ where: { id, businessId, memberId, status: 'pending',
   expiresAt: { gt: ahora } }, data: { status: 'executing', startedAt: ahora } })`.
2. Si `count === 1`: se ejecuta con `permisosDeOrbi(user)` del JWT actual, dentro de
   `try/finally` que **siempre** deja `executed` o `failed` con `result` y `resolvedAt`,
   también ante una excepción.
3. **Después** de guardar el estado, la nota en la conversación (ver abajo), best-effort:
   en `try/catch` con log, nunca cambia la respuesta.
4. Se devuelve el `ToolResult`.

Si `count === 0`, se busca con `{ id, businessId, memberId }`:

| Estado | Respuesta |
|---|---|
| `executed` o `failed` | 200 con el mismo `result` (idempotente) |
| `executing`, menos de 2 minutos | 409 `{ estado: 'aplicando' }` |
| `executing`, 2 minutos o más | 409 `{ estado: 'desconocido' }` "No sé si se aplicó; revisalo en <pantalla>". **Nunca se vuelve a ejecutar sola** |
| `rejected`, vencida, inexistente o de otra persona | 404 "Esa acción ya no está disponible. Pedísela a Orbi de nuevo." |

Cambio de comportamiento declarado: hoy un intento con el negocio equivocado "quema" la
acción (test `orbi-pending-actions.unit-spec.ts:55`). Con el filtro en el `where`, la
acción ajena sigue `pending` para su dueño. Ese test se reemplaza.

**Cancelar** (`POST /orbi/reject`, `{ actionId }`): exige `user.type === 'member'` (con
un JWT de customer o platform_admin, `memberId` sería `undefined` y Prisma lo sacaría del
filtro). Sin chequeo de permisos.

| Estado | Respuesta |
|---|---|
| `pending` (vigente) → `rejected` | `{ ok: true }` + nota |
| ya `rejected` | `{ ok: true }` |
| `executed` o `failed` | 409 con el `result` guardado: la tarjeta muestra "Ya se aplicó" |
| resto | 404 |

**La nota en la conversación** (confirmar y cancelar) es un mensaje `assistant` armado
**solo con datos que controla el servidor**, porque queda en el historial de los próximos
30 mensajes y el `summary` sale de argumentos del modelo que pueden venir de texto de
terceros:

- etiqueta fija de la tool ("Crear cupón", "Cambiar estado del pedido");
- resultado: listo, no se pudo, cancelado;
- ids validados (número de pedido, código de cupón que pasó el DTO);
- el error como categoría fija: permiso, validación, conflicto o interno. Nunca el mensaje
  crudo, que puede traer valores e internos de Prisma.

Ejemplo: `Listo: Crear cupón VERANO15.` / `Cancelado por la persona: Cambiar estado del
pedido #1043. No se hizo nada.`

### 3.5 Cuota diaria compartida

`CuotaDiaria` (en memoria) hoy la usan Orbi, `products.controller.ts` (ai-assist,
ai-variants, ai-scan) e `image-studio.controller.ts`. Todas pasan a un servicio único en
`apps/api/src/common/cuota/` (fuera de `orbi/` para evitar la dependencia circular
Orbi → Products; `PrismaModule` es global). Cada uso lleva su prefijo, una clave por cada
instancia actual de `CuotaDiaria`: `orbi-panel:<negocio>`, `orbi-wizard:<ipHash>`,
`ai-assist:<negocio>`, etc. Recién sin usos se borra la clase. Límites sin cambios.

```prisma
model DailyQuota {
  key   String
  day   String   // 'YYYY-MM-DD' de fechaArgentina, como `week` en demo_ai_usage
  count Int      @default(0)

  @@id([key, day])
  @@map("daily_quota")
}
```

Mismo patrón que `DemoIaService` (no infla el contador pasado el tope):

```sql
INSERT INTO daily_quota (key, day, count) VALUES ($1, $2, 1)
ON CONFLICT (key, day) DO UPDATE SET count = daily_quota.count + 1
WHERE daily_quota.count < $3
RETURNING count;
```

Devuelve fila → entra. Sin fila → rechazo.

**La IP no se guarda en claro.** Se extrae el HMAC privado de `DemoIaService.claveDe` a
`apps/api/src/common/utils/hash-ip.ts` (`hmacIp(contexto, ip)`, HMAC-SHA256 con
`JWT_SECRET`) y lo usan los dos, con resultado idéntico para `demo-ia` (sus claves no
cambian). Si rota `JWT_SECRET`, se reinicia la cuota del día: aceptable.

`@Throttle` sigue siendo por instancia: es antirráfaga, no tope de costo. Con la cuota
compartida, el cupo de 300 de la demo pasa a ser global de verdad.

### 3.6 Telemetría y metering

```prisma
model OrbiTurn {
  id               String   @id @default(uuid())
  businessId       String   @map("business_id")
  memberId         String   @map("member_id")
  conversationId   String?  @map("conversation_id")
  module           String?
  model            String?                        // ID que usó el adapter
  promptTokens     Int?     @map("prompt_tokens")
  completionTokens Int?     @map("completion_tokens")
  latencyMs        Int      @map("latency_ms")
  rounds           Int
  toolsUsed        String[] @default([]) @map("tools_used")
  actionsProposed  Int      @default(0) @map("actions_proposed")
  status           String                         // ok | error | cancelled | max_rounds
  createdAt        DateTime @default(now()) @map("created_at")

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, createdAt])
  @@index([memberId, createdAt])
  @@map("orbi_turns")
}
```

- Sin texto: la pregunta y la respuesta ya están en la conversación.
- Se escribe en el `finally` del chat del panel, sin bloquear el stream.
- En un turno `cancelled` los tokens son un piso: la llamada cortada se factura igual y el
  evento `usage` llega recién al final.

**Metering por proveedor.** Hoy la heurística `includes('groq')` clasifica
`openai/gpt-oss-120b` (Groq) como Gemini, y un mismo turno puede mezclar proveedores
(el fallback se decide por llamada). `LlmUsage` suma `provider: 'gemini' | 'groq'`, que
pone cada adapter (precedente: `text-generation.ts`). El controller acumula por proveedor
y hace un `track` por cada uno, con `metadata: { feature, model, memberId,
conversationId }`, donde `feature` es `orbi-panel` o `orbi-wizard`. Se suman las dos
etiquetas a `AI_FEATURE_LABELS` de `Costos.tsx`.

### 3.7 Cortar una respuesta en curso

**Front** (sin esto, la API nunca se entera: cerrar Orbi solo desmonta la vista y la
navegación de Next no cierra la conexión):

- `useOrbiChat` guarda un `AbortController` por envío en el store.
- Se aborta con: botón **Detener** (el botón de enviar se convierte en Detener mientras
  hay streaming), al cerrar el panel, con Nueva conversación, con logout/reset y al
  desmontar `AdminLayout`.
- Un `AbortError` no se muestra como "Error de conexión"; la burbuja queda con lo que
  llegó y la marca "Detenido".

**API** (`chat` y `chatWizard`):

- `const corte = new AbortController(); res.on('close', () => { if (!res.writableEnded)
  corte.abort(); });`
- `LlmAdapter.streamChat` suma `signal?: AbortSignal`: Gemini lo pasa como
  `config.abortSignal`, Groq en las opciones del request.
- `FallbackLlmAdapter` nunca cae al secundario por un corte; `esErrorDeDisponibilidad`
  devuelve `false` para errores de aborto.
- El loop revisa `corte.signal.aborted` antes de cada llamada al modelo, antes de cada
  tool y antes de `crear()` una propuesta.
- **En el `catch`:** si `corte.signal.aborted`, no se loguea error ni se escribe al
  stream; el turno queda `cancelled` y no se guarda respuesta de Orbi. En el wizard no se
  registra `WizardAiTurn` (ensuciaría la analítica con una respuesta vacía); el metering sí
  se registra.
- Verificación manual en producción: que el cierre del cliente llegue al contenedor a
  través del proxy de Firebase Hosting y Cloud Run. Si no llega, el corte del front igual
  evita la mayor parte del gasto porque deja de pedir turnos nuevos, pero la API termina la
  vuelta en curso.

### 3.8 Ids únicos y lector del stream

- **API:** `stepId` pasa a `randomUUID()` en los dos endpoints.
- **Front:** el parseo sale a `components/orbi/sseParser.ts`, módulo puro:
  - conserva la línea partida **y** el tipo de evento entre pedazos de red;
  - un `data:` que no es JSON válido se descarta sin cortar el stream;
  - `useOrbiChat` maneja `conversation` y `done`.
- CI: el job `web` de `.github/workflows/ci.yml` suma `pnpm test` sin cambiar el nombre del
  check (`Web — typecheck`). Hoy los tests de vitest no corren en CI.

### 3.9 Tarjeta de acción

`OrbiConfirmButton` se muestra para toda acción con `actionId` y cambia según el estado:

| Estado | Qué muestra |
|---|---|
| `pending` | Resumen · **Confirmar** · **Cancelar** · "No se hizo nada todavía" |
| `active` | Resumen · "Aplicando…" |
| `complete` | Resumen · ✓ "Listo" + resultado |
| `error` | Resumen · "No se pudo" + motivo |
| `rejected` (nuevo) | Resumen · "Cancelado" |
| `unknown` (nuevo) | Resumen · "No sé si se aplicó" + dónde revisarlo + **Reintentar** |

**Cómo se trata la respuesta de confirmar:**

| Respuesta | Qué hace la tarjeta |
|---|---|
| 200 | Muestra el resultado |
| 404 | "Esa acción ya no está disponible" (único caso que dice "pedísela de nuevo") |
| 409 `aplicando` | Sigue en "Aplicando…" y reintenta el **mismo** `actionId` con espera creciente (hasta ~5 intentos) |
| 409 `desconocido` | `unknown` con dónde revisar |
| Red caída o 5xx | `unknown` con **Reintentar** del mismo `actionId`: confirmar es idempotente, así que reintentar nunca duplica |

Nunca se le dice "pedísela de nuevo" a alguien cuya acción pudo haberse aplicado: eso
genera un `actionId` nuevo y dos cupones.

- **Confirmar y Cancelar se deshabilitan en todas las tarjetas mientras hay streaming**, así
  la nota no cae entre la pregunta y la respuesta.
- Botones con texto, foco visible, área táctil de 44 px y colores de tokens del tema.
- **Refrescar la pantalla afectada** después de una confirmación exitosa:
  - `createDiscount` / `createCoupon`: `invalidateQueries` de `['descuentos']` y
    `['cupones']` (verificar el `QueryClientProvider` del panel).
  - `createProduct`: `ProductoLista` escucha `orbi:accion-ejecutada` y llama a
    `cargarSilencioso()` (hoy `createdProductIds` solo marca filas ya cargadas).
  - Todas: `window.dispatchEvent(new CustomEvent('orbi:accion-ejecutada', { detail: {
    tool, data } }))`.

### 3.10 Orbi en el celular

- `Header.tsx`, barra de celular (`max-width: 768px`, el breakpoint del admin): botón de
  Orbi con `aria-label="Abrir Orbi"`, `aria-expanded` y área táctil de 44 px.
- La barra ya tiene cinco botones de 32 a 36 px: verificar a 320 px y, si no entra, ocultar
  el botón de tema en pantallas muy angostas.
- El ancla `'orbi'` de `tutoriales/anclas.ts` prueba primero `[aria-label="Abrir Orbi"]` y
  después el `title` del botón del menú lateral (que en el celular está oculto).

### 3.11 Retención y baja del negocio

**Retención** (`RetencionLogsService`, cada tabla con su variable y default, ampliando
`TablaConRetencion` y `ResultadoPurga`):

| Tabla | Variable | Default |
|---|---|---|
| `orbi_pending_actions` | `ORBI_PENDING_ACTIONS_RETENTION_DAYS` | 30 |
| `orbi_turns` | `ORBI_TURNS_RETENTION_DAYS` | 400 (alcanza para comparar año contra año en la fase 5) |
| `daily_quota` (corte por `day`) | `DAILY_QUOTA_RETENTION_DAYS` | 30 |

Se documenta en `DEPLOYMENT.md` y se ajustan `retencion-logs.unit-spec.ts` y el techo del
test de aislamiento de consultas (con el motivo).

**Baja definitiva del negocio.** La baja no borra la fila de `businesses` (pone
`deletedAt`), así que el `onDelete: Cascade` nunca se dispara. `orbiPendingAction` y
`orbiTurn` se suman a `operacionesDeBorradoDefinitivo` en `subscriptions.service.ts`, y
las filas de `daily_quota` con claves del negocio también. Se actualiza la lista `MODELOS`
de `purga-datos-baja.auditoria.unit-spec.ts`.

### 3.12 Precondiciones operativas

- **Billing de Gemini activo, antes de desplegar** (no después): proyecto de la key
  920298339029. Sin billing, Orbi vive cayendo a Groq y las condiciones del tier gratuito
  permiten a Google usar el contenido; con escrituras habilitadas eso incluye más datos de
  los negocios.
- **Permisos de los roles en producción:** consulta de solo lectura sobre todos los roles
  (owner, empleado, personalizados y los admin viejos) para confirmar que tienen los códigos
  que ahora piden las tools. La corre Alan.

### 3.13 `navigateTo` con links que existen

Hoy arma `/admin/ventas/${module}/${section}` (`navigation.tool.ts:32`), pero
`AdminSeccionShell` toma los **dos últimos** segmentos de la URL como módulo y sección
(`AdminSeccionShell.tsx:46-50`), y las subsecciones de Configuración van por `?vista=`
(`ConfigGeneral.tsx:5-7`). Un link a `configuracion` + `envios` termina en "Página no
encontrada". Además, la descripción de la tool no ofrece `cupones`, `categorias`,
`reportes`, `avanzado` ni `manual`, que sí existen.

- La lista de secciones del panel sale a una constante pura (`SECCIONES_DEL_PANEL`) que usan
  `componentMap` y un espejo en la API (no se puede importar el front desde la API: la imagen
  se construye solo con `apps/api`).
- `navigateTo` recibe `{ seccion, vista? }` con `seccion` limitada a esa lista (enum en el
  schema de la tool) y `vista` solo para Configuración, y arma
  `/admin/ventas/<seccion>` + `?vista=<vista>`.
- Test (API): cada combinación aceptada por la tool produce una ruta que resuelve el mismo
  algoritmo de `AdminSeccionShell`. Test (front): el espejo de la API coincide con la
  constante del front (comparando los dos archivos como texto, o con un snapshot).

## 4. Contrato del stream y endpoints

| Cambio | Detalle |
|---|---|
| `event: conversation` `{ id }` | Nuevo, primero en el stream del panel |
| `action_*` | `id` pasa a ser UUID |
| `POST /orbi/confirm` | Idempotente; 409 `aplicando` / `desconocido` |
| `POST /orbi/reject` | Nuevo |

## 5. Datos

Una migración aditiva (`<timestamp>_orbi_fase1_base`): `orbi_pending_actions`,
`daily_quota`, `orbi_turns` y sus índices y FKs, más las relaciones inversas en
`Business`. Revisar que el SQL generado tenga solo `CREATE TABLE`, `CREATE INDEX` y
`ADD CONSTRAINT` sobre tablas nuevas. Las propuestas y cuotas en memoria se pierden al
desplegar (duran 10 minutos y un día).

## 6. Tests

**Tests existentes que hay que adaptar:**

- `src/orbi/tools/tool-catalog.spec.ts` y `src/orbi/tools/definitions/product.tools.spec.ts`
  (códigos `:write`).
- `test/unit/orbi-pending-actions.unit-spec.ts` (store en memoria; se reemplaza, incluido
  el test de "quema").
- `test/unit/orbi.auditoria.unit-spec.ts` (usa `CuotaDiaria` sincrónica, construye el
  controller por posición, mock de respuesta sin `on`).
- `src/orbi/orbi.controller.spec.ts` (mock de respuesta sin `on` ni `writableEnded`;
  provee el store en memoria).
- `src/orbi/context/context-builder.spec.ts` (el caso que espera snapshot sin permisos).
- Tests de `products` e `image-studio` que usen `CuotaDiaria`.
- `retencion-logs.unit-spec.ts`, `aislamiento-consultas.unit-spec.ts`,
  `purga-datos-baja.auditoria.unit-spec.ts`.

**Tests nuevos (API, jest con mocks):**

- Catálogo: las cinco invariantes de 3.2; `permisosDeOrbi`.
- `describirAccion`: cada valor aparece; un `name` con instrucciones no aparece literal en
  la nota de la conversación.
- Validación: una propuesta con argumentos que el DTO rechaza no se crea.
- Demo: `proponer` devuelve `null` con `soloLectura`.
- Acciones: confirmar dos veces devuelve el mismo resultado; la tool que tira excepción
  deja `failed`; `executing` viejo da 409 `desconocido` sin re-ejecutar; conversación
  borrada no cambia la respuesta del confirmar; aislamiento de `reject` (otra persona u
  otro negocio → 404 y la acción ajena sigue `pending`); `reject` con JWT de customer o
  platform_admin → 403; `reject` de una ejecutada → 409 con resultado.
- Controller: `conversation` primero; id ajeno → nueva; corte → sin más llamadas ni tools,
  turno `cancelled`, sin `event: error`; `stepId` únicos; metering por proveedor.
- Adapter de Gemini: une `user,user` y `assistant,assistant`; descarta vacíos.
- `esErrorDeDisponibilidad` y fallback: un corte no cae a Groq.

**Tests contra Postgres real.** CI no tiene Postgres y mockea Prisma, así que el consumo
atómico, el `ON CONFLICT` de la cuota y el `UPDATE` atómico del historial no quedan
probados por los unitarios. Se agrega un e2e (`test:e2e`) que los cubre y **se corre a mano
contra la base de desarrollo antes del deploy**.

**Front (vitest, entorno `node`, ahora en CI):** `sseParser` (evento partido entre
pedazos, `event:` y `data:` en pedazos distintos, línea sin `\n`, JSON inválido); store
(`reset` vacía mensajes, `conversationId` y aborta); contador de sesión (eventos de un
stream viejo se descartan); tratamiento de las respuestas de confirmar (200, 404, 409, red).

## 7. Despliegue

**Las bases:** producción corre contra `dgergykdihtvsglfumsb` ("Orbita Produccion") desde
el 2026-09-21. El `.env` local de `apps/api` apunta a la base vieja
(`hhaqlzrcskmwnvhgydon`), que hoy es **desarrollo**. El paso 2 del `CLAUDE.md` raíz ("la
base local ES la de producción") y `DEPLOYMENT.md` quedaron desactualizados, y el control
de migraciones del preflight de `deploy.sh` mira la base del `.env` local: puede dar verde
sin que producción tenga las tablas nuevas. La API nueva saldría con 500 en la cuota y en
las propuestas.

**Orden:**

1. Precondición: billing de Gemini activo.
2. Commit en la rama → merge a `main` → push de `main` (Vercel despliega el front) → CI
   verde.
3. Migración en **desarrollo** con `pnpm exec prisma migrate deploy` (el `.env` local) y
   e2e de 6 contra esa base.
4. Migración en **producción**, aparte: `prisma migrate deploy` con las URLs de producción
   de `apps/api/.env.new` (leídas con parser literal: la contraseña tiene `$$`), y
   `prisma migrate status` contra producción para verificar. No confiar en el preflight
   para esto.
5. `deploy/deploy.sh`.
6. Consulta de permisos de los roles (3.12) y prueba manual del corte (3.7).

**Compatibilidad en la ventana entre front y API:** el front nuevo con la API vieja no
recibe `conversation` (queda como hoy) y `reject` da 404. La API nueva con el front viejo
crea una conversación por mensaje durante unos minutos. Nada se rompe.

Al terminar, comentar en Jira (RBT-695 u el ticket que corresponda) las decisiones de este
spec, según `apps/api/CLAUDE.md`. Corregir `CLAUDE.md` y `DEPLOYMENT.md` sobre las bases es
una tarea aparte.

## 8. Decisiones tomadas en este spec

| Decisión | Por qué |
|---|---|
| El dueño pasa siempre, vía `permisosDeOrbi` | Mismo criterio que `PermissionsGuard`; no depende de backfills |
| `generateDescription` pide `catalog.manage` y comparte la cuota de ai-assist | Por HTTP el mismo servicio exige `catalog.manage` |
| Las escrituras se endurecen en esta fase y no en la 4 | Arreglar los permisos las habilita por primera vez |
| Id de conversación ajeno o inexistente → conversación nueva | No distingue "no existe" de "no es tuyo" |
| Notas del historial solo con datos del servidor | El historial viaja 30 mensajes; un texto de terceros no puede quedar como si lo hubiera dicho Orbi |
| Historial con `UPDATE` atómico ya en esta fase | Esta fase agrega escritores concurrentes |
| Confirmar idempotente y `executing` acotado a 2 minutos | Un reintento nunca duplica y nada queda colgado para siempre |
| Cuota compartida para todas las IA, fuera de `orbi/` | Tres features la usan y ProductsModule no puede importar OrbiModule |
| Cuota con el SQL de `DemoIaService` | No infla el contador y ya está probado en el repo |
| Cerrar el panel aborta la respuesta | Sin reenganche a un stream en curso (fase 3), seguirla no le sirve a nadie |
| Telemetría sin texto; retención de 400 días | El texto ya está en la conversación; alcanza para comparar año contra año |
| Empleados pierden descuentos y reportes vía Orbi | Hoy los ven solo porque Orbi no chequeaba |
