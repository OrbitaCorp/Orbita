# Orbi: medición, cupos en créditos y acceso auditado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada mensaje a Orbi deje una ficha completa con costo y créditos, que el superadmin la vea por negocio, miembro y mensaje, que cada negocio tenga un cupo mensual ajustable con registro y que Órbita pueda abrir una conversación solo con motivo y rastro.

**Architecture:** Los adapters informan el consumo detallado de cada llamada; el motor del turno arma una lista de pasos (vueltas y tools); el controller guarda la ficha ampliada en `orbi_turns` con su costo calculado con `precios.ts`. Un `CupoOrbiService` suma créditos de `orbi_turns` contra el cupo del plan más ajustes. Un módulo nuevo `platform/orbi-uso` expone las vistas del superadmin y la lectura auditada de conversaciones (apagada por flag).

**Tech Stack:** NestJS 10 + Prisma (Postgres/Supabase), Jest (ts-jest), Next.js + React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-03-orbi-medicion-y-cupos-design.md`

## Global Constraints

- **Cero llamadas a Gemini o Groq.** Ningún paso corre evals (`pnpm test:evals*`), smoke tests, `countTokens`, el chat de Orbi en un dev server, ni "Rehabilitar Orbi". Todo LLM se mockea. Si algo lo necesita: frenar y pedir autorización a Alan.
- Los tests de la API se corren SIEMPRE así: `GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test` (desde `apps/api`).
- Trabajar solo en el worktree `C:/dev/GitHub/Orbita-Frontend/.claude/worktrees/orbi-medicion` (rama `feat/orbi-medicion`). El checkout principal lo usa otra sesión: no tocarlo.
- No se pushea ni se despliega nada: eso lo autoriza Alan al final (flujo de `CLAUDE.md`).
- La migración se aplica **solo en DEV** (`pnpm exec prisma migrate deploy` con el `.env` local). Nunca `deploy/prisma-prod.sh`.
- Toda tabla nueva lleva `ENABLE ROW LEVEL SECURITY` en la misma migración (lo exige `test/unit/rls-supabase.unit-spec.ts`).
- Fuera del superadmin nunca viajan tokens, créditos ni USD: el panel ve porcentajes enteros.
- Comentarios y textos en español rioplatense, como el resto del repo. Commits con el trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Flags y defaults: `ORBI_CUPO_BLOQUEA` (default apagado), `ORBI_LECTURA_CONVERSACIONES` (default apagado), `ORBI_CREDITOS_MES_BASE=1500`, `ORBI_CREDITOS_MES_AVANZADO=2000`, `ORBI_SESIONES_INACTIVAS_RETENTION_DAYS` (default `off`), `USAGE_EVENTS_RETENTION_DAYS=400`, `ORBI_CONVERSATION_ACCESS_RETENTION_DAYS=365`.
- 1 crédito = USD 0,001 a precio de lista: `credits = Math.ceil(costUsd * 1000)`.

## Dependencia externa

La tabla de precios por modelo (`apps/api/src/platform/costs/precios.ts`) la está haciendo otra sesión en la rama `fix/costos-precio-por-modelo` (todavía sin commitear al 2026-10-03). **Las tareas 1 a 5 no la necesitan.** La tarea 6 empieza integrándola: si para entonces no está commiteada, frenar y avisar.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `apps/api/src/orbi/llm/llm-adapter.interface.ts` | `LlmUsage` con `cachedTokens` y `thinkingTokens` |
| `apps/api/src/orbi/llm/{gemini,groq}.adapter.ts`, `text-generation.ts` | Llenan esos campos |
| `apps/api/src/orbi/turno/motor-de-turno.ts` | Pasos por vuelta, TTFT, escrituras rechazadas, consumo de tools |
| `apps/api/src/orbi/turno/ficha-del-turno.ts` (nuevo) | Funciones puras: proveedor, sumas, caracteres del contexto |
| `apps/api/src/orbi/turno/costo-del-turno.ts` (nuevo) | Costo USD y créditos de un turno |
| `apps/api/src/orbi/orbi-turn.service.ts` | Registrar la ficha ampliada y contar desenlaces |
| `apps/api/src/orbi/orbi.controller.ts` | Cableado: id del turno, ficha, cupo, devolución de la cuota |
| `apps/api/src/common/cuota/cuota.service.ts` | `devolver` |
| `apps/api/src/common/utils/hora-argentina.ts` | `mesArgentina`, `rangoDeMesArgentina` |
| `apps/api/src/orbi/cupo/cupo-orbi.service.ts` + `cupo-orbi.module.ts` (nuevos) | Cupo mensual, uso, topes, ajustes |
| `apps/api/src/orbi/cupo/orbi-uso.controller.ts` (nuevo) | `GET /orbi/uso`, `/orbi/uso/equipo`, `PUT /orbi/uso/equipo/:memberId` |
| `apps/api/src/platform/orbi-uso/*` (nuevo) | Endpoints del superadmin y lectura auditada |
| `apps/api/src/platform/costs/alertas-de-costo.service.ts` (nuevo) | Crea `cost_alerts` al cruzar umbrales |
| `apps/web/src/modules/superadmin/OrbiUso.tsx` (nuevo) | Pestaña "Uso" del superadmin |
| `apps/web/src/modules/orbi/api/uso.ts`, `piezas/BarraDeUso.tsx`, `vistas/OrbiUsoPagina.tsx` (nuevos) | Panel: % y vista del equipo |

---

## Task 0: Preparar el worktree y la línea de base

**Files:** ninguno del repo.

- [ ] **Step 1: Instalar dependencias**

```bash
cd C:/dev/GitHub/Orbita-Frontend/.claude/worktrees/orbi-medicion/apps/api && pnpm install --frozen-lockfile
cd ../web && pnpm install --frozen-lockfile
```

- [ ] **Step 2: Copiar el `.env` de DEV de la API** (es de dev; no imprimirlo)

```bash
cp C:/dev/GitHub/Orbita-Frontend/apps/api/.env C:/dev/GitHub/Orbita-Frontend/.claude/worktrees/orbi-medicion/apps/api/.env
```

- [ ] **Step 3: Línea de base**

```bash
cd apps/api && pnpm exec prisma generate && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test
cd ../web && pnpm exec tsc --noEmit && pnpm test
```

Expected: todo verde. Si algo ya falla en `main`, anotarlo y no arreglarlo acá.

---

## Task 1: Consumo detallado por llamada (caché y pensamiento)

**Files:**
- Modify: `apps/api/src/orbi/llm/llm-adapter.interface.ts` (interface `LlmUsage`)
- Modify: `apps/api/src/orbi/llm/gemini.adapter.ts` (bloque `usageMetadata`, ~líneas 181-195)
- Modify: `apps/api/src/orbi/llm/groq.adapter.ts` (lectura de `usage`, ~líneas 128-136)
- Modify: `apps/api/src/orbi/llm/text-generation.ts` (`GenerarTextoResult`, `conGemini`, `conGroq`)
- Test: `apps/api/src/orbi/llm/gemini.adapter.spec.ts`, `apps/api/src/orbi/llm/groq.adapter.spec.ts`

**Interfaces:**
- Produces: `LlmUsage { model; promptTokens; completionTokens; provider; cachedTokens?: number; thinkingTokens?: number }`. `promptTokens` sigue INCLUYENDO lo cacheado y `completionTokens` sigue INCLUYENDO el pensamiento (no cambia ninguna suma existente). `GenerarTextoResult` suma `cachedTokens?` y `thinkingTokens?`.

- [ ] **Step 1: Test que falla (Gemini)** — agregar a `gemini.adapter.spec.ts`:

```ts
it('informa tokens cacheados y de pensamiento sin cambiar los totales', async () => {
  configService.get.mockReturnValue('test-key');
  mockStream(adapter, [
    textChunk('Hola'),
    { candidates: [{ content: { parts: [] } }], usageMetadata: { promptTokenCount: 5000, cachedContentTokenCount: 4096, candidatesTokenCount: 40, thoughtsTokenCount: 60 } },
  ]);
  const events: any[] = [];
  for await (const e of adapter.streamChat({ messages: [{ role: 'user', content: 'hola' }] })) events.push(e);
  const usage = events.find(e => e.type === 'usage').usage;
  expect(usage).toMatchObject({ promptTokens: 5000, completionTokens: 100, cachedTokens: 4096, thinkingTokens: 60, provider: 'gemini' });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `cd apps/api && GEMINI_API_KEY= GROQ_API_KEY= pnpm exec jest --config ./test/jest-src.json src/orbi/llm/gemini.adapter.spec.ts -t "cacheados"`
Expected: FAIL (`cachedTokens` undefined).

- [ ] **Step 3: Implementar**

En `llm-adapter.interface.ts`, dentro de `LlmUsage`, después de `completionTokens`:

```ts
  /** De `promptTokens`, cuántos vinieron de la caché del proveedor (se cobran más barato). Ya incluidos en promptTokens. */
  cachedTokens?: number;
  /** De `completionTokens`, cuántos fueron pensamiento. Ya incluidos en completionTokens. */
  thinkingTokens?: number;
```

En `gemini.adapter.ts`, el tipo de `usage` y su asignación:

```ts
    let usage: { promptTokens: number; completionTokens: number; cachedTokens: number; thinkingTokens: number } | null = null;
    // …
      const um = chunk.usageMetadata;
      if (um?.promptTokenCount != null) {
        usage = {
          promptTokens: um.promptTokenCount ?? 0,
          // El thinking cuenta como tokens de salida y se factura como tal.
          completionTokens: (um.candidatesTokenCount ?? 0) + (um.thoughtsTokenCount ?? 0),
          cachedTokens: um.cachedContentTokenCount ?? 0,
          thinkingTokens: um.thoughtsTokenCount ?? 0,
        };
      }
```

En `groq.adapter.ts`, ampliar el cast y la asignación (Groq usa la forma de OpenAI):

```ts
      const u = (crudo.usage ?? crudo.x_groq?.usage) as
        | {
            prompt_tokens?: number;
            completion_tokens?: number;
            prompt_tokens_details?: { cached_tokens?: number };
            completion_tokens_details?: { reasoning_tokens?: number };
          }
        | undefined;
      if (u?.prompt_tokens !== undefined) {
        usage = {
          promptTokens: u.prompt_tokens ?? 0,
          completionTokens: u.completion_tokens ?? 0,
          cachedTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
          thinkingTokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
        };
      }
```
(y el tipo de la variable `usage` con los dos campos nuevos).

En `text-generation.ts`, sumar a `GenerarTextoResult`:

```ts
  /** De promptTokens, los que vinieron de caché. */
  cachedTokens?: number;
  /** De completionTokens, los de pensamiento. */
  thinkingTokens?: number;
```

y en `conGemini`: `cachedTokens: uso?.cachedContentTokenCount ?? undefined, thinkingTokens: uso?.thoughtsTokenCount ?? undefined,`; en `conGroq`: `cachedTokens: (response.usage as { prompt_tokens_details?: { cached_tokens?: number } } | undefined)?.prompt_tokens_details?.cached_tokens, thinkingTokens: (response.usage as { completion_tokens_details?: { reasoning_tokens?: number } } | undefined)?.completion_tokens_details?.reasoning_tokens,`.

- [ ] **Step 4: Test de Groq** — en `groq.adapter.spec.ts`, copiar el patrón del test de usage existente (buscar `prompt_tokens` en el archivo) y agregar un chunk con `usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 64 }, completion_tokens_details: { reasoning_tokens: 5 } }`, esperando `cachedTokens: 64, thinkingTokens: 5`.

- [ ] **Step 5: Correr la suite de llm**

Run: `cd apps/api && GEMINI_API_KEY= GROQ_API_KEY= pnpm exec jest --config ./test/jest-src.json src/orbi/llm`
Expected: PASS. Ajustar con `toMatchObject` los tests viejos que comparaban el `usage` con `toEqual` exacto.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/orbi/llm
git commit -m "feat(orbi): los adapters informan tokens cacheados y de pensamiento por llamada"
```

---

## Task 2: El motor arma los pasos del turno

**Files:**
- Modify: `apps/api/src/orbi/turno/motor-de-turno.ts`
- Modify: `apps/api/src/orbi/tools/tool.interface.ts` (`ToolResult.consumo?`, `ToolExecutionContext.turnId?`)
- Test: `apps/api/src/orbi/turno/motor-de-turno.spec.ts`

**Interfaces:**
- Consumes: `LlmUsage.cachedTokens/thinkingTokens` (Task 1).
- Produces (exportados desde `motor-de-turno.ts`):

```ts
export interface ToolDelPaso { name: string; tipo: 'lectura' | 'propuesta' | 'rechazada'; ms: number; ok: boolean }
export interface PasoDelTurno {
  n: number;
  provider: LlmUsage['provider'] | null;
  model: string | null;
  promptTokens: number | null;
  cachedTokens: number | null;
  completionTokens: number | null;
  thinkingTokens: number | null;
  /** Duración de la vuelta: stream del modelo más las tools que se corrieron adentro. */
  ms: number;
  tools: ToolDelPaso[];
}
export type ConsumoPorProveedor = Map<LlmUsage['provider'], { model: string; promptTokens: number; completionTokens: number; cachedTokens: number; thinkingTokens: number }>;
// ProgresoDelTurno suma: pasos: PasoDelTurno[]; escriturasRechazadas: number; ttftMs?: number; consumoDeTools: ConsumoPorProveedor
// TurnoACorrer suma: reloj?: () => number; inicio?: number
// ToolResult suma: consumo?: LlmUsage  (NUNCA viaja al modelo ni al front)
// ToolExecutionContext suma: turnId?: string
```

- [ ] **Step 1: Tests que fallan** — agregar a `motor-de-turno.spec.ts`:

```ts
describe('pasos del turno', () => {
  const reloj = () => { let t = 1000; return () => (t += 10); };

  it('anota una entrada por vuelta con su consumo y sus tools', async () => {
    const { e } = emisor();
    const t = turno({
      llm: guion([
        [llamada('listOrders'), { type: 'usage', usage: { model: 'm', provider: 'gemini', promptTokens: 5000, completionTokens: 30, cachedTokens: 0, thinkingTokens: 10 } }, { type: 'done' }],
        [{ type: 'text', chunk: 'Hay 4.' }, { type: 'usage', usage: { model: 'm', provider: 'gemini', promptTokens: 5600, completionTokens: 20, cachedTokens: 4096, thinkingTokens: 5 } }, { type: 'done' }],
      ]),
      registry: registry(), emisor: e, reloj: reloj(), inicio: 1000,
    });
    await correrTurno(t);
    expect(t.progreso.pasos).toHaveLength(2);
    expect(t.progreso.pasos[0]).toMatchObject({ n: 1, provider: 'gemini', promptTokens: 5000, thinkingTokens: 10, tools: [{ name: 'listOrders', tipo: 'lectura', ok: true }] });
    expect(t.progreso.pasos[1]).toMatchObject({ n: 2, cachedTokens: 4096, tools: [] });
    expect(t.progreso.consumo.get('gemini')).toMatchObject({ promptTokens: 10600, cachedTokens: 4096, thinkingTokens: 15 });
    expect(t.progreso.ttftMs).toBeGreaterThan(0);
  });

  it('cuenta las escrituras rechazadas', async () => {
    const { e } = emisor();
    const reg = { proponer: jest.fn(async () => ({ error: 'falta la categoría' })), requiereConfirmacion: jest.fn(() => true), execute: jest.fn() };
    const t = turno({ llm: guion([[llamada('createProduct'), { type: 'done' }], [{ type: 'text', chunk: 'No pude.' }, { type: 'done' }]]), registry: reg, emisor: e });
    await correrTurno(t);
    expect(t.progreso.escriturasRechazadas).toBe(1);
    expect(t.progreso.pasos[0].tools[0]).toMatchObject({ tipo: 'rechazada', ok: false });
  });

  it('el consumo de IA de una tool se suma aparte y no viaja al modelo', async () => {
    const { e } = emisor();
    const reg = registry();
    reg.execute.mockResolvedValue({ success: true, label: 'ok', data: { d: 1 }, consumo: { model: 'm', provider: 'gemini', promptTokens: 800, completionTokens: 500 } } as never);
    const messages: any[] = [];
    const t = turno({ llm: guion([[llamada('generateDescription'), { type: 'done' }], [{ type: 'text', chunk: 'Listo' }, { type: 'done' }]]), registry: reg, emisor: e, messages });
    await correrTurno(t);
    expect(t.progreso.consumoDeTools.get('gemini')).toMatchObject({ promptTokens: 800, completionTokens: 500 });
    const resultadoAlModelo = messages.find(m => m.role === 'tool').content;
    expect(resultadoAlModelo).not.toContain('consumo');
  });
});
```

- [ ] **Step 2: Verlos fallar**

Run: `cd apps/api && GEMINI_API_KEY= GROQ_API_KEY= pnpm exec jest --config ./test/jest-src.json src/orbi/turno -t "pasos del turno"`
Expected: FAIL (`pasos` undefined).

- [ ] **Step 3: Implementar**

En `tool.interface.ts`: en `ToolExecutionContext` agregar `/** El turno de Orbi que corre la tool (para atribuirle la IA que dispare). */ turnId?: string;` y en `ToolResult` agregar `/** Consumo de IA que hizo la tool (ej. generateDescription). Solo para la ficha del turno: el motor lo saca antes de mandarle el resultado al modelo. */ consumo?: LlmUsage;` (importar `LlmUsage` de `../llm/llm-adapter.interface`).

En `motor-de-turno.ts`:

1. Exportar `ToolDelPaso` y `PasoDelTurno` (forma de arriba) y ampliar `ConsumoPorProveedor` y `sumarConsumo`:

```ts
export function sumarConsumo(consumo: ConsumoPorProveedor, u: LlmUsage): void {
  const previo = consumo.get(u.provider);
  consumo.set(u.provider, {
    model: u.model,
    promptTokens: (previo?.promptTokens ?? 0) + u.promptTokens,
    completionTokens: (previo?.completionTokens ?? 0) + u.completionTokens,
    cachedTokens: (previo?.cachedTokens ?? 0) + (u.cachedTokens ?? 0),
    thinkingTokens: (previo?.thinkingTokens ?? 0) + (u.thinkingTokens ?? 0),
  });
}
```

2. `ProgresoDelTurno` suma `pasos: PasoDelTurno[]; escriturasRechazadas: number; ttftMs?: number; consumoDeTools: ConsumoPorProveedor;` y `nuevoProgresoDelTurno()` los inicializa en `[]`, `0`, `undefined`, `new Map()`.

3. `TurnoACorrer` suma `reloj?: () => number;` y `inicio?: number;` (comentario: "para los tests; por defecto Date.now()").

4. En `correrTurno`, al principio: `const reloj = t.reloj ?? Date.now; const inicio = t.inicio ?? reloj();` y un emisor envuelto que marca el primer texto:

```ts
  const emisorOriginal = t.emisor;
  const emisor: EmisorDelTurno = {
    ...emisorOriginal,
    texto: (chunk) => {
      if (progreso.ttftMs === undefined && chunk) progreso.ttftMs = reloj() - inicio;
      emisorOriginal.texto(chunk);
    },
  };
```
(y usar `emisor` en vez de `t.emisor` en todo el cuerpo; quitar `emisor` del destructuring de `t`).

5. Al principio de cada vuelta (después de `progreso.llamadasAlModelo++`):

```ts
    const paso: PasoDelTurno = { n: progreso.llamadasAlModelo, provider: null, model: null, promptTokens: null, cachedTokens: null, completionTokens: null, thinkingTokens: null, ms: 0, tools: [] };
    progreso.pasos.push(paso);
    const arrancoLaVuelta = reloj();
```
y después del `for await` (antes de `vuelta.volcarEn(messages)`): `paso.ms = reloj() - arrancoLaVuelta;`.

6. En cada rama de tool, medir y anotar:
   - Al empezar a procesar la call: `const arrancoLaTool = reloj();`
   - Rechazo por validación y por "no disponible": `progreso.escriturasRechazadas++; paso.tools.push({ name: event.call.name, tipo: 'rechazada', ms: reloj() - arrancoLaTool, ok: false });`
   - Propuesta: `paso.tools.push({ name: event.call.name, tipo: 'propuesta', ms: reloj() - arrancoLaTool, ok: true });`
   - Lectura: reemplazar el bloque de `execute` por:

```ts
        const resultado = await t.registry.execute(event.call.name, event.call.arguments, t.toolCtx, t.stepName, { soloLectura: t.soloLectura });
        // El consumo de IA de la tool va a la ficha, nunca al modelo ni al front.
        const { consumo: consumoDeLaTool, ...paraAfuera } = resultado;
        if (consumoDeLaTool) sumarConsumo(progreso.consumoDeTools, consumoDeLaTool);
        paso.tools.push({ name: event.call.name, tipo: 'lectura', ms: reloj() - arrancoLaTool, ok: paraAfuera.success });
        emisor.lecturaFin({ id: stepId, call: event.call, resultado: paraAfuera });
        vuelta.responder(event.call, JSON.stringify(paraAfuera));
```

7. En la rama `usage`: además de `sumarConsumo`, llenar el paso:

```ts
        paso.provider = event.usage.provider;
        paso.model = event.usage.model;
        paso.promptTokens = (paso.promptTokens ?? 0) + event.usage.promptTokens;
        paso.completionTokens = (paso.completionTokens ?? 0) + event.usage.completionTokens;
        paso.cachedTokens = (paso.cachedTokens ?? 0) + (event.usage.cachedTokens ?? 0);
        paso.thinkingTokens = (paso.thinkingTokens ?? 0) + (event.usage.thinkingTokens ?? 0);
```

- [ ] **Step 4: Correr toda la carpeta y las evals unitarias** (no llaman a Gemini: usan el guion)

Run: `cd apps/api && GEMINI_API_KEY= GROQ_API_KEY= pnpm exec jest --config ./test/jest-src.json src/orbi && GEMINI_API_KEY= GROQ_API_KEY= pnpm exec jest --config ./test/jest-unit.json orbi`
Expected: PASS. `test/evals/panel/motor.ts` usa `progreso.consumo`: si tipea el valor del Map, agregarle `cachedTokens` y `thinkingTokens`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orbi apps/api/test
git commit -m "feat(orbi): el motor anota cada vuelta, sus tools, el primer texto y la IA de las tools"
```

---

## Task 3: Esquema — ficha ampliada, cupos y accesos (una migración)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`OrbiTurn`, `OrbiPendingAction`, `Business` relaciones, 3 modelos nuevos)
- Create: `apps/api/prisma/migrations/20261003120000_orbi_medicion_y_cupos/migration.sql`

**Interfaces:**
- Produces: modelos Prisma `OrbiCupoAjuste`, `OrbiCupoMiembro`, `OrbiConversationAccess`; campos nuevos de `OrbiTurn` (spec §5.1) y `OrbiPendingAction.turnId`.

- [ ] **Step 1: Editar `schema.prisma`**

En `model OrbiTurn`, después de `status`:

```prisma
  // Ficha ampliada (spec 2026-10-03-orbi-medicion-y-cupos §5.1). Todo admite
  // null: los turnos anteriores no lo tienen.
  provider         String? // gemini | groq | mixto
  cachedTokens     Int?     @map("cached_tokens") // ya incluidos en prompt_tokens
  thinkingTokens   Int?     @map("thinking_tokens") // ya incluidos en completion_tokens
  ttftMs           Int?     @map("ttft_ms")
  costUsd          Decimal? @map("cost_usd") @db.Decimal(12, 6)
  toolsCostUsd     Decimal? @map("tools_cost_usd") @db.Decimal(12, 6)
  credits          Int?
  errorCategory    String?  @map("error_category")
  section          String?
  contextChars     Json?    @map("context_chars")
  steps            Json?
  writesRejected   Int      @default(0) @map("writes_rejected")
  actionsConfirmed Int      @default(0) @map("actions_confirmed")
  actionsRejected  Int      @default(0) @map("actions_rejected")
```

y el comentario de `status` pasa a `// ok | error | cancelled | max_rounds | quota`.

En `model OrbiPendingAction`, después de `conversationId`: `turnId String? @map("turn_id") // orbi_turns.id, sin FK (la acción se purga a los 30 días)`.

Al final del bloque de Orbi, los tres modelos de la spec §5.3, con `business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)` en `OrbiCupoAjuste` y `OrbiCupoMiembro` (y sus listas `orbiCupoAjustes OrbiCupoAjuste[]` / `orbiCupoMiembros OrbiCupoMiembro[]` en `model Business`). `OrbiConversationAccess` sin relación (el registro de accesos sobrevive a la conversación, como `platform_admin_logs`).

- [ ] **Step 2: Escribir la migración a mano**

```sql
-- Orbi: ficha ampliada de cada turno, cupo mensual en créditos y registro de
-- lecturas de conversaciones (spec 2026-10-03-orbi-medicion-y-cupos). Todo
-- aditivo: columnas que admiten null o con default, y tablas nuevas.

ALTER TABLE "orbi_turns"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "cached_tokens" INTEGER,
  ADD COLUMN "thinking_tokens" INTEGER,
  ADD COLUMN "ttft_ms" INTEGER,
  ADD COLUMN "cost_usd" DECIMAL(12,6),
  ADD COLUMN "tools_cost_usd" DECIMAL(12,6),
  ADD COLUMN "credits" INTEGER,
  ADD COLUMN "error_category" TEXT,
  ADD COLUMN "section" TEXT,
  ADD COLUMN "context_chars" JSONB,
  ADD COLUMN "steps" JSONB,
  ADD COLUMN "writes_rejected" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "actions_confirmed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "actions_rejected" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "orbi_pending_actions" ADD COLUMN "turn_id" TEXT;

CREATE TABLE "orbi_cupo_ajustes" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "creditos" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orbi_cupo_ajustes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "orbi_cupo_ajustes_business_id_mes_idx" ON "orbi_cupo_ajustes"("business_id", "mes");
ALTER TABLE "orbi_cupo_ajustes" ADD CONSTRAINT "orbi_cupo_ajustes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "orbi_cupo_miembros" (
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "tope_porcentaje" INTEGER NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orbi_cupo_miembros_pkey" PRIMARY KEY ("business_id", "member_id")
);
ALTER TABLE "orbi_cupo_miembros" ADD CONSTRAINT "orbi_cupo_miembros_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "orbi_conversation_access" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "ticket" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orbi_conversation_access_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "orbi_conversation_access_conversation_id_idx" ON "orbi_conversation_access"("conversation_id");
CREATE INDEX "orbi_conversation_access_admin_id_created_at_idx" ON "orbi_conversation_access"("admin_id", "created_at");

-- RLS: el repo lo exige en toda tabla de public (test/unit/rls-supabase.unit-spec.ts).
-- Sin policies: la API accede con el rol dueño de la base, que ignora RLS.
ALTER TABLE "orbi_cupo_ajustes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orbi_cupo_miembros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orbi_conversation_access" ENABLE ROW LEVEL SECURITY;
```

Verificar antes el nombre real de la tabla de negocios (`@@map` de `model Business`) y reemplazar `"businesses"` si difiere.

- [ ] **Step 3: Validar, generar y aplicar en DEV**

```bash
cd apps/api && pnpm exec prisma validate && pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma
```
Expected: la última dice `No difference detected.` Si muestra diferencias, corregir el SQL o el schema hasta que no haya.

- [ ] **Step 4: Tests y typecheck**

Run: `cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= pnpm exec jest --config ./test/jest-unit.json rls`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(orbi): esquema de la ficha ampliada, cupos mensuales y registro de lecturas"
```

---

## Task 4: Guardar la ficha ampliada (sin costo todavía)

**Files:**
- Create: `apps/api/src/orbi/turno/ficha-del-turno.ts`, `apps/api/src/orbi/turno/ficha-del-turno.spec.ts`
- Modify: `apps/api/src/orbi/orbi-turn.service.ts`
- Modify: `apps/api/src/orbi/tools/pending-action.service.ts` (`crear` recibe `turnId`)
- Modify: `apps/api/src/orbi/orbi.controller.ts` (chat, confirm, reject)
- Modify: `apps/api/src/common/cuota/cuota.service.ts` (`devolver`)
- Test: `apps/api/test/unit/` — crear `orbi-ficha.unit-spec.ts` para `OrbiTurnService`

**Interfaces:**
- Consumes: `ProgresoDelTurno` (Task 2), columnas (Task 3).
- Produces:

```ts
// ficha-del-turno.ts
export function proveedorDelTurno(consumo: ConsumoPorProveedor): 'gemini' | 'groq' | 'mixto' | undefined;
export function totalesDelConsumo(consumo: ConsumoPorProveedor): { promptTokens: number; completionTokens: number; cachedTokens: number; thinkingTokens: number };
export interface CaracteresDelContexto { system: number; tools: number; history: number; message: number }
export function caracteresDelContexto(p: { system: string; tools: LlmToolDefinition[]; history: LlmMessage[]; message: string }): CaracteresDelContexto;
// OrbiTurnService
TurnoDeOrbi suma: id: string; provider?; cachedTokens?; thinkingTokens?; ttftMs?; costUsd?: number; toolsCostUsd?: number; credits?: number; errorCategory?: string; section?: string; contextChars?: CaracteresDelContexto; steps?: PasoDelTurno[]; writesRejected: number
EstadoDelTurno = 'ok' | 'error' | 'cancelled' | 'max_rounds' | 'quota'
contarDesenlace(turnId: string, desenlace: 'confirmada' | 'rechazada'): Promise<void>   // nunca lanza
// CuotaService
devolver(clave: string): Promise<void>
```

- [ ] **Step 1: Tests de las funciones puras** (`ficha-del-turno.spec.ts`)

```ts
import { caracteresDelContexto, proveedorDelTurno, totalesDelConsumo } from './ficha-del-turno';

const c = (p: number, o: number, ca = 0, th = 0) => ({ model: 'm', promptTokens: p, completionTokens: o, cachedTokens: ca, thinkingTokens: th });

describe('ficha del turno', () => {
  it('proveedor: uno, mixto o ninguno', () => {
    expect(proveedorDelTurno(new Map())).toBeUndefined();
    expect(proveedorDelTurno(new Map([['gemini', c(1, 1)]]))).toBe('gemini');
    expect(proveedorDelTurno(new Map([['gemini', c(1, 1)], ['groq', c(1, 1)]]))).toBe('mixto');
  });
  it('suma los totales de todos los proveedores', () => {
    expect(totalesDelConsumo(new Map([['gemini', c(10, 2, 4, 1)], ['groq', c(5, 1)]]))).toEqual({ promptTokens: 15, completionTokens: 3, cachedTokens: 4, thinkingTokens: 1 });
  });
  it('mide el contexto en caracteres', () => {
    const r = caracteresDelContexto({ system: 'abcd', tools: [{ name: 'x', description: 'y', parameters: {} }], history: [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'chau' }], message: 'ok' });
    expect(r).toEqual({ system: 4, tools: JSON.stringify([{ name: 'x', description: 'y', parameters: {} }]).length, history: 8, message: 2 });
  });
});
```

- [ ] **Step 2: Verlo fallar, implementar `ficha-del-turno.ts`**

```ts
import type { LlmMessage, LlmToolDefinition } from '../llm/llm-adapter.interface';
import type { ConsumoPorProveedor } from './motor-de-turno';

// Piezas puras de la ficha de un turno (spec 2026-10-03 §5.1). Viven aparte del
// controller para poder testearlas sin levantar Nest.

export function proveedorDelTurno(consumo: ConsumoPorProveedor): 'gemini' | 'groq' | 'mixto' | undefined {
  const usados = [...consumo.entries()].filter(([, c]) => c.promptTokens > 0 || c.completionTokens > 0).map(([p]) => p);
  if (usados.length === 0) return undefined;
  return usados.length > 1 ? 'mixto' : usados[0];
}

export function totalesDelConsumo(consumo: ConsumoPorProveedor) {
  const t = { promptTokens: 0, completionTokens: 0, cachedTokens: 0, thinkingTokens: 0 };
  for (const c of consumo.values()) {
    t.promptTokens += c.promptTokens;
    t.completionTokens += c.completionTokens;
    t.cachedTokens += c.cachedTokens;
    t.thinkingTokens += c.thinkingTokens;
  }
  return t;
}

export interface CaracteresDelContexto { system: number; tools: number; history: number; message: number }

/** Tamaño de lo que se manda en la primera vuelta, por partes. En caracteres: contar tokens exactos pediría una llamada al proveedor. */
export function caracteresDelContexto(p: { system: string; tools: LlmToolDefinition[]; history: LlmMessage[]; message: string }): CaracteresDelContexto {
  return {
    system: p.system.length,
    tools: p.tools.length ? JSON.stringify(p.tools).length : 0,
    history: p.history.reduce((n, m) => n + (m.content?.length ?? 0), 0),
    message: p.message.length,
  };
}
```

Run: `cd apps/api && GEMINI_API_KEY= GROQ_API_KEY= pnpm exec jest --config ./test/jest-src.json src/orbi/turno/ficha` → PASS.

- [ ] **Step 3: `OrbiTurnService`** — importar `Prisma` de `@prisma/client`, ampliar `TurnoDeOrbi` y `registrar`:

```ts
      await this.prisma.orbiTurn.create({
        data: {
          id: t.id,
          // … los campos de hoy …
          provider: t.provider ?? null,
          cachedTokens: t.cachedTokens ?? null,
          thinkingTokens: t.thinkingTokens ?? null,
          ttftMs: t.ttftMs ?? null,
          costUsd: t.costUsd ?? null,
          toolsCostUsd: t.toolsCostUsd ?? null,
          credits: t.credits ?? null,
          errorCategory: t.errorCategory ?? null,
          section: t.section ?? null,
          contextChars: (t.contextChars ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          steps: (t.steps ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          writesRejected: t.writesRejected,
        },
      });
```

y el método nuevo:

```ts
  /** El dueño confirmó o canceló una acción que propuso este turno. Best-effort: nunca lanza. */
  async contarDesenlace(turnId: string, desenlace: 'confirmada' | 'rechazada'): Promise<void> {
    try {
      await this.prisma.orbiTurn.updateMany({
        where: { id: turnId },
        data: desenlace === 'confirmada' ? { actionsConfirmed: { increment: 1 } } : { actionsRejected: { increment: 1 } },
      });
    } catch (e) {
      this.logger.warn(`No se pudo contar el desenlace de una acción de Orbi: ${(e as Error)?.name ?? 'error'}`);
    }
  }
```

Test en `test/unit/orbi-ficha.unit-spec.ts` con un prisma falso (`{ orbiTurn: { create: jest.fn(), updateMany: jest.fn() } }`): `registrar` pasa `id`, `steps` y `writesRejected`; `contarDesenlace('t1','confirmada')` llama `updateMany({ where: { id: 't1' }, data: { actionsConfirmed: { increment: 1 } } })`; si `updateMany` rechaza, no lanza.

- [ ] **Step 4: `PendingActionService.crear`** recibe `turnId: string | null` y lo guarda (`turnId: a.turnId`). Actualizar los specs que la llaman (`grep -rn "pendingActions.crear\|\.crear({" apps/api/src/orbi apps/api/test`).

- [ ] **Step 5: `CuotaService.devolver`** + test en el spec existente de cuota (o en `test/unit/cuota.unit-spec.ts` si no hay):

```ts
  /** Devuelve un uso del día (un mensaje que no se pudo atender). Nunca baja de 0. Best-effort. */
  async devolver(clave: string): Promise<void> {
    const dia = fechaArgentina(new Date());
    try {
      await this.prisma.$executeRaw`
        UPDATE daily_quota SET count = count - 1 WHERE key = ${clave} AND day = ${dia} AND count > 0`;
    } catch {
      // Si falla, el peor caso es el de hoy: el mensaje fallido igual contó.
    }
  }
```

- [ ] **Step 6: Cablear el controller (`chat`)**

1. Al empezar el handler (antes del chequeo de mantenimiento): `const turnId = randomUUID();`.
2. Si la cuota diaria rechaza (bloque `if (!(await this.cuota.consumir(...)))`), antes del `throw` y solo si `user.readOnly !== true`: `void this.orbiTurns.registrar({ id: turnId, businessId: user.businessId, memberId: user.memberId, conversationId: null, latencyMs: 0, rounds: 0, toolsUsed: [], actionsProposed: 0, writesRejected: 0, status: 'quota' });`.
3. `toolCtx` suma `turnId`. `crearPendiente` pasa `turnId`.
4. Antes de `correrTurno`: `const contextChars = caracteresDelContexto({ system: messages[0].content, tools, history, message: dto.message });` (declarar `let contextChars: CaracteresDelContexto | undefined` afuera del `try`, como `conversacionVerificada`). Pasar `inicio: arrancoEn` a `correrTurno`.
5. En el `catch` de error (no cancelado): `errorCategory = clasificarError(error).categoria;` (import de `./salud/clasificar-error`; `let errorCategory: string | undefined` afuera del `try`).
6. En el `finally`, si `estado === 'error'` y no es demo: `void this.cuota.devolver(\`orbi-panel:${user.businessId}\`);`.
7. En `registrar` del `finally`, reemplazar la suma manual por `totalesDelConsumo(progreso.consumo)` y sumar:

```ts
          id: turnId,
          provider: proveedorDelTurno(progreso.consumo),
          cachedTokens: totales.cachedTokens || undefined,
          thinkingTokens: totales.thinkingTokens || undefined,
          ttftMs: progreso.ttftMs,
          errorCategory,
          section: dto.context.section,
          contextChars,
          steps: progreso.pasos,
          writesRejected: progreso.escriturasRechazadas,
```

- [ ] **Step 7: `confirm` y `reject`** — después de `ejecutarConfirmada` (confirm) y en el `case 'ok'` (reject): `if (accion.turnId) void this.orbiTurns.contarDesenlace(accion.turnId, 'confirmada' | 'rechazada');`.

- [ ] **Step 8: Tests del controller** — en `src/orbi/orbi.controller.spec.ts`, siguiendo los mocks que ya usa el archivo: (a) un chat que termina bien llama a `orbiTurns.registrar` con `id` igual al `turnId` que recibió `pendingActions.crear` y con `steps` del progreso; (b) un chat con error del adapter llama a `cuota.devolver('orbi-panel:<negocio>')` y registra `errorCategory`; (c) cuota diaria rechazada registra `status: 'quota'`; (d) `confirm` llama `contarDesenlace(turnId, 'confirmada')`.

Run: `cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "feat(orbi): cada turno guarda su ficha completa, el desenlace de sus acciones y devuelve el cupo si falla"
```

---

## Task 5: Medir las llamadas que se escapaban (tools del wizard y clasificador)

**Files:**
- Modify: `apps/api/src/orbi/tools/definitions/wizard.tools.ts` (`generarConGemini` recibe un medidor)
- Modify: el lugar donde se construyen las tools del wizard (`grep -rn "new SuggestBusinessNameTool\|new .*Wizard.*Tool(" apps/api/src/orbi`)
- Modify: `apps/api/src/wizard-analytics/wizard-analytics.service.ts` (`clasificarTurno`) y su módulo
- Create: `apps/api/src/platform/costs/medir-texto.ts`
- Test: `apps/api/src/platform/costs/medir-texto.spec.ts`

**Interfaces:**
- Produces: `medirConsumoDeTexto(metering: Pick<UsageMeteringService, 'track'>, r: { provider?: 'gemini'|'groq'; model?: string; promptTokens?: number; completionTokens?: number; cachedTokens?: number; thinkingTokens?: number }, ctx: { feature: string; businessId?: string; metadata?: Record<string, unknown> }): void`

- [ ] **Step 1: Test**

```ts
import { medirConsumoDeTexto } from './medir-texto';

describe('medirConsumoDeTexto', () => {
  it('registra entrada y salida con la función y el modelo', () => {
    const track = jest.fn();
    medirConsumoDeTexto({ track } as never, { provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 900, completionTokens: 120, cachedTokens: 0 }, { feature: 'orbi-wizard-tools' });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ providerSlug: 'gemini', category: 'prompt_tokens', quantity: 900, metadata: expect.objectContaining({ feature: 'orbi-wizard-tools', model: 'gemini-3.6-flash' }) }));
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ category: 'completion_tokens', quantity: 120 }));
  });
  it('sin consumo informado no inventa un 0', () => {
    const track = jest.fn();
    medirConsumoDeTexto({ track } as never, { provider: 'gemini' }, { feature: 'x' });
    expect(track).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implementar `medir-texto.ts`**

```ts
import type { UsageMeteringService } from './usage-metering.service';

/**
 * Registra en usage_events el consumo de una llamada de texto (no streaming).
 * Mismo formato que ProductAiService.registrarUso: dos eventos, entrada y salida.
 * Sin consumo informado no escribe nada (un 0 se promediaría como gratis).
 */
export function medirConsumoDeTexto(
  metering: Pick<UsageMeteringService, 'track'>,
  r: { provider?: 'gemini' | 'groq'; model?: string; promptTokens?: number; completionTokens?: number; cachedTokens?: number; thinkingTokens?: number },
  ctx: { feature: string; businessId?: string; metadata?: Record<string, unknown> },
): void {
  if (!r.provider || !r.promptTokens) return;
  const metadata = { feature: ctx.feature, model: r.model, cachedTokens: r.cachedTokens, thinkingTokens: r.thinkingTokens, ...ctx.metadata };
  const comun = { providerSlug: r.provider, businessId: ctx.businessId, unit: 'tokens', metadata };
  void metering.track({ ...comun, category: 'prompt_tokens', quantity: r.promptTokens });
  void metering.track({ ...comun, category: 'completion_tokens', quantity: r.completionTokens ?? 0 });
}
```

- [ ] **Step 3: Tools del wizard** — `generarConGemini(config, opts, medir?: (r: GenerarTextoResult) => void)` llama `medir?.(r)` antes de devolver `r.text`. Cada tool del wizard recibe en el constructor un `UsageMeteringService` opcional y pasa `(r) => medirConsumoDeTexto(this.metering, r, { feature: 'orbi-wizard-tools' })`. En el registro de tools, inyectar `UsageMeteringService` (ya está en `CostsModule`, exportado; verificar que `OrbiModule` lo importe — el controller ya lo usa).

- [ ] **Step 4: Clasificador nocturno** — en `clasificarTurno`, además de juntar el texto, capturar `if (evento.type === 'usage') consumo = evento.usage;` y al final `if (consumo) medirConsumoDeTexto(this.metering, consumo, { feature: 'wizard-classifier' })`. Inyectar `UsageMeteringService` en `WizardAnalyticsService` (importar `CostsModule` en su módulo si hace falta; si eso arma una dependencia circular, usar `@Optional()` y documentarlo). Actualizar su spec si construye el service a mano.

- [ ] **Step 5: Etiquetas en Costos** — en `apps/web/src/modules/superadmin/Costos.tsx`, `AI_FEATURE_LABELS` suma `'orbi-wizard-tools': 'Orbi (herramientas del alta)'` y `'wizard-classifier': 'Clasificador nocturno del alta'`.

- [ ] **Step 6: Correr y commitear**

Run: `cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test && cd ../web && pnpm exec tsc --noEmit`
Expected: PASS.

```bash
git add apps/api/src apps/web/src/modules/superadmin/Costos.tsx
git commit -m "feat(costos): se miden las tools del alta y el clasificador nocturno de Orbi"
```

---

## Task 6: Integrar los precios por modelo y calcular costo y créditos

**Prerrequisito:** la rama `fix/costos-precio-por-modelo` commiteada (y, si es posible, ya en `main`). Si no lo está: **frenar y avisar a Alan**.

**Files:**
- Merge: `git merge origin/main` (o `git merge fix/costos-precio-por-modelo`)
- Modify: `apps/api/src/platform/costs/precios.ts` (precio de entrada cacheada)
- Create: `apps/api/src/orbi/turno/costo-del-turno.ts`, `costo-del-turno.spec.ts`
- Modify: `apps/api/src/orbi/orbi.controller.ts` (`registrar` y `medirConsumo`)
- Test: `apps/api/test/unit/costs.precios.unit-spec.ts` (el que trae la rama)

**Interfaces:**
- Consumes: de `precios.ts` (rama de precios) `precioTokens(proveedor, modelo, fecha): PrecioTokens | null`.
- Produces:

```ts
// precios.ts: PrecioTokens pasa a { entrada: number; salida: number; cacheada: number }
export function costoDeConsumoUsd(c: { provider: string; model: string | null; promptTokens: number; cachedTokens?: number; completionTokens: number }, fecha: Date): number;
// costo-del-turno.ts
export const USD_POR_CREDITO = 0.001;
export function creditosDe(costUsd: number): number;   // Math.ceil(costUsd / USD_POR_CREDITO), 0 si costUsd <= 0
export function costoDelTurno(consumo: ConsumoPorProveedor, consumoDeTools: ConsumoPorProveedor, fecha: Date): { costUsd: number; toolsCostUsd: number; credits: number };
```

- [ ] **Step 1: Integrar** — `git fetch origin && git merge origin/main` (si la rama de precios ya está en main) o `git merge fix/costos-precio-por-modelo`. Resolver conflictos (esperables en `product-ai.service.ts`). Correr `pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= pnpm test`.

- [ ] **Step 2: Test del precio cacheado** — en `costs.precios.unit-spec.ts`:

```ts
it('la entrada cacheada se cobra al precio de caché', () => {
  const fecha = new Date('2026-10-03T12:00:00Z');
  // 10.000 de entrada, 4.096 cacheados, 100 de salida, gemini-3.6-flash 2026: 0,75 / 0,075 / 3,75
  const esperado = ((10000 - 4096) * 0.75 + 4096 * 0.075 + 100 * 3.75) / 1e6;
  expect(costoDeConsumoUsd({ provider: 'gemini', model: 'gemini-3.6-flash', promptTokens: 10000, cachedTokens: 4096, completionTokens: 100 }, fecha)).toBeCloseTo(esperado, 9);
});
it('desde 2027 la caché también se duplica', () => {
  expect(precioTokens('gemini', 'gemini-3.6-flash', new Date('2027-01-02'))).toMatchObject({ cacheada: 0.15 });
});
it('un proveedor sin precio de caché cobra la entrada completa', () => {
  expect(precioTokens('groq', 'openai/gpt-oss-120b', new Date())).toMatchObject({ cacheada: 0.15 });
});
```

- [ ] **Step 3: Implementar en `precios.ts`** — `PrecioTokens` y `Tramo` suman `cacheada?: number` en la tabla (`GEMINI_FLASH`: `0.075` y `0.15` desde 2027; `gemini-3.5-flash-lite`: `0.03`; `gemini-3.1-pro-preview`: `0.2`; Groq sin dato). `precioTokens` devuelve `{ entrada, salida, cacheada: vigente.cacheada ?? vigente.entrada }`. Y:

```ts
/** Costo en USD de un consumo de tokens con caché. promptTokens INCLUYE los cacheados. */
export function costoDeConsumoUsd(
  c: { provider: string; model: string | null; promptTokens: number; cachedTokens?: number; completionTokens: number },
  fecha: Date,
): number {
  const p = precioTokens(c.provider, c.model, fecha);
  if (!p) return 0;
  const cacheados = Math.min(c.cachedTokens ?? 0, c.promptTokens);
  return ((c.promptTokens - cacheados) * p.entrada + cacheados * p.cacheada + c.completionTokens * p.salida) / 1_000_000;
}
```

- [ ] **Step 4: `costo-del-turno.ts` + spec**

```ts
import { costoDeConsumoUsd, redondearUsd } from '../../platform/costs/precios';
import type { ConsumoPorProveedor } from './motor-de-turno';

/** 1 crédito = USD 0,001 a precio de lista (spec 2026-10-03, D2). */
export const USD_POR_CREDITO = 0.001;

export function creditosDe(costUsd: number): number {
  return costUsd > 0 ? Math.ceil(costUsd / USD_POR_CREDITO - 1e-9) : 0;
}

function sumar(consumo: ConsumoPorProveedor, fecha: Date): number {
  let usd = 0;
  for (const [provider, c] of consumo) usd += costoDeConsumoUsd({ provider, model: c.model, promptTokens: c.promptTokens, cachedTokens: c.cachedTokens, completionTokens: c.completionTokens }, fecha);
  return usd;
}

/** Costo total del mensaje (vueltas del modelo + IA que dispararon las tools) y su parte de tools. */
export function costoDelTurno(consumo: ConsumoPorProveedor, consumoDeTools: ConsumoPorProveedor, fecha: Date) {
  const toolsCostUsd = sumar(consumoDeTools, fecha);
  const costUsd = sumar(consumo, fecha) + toolsCostUsd;
  return { costUsd: redondearUsd(costUsd), toolsCostUsd: redondearUsd(toolsCostUsd), credits: creditosDe(costUsd) };
}
```

Tests: mensaje promedio de producción (9.844 / 136, sin caché, gemini-3.6-flash, 2026-10-03) → `costUsd` 0.007893, `credits` 8; consumo vacío → `{ 0, 0, 0 }`; con tools → `toolsCostUsd` > 0 y `costUsd` = suma.

- [ ] **Step 5: Controller** — en el `finally`, `const costo = costoDelTurno(progreso.consumo, progreso.consumoDeTools, new Date());` y pasar `costUsd`, `toolsCostUsd`, `credits` a `registrar`. En `medirConsumo`, mandar `estimatedCostUsd` en el evento de entrada calculado CON caché: `costoDeConsumoUsd({ provider: proveedor, model: c.model, promptTokens: c.promptTokens, cachedTokens: c.cachedTokens, completionTokens: 0 }, new Date())`, y `cachedTokens`/`thinkingTokens` en la `metadata`. Revisar cómo quedó `UsageMeteringService.track` en la rama de precios: si ya calcula el costo cuando no viene, el valor explícito tiene que tener prioridad (comprobarlo con su test).

- [ ] **Step 6: Correr y commitear**

Run: `cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test`

```bash
git add -A apps/api
git commit -m "feat(orbi): costo en USD y créditos de cada turno, con la caché a su precio"
```

---

## Task 7: La descripción con IA que pide Orbi queda atada al turno

**Files:**
- Modify: `apps/api/src/products/product-ai.service.ts` (`assist`, `pedirJson`, `registrarUso`)
- Modify: `apps/api/src/orbi/tools/definitions/product.tools.ts` (`GenerateDescriptionTool.execute`)
- Test: `apps/api/test/unit/product-ai.service.unit-spec.ts`, spec de la tool (o `tool-registry.spec.ts`)

**Interfaces:**
- Produces: `ProductAiService.assist(businessId: string, dto: AiAssistDto, origen?: OrigenDeIa): Promise<AiAssistResult>` con

```ts
export interface OrigenDeIa {
  memberId?: string;
  turnId?: string;
  /** Recibe el consumo real de la llamada (para sumarlo a la ficha del turno de Orbi). */
  alConsumir?: (u: LlmUsage) => void;
}
```

- [ ] **Step 1: Test** — en `product-ai.service.unit-spec.ts`, con `generarTexto` mockeado como en los tests existentes: `assist(..., { memberId: 'm1', turnId: 't1', alConsumir })` registra eventos cuya `metadata` incluye `memberId: 'm1'` y `turnId: 't1'`, y llama `alConsumir` con `{ provider: 'gemini', model, promptTokens, completionTokens }`.

- [ ] **Step 2: Implementar** — `assist` pasa `origen` a `pedirJson`, `pedirJson` a `registrarUso`; `registrarUso` suma `...(origen?.memberId ? { memberId: origen.memberId } : {}), ...(origen?.turnId ? { turnId: origen.turnId } : {})` a la metadata y, si hay consumo, `origen?.alConsumir?.({ provider: uso.provider, model: uso.model ?? '', promptTokens: uso.promptTokens, completionTokens: uso.completionTokens ?? 0, cachedTokens: uso.cachedTokens, thinkingTokens: uso.thinkingTokens })`.

- [ ] **Step 3: La tool**

```ts
      let consumo: LlmUsage | undefined;
      const result = await this.productAiService.assist(
        ctx.businessId,
        { name: args.productName as string, existingDescription: args.existingDescription as string | undefined },
        { memberId: ctx.userId, turnId: ctx.turnId, alConsumir: (u) => { consumo = u; } },
      );
      return { success: true, label: `Descripción generada para "${args.productName}"`, data: { /* igual que hoy */ }, consumo };
```

- [ ] **Step 4: Correr y commitear**

Run: `cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test`

```bash
git add apps/api
git commit -m "feat(orbi): la descripción con IA de una carga de producto se atribuye al turno y al miembro"
```

---

## Task 8: Retención y baja del negocio

**Files:**
- Modify: `apps/api/src/internal-cron/retencion-logs.service.ts`
- Modify: `apps/api/src/subscriptions/subscriptions.service.ts` (purga de la baja definitiva, ~línea 2240)
- Modify: `apps/api/DEPLOYMENT.md` (§ Retención de logs y registros: las tres variables nuevas)
- Test: el spec de retención existente (`grep -rln "RetencionLogsService" apps/api/test apps/api/src`)

**Interfaces:**
- Produces: `TablaConRetencion` suma `'usage_events' | 'orbi_conversation_access' | 'orbi_sesiones_inactivas'`; `Regla.porDefecto: number | null` (`null` = apagada si la variable está vacía).

- [ ] **Step 1: Tests** — (a) `usage_events` se purga a los 400 días por defecto (`deleteMany({ where: { timestamp: { lt: corte } } })`); (b) `orbi_conversation_access` a los 365; (c) `orbi_sesiones_inactivas` queda `'apagada'` sin variable y con `ORBI_SESIONES_INACTIVAS_RETENTION_DAYS=365` borra `orbiConversation.deleteMany({ where: { archivedAt: null, lastActivityAt: { lt: corte } } })`.

- [ ] **Step 2: Implementar** — `diasDeRetencion(variable, porDefecto: number | null)`: con la variable vacía devuelve `porDefecto` (que puede ser `null`). Las tres reglas nuevas:

```ts
      {
        tabla: 'usage_events',
        variable: 'USAGE_EVENTS_RETENTION_DAYS',
        porDefecto: 400,
        borrar: (corte) => this.prisma.usageEvent.deleteMany({ where: { timestamp: { lt: corte } } }),
      },
      {
        tabla: 'orbi_conversation_access',
        variable: 'ORBI_CONVERSATION_ACCESS_RETENTION_DAYS',
        porDefecto: 365,
        borrar: (corte) => this.prisma.orbiConversationAccess.deleteMany({ where: { createdAt: { lt: corte } } }),
      },
      {
        // Sesiones NO archivadas sin actividad (incluye las de miembros borrados,
        // que nadie puede abrir). Apagada hasta que Alan fije un plazo (spec D11).
        tabla: 'orbi_sesiones_inactivas',
        variable: 'ORBI_SESIONES_INACTIVAS_RETENTION_DAYS',
        porDefecto: null,
        borrar: (corte) => this.prisma.orbiConversation.deleteMany({ where: { archivedAt: null, lastActivityAt: { lt: corte } } }),
      },
```

- [ ] **Step 3: Baja definitiva** — en la lista de borrados de la transacción, sumar `p.orbiCupoAjuste.deleteMany(delNegocio)`, `p.orbiCupoMiembro.deleteMany(delNegocio)`, `p.orbiConversationAccess.deleteMany(delNegocio)` y, para conservar el costo sin datos de personas:

```ts
      // usage_events se conserva (es el gasto de la plataforma), pero sin a quién
      // ni de qué conversación (spec 2026-10-03, D12).
      p.$executeRaw`UPDATE usage_events SET metadata = metadata - 'memberId' - 'conversationId' - 'turnId' WHERE business_id = ${businessId} AND metadata IS NOT NULL`,
```
Ajustar el test de la purga si enumera las operaciones.

- [ ] **Step 4: DEPLOYMENT.md** — en la tabla de retención, agregar las tres variables con su default y una línea sobre el flag apagado.

- [ ] **Step 5: Correr y commitear**

```bash
cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test
git add apps/api
git commit -m "feat(orbi): retención de usage_events y de lecturas, y limpieza de datos de personas en la baja"
```

---

## Task 9: Servicio del cupo mensual

**Files:**
- Modify: `apps/api/src/common/utils/hora-argentina.ts` (+ spec si existe)
- Create: `apps/api/src/orbi/cupo/cupo-orbi.service.ts`, `cupo-orbi.module.ts`, `cupo-orbi.service.spec.ts`

**Interfaces:**
- Produces:

```ts
// hora-argentina.ts
export function mesArgentina(instante: Date): string;                       // 'YYYY-MM'
export function rangoDeMesArgentina(mes: string): { desde: Date; hasta: Date }; // [desde, hasta)
export function esMes(valor: unknown): valor is string;                     // /^\d{4}-(0[1-9]|1[0-2])$/

// cupo-orbi.service.ts
export interface CupoDelNegocio { mes: string; base: number; ajustes: number; total: number; avanzado: boolean }
export interface EstadoDelCupo {
  mes: string;
  bloquea: boolean;                       // ORBI_CUPO_BLOQUEA === 'true'
  negocio: { usados: number; total: number; porcentaje: number };
  propio: { usados: number; disponible: number; porcentaje: number; topePorcentaje: number | null };
}
export class CupoOrbiService {
  cupoDelNegocio(businessId: string, mes: string): Promise<CupoDelNegocio>;
  usados(businessId: string, mes: string): Promise<{ negocio: number; porMiembro: Map<string, number> }>;
  estado(businessId: string, memberId: string, ahora?: Date): Promise<EstadoDelCupo>;
  /** null = puede; si no, qué cupo se agotó. Siempre null con el bloqueo apagado. */
  motivoDeBloqueo(businessId: string, memberId: string, ahora?: Date): Promise<'negocio' | 'miembro' | null>;
  topes(businessId: string): Promise<Map<string, number>>;
  fijarTope(businessId: string, memberId: string, topePorcentaje: number | null, porMemberId: string): Promise<void>;
  ajustar(a: { businessId: string; mes: string; creditos: number; motivo: string; adminId: string }): Promise<{ id: string }>;
  ajustesDelMes(businessId: string, mes: string): Promise<{ id: string; creditos: number; motivo: string; adminId: string; createdAt: Date }[]>;
}
// porcentajeDe(usados, total) = total > 0 ? Math.floor(usados * 100 / total) : (usados > 0 ? 100 : 0)
```

- [ ] **Step 1: Helpers de fecha + tests**

```ts
/** 'YYYY-MM' del mes de Argentina en que cae un instante. */
export function mesArgentina(instante: Date): string {
  return fechaArgentina(instante).slice(0, 7);
}

/** Inicio (incluido) y fin (excluido) de un mes 'YYYY-MM' de Argentina. */
export function rangoDeMesArgentina(mes: string): { desde: Date; hasta: Date } {
  const desde = inicioDeDiaArgentina(`${mes}-01`);
  return { desde, hasta: inicioDeMesArgentina(desde, 1) };
}

export function esMes(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}
```

Tests: `mesArgentina(new Date('2026-11-01T02:00:00Z'))` → `'2026-10'` (son las 23 h del 31/10 en Argentina); `rangoDeMesArgentina('2026-12')` → desde `2026-12-01T03:00:00.000Z`, hasta `2027-01-01T03:00:00.000Z`.

- [ ] **Step 2: Tests del service** (`cupo-orbi.service.spec.ts`, prisma falso + `ConfigService` falso)

```ts
const prisma = {
  businessAddon: { findFirst: jest.fn() },
  orbiCupoAjuste: { aggregate: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  orbiCupoMiembro: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  orbiTurn: { groupBy: jest.fn() },
};
```
Casos: (1) sin Avanzado y sin ajustes → total 1500; con Avanzado activo → 2000; con `ORBI_CREDITOS_MES_BASE=900` → 900; ajustes +500 y -200 → total base+300. (2) `estado`: negocio usó 750 de 1500 → 50%; miembro con tope 20% y 240 usados → disponible 300, porcentaje 80. (3) `motivoDeBloqueo` con `ORBI_CUPO_BLOQUEA` vacío → `null` aunque esté al 150%; con `'true'` y negocio al 100% → `'negocio'`; miembro al 100% de su tope → `'miembro'`. (4) `fijarTope` valida 10..100 (fuera de rango → `BadRequestException`), `null` borra la fila. (5) `ajustar` valida `creditos` entero distinto de 0 entre -100000 y 100000, motivo de 5 a 300 caracteres y `esMes(mes)`.

- [ ] **Step 3: Implementar**

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { esMes, mesArgentina, rangoDeMesArgentina } from '../../common/utils/hora-argentina';

const CREDITOS_BASE = 1500;
const CREDITOS_AVANZADO = 2000;

export function porcentajeDe(usados: number, total: number): number {
  if (total <= 0) return usados > 0 ? 100 : 0;
  return Math.floor((usados * 100) / total);
}

/**
 * Cupo mensual de Orbi en créditos (spec 2026-10-03 §3, D2-D7). El cupo es el
 * del plan más los ajustes del mes; lo usado es la suma de `orbi_turns.credits`
 * del mes. No se guarda un saldo: se calcula, así un ajuste o un cambio de plan
 * se ve en el acto y no hay dos números que puedan desincronizarse.
 */
@Injectable()
export class CupoOrbiService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private creditos(variable: string, porDefecto: number): number {
    const n = Number(this.config.get<string>(variable));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : porDefecto;
  }

  get bloquea(): boolean {
    return this.config.get<string>('ORBI_CUPO_BLOQUEA') === 'true';
  }

  async cupoDelNegocio(businessId: string, mes: string) {
    const ahora = new Date();
    const [addon, ajustes] = await Promise.all([
      this.prisma.businessAddon.findFirst({
        where: { businessId, type: 'ADVANCED', isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: ahora } }] },
        select: { id: true },
      }),
      this.prisma.orbiCupoAjuste.aggregate({ where: { businessId, mes }, _sum: { creditos: true } }),
    ]);
    const avanzado = !!addon;
    const base = avanzado ? this.creditos('ORBI_CREDITOS_MES_AVANZADO', CREDITOS_AVANZADO) : this.creditos('ORBI_CREDITOS_MES_BASE', CREDITOS_BASE);
    const extra = ajustes._sum.creditos ?? 0;
    return { mes, base, ajustes: extra, total: Math.max(0, base + extra), avanzado };
  }

  async usados(businessId: string, mes: string) {
    const { desde, hasta } = rangoDeMesArgentina(mes);
    const filas = await this.prisma.orbiTurn.groupBy({
      by: ['memberId'],
      where: { businessId, createdAt: { gte: desde, lt: hasta } },
      _sum: { credits: true },
    });
    const porMiembro = new Map<string, number>();
    let negocio = 0;
    for (const f of filas) {
      const c = f._sum.credits ?? 0;
      porMiembro.set(f.memberId, c);
      negocio += c;
    }
    return { negocio, porMiembro };
  }

  async topes(businessId: string): Promise<Map<string, number>> {
    const filas = await this.prisma.orbiCupoMiembro.findMany({ where: { businessId }, select: { memberId: true, topePorcentaje: true } });
    return new Map(filas.map((f) => [f.memberId, f.topePorcentaje]));
  }

  async estado(businessId: string, memberId: string, ahora = new Date()) {
    const mes = mesArgentina(ahora);
    const [cupo, uso, tope] = await Promise.all([
      this.cupoDelNegocio(businessId, mes),
      this.usados(businessId, mes),
      this.prisma.orbiCupoMiembro.findUnique({ where: { businessId_memberId: { businessId, memberId } }, select: { topePorcentaje: true } }),
    ]);
    const propios = uso.porMiembro.get(memberId) ?? 0;
    const topePorcentaje = tope?.topePorcentaje ?? null;
    const disponible = topePorcentaje === null ? cupo.total : Math.floor((cupo.total * topePorcentaje) / 100);
    return {
      mes,
      bloquea: this.bloquea,
      negocio: { usados: uso.negocio, total: cupo.total, porcentaje: porcentajeDe(uso.negocio, cupo.total) },
      propio: { usados: propios, disponible, porcentaje: porcentajeDe(propios, disponible), topePorcentaje },
    };
  }

  async motivoDeBloqueo(businessId: string, memberId: string, ahora = new Date()): Promise<'negocio' | 'miembro' | null> {
    if (!this.bloquea) return null;
    const e = await this.estado(businessId, memberId, ahora);
    if (e.negocio.usados >= e.negocio.total) return 'negocio';
    if (e.propio.topePorcentaje !== null && e.propio.usados >= e.propio.disponible) return 'miembro';
    return null;
  }

  async fijarTope(businessId: string, memberId: string, topePorcentaje: number | null, porMemberId: string): Promise<void> {
    if (topePorcentaje === null) {
      await this.prisma.orbiCupoMiembro.deleteMany({ where: { businessId, memberId } });
      return;
    }
    if (!Number.isInteger(topePorcentaje) || topePorcentaje < 10 || topePorcentaje > 100) {
      throw new BadRequestException('El tope tiene que ser un porcentaje entero entre 10 y 100.');
    }
    await this.prisma.orbiCupoMiembro.upsert({
      where: { businessId_memberId: { businessId, memberId } },
      create: { businessId, memberId, topePorcentaje, updatedBy: porMemberId },
      update: { topePorcentaje, updatedBy: porMemberId },
    });
  }

  async ajustar(a: { businessId: string; mes: string; creditos: number; motivo: string; adminId: string }) {
    if (!esMes(a.mes)) throw new BadRequestException('El mes tiene que tener la forma AAAA-MM.');
    if (!Number.isInteger(a.creditos) || a.creditos === 0 || Math.abs(a.creditos) > 100_000) {
      throw new BadRequestException('Los créditos tienen que ser un entero distinto de 0, de hasta 100.000.');
    }
    const motivo = a.motivo.trim();
    if (motivo.length < 5 || motivo.length > 300) throw new BadRequestException('El motivo tiene que tener entre 5 y 300 caracteres.');
    const fila = await this.prisma.orbiCupoAjuste.create({ data: { businessId: a.businessId, mes: a.mes, creditos: a.creditos, motivo, adminId: a.adminId }, select: { id: true } });
    return fila;
  }

  ajustesDelMes(businessId: string, mes: string) {
    return this.prisma.orbiCupoAjuste.findMany({ where: { businessId, mes }, orderBy: { createdAt: 'desc' }, select: { id: true, creditos: true, motivo: true, adminId: true, createdAt: true } });
  }
}
```

`cupo-orbi.module.ts`: `@Module({ providers: [CupoOrbiService], exports: [CupoOrbiService] })` (PrismaModule es global; ConfigModule también — verificar en `app.module.ts`).

- [ ] **Step 4: Correr y commitear**

```bash
cd apps/api && GEMINI_API_KEY= GROQ_API_KEY= pnpm exec jest --config ./test/jest-src.json src/orbi/cupo src/common && pnpm typecheck
git add apps/api/src
git commit -m "feat(orbi): cupo mensual en créditos por plan, con topes por miembro y ajustes"
```

---

## Task 10: Endpoints del cupo en el panel y bloqueo opcional en el chat

**Files:**
- Create: `apps/api/src/orbi/cupo/orbi-uso.controller.ts`, `apps/api/src/orbi/cupo/dto/tope-miembro.dto.ts`, `orbi-uso.controller.spec.ts`
- Modify: `apps/api/src/orbi/orbi.module.ts` (importar `CupoOrbiModule`, registrar el controller, `AuditModule` si hace falta)
- Modify: `apps/api/src/orbi/orbi.controller.ts` (chequeo de cupo)

**Interfaces:**
- Consumes: `CupoOrbiService` (Task 9), `AuditService.registrar` (`apps/api/src/audit/audit.service.ts:60`).
- Produces: `GET /orbi/uso`, `GET /orbi/uso/equipo`, `PUT /orbi/uso/equipo/:memberId` con las respuestas de la spec §6. Mensajes:

```ts
export const MENSAJE_CUPO_NEGOCIO = 'Este mes ya se usó todo el cupo de Orbi del negocio. Se renueva el 1° del mes que viene.';
export const MENSAJE_CUPO_MIEMBRO = 'Ya usaste tu parte del cupo de Orbi de este mes. Pedile al dueño del negocio que la amplíe.';
```

- [ ] **Step 1: Tests del controller** (instanciado a mano con mocks): `GET /orbi/uso` de un miembro devuelve `{ mes, bloquea, negocio: { porcentaje }, propio: { porcentaje, topePorcentaje } }` **sin** `usados`, `total` ni `disponible`; `GET /orbi/uso/equipo` devuelve un ítem por miembro activo del negocio con su `porcentaje` sobre el cupo del negocio (o sobre su tope si tiene) y las acciones `executed`/`failed` de `orbi_pending_actions` (máximo 50, más nuevas primero) con el nombre del miembro; `PUT` llama `fijarTope` y `auditService.registrar({ businessId, memberId: <dueño>, entityType: 'orbi_cupo_miembro', entityId: <memberId>, action: 'UPDATE', changes: [{ field: 'topePorcentaje', before, after }] })`; un `memberId` de otro negocio → 404.

- [ ] **Step 2: Implementar el controller**

```ts
@Controller('orbi/uso')
export class OrbiUsoController {
  constructor(private readonly cupo: CupoOrbiService, private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  async propio(@CurrentUser() user: AuthContext) {
    if (user.type !== 'member') throw new ForbiddenException('Solo para miembros del negocio');
    const e = await this.cupo.estado(user.businessId, user.memberId);
    // Al panel solo viajan porcentajes (spec D9): ni créditos, ni tokens, ni USD.
    return { mes: e.mes, bloquea: e.bloquea, negocio: { porcentaje: e.negocio.porcentaje }, propio: { porcentaje: e.propio.porcentaje, topePorcentaje: e.propio.topePorcentaje } };
  }

  @Get('equipo')
  @Roles('owner', 'admin')
  async equipo(@CurrentUser() user: AuthContext) {
    if (user.type !== 'member') throw new ForbiddenException('Solo para miembros del negocio');
    const mes = mesArgentina(new Date());
    const [cupo, uso, topes, miembros, acciones] = await Promise.all([
      this.cupo.cupoDelNegocio(user.businessId, mes),
      this.cupo.usados(user.businessId, mes),
      this.cupo.topes(user.businessId),
      this.prisma.member.findMany({ where: { businessId: user.businessId, readOnly: false }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.orbiPendingAction.findMany({
        where: { businessId: user.businessId, status: { in: ['executed', 'failed'] } },
        orderBy: { resolvedAt: 'desc' }, take: 50,
        select: { resolvedAt: true, memberId: true, tool: true, summary: true, status: true },
      }),
    ]);
    const nombre = new Map(miembros.map((m) => [m.id, m.name]));
    return {
      mes,
      negocio: { porcentaje: porcentajeDe(uso.negocio, cupo.total) },
      miembros: miembros.map((m) => {
        const tope = topes.get(m.id) ?? null;
        const disponible = tope === null ? cupo.total : Math.floor((cupo.total * tope) / 100);
        return { memberId: m.id, nombre: m.name, porcentaje: porcentajeDe(uso.porMiembro.get(m.id) ?? 0, disponible), topePorcentaje: tope };
      }),
      acciones: acciones.map((a) => ({ fecha: a.resolvedAt, miembro: nombre.get(a.memberId) ?? 'Ex miembro', tool: a.tool, resumen: a.summary, estado: a.status })),
    };
  }

  @Put('equipo/:memberId')
  @Roles('owner')
  async fijarTope(@CurrentUser() user: AuthContext, @Param('memberId') memberId: string, @Body() dto: TopeMiembroDto) {
    if (user.type !== 'member') throw new ForbiddenException('Solo para miembros del negocio');
    const miembro = await this.prisma.member.findFirst({ where: { id: memberId, businessId: user.businessId }, select: { id: true } });
    if (!miembro) throw new NotFoundException('Ese miembro no es de este negocio');
    const antes = (await this.cupo.topes(user.businessId)).get(memberId) ?? null;
    await this.cupo.fijarTope(user.businessId, memberId, dto.topePorcentaje, user.memberId);
    await this.audit.registrar({
      businessId: user.businessId, memberId: user.memberId, entityType: 'orbi_cupo_miembro', entityId: memberId, action: 'UPDATE',
      changes: [{ field: 'topePorcentaje', before: antes, after: dto.topePorcentaje }],
    });
    return { ok: true };
  }
}
```

(`porcentajeDe` se importa de `cupo-orbi.service.ts`. Verificar el nombre real del campo `readOnly` en `Member` y el tipo `CambioAuditoria` antes de compilar.) DTO:

```ts
export class TopeMiembroDto {
  @ValidateIf((_, v) => v !== null) @IsInt() @Min(10) @Max(100)
  topePorcentaje!: number | null;
}
```

- [ ] **Step 3: Chequeo en el chat** — en `orbi.controller.ts`, después de `exigirDisponible('panel')` y antes de la cuota diaria, solo si `user.readOnly !== true`:

```ts
    const agotado = await this.cupoOrbi.motivoDeBloqueo(user.businessId, user.memberId);
    if (agotado) {
      void this.orbiTurns.registrar({ id: turnId, businessId: user.businessId, memberId: user.memberId, conversationId: null, latencyMs: 0, rounds: 0, toolsUsed: [], actionsProposed: 0, writesRejected: 0, status: 'quota' });
      throw new HttpException(agotado === 'negocio' ? MENSAJE_CUPO_NEGOCIO : MENSAJE_CUPO_MIEMBRO, HttpStatus.TOO_MANY_REQUESTS);
    }
```
Tests: con el bloqueo apagado no se llama a `motivoDeBloqueo` con efecto (devuelve null) y el chat sigue; con `'negocio'` responde 429 con `MENSAJE_CUPO_NEGOCIO` y no llama al adapter.

- [ ] **Step 4: Correr y commitear**

```bash
cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test
git add apps/api/src
git commit -m "feat(orbi): el panel consulta el % de cupo, el dueño fija topes por miembro y el chat puede frenar al 100%"
```

---

## Task 11: Endpoints del superadmin — uso y ajustes

**Files:**
- Create: `apps/api/src/platform/orbi-uso/orbi-uso.service.ts`, `orbi-uso.controller.ts`, `dto/ajuste-cupo.dto.ts`, `orbi-uso.service.spec.ts`
- Modify: `apps/api/src/platform/platform.module.ts` (importar `CupoOrbiModule`, registrar controller y service)
- Modify: `apps/api/src/platform/platform-admin-log.service.ts` (acciones `orbi_cupo_ajuste` y `orbi_conversacion_abierta`)
- Modify: `apps/web/src/modules/superadmin/ui.tsx` (`ACTION_LABELS` de las dos acciones)

**Interfaces:**
- Consumes: `CupoOrbiService`, `rangoDeMesArgentina`, `esMes`, `mesArgentina`.
- Produces (`orbi-uso.service.ts`):

```ts
export interface ResumenDeUso {
  mes: string;
  lecturaHabilitada: boolean; // ORBI_LECTURA_CONVERSACIONES === 'on'
  kpis: { mensajes: number; costoUsd: number; creditos: number; promptTokens: number; cachedTokens: number; completionTokens: number; thinkingTokens: number;
          latenciaP50: number | null; latenciaP95: number | null; ttftP50: number | null; errores: number; frenadosPorCupo: number; conGroq: number;
          accionesPropuestas: number; accionesConfirmadas: number; accionesRechazadas: number; escriturasRechazadas: number };
  serie: { dia: string; mensajes: number; costoUsd: number }[];
  acciones: { tools: string; mensajes: number; costoPromedioUsd: number; costoTotalUsd: number; entradaPromedio: number; latenciaPromedio: number }[];
  negocios: { businessId: string; nombre: string; mensajes: number; costoUsd: number; creditos: number; cupo: number; porcentaje: number }[];
}
export interface DetalleDeNegocio {
  mes: string; businessId: string; nombre: string;
  cupo: CupoDelNegocio; usados: number; porcentaje: number;
  ajustes: { id: string; creditos: number; motivo: string; admin: string; fecha: string }[];
  miembros: { memberId: string; nombre: string; mensajes: number; costoUsd: number; creditos: number; promptTokens: number; completionTokens: number; latenciaP50: number | null; topePorcentaje: number | null }[];
}
export interface FichaDeTurno {
  id: string; fecha: string; memberId: string; miembro: string; conversationId: string | null; section: string | null; module: string | null;
  model: string | null; provider: string | null; status: string; errorCategory: string | null;
  promptTokens: number | null; cachedTokens: number | null; completionTokens: number | null; thinkingTokens: number | null;
  latencyMs: number; ttftMs: number | null; rounds: number; toolsUsed: string[]; actionsProposed: number; actionsConfirmed: number; actionsRejected: number; writesRejected: number;
  costUsd: number | null; toolsCostUsd: number | null; credits: number | null; contextChars: unknown; steps: unknown;
}
class OrbiUsoService {
  resumen(mes: string): Promise<ResumenDeUso>;
  negocio(businessId: string, mes: string): Promise<DetalleDeNegocio>;
  turnos(f: { businessId: string; memberId?: string; mes: string; antesDe?: string }): Promise<{ turnos: FichaDeTurno[]; siguiente: string | null }>;
}
```

- [ ] **Step 1: Tests del service** con prisma falso: `resumen` arma KPIs a partir de `$queryRaw` (mockear el resultado de cada consulta en orden) y ordena `acciones` por `costoTotalUsd` desc; `turnos` pide `take: 51` y devuelve `siguiente` = `createdAt` ISO del 50° cuando hay 51 filas; mes inválido → `BadRequestException`.

- [ ] **Step 2: Implementar con SQL agregado** (`$queryRaw`, un rango por mes). Consultas:

```sql
-- KPIs
SELECT count(*)::int AS mensajes,
       coalesce(sum(cost_usd),0)::float AS "costoUsd", coalesce(sum(credits),0)::int AS creditos,
       coalesce(sum(prompt_tokens),0)::int AS "promptTokens", coalesce(sum(cached_tokens),0)::int AS "cachedTokens",
       coalesce(sum(completion_tokens),0)::int AS "completionTokens", coalesce(sum(thinking_tokens),0)::int AS "thinkingTokens",
       percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE status <> 'quota') AS "latenciaP50",
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE status <> 'quota') AS "latenciaP95",
       percentile_cont(0.5) WITHIN GROUP (ORDER BY ttft_ms) AS "ttftP50",
       count(*) FILTER (WHERE status = 'error')::int AS errores, count(*) FILTER (WHERE status = 'quota')::int AS "frenadosPorCupo",
       count(*) FILTER (WHERE provider IN ('groq','mixto'))::int AS "conGroq",
       coalesce(sum(actions_proposed),0)::int AS "accionesPropuestas", coalesce(sum(actions_confirmed),0)::int AS "accionesConfirmadas",
       coalesce(sum(actions_rejected),0)::int AS "accionesRechazadas", coalesce(sum(writes_rejected),0)::int AS "escriturasRechazadas"
FROM orbi_turns WHERE created_at >= ${desde} AND created_at < ${hasta};

-- Serie diaria (día argentino)
SELECT to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS dia,
       count(*)::int AS mensajes, coalesce(sum(cost_usd),0)::float AS "costoUsd"
FROM orbi_turns WHERE created_at >= ${desde} AND created_at < ${hasta} GROUP BY 1 ORDER BY 1;

-- Acciones: la combinación de tools (sin repetir, ordenadas) de cada mensaje
SELECT coalesce(array_to_string(ARRAY(SELECT DISTINCT unnest(tools_used) ORDER BY 1), ' + '), '') AS tools,
       count(*)::int AS mensajes, avg(cost_usd)::float AS "costoPromedioUsd", coalesce(sum(cost_usd),0)::float AS "costoTotalUsd",
       avg(prompt_tokens)::float AS "entradaPromedio", avg(latency_ms)::float AS "latenciaPromedio"
FROM orbi_turns WHERE created_at >= ${desde} AND created_at < ${hasta} AND status <> 'quota'
GROUP BY 1 ORDER BY "costoTotalUsd" DESC LIMIT 20;

-- Negocios
SELECT t.business_id AS "businessId", b.name AS nombre, count(*)::int AS mensajes,
       coalesce(sum(t.cost_usd),0)::float AS "costoUsd", coalesce(sum(t.credits),0)::int AS creditos
FROM orbi_turns t JOIN businesses b ON b.id = t.business_id
WHERE t.created_at >= ${desde} AND t.created_at < ${hasta}
GROUP BY 1, 2 ORDER BY "costoUsd" DESC LIMIT 50;
```
(verificar los nombres reales de tabla y columna de `Business`). Cada negocio de la lista se completa con `cupoDelNegocio` (cupo y porcentaje). Una fila `tools = ''` se muestra como "Charla, sin tools". Los miembros del detalle salen de un `groupBy` por `memberId` + percentil por miembro en SQL, y nombres de `member`. `turnos` usa `prisma.orbiTurn.findMany({ where: { businessId, memberId?, createdAt: { gte: desde, lt: antesDe ? new Date(antesDe) : hasta } }, orderBy: { createdAt: 'desc' }, take: 51 })`.

- [ ] **Step 3: Controller**

```ts
@UseGuards(PlatformAdminGuard)
@SoloSuperadmin()
@Controller('platform/orbi/uso')
export class OrbiUsoPlataformaController {
  constructor(private readonly uso: OrbiUsoService, private readonly cupo: CupoOrbiService, private readonly adminLog: PlatformAdminLogService) {}

  @Get()
  resumen(@Query('mes') mes?: string) { return this.uso.resumen(mes ?? mesArgentina(new Date())); }

  @Get('negocios/:id')
  negocio(@Param('id') id: string, @Query('mes') mes?: string) { return this.uso.negocio(id, mes ?? mesArgentina(new Date())); }

  @Get('turnos')
  turnos(@Query('businessId') businessId: string, @Query('memberId') memberId?: string, @Query('mes') mes?: string, @Query('antesDe') antesDe?: string) {
    if (!businessId) throw new BadRequestException('Falta el negocio');
    return this.uso.turnos({ businessId, memberId, mes: mes ?? mesArgentina(new Date()), antesDe });
  }

  @Post('ajustes')
  @HttpCode(200)
  async ajustar(@Req() req: { user: PlatformAdminContext }, @Body() dto: AjusteCupoDto) {
    const r = await this.cupo.ajustar({ ...dto, adminId: req.user.adminId });
    await this.adminLog.orbiCupoAjuste({ adminId: req.user.adminId, businessId: dto.businessId, mes: dto.mes, creditos: dto.creditos, motivo: dto.motivo, ajusteId: r.id });
    return { ok: true, id: r.id };
  }
}
```

Verificar cómo combinan `@SoloSuperadmin()` y `PlatformAdminGuard` en `costs.controller.ts` (a nivel clase o método) y copiar ese uso. `AjusteCupoDto`: `businessId` `@IsUUID()`, `mes` `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)`, `creditos` `@IsInt()`, `motivo` `@IsString() @Length(5, 300)`.

`PlatformAdminLogService` suma a `ACCION_LOG_ADMIN` `orbiCupoAjuste: 'orbi_cupo_ajuste'` y `orbiConversacionAbierta: 'orbi_conversacion_abierta'`, con métodos públicos del mismo estilo que `orbiMantenimiento` (`targetType: 'business'`, `targetId: businessId`; para la conversación `targetType: 'orbi_conversation'`, `targetId: conversationId`, `details: { motivo, ticket }` sin el texto).

- [ ] **Step 4: Correr y commitear**

```bash
cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test
git add apps/api/src apps/web/src/modules/superadmin/ui.tsx
git commit -m "feat(superadmin): endpoints de uso de Orbi por mes, negocio y mensaje, y ajustes de cupo con registro"
```

---

## Task 12: Lectura auditada de conversaciones (apagada por defecto)

**Files:**
- Create: `apps/api/src/platform/orbi-uso/lectura-conversaciones.service.ts`, `dto/abrir-conversacion.dto.ts`, `lectura-conversaciones.service.spec.ts`
- Modify: `apps/api/src/platform/orbi-uso/orbi-uso.controller.ts` (endpoint)

**Interfaces:**
- Produces: `POST /platform/orbi/conversaciones/:id/abrir` → `{ id, titulo, businessId, memberId, mensajes: { rol: 'user' | 'assistant'; texto: string; fecha: string | null }[] }`. Con el flag apagado: `ForbiddenException('La lectura de conversaciones está deshabilitada hasta actualizar la política de privacidad.')`.

- [ ] **Step 1: Tests** — flag apagado → 403 y NO lee la conversación ni escribe registros; flag `on` → crea `orbiConversationAccess` ANTES de devolver el texto, llama `adminLog.orbiConversacionAbierta`, y cada texto pasa por `redact` (un email en el texto vuelve como el marcador de `redact.ts`); conversación inexistente → 404 sin registro; versión 2 lee las partes de texto de `orbi_messages`.

- [ ] **Step 2: Implementar**

```ts
@Injectable()
export class LecturaConversacionesService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly adminLog: PlatformAdminLogService) {}

  get habilitada(): boolean {
    return this.config.get<string>('ORBI_LECTURA_CONVERSACIONES') === 'on';
  }

  /**
   * Abre una conversación de Orbi para un admin de plataforma (spec D10). El
   * acceso se registra ANTES de devolver el texto: si el registro falla, no se
   * muestra nada (Ley 25.326 art. 9: poder detectar accesos). El texto sale
   * redactado (emails, teléfonos, documentos, tarjetas).
   */
  async abrir(conversationId: string, adminId: string, dto: AbrirConversacionDto) {
    if (!this.habilitada) throw new ForbiddenException('La lectura de conversaciones está deshabilitada hasta actualizar la política de privacidad.');
    const conv = await this.prisma.orbiConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, title: true, businessId: true, userId: true, version: true, messages: true },
    });
    if (!conv) throw new NotFoundException('No existe esa conversación');
    await this.prisma.orbiConversationAccess.create({
      data: { adminId, conversationId, businessId: conv.businessId, memberId: conv.userId, motivo: dto.motivo, detalle: dto.detalle.trim(), ticket: dto.ticket?.trim() || null },
    });
    await this.adminLog.orbiConversacionAbierta({ adminId, conversationId, businessId: conv.businessId, motivo: dto.motivo, ticket: dto.ticket });
    const mensajes = conv.version === 2 ? await this.mensajesV2(conv.id) : mensajesV1(conv.messages);
    return { id: conv.id, titulo: conv.title, businessId: conv.businessId, memberId: conv.userId, mensajes: mensajes.map((m) => ({ ...m, texto: redact(m.texto) })) };
  }

  private async mensajesV2(conversationId: string) {
    const filas = await this.prisma.orbiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' }, select: { role: true, parts: true, createdAt: true } });
    return filas.map((f) => ({
      rol: f.role as 'user' | 'assistant',
      texto: (Array.isArray(f.parts) ? f.parts : [])
        .filter((p): p is { tipo: string; texto: string } => !!p && typeof p === 'object' && (p as { tipo?: string }).tipo === 'texto' && typeof (p as { texto?: unknown }).texto === 'string')
        .map((p) => p.texto).join('\n'),
      fecha: f.createdAt.toISOString(),
    }));
  }
}

function mensajesV1(messages: unknown) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m): m is { role: string; content: string; timestamp?: string } => !!m && typeof m === 'object' && typeof (m as { content?: unknown }).content === 'string')
    .map((m) => ({ rol: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', texto: m.content, fecha: m.timestamp ?? null }));
}
```

Verificar la forma real de las partes de `orbi_messages` en `apps/api/src/orbi/sesiones/sesiones.service.ts` (tipo `Parte`, ~línea 17) y ajustar el filtro (`tipo`/`texto`). DTO:

```ts
export class AbrirConversacionDto {
  @IsIn(['soporte', 'abuso', 'calidad']) motivo!: 'soporte' | 'abuso' | 'calidad';
  @IsString() @Length(10, 500) detalle!: string;
  @IsOptional() @IsString() @MaxLength(100) ticket?: string;
}
```

Endpoint en un controller `@Controller('platform/orbi/conversaciones')` con `PlatformAdminGuard` + `@SoloSuperadmin()`: `@Post(':id/abrir') @HttpCode(200)`.

- [ ] **Step 3: Correr y commitear**

```bash
cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test
git add apps/api/src
git commit -m "feat(superadmin): abrir una conversación de Orbi con motivo, texto redactado y registro (apagado por defecto)"
```

---

## Task 13: Alertas de costo que se disparan solas

**Files:**
- Create: `apps/api/src/platform/costs/alertas-de-costo.service.ts`, `alertas-de-costo.service.spec.ts`
- Modify: `apps/api/src/platform/costs/costs.module.ts` (provider + export)
- Modify: `apps/api/src/internal-cron/internal-cron.controller.ts` (llamarlo después de `syncAll`, ~línea 144)

**Interfaces:**
- Produces: `AlertasDeCostoService.revisar(ahora?: Date): Promise<{ creadas: number }>`.

- [ ] **Step 1: Tests** — un límite SPEND de USD 10 con `alertAtPercent: [50, 80, 100]` y snapshot del mes de 8,5 → crea alertas de 50 y 80 (una vez: si ya existe una alerta de ese límite y porcentaje con `notifiedAt` dentro del mes, no la repite); límite sin proveedor → se ignora; límite inactivo → se ignora.

- [ ] **Step 2: Implementar**

```ts
@Injectable()
export class AlertasDeCostoService {
  private readonly logger = new Logger(AlertasDeCostoService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compara cada límite activo con el gasto del mes (cost_snapshots, que el sync
   * nocturno acaba de actualizar) y crea una cost_alert por cada umbral cruzado,
   * una sola vez por mes. Antes los límites solo se mostraban: nadie se enteraba.
   */
  async revisar(ahora = new Date()): Promise<{ creadas: number }> {
    const mes = currentMonth(); // el mismo helper que usa costs.service.ts para los snapshots
    const inicio = inicioDeMesArgentina(ahora);
    const limites = await this.prisma.costLimit.findMany({ where: { active: true, providerId: { not: null } } });
    let creadas = 0;
    for (const l of limites) {
      const snap = await this.prisma.costSnapshot.findFirst({ where: { providerId: l.providerId!, month: mes } });
      const actual = snap ? Number(snap.amountUsd) : 0;
      const umbral = Number(l.threshold);
      if (umbral <= 0) continue;
      const pct = (actual / umbral) * 100;
      for (const p of [...l.alertAtPercent].sort((a, b) => a - b)) {
        if (pct < p) break;
        const ya = await this.prisma.costAlert.findFirst({ where: { limitId: l.id, percentReached: p, notifiedAt: { gte: inicio } }, select: { id: true } });
        if (ya) continue;
        await this.prisma.costAlert.create({ data: { limitId: l.id, percentReached: p, currentValue: actual } });
        creadas++;
      }
    }
    if (creadas) this.logger.warn(`Costos: ${creadas} alertas nuevas de límite`);
    return { creadas };
  }
}
```

Verificar dónde vive `currentMonth()` (lo usa `costs.service.ts:329`) y su formato; exportarlo si es local. En el cron, `await this.alertasDeCosto?.revisar();` dentro del mismo `try` que `syncAll` (inyección opcional, como `costs`).

- [ ] **Step 3: Correr y commitear**

```bash
cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test
git add apps/api/src
git commit -m "feat(costos): los límites de gasto crean alertas solos cada noche"
```

---

## Task 14: Superadmin → Orbi → Uso (web)

**Files:**
- Modify: `apps/web/src/lib/platform/api.ts` (tipos y métodos)
- Create: `apps/web/src/modules/superadmin/OrbiUso.tsx`, `apps/web/src/modules/superadmin/orbiUso.ts` (formateo puro), `orbiUso.test.ts`
- Modify: `apps/web/src/modules/superadmin/Orbi.tsx` (pestañas Estado / Uso)

**Interfaces:**
- Consumes: endpoints de las Tasks 11 y 12.
- Produces (`api.ts`): tipos `OrbiUsoResumen`, `OrbiUsoNegocio`, `OrbiFichaTurno` (los de Task 11, en camelCase tal cual) y

```ts
  orbiUso: (mes: string) => getJSON<OrbiUsoResumen>(`/platform/orbi/uso?mes=${mes}`),
  orbiUsoNegocio: (id: string, mes: string) => getJSON<OrbiUsoNegocio>(`/platform/orbi/uso/negocios/${id}?mes=${mes}`),
  orbiUsoTurnos: (p: { businessId: string; memberId?: string; mes: string; antesDe?: string }) =>
    getJSON<{ turnos: OrbiFichaTurno[]; siguiente: string | null }>(`/platform/orbi/uso/turnos?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`),
  orbiAjustarCupo: (b: { businessId: string; mes: string; creditos: number; motivo: string }) => sendJSON<{ ok: true; id: string }>('/platform/orbi/uso/ajustes', 'POST', b),
  orbiAbrirConversacion: (id: string, b: { motivo: 'soporte' | 'abuso' | 'calidad'; detalle: string; ticket?: string }) =>
    sendJSON<{ id: string; titulo: string | null; mensajes: { rol: 'user' | 'assistant'; texto: string; fecha: string | null }[] }>(`/platform/orbi/conversaciones/${id}/abrir`, 'POST', b),
```

- [ ] **Step 1: Funciones puras + tests** (`orbiUso.ts`):

```ts
export const usd = (n: number | null | undefined) => (n == null ? '—' : `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: n < 0.1 ? 4 : 2, maximumFractionDigits: n < 0.1 ? 4 : 2 })}`);
export const tokens = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-AR'));
export const ms = (n: number | null | undefined) => (n == null ? '—' : n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`);
export const etiquetaDeTools = (t: string) => (t ? t : 'Charla, sin tools');
export function mesesRecientes(ahora: Date, cuantos = 6): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
  for (let i = 0; i < cuantos; i++) { out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() - 1); }
  return out;
}
```
Tests: `usd(0.0079)` → `'USD 0,0079'`; `usd(12.5)` → `'USD 12,50'`; `ms(1960)` → `'2 s'`; `etiquetaDeTools('')` → `'Charla, sin tools'`; `mesesRecientes(new Date('2026-10-15'), 3)` → `['2026-10','2026-09','2026-08']`.

- [ ] **Step 2: `OrbiUso.tsx`** — con las piezas de `./ui` (`useFetch`, `Card`, `Kpi`, `Grid`, `Table`, `PageHeader`, `Loader`, `ErrorBox`, `Empty`, `ModalShell`, `Field`, `btnGhost`, `btnPrimary`, `inputStyle`, `dateTime`) y `LineSeriesChart` de `./charts`:
  - Selector de mes (`mesesRecientes`).
  - KPIs: mensajes, costo, créditos, tokens de entrada (y % cacheado), salida (y % pensamiento), latencia p50/p95, primer token p50, errores, frenados por cupo, con Groq, acciones propuestas → confirmadas / rechazadas, escrituras rechazadas.
  - Serie diaria (mensajes y costo).
  - Tabla "Qué cuesta cada acción": tools, mensajes, costo promedio, costo total, entrada promedio, latencia promedio.
  - Tabla de negocios (clic → detalle): nombre, mensajes, costo, créditos, `% del cupo` (en rojo desde 100).
  - Detalle de negocio: cupo (base, ajustes, total), botón **"Ajustar cupo"** (modal: créditos con signo, motivo; aviso "Queda registrado con tu nombre"), tabla de ajustes, tabla de miembros (clic → fichas filtradas), y fichas de mensajes (fecha, miembro, pantalla, tools, vueltas, entrada/caché/salida/pensamiento, primer token, total, costo, estado) con "Ver más" (paginado por `siguiente`) y un desplegable por ficha con sus `steps`.
  - En cada ficha con `conversationId`: botón **"Abrir conversación"**. Si `lecturaHabilitada` es false, el botón queda deshabilitado con el texto "Deshabilitado hasta actualizar la política de privacidad". Si está habilitado: modal con motivo (soporte / abuso / calidad), detalle (mínimo 10 caracteres), ticket opcional, el aviso "Esta lectura queda registrada con tu nombre, la fecha y el motivo", y al confirmar muestra los mensajes redactados.

- [ ] **Step 3: Pestañas en `Orbi.tsx`** — un `useState<'estado' | 'uso'>('estado')` con dos botones tipo segmentado arriba (reusar el estilo de los filtros de `Soporte.tsx` o `Costos.tsx`); `'uso'` renderiza `<OrbiUso />`.

- [ ] **Step 4: Verificar**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm test`
Expected: PASS. La verificación en el navegador queda pendiente (hace falta un superadmin logueado contra la API local).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(superadmin): pestaña Uso de Orbi con costo por acción, negocios, fichas y ajustes de cupo"
```

---

## Task 15: Panel — % de uso en el chat y vista del equipo

**Files:**
- Create: `apps/web/src/modules/orbi/api/uso.ts`, `apps/web/src/modules/orbi/piezas/BarraDeUso.tsx`, `apps/web/src/modules/orbi/vistas/OrbiUsoPagina.tsx`, `apps/web/src/modules/orbi/estado/uso.ts`, `uso.test.ts`
- Modify: `apps/web/src/modules/orbi/piezas/Encabezado.tsx` (barra), `apps/web/src/modules/orbi/vistas/OrbiPagina.tsx` (rama `vista=uso` + link "Uso del equipo" para dueño/admin)
- Modify: `apps/web/src/modules/ventas/panel/manual/contenido.ts` (tema de Orbi) y regenerar `apps/api/src/orbi/manual/manual.generated.ts`

**Interfaces:**
- Consumes: `GET /orbi/uso`, `GET /orbi/uso/equipo`, `PUT /orbi/uso/equipo/:memberId`.
- Produces (`estado/uso.ts`):

```ts
export function mostrarBarra(porcentaje: number): boolean;          // >= 50
export function tonoDeUso(porcentaje: number): 'normal' | 'alto' | 'agotado'; // <80, 80..99, >=100
export function textoDeUso(u: { negocio: { porcentaje: number }; propio: { porcentaje: number; topePorcentaje: number | null } }): string;
// "Usaste el 62% de tu parte de Orbi este mes" (con tope) | "El negocio usó el 62% de Orbi este mes" (sin tope)
```

- [ ] **Step 1: Tests de `estado/uso.ts`** — `mostrarBarra(49)` false, `mostrarBarra(50)` true; `tonoDeUso(80)` 'alto', `tonoDeUso(100)` 'agotado'; `textoDeUso` con y sin tope.

- [ ] **Step 2: Implementar** `estado/uso.ts`, `api/uso.ts` (mismo cliente que `api/sesiones.ts`), `BarraDeUso.tsx` (barra de 3 px bajo el encabezado, con `role="progressbar"`, `aria-valuenow`, y el texto de `textoDeUso` como `title` y texto visible en 12 px cuando el tono es `alto` o `agotado`; se pide al abrir Orbi y después de cada respuesta), y montarla en `Encabezado.tsx`.

- [ ] **Step 3: `OrbiUsoPagina.tsx`** — para dueño y admin (si el `GET /orbi/uso/equipo` da 403, mostrar "Esta vista es para el dueño o los administradores"):
  - Encabezado "Uso de Orbi" y el % del negocio en el mes.
  - Tabla "Equipo": nombre, % usado, tope. El dueño ve un selector de tope por fila (Sin tope, 25%, 50%, 75%, o un número entre 10 y 100) que hace el `PUT`.
  - Lista "Lo que hizo Orbi": fecha, miembro, acción (resumen) y estado (Hecho / Falló), de los últimos 30 días.
  - Texto fijo: "No se muestran las conversaciones: cada persona ve solo las suyas."

  En `OrbiPagina.tsx`, si `router.query.vista === 'uso'` renderizar `OrbiUsoPagina`; en la columna de sesiones, para dueño/admin, un link "Uso del equipo" a `?vista=uso`.

- [ ] **Step 4: Manual** — en `contenido.ts`, en el tema de Orbi (`id: 'orbi'`, ~línea 851), agregar los pasos de la vista "Uso del equipo" con los textos EXACTOS de los botones y títulos de la pantalla (`[[Uso del equipo]]`). Después:

```bash
cd apps/web && pnpm manual:generar && pnpm exec tsc --noEmit && pnpm test
```
Expected: PASS (el contrato del manual valida que los botones existan). Commitear también `apps/api/src/orbi/manual/manual.generated.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src apps/api/src/orbi/manual/manual.generated.ts
git commit -m "feat(orbi): el panel muestra el % de uso y el dueño reparte el cupo entre su equipo"
```

---

## Task 16: Aviso de privacidad en el chat

**Files:**
- Modify: `apps/web/src/modules/orbi/piezas/Caja.tsx` (debajo del input)

- [ ] **Step 1: Implementar** — una línea de 11,5 px en color atenuado, debajo de la caja, siempre visible:

```tsx
<p className={s.avisoPrivacidad}>
  Lo que escribís queda en tu historial y lo procesa Google Gemini.{' '}
  <a href="/privacidad" target="_blank" rel="noreferrer">Privacidad</a>
</p>
```
con su clase en `orbi.module.css` (`font-size: 11.5px; color: var(--color-muted); margin: 6px 2px 0; text-align: center;`). No se muestra en el wizard ni en la demo si la caja recibe una prop que lo indique (revisar cómo `Caja` sabe la superficie; si no lo sabe, mostrarlo siempre en el panel).

- [ ] **Step 2: Verificar** — `cd apps/web && pnpm exec tsc --noEmit && pnpm test`. Si el manual menciona el chat con un texto que cambie, regenerarlo.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src
git commit -m "feat(orbi): el chat avisa que lo escrito se guarda y lo procesa Gemini"
```

---

## Task 17: Revisión final y entrega

- [ ] **Step 1: Suite completa con las keys vacías**

```bash
cd apps/api && pnpm typecheck && GEMINI_API_KEY= GROQ_API_KEY= GEMINI_IMAGE_API_KEY= pnpm test
cd ../web && pnpm exec tsc --noEmit && pnpm test
```

- [ ] **Step 2: Revisión de código** con superpowers:requesting-code-review sobre `git diff origin/main...feat/orbi-medicion`.

- [ ] **Step 3: `git fetch origin && git merge origin/main`**, resolver conflictos y repetir el Step 1.

- [ ] **Step 4: `graphify update .`** y reporte a Alan: qué quedó, qué falta de su lado (billing, Groq Data Controls, política de privacidad, decidir `ORBI_CUPO_BLOQUEA`, `ORBI_LECTURA_CONVERSACIONES` y el plazo de sesiones), y que el push a `main`, la migración en producción y `deploy.sh` esperan su autorización.
