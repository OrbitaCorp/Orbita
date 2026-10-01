# Orbi en el panel administrativo — traspaso (dónde estamos y cómo seguir)

**Última actualización:** 2026-10-01. Escrito para que otra sesión (o un agente que trabaje solo toda la noche) retome sin el contexto de la conversación original. Leelo entero antes de tocar nada.

> Si algo de acá contradice lo que ves en el código, **manda el código**: verificá primero. Este documento es un mapa, no una fuente de verdad.

---

## 1. Qué es el proyecto

Rediseñar **Orbi**, el asistente de IA del panel administrativo de Órbita (SaaS multi-tenant para comercios), para que:

- responda dudas y **ejecute acciones** (crear pedidos, productos, cupones…) con aprobación humana;
- conozca el sistema (manual de usuario como fuente única);
- sea **seguro** (no revele ni haga nada que comprometa a otros negocios o a los dueños de Órbita);
- tenga una UI completa (sesiones, pensamiento visible, @menciones, cola de tareas, barra de uso…);
- más adelante enrute entre modelos (chico → grande) para bajar costo.

Stack: API NestJS en `apps/api` (Prisma, Postgres/Supabase, Cloud Run con deploy manual) y front Next.js 16 (pages router) en `apps/web`. **Leé el `CLAUDE.md` de la raíz y el de `apps/api` antes de nada**: explican las dos bases de datos, el flujo de commit/deploy y las reglas del repo.

## 2. Dónde está cada documento

| Qué | Dónde |
|---|---|
| Estudio preliminar completo (auditoría, benchmark, alcance, seguridad, UI, plan de 11 fases, decisiones, preguntas abiertas) | Documento de Claude: <https://claude.ai/code/artifact/bc83b3c9-001c-4322-b61e-afd94c273e1f> |
| Spec de la fase 1 (base) | `docs/superpowers/specs/2026-09-30-orbi-fase-1-base-design.md` |
| Plan de la fase 1 | `docs/superpowers/plans/2026-09-30-orbi-fase-1-base.md` |
| Spec de la base de conocimiento (manual como fuente única, sin grafo) | `docs/superpowers/specs/2026-09-30-orbi-base-de-conocimiento-design.md` |
| Specs viejos de Orbi (wizard, ai-assist, módulos) | `docs/superpowers/specs/2026-08-*` y `2026-09-0*` |
| Memoria de Claude Code (decisiones de producto) | `~/.claude/projects/C--dev-GitHub-Orbita-Frontend/memory/orbi-panel-estudio-y-decisiones.md` |

## 3. Decisiones de producto ya tomadas por Alan (no re-litigar)

- **Autonomía:** el usuario elige un modo desde el input, al estilo Claude: *Solo consultas* / *Preguntar* (default) / *Auto* / *Sin confirmaciones* (solo dueños y admins). Siempre vuelve a *Preguntar* en un turno donde Orbi leyó texto de terceros.
- **Proveedor:** solo **Gemini** (3 niveles: Flash-Lite / Flash / Pro) con router; otros modelos a futuro.
- **Usuarios:** todos los miembros, cada uno con sus permisos. Habilitar por plan, más adelante.
- **Costo:** cupo por plan, cupo aparte para el modelo grande; se muestra en **%**, nunca tokens ni USD (los usuarios no son técnicos).
- **Componentes:** **propios** inspirados en React Bits Pro. **No se compra Pro**: el repo OrbitaCorp/Orbita es público y la licencia lo prohíbe.
- **Pensamiento visible:** narración en español (la frase previa a cada acción) + actividad. No se muestra el razonamiento de Gemini (Google solo lo escribe en inglés).
- **Sesiones:** privadas de cada miembro; el dueño ve uso y auditoría, no conversaciones.
- **Base de conocimiento:** **sin grafo** (Graphify/GraphRAG descartado: 61 temas, preguntas de un solo dato). Manual como fuente única → JSON generado dentro de `apps/api`, índice + tool `leerTemaDelManual`, dos tools de estado. Graphify queda solo para el equipo de desarrollo.
- **Orbi del wizard** (alta de negocio): queda congelado; solo se tocó lo que el spec de la fase 1 pidió explícito.
- **Mockups de referencia** (React Bits Pro): input con frases sugeridas, @menciones de entidades del negocio, cola de tareas con estado y progreso, pensamiento/actividad/aprobaciones visibles como en Claude, barra de uso restante arriba a la derecha, dashboard de uso general y por miembro con filtros, sesiones (nueva, guardadas, cambiar), vistas lateral / pantalla completa / página dedicada o pestaña nueva, **totalmente responsive y poco invasivo**. Alan autorizó a cambiar por completo el panel actual de Orbi.

## 4. Estado actual (2026-10-01)

### En producción (todo lo de abajo está desplegado al 2026-10-01)
- **Fase 1 completa** (rama `feat/orbi-fase-1`, mergeada a `main`). Permisos reales en las tools; escrituras seguras (la tarjeta muestra cada valor, validación con el DTO del endpoint, demo sin propuestas); acciones pendientes y cuota diaria en Postgres (`orbi_pending_actions`, `daily_quota`); confirmar idempotente + cancelar (`POST /orbi/reject`); memoria de conversación (el servidor emite `event: conversation`); cortar respuesta (botón Detener, cierre del panel); telemetría por turno (`orbi_turns`) y metering por proveedor; botón de Orbi en el celular; `navigateTo` con links que existen; retención y purga de las tablas nuevas.
- **Hotfix** (commit `6c4bd9c3`): Gemini 3 pide tools en paralelo y solo la primera trae `thoughtSignature`; ahora las llamadas de una ronda se devuelven juntas en un solo turno (`vueltaDeTools()` en `orbi.controller.ts`). Sin esto el panel respondía "Error procesando tu mensaje".
- Migraciones aplicadas en producción: `20260930120000_orbi_fase1_base`, `20260930120100_orbi_fase1_rls`.

- **Snapshot por pantalla** (commit `8368a23e`, en `main` como parte de `3e8a8d00`): Orbi carga la capa del prompt y los datos de la pantalla en que está la persona. El front manda siempre `module: 'ventas'` y la sección real en `section`; `resolverModuloDelPanel` (`apps/api/src/orbi/navegacion/modulo-de-orbi.ts`) traduce, respetando el permiso de cada snapshot. Ojo: **los módulos pedidos, clientes, catálogo, mensajes y descuentos se activaron por primera vez** con este deploy y sus consultas corren en cada turno de esas pantallas; no hay evals del panel que los cubran, así que conviene mirar las primeras conversaciones reales. También cambió la capa del dashboard (cifras exactas, conclusión corta; se quitó un "% vs mes anterior" engañoso).
- Minors de la revisión de ese cambio: el snapshot del dashboard (mes en UTC, bruto) y `getSalesReport` (mes argentino, neto de reembolsos) pueden dar totales distintos si el modelo cita ambos; con `module='configuracion'` explícito y `section` de otra pantalla el prompt puede decir algo raro (el front real no lo manda).

### Pendientes operativos de la fase 1 (los hace Alan, no un agente)
- Confirmar **billing de Gemini** activo en el proyecto de la key `GEMINI_API_KEY` (el spec lo pedía antes del deploy).
- Correr en producción la consulta de **permisos de los roles** (owner, empleado, personalizados, admin viejos) para confirmar que tienen los códigos que ahora piden las tools. Los empleados pierden descuentos y reportes vía Orbi (intencional).
- Probar a mano que **cerrar el panel a mitad de respuesta** llega a Cloud Run a través del proxy de Firebase.
- **Comentario en Jira** con las decisiones (regla de `apps/api/CLAUDE.md`). Falta el número de ticket (¿RBT-695?).

### Cosas que sabemos que están flojas hoy (candidatas a trabajo)
- **El panel se ve pobre** comparado con los mockups: es esperable, la fase 1 fue solo base. La UI nueva es la fase 3 del estudio.
- **El resumen de tienda es flojo** (lista pedidos en vez de dar cifras; "monto aproximado"). El snapshot del dashboard (`module-data.service.ts`) no tiene ventana de 7 días, ni top de productos, ni visitas, ni zona horaria (cuenta meses en UTC); `pendingOrders` solo cuenta pendientes creados este mes; `getSalesReport` no tiene parámetro de período; `listOrders` devuelve máx. 20. Hace falta una tool/consulta de métricas por período (idealmente la "capa semántica" de la fase de análisis).
- `orbi_turns.module` guarda siempre `'ventas'` (usar el módulo traducido).
- No hay **evals del panel** (solo del wizard, `apps/api/test/evals/`), así que ningún cambio de prompt se mide. Regla acordada: **evals antes de seguir tocando prompts o modelos.**
- `listCustomers` devuelve email y teléfono (decisión de producto pendiente).
- La tarjeta de confirmación trunca textos a 80 caracteres: un texto malicioso largo se aprueba sin verse entero. Idea: "ver completo" (fase 4).
- Minors diferidos de las revisiones de la fase 1 (ninguno bloqueante): sin tests de cableado de los hooks del front (`useOrbiChat` solo tiene tests de funciones puras); `resolverAncla` con cadenas `header:a || header:b` no chequea visibilidad (`tutoriales/copy.ts`); adapters (`gemini/groq.adapter.spec`) con fixtures de args viejos de `navigateTo`; Gemini no recibe `functionCall.id` al reconstruir el historial (dos llamadas paralelas a la MISMA tool dependen solo del orden); el filtro global de excepciones copia `estado/mensaje/result` de cualquier HttpException.

## 5. Roadmap que falta (orden recomendado)

Del estudio ("Plan por fases"); **la numeración es la del estudio**. La 1 está hecha. Cada fase se despliega sola y tiene **su propio spec → plan → implementación**. Orden recomendado para lo que sigue: **2, 6, 3 (spec y plan), 4, 5, 7, 8, 9, 10, 11**.

2. **Medir.** Golden set del panel (con ataques de inyección incluidos) y línea de base con el modelo actual. Va primero: sin esto no se puede decidir nada de prompts, router ni modelo. Extender `apps/api/test/evals/` (hoy cubre solo el wizard; mirar `casos.ts`, `reglas.ts`, `run.ts`).
3. **El nuevo Orbi del panel (UI).** Sesiones (datos y endpoints; hoy hay una `OrbiConversation` por miembro sin lista ni títulos), stream nuevo con pensamiento y actividad, módulo nuevo del front con las tres vistas (lateral / pantalla completa / página dedicada), input nuevo, mensajes por partes, accesibilidad. Es la fase más grande: **escribir spec y plan primero y dejarlos para revisión de Alan antes de implementar**.
4. **Aprobaciones y modos.** Los cuatro modos aplicados en el servidor, riesgo por tool, turno marcado por texto de terceros, auditoría y deshacer, tarjeta completa (con "ver completo").
5. **Uso.** Cupo por plan en la base, barra de uso en el encabezado, dashboard por miembro.
6. **Manual como fuente / base de conocimiento.** Spec ya escrito. Falta el plan y la implementación: separar `contenido.ts` del manual de sus íconos, generar `manual.generated.json` dentro de `apps/api`, índice + `leerTemaDelManual`, tools `estadoPrimerosPasos` y `accesoDelEquipo`, chequeos de contrato en CI, arreglar los dos desfases ya encontrados del manual ("+ Agregar característica" vs "Agregar especificación", y el link "Ver más detalles →" que ya no existe). Decidir con las evals entre índice+tool y manual entero en el prompt.
7. **Menciones y prompts sugeridos.**
8. **Cola de tareas.**
9. **Router y cascada de modelos** (solo si iguala la calidad de la línea base a menor costo).
10. **Acciones por módulo** (Productos, Pedidos, Descuentos, Clientes, Mensajes).
11. **Análisis y decisiones** (capa semántica de métricas, recomendaciones, diagnóstico de configuración).

### Preguntas abiertas que **solo Alan puede contestar** (el agente no las decide)
Precio/planes y cupos por plan; si hay entrada de Orbi en el menú lateral; si "Sin confirmaciones" queda; mensajes por mes por plan y tope por miembro; orden de módulos (¿Turnos, Sucursales, caja?); si Orbi puede mandar mails a clientes; qué puede contar Orbi sobre Órbita (planes, precios, roadmap); quién mantiene el manual; si se suma Radix (shadcn init) y una librería de markdown. Donde el estudio da una recomendación, el agente puede usarla **marcándola como provisoria** en el spec; donde no, que lo deje anotado como "pendiente de Alan" y avance con lo que no depende de eso.

## 6. Cómo trabajamos (proceso que funcionó)

1. **Spec** (skill `superpowers:brainstorming`) en `docs/superpowers/specs/AAAA-MM-DD-<tema>-design.md`, con revisión adversarial contra el código (los dos specs de la fase 1 mejoraron mucho con eso).
2. **Plan** (skill `superpowers:writing-plans`) en `docs/superpowers/plans/`, con tareas chicas, archivos exactos, interfaces entre tareas y tests antes que código.
3. **Ejecución** (skill `superpowers:subagent-driven-development`): un subagente implementador por tarea, después un revisor (spec + calidad) con diff en archivo, ronda de correcciones, y una **revisión final de toda la rama** con el modelo más capaz. Un ledger de progreso en `.superpowers/sdd/<plan>/progress.md` (ignorado por git) sobrevive a la compactación de contexto. Modelos: sonnet para tareas mecánicas y revisiones chicas; opus para lo sensible (escrituras, concurrencia, seguridad).
4. Las revisiones por tarea **encontraron bugs reales** que los tests del implementador no veían (RLS faltante, `turn` del wizard perdido al cortar en `done`, envíos superpuestos sin abort, bidi en la tarjeta, pago pendiente no mostrado). No saltearlas.
5. Reportar al final con **"Rulings I made"**: toda decisión tomada en nombre de Alan, con su costo si estuviera mal.

## 7. Trampas conocidas del entorno (ahorran horas)

- **Dos bases de datos.** El `.env` local de `apps/api` es **DEV** (`hhaqlzrcskmwnvhgydon`); producción es otro proyecto (`dgergykdihtvsglfumsb`). `pnpm exec prisma migrate deploy` a secas toca dev. Producción solo con `apps/api/deploy/prisma-prod.sh` (lee Secret Manager; **no** imprimir ni pegar las URLs; no correrlo de noche).
- `prisma migrate dev` falla por drift (la base dev tiene aplicada `whatsapp_bandeja` de otra rama). Usar `prisma migrate diff ... --script`, crear la carpeta a mano y `migrate deploy` (contra dev). Toda tabla nueva **necesita RLS** (hay un test que lo exige, `rls-supabase.unit-spec.ts`).
- **Jest de la API:** `pnpm exec jest --config ./test/jest-unit.json <ruta>` o `./test/jest-src.json`; un `jest <ruta>` pelado no funciona. `pnpm test` encadena unit && src (si falla unit, no corre src). Typecheck: `pnpm typecheck`. Web: `pnpm exec tsc --noEmit` y `pnpm test` (vitest en entorno `node`: solo lógica pura, sin DOM).
- **e2e contra Postgres real** (solo DEV, nunca producción): comando documentado en `apps/api/DEPLOYMENT.md` § "Correr los e2e contra dev". El guard solo acepta la base dev.
- **CRLF:** muchos archivos del repo usan CRLF; editarlos conservándolo.
- **Gemini 3.x:** `thoughtSignature` obligatoria en la primera `functionCall` de cada turno; las paralelas van en UN turno; `includeThoughts` solo en inglés; `abortSignal` del SDK es del lado cliente (no cancela la generación en Google). Modelo vigente y gotchas en la memoria `proveedor-ia-gemini`.
- **Windows/Git Bash:** `sleep` largo en foreground está bloqueado; usar tareas en background. `gh` no tiene scope `workflow` salvo que Alan lo refresque: un push que toque `.github/workflows/` se rechaza.
- **graphify:** el repo tiene un grafo local (`graphify-out/`, ignorado) que se actualiza solo en cada commit; antes de explorar código hacer `graphify query "<pregunta>"` (regla del `CLAUDE.md`).
- El `OrbiIcon` (`apps/web/src/components/orbi/OrbiIcon.tsx`) no acepta `color`; usar `disc`.

## 8. Reglas para trabajo desatendido (agente nocturno)

**Permitido:** leer todo; trabajar en una **rama nueva local** `feat/orbi-noche-AAAAMMDD` (partir de `main` actualizado: `git fetch origin && git checkout -b ... origin/main`); commits chicos con mensajes en español y el trailer de co-autoría; escribir specs, planes, código y tests; correr typecheck, tests unitarios y el e2e **contra DEV**; aplicar migraciones **solo en DEV**; subagentes según el proceso de la sección 6.

**Prohibido (lo decide Alan):**
- `git push` de cualquier rama o de `main`, merge a `main`, `deploy.sh`, `prisma-prod.sh`, cualquier acceso a Secret Manager o a la base de producción. Un push de rama además arruina el flujo de deploy del frontend (ver `CLAUDE.md`).
- Leer, imprimir o copiar claves/URLs de bases de datos.
- Decidir las preguntas abiertas de la sección 5 (anotarlas como pendientes).
- Borrar datos o hacer cambios destructivos de schema (todo aditivo, expand/contract).
- Tocar el Orbi del wizard fuera de lo que un spec aprobado pida.
- Cambios de UI que se salten el spec: la UI nueva se diseña con la skill `ui-ux-pro-max` (regla del `CLAUDE.md`) y se deja para revisión visual de Alan.

**Costo:** las evals llaman al modelo con la key del `.env` local (cuesta plata). Correr la suite completa como máximo 2–3 veces por sesión; para iterar usar un subconjunto.

**Cuándo frenar y dejar nota** (en vez de adivinar): una decisión de producto sin respuesta en este documento; una migración que no sea puramente aditiva; un test de seguridad que haya que debilitar; tres rondas de corrección sin converger en la misma tarea; cualquier cosa que requiera credenciales que no tenga.

**Al terminar (o al frenar):** actualizar la sección 9 de este archivo (registro) y dejar una lista de "para revisar mañana" con: qué se hizo (commits), qué se decidió en nombre de Alan (rulings), qué falló o quedó a medias, y los comandos exactos que Alan debe correr para llevarlo a producción.

## 9. Registro de trabajo (agregar entradas al final, la más nueva abajo)

- **2026-10-01 (sesión de diseño e implementación de la fase 1)** — Estudio, specs y fase 1 completa en producción, hotfix de tools paralelas, fix de snapshots por sección (ver sección 4 para el estado de despliegue de este último). Siguiente paso recomendado: fase 2 (evals del panel), después la fase 6 (base de conocimiento).

---

## Anexo — Prompt listo para pegar al agente nocturno

```text
Estás retomando el rediseño de Orbi (el asistente de IA del panel administrativo de Órbita) en el repo C:\dev\GitHub\Orbita-Frontend. Trabajás solo y sin supervisión hasta la mañana.

1. Leé completo `docs/superpowers/HANDOFF-orbi-panel.md` (estado, decisiones tomadas, trampas del entorno y las reglas de la sección 8: lo prohibido es prohibido, sobre todo push, deploy y producción). Leé también `CLAUDE.md` (raíz y apps/api) y la memoria `orbi-panel-estudio-y-decisiones`.
2. Verificá el estado real: `git fetch origin`, `git log origin/main -15`, y confirmá si el commit 8368a23e (snapshots por sección) llegó a origin/main. No asumas nada del documento sin chequearlo.
3. Creá la rama local `feat/orbi-noche-<fecha de hoy>` desde origin/main.
4. Trabajá en este orden, con el proceso de la sección 6 (spec → plan → subagentes con revisión → revisión final de la rama):
   a. Fase 2, "Medir": golden set de evals del panel (preguntas del manual, consultas de datos con valores conocidos, resumen de tienda, y ataques de inyección indirecta incluidos) y la línea de base con el modelo actual. Extendé `apps/api/test/evals/`. Dejá el comando para correrla y el resultado base anotado en el spec.
   b. Fase 6, base de conocimiento: escribí el plan a partir de `docs/superpowers/specs/2026-09-30-orbi-base-de-conocimiento-design.md` e implementala completa en la rama (incluidos los chequeos de contrato y el arreglo de los desfases del manual). Usá las evals de (a) para decidir entre índice+tool y manual entero.
   c. Un tool/consulta de métricas por período para el resumen de tienda (los huecos están en la sección 4), si cabe en un cambio chico y seguro; si no, dejalo especificado.
   d. Fase 3 del estudio (el nuevo Orbi del panel: sesiones, stream con pensamiento y actividad, vistas, input): SOLO spec y plan, para revisión de Alan. Diseñá la UI con la skill `ui-ux-pro-max` y los mockups descriptos en el documento. No implementes UI sin spec aprobado.
5. No pushees, no despliegues, no toques producción ni secretos. Frená y anotá si te topás con alguna de las condiciones de "cuándo frenar".
6. Antes de terminar, actualizá la sección 9 del HANDOFF con el registro y la lista "para revisar mañana" (commits, rulings, lo que falló, y los comandos que Alan debe correr para llevarlo a producción).
```
