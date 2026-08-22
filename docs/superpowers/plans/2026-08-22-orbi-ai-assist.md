# Orbi — Asistente completo de producto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender el botón "Generar con Orbi" del wizard de producto (RBT-684) para que, a partir del nombre, sugiera en un solo request la descripción (con specs técnicas reales si el producto es reconocible), la categoría y las etiquetas.

**Architecture:** Un endpoint nuevo `POST /products/ai-assist` reemplaza a `generate-description`. El backend resuelve él mismo las categorías y etiquetas del negocio (`CategoriesService` / `TagsService`, ya existentes) y le pasa esa lista a Groq junto con el nombre del producto, pidiendo una respuesta JSON estructurada (`response_format: json_object`) con `{ description, suggestedCategoryId, suggestedTags }`. El frontend llama una sola vez y aplica el resultado sin pisar lo que el vendedor ya haya cargado a mano.

**Tech Stack:** NestJS 11, `groq-sdk` 1.5.0, Prisma 6 (vía `CategoriesService`/`TagsService` existentes), Next.js/React (frontend), Jest + ts-jest (unit tests backend).

**Spec:** [docs/superpowers/specs/2026-08-22-orbi-ai-assist-design.md](../specs/2026-08-22-orbi-ai-assist-design.md)

## Global Constraints

- La categoría sugerida (`suggestedCategoryId`) tiene que ser siempre `null` o un id que exista en la lista de categorías del negocio — nunca se inventa ni se crea una categoría nueva.
- Las etiquetas sugeridas (`suggestedTags`) son como máximo 5, en minúscula, sin duplicados (comparando sin importar mayúsculas).
- El endpoint sigue exclusivo del panel (`assertMemberContext`), con el mismo permiso `catalog.manage` y el mismo throttle (`20/60000ms`) que tenía `generate-description`.
- El manejo de errores de Groq (log de `error.status`, 401/403 → 503, resto → 500 genérico) ya existe desde el fix de RBT-635 (2026-08-22) — se reutiliza tal cual, no se reescribe.
- En el frontend, el botón nunca sobreescribe una categoría ya elegida ni borra/duplica etiquetas ya cargadas — solo completa lo vacío.
- Todo texto de usuario (system prompt, mensajes de error, UI) en español rioplatense, mismo tono que el resto del panel.

---

### Task 1: Backend — `ProductAiService.assist()` + `AiAssistDto`

**Files:**
- Create: `apps/api/src/products/dto/ai-assist.dto.ts`
- Delete: `apps/api/src/products/dto/generate-description.dto.ts`
- Modify: `apps/api/src/products/product-ai.service.ts`
- Modify: `apps/api/test/unit/product-ai.service.unit-spec.ts`

**Interfaces:**
- Consumes: `CategoriesService.findAll(businessId: string, flat?: boolean): Promise<CategoryListItem[]>` (flat=true) de `apps/api/src/categories/categories.service.ts` (ya existe, sin cambios). `TagsService.findAll(businessId: string): Promise<{ id: string; name: string; createdAt: string; usageCount: number }[]>` de `apps/api/src/tags/tags.service.ts` (ya existe, sin cambios).
- Produces: `ProductAiService.assist(businessId: string, dto: AiAssistDto): Promise<AiAssistResult>` donde `AiAssistResult = { description: string; suggestedCategoryId: string | null; suggestedTags: string[] }` — usado por Task 2 (controller).

- [ ] **Step 1: Escribir el DTO nuevo**

Crear `apps/api/src/products/dto/ai-assist.dto.ts`:

```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AiAssistDto {
  @IsString() @MaxLength(80) name!: string;
  // Descripción ya escrita por el usuario, si la hay — se usa como contexto
  // para que Orbi la mejore/extienda en vez de ignorarla.
  @IsOptional() @IsString() @MaxLength(2000) existingDescription?: string;
}
```

- [ ] **Step 2: Reescribir el test unitario completo (falla porque `assist()` todavía no existe)**

Reemplazar todo el contenido de `apps/api/test/unit/product-ai.service.unit-spec.ts`:

```ts
import Groq from 'groq-sdk';
import { ProductAiService } from '../../src/products/product-ai.service';
import type { CategoryListItem } from '../../src/categories/categories.service';

// Unit test de ProductAiService (RBT-684 — Orbi asiste descripción + categoría +
// etiquetas). No pega a la API real: mockea el cliente de Groq vía el campo
// privado `client`, y CategoriesService/TagsService como objetos simples.

type TagUsado = { id: string; name: string; createdAt: string; usageCount: number };

function makeService(
  apiKey: string | undefined,
  categorias: CategoryListItem[] = [],
  tagsUsados: TagUsado[] = [],
) {
  const config = { get: () => apiKey } as any;
  const categoriesService = { findAll: async () => categorias } as any;
  const tagsService = { findAll: async () => tagsUsados } as any;
  return new ProductAiService(config, categoriesService, tagsService);
}

function mockCreate(svc: ProductAiService, impl: (...args: any[]) => any) {
  const create = jest.fn(impl);
  (svc as any).client = { chat: { completions: { create } } };
  return create;
}

const dto = { name: 'Remera oversize' };
const cat = (id: string, name: string): CategoryListItem => ({
  id, name, slug: name.toLowerCase(), icon: null, color: null, parentId: null,
  isActive: true, position: 0, productCount: 0,
});

describe('ProductAiService.assist (unit)', () => {
  it('rechaza con 503 si GROQ_API_KEY no está configurada', async () => {
    const svc = makeService(undefined);
    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 503 });
  });

  it('devuelve descripción, categoría sugerida y etiquetas cuando Groq responde JSON válido', async () => {
    const svc = makeService('gsk-test', [cat('cat-1', 'Remeras')]);
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({
        description: 'Remera de algodón premium, corte oversize.',
        suggestedCategoryId: 'cat-1',
        suggestedTags: ['verano', 'algodón'],
      }) } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result).toEqual({
      description: 'Remera de algodón premium, corte oversize.',
      suggestedCategoryId: 'cat-1',
      suggestedTags: ['verano', 'algodón'],
    });
  });

  it('descarta suggestedCategoryId si no está en la lista de categorías del negocio', async () => {
    const svc = makeService('gsk-test', [cat('cat-1', 'Remeras')]);
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({
        description: 'ok', suggestedCategoryId: 'cat-inventado', suggestedTags: [],
      }) } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedCategoryId).toBeNull();
  });

  it('dedupea sin importar mayúsculas y recorta a 5 las etiquetas sugeridas', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({
        description: 'ok',
        suggestedCategoryId: null,
        suggestedTags: ['Verano', 'verano', 'algodón', 'casual', 'urbano', 'básico', 'oversize'],
      }) } }],
    }));

    const result = await svc.assist('biz-1', dto);

    expect(result.suggestedTags).toEqual(['verano', 'algodón', 'casual', 'urbano', 'básico']);
  });

  it('incluye categorías y etiquetas ya usadas en el mensaje enviado a Groq', async () => {
    const svc = makeService('gsk-test', [cat('cat-1', 'Remeras')], [
      { id: 't-1', name: 'verano', createdAt: '', usageCount: 3 },
    ]);
    const create = mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({ description: 'ok', suggestedCategoryId: null, suggestedTags: [] }) } }],
    }));

    await svc.assist('biz-1', { name: 'Remera oversize', existingDescription: 'Es cómoda' });

    const enviado = create.mock.calls[0][0].messages[1].content as string;
    expect(enviado).toContain('Remera oversize');
    expect(enviado).toContain('Es cómoda');
    expect(enviado).toContain('cat-1: Remeras');
    expect(enviado).toContain('verano');
    expect(create.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
  });

  it('rechaza con 500 si la llamada a la API falla', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => { throw new Error('network down'); });

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza con 503 si Groq responde 401 (API key inválida/vencida)', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => {
      throw new Groq.AuthenticationError(401, { error: { message: 'Invalid API Key' } }, 'Invalid API Key', new Headers());
    });

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 503 });
  });

  it('rechaza con 500 si la respuesta no es JSON válido', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => ({ choices: [{ message: { content: 'esto no es json' } }] }));

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza con 500 si la respuesta no trae description', async () => {
    const svc = makeService('gsk-test');
    mockCreate(svc, async () => ({
      choices: [{ message: { content: JSON.stringify({ suggestedCategoryId: null, suggestedTags: [] }) } }],
    }));

    await expect(svc.assist('biz-1', dto)).rejects.toMatchObject({ status: 500 });
  });
});
```

- [ ] **Step 3: Correr los tests y confirmar que fallan**

Run: `cd apps/api && npx jest --config ./test/jest-unit.json product-ai`
Expected: FAIL — error de compilación (ts-jest) porque `ProductAiService` todavía no tiene un método `assist` ni acepta 3 argumentos en el constructor.

- [ ] **Step 4: Implementar `assist()` en `ProductAiService`**

Reemplazar todo el contenido de `apps/api/src/products/product-ai.service.ts`:

```ts
import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { CategoriesService, type CategoryListItem } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';
import { AiAssistDto } from './dto/ai-assist.dto';

export interface AiAssistResult {
  description: string;
  suggestedCategoryId: string | null;
  suggestedTags: string[];
}

const SYSTEM_PROMPT =
  'Asistís a un vendedor que está cargando un producto en la tienda online de un comercio en Argentina. ' +
  'Con el nombre del producto (y opcionalmente un borrador de descripción, las categorías del negocio y sus ' +
  'etiquetas ya usadas), generás tres cosas:\n' +
  '1) Una descripción de producto: español rioplatense, tono cercano y directo, sin exclamaciones ni emojis, ' +
  '2 a 4 oraciones. Si el producto es reconocible (electrónica, indumentaria de marca, etc.) podés mencionar ' +
  'especificaciones técnicas reales que conozcas (capacidad, materiales, medidas). No inventes precios ni datos ' +
  'exclusivos de este negocio en particular.\n' +
  '2) Una categoría sugerida ("suggestedCategoryId"): elegí el id que mejor matchee de la lista de categorías ' +
  'dada, o null si ninguna encaja razonablemente. Nunca inventes un id que no esté en la lista.\n' +
  '3) Etiquetas sugeridas ("suggestedTags"): entre 2 y 5, cortas, en minúscula. Preferí reusar las etiquetas ya ' +
  'usadas por el negocio si aplican; si hace falta, sugerí alguna nueva.\n' +
  'Devolvé SOLO un JSON con esta forma exacta, sin texto adicional ni markdown: ' +
  '{"description": "...", "suggestedCategoryId": "<id o null>", "suggestedTags": ["...", "..."]}';

@Injectable()
export class ProductAiService {
  private readonly logger = new Logger(ProductAiService.name);
  private client: Groq | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
  ) {}

  // Lazy: si GROQ_API_KEY nunca se configura, el resto de la API sigue
  // funcionando sin problema — solo este endpoint queda inhabilitado.
  private getClient(): Groq {
    if (!this.client) {
      const apiKey = this.config.get<string>('GROQ_API_KEY');
      if (!apiKey) {
        throw new ServiceUnavailableException('La generación de descripciones con IA no está configurada en el servidor');
      }
      this.client = new Groq({ apiKey });
    }
    return this.client;
  }

  async assist(businessId: string, dto: AiAssistDto): Promise<AiAssistResult> {
    const client = this.getClient();

    const [categorias, tagsUsados] = await Promise.all([
      this.categoriesService.findAll(businessId, true) as Promise<CategoryListItem[]>,
      this.tagsService.findAll(businessId),
    ]);

    const contexto: string[] = [`Nombre del producto: ${dto.name}`];
    if (dto.existingDescription) contexto.push(`Borrador actual del vendedor: ${dto.existingDescription}`);
    contexto.push(
      'Categorías del negocio (elegí un id de esta lista, o null si ninguna encaja):\n' +
        (categorias.map((c) => `${c.id}: ${c.name}`).join('\n') || '(el negocio no tiene categorías cargadas)'),
    );
    if (tagsUsados.length) {
      contexto.push(`Etiquetas ya usadas por el negocio (preferí reusarlas si aplican): ${tagsUsados.map((t) => t.name).join(', ')}`);
    }

    let response: Groq.Chat.Completions.ChatCompletion;
    try {
      response = await client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        max_completion_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: contexto.join('\n') },
        ],
      });
    } catch (error) {
      const status = error instanceof Groq.APIError ? error.status : undefined;
      this.logger.error(`Groq rechazó la generación de descripción (status ${status ?? 'desconocido'}): ${error}`);
      if (status === 401 || status === 403) {
        throw new ServiceUnavailableException('La generación de descripciones con IA no está configurada correctamente en el servidor');
      }
      throw new InternalServerErrorException('No se pudo generar la descripción. Probá de nuevo.');
    }

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      throw new InternalServerErrorException('No se pudo generar la descripción. Probá de nuevo.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new InternalServerErrorException('No se pudo generar la descripción. Probá de nuevo.');
    }

    const result = parsed as Partial<AiAssistResult>;
    const description = typeof result.description === 'string' ? result.description.trim() : '';
    if (!description) {
      throw new InternalServerErrorException('No se pudo generar la descripción. Probá de nuevo.');
    }

    const categoryIds = new Set(categorias.map((c) => c.id));
    const suggestedCategoryId =
      typeof result.suggestedCategoryId === 'string' && categoryIds.has(result.suggestedCategoryId)
        ? result.suggestedCategoryId
        : null;

    const suggestedTags = Array.isArray(result.suggestedTags)
      ? Array.from(
          new Set(
            result.suggestedTags
              .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
              .map((t) => t.trim().toLowerCase()),
          ),
        ).slice(0, 5)
      : [];

    return { description, suggestedCategoryId, suggestedTags };
  }
}
```

- [ ] **Step 5: Borrar el DTO viejo**

Eliminar `apps/api/src/products/dto/generate-description.dto.ts` (reemplazado por `ai-assist.dto.ts`).

- [ ] **Step 6: Correr los tests y confirmar que pasan**

Run: `cd apps/api && npx jest --config ./test/jest-unit.json product-ai`
Expected: PASS — 9 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/products/dto/ai-assist.dto.ts apps/api/src/products/product-ai.service.ts apps/api/test/unit/product-ai.service.unit-spec.ts
git rm apps/api/src/products/dto/generate-description.dto.ts
git commit -m "feat(productos): ProductAiService.assist() sugiere categoria y etiquetas ademas de la descripcion"
```

---

### Task 2: Backend — wiring de módulos y endpoint `POST /products/ai-assist`

**Files:**
- Modify: `apps/api/src/categories/categories.module.ts`
- Modify: `apps/api/src/tags/tags.module.ts`
- Modify: `apps/api/src/products/products.module.ts`
- Modify: `apps/api/src/products/products.controller.ts`

**Interfaces:**
- Consumes: `ProductAiService.assist(businessId, dto)` de Task 1.
- Produces: ruta `POST /products/ai-assist` que devuelve `AiAssistResult` — usada por Task 3 (frontend).

- [ ] **Step 1: Exportar `CategoriesService` desde su módulo**

En `apps/api/src/categories/categories.module.ts`, reemplazar todo el contenido:

```ts
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
```

- [ ] **Step 2: Exportar `TagsService` desde su módulo**

En `apps/api/src/tags/tags.module.ts`, reemplazar todo el contenido:

```ts
import { Module } from '@nestjs/common';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
```

- [ ] **Step 3: Importar ambos módulos en `ProductsModule`**

En `apps/api/src/products/products.module.ts`, reemplazar todo el contenido:

```ts
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductAiService } from './product-ai.service';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [CategoriesModule, TagsModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductAiService],
})
export class ProductsModule {}
```

- [ ] **Step 4: Renombrar la ruta y el DTO en el controller**

En `apps/api/src/products/products.controller.ts`, cambiar el import del DTO:

```ts
import { AiAssistDto } from './dto/ai-assist.dto';
```

(reemplaza `import { GenerateDescriptionDto } from './dto/generate-description.dto';`)

Y reemplazar el método `generateDescription`:

```ts
  // Antes de ':id' — no es un id real, pero evita cualquier ambigüedad de ruta.
  @Post('ai-assist')
  @RequirePermission('catalog.manage')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  aiAssist(@CurrentBusiness() ctx: AuthContext, @Body() dto: AiAssistDto) {
    const member = assertMemberContext(ctx);
    return this.productAiService.assist(member.businessId, dto);
  }
```

(reemplaza el bloque completo del método `generateDescription` original, incluyendo su comentario).

- [ ] **Step 5: Actualizar el comentario en `.env.example`**

En `apps/api/.env.example`, cambiar:

```
# Groq API (Orbi) — usada para generar la descripción de producto con IA.
# Si queda vacía, el endpoint /products/generate-description responde 503 en
# vez de romper el resto del backend.
```

Por:

```
# Groq API (Orbi) — usada para generar descripción, categoría y etiquetas de producto con IA.
# Si queda vacía, el endpoint /products/ai-assist responde 503 en vez de romper el resto del backend.
```

- [ ] **Step 6: Verificar que compila sin errores nuevos**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "products|categories|tags"`
Expected: sin salida (0 líneas) — el repo ya tiene errores de TypeScript preexistentes en otros módulos (Prisma types desactualizados en `orders`, `returns`, `storefront`), no relacionados con este cambio; ese grep filtra específicamente los archivos tocados en este plan.

- [ ] **Step 7: Correr la suite unitaria completa de productos**

Run: `cd apps/api && npx jest --config ./test/jest-unit.json product`
Expected: PASS — todos los tests de `product-ai.service.unit-spec.ts` y cualquier otro `product*.unit-spec.ts` existente.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/categories/categories.module.ts apps/api/src/tags/tags.module.ts apps/api/src/products/products.module.ts apps/api/src/products/products.controller.ts apps/api/.env.example
git commit -m "feat(productos): exponer POST /products/ai-assist con categorias/etiquetas resueltas server-side"
```

---

### Task 3: Frontend — cliente API `panelAiAssist`

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Consumes: `panelRequest<T>(path: string, options?: RequestInit): Promise<T>` (helper ya existente en el mismo archivo).
- Produces: `panelAiAssist(input: AiAssistInput): Promise<AiAssistResult>` donde `AiAssistInput = { name: string; existingDescription?: string }` y `AiAssistResult = { description: string; suggestedCategoryId: string | null; suggestedTags: string[] }` — usado por Task 4.

- [ ] **Step 1: Reemplazar `GenerateProductDescriptionInput`/`panelGenerateProductDescription`**

En `apps/web/src/lib/api.ts`, ubicar (cerca de `panelCreateProduct`):

```ts
export type GenerateProductDescriptionInput = {
  name: string
  categoryName?: string
  tags?: string[]
  existingDescription?: string
}

export function panelGenerateProductDescription(input: GenerateProductDescriptionInput) {
  return panelRequest<{ description: string }>('/products/generate-description', { method: 'POST', body: JSON.stringify(input) })
}
```

Reemplazar por:

```ts
export type AiAssistInput = {
  name: string
  existingDescription?: string
}

export type AiAssistResult = {
  description: string
  suggestedCategoryId: string | null
  suggestedTags: string[]
}

export function panelAiAssist(input: AiAssistInput) {
  return panelRequest<AiAssistResult>('/products/ai-assist', { method: 'POST', body: JSON.stringify(input) })
}
```

- [ ] **Step 2: Verificar que compila sin errores nuevos**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "lib/api.ts"`
Expected: sin salida — falla recién en Task 4 hasta actualizar `ProductoNuevo.tsx` (que todavía importa el nombre viejo); si en este paso ya aparece un error en `lib/api.ts` mismo, corregirlo antes de seguir.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(productos): panelAiAssist reemplaza panelGenerateProductDescription"
```

---

### Task 4: Frontend — wiring en `ProductoNuevo.tsx`

**Files:**
- Modify: `apps/web/src/modules/ventas/panel/catalogo/ProductoNuevo.tsx`

**Interfaces:**
- Consumes: `panelAiAssist(input: AiAssistInput): Promise<AiAssistResult>` de Task 3.

- [ ] **Step 1: Cambiar el import**

Ubicar el bloque de import de `@/lib/api` (línea ~23-29):

```ts
import {
    panelCreateProduct, panelUpdateProduct, panelGetProductFull,
    panelGetCategoriesFlat, panelUploadProductImage, panelDeleteProductImage,
    panelGetTags, panelCreateTag, panelGenerateProductDescription,
    ApiError,
    type ApiCategory, type ApiProductFull, type UpsertProductInput, type ProductStatus, type ApiTag,
} from '@/lib/api'
```

Reemplazar `panelGenerateProductDescription` por `panelAiAssist`:

```ts
import {
    panelCreateProduct, panelUpdateProduct, panelGetProductFull,
    panelGetCategoriesFlat, panelUploadProductImage, panelDeleteProductImage,
    panelGetTags, panelCreateTag, panelAiAssist,
    ApiError,
    type ApiCategory, type ApiProductFull, type UpsertProductInput, type ProductStatus, type ApiTag,
} from '@/lib/api'
```

- [ ] **Step 2: Reemplazar `orbiDesc` por `orbiAsistir`**

Ubicar la función `orbiDesc` (línea ~400-418):

```ts
    const orbiDesc = async () => {
        if (!prod.nombre.trim()) { onToast('Poné el nombre del producto antes de generar la descripción'); return }
        setOrbiGen(true)
        try {
            const categoryName = categorias.find(c => c.id === prod.categoriaId)?.name
            const { description } = await panelGenerateProductDescription({
                name: prod.nombre.trim(),
                categoryName,
                tags: prod.tags,
                existingDescription: prod.descripcion.trim() || undefined,
            })
            set('descripcion', description)
            onToast('Descripción generada por Orbi')
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo generar la descripción. Probá de nuevo.')
        } finally {
            setOrbiGen(false)
        }
    }
```

Reemplazar por:

```ts
    // Nota: usa setProd funcional (no `set`/`agregarTag` sueltos) para categoría y
    // etiquetas porque las tres actualizaciones (descripción, categoría, tags) pueden
    // quedar en el mismo batch de React — leer `prod` del closure ahí perdería las
    // etiquetas sugeridas menos la última.
    const orbiAsistir = async () => {
        if (!prod.nombre.trim()) { onToast('Poné el nombre del producto antes de generar con Orbi'); return }
        setOrbiGen(true)
        try {
            const { description, suggestedCategoryId, suggestedTags } = await panelAiAssist({
                name: prod.nombre.trim(),
                existingDescription: prod.descripcion.trim() || undefined,
            })
            setProd(p => {
                const yaEstan = new Set(p.tags.map(t => t.trim().toLowerCase()))
                const nuevasTags = suggestedTags.filter(t => !yaEstan.has(t.trim().toLowerCase()))
                return {
                    ...p,
                    descripcion: description,
                    categoriaId: p.categoriaId || suggestedCategoryId || p.categoriaId,
                    tags: nuevasTags.length ? [...p.tags, ...nuevasTags] : p.tags,
                }
            })
            onToast('Generado por Orbi')
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo generar con Orbi. Probá de nuevo.')
        } finally {
            setOrbiGen(false)
        }
    }
```

- [ ] **Step 3: Mover el botón de la descripción al campo Nombre**

Ubicar el bloque del campo "Nombre del producto" (línea ~716-722):

```tsx
                            <div style={{ marginBottom: 18 }}>
                                <PField label="Nombre del producto" value={prod.nombre} onChange={v => set('nombre', v.slice(0, 80))} placeholder="Ej: Remera oversize negra" h={44} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                    <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Usá palabras que tus clientes buscarían</span>
                                    <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{prod.nombre.length}/80</span>
                                </div>
                            </div>
```

Reemplazar por (agrega el botón "Generar con Orbi" debajo del nombre):

```tsx
                            <div style={{ marginBottom: 18 }}>
                                <PField label="Nombre del producto" value={prod.nombre} onChange={v => set('nombre', v.slice(0, 80))} placeholder="Ej: Remera oversize negra" h={44} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                    <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Usá palabras que tus clientes buscarían</span>
                                    <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{prod.nombre.length}/80</span>
                                </div>
                                <button onClick={orbiAsistir} disabled={orbiGen} style={{ background: 'none', border: 'none', color: '#8B5CF6', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                    {orbiGen ? <>Generando…</> : <><Sparkles size={13} /> Generar con Orbi</>}
                                </button>
                            </div>
```

- [ ] **Step 4: Sacar el botón viejo de al lado de la descripción**

Ubicar el bloque de la descripción (línea ~723-732):

```tsx
                            <div style={{ marginBottom: 18 }}>
                                <label style={lbl}>Descripción</label>
                                <textarea value={prod.descripcion} onChange={e => set('descripcion', e.target.value.slice(0, 2000))} rows={5} style={{ ...inputBase, width: '100%', resize: 'vertical', minHeight: 110, padding: '10px 12px', fontSize: 14, lineHeight: 1.6 }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                                    <button onClick={orbiDesc} disabled={orbiGen} style={{ background: 'none', border: 'none', color: '#8B5CF6', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        {orbiGen ? <>Generando…</> : <><Sparkles size={13} /> Generar descripción con Orbi</>}
                                    </button>
                                    <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{prod.descripcion.length}/2000</span>
                                </div>
                            </div>
```

Reemplazar por (queda solo el contador, el botón ya se movió):

```tsx
                            <div style={{ marginBottom: 18 }}>
                                <label style={lbl}>Descripción</label>
                                <textarea value={prod.descripcion} onChange={e => set('descripcion', e.target.value.slice(0, 2000))} rows={5} style={{ ...inputBase, width: '100%', resize: 'vertical', minHeight: 110, padding: '10px 12px', fontSize: 14, lineHeight: 1.6 }} />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                                    <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{prod.descripcion.length}/2000</span>
                                </div>
                            </div>
```

- [ ] **Step 5: Verificar que compila sin errores nuevos**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "ProductoNuevo.tsx"`
Expected: sin salida.

- [ ] **Step 6: Verificación manual en el navegador**

1. Levantar el backend (`cd apps/api && npm run start:dev`) y el frontend (`cd apps/web && npm run dev`), con `GROQ_API_KEY` configurada en `apps/api/.env`.
2. Ir al wizard de "Crear producto", escribir un nombre reconocible (ej. "iPhone 13 Pro Max") sin tocar categoría ni etiquetas.
3. Click en "Generar con Orbi" (ahora debajo del campo Nombre).
4. Confirmar: la descripción se llena y puede mencionar specs reales (capacidad, chip, pantalla); si el negocio tiene una categoría de electrónica/celulares, queda autoseleccionada; aparecen etiquetas sugeridas como chips.
5. Repetir con una categoría ya elegida a mano y alguna etiqueta ya cargada: confirmar que el click NO cambia la categoría elegida y NO borra ni duplica la etiqueta ya cargada, solo suma las nuevas.
6. Revisar la consola del navegador y la network tab: la request va a `POST /products/ai-assist`, sin errores 4xx/5xx inesperados.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/ventas/panel/catalogo/ProductoNuevo.tsx
git commit -m "feat(productos): boton Generar con Orbi autocompleta categoria y sugiere etiquetas"
```
