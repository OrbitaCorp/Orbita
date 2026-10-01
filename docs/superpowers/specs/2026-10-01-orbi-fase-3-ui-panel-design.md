# Orbi — Fase 3: el nuevo Orbi del panel (sesiones, stream con pensamiento, vistas, input)

**Fecha:** 2026-10-01
**Estado:** Borrador **para revisión de Alan. No implementar sin aprobación** (regla del HANDOFF §8).
**Estudio de origen:** [Orbi en el panel — estudio preliminar](https://claude.ai/code/artifact/bc83b3c9-001c-4322-b61e-afd94c273e1f),
secciones "Interfaz: vistas y sesiones", "El input", "El chat…", "Qué cambia en el backend".
**Depende de:** fase 1 (en producción), fase 2 (evals, en la rama), fase 6 (manual, en la rama).
**Diseño:** skill `ui-ux-pro-max` (ver §9 para qué se tomó y qué se descartó de ella).

---

## 1. Qué entra y qué no

Del plan del estudio, la fase 3 es: **sesiones (datos y endpoints), stream nuevo con pensamiento y
actividad, módulo nuevo del front con las tres vistas, input nuevo, mensajes por partes y
accesibilidad.** El wizard queda como está.

| Entra | Queda para su fase |
|---|---|
| Sesiones: lista, nueva, abrir, renombrar, fijar, archivar, borrar; título automático | Uso en % y dashboard por miembro (fase 5) |
| Stream v2: narración en español, actividad por tool, texto en vivo, ping | Los cuatro modos aplicados en el servidor, riesgo por tool, auditoría y deshacer (fase 4) |
| Mensajes por partes (pensamiento, actividad, tarjetas, respuesta) | Tarjeta completa con "Ver completo", Editar y "no volver a preguntar" (fase 4) |
| Vistas: lateral que empuja, superpuesta, hoja en el celular, página dedicada | @menciones y su búsqueda (fase 7) |
| Input nuevo: autoalto, Detener, chip de contexto, prompts sugeridos por pantalla | Cola de tareas con plan y progreso (fase 8) |
| Accesibilidad completa | Router de modelos (fase 9) |
| Motor de turno compartido con las evals | |

**Decisión que este spec propone (provisoria):** el selector de modos **no se muestra en la fase
3**. Hoy el servidor solo sabe "Preguntarme antes"; un selector que no cambia nada es peor que no
tenerlo. Entra con la fase 4, que es la que lo aplica en el servidor.

## 2. Principios

1. **Lo que se ve sale del servidor.** Cada parte del mensaje (pensamiento, actividad, tarjeta) la
   emite el stream y se guarda en la sesión: al volver a una sesión se ve todo lo que pasó, no solo
   el texto (estudio, "Sesiones").
2. **No invasivo.** Orbi nunca se abre solo, recuerda la última vista de cada persona y se abre
   con el botón de la barra o con Ctrl+K.
3. **El wizard no se toca.** El Orbi del panel es un módulo nuevo (`apps/web/src/modules/orbi/`)
   con su propio estado. Los componentes de `apps/web/src/components/orbi/` siguen sirviendo al
   wizard hasta que se decida otra cosa.
4. **Desplegable por partes y compatible.** La API se despliega aparte del front (Vercel publica
   primero). Cada paso tiene que funcionar con el front viejo y con el nuevo.
5. **Medido.** Antes de mergear: las evals del panel (fase 2) sobre el motor de turno nuevo, sin
   bajar la línea de base.

## 3. Backend

### 3.1 Motor de turno (refactor, sin cambio de comportamiento)

Hoy el loop de un turno vive dentro de `OrbiController.chat` (SSE, cuota, conversación, propuestas,
telemetría) y las evals lo replican en `test/evals/panel/motor.ts` con las piezas compartidas de
`src/orbi/turno/vuelta.ts`. El stream v2 cambia qué se emite en cada paso: si el loop sigue
duplicado, las evals miden el v1.

Se extrae `src/orbi/turno/motor-de-turno.ts`: una función que recibe el LLM, el registry, el
contexto de tools y **un emisor de eventos**, y corre el loop (vueltas, propuestas, lecturas,
corte). El controller le pasa un emisor que escribe SSE; las evals, uno que junta las partes. Se
hace primero, con los tests del controller como red (73 hoy), y recién después se cambia qué se
emite.

### 3.2 Sesiones: datos

Hoy hay una `OrbiConversation` por turno nuevo, con los mensajes en un `Json` (tope 200), sin
título, sin lista y sin índice por miembro.

**Expand/contract, todo aditivo** (regla del HANDOFF):

Release A (expand):

- `orbi_conversations` suma columnas: `title String?`, `title_auto Boolean @default(true)`,
  `pinned_at DateTime?`, `archived_at DateTime?`, `last_activity_at DateTime @default(now())`,
  `screen String?` (la pantalla desde donde se abrió), `version Int @default(1)` (1 = mensajes en el
  Json, 2 = mensajes en la tabla nueva). Índice `(business_id, user_id, archived_at,
  last_activity_at desc)`.
- Tabla nueva `orbi_messages`: `id`, `conversation_id` (FK, cascade), `business_id`, `member_id`,
  `role` (`user` | `assistant`), `parts Json` (ver §3.3), `turn_id` (FK lógica a `orbi_turns`),
  `created_at`. Índice `(conversation_id, created_at)`. **Con RLS** (lo exige
  `rls-supabase.unit-spec.ts`).
- Las sesiones nuevas nacen en `version: 2` y escriben en `orbi_messages`. Las viejas se leen del
  Json y se convierten al vuelo a partes de texto (`{ tipo: 'texto' }`): no hay backfill.

Release B (contract), **mucho después y decidido por Alan:** dejar de leer el Json de las viejas
(o migrarlas) y borrar la columna `messages`.

**El historial que va al modelo** sale de las partes `texto` de `orbi_messages` (las últimas 30,
como hoy `HISTORIAL_PANEL`). Las partes de pensamiento y actividad **no** vuelven al modelo: son
para la persona.

**Retención:** hoy las conversaciones de Orbi no se purgan nunca. Con sesiones múltiples eso crece
sin techo. Propuesta provisoria: archivadas sin actividad en 180 días se borran, con el mismo
mecanismo de `retencion-logs.service.ts`. **Pendiente de Alan.**

### 3.3 Mensajes por partes

```ts
type Parte =
  | { tipo: 'pensamiento'; texto: string }                         // la narración previa a una tool
  | { tipo: 'actividad'; id: string; tool: string; etiqueta: string;
      estado: 'en_curso' | 'ok' | 'error'; resumen?: string; ms?: number;
      destino?: { label: string; path: string } }                  // el botón "Ir a…"
  | { tipo: 'aprobacion'; actionId: string; tool: string; resumen: string }  // la tarjeta (su estado vive en orbi_pending_actions)
  | { tipo: 'texto'; texto: string }                               // la respuesta
  | { tipo: 'aviso'; codigo: 'detenido' | 'tope_de_vueltas' | 'error'; texto: string };
```

- `etiqueta` y `resumen` de la actividad son **texto para personas**, armados en el servidor por
  tool ("Buscó pedidos pendientes · 4 encontrados"). Nunca JSON ni nombres de tools. Se suma un
  `describirResultado(result)` opcional a `OrbiTool`; sin él, la etiqueta es la del catálogo
  (`FRASE_POR_TOOL` del front pasa al servidor).
- La tarjeta se guarda como referencia: su estado (pendiente, aplicada, cancelada, desconocida) se
  lee de `orbi_pending_actions` al abrir la sesión. Así una aprobación pendiente sigue vigente al
  volver (estudio), y una vencida se ve vencida.

### 3.4 Sesiones: endpoints

Todos con `@CurrentUser`, `type === 'member'`, y acotados a `businessId` **y** `memberId` del token.
Una sesión ajena o inexistente da 404 (las dos se ven igual desde afuera, como hoy
`historialSiEsPropia`). Las sesiones son privadas: el dueño **no** lee las de su equipo (decisión
tomada).

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/orbi/sesiones?archivadas=0&q=` | Lista paginada (cursor por `last_activity_at`): id, título, fijada, archivada, última actividad, pantalla, y `esperandoAprobacion` (hay acciones pendientes vigentes) |
| POST | `/orbi/sesiones` | Crea una vacía (body: `screen`) |
| GET | `/orbi/sesiones/:id` | Mensajes con sus partes y el estado actual de cada tarjeta |
| PATCH | `/orbi/sesiones/:id` | `title` (marca `title_auto: false`), `pinned`, `archived` |
| DELETE | `/orbi/sesiones/:id` | Borra la sesión y sus mensajes; las acciones pendientes de esa sesión se cancelan |

Throttle como el resto de `/orbi`. DTOs con `class-validator` (`title` hasta 80 caracteres, sin
saltos de línea).

**Título automático:** después de la primera respuesta, si `title_auto` sigue en `true`. v1
**determinista**: el primer mensaje de la persona, recortado a 60 caracteres en límite de palabra.
Pedirle el título a un modelo cuesta una llamada por sesión y suma un modo de falla; se puede
cambiar después sin tocar el contrato (llega por el evento `title`). **Provisorio.**

### 3.5 Stream v2

Endpoint nuevo `POST /orbi/panel/turno` (el `POST /orbi/chat` queda para el wizard y para las
pestañas abiertas con el front viejo). Mismo body que hoy más `sessionId`.

| Evento | Datos | Cuándo |
|---|---|---|
| `sesion` | `{ id, titulo? }` | Primero. Si no vino `sessionId` (o no es propia), una nueva |
| `pensamiento` | `{ vuelta, texto }` | Ver §3.6 |
| `actividad_inicio` | `{ id, tool, etiqueta }` | Arranca una lectura |
| `actividad_fin` | `{ id, estado, resumen, ms, destino? }` | Terminó (ok o error, siempre) |
| `aprobacion` | `{ id, actionId, tool, resumen }` | Una escritura quedó propuesta |
| `texto` | `{ vuelta, chunk }` | La respuesta, en vivo |
| `titulo` | `{ titulo }` | Después de la primera respuesta |
| `ping` | `{}` | Cada 15 s sin otro evento (el proxy de Firebase y Cloud Run cortan conexiones mudas) |
| `fin` | `{ estado: 'ok' \| 'detenido' \| 'tope_de_vueltas' }` | Último |
| `error` | `{ codigo, mensaje }` | Con código (`cuota`, `proveedor`, `interno`) para que el front sepa qué ofrecer |

Las partes se guardan al cerrar el turno (o al cortarse: lo que llegó, con el aviso `detenido`).

### 3.6 Pensamiento visible: la narración

Decisión tomada: se muestra la frase que Gemini escribe antes de llamar una tool ("Voy a buscar los
pedidos de ayer"), en español, no el razonamiento del modelo. Hoy esa frase se **descarta**: con
tools en juego el controller bufferea el texto de cada vuelta y lo tira si llega una tool call (el
bug del saludo repetido).

Problema: mientras llega el texto de una vuelta, el servidor **no sabe** si es la respuesta o una
narración; se entera cuando llega (o no) una tool call. Dos opciones:

| Opción | Cómo | Costo |
|---|---|---|
| **A (propuesta)** | Se emite `texto` en vivo. Si en esa misma vuelta llega una tool call, el servidor emite `pensamiento { vuelta, texto }` con lo que había, y el front **mueve** lo de esa vuelta de la respuesta a la línea de pensamiento | La respuesta se escribe en vivo (estudio: "vuelve a escribirse en vivo"). Un parpadeo cuando el texto pasa de respuesta a pensamiento; con movimiento reducido, sin animación |
| B | Se sigue buffereando y se emite al final de cada vuelta | Sin parpadeo, pero la respuesta llega de golpe, como hoy |

Se elige A, con dos guardas que las evals miden (casos nuevos en la fase 2):

- La narración **no puede repetir la respuesta final**. Regla de eval nueva:
  `pensamiento-no-repite-respuesta` (similitud de n-gramas entre la última narración y el texto
  final).
- La narración pasa por las mismas reglas de fugas que el texto (sin nombres de tools ni JSON).

### 3.7 Lo demás del backend

- `orbi_turns.module` guarda hoy siempre `'ventas'`: se guarda el módulo ya resuelto
  (`resolverModuloDelPanel`). Una línea.
- La cuota diaria (`daily_quota`) no cambia en esta fase; el evento de uso es de la fase 5.

## 4. Front: estructura

```
apps/web/src/modules/orbi/
  estado/        store de la sesión abierta y de la lista (zustand, como useOrbiStore)
  stream/        parser SSE v2 (puro, con tests de vitest) y reducer de partes
  api/           sesiones (GET/POST/PATCH/DELETE) con el cliente de lib/api
  vistas/        OrbiLateral, OrbiSuperpuesto, OrbiHoja, OrbiPagina (las cuatro presentaciones)
  piezas/        Encabezado, ListaDeSesiones, Mensaje, Pensamiento, FilaDeActividad,
                 TarjetaDeAprobacion (envuelve la de hoy), Respuesta, Input, PromptsSugeridos
  a11y/          anunciador (región aria-live única) y manejo de foco
```

- **Un solo estado, cuatro presentaciones.** Cambiar de vista no recarga la sesión: el store vive
  arriba de las vistas.
- La lógica pura (parser, reducer, agrupar sesiones por fecha, título recortado) con tests de
  vitest, como hoy `sesionOrbi.ts`. Los hooks con DOM no se testean en este repo (vitest en node):
  ver §10.
- Detrás de un flag: `NEXT_PUBLIC_ORBI_PANEL_V2`. Con el flag apagado, el panel sigue con el Orbi
  de hoy. **Provisorio**: si Alan prefiere un flag por negocio (para probar en su tienda en
  producción antes que el resto), hace falta un lugar donde guardarlo (no existe hoy).

## 5. Vistas

| Ancho | Vista | Comportamiento |
|---|---|---|
| ≥ 1280 px | **Lateral que empuja** | 400 px por defecto, redimensionable entre 320 y 560 con un tirador (teclado: flechas de a 16 px). El contenido del panel se corre (AdminLayout reserva el ancho), no se tapa. `role="complementary"`, no modal: no atrapa el foco |
| 768–1279 px | **Superpuesto** | Mismo panel, encima del contenido, con fondo tenue; se cierra tocando afuera o con Esc. Modal: atrapa el foco y lo devuelve al botón al cerrar |
| < 768 px | **Hoja desde abajo** | Media altura o completa (arrastre y botón). Respeta el teclado (`visualViewport`, ya resuelto en `OrbiBottomSheet` del wizard) y los bordes seguros. `overscroll-behavior: contain` |
| Cualquiera | **Página dedicada** | `/admin/ventas/orbi?vista=chat` (ver nota): lista de sesiones a la izquierda (≥ 1024 px) o arriba en un desplegable (< 1024), chat al centro con ancho de lectura (máx. 760 px). "Abrir en pestaña nueva" abre esta misma página con la sesión |

**Nota de ruta (provisoria):** el estudio decía `/admin/orbi/chat`, pero el panel resuelve
`/admin/<moduloPadre>/<seccion>` con `componentMap` tipado por `SeccionDelPanel`, y las subvistas
van por `?vista=`. `/admin/ventas/orbi?vista=chat|uso` entra sin tocar el router: se suma `orbi` a
`SECCIONES_DEL_PANEL` (y a su espejo en la API, que `navigateTo` y el test de espejo ya cubren).
La de uso (`?vista=uso`) es de la fase 5.

- Orbi **recuerda la última vista** de cada persona (`localStorage`, por miembro), nunca se abre
  solo, y se abre con el botón de la barra (también en el celular) o Ctrl+K / Cmd+K.
- **Escala de z-index** (hoy hay `40`, `199`, `200` sueltos): se define en un solo archivo —
  contenido 0, barra 40, scrim de Orbi 190, Orbi 200, toasts 300 — y la usan las cuatro vistas.

## 6. El chat

### 6.1 Encabezado

Título de la sesión (botón: abre el selector de sesiones en el lateral), **Nueva sesión**,
**Expandir a página**, **Abrir en pestaña nueva**, **Cerrar**. Espacio reservado a la derecha para
la barra de uso (fase 5) para que su llegada no mueva nada. Botones de ícono con `aria-label` y
objetivo táctil de 44 × 44 en el celular.

### 6.2 Mensaje de Orbi, por partes

Mientras trabaja, se ve todo en vivo y en orden:

1. **Pensamiento:** la narración en texto atenuado, una línea por vuelta.
2. **Actividad:** una fila por tool, con ícono de estado (en curso / ok / error), etiqueta en
   castellano, resumen y tiempo: "Buscó pedidos pendientes · 4 encontrados · 0,8 s". Si la tool
   dejó un destino, la fila tiene su botón "Ir a…".
3. **Tarjetas de aprobación:** la de hoy (`OrbiConfirmButton`), sin cambios de comportamiento en
   esta fase.
4. **Respuesta:** el texto en vivo, con el formato actual (negrita y listas; ver §11, librería de
   markdown pendiente).

Al terminar, pensamiento y actividad se pliegan en una línea que se puede abrir: "Revisó 3 cosas ·
6 s". Una respuesta cortada queda con el aviso "Detenido" (como hoy) y lo que llegó.

### 6.3 Input

- `textarea` que crece hasta 6 líneas; Enter envía, Shift+Enter baja de línea; en el celular, botón
  de enviar de 44 px.
- Mientras responde, el botón de enviar pasa a **Detener** (corta el stream; el servidor ya lo
  maneja desde la fase 1).
- **Chip de contexto** arriba del texto: "Viendo: Pedidos" (la pantalla actual), con X para
  sacarlo. Si se saca, el turno va sin `section` (el prompt cae a la capa genérica del panel).
- **Prompts sugeridos** debajo, 4 a 6 por pantalla y según permisos (tabla del estudio). Al
  tocarlos se **copian** en la caja, no se envían. v1 estáticos en el front; los que necesitan
  tools nuevas ("¿Qué me falta para vender?") ya las tienen (fase 6).
- Etiqueta accesible del campo ("Escribile a Orbi"), no solo placeholder.

### 6.4 Sesiones

- Lista agrupada por **Hoy / Ayer / Esta semana / Antes** (días de Argentina), con **fijadas**
  arriba, búsqueda por título y un filtro de **archivadas**.
- Cada fila: título, cuándo, y un punto si Orbi espera una aprobación en esa sesión.
- Acciones por fila (menú de tres puntos, accesible con teclado): renombrar, fijar, archivar,
  borrar (con confirmación: "Se borra la conversación. No se puede deshacer").
- En el lateral se cambian desde el título del encabezado; en la página, desde la columna izquierda.

## 7. Accesibilidad

- **Una sola región `aria-live="polite"`** (oculta visualmente) que anuncia estados, no tokens:
  "Orbi está respondiendo", "Respuesta lista", "Orbi necesita tu aprobación", "Se detuvo". Anunciar
  el texto que se va escribiendo haría que el lector lea cada palabra suelta.
- El historial es una lista (`role="log"` sin `aria-live` propio), navegable con el teclado; cada
  mensaje es un `article` con su autor.
- **Foco:** al abrir, va al input; al cerrar, vuelve al botón que lo abrió (`aria-controls` ya
  existe). En superpuesto y hoja (modales) el foco queda atrapado adentro; en el lateral no.
- **Teclado:** todo accesible con Tab en el orden visual; Esc cierra; el tirador del lateral se
  mueve con flechas; el menú de cada sesión, con flechas y Enter.
- **Movimiento reducido** (`prefers-reduced-motion`): sin deslizamientos, sin "tipeo", sin el
  parpadeo del texto que pasa a pensamiento, pet quieto.
- **Contraste:** los tokens del panel ya cumplen 4,5:1 para texto (los `--chip-*-fg` existen para
  texto sobre fondo tintado). El pensamiento usa `--color-muted` (#64748B sobre blanco, 4,8:1), no
  `--color-subtle`.
- Íconos SVG de `lucide-react` (los del panel), decorativos con `aria-hidden`. Sin emojis como
  íconos (hoy las alertas del snapshot usan ⚠ y 🚨 dentro del prompt, eso es otra cosa).

## 8. Seguridad

- Sesiones privadas y acotadas a negocio **y** miembro en cada endpoint; 404 indistinguible.
- El título, las etiquetas y los resúmenes se renderizan como texto (nunca HTML). El título
  automático sale del mensaje de la persona: se recorta y se limpian caracteres de control y de
  dirección (`bidi`, ya resuelto en la tarjeta en la fase 1).
- La actividad nunca muestra datos crudos de la tool (el JSON que recibe el modelo): solo el
  resumen que arma el servidor.
- Borrar una sesión cancela sus acciones pendientes: una tarjeta que ya no se ve no puede quedar
  confirmable.
- El texto de terceros sigue entrando solo por tools, como hoy. El turno "marcado por texto de
  terceros" es de la fase 4.

## 9. Lo que se tomó de `ui-ux-pro-max`

**Se tomó:** reglas de accesibilidad (región `aria-live`, foco visible, orden de tabulación,
etiquetas, 44 px táctiles), animación (150–300 ms, `ease-out` al entrar, `transform`/`opacity`,
movimiento reducido, animar 1–2 elementos por vista), escala de z-index, streaming en vivo con
pulgares, `overscroll-behavior: contain` en la hoja, y sus checklists (§12).

**Se descartó:** la paleta (verde y naranja) y la tipografía (Fira Code y Fira Sans) que propuso
para "dashboard". Orbi vive adentro de un panel con identidad propia: tokens `--color-*`
(primario `#3B82F6`, modo oscuro ya definido) y Geist. Un módulo con otra paleta y otra letra se
leería como otro producto pegado.

## 10. Tests

- **API (jest):** motor de turno (los 73 tests del controller siguen pasando sin tocarlos);
  sesiones (acotadas a negocio y miembro, 404 ajena, borrar cancela pendientes, título automático
  determinista y saneado); stream v2 (orden de eventos, `pensamiento` cuando hay tool call en la
  vuelta, `ping`, `fin` siempre, partes guardadas al cortar); RLS de `orbi_messages`; conversión de
  sesiones v1.
- **Web (vitest, lógica pura):** parser SSE v2, reducer de partes (incluido mover texto a
  pensamiento), agrupado por fecha en días de Argentina, título recortado, prompts por pantalla y
  permiso.
- **Evals:** el motor de turno compartido; regla `pensamiento-no-repite-respuesta`; las reglas de
  fugas aplicadas también a la narración.
- **Hooks con DOM y vistas:** este repo no tiene tests de componentes (vitest en node, sin DOM).
  Se propone sumar Playwright **solo** para cuatro recorridos (abrir/cerrar con foco, cambiar de
  vista sin perder la sesión, Detener, aprobar desde una sesión reabierta). Chromium ya está en el
  entorno de las sesiones de Claude. **Pendiente de Alan** (es infraestructura nueva de tests).

## 11. Preguntas abiertas (no las decide este spec)

| Pregunta | Qué propone el estudio o este spec |
|---|---|
| ¿Orbi tiene entrada propia en el menú lateral? | Sin recomendación firme; la página dedicada no la necesita |
| ¿Radix (shadcn init) y una librería de markdown? | El estudio recomienda Radix para menús y diálogos accesibles. v1 puede salir sin las dos, con el formato actual |
| Retención de sesiones | Provisorio: archivadas sin actividad en 180 días se borran |
| Ruta de la página dedicada | Provisorio: `/admin/ventas/orbi?vista=chat` |
| Flag de lanzamiento: global o por negocio | Provisorio: global por env |
| Título automático con modelo o determinista | Provisorio: determinista |
| Playwright para los recorridos de UI | Propuesto, sin decidir |
| ¿El selector de modos se muestra en la fase 3? | Propuesto: no, entra con la fase 4 |

## 12. Checklist de entrega (de la skill, adaptado)

- [ ] Sin emojis como íconos; todos de `lucide-react`.
- [ ] Todo lo clickeable con `cursor: pointer` y estado hover/focus visible, sin saltos de layout.
- [ ] Transiciones de 150–300 ms; nada animado con movimiento reducido.
- [ ] Contraste 4,5:1 en claro y oscuro (probar los dos modos).
- [ ] Sin scroll horizontal a 375, 768, 1024 y 1440 px.
- [ ] Objetivos táctiles de 44 px en el celular, con 8 px entre ellos.
- [ ] Una región `aria-live` que anuncia estados, no tokens.
- [ ] Foco al abrir, devuelto al cerrar, atrapado solo en superpuesto y hoja.
- [ ] El contenido del panel no queda tapado por el lateral ni por la hoja.
- [ ] Cambiar de vista no recarga la sesión ni pierde el texto del input.
