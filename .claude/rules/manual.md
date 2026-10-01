---
paths:
  - "apps/web/src/modules/ventas/panel/**"
  - "apps/web/src/layouts/components/Sidebar.tsx"
  - "apps/web/src/layouts/components/permisosDelMenu.ts"
  - "apps/api/src/orbi/tools/**"
---

# El manual del panel es lo que Orbi sabe del sistema

Tocaste una pantalla del panel, el menú o una tool de Orbi. El manual
(`apps/web/src/modules/ventas/panel/manual/contenido.ts`) es la fuente única de lo que Orbi le
contesta a la persona ("¿cómo hago X?", "¿dónde está Y?"): si la pantalla cambió y el manual no,
Orbi repite el error.

Antes de terminar:

1. Buscá el tema del manual que explica esta pantalla y corregilo si cambió un botón, una etiqueta,
   un paso o una sección. Los `[[botones]]` tienen que decir el texto exacto de la pantalla.
2. Regenerá el artefacto que lee la API: `cd apps/web && pnpm manual:generar`, y commiteá
   `apps/api/src/orbi/manual/manual.generated.ts`.
3. `cd apps/web && pnpm test`: `manual/contrato.test.ts` falla si un botón del manual no existe en
   las pantallas o un destino no abre; `manual/paraOrbi.test.ts` falla si el artefacto quedó viejo.

Si sumaste una tool de Orbi, revisá también la lista de solo lectura y el invariante 3 de
`apps/api/src/orbi/tools/tool-catalog.spec.ts`, y registrala en las evals
(su fábrica en `FABRICAS` de `apps/api/test/evals/panel/fakes.ts` y su nombre en
`NOMBRES_DE_TOOLS_DEL_PANEL` de `reglas.ts`; los tests de las evals fallan si falta alguna).
