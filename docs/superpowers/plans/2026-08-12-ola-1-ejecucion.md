# Ola 1 (RBT) — Plan de Ejecución

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para ejecutar esta
> Ola fase por fase dentro de la misma sesión (ejecución inline). Cada fase de este documento **no**
> es un desglose TDD paso-a-paso — es el nivel de detalle de orquestación. Antes de empezar cada
> fase, generar el plan bite-sized (Task N / Step 1-5, con superpowers:writing-plans) para ESA fase
> puntual, usando el estado del código en ese momento — no el de hoy. Escribir el detalle
> línea-a-línea de la fase 7 hoy quedaría obsoleto para cuando termine la fase 3.

**Goal:** Cerrar las 8 tareas de "Ola 1" (RBT-631, 647, 648, 657, 632, 646, 643, 635) — las únicas
del board asignado que no dependen de ninguna otra tarea propia todavía pendiente.

**Architecture:** Monorepo `apps/api` (NestJS + Prisma) / `apps/web` (Next.js). La mayoría de las
tareas de esta ola YA tienen su backend construido (ver auditoría abajo) — el trabajo real es más
angosto de lo que sugiere el texto de cada ticket de Jira, que en varios casos quedó desactualizado
respecto al código.

**Tech Stack:** NestJS, Prisma/PostgreSQL (Supabase), Next.js/React, TanStack Query.

**Spec:** Los 8 tickets de Jira (RBT-631, 647, 648, 657, 632, 646, 643, 635) — `OBJETIVO` / `QUÉ
HACER` / `PARA TENER EN CUENTA` de cada uno es la fuente de verdad funcional. Este documento es la
capa de secuenciación + auditoría de estado real, no reemplaza leer el ticket antes de tocar su fase.

## Global Constraints

- Archivos `apps/api` < 300 líneas cuando sea razonable partirlos; convención existente del repo.
- Nunca mezclar `payments` (cliente→negocio) con `subscriptions`/`subscription_payments`
  (negocio→Órbita) — son dos integraciones de MercadoPago distintas, con guards distintos.
- Todo lo que toque `platform_admins` va detrás de `PlatformAdminGuard`; nunca reusar el guard
  multi-tenant de negocio para rutas de plataforma.
- Al terminar cada fase que toque `apps/api`, comentar en el ticket de Jira correspondiente
  (decisiones no especificadas, deuda técnica, lo que quedó abierto) — regla ya vigente en
  `apps/api/CLAUDE.md`.
- Formato de fechas DD/MM/YYYY, tokens `var(--color-*)`, sin imports de `@/design-system/` — reglas
  ya vigentes del frontend de Órbita.

---

## Auditoría de estado real (antes de secuenciar)

| Ticket | Lo que pide Jira | Estado real encontrado |
|---|---|---|
| RBT-631 | Cambio de contraseña, sesiones activas, cerrar sesión remota | **Backend completo.** `MeController`/`MeService` (`apps/api/src/me/`) ya tiene `changePassword`, y delega sesiones a `AuthService.listSessions/revokeSession/revokeAllSessions`, ya usados por `apps/web/.../cliente/perfil/Perfil.tsx` vía `useAuth()`. Falta **verificar** si la sección "Seguridad y sesiones" de esa pantalla ya consume `GET /me/sessions` o todavía es estática. |
| RBT-647 | Modelo de platform admins + auth propia + seed de 3 fundadores | **Backend completo.** `PlatformAdmin`/`PlatformAdminLog` migrados, `PlatformAdminGuard` (`apps/api/src/common/guards/platform-admin.guard.ts`) wireado en `PlatformController`, CRUD de admins (`listAdmins/createAdmin/updateAdmin/removeAdmin`) hecho, login unificado en `AuthService.login()` ya prioriza `platformAdmin` antes que `member`. Falta **verificar** que el seed cargue los 3 fundadores (hoy se ve al menos 1 upsert) y que exista una pantalla panel de gestión de admins (o si "Super Admin" del frontend todavía es todo mock). |
| RBT-648 | Modelo de suscripciones/pagos, estados, gracia | **Backend completo** para el modelo base: `Subscription`/`SubscriptionPayment` migrados, `SubscriptionsService.confirmAndCreate` ya crea la suscripción 1:1 al confirmar el pago de onboarding. Nada que construir de cero acá. |
| RBT-657 | Bandeja, chat, plantillas, mención de pedido, contador de no leídos | **Parcial.** `ConversationsService`/`ConversationsController` — completo (panel y cliente). `MessageTemplatesService` — **stub real** (`NotImplementedException` en los 3 métodos). El propio ticket dice que el frontend (`panel/mensajes/`) ya está armado con datos de muestra — falta conectarlo + implementar plantillas + el contador de la campana. |
| RBT-632 | Reseñas: alta, elegibilidad, ocultar, listado público | **Backend completo.** `ReviewsService` cubre alta (con validación de "compró y se entregó"), elegibilidad, ocultar (panel), listado público. Falta **verificar** si el storefront (detalle de producto) ya muestra/permite dejar reseñas o sigue sin ese bloque de UI. |
| RBT-646 | Menú de usuario del panel (dueño/equipo): datos, cerrar sesión, tema | **No existe.** `apps/web/.../layouts/components/Header.tsx` tiene un comentario explícito: *"hardcodeados. La pantalla 'Mi perfil' completa sigue siendo de [otro dev]."* No hay endpoint de perfil para `member` (el `me/` que existe es solo para `customer`, ver RBT-631). Ojo: no confundir con RBT-631 — son roles distintos (dueño/equipo vs. cliente del storefront). |
| RBT-643 | Métricas de descuentos: KPIs, gráfico, tabla con búsqueda | **Backend completo.** `discounts-metrics.service.ts` (228 líneas) + `useMetricas.ts` en el frontend. Falta **verificar** que el hook realmente pegue contra la API real y no siga devolviendo `mock/metricas.ts`. |
| RBT-635 | Endpoint que genera descripción de producto con IA | **No existe.** No hay ningún servicio de IA en `apps/api` todavía — es la única tarea 100% de cero en esta ola. |

**Conclusión:** de las 8, solo **RBT-635 es un build completo desde cero**. RBT-646 y la parte de
plantillas de RBT-650→657 necesitan backend nuevo pero acotado. El resto (631, 647, 648, 632, 643)
es mayormente **auditar qué le falta al frontend y conectar**, no reconstruir. Esto cambia el orden
óptimo: conviene arrancar por los que ya tienen todo listo (cierre rápido, bajo riesgo) antes de
meterse en los dos builds reales.

---

## Orden de ejecución

1. **Fase 1 — RBT-648** (cerrar el ticket, ya no queda nada por construir salvo confirmar cobertura)
2. **Fase 2 — RBT-647** (idem + seed de founders + confirmar UI de gestión de admins)
3. **Fase 3 — RBT-631** (conectar frontend a lo que ya expone el backend)
4. **Fase 4 — RBT-632** (conectar frontend a lo que ya expone el backend)
5. **Fase 5 — RBT-643** (conectar frontend a lo que ya expone el backend)
6. **Fase 6 — RBT-646** (build acotado: endpoint de perfil de member + UI del menú)
7. **Fase 7 — RBT-657** (build real: `MessageTemplatesService` + conectar bandeja/chat/campana)
8. **Fase 8 — RBT-635** (build real: servicio de IA + endpoint + botón)

Las fases 1-2 y 3-5 son casi enteramente verificación — se benefician de ir rápido. Dejo las dos de
build real (646, 657, 635) al final a propósito: para cuando lleguemos ahí, ya vamos a tener
resuelto (y probado) el patrón de "conectar frontend a un servicio ya existente" de las fases
anteriores, y eso informa cómo estructurar los dos backends nuevos de forma consistente con el resto.

---

## Fase 1 — RBT-648: Super Admin, modelo de suscripciones ✅ (2026-08-12)

**Estado:** backend ya completo. Esta fase es de **cierre**, no de construcción.

**Alcance:**
1. Confirmar (con un test o llamada real) que `SubscriptionsService.confirmAndCreate` crea la fila
   `Subscription` correctamente al pasar por el flujo de onboarding con pago aprobado.
2. Confirmar que `GET /subscription` y `GET /subscription/payments` (`SubscriptionsController`)
   devuelven el shape que espera `CONTRATO_API.md`.
3. Si falta algún test e2e de este flujo, agregarlo (no reescribir lo que ya pasa).

**Archivos:** `apps/api/src/subscriptions/*`, `apps/api/test/*subscription*`.

**Auditoría de cierre de fase (antes de pasar a Fase 2):**
- [x] Test unitario nuevo (`apps/api/test/unit/subscriptions.service.unit-spec.ts`, 5 casos) en vez
      de e2e — `getForBusiness`/`getPayments` no dependen de MP, un unit test alcanza y es más rápido.
- [x] `npx tsc --noEmit` en `apps/api` sin errores (tenía errores preexistentes sin relación —
      Prisma Client desactualizado — resueltos con `npx prisma generate`, sin tocar código/schema).
- [x] Comentado en RBT-648 (resuelto) y en RBT-650 (hallazgo: `handleWebhook()` ya escrito, sin
      controller que lo exponga — ahorra tiempo cuando se llegue a esa fase).
- [x] Sin cambios de schema pendientes de migrar (`npx prisma migrate status` limpio).

---

## Fase 2 — RBT-647: Super Admin, platform admins + auth ✅ (2026-08-12)

**Ampliación sobre el alcance original**: se sumó un segundo factor por email al login
de platform admin (`PlatformAdminLoginCode`, endpoint `POST /auth/platform/verify-code`,
UI de dos pasos en `pages/login.tsx`) — pedido explícito del usuario durante la ejecución
de esta fase, no estaba en el plan original. Seed actualizado a 4 founders corporativos
(no 3, según lo confirmado). Pestaña "Admins" nueva en `pages/superadmin/index.tsx`.

**Estado:** backend ya completo (modelo, guard, CRUD, login unificado).

**Alcance:**
1. Verificar `apps/api/prisma/seed.ts` — confirmar que efectivamente carga **3** fundadores con
   `role: SUPERADMIN` (hoy se ve al menos 1 `upsert`; si falta, completar el seed, no el modelo).
2. Verificar si existe una pantalla de panel de plataforma que consuma `GET/POST/PUT/DELETE
   /platform/admins` (`apps/web/src/pages/superadmin/index.tsx` ya existía en exploraciones previas
   de esta sesión — confirmar si esa gestión de admins está ahí o si sigue mock).
3. Si la UI de gestión de admins no existe, construirla (reusa componentes de panel: `DataTable`,
   `ModalConfirmacion` de `_shared/components`).

**Archivos:** `apps/api/prisma/seed.ts`, `apps/api/src/platform/*`, `apps/web/src/pages/superadmin/index.tsx`.

**Auditoría de cierre de fase:**
- [x] Seed corrido contra la base real: 5 platform admins con SUPERADMIN existen (4 founders + el admin de dev).
- [x] `npx tsc --noEmit` limpio en `apps/api` y `apps/web`. `eslint` limpio en todo el código nuevo (los
      errores que aparecen en `pages/superadmin/index.tsx` son preexistentes, en el hook `useFetch` y en
      imports de tipos que ya estaban sin usar antes de esta fase).
- [x] 7 tests unitarios nuevos del flujo de 2FA, todos en verde (33/33 en la suite completa).
- [x] Comentario en RBT-647 con lo verificado/agregado (incluye la ampliación de alcance del 2FA).

---

## Fase 3 — RBT-631: Cuenta cliente, seguridad y sesiones ✅ (2026-08-12)

**Bug real encontrado**: el frontend ya estaba conectado, pero `isCurrent` nunca daba `true`
(la request iba directo al backend, sin poder mandar el refresh token que vive en la cookie
httpOnly). Se agregó un proxy BFF (`pages/api/me/sessions/*`) — ver detalle en el comentario
de Jira.

**Estado:** backend ya completo.

**Alcance:**
1. Abrir `apps/web/.../cliente/perfil/Perfil.tsx`, ubicar la sección "Seguridad" / "Sesiones".
2. Si todavía es estática/mock: conectarla a `GET /me/sessions`, `DELETE /me/sessions/:id`,
   `POST /me/sessions/revoke-all` — igual que ya hace `changePassword` (mismo hook `useAuth`/patrón
   de fetch autenticado de `authClient.ts`, agregando el header `x-refresh-token` que ya espera
   `MeController` para preservar la sesión actual al cerrar las demás).
3. Confirmar el formulario de cambio de contraseña (`ChangePasswordDto`) ya está conectado.

**Archivos:** `apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx`, y el hook que consuma `/me/*`
si no existe todavía (crear uno chico, ej. `useSesiones.ts`, siguiendo el patrón de `authClient.ts`).

**Auditoría de cierre de fase:**
- [x] Cambiar contraseña / avatar / datos personales: ya conectado end-to-end, sin cambios.
- [x] `isCurrent` en sesiones: encontrado y arreglado el bug de transporte (ver arriba). 3 tests
      unitarios nuevos verifican la lógica del servicio.
- [x] `npx tsc --noEmit` + `eslint` limpios en `apps/web` sobre los archivos tocados.
- [x] Comentario en RBT-631.
- Pendiente de verificación manual en navegador (no se pudo probar en este entorno — requiere
  resolver subdominios `*.orbita.local`): confirmar visualmente en dos pestañas que "Esta sesión"
  aparece correctamente y que cerrar las demás no afecta la pestaña activa.

---

## Fase 4 — RBT-632: Storefront, reseñas de producto ✅ (2026-08-12)

Los 3 puntos del ticket ya estaban 100% construidos (backend y frontend). Nota abierta,
fuera del alcance literal: no hay `GET /reviews` para listar ni pantalla de moderación en
el panel — `hide()` existe pero nadie lo llama. Documentado en Jira, no construido (no
estaba pedido).

**Estado:** backend ya completo.

**Alcance:**
1. Confirmar si `ProductoDetalle.tsx` (storefront) ya muestra reseñas / promedio, y si hay un
   formulario para dejarlas cuando `GET /products/:id/reviews/eligibility` (o el endpoint
   equivalente de `product-reviews.controller.ts`) devuelve `eligible: true`.
2. Si no existe, construir: bloque de reseñas en el detalle (promedio + listado, respetando el
   toggle de visibilidad de Apariencia que menciona el ticket) + formulario de alta solo visible
   cuando el cliente logueado es elegible.
3. Conectar "ocultar reseña" en el panel (dueño), si no está.

**Archivos:** `apps/web/src/modules/ventas/cliente/producto/ProductoDetalle.tsx`,
`apps/api/src/reviews/product-reviews.controller.ts` (rutas públicas/cliente).

**Auditoría de cierre de fase:**
- [x] Regla "solo compró + entregado" verificada con 6 tests unitarios (antes solo verificada a ojo).
- [x] Nombre truncado ("María G.") confirmado en el test de alta.
- [~] Ocultar desde el panel: el endpoint existe pero no hay UI ni listado — documentado en Jira,
      no construido (fuera del alcance literal del ticket).
- [x] `npx tsc --noEmit` limpio, 42/42 tests en verde.
- [x] Comentario en RBT-632.

---

## Fase 5 — RBT-643: Descuentos, rendimiento ✅ (2026-08-12)

Ya estaba conectado de punta a punta. Se corrigió un comentario desactualizado que
decía que las métricas devolvían ceros (RBT-616 ya escribe `DiscountRedemption` en
el checkout real). **Nota de infra**: `test:e2e` no corre en este entorno — faltan
vars de OAuth de MercadoPago en `.env`, afecta a cualquier e2e, no solo a este ticket.

**Estado:** backend ya completo.

**Alcance:**
1. Abrir `useMetricas.ts` — confirmar que pega contra la API real (`GET /discounts/metricas` o el
   endpoint que exponga `discounts-metrics.service.ts`) y no contra `mock/metricas.ts`.
2. Si sigue en mock, reemplazar el `queryFn` por la llamada real, manteniendo el shape que ya
   consume `DescuentosMetricas.tsx`/`MetricasKPIs.tsx`/`MetricasGrafico.tsx`/`MetricasTabla.tsx`
   para no tener que tocar esos componentes.

**Archivos:** `apps/web/src/modules/ventas/panel/descuentos/hooks/useMetricas.ts`.

**Auditoría de cierre de fase:**
- [x] Confirmado por código (no por prueba en navegador — bloqueado, ver nota de infra abajo):
      el hook y el servicio ya están conectados y la lógica de agregación es correcta.
- [x] Filtros (rango/canal/tipo) implementados en `DiscountsMetricsService.resumen()`.
- [x] `npx tsc --noEmit` limpio en `apps/api` y `apps/web`.
- [x] Comentario en RBT-643 — incluye nota de infraestructura sobre `test:e2e` roto por
      falta de env vars de MercadoPago (afecta a todo el proyecto, no solo este ticket).

---

## Fase 6 — RBT-646: Globales, perfil de usuario (panel) y cerrar sesión

**Estado:** no existe. Build acotado.

**Alcance (generar el plan bite-sized recién acá, con el código de ese momento):**
1. Backend: endpoint de perfil para `member` — análogo a `me/` pero del lado panel (nombre nuevo
   para no colisionar semánticamente con el `me/` de customer, ej. `apps/api/src/member-profile/`
   o extender un módulo ya scopeado a member si existe uno mejor ubicado). `GET`/`PATCH` de
   nombre/email, cerrar sesión (reusa `AuthService.logout`), y guardar preferencia de tema
   (claro/oscuro/sistema) — necesita un campo nuevo en `Member` si no existe (revisar schema antes
   de asumir que hace falta migración).
2. Frontend: reemplazar los datos hardcodeados de `Header.tsx` + construir "Mi perfil" real.

**Auditoría de cierre de fase:**
- [ ] Editar nombre/email desde "Mi perfil" persiste y se refleja en el header sin recargar.
- [ ] Cerrar sesión desde ahí invalida el token (probado con un fetch autenticado después, debe dar 401).
- [ ] La preferencia de tema persiste entre sesiones (no solo `localStorage` del navegador — si el
      ticket pide que sea por usuario, tiene que viajar al backend).
- [ ] Si hubo migración de schema: `npx prisma migrate dev` corrido y commiteado, `npx tsc --noEmit`
      en `apps/api` y `apps/web` limpios.
- [ ] Comentario en RBT-646.

---

## Fase 7 — RBT-657: Panel, mensajes y seguimiento con el cliente

**Estado:** parcial. `ConversationsService` completo; `MessageTemplatesService` es un stub real.

**Alcance (generar el plan bite-sized recién acá):**
1. Implementar `MessageTemplatesService` (CRUD real sobre el modelo `MessageTemplate` ya migrado)
   + conectar `message-templates.controller.ts`.
2. Conectar `panel/mensajes/` (Bandeja, Chat, Plantillas — ya construidos con datos de muestra según
   el propio ticket) a `ConversationsController` real.
3. Contador de no leídos de la campana del header: sumar un endpoint liviano (o reusar
   `findAllForBusiness` y contar `isUnread` en el cliente) — decidir según lo que ya exponga
   `ConversationsController`.
4. Coordinar con RBT-645 (motor de notificaciones, de otra fase) solo si hace falta que un mensaje
   nuevo dispare un aviso — no bloqueante para esta fase.

**Auditoría de cierre de fase:**
- [ ] Crear, editar y borrar una plantilla de mensaje desde el panel persiste en `message_templates`.
- [ ] Un mensaje nuevo del cliente (storefront) aparece en la bandeja del panel como no leído, y se
      marca leído al abrir la conversación (comportamiento ya implementado en el service — verificar
      que el frontend lo respete, no reimplementarlo).
- [ ] El contador de la campana refleja conversaciones no leídas reales.
- [ ] `npx tsc --noEmit` + `eslint` limpios en `apps/api` y `apps/web`.
- [ ] Comentario en RBT-657.

---

## Fase 8 — RBT-635: Productos, descripción con IA (Orbi)

**Estado:** no existe. Build real de cero — única tarea 100% nueva de la ola.

**Alcance (generar el plan bite-sized recién acá):**
1. Backend: endpoint que reciba nombre/categoría/etiquetas/características ya cargados y devuelva
   una descripción generada. Antes de escribir código: revisar si el proyecto ya tiene alguna
   integración de IA en otro lado (mail, soporte, etc.) para reusar cliente/credenciales en vez de
   crear una integración nueva desde cero — no se encontró ninguna en esta auditoría, pero conviene
   confirmar de nuevo al arrancar la fase por si cambió.
2. Frontend: conectar el botón "Generar con Orbi" ya mencionado en el ticket (ubicarlo en
   `ProductoNuevo.tsx` / el form de edición de producto).

**Auditoría de cierre de fase:**
- [ ] El endpoint devuelve una descripción coherente para un producto real de prueba (no placeholder).
- [ ] Falla con un mensaje claro si faltan campos mínimos (nombre/categoría) — no 500.
- [ ] Rate-limit o control de costo básico si la IA es de pago (marcar como pendiente en Jira si se
      decide diferir, no dejarlo sin mencionar).
- [ ] `npx tsc --noEmit` + `eslint` limpios.
- [ ] Comentario en RBT-635.
