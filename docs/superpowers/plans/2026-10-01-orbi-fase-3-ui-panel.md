# Plan — Orbi fase 3: el nuevo Orbi del panel

**Spec:** [2026-10-01-orbi-fase-3-ui-panel-design.md](../specs/2026-10-01-orbi-fase-3-ui-panel-design.md)
**Estado (2026-10-02):** spec aprobado en lo decidido (§11). Rama `claude/nifty-ritchie-rahtf0`, sin mergear:
- **R1 hecho** (T1). La red no fueron evals pagas sino **turnos grabados**
  (`apps/api/test/unit/orbi-turno-grabado.unit-spec.ts`): los 534 turnos reales del 2026-10-01 reproducidos
  con un modelo guionado por el controller y por las evals, comparados contra una huella grabada antes del
  refactor. T2 (wizard) sin hacer.
- **R2 en parte:** T3 (migración `20261002120000_orbi_sesiones`, **sin aplicar en ningún lado**), T4 y T5
  (servicio y endpoints de sesiones) y la retención de archivadas (180 días). **Esperan créditos de Gemini:**
  T6 (etiquetas de actividad), T7 (stream v2 con narración) y T8 (evals de la narración).
- **R3 hecho detrás del interruptor** (`apps/web/src/modules/orbi/`), con el diseño de Claude Design ("Orbi Chat
  Tablero"): vistas (decisión de Alan, 2026-10-02: desde 1280 px Orbi queda acoplado como una columna más, al
  estilo del panel de IA de Cloudflare, y empuja la sección del medio; entre 768 y 1279 px va **encima**, con
  fondo tenue, porque empujar ahí deja a Pedidos y Productos sin lugar para sus tablas; en el celular, hoja), encabezado con selector de sesiones, mensaje por partes (actividad con tiempos,
  plegado, tarjeta con sus estados y vencimiento, respuesta con formato), caja que deja escribir mientras Orbi
  responde, borrador por sesión, página dedicada con sesiones agrupadas y menú por fila. Usa el stream de hoy
  (`POST /orbi/chat`): el **pensamiento** y el **detalle de la tarjeta en filas** esperan T6/T7. Se prende con
  `NEXT_PUBLIC_ORBI_PANEL_V2=1` o, en un solo navegador, con `?orbiV2=1` en cualquier URL del panel
  (`?orbiV2=0` lo apaga). Verificado con Playwright sobre una página de prueba temporal: 19 capturas (claro,
  oscuro, 1440/1024/390 px) y 23 interacciones; **no** contra la API real (sin base en la sesión).
  Decisiones propias: tokens del panel y no los nuevos de Claude Design para los chips en oscuro; números con
  Geist y cifras tabulares (Geist Mono no se carga en la app); markdown con un parser propio del subconjunto que
  usa Gemini, sin librería ni HTML; solo los links al panel son links; la página va aparte de
  `SECCIONES_DEL_PANEL` (así `navigateTo` no ofrece "ir a Orbi").

**Fecha:** 2026-10-01

## Cómo se despliega (orden obligatorio)

La API y el front salen por caminos distintos (Vercel publica `main` solo; la API es `deploy.sh`
a mano, después de CI verde). Cada release tiene que funcionar con el front de antes y el de
después.

| Release | Qué | Migración | Front |
|---|---|---|---|
| R1 | Motor de turno extraído (refactor puro) | No | Sin cambios |
| R2 | Sesiones (expand), endpoints, stream v2 en `/orbi/panel/turno` | Sí, aditiva, con RLS. DEV en la rama; producción con `prisma-prod.sh` justo antes de `deploy.sh` | Sin cambios: `/orbi/chat` sigue igual |
| R3 | Módulo `modules/orbi` detrás de `NEXT_PUBLIC_ORBI_PANEL_V2` (apagado) | No | Nuevo, apagado |
| R4 | Prender el flag (después de probarlo Alan en producción) | No | Encendido |
| R5 (mucho después, decide Alan) | Contract: dejar de leer el Json de las sesiones v1 | Sí, destructiva → dos releases (`DEPLOYMENT.md` § Rollback) | — |

Las evals del panel se corren en R1 (no puede cambiar nada) y en R2 (narración nueva).

## Tareas

Formato: **archivos**, **interfaz** con las tareas siguientes, **tests primero**. Modelo sugerido
para el subagente: opus donde dice "sensible".

### R1 — Motor de turno

**T1. Extraer el loop del chat del panel** (sensible)
- Archivos: `apps/api/src/orbi/turno/motor-de-turno.ts` (nuevo), `orbi.controller.ts`,
  `test/evals/panel/motor.ts`.
- Interfaz: `correrTurno({ llm, registry, toolCtx, messages, tools, modelo, signal, soloLectura,
  emisor, pendientes })` → `{ texto, estado, toolsPedidas, propuestas, consumo, vueltas }`.
  `emisor` recibe eventos tipados (los del v1 en esta tarea).
- Tests: los 73 de `orbi.controller.spec.ts` sin tocar; spec nuevo del motor con un LLM guionado
  (reusar el de `test/unit/orbi-evals-panel.unit-spec.ts`). Las evals pasan a usar el motor real.
- Hecho cuando: el controller no tiene loop propio y las evals no replican nada.

**T2. Igual para el wizard** (opcional en R1): `chatWizard` usa el mismo motor con su emisor.

### R2 — Sesiones y stream v2

**T3. Migración aditiva** (sensible)
- Archivos: `apps/api/prisma/schema.prisma`, `prisma/migrations/<fecha>_orbi_sesiones/` y
  `<fecha>_orbi_sesiones_rls/` (con `prisma migrate diff … --script`, ver trampa del drift en el
  HANDOFF §7).
- Columnas nuevas en `OrbiConversation` y modelo `OrbiMessage` como dice el spec §3.2. Índice
  `(business_id, user_id, archived_at, last_activity_at)`.
- Tests: `rls-supabase.unit-spec.ts` en verde; `prisma validate`.

**T4. Repositorio de sesiones**
- Archivos: `apps/api/src/orbi/sesiones/sesiones.service.ts` (+ spec).
- Interfaz: `listar(biz, miembro, { archivadas, q, cursor })`, `crear(biz, miembro, screen)`,
  `abrir(biz, miembro, id)` → mensajes con partes y estado de cada tarjeta (de
  `orbi_pending_actions`), `editar(…)`, `borrar(…)` (cancela pendientes en la misma transacción),
  `agregarMensaje(…)`, `historialParaElModelo(…)` (solo partes `texto`, últimas 30), conversión v1.
- Tests: acotado a negocio y miembro en cada query; ajena = 404; borrar cancela pendientes; v1 se
  lee como partes de texto.

**T5. Endpoints de sesiones**
- Archivos: `apps/api/src/orbi/sesiones/sesiones.controller.ts`, DTOs.
- Tests: guard de member, throttle, validación del título (80, sin saltos ni control/bidi).

**T6. Partes y etiquetas de actividad**
- Archivos: `tool.interface.ts` (`describirResultado?`), `turno/etiquetas.ts` (lo que hoy es
  `FRASE_POR_TOOL` en el front), una implementación por tool de lectura.
- Tests: ninguna etiqueta ni resumen tiene nombres de tools, JSON ni valores de enum (la misma
  regex que `manual.spec.ts`).

**T7. Stream v2** (sensible)
- Archivos: `apps/api/src/orbi/turno/emisor-v2.ts`, `orbi.controller.ts` (`POST /orbi/panel/turno`).
- Eventos del spec §3.5; narración opción A (§3.6); `ping` cada 15 s; partes guardadas al cerrar o
  al cortar; título automático determinista; `orbi_turns.module` con el módulo resuelto.
- Tests: orden de eventos; `pensamiento` solo cuando hubo tool call en la vuelta; `fin` siempre;
  corte → aviso `detenido` guardado; `ping` con fake timers.

**T8. Evals de la narración**
- Archivos: `test/evals/panel/reglas.ts` (`pensamiento-no-repite-respuesta`, fugas en la
  narración), `motor.ts` (juzga las partes del v2).
- Correr el set completo (máx. 2–3 veces por sesión: cuesta plata) y anotar en el spec de la fase 2.

### R3 — Front (detrás del flag)

**T9. Lógica pura** (vitest)
- Archivos: `apps/web/src/modules/orbi/stream/{parserV2,partes}.ts`,
  `estado/{sesiones,agrupar}.ts`, `piezas/promptsSugeridos.ts`.
- Tests: parser con eventos partidos entre chunks; reducer que mueve texto a pensamiento; agrupado
  Hoy/Ayer/Esta semana/Antes en días de Argentina; prompts por pantalla y permiso.

**T10. Store y cliente de sesiones**
- Archivos: `estado/useOrbiPanel.ts` (zustand), `api/sesiones.ts`.
- La sesión abierta y la vista viven acá: cambiar de vista no recarga nada.

**T11. Piezas del chat** (diseño con `ui-ux-pro-max`; revisión visual de Alan)
- Archivos: `piezas/{Encabezado,Mensaje,Pensamiento,FilaDeActividad,Respuesta,Input,
  PromptsSugeridos,ListaDeSesiones,MenuDeSesion}.tsx`, `a11y/{Anunciador,useFocoDevuelto}.ts`.
- Reusa `OrbiConfirmButton` tal cual (la tarjeta nueva es de la fase 4).

**T12. Las cuatro vistas**
- Archivos: `vistas/{OrbiLateral,OrbiSuperpuesto,OrbiHoja,OrbiPagina}.tsx`, `AdminLayout.tsx`
  (reserva de ancho del lateral), `z-index.ts`, sección `orbi` en `SECCIONES_DEL_PANEL` (front y
  espejo de la API) y en `componentMap`.
- La hoja reusa la lógica de teclado y bordes seguros de `components/orbi/OrbiBottomSheet.tsx`
  (extraerla a un hook compartido sin cambiar el wizard).

**T13. Montaje detrás del flag**
- `AdminLayout` monta el módulo nuevo si `NEXT_PUBLIC_ORBI_PANEL_V2 === '1'`; si no, el
  `OrbiPanel` de hoy. El botón de la barra y Ctrl+K abren el que esté montado.

**T14. Recorridos de UI** (solo si Alan aprueba Playwright): abrir/cerrar con foco, cambiar de vista
sin perder la sesión, Detener, aprobar desde una sesión reabierta.

### Revisión

Por tarea: implementador + revisor (spec y calidad) con el diff en archivo, como en la fase 1.
Al final, revisión de toda la rama con el modelo más capaz, y las evals en R1 y R2.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El refactor del motor cambia algo sin querer | R1 sale solo, con los 73 tests y las evals idénticas a la línea de base |
| La narración repite la respuesta o filtra nombres internos | Regla de eval nueva; si falla seguido, opción B del spec (bufferear) |
| El lateral que empuja rompe pantallas con anchos fijos | Probar las 13 secciones del panel a 1280 y 1440 px con el lateral abierto, antes de prender el flag |
| Las sesiones crecen sin techo | Retención (pendiente de Alan) antes de R4 |
| Front nuevo contra API vieja | El flag no se prende hasta que R2 esté en producción |
