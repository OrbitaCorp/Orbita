# Instrucciones permanentes para trabajar en apps/api/

## Deploy: Google Cloud Run — NO Railway

El backend de producción **ya no corre en Railway**, aunque el proyecto de Railway
("Orbita api") siga existiendo y todavía muestre deployments viejos — es un
resabio, no lo real. Desde el 2026-08-31 corre en **Google Cloud Run**
(proyecto GCP `orbita-api-corp`, región `southamerica-east1`, detrás de un
proxy de Firebase Hosting en `api.orbita.site`). No asumas Railway por default
ni propongas volver a él — si algo lo menciona (documentación vieja, un
`railway.json`, lo que sea), es una referencia desactualizada.

**Pushear a `main` en GitHub dispara el deploy del FRONTEND solo** (Vercel
está conectado a ese repo/branch). El backend **no tiene CI/CD** — es deploy
manual, a propósito (decisión explícita para no sumar otro servicio con costo
propio). Esto significa que **después de cualquier cambio en `apps/api/`, hay
que desplegarlo a mano** — pushear a `main` NO alcanza, el código nuevo no
llega solo a producción.

```bash
cd apps/api
./deploy/deploy.sh
```

Necesita `gcloud` CLI autenticado (`gcloud auth login`, cuenta `@orbita-corp.com`)
con permisos sobre `orbita-api-corp` — ver **`apps/api/DEPLOYMENT.md`** para el
runbook completo (arquitectura, accesos, secrets, logs, rollback, troubleshooting
de problemas ya resueltos). Leerlo ANTES de tocar algo de infra/deploy — ya
tiene documentados varios errores encontrados y cómo se resolvieron, no hace
falta repetir esa pelea.

Al terminar cualquier tarea que haya tocado `apps/api/src/` o `apps/api/prisma/`:
avisá en el resumen final que el cambio quedó pusheado a `main` pero **todavía
no está en producción** hasta que alguien corra `deploy.sh` — no des la tarea
por "lista en prod" solo porque el push a GitHub salió bien.

## Documentar pendientes en Jira (ya NO en PENDIENTES.md)

**Cambio de flujo (2026-08-04):** este proyecto dejó de usar `apps/api/PENDIENTES.md` como
registro vivo. El archivo se conserva como **archivo histórico** (todo lo escrito antes de esta
fecha sigue ahí, no se borra ni se migra) pero no se agregan entradas nuevas. De acá en adelante,
todo lo que antes iba a PENDIENTES.md se postea como **comentario en el ticket de Jira**
relacionado con la tarea que se está haciendo — así lo ve todo el equipo, no solo quien lee el
repo.

Es responsabilidad de Claude Code hacer esto al final de CADA tarea que realice en este backend,
sin que el usuario tenga que pedirlo explícitamente.

### Qué se comenta en Jira

Mismos criterios que antes tenía PENDIENTES.md — solo cambia el destino:

- **Decisiones tomadas sin especificación clara** — cualquier vez que el contrato de API, el
  modelo de datos, o el usuario no especificaron algo con precisión y hubo que decidir un
  criterio propio para poder avanzar.
- **Conflictos detectados** — casos donde dos documentos (contrato, modelo de datos, código
  existente) se contradicen entre sí.
- **Funcionalidad a medio construir** — endpoints que quedaron como stub porque dependen de
  un módulo que todavía no existe, o que se pospusieron deliberadamente.
- **Deuda técnica identificada** — atajos tomados conscientemente por velocidad, que deberían
  revisarse antes de producción (ej: falta de rate limiting, validaciones laxas, seguridad
  floja en algún flujo).
- **Bugs de infraestructura encontrados y corregidos** — para que quede registro de qué se
  rompió y cómo se arregló, en caso de que reaparezca en otro contexto.
- **Preguntas abiertas para el equipo** — cosas que technically funcionan pero donde el
  criterio de negocio no está claro y alguien (CTO/CEO/CPO) debería confirmar.

### Qué NO se comenta

- Confirmaciones de que algo quedó bien implementado y verificado (eso va en el resumen de
  la tarea al usuario, no en Jira).
- Detalles de implementación que no requieren decisión de nadie.

### Dónde postear

1. **Si la tarea tiene un ticket relacionado** (el más común — venís trabajando sobre un
   RBT-XXX, o el usuario lo mencionó): postealo como comentario en ESE ticket
   (`addCommentToJiraIssue`), con `addWorklogToJiraIssue` si además aplica registrar el trabajo.
2. **Si no hay ticket relacionado** (encontraste algo suelto, sin tarea asociada): creá un
   ticket chico en el proyecto RBT (`createJiraIssue`, tipo Tarea, sin asignar salvo que sea
   obvio a quién corresponde) y comentá el detalle ahí. No lo dejes flotando sin ticket.
3. Buscá el ticket exacto con `searchJiraIssuesUsingJql` (por key si la sabés, o por texto) antes
   de comentar — no asumas el id.

### Formato del comentario

Mismo criterio que las entradas viejas de PENDIENTES.md: fecha, descripción del problema o
decisión, y estado (`ABIERTO` | `RESUELTO — [cómo]` | `DIFERIDO — [hasta cuándo/qué condición]`).

```
[2026-08-04] Rol mínimo para operaciones de sucursal
Estado: RESUELTO (2026-08-04)
El contrato decía owner/admin para POST/PUT/DELETE /branches. Se decidió owner únicamente
por ser operación estructural (afecta stock/caja/reportes de todo el negocio). CONTRATO_API.md
corregido en consecuencia.
```

## Regla de trabajo

Al terminar CUALQUIER tarea en apps/api/ (implementar un módulo, corregir un bug, tomar una
decisión no especificada), antes de dar la tarea por finalizada:

1. Revisá si generaste algo que corresponda comentar en Jira según los criterios de arriba.
2. Si sí, encontrá (o creá) el ticket correspondiente y posteá el comentario con el formato de
   arriba.
3. Mencioná en tu resumen final qué ticket comentaste (o creaste) y qué anotaste ahí.

Si una tarea no genera ningún pendiente ni decisión no especificada, no hace falta comentar nada
en Jira — no generes comentarios artificiales solo para tener actividad.

# Órbita — contexto del proyecto

## Arquitectura / decisiones técnicas

### Auth: NO usa Supabase Auth

El proyecto **ya no usa Supabase Auth**, a pesar de que documentación vieja (incluyendo
descripciones de tareas en Jira) todavía lo mencione. La autenticación es propia:

- Contraseñas hasheadas con **argon2id**.
- **JWT firmado con clave propia (HS256)** — no tokens de Supabase.
- Tablas propias en Prisma: `refresh_tokens` y `password_reset_tokens`.
- Cada negocio (`businessId`) tiene sus propias credenciales **completamente aisladas**: el
  mismo email puede existir como `member` en un negocio y `customer` en otro, con
  contraseñas independientes entre sí.

Ver [`apps/api/src/auth/auth.service.ts`](apps/api/src/auth/auth.service.ts) y
[`apps/api/src/common/guards/auth.guard.ts`](apps/api/src/common/guards/auth.guard.ts) como
fuente de verdad del flujo actual. No asumas Supabase Auth por default ni propongas volver a
él — si una tarea o documento lo menciona, es una referencia desactualizada.

**Migración 100% completa (2026-07-20):** no quedan resabios de la coexistencia con Supabase
Auth. La columna `authUserId` (que se había conservado temporalmente en `Member`, `Customer` y
`PlatformAdmin` tras la migración inicial del 2026-07-18) fue eliminada del schema, del tipo
`AuthContext` y de `AuthGuard` — ver `PENDIENTES.md` § Fase 1 — Auth para el detalle.

### Google OAuth (RBT-287)

Login/registro con Google, además del propio (email+password). Mismo esquema de auth que el
resto — sin Passport, sin tokens de Google en el JWT propio. `google-auth-library` (oficial de
Google) hace el intercambio de `code` y la verificación del `id_token`; todo lo demás (state
firmado, resolución de negocio, vinculación de cuentas, emisión de sesión) es código propio.

- **Campo de vínculo:** `googleId` en `Member`/`Customer`, `@@unique([businessId, googleId])`
  — mismo criterio de aislamiento que `email`. Storefront resuelve siempre contra `customer` de
  ESE `businessId`; apex resuelve siempre contra `member` global y **nunca** crea negocio.
- **Vincula, nunca duplica**, en ambas direcciones (ver
  [`auth.service.ts`](apps/api/src/auth/auth.service.ts) `googleLoginStorefront()`/
  `googleLoginApex()` y `register()` — el segundo caso no necesitó código nuevo, ver
  `PENDIENTES.md` § RBT-287).
- **El JWT nunca viaja en una URL:** `/auth/google/callback` intercambia un código de un solo
  uso (60s, en memoria — ver `google-oauth-exchange.store.ts`) que el BFF de Next.js
  (`pages/api/auth/google/exchange.ts`) canjea servidor-a-servidor por la sesión real.
- Ver [`apps/api/src/auth/google-auth.service.ts`](apps/api/src/auth/google-auth.service.ts),
  [`google-auth.controller.ts`](apps/api/src/auth/google-auth.controller.ts) y
  `test/google-auth.e2e-spec.ts` como fuente de verdad del flujo y su cobertura.
