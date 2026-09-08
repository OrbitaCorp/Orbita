# Migración de proveedor de IA: Groq → Gemini

**Goal:** Reemplazar Groq por Gemini como proveedor de IA de todo `apps/api/` (chat de Orbi, `product-ai.service`, tools del wizard, evals), sin cambiar el contrato `LlmAdapter`.

**Architecture:** Gemini expone un endpoint **OpenAI-compatible**
(`https://generativelanguage.googleapis.com/v1beta/openai/`). Los tres call sites
(`groq.adapter.ts`, `product-ai.service.ts`, `wizard.tools.ts`) ya usan la forma
`chat.completions.create` de OpenAI (porque `groq-sdk` la espeja). Así que la
migración es: cambiar `groq-sdk` por `openai`, apuntar el `baseURL` a Gemini,
usar `GEMINI_API_KEY`, y ajustar los IDs de modelo. El streaming, `tools`,
`response_format: json_object` y `reasoning_effort` funcionan igual sobre el
endpoint compat.

**Modelo por superficie:** `streamChat` acepta un `model?` opcional; el controller
pasa `ORBI_MODEL_PANEL` para el panel y `ORBI_MODEL_WIZARD` para el wizard (ambos
con fallback a `ORBI_MODEL` y luego al default `gemini-2.5-flash`). Arrancamos
todo en flash; promover el panel a un modelo pro es cambiar una env var de Cloud
Run, sin deploy de código.

**Tech Stack:** NestJS 11, `openai` ^5, Jest, ts-node (evals).

**Spec:** conversación con el usuario (2026-09-08). Decisiones: API key de Google
AI Studio (no Vertex), alcance = todo Groq → Gemini, flash para ambas superficies
al inicio.

## Global Constraints

- El contrato `LlmAdapter` / `LlmEvent` / `LlmMessage` **no cambia** su forma
  pública salvo el nuevo `model?` opcional en el parámetro de `streamChat`.
- Base URL exacta: `https://generativelanguage.googleapis.com/v1beta/openai/`
- Secret nuevo: `GEMINI_API_KEY` (ya creado en Secret Manager del proyecto
  `orbita-api-corp`). Se elimina `GROQ_API_KEY`.
- Default de modelo en código: `gemini-2.5-flash`. Overridable por env.
- `pnpm typecheck` y `pnpm test` (las dos suites) tienen que quedar en verde —
  es lo que corre el CI.
- El backend es **deploy manual**: `cd apps/api && ./deploy/deploy.sh`.

---

### Task 1: Dependencia `openai` en vez de `groq-sdk`

**Files:**
- Modify: `apps/api/package.json`

- [ ] Quitar `"groq-sdk": "^1.5.0"` de `dependencies`, agregar `"openai": "^5.12.0"`.
- [ ] `cd apps/api && pnpm install`
- [ ] Commit: `chore(api): cambiar groq-sdk por openai`

---

### Task 2: Factory de cliente Gemini compartido

**Files:**
- Create: `apps/api/src/orbi/llm/gemini-client.ts`

**Interfaces:**
- Produces: `createGeminiClient(config: ConfigService): OpenAI` — lanza
  `ServiceUnavailableException` si falta `GEMINI_API_KEY`.
- Produces: `GEMINI_BASE_URL` (const string), `DEFAULT_MODEL = 'gemini-2.5-flash'`.

- [ ] Escribir el módulo:

```ts
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
export const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Cliente OpenAI apuntado al endpoint OpenAI-compatible de Gemini. Lazy y
 * compartido por el adapter de Orbi, ProductAiService y las tools del wizard:
 * si GEMINI_API_KEY no está configurada, esos tres flujos quedan inhabilitados
 * (503) pero el resto del backend sigue funcionando.
 */
export function createGeminiClient(config: ConfigService): OpenAI {
  const apiKey = config.get<string>('GEMINI_API_KEY');
  if (!apiKey) throw new ServiceUnavailableException('GEMINI_API_KEY no configurada');
  return new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
}
```

- [ ] `pnpm typecheck`
- [ ] Commit: `feat(api): factory de cliente Gemini (OpenAI-compat)`

---

### Task 3: `GeminiAdapter` reemplaza a `GroqAdapter`

**Files:**
- Create: `apps/api/src/orbi/llm/gemini.adapter.ts` (desde `groq.adapter.ts`)
- Delete: `apps/api/src/orbi/llm/groq.adapter.ts`
- Modify: `apps/api/src/orbi/llm/llm-adapter.interface.ts` (agregar `model?` al param de `streamChat`)
- Create: `apps/api/src/orbi/llm/gemini.adapter.spec.ts` (desde `groq.adapter.spec.ts`)
- Delete: `apps/api/src/orbi/llm/groq.adapter.spec.ts`

**Interfaces:**
- Consumes: `createGeminiClient`, `DEFAULT_MODEL` de Task 2.
- Produces: `class GeminiAdapter implements LlmAdapter`, `get modelo(): string`
  (para el reporte de evals).
- Produces: `LlmAdapter.streamChat(params: { messages; tools?; model? })`.

- [ ] En `llm-adapter.interface.ts`, agregar `model?: string` al objeto de params
  de `streamChat` (interfaz y type).
- [ ] Copiar `groq.adapter.ts` a `gemini.adapter.ts`. Cambios:
  - `import OpenAI from 'openai'` + `createGeminiClient`, `DEFAULT_MODEL`.
  - Clase `GeminiAdapter`, logger `GeminiAdapter.name`, `private client: OpenAI | null`.
  - `MODELO_POR_DEFECTO = DEFAULT_MODEL`.
  - `getClient()` → `this.client ??= createGeminiClient(this.config)`.
  - `streamChat({ messages, tools, model })`: `const modeloEfectivo = model ?? this.modelo`.
  - `client.chat.completions.create({ model: modeloEfectivo, ..., stream: true,
    stream_options: { include_usage: true } })`.
  - Borrar el manejo de `x_groq`: el chunk de usage ahora es estándar
    (`chunk.usage` con `prompt_tokens` / `completion_tokens`, y `choices: []`).
  - `reasoning_effort` se sigue pasando igual.
  - El mapeo de mensajes (`role: 'tool'`, `assistant` con `tool_calls`
    reconstruidos) queda igual — es formato OpenAI.
  - En el yield de `usage`, `model: modeloEfectivo`.
- [ ] Borrar `groq.adapter.ts`.
- [ ] Portar el spec a `gemini.adapter.spec.ts`:
  - `GroqAdapter` → `GeminiAdapter`, `GROQ_API_KEY` → `GEMINI_API_KEY`.
  - El mock de stream de texto y de tool_calls queda igual (misma forma
    `.choices[0].delta`).
  - Agregar un caso: chunk final `{ choices: [], usage: { prompt_tokens: 10,
    completion_tokens: 5 } }` → emite `{ type: 'usage', usage: { model:
    'gemini-2.5-flash', promptTokens: 10, completionTokens: 5 } }` antes de `done`.
  - Agregar un caso: `streamChat({ messages, model: 'gemini-2.5-pro' })` pasa
    `model: 'gemini-2.5-pro'` al `create` mockeado.
- [ ] Borrar `groq.adapter.spec.ts`.
- [ ] `pnpm test:src` (corre los `.spec.ts`)
- [ ] `pnpm typecheck`
- [ ] Commit: `feat(api): GeminiAdapter reemplaza GroqAdapter, modelo por parámetro`

---

### Task 4: Bindings de DI y modelo por superficie en el controller

**Files:**
- Modify: `apps/api/src/orbi/orbi.module.ts`
- Modify: `apps/api/src/wizard-analytics/wizard-analytics.module.ts`
- Modify: `apps/api/src/orbi/orbi.controller.ts`

**Interfaces:**
- Consumes: `GeminiAdapter`, `streamChat({ ..., model? })` de Task 3.

- [ ] `orbi.module.ts` y `wizard-analytics.module.ts`: `import { GeminiAdapter }
  from '.../llm/gemini.adapter'` y `{ provide: LLM_ADAPTER, useClass: GeminiAdapter }`.
- [ ] `orbi.controller.ts`: helper privado
  `private modeloPara(surface: OrbiSurface): string | undefined` que lee
  `ORBI_MODEL_PANEL` / `ORBI_MODEL_WIZARD` del `ConfigService` (undefined si no
  están: el adapter cae a su default). Requiere inyectar `ConfigService` en el
  constructor (no está hoy).
- [ ] En las dos llamadas `this.llm.streamChat({ messages, tools: ... })`
  (método `chat` y `chatWizard`), pasar `model: this.modeloPara(surface)`.
- [ ] Revisar `orbi.controller.spec.ts`: el mock de `streamChat` no valida el
  param, pero el constructor ahora pide `ConfigService` — agregar el mock.
- [ ] `pnpm test && pnpm typecheck`
- [ ] Commit: `feat(api): Orbi elige modelo Gemini por superficie (panel/wizard)`

---

### Task 5: `product-ai.service.ts` a Gemini

**Files:**
- Modify: `apps/api/src/products/product-ai.service.ts`
- Modify: `apps/api/test/unit/product-ai.service.unit-spec.ts`

- [ ] `product-ai.service.ts`:
  - `import OpenAI from 'openai'` + `createGeminiClient` de `../orbi/llm/gemini-client`.
  - `private client: OpenAI | null`; `getClient()` → `createGeminiClient(this.config)`.
  - `model:` sale de `this.config.get('PRODUCT_AI_MODEL') ?? 'gemini-2.5-flash'`.
  - Tipo de `response` → `OpenAI.Chat.Completions.ChatCompletion`.
  - `error instanceof Groq.APIError` → `error instanceof OpenAI.APIError`.
  - Textos de log: "Groq" → "Gemini" (cosmético pero se hace).
  - `max_completion_tokens` y `response_format` quedan igual.
- [ ] `product-ai.service.unit-spec.ts`:
  - `import OpenAI from 'openai'`.
  - El test de 401: `throw new OpenAI.AuthenticationError(401, undefined, 'Invalid API Key', undefined)`.
  - El test "pide 3000 max_completion_tokens" queda igual.
  - Renombrar los `it(...)` que dicen "Groq"/"GROQ_API_KEY" a "Gemini"/"GEMINI_API_KEY"
    (no cambia comportamiento, solo lectura).
  - El mock `(svc as any).client = { chat: { completions: { create } } }` queda igual.
- [ ] `pnpm test:unit`
- [ ] Commit: `feat(api): product-ai.service usa Gemini`

---

### Task 6: Tools del wizard a Gemini

**Files:**
- Modify: `apps/api/src/orbi/tools/definitions/wizard.tools.ts`

- [ ] `getGroqClient` → `getGeminiClient` usando `createGeminiClient` de
  `../../llm/gemini-client`.
- [ ] `SuggestBusinessNameTool` y `SuggestDescriptionTool`:
  `model: config.get('WIZARD_TOOLS_MODEL') ?? 'gemini-2.5-flash'` (o simplemente
  `'gemini-2.5-flash'` fijo — son llamadas chicas). `reasoning_effort`,
  `max_completion_tokens`, `response_format` quedan igual.
- [ ] Mensajes de error internos: "Groq no devolvió..." → "Gemini no devolvió...".
- [ ] Buscar specs de estas tools (`wizard.tools.spec.ts` si existe) y ajustar.
- [ ] `pnpm test && pnpm typecheck`
- [ ] Commit: `feat(api): tools del wizard (sugerir nombre/descripción) usan Gemini`

---

### Task 7: Evals

**Files:**
- Modify: `apps/api/test/evals/run.ts`

- [ ] `GroqAdapter` → `GeminiAdapter`; `import` desde `gemini.adapter`.
- [ ] `GROQ_API_KEY` → `GEMINI_API_KEY` (chequeo de env y mensaje de error).
- [ ] Comentarios que hablan de "Groq" / "tier gratuito de Groq" → Gemini.
  El retry por rate limit (`429` / `rate_limit_exceeded`) se deja: el mensaje de
  Gemini también trae `429` cuando corta; el regex de segundos puede no matchear
  y cae al default de 10s, que está bien.
- [ ] `test/unit/orbi-evals-reglas.unit-spec.ts`: solo un comentario menciona
  `GROQ_API_KEY` — actualizar el texto, no hay código que tocar.
- [ ] `pnpm typecheck`
- [ ] Commit: `chore(api): evals corren contra Gemini`

---

### Task 8: Env + deploy

**Files:**
- Modify: `apps/api/.env.example`
- Modify: `apps/api/deploy/deploy.sh`

- [ ] `.env.example`: `GROQ_API_KEY=` → bloque `GEMINI_API_KEY=` con comentario
  (de dónde sale: aistudio.google.com; si queda vacía, Orbi/product-ai responden
  503). Documentar `ORBI_MODEL_PANEL`, `ORBI_MODEL_WIZARD`, `PRODUCT_AI_MODEL`
  como opcionales (default `gemini-2.5-flash`).
- [ ] `deploy/deploy.sh` línea `SECRETS=`: `GROQ_API_KEY=GROQ_API_KEY:latest` →
  `GEMINI_API_KEY=GEMINI_API_KEY:latest`.
- [ ] `env-vars.yaml`: **no** se toca ahora (arrancamos flash en las dos
  superficies; el default del código alcanza).
- [ ] Commit: `chore(api): GEMINI_API_KEY en env.example y deploy.sh`

---

### Task 9: Verificación y deploy

- [ ] `cd apps/api && pnpm typecheck && pnpm test` — las dos suites en verde.
- [ ] `git grep -in "groq" apps/api -- ':!pnpm-lock.yaml'` — solo quedan menciones
  históricas en `.md` / `PENDIENTES.md`, nada en código.
- [ ] `pnpm build` — compila.
- [ ] Push a `main`.
- [ ] `cd apps/api && ./deploy/deploy.sh`.
- [ ] Smoke test contra `https://api.orbita.site`: un `POST /api/v1/orbi/chat/wizard`
  (endpoint público, 10 req/min) con un mensaje simple y verificar que streamea
  texto y que el evento `usage` trae `model: gemini-*`.
- [ ] Revisar logs de Cloud Run (`gcloud run services logs read orbita-api
  --project orbita-api-corp --region southamerica-east1 --limit 50`) — sin
  errores de auth de Gemini.
- [ ] Comentar en Jira (buscar el ticket de la migración o crear uno en RBT): qué
  cambió, que el baseline de evals de RBT-686 es contra Groq y hay que re-corr­er
  la suite (`pnpm test:evals --repeticiones=5`) para tener el nuevo baseline con
  Gemini flash antes de decidir si el panel necesita un modelo pro.

## Self-Review

- **Cobertura del spec:** API key AI Studio (Task 2, 8) ✓ · alcance total —
  adapter (3,4), product-ai (5), wizard.tools (6), evals (7) ✓ · flash en ambas
  superficies (Task 4, defaults) ✓ · control de costo: modelo por env (Task 4),
  telemetría de `usage` ya existe y se preserva (Task 3) ✓ · deploy manual (Task 9) ✓.
- **Placeholders:** ninguno — cada task tiene los cambios concretos.
- **Consistencia de tipos:** `createGeminiClient` (Task 2) se consume igual en 3,
  5, 6. `streamChat({ model? })` se define en Task 3 y se usa en Task 4.
  `GeminiAdapter.modelo` lo usa `run.ts` en Task 7.
- **Riesgo abierto:** los IDs `gemini-2.5-flash` / `-pro` pueden estar
  desactualizados (es 09-2026, ya salió Gemini 3.x). Mitigado: todo es
  overridable por env sin deploy de código. Confirmar el ID vigente en la consola
  de AI Studio y setear `ORBI_MODEL_*` si se quiere otro.
