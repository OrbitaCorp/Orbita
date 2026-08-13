# Ola 2 (RBT) — Plan de Ejecución

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para ejecutar esta
> Ola fase por fase dentro de la misma sesión (ejecución inline). Cada fase de este documento **no**
> es un desglose TDD paso-a-paso — es el nivel de detalle de orquestación. Antes de empezar cada
> fase, generar el plan bite-sized (Task N / Step 1-5, con superpowers:writing-plans) para ESA fase
> puntual, usando el estado del código en ese momento.

**Goal:** Cerrar las 5 tareas de "Ola 2" (RBT-649, 650, 651, 654, 655) — el módulo Super Admin que
dependía de RBT-647/648 (Ola 1).

**Architecture:** Monorepo `apps/api` (NestJS + Prisma) / `apps/web` (Next.js). Auditoría previa
(subagente Explore, 2026-08-12) encontró que el backend de las 5 tareas está en un estado mucho más
avanzado de lo que sugiere el board — 4 de 5 tienen el endpoint principal ya construido. El trabajo
real de esta ola es más angosto: cerrar el lado de lectura/filtros de auditoría (655), la UI del
panel de Super Admin para las acciones que ya existen en el backend (651, 654), y un caso de negocio
sin resolver en código (vencimiento de licencias comp, 651).

**Tech Stack:** NestJS, Prisma/PostgreSQL (Supabase), Next.js/React.

**Spec:** Los 5 tickets de Jira (RBT-649, 650, 651, 654, 655) — `OBJETIVO` / `QUÉ HACER` / `PARA
TENER EN CUENTA` de cada uno es la fuente de verdad funcional.

## Global Constraints

- Mismas de Ola 1 (ver `docs/superpowers/plans/2026-08-12-ola-1-ejecucion.md`): archivos `apps/api`
  < 300 líneas cuando sea razonable, nunca mezclar `payments` con `subscriptions`, todo lo de
  `platform_admins` detrás de `PlatformAdminGuard`, comentar en Jira al cerrar cada fase, formato de
  fechas DD/MM/YYYY y tokens `var(--color-*)` en frontend.
- No tocar código de cobro real de MercadoPago (`mercadopago.service.ts`, `subscriptions.service.ts`
  webhook) salvo que un ticket lo pida explícitamente — es la superficie de mayor riesgo del proyecto
  (plata real). Ola 2 no lo requiere: el gap real está en lectura de logs y UI, no en el cobro.

---

## Auditoría de estado real (subagente Explore, 2026-08-12)

| Ticket | Backend | Frontend | Gap real |
|---|---|---|---|
| RBT-649 | **Completo.** `GET /subscription` + `GET /subscription/payments`, coincide campo a campo con `CONTRATO_API.md`. Ya cubierto por los tests unitarios de Fase 1 de Ola 1 (mismos métodos `getForBusiness`/`getPayments`). | No investigado a fondo (es panel del dueño, no Super Admin) — fuera del alcance real de este ticket, que solo pide los dos GET. | Ninguno. Cierre por verificación. |
| RBT-650 | **Completo.** Preapproval + webhook con validación de firma HMAC, maneja `payment` y `subscription_preapproval`, gracia vía cron `reconcileOverdueSubscriptions`. | N/A (webhook). | Nota del ticket sobre "cifrado con pgcrypto" parece mal atribuida — ese cifrado ya existe pero en `mercadopago.service.ts` (credenciales OAuth por negocio), no en `subscriptions` (que usa una sola `MP_ACCESS_TOKEN` de plataforma, sin secreto por-tenant que cifrar). Confirmar con el equipo, no construir nada nuevo. |
| RBT-651 | **Endpoint completo**, pero el cron de gracia (`reconcileOverdueSubscriptions`) filtra `origin: 'PAID'` — nunca toca comps. El propio comentario del schema documenta la intención ("venció una licencia comp sin renovar" → SUSPENDED) pero no está implementado. | **No existe.** Sin botón, sin modal, sin función en `platformApi`. | Implementar vencimiento de comp (el schema ya dice qué debe pasar) + UI. |
| RBT-654 | **Completo**, con un desvío de contrato: `CONTRATO_API.md` pide `{ok:true}`, el código devuelve el negocio completo. Enforcement real solo en storefront (`assertBusinessOperativo`) — el panel (login de member) NO bloquea a un negocio suspendido. | **No existe.** Sin botones, sin funciones en `platformApi`. | Corregir el shape de respuesta + construir UI. Bloqueo de panel: pregunta abierta del propio ticket — no se decide en esta ola, se comenta en Jira. |
| RBT-655 | **Solo el lado de escritura.** Las 6 acciones administrativas ya escriben en `platformAdminLog`. No existe `GET /platform/logs` con filtros — solo un `findMany` embebido (últimos 20) dentro de `getBusiness()`. `CONTRATO_API.md` tampoco lista este endpoint (falta también en la spec, no solo en el código). | **No existe.** Sin tab de logs en `superadmin/index.tsx`. | Construir el endpoint de lectura + filtros + la UI. |

**Conclusión:** de las 5, **ninguna es un build 100% de cero** — a diferencia de RBT-635 en Ola 1.
El trabajo es: 1 endpoint nuevo (655 lectura), 1 pieza de lógica de negocio que ya estaba
especificada en el schema pero sin codear (651 vencimiento), 1 fix de contrato (654), y tres
pantallas de panel de Super Admin (651, 654, 655 comparten la misma vista `BusinessDetailView`).

---

## Orden de ejecución

1. **Fase 1 — RBT-649** (cierre por verificación, sin código nuevo)
2. **Fase 2 — RBT-650** (cierre por verificación + aclarar nota de pgcrypto en Jira, sin código nuevo)
3. **Fase 3 — RBT-655** (build: endpoint de lectura de logs + tab en el panel)
4. **Fase 4 — RBT-654** (fix de contrato + UI de suspender/reactivar)
5. **Fase 5 — RBT-651** (build: vencimiento de comp + UI de ceder comp)

Dejo 655 antes que 654/651 porque construye el patrón de "leer `platformAdminLog`" que después se
usa para confirmar visualmente que las acciones de 654/651 quedan bien registradas.

---

## Fase 1 — RBT-649: Estado de suscripción y facturación ✅ (2026-08-12)

**Estado:** backend ya completo y coincide con `CONTRATO_API.md`. Ya cubierto por los tests
unitarios de Fase 1 de Ola 1 (`subscriptions.service.unit-spec.ts`).

**Alcance:** solo confirmar — no hay código para escribir.

**Auditoría de cierre de fase:**
- [x] `GET /subscription` y `GET /subscription/payments` confirmados contra `CONTRATO_API.md` línea
      a línea (subagente Explore) — sin drift.
- [x] Cobertura de test ya existente (Fase 1, Ola 1) confirmada como aplicable a este ticket.
- [x] Comentario en RBT-649.

---

## Fase 2 — RBT-650: Débito automático y webhook de MercadoPago ✅ (2026-08-12)

**Estado:** backend ya completo — preapproval, webhook con firma validada, reconciliación de gracia.

**Alcance:** confirmar + aclarar la nota de "cifrado con pgcrypto" del ticket, que parece apuntar al
módulo equivocado.

**Auditoría de cierre de fase:**
- [x] Webhook + firma + reconciliación confirmados por código (subagente Explore).
- [x] Nota de pgcrypto: cifrado por-negocio ya existe en `mercadopago.service.ts` (OAuth de cada
      comercio), no aplica a `subscriptions` (una sola credencial de plataforma, sin secreto
      por-tenant). Comentado en Jira para que el equipo confirme si la nota del ticket se refería a
      ese otro módulo.
- [x] No se tocó código de cobro real — fuera de alcance de esta fase (solo verificación).

---

## Fase 3 — RBT-655: Logs de auditoría de plataforma

**Estado:** escritura completa, lectura/filtros no existen.

**Alcance (generar el plan bite-sized recién acá):**
1. Backend: `GET /platform/logs` (guardado por `PlatformAdminGuard`, igual que el resto de
   `platform.controller.ts`) con filtros opcionales por `adminId`, `action`, `businessId` (query
   params) + paginación (`page`/`limit`, mismo patrón que `subscriptions.service.ts.getPayments`).
   `PlatformService.listLogs(query)` — `include: { admin: {select: {name,email}} }` para no
   obligar al frontend a resolver el nombre del admin con otra llamada.
2. Frontend: nuevo tab "Logs" en `superadmin/index.tsx`, tabla con admin/acción/negocio/fecha +
   filtros simples (selects), función `logs()` en `platformApi`.

**Archivos:** `apps/api/src/platform/platform.controller.ts`, `platform.service.ts`, nuevo
`apps/api/src/platform/dto/list-logs-query.dto.ts`; `apps/web/src/lib/platform/api.ts`,
`apps/web/src/pages/superadmin/index.tsx`.

---

## Fase 4 — RBT-654: Suspender y reactivar negocios

**Estado:** endpoints completos, un desvío de contrato, sin UI.

**Alcance (generar el plan bite-sized recién acá):**
1. Backend: `suspendBusiness`/`reactivateBusiness` deben devolver `{ ok: true }` (no el negocio
   completo) para coincidir con `CONTRATO_API.md:1728` — el frontend puede refetchar el detalle si
   necesita datos actualizados, no depender del response del POST.
2. Frontend: botones "Suspender"/"Reactivar" en `BusinessDetailView`, con modal de confirmación
   (reusar patrón `ConfirmModal` visto en Fase 2 de Ola 1) y campo opcional de motivo al suspender.
   Funciones `suspend()`/`reactivate()` en `platformApi`.
3. **No implementar** bloqueo de login de panel para negocio suspendido — es una pregunta abierta
   del propio ticket ("negocio suspendido: storefront y panel deben responder estado bloqueado",
   pero storefront ya lo hace y panel no). Comentar en Jira para que el equipo decida antes de
   tocar `auth.service.ts` (es una superficie de auth compartida, cambiarla sin decisión explícita
   es riesgoso).

**Archivos:** `apps/api/src/platform/platform.service.ts`; `apps/web/src/pages/superadmin/index.tsx`,
`apps/web/src/lib/platform/api.ts`.

---

## Fase 5 — RBT-651: Ceder licencias de cortesía (comp)

**Estado:** endpoint de alta completo, vencimiento sin implementar, sin UI.

**Alcance (generar el plan bite-sized recién acá):**
1. Backend: extender `reconcileOverdueSubscriptions` (o un método hermano) para que también
   revise suscripciones `origin: 'COMP'` vencidas (`currentPeriodEnd < now`) y las pase a
   `SUSPENDED` — comportamiento que el propio comentario del schema ya documenta como decidido
   (`schema.prisma:1198`), solo faltaba codearlo. No hay ambigüedad de negocio real acá: "pasa a
   suspendida" ya estaba definido, no es una decisión nueva.
2. Frontend: modal "Ceder licencia" en `BusinessDetailView` (fecha de fin + motivo), función
   `grantComp()` en `platformApi`.

**Archivos:** `apps/api/src/subscriptions/subscriptions.service.ts`; `apps/web/src/pages/superadmin/index.tsx`,
`apps/web/src/lib/platform/api.ts`.
