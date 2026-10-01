# Plan — Orbi: el manual como fuente única (fase 6)

**Spec:** [2026-09-30-orbi-base-de-conocimiento-design.md](../specs/2026-09-30-orbi-base-de-conocimiento-design.md)
**Evals:** [2026-10-01-orbi-fase-2-evals-panel-design.md](../specs/2026-10-01-orbi-fase-2-evals-panel-design.md)
**Fecha:** 2026-10-01 · **Rama:** `claude/awesome-cannon-s749lf`

## Correcciones al spec que salieron de verificarlo contra el código

| Spec | Código real | Qué hace este plan |
|---|---|---|
| §3.1 "separar `contenido.ts` de sus íconos": no se puede ejecutar fuera del navegador | vitest (entorno node) importa TypeScript y `lucide-react` sin DOM; los imports de ilustraciones son `import type` | **No se separa.** El generador es un test de vitest que importa `contenido.ts` tal cual. Cero cambios en la presentación del manual |
| §3.2 `manual.generated.json` | La API compila con `tsc`/`nest build`: un `.json` no se copia a `dist/` sin tocar `nest-cli.json` ni `resolveJsonModule` | El artefacto es **`manual.generated.ts`** (un objeto tipado), mismo contenido. Se genera con `toMatchFileSnapshot` de vitest: `pnpm manual:generar` (= `vitest run -u` sobre ese test) lo escribe, y `pnpm test` (que CI ya corre) falla si quedó viejo |
| §3.6 capa 1: `pnpm manual:check` en CI | Tocar `.github/workflows/` choca con el scope del token (trampa conocida) | No hace falta: el chequeo es parte de `pnpm test` del job `web`, que ya existe con el nombre de check que exige el deploy |
| §3.6 capa 0: `vista` tipada como `VistaConfig` | El manual tiene destinos con `?vista=` **fuera** de Configuración: `pedidos?vista=nuevo|historial|devoluciones`, `catalogo?vista=nuevo`, `descuentos?vista=metricas`, `mensajes?vista=plantillas` (y las pantallas las leen de verdad: `PedidoLista.tsx`, `ProductoLista.tsx`, `DescuentosShell.tsx`, `Bandeja.tsx`) | Contrato por sección: la vista de un destino tiene que aparecer como literal en el código de esa sección. `navigateTo` **no se toca** (sigue aceptando vista solo en Configuración): cambiar su schema cambia lo que ve el modelo y se mide aparte |
| §3.2 `permisosPorModulo` sale de `Sidebar.tsx:97-106` | `PERMISOS_MODULO` vive dentro de un componente con hooks e imports de Next | Se mueve a `src/layouts/components/permisosDelMenu.ts` (puro), con la etiqueta de cada módulo; Sidebar lo importa. Un test compara las etiquetas contra `MODULOS` de Sidebar |
| §3.4 `estadoPrimerosPasos` "reusa el cálculo del checklist" | Existe como `BusinessesService.getTutorial(businessId)` → `{ cumplidas }`, ya inyectado en `OrbiModule` | Se llama a ese método; el bloqueante (suscripción) se lee con un `subscription.findUnique` acotado al negocio, igual que `publish()` |

## Tareas

Cada tarea deja la rama compilando y con tests verdes. Orden: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

### 1. Web: el manual se corrige y se vuelve contrato (vitest)

Archivos: `apps/web/src/modules/ventas/panel/manual/contenido.ts`,
`apps/web/src/modules/ventas/panel/manual/contrato.test.ts` (nuevo).

- Arreglar los dos desfases (§3.5): `[[+ Agregar característica]]` → el texto real del botón en
  `ProductoNuevo.tsx`; sacar la frase del link `[[Ver más detalles →]]` que ya no existe (verificar
  primero que de verdad no exista).
- `contrato.test.ts`:
  - Ids de tema únicos (y no chocan con ids de capítulo).
  - Cada `[[botón]]` existe como texto literal en `apps/web/src` **fuera** de `manual/` (se busca el
    texto sin espacios de más, también partido por `|` cuando el manual nombra dos estados de un
    mismo botón).
  - Cada destino (`ir`) apunta a una sección de `SECCIONES_DEL_PANEL`; si trae `vista`, en
  Configuración tiene que estar en `VISTAS_DE_CONFIGURACION`, y en otra sección tiene que aparecer
  como literal `'<vista>'` en el código de esa sección.
  - Ningún texto tiene identificadores internos: valores tipo enum (`PENDING`, `OUT_OF_STOCK`…),
    nombres de funciones en camelCase, rutas de archivo.

### 2. Web: el generador del artefacto para la API

Archivos: `apps/web/src/layouts/components/permisosDelMenu.ts` (nuevo),
`apps/web/src/layouts/components/Sidebar.tsx`,
`apps/web/src/modules/ventas/panel/manual/paraOrbi.ts` (nuevo, puro),
`apps/web/src/modules/ventas/panel/manual/paraOrbi.test.ts` (nuevo),
`apps/web/package.json` (`manual:generar`).

- `permisosDelMenu.ts`: `MODULOS_DEL_MENU = [{ id, label, permisos }]` y `PERMISOS_MODULO` derivado.
  Sidebar importa `PERMISOS_MODULO` de ahí (mismo comportamiento). Test: labels iguales a `MODULOS`.
- `paraOrbi.ts`: `armarManualParaOrbi()` → `{ version, temas, primerosPasos, modulosDelMenu }`:
  - `temas[]`: `{ id, capitulo, titulo, texto, destino?: { seccion, vista?, label } }`. Texto plano
    legible: párrafos, `- ` para listas, `1. Título: texto` para pasos, `Etiqueta: texto` para
    campos y estados, `Tip:`/`Ojo:`/`Dato:` para notas. `**negrita**` se va; `[[Botón]]` queda como
    `"Botón"` (comillas: el nombre exacto del botón). Un tema sin `ir` hereda el del capítulo.
  - `primerosPasos[]`: de `TAREAS_CHECKLIST` (etapa 1) y `TAREAS_CHECKLIST_ETAPA2` (etapa 2):
    `{ id, titulo, etapa, grupo?, destino: { seccion, vista?, label } }`.
  - `modulosDelMenu[]`: de `MODULOS_DEL_MENU`.
  - `version`: sha256 del resto.
  - `aArchivoTs()`: el `.ts` con cabecera "GENERADO, no editar".
- `paraOrbi.test.ts`: `expect(aArchivoTs(...)).toMatchFileSnapshot('../../../../../../api/src/orbi/manual/manual.generated.ts')`,
  más tests del render (un tema produce su entrada; los botones quedan entre comillas; sin `**`).
- `"manual:generar": "vitest run src/modules/ventas/panel/manual/paraOrbi.test.ts -u"`.

### 3. API: el manual adentro de la API

Archivos: `apps/api/src/orbi/manual/manual.types.ts`, `manual.generated.ts` (generado),
`manual.ts` (índice y búsqueda), `apps/api/src/orbi/navegacion/ruta.ts` (constructor de rutas
compartido con `navigateTo`), tests.

- `ruta.ts`: `rutaDelPanel(seccion, vista?)` → `/admin/ventas/<seccion>[?vista=<vista>]`.
  `NavigationTool` pasa a usarlo (misma salida, sus tests no cambian).
- `manual.ts`: `temaDelManual(id)`, `indiceDelManual()` (texto del índice agrupado por capítulo,
  `id · título`, ~600 tokens).
- Tests (jest, `src/orbi/manual/manual.spec.ts`): cada destino del artefacto es una sección real
  (`SECCIONES_DEL_PANEL`); ningún texto con identificadores internos; ids únicos; los permisos de
  `modulosDelMenu` existen en `CODIGOS_DEL_CATALOGO`.
- Test (jest unit, `test/unit/permisos-catalogo-seed.unit-spec.ts`): el catálogo de `prisma/seed.ts`
  coincide con `src/common/permisos/catalogo.ts` (§3.6 capa 2).

### 4. API: índice en el prompt y reglas del manual

Archivos: `apps/api/src/orbi/prompts/manual.ts` (capa nueva), `context-builder.service.ts`,
`prompts/panel.ts`.

- Capa nueva **entre `CORE_PROMPT` y la capa del panel** (el prefijo queda igual para todos los
  negocios: caché implícita de Gemini). Solo en superficie panel.
- Reglas (reemplazan "explicá los pasos para hacerlo manualmente" de `fallbackPanel`):
  para "¿cómo hago X?" o "¿dónde está X?", leer el tema con `leerTemaDelManual` y responder desde
  ahí; no inventar pasos, botones ni pantallas; si ningún tema lo cubre, decirlo y ofrecer Soporte;
  usar las palabras de la pantalla, nunca nombres internos.
- Tests en `context-builder.spec.ts`: la capa está en el panel y no en el wizard, y va antes del
  nombre del negocio.

### 5. API: tool `leerTemaDelManual`

Archivo: `apps/api/src/orbi/tools/definitions/manual.tools.ts` (+ spec).

- `{ ids: string[] }`, hasta 3, solo lectura, sin permiso, superficie panel.
- Devuelve `{ temas: [{ id, titulo, capitulo, texto, irA? }], noEncontrados, path? }` con `path` =
  la ruta del primer destino (así el front dibuja el botón "Ir a…" que ya existe, `esNavegacion`) y
  `label` = la etiqueta del destino ("Abrir Envíos").
- Un id que no existe se informa y se loguea, saneado (`[a-z0-9-]`, 40 caracteres): señal de
  producción de §3.6 capa 4.
- Se registra en `OrbiModule` (y en las evals: `FABRICAS` de `fakes.ts` y `NOMBRES_DE_TOOLS_DEL_PANEL` de `reglas.ts`).

### 6. API: tools de estado

Archivo: `apps/api/src/orbi/tools/definitions/estado.tools.ts` (+ spec).

- `estadoPrimerosPasos()`: sin permiso (booleanos y títulos). `getTutorial` → cumplidas; suscripción
  → bloqueante; respuesta `{ publicada, bloqueante?, pendientes: [{ titulo, irA }], cumplidas: n, total }`
  con los títulos del artefacto. Las tareas que no se detectan (`herramientas`, `reportes`, `plan`,
  `verificar-email`) se informan como "no se pueden saber desde acá".
- `accesoDelEquipo({ persona? })`: sin `persona`, los permisos del JWT (los de `ctx.permissions`);
  con `persona`, exige `config.team.view` (el dueño pasa), busca el miembro por nombre **dentro del
  negocio** (`member.findMany` con `businessId`), lee su rol real con sus permisos, y devuelve qué
  módulos del menú ve y cuáles no, con la etiqueta del permiso que le falta (catálogo). Ambiguo →
  lista de nombres para que la persona elija; sin coincidencias → "no encontré".
- Las dos van en la lista de solo lectura (no `requiresConfirmation`).

### 7. API: knowledge sin nombres internos

Archivos: `apps/api/src/orbi/prompts/knowledge/*.knowledge.ts`, `prompts/panel.ts` (capa de
Descuentos, que enumera `PERCENT_PRODUCT`… como texto).

- Reescribir con las palabras de la pantalla. Quedan como criterio de consultor.
- Test: ningún knowledge ni capa del panel tiene valores tipo enum fuera de los nombres de tools.

### 8. Evals y mantenimiento

- Evals: registrar las tools nuevas en `fakes.ts` (fakes de `getTutorial`, `subscription`,
  `member`), casos de `estado`, y la variante `manual-entero` (manual completo en el prompt, sin
  `leerTemaDelManual`).
- `.claude/rules/manual.md` (con `paths:`) y una línea en el `CLAUDE.md` raíz (§3.6 capa 3). El hook
  `PostToolUse` de `.claude/settings.json` **se deja propuesto, no aplicado**: cambia la
  configuración compartida de todo el equipo y conviene que lo apruebe Alan.

## Fuera de este plan

- Capítulos nuevos del manual ("Qué no hace Órbita hoy", "Quiénes somos y planes"): son contenido
  para clientes. "Quiénes somos y planes" depende de una pregunta abierta. "Qué no hace" se deja
  redactado como propuesta en el HANDOFF, no en el manual publicado.
- `buscarEnManual` (búsqueda por palabras): solo si las evals muestran fallas de vocabulario.
- Elegir entre índice + tool y manual entero: con las evals corridas por Alan (sin key en esta
  sesión). Por defecto queda índice + tool, como dice el spec.
