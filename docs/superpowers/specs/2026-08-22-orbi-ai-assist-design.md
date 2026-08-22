# Orbi — Asistente completo de producto (specs, categoría, etiquetas) — Spec de Diseño

> **Fecha:** 2026-08-22
> **Fase:** 4 (Productos)
> **Ticket:** RBT-684 — Infraestructura - Productos: Orbi asistente completo
> **Depende de:** RBT-635 (resuelto — botón de descripción con IA)

---

## Objetivo

Hoy el botón "Generar descripción con Orbi" en el wizard de alta/edición de producto
(`ProductoNuevo.tsx`) solo escribe la descripción, y necesita que el vendedor ya haya elegido
categoría y etiquetas a mano (las recibe como contexto de entrada). Además, el prompt le prohíbe
a propósito usar datos técnicos específicos que no se le dieron, así que para un producto conocido
(ej. "iPhone 13 Pro Max") nunca menciona sus especificaciones reales.

Este cambio extiende el mismo botón para que, con solo el nombre del producto, Orbi:
1. Escriba una descripción que puede incluir especificaciones técnicas reales de productos
   reconocibles (celulares, electrónica, etc.), aceptando riesgo de alucinación en esta etapa.
2. Sugiera la categoría del producto, eligiendo entre las categorías que el negocio ya tiene creadas.
3. Sugiera etiquetas, prefiriendo reusar las que el negocio ya usó antes.

Fuera de alcance de este ticket (roadmap futuro, no se diseña acá): preguntas aclaratorias cuando
Orbi no está seguro de un dato, e integración de una fuente técnica propia (RAG) para reducir
alucinación.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Forma del cambio | Un solo endpoint nuevo `POST /products/ai-assist` que reemplaza a `generate-description` | Una sola llamada a Groq en vez de tres; más barato y más rápido para el vendedor. Sin caller externo del endpoint viejo salvo el propio frontend de este repo — renombrar es seguro |
| Origen de categorías/etiquetas | El backend las resuelve él mismo vía `CategoriesService.findAll` / `TagsService.findAll` (por `businessId` del contexto de auth) | Más seguro que confiar en una lista que mande el cliente; evita que el frontend tenga que armar y sincronizar ese payload |
| Formato de respuesta de Groq | `response_format: { type: 'json_object' }` | Permite devolver `{ description, suggestedCategoryId, suggestedTags }` en un solo request, parseable de forma confiable, sin heurísticas de texto libre |
| Especificaciones técnicas | Se saca la restricción de "no inventes datos técnicos específicos" para productos reconocibles | Pedido explícito del usuario — acepta alucinación ocasional en esta etapa de desarrollo a cambio de descripciones más útiles |
| Categoría sugerida | Solo puede ser un `id` de la lista de categorías existentes del negocio, o `null` si ninguna encaja | Elegir una categoría inexistente rompería la FK; crear una categoría nueva es un flujo aparte ("Crear categoría") que no se dispara automáticamente |
| Etiquetas sugeridas | Preferentemente reusa las etiquetas ya usadas por el negocio; puede sugerir alguna nueva si hace falta | Mismo criterio que ya tiene el vendedor a mano hoy (texto libre, se crea sola al guardar) — no se introduce una restricción nueva |
| Comportamiento al ya tener datos | El botón siempre reemplaza la descripción (igual que hoy); solo autocompleta categoría si estaba vacía; solo agrega etiquetas nuevas sin duplicar ni borrar las que ya había | Evita que un click accidental pise trabajo manual del vendedor |
| Ubicación del botón | Se reposiciona cerca del campo "Nombre del producto" (afecta 3 campos, no solo descripción) | El botón ya no es solo "de descripción" |

---

## 1. Backend — `POST /products/ai-assist`

### DTO de entrada

Reemplaza a `GenerateDescriptionDto`. Ya no recibe `categoryName` ni `tags` — el backend los
resuelve él mismo.

```ts
// apps/api/src/products/dto/ai-assist.dto.ts
export class AiAssistDto {
  name!: string;               // @IsString() @MaxLength(80)
  existingDescription?: string; // @IsOptional() @IsString() @MaxLength(2000)
}
```

### Respuesta

```ts
export interface AiAssistResult {
  description: string;
  suggestedCategoryId: string | null;
  suggestedTags: string[];
}
```

### `ProductAiService.assist(businessId, dto)`

1. Resuelve `categorias = await categoriesService.findAll(businessId, true)` (flat) y
   `tags = await tagsService.findAll(businessId)`.
2. Arma el contexto para Groq: nombre, borrador existente (si hay), lista de categorías como
   `"<id>: <nombre>"`, lista de nombres de etiquetas ya usadas.
3. System prompt (nueva versión — ver Task 1 del plan para el texto completo): español rioplatense,
   tono cercano, permite especificaciones técnicas reales de productos reconocibles, prohíbe
   inventar precios o datos exclusivos del negocio, pide devolver **solo** un JSON con las 3 claves
   exactas (`description`, `suggestedCategoryId`, `suggestedTags`), aclara que `suggestedCategoryId`
   tiene que ser uno de los ids de la lista dada o `null`, y que `suggestedTags` es un array de 2 a 5
   strings cortos en minúscula.
4. Llama a Groq con `response_format: { type: 'json_object' }`, mismo modelo
   (`llama-3.1-8b-instant`), mismo manejo de errores/logging que ya existe (fix de RBT-635 del
   2026-08-22: catch tipado, log de `error.status`, 401/403 → 503).
5. Parsea la respuesta con `JSON.parse`; si falla el parseo o falta `description`, mismo error 500
   genérico que hoy. Valida `suggestedCategoryId`: si no es `null` y no está en la lista de ids
   conocidos, se descarta (`null`). Valida `suggestedTags`: filtra a strings no vacíos, recorta a
   máximo 5, dedupea sin importar mayúsculas.

### Controller

`ProductsController.generateDescription` se renombra a `aiAssist`, mismo `@RequirePermission`,
mismo `@Throttle`, misma ruta base (`POST /products/ai-assist`).

### Módulos

`CategoriesModule` y `TagsModule` no exportan hoy sus servicios (`providers` sin `exports`). Se les
agrega `exports: [CategoriesService]` / `exports: [TagsService]`, y `ProductsModule` los importa
(`imports: [CategoriesModule, TagsModule]`) para poder inyectarlos en `ProductAiService`.

---

## 2. Frontend — `ProductoNuevo.tsx`

- `apps/web/src/lib/api.ts`: `panelGenerateProductDescription` → `panelAiAssist(input: { name: string; existingDescription?: string })`, pega a `/products/ai-assist`, devuelve
  `{ description: string; suggestedCategoryId: string | null; suggestedTags: string[] }`.
- El botón "Generar descripción con Orbi" se renombra a "Generar con Orbi", se saca de al lado del
  textarea de descripción y se pone junto al campo "Nombre del producto".
- Al volver la respuesta:
  - `descripcion` se reemplaza siempre (igual que el comportamiento actual).
  - `categoriaId` se completa **solo si** `prod.categoriaId === ''`.
  - `suggestedTags` se agregan con la función `agregarTag` ya existente (que ya dedupea
    case-insensitive) — no se tocan las etiquetas que ya había.

---

## Fuera de alcance (roadmap, no se implementa en este ticket)

- Preguntas aclaratorias cuando Orbi no está seguro de un dato técnico.
- Fuente de datos técnica propia (RAG) para reducir alucinación en specs de productos poco conocidos.

Estas dos quedan anotadas en RBT-684 para retomar cuando se priorice.
