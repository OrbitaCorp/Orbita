# Orbi — Base de conocimiento: el manual como fuente única

**Fecha:** 2026-09-30
**Estado:** Borrador para revisión
**Estudio de origen:** [Orbi en el panel — estudio preliminar](https://claude.ai/code/artifact/bc83b3c9-001c-4322-b61e-afd94c273e1f), sección "Base de conocimiento" (fase 6 del plan).
**Depende de:** [Fase 1 — arreglar la base](2026-09-30-orbi-fase-1-base-design.md) (permisos reales, `navigateTo` con links que existen).

---

## 1. Decisión: sin grafo de conocimiento

Se evaluó usar un grafo (al estilo de Graphify, o GraphRAG) como base de lo que Orbi sabe
del sistema. **Se descarta.** Hubo tres investigaciones y una revisión escéptica:

- **El corpus es chico.** El manual (`apps/web/src/modules/ventas/panel/manual/contenido.ts`)
  tiene 13 capítulos y 61 temas, unos 32 mil caracteres de texto (del orden de 8 a 11 mil
  tokens). Un índice de los 61 títulos ocupa unos 580 tokens. Con ese tamaño, un grafo no
  ahorra nada.
- **Las preguntas de ayuda son de un solo dato** ("¿cómo hago X?"). En ese tipo de pregunta,
  los benchmarks publicados dan ventaja al RAG común sobre GraphRAG
  ([arXiv 2502.11371](https://arxiv.org/html/2502.11371),
  [GraphRAG-Bench](https://arxiv.org/html/2506.05690)). Son benchmarks de dominio abierto:
  es una analogía, no una medición sobre este manual. El argumento de fondo es el tamaño y
  el mantenimiento.
- **Un grafo armado por un modelo inventa aristas** y hay que reconstruirlo en cada cambio
  ([LinearRAG](https://arxiv.org/html/2510.10114v4), [arXiv 2603.14828](https://arxiv.org/abs/2603.14828)).
- **Ninguno de los asistentes relevados usa grafos** para esto: Intercom Fin, Kapa.ai,
  Mintlify, Notion AI, Stripe y Cloudflare usan contenido estructurado con búsqueda, y citan
  la fuente.
- **Las preguntas que parecen "de grafo" dependen del estado real del negocio.** "¿Qué me
  falta para publicar?" o "¿por qué mi empleado no ve los cupones?" no se contestan con la
  documentación sino con datos: se resuelven con dos tools deterministas que leen ese estado.
- **El grafo de Graphify del repo no sirve para Orbi.** Es de código (AST), está lleno de
  nombres internos, no tiene los 61 temas como nodos y estaba desactualizado (119 commits de
  atraso al 30/09). Una consulta de prueba sobre cupones devolvió 440 nodos sin la respuesta.
  Sigue siendo útil para el equipo (ver 3.8).

**Cuándo reconsiderarlo:** si el corpus pasa de unos 300 a 500 documentos (por ejemplo, al
sumar tickets de soporte), o para analítica interna sobre miles de conversaciones ("¿qué
confunde más por rubro?").

## 2. Qué se construye

| # | Pieza | Qué resuelve |
|---|---|---|
| 1 | Manual separado de su presentación + `manual.generated.json` dentro de `apps/api` | La API puede leer el manual (hoy no: `contenido.ts` importa íconos) |
| 2 | Índice de temas en el prompt + tool `leerTemaDelManual` | "¿Cómo hago X?" respondido desde el manual, con cita y botón "Ir a…" |
| 3 | Tool `estadoPrimerosPasos` | "¿Qué me falta para publicar?" con el estado real |
| 4 | Tool `accesoDelEquipo` | "¿Por qué mi empleado no ve X?" con los roles reales |
| 5 | Reglas del prompt: responder solo desde el manual; nada de nombres internos | Que no invente pasos ni repita `PENDING` o `listCustomers` |
| 6 | Contenido que falta: qué no hace Órbita, soporte, módulos sin cubrir; arreglar los desfases actuales | Que el manual sea completo y verdadero |
| 7 | Mantenimiento automático en capas: tipos, artefacto con chequeo en CI, tests de contrato, avisos de Claude Code, señal de producción | Que no se desactualice |
| 8 | Evals del panel para decidir entre índice + tool y manual entero | Elegir con datos |

**Fuera de alcance:** búsqueda vectorial o híbrida (no hace falta con 61 temas), MCP o
`llms.txt` público (sirven a agentes externos, otro objetivo), un agente que redacte el
manual solo (más adelante, siempre con revisión humana).

## 3. Diseño

### 3.1 Separar el manual de su presentación

`contenido.ts` mezcla texto con presentación: importa `lucide-react` y las ilustraciones
(`contenido.ts:24-29`), así que no se puede ejecutar fuera del navegador. Se separa:

- `contenido.ts` queda como **datos puros**: capítulos, temas, bloques, destinos. Los íconos
  y las ilustraciones pasan a referenciarse por id (un string), y el mapa id → componente
  vive en `Manual.tsx` o en un archivo de presentación aparte.
- El texto plano de cada tema ya tiene su función (`textoPlano`, `contenido.ts:870`); se
  reusa.

### 3.2 El artefacto que lee la API

La imagen de Cloud Run se construye solo con `apps/api` (`deploy.sh:250-256`), así que la
API no puede leer `apps/web` ni en el build ni en producción. El manual llega como un
archivo generado y **commiteado** dentro de la API:

`apps/api/src/orbi/manual/manual.generated.json`

```json
{
  "version": "<sha256 del contenido>",
  "temas": [
    {
      "id": "cfg-envios",
      "capitulo": "Configuración",
      "titulo": "Envíos",
      "texto": "…texto plano, con los [[botones]] como texto normal…",
      "destino": { "seccion": "configuracion", "vista": "envios" }
    }
  ],
  "primerosPasos": [ { "id": "…", "titulo": "…", "destino": { … } } ],
  "permisosPorModulo": { "descuentos": ["discounts.view"], "…": [] }
}
```

- `primerosPasos` sale de `TAREAS_CHECKLIST` y `TAREAS_CHECKLIST_ETAPA2`
  (`tutoriales/copy.ts:196` y `:295`), con la etapa de cada tarea. `permisosPorModulo` sale
  de `PERMISOS_MODULO` del menú lateral (`Sidebar.tsx:97-106`). Los dos viven en el front y las tools de
  3.4 los necesitan.
- **Generador:** un script en `apps/web` (`pnpm manual:generar`) que importa los datos puros
  y escribe el JSON. `pnpm manual:check` lo regenera en memoria y falla si difiere del
  commiteado.
- Los textos del JSON usan solo los nombres que ve la persona (etiquetas de la pantalla), no
  identificadores del código.

### 3.3 Cómo lo usa Orbi

**Índice en el prompt.** Una capa nueva con los 61 temas (`id · título`, agrupados por
capítulo), unos 580 tokens. Se suma en `ContextBuilderService.buildSystemPrompt`
(`context-builder.service.ts:18`) **después de `CORE_PROMPT` y antes de la capa del panel**:
así el prefijo del prompt es igual para todos los negocios. Hoy la capa del panel arranca con
el nombre y el rubro del negocio (`panelBase`, `panel.ts:202-207`), y todo lo que viene
después ya no se puede compartir entre negocios. El índice solo
no llega al mínimo de 4.096 tokens de la caché implícita de Gemini, pero cuesta poco. Si las
evals eligen el manual entero (3.7), el orden importa todavía más.

**Tool `leerTemaDelManual({ ids: string[] })`**, hasta 3 ids por llamada, solo lectura, sin
permiso (el manual es el mismo para todos los miembros):

- Devuelve, por tema: título, texto y destino, con la ruta ya armada con el mismo
  constructor que `navigateTo` (fase 1), para que el front muestre el botón "Ir a…".
- Un id inexistente se informa como "tema no encontrado" y se registra (señal de 3.6).

**Reglas del prompt** (reemplazan la instrucción de `panel.ts:368`, "explicá los pasos para
hacerlo manualmente", que empuja a inventar pasos):

- Para "¿cómo hago X?" o "¿dónde está X?": leé el tema y respondé desde ahí, con el botón al
  destino. No inventes pasos, nombres de botones ni pantallas.
- Si ningún tema lo cubre, decilo ("eso no está en el manual") y ofrecé contactar a soporte.
- Nunca nombres estados, campos o funciones internas: usá las palabras de la pantalla.

Si más adelante las evals muestran fallas de vocabulario (la persona dice "delivery" y el
tema dice "envíos"), se suma `buscarEnManual(texto)`: búsqueda por palabras en memoria sobre
los 61 temas, portando la que ya usa el front (`Manual.tsx:89`). Sin base vectorial.

### 3.4 Tools de estado

**`estadoPrimerosPasos()`**, solo lectura, sin permiso (devuelve booleanos y títulos, nada
sensible):

- Reusa el cálculo de tareas cumplidas del checklist (`businesses.service.ts:153-185`) y los
  títulos y destinos de `primerosPasos` del JSON.
- Distingue el **único bloqueante real** para publicar, la suscripción
  (`businesses.service.ts:272-283`), de las recomendaciones (los demás pasos).
- Respuesta tipo: "Para publicar te falta activar la suscripción. Además te recomiendo
  configurar envíos (Ir a Envíos)."

**`accesoDelEquipo({ persona?: string })`**, solo lectura:

- Sin `persona`, habla de quien pregunta, con los permisos de su JWT.
- Con `persona` (nombre de un miembro), exige "Ver equipo" (`config.team.view`); el
  propietario pasa siempre, como en `PermissionsGuard`. Lee el rol **real** del miembro en
  la base (los roles se pueden editar: describir los roles por defecto daría respuestas
  falsas).
- Cruza esos permisos con `permisosPorModulo` y devuelve qué secciones ve y cuáles no, con
  las etiquetas en español del catálogo ("le falta 'Ver descuentos'").
- La explicación general ("no es un error: es su rol, se cambia en Configuración → Equipo")
  ya está en el tema `permisos` del manual; la tool aporta el dato preciso.

### 3.5 Contenido

**Arreglar los desfases que ya existen** (encontrados buscando cada `[[botón]]` en el código):

- `contenido.ts:405` nombra `[[+ Agregar característica]]`; el botón real dice "Agregar
  especificación" (`ProductoNuevo.tsx:2604`).
- `contenido.ts:406` explica `[[Ver más detalles →]]`, un link que se sacó el 29/09.

**Reescribir `prompts/knowledge/*.knowledge.ts`** con las palabras de la pantalla: hoy usan
`PENDING`, `CONFIRMED`, `PUBLISHED`, `DRAFT`, `comparePrice` y nombres de tools, y Orbi
puede repetírselos a la persona. Quedan como criterio de consultor ("un pedido pendiente de
más de 24 horas es urgente"), no como manual.

**Capítulos que faltan** (en el manual, visibles también para las personas):

- **Qué no hace Órbita hoy**, para que Orbi no invente funciones.
- **Soporte:** cómo contactar al equipo.
- **Módulos sin cubrir:** Avanzado y Turnos, y lo que sume cada release.
- **Quiénes somos y planes:** depende de la pregunta abierta del estudio ("¿qué puede contar
  Orbi sobre Órbita?"). Hasta que se decida, no entra.

El texto lo redacta Claude contra el código y lo revisa Alan antes de publicarse.

### 3.6 Mantenimiento automático, en capas

Lo automatizable es **detectar** que el manual quedó viejo; el texto para personas no se
genera solo. De más dura a más blanda:

**Capa 0 — Tipos.** `Destino.seccion` se tipa como clave de las secciones del panel (la
constante `SECCIONES_DEL_PANEL` de la fase 1) y `vista` como `VistaConfig`
(`ConfigTabs.tsx:17`). Un renombre de sección rompe el typecheck que CI ya corre.

**Capa 1 — Artefacto con chequeo.** `pnpm manual:check` en el job `web` de CI (sin cambiarle
el nombre al check): si alguien cambia el manual y no regenera el JSON, CI falla.

**Capa 2 — Tests de contrato** (vitest en `apps/web`, que la fase 1 suma a CI; jest en
`apps/api`, que además corre en el preflight de `deploy.sh`):

- Cada `[[botón]]` del manual existe como texto literal en `apps/web/src` (fuera del propio
  manual). Esto habría atrapado los dos desfases de 3.5.
- Cada destino existe entre las secciones del panel; los ids de tema no se repiten.
- El JSON generado y la salida de las tools nuevas no contienen identificadores internos
  (valores en mayúsculas tipo enum, nombres de funciones en camelCase, rutas de archivos).
  No se aplica a las instrucciones del prompt, que nombran tools a propósito.
- El catálogo de permisos de `seed.ts` coincide con el de la API.

**Capa 3 — Avisos de Claude Code** (baratos, pero no obligatorios):

- `.claude/rules/manual.md` con `paths:` sobre `apps/web/src/modules/ventas/panel/**`,
  `Sidebar.tsx` y `apps/api/src/orbi/tools/**`: solo se carga cuando se tocan esos archivos.
- Hook `PostToolUse` en `.claude/settings.json` (compartido), con `matcher: "Edit|Write"` y
  filtro de ruta a las pantallas del panel, que devuelve `additionalContext`: "Tocaste una
  pantalla del panel: revisá el tema del manual que la explica y corré `pnpm manual:check`".
  Con `${CLAUDE_PROJECT_DIR}`, no rutas absolutas.
- Una línea en el `CLAUDE.md` raíz como recordatorio.

La prueba de que una regla en CLAUDE.md sola no alcanza es Graphify mismo: el CLAUDE.md pide
`graphify update` después de cada cambio y el grafo tenía 119 commits de atraso.

**Capa 4 — Señal de producción.** Se registran los "tema no encontrado" de
`leerTemaDelManual` y las respuestas con pulgar abajo: son el backlog de temas que faltan.

### 3.7 Decidir con evals

La suite de evals actual solo cubre el wizard (`test/evals/run.ts`). Esta fase suma un set del
panel, que es parte de la fase 2 del plan ("Medir"):

- Unas 30 preguntas del manual con el tema esperado ("¿cómo hago un cupón de envío gratis?"
  → tema de cupones). Chequeo determinista: ¿leyó el tema correcto?, ¿el botón lleva a la
  sección correcta?
- Unas 10 preguntas que no están en el manual. Chequeo: ¿dijo que no está, sin inventar?
- Casos de las dos tools de estado sobre la base de prueba.

Con ese set se comparan dos variantes: **índice + `leerTemaDelManual`** (default) contra
**manual entero en el prompt** (antes de los datos del negocio, para que la caché aplique).
Gana la de mejor resultado; a igual resultado, la más barata por turno.

### 3.8 Graphify, para el equipo

Graphify queda como herramienta de los agentes de código, nunca como entrada de Orbi. Sirve
para análisis de impacto ("toqué `ProductoNuevo.tsx`, ¿qué temas del manual reviso?"),
siempre que esté al día. Instalar su hook de git (post-commit, sin modelo ni costo) y
corregir la ruta absoluta del hook de `.claude/settings.json` es una tarea aparte.

## 4. Seguridad

- El manual no es secreto, pero no puede tener nombres internos (capa 2).
- `accesoDelEquipo` sobre otra persona exige "Ver equipo"; sobre uno mismo, solo usa el JWT.
- `estadoPrimerosPasos` devuelve booleanos y títulos, nada de configuración sensible.
- Las tools nuevas son de solo lectura y entran en la lista explícita de solo lectura de la
  fase 1.

## 5. Tests

- **Web (vitest):** generador (un tema produce su entrada; los botones quedan como texto);
  contratos de la capa 2.
- **API (jest):** `leerTemaDelManual` (hasta 3 ids, id inexistente registrado, ruta del
  destino armada con el constructor de la fase 1); `estadoPrimerosPasos` (bloqueante contra
  recomendación); `accesoDelEquipo` (sin "Ver equipo" no responde sobre otra persona; el
  propietario pasa; rol editado se refleja); el prompt tiene el índice antes de los datos del
  negocio; el JSON no tiene identificadores internos.
- **Evals** (3.7), a mano, porque llaman al modelo.

## 6. Despliegue

Cambia `apps/web` (manual, generador, tests) y `apps/api` (JSON, tools, prompt), sin
migraciones. Mismo orden que el resto: `main` con CI verde y después `deploy.sh`.

## 7. Decisiones tomadas en este spec

| Decisión | Por qué |
|---|---|
| Sin grafo de conocimiento | Corpus chico, preguntas de un solo dato, costo de mantenerlo; nadie lo usa para esto |
| El manual es la fuente única y se lee desde un JSON commiteado en `apps/api` | La imagen de la API no ve `apps/web` |
| Índice + `leerTemaDelManual` por default, decidido después con evals | Menos distractores; el manual entero queda como alternativa medida |
| Dos tools de estado en vez de un grafo de requisitos | Las preguntas de "por qué no puedo" dependen de datos reales y editables |
| Sin búsqueda vectorial | 61 temas; se suma búsqueda por palabras solo si las evals lo piden |
| Quiénes somos y planes, pendiente | Depende de qué puede contar Orbi sobre Órbita |
| Mantenimiento con barreras en CI, no solo reglas | Una regla en CLAUDE.md sola no se cumple (el caso de Graphify) |
