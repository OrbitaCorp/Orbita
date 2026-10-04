# Orbi: medición de consumo, cupos en créditos y acceso auditado a conversaciones

Fecha: 2026-10-03. Estudio de origen: "Orbi — consumo, costos y privacidad"
(https://claude.ai/code/artifact/731f309d-6a9c-45c7-a330-5da28717a123). Este spec baja ese estudio a
decisiones de implementación. Plan: `docs/superpowers/plans/2026-10-03-orbi-medicion-y-cupos.md`.

## 1. Objetivo

Que cada mensaje a Orbi deje una ficha completa (tokens de entrada, caché, salida, pensamiento,
tiempo al primer token, tiempo total, vueltas, tools con su duración, acción propuesta y su
desenlace, costo en USD y créditos), que el superadmin la vea por negocio, miembro y mensaje, que
cada negocio tenga un cupo mensual en créditos que se pueda ajustar con registro, y que Órbita
pueda abrir una conversación solo con motivo y dejando rastro.

## 2. Restricción dura: cero gasto en Gemini

Alan lo pidió explícito el 2026-10-03: no hay plata para créditos de Gemini.

- Ningún paso del trabajo llama a Gemini ni a Groq: ni evals (`pnpm test:evals*`), ni smoke tests, ni
  `countTokens`, ni usar Orbi en un dev server con la key cargada, ni "Rehabilitar Orbi".
- Los tests corren con las keys vacías: `GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test`.
  Todo LLM se mockea (patrón de `gemini.adapter.spec.ts` y `motor-de-turno.spec.ts`).
- Si una tarea necesitara una llamada real, se frena y se le pide autorización a Alan.

## 3. Decisiones (tomadas por defecto; Alan las puede cambiar)

| # | Tema | Decisión | Cómo se cambia |
|---|---|---|---|
| D1 | Precios | Tabla en código por modelo y con vigencia: `apps/api/src/platform/costs/precios.ts` (llega con la rama `fix/costos-precio-por-modelo`). Se le suma el precio de la entrada cacheada. | Editar `precios.ts` |
| D2 | Unidad del cupo | 1 crédito = USD 0,001 a precio de lista vigente. `credits = ceil(costUsd × 1000)`. | Constante `USD_POR_CREDITO` |
| D3 | Período | Mes calendario de Argentina (`YYYY-MM`). Sin arrastre. | — |
| D4 | Cupo por plan | Base: 1.500 créditos/mes. Con el paquete Avanzado activo: 2.000. | Env `ORBI_CREDITOS_MES_BASE`, `ORBI_CREDITOS_MES_AVANZADO` |
| D5 | Bloqueo | **Modo medición**: se calcula y se muestra el %, pero no se bloquea. Con `ORBI_CUPO_BLOQUEA=true`, al 100% del negocio o del tope del miembro el chat responde 429. | Env `ORBI_CUPO_BLOQUEA` |
| D6 | Tope por miembro | Opcional. Lo fija el dueño como % del cupo del negocio (10 a 100). Sin fila = sin tope. | Pantalla "Uso de Orbi" del panel |
| D7 | Reseteo | Un **ajuste** de créditos (positivo o negativo) para un mes, con motivo y autor. Solo SUPERADMIN. Nunca se borra nada. | Superadmin → Orbi → Uso |
| D8 | Tope diario | Se mantienen los 300 mensajes/día por negocio contra abusos. Se **devuelve** el uso si el turno termina en error del proveedor. | — |
| D9 | Quién ve qué | Miembro: % propio y del negocio. Dueño/admin del negocio: % por miembro y acciones que Orbi ejecutó. Superadmin: todo (USD, tokens, fichas). Nadie fuera del superadmin ve USD ni tokens. | — |
| D10 | Lectura de conversaciones | La herramienta se construye **apagada** (`ORBI_LECTURA_CONVERSACIONES` distinto de `on` → 403). Solo SUPERADMIN, motivo obligatorio (`soporte`, `abuso`, `calidad`) + detalle, texto redactado con `redact.ts`, registro en `orbi_conversation_access` y `platform_admin_logs`. Se prende cuando la política de privacidad esté actualizada. | Env `ORBI_LECTURA_CONVERSACIONES=on` |
| D11 | Retención de sesiones no archivadas y de miembros borrados | Regla nueva, **apagada** por defecto (no borra nada hasta que Alan fije un plazo). | Env `ORBI_SESIONES_INACTIVAS_RETENTION_DAYS` |
| D12 | `usage_events` | Purga a los 400 días (como `orbi_turns`). En la baja definitiva de un negocio se quitan `memberId`, `conversationId` y `turnId` de su `metadata` (se conserva el costo). | Env `USAGE_EVENTS_RETENTION_DAYS` |
| D13 | Alertas | Cada noche, después del sync de costos, se evalúan los `cost_limits` activos contra el snapshot del mes y se crean `cost_alerts` al cruzar cada umbral (una vez por umbral y mes). Se ven en Superadmin → Costos (ya existe la pantalla). | Crear límites en Costos |

## 4. Fuera de alcance (y por qué)

- **Bajar el costo** (tool para listar categorías, tools por pantalla, orden del prompt para la caché,
  Flash-Lite para charla): cambia el comportamiento de Orbi y se valida con evals, que gastan Gemini.
  Requiere autorización de Alan.
- **Textos legales** (política de privacidad, TyC con cláusula de encargo), **inscripción en la AAIP**,
  **confirmar billing de Gemini** y **Data Controls de Groq**: son tareas de Alan o de un abogado.
- **Uso parcial de una llamada cortada**: hoy 0 turnos cancelados en producción; no se justifica.
- **Flux por negocio** en `usage_events`: entra en el free tier diario de Cloudflare y el adaptador
  de Cloudflare ya lo cuenta a nivel cuenta; duplicarlo distorsionaría Costos.

## 5. Modelo de datos

### 5.1 `orbi_turns` (se amplía; todas las columnas nuevas admiten null o tienen default)

| Columna | Tipo | Qué guarda |
|---|---|---|
| `provider` | text | `gemini`, `groq` o `mixto` (si el turno usó los dos) |
| `cached_tokens` | int | Suma de `cachedContentTokenCount` de las vueltas (ya incluidos en `prompt_tokens`) |
| `thinking_tokens` | int | Suma de `thoughtsTokenCount` (ya incluidos en `completion_tokens`) |
| `ttft_ms` | int | Desde que arrancó el turno hasta el primer evento de texto que vio la persona |
| `cost_usd` | decimal(12,6) | Costo total del mensaje: vueltas del modelo + IA que dispararon las tools |
| `tools_cost_usd` | decimal(12,6) | La parte de `cost_usd` que vino de tools (hoy, `generateDescription`) |
| `credits` | int | `ceil(cost_usd × 1000)` |
| `error_category` | text | Categoría de `clasificarError` cuando `status = 'error'` |
| `section` | text | `dto.context.section` (la pantalla) |
| `context_chars` | jsonb | `{ system, tools, history, message }` en caracteres, de la primera vuelta |
| `steps` | jsonb | Una entrada por vuelta (ver 5.2) |
| `writes_rejected` | int, default 0 | Escrituras que el modelo pidió y no llegaron a proponerse |
| `actions_confirmed` | int, default 0 | Se incrementa en `POST /orbi/confirm` exitoso |
| `actions_rejected` | int, default 0 | Se incrementa en `POST /orbi/reject` |

`status` suma el valor `quota` (mensaje frenado por el tope diario o por el cupo, sin llamar al
modelo). `id` del turno se genera al empezar el chat (`randomUUID()`) para poder enlazarlo.

### 5.2 Forma de `steps`

```ts
type PasoDelTurno = {
  n: number;                 // 1, 2, …
  provider: 'gemini' | 'groq' | null;
  model: string | null;
  promptTokens: number | null;
  cachedTokens: number | null;
  completionTokens: number | null;   // incluye pensamiento
  thinkingTokens: number | null;
  ms: number;                // duración de la vuelta: stream del modelo + tools corridas adentro
  tools: { name: string; tipo: 'lectura' | 'propuesta' | 'rechazada'; ms: number; ok: boolean }[];
};
```

### 5.3 Tablas nuevas

```prisma
model OrbiCupoAjuste {
  id         String   @id @default(uuid())
  businessId String   @map("business_id")
  mes        String   // 'YYYY-MM' de Argentina
  creditos   Int      // positivo suma cupo, negativo resta
  motivo     String
  adminId    String   @map("admin_id")
  createdAt  DateTime @default(now()) @map("created_at")
  @@index([businessId, mes])
  @@map("orbi_cupo_ajustes")
}

model OrbiCupoMiembro {
  businessId      String   @map("business_id")
  memberId        String   @map("member_id")
  topePorcentaje  Int      @map("tope_porcentaje") // 10..100 del cupo del negocio
  updatedBy       String   @map("updated_by")      // memberId del dueño
  updatedAt       DateTime @updatedAt @map("updated_at")
  @@id([businessId, memberId])
  @@map("orbi_cupo_miembros")
}

model OrbiConversationAccess {
  id             String   @id @default(uuid())
  adminId        String   @map("admin_id")
  conversationId String   @map("conversation_id")
  businessId     String   @map("business_id")
  memberId       String   @map("member_id")
  motivo         String   // soporte | abuso | calidad
  detalle        String
  ticket         String?
  createdAt      DateTime @default(now()) @map("created_at")
  @@index([conversationId])
  @@index([adminId, createdAt])
  @@map("orbi_conversation_access")
}
```

`orbi_pending_actions` suma `turn_id text null`. Todas las tablas nuevas con RLS habilitado y sin
policies (lo exige `test/unit/rls-supabase.unit-spec.ts`). En la baja definitiva del negocio se
borran `orbi_cupo_ajustes`, `orbi_cupo_miembros` y `orbi_conversation_access` de ese negocio.
`orbi_conversation_access` se purga a los 365 días (como `platform_admin_logs`).

## 6. Endpoints

| Método y ruta | Quién | Devuelve |
|---|---|---|
| `GET /orbi/uso` | miembro | `{ mes, bloquea, negocio: { porcentaje }, propio: { porcentaje, topePorcentaje } }` |
| `GET /orbi/uso/equipo` | `@Roles('owner','admin')` | `{ mes, negocio: { porcentaje }, miembros: [{ memberId, nombre, porcentaje, topePorcentaje }], acciones: [{ fecha, miembro, tool, resumen, estado }] }` |
| `PUT /orbi/uso/equipo/:memberId` | `@Roles('owner')` | body `{ topePorcentaje: number \| null }` → registro en `audit_logs` |
| `GET /platform/orbi/uso?mes=` | SUPERADMIN | resumen del mes (KPIs, serie diaria, acciones por costo, negocios) |
| `GET /platform/orbi/uso/negocios/:id?mes=` | SUPERADMIN | cupo, ajustes, miembros con USD/tokens/créditos |
| `GET /platform/orbi/uso/turnos?businessId=&memberId=&mes=&antesDe=` | SUPERADMIN | fichas sin texto, de a 50 |
| `POST /platform/orbi/uso/ajustes` | SUPERADMIN | body `{ businessId, mes, creditos, motivo }` → `platform_admin_logs` (`orbi_cupo_ajuste`) |
| `POST /platform/orbi/conversaciones/:id/abrir` | SUPERADMIN + flag | body `{ motivo, detalle, ticket? }` → texto redactado; `orbi_conversation_access` + `platform_admin_logs` (`orbi_conversacion_abierta`) |

Los porcentajes que ve el panel son enteros (`Math.floor`), pueden pasar de 100, y nunca viajan
créditos, tokens ni USD.

## 7. Pantallas

- **Superadmin → Orbi**: dos pestañas, "Estado" (lo que hay hoy) y "Uso" (nueva): KPIs del mes,
  serie diaria de mensajes y costo, acciones ordenadas por costo, negocios con su % de cupo; al
  entrar a un negocio, miembros, ajustes y fichas de mensajes; botón "Ajustar cupo"; en cada ficha,
  "Abrir conversación" (deshabilitado con explicación si el flag está apagado).
- **Panel → Orbi**: barra fina con el % usado en el encabezado del chat (solo si supera el 50%) y,
  para dueño/admin, la vista `?vista=uso` con el % por miembro, sus topes y las acciones ejecutadas.
  Manual del panel actualizado (`contenido.ts`) y regenerado.
- **Chat**: una línea fija bajo el input la primera vez: "Lo que escribís se guarda en tu historial
  y lo procesa Google Gemini. Más info en Privacidad."
