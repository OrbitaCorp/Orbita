# Órbita — contexto del proyecto

## Entornos: local, staging y producción (leer antes de tocar deploy, base o infra)

| | Local | Staging | Producción |
|---|---|---|---|
| Frontend | `localhost:3001` / `*.orbita.local:3001` | `caudaliguazu.com.ar`, tiendas `<sub>.caudaliguazu.com.ar` (Vercel `orbita-staging`, sin git) | `orbita.site`, tiendas `<sub>.orbita.site` (Vercel `orbita-frontend`) |
| API | `localhost:3000` | Cloud Run `orbita-api-staging` (`*.run.app`) | `api.orbita.site` → Firebase Hosting → Cloud Run `orbita-api` |
| Base (Supabase) | **dev** "orbitiando al backend" `hhaqlzrcskmwnvhgydon` | **dev** (la misma) | "Orbita Produccion" `dgergykdihtvsglfumsb` |
| Fotos (Supabase Storage) | proyecto de dev | proyecto de dev | proyecto de producción |
| Videos (Cloudflare R2) | bucket `orbita-dev` | bucket `orbita-dev` | bucket `orbita` |
| Secrets | `apps/api/.env` | Secret Manager `STAGING_*` | Secret Manager (sin prefijo) |
| Cómo se sube | — | `cd apps/api && ./deploy/staging.sh` (cualquier rama, sin push) | push a `main` (frontend) + `./deploy/deploy.sh` (API) |

- **El `.env` local es DEV.** `pnpm exec prisma migrate deploy`, `pnpm seed` y los e2e tocan dev.
  Producción solo con `apps/api/deploy/prisma-prod.sh migrate status|deploy` (lee las URLs de
  Secret Manager, verifica que sean las de producción y no las imprime). Nunca leer, copiar ni
  pegar en el chat el valor de una URL de base.
- **Staging** es "el `.env` de dev en la nube": misma base, Resend que solo entrega al dueño de la
  cuenta, sin WhatsApp/Instagram/TikTok, sin crons, y login con Google y conexión con Mercado
  Pago que no andan. Nunca toca producción ni exige `main`/CI. Su cuenta de servicio solo lee los
  secrets `STAGING_*`. Detalle: `apps/api/DEPLOYMENT.md` § Staging.
- **Backend en Google Cloud Run** (proyecto GCP `orbita-api-corp`, `southamerica-east1`) desde el
  2026-08-31. **No es Railway**: si algo lo menciona, está desactualizado.
- **El backend no tiene CI/CD, a propósito.** Un push a `main` publica solo el frontend. La API se
  despliega a mano con `deploy.sh`, y solo lo que ya está en `main` con CI verde: el preflight
  lo exige (árbol limpio, HEAD en `origin/main`, CI en verde para ese sha esperando hasta 15 min,
  sin migraciones pendientes **en producción**; typecheck + tests locales solo si no puede
  verificar CI o con `DEPLOY_TESTS_LOCALES=1`). `DEPLOY_SOLO_PREFLIGHT=1` = "¿se puede desplegar
  ya?". `DEPLOY_SIN_PREFLIGHT=1` es la salida de emergencia: pide escribir `si` en la consola, así
  que la corre una persona, nunca un agente.
- **Secrets:** Secret Manager, montados con `--set-secrets` (`SECRETS=` en `deploy.sh` y en
  `staging.sh`, siempre `:latest`). Un secret nuevo va también a esa lista. Lo no sensible:
  `deploy/env-vars.yaml` y `deploy/env-vars.staging.yaml` (se commitean).
- **Cron:** no hay `@Cron` en el proceso. Son endpoints de `src/internal-cron/` disparados por Cloud
  Scheduler (3 jobs, solo en producción).
- **Freno de gasto:** al llegar al presupuesto mensual, una Cloud Function pone la API en 503
  (`deploy/budget-guard/`).
- **Rollback:** `gcloud run services update-traffic` a la revisión anterior (segundos). No revierte la
  base: las migraciones destructivas van en dos releases (`DEPLOYMENT.md` § Rollback).
- **Accesos:** `gcloud auth login` con `contacto@orbita-corp.com`. La CLI de Vercel tiene que estar en
  el equipo **OrbitaCorp** (`vercel teams ls`), no en una cuenta personal. En Git Bash, `vercel api`
  necesita `MSYS_NO_PATHCONV=1`.

Runbook completo (accesos, secrets, logs, rollback, cron, troubleshooting): `apps/api/DEPLOYMENT.md`.

## Auth: propia, NO Supabase Auth

Aunque documentación vieja o tickets de Jira lo mencionen, **no se usa Supabase Auth**: contraseñas
con **argon2id**, **JWT propio HS256**, tablas `refresh_tokens` y `password_reset_tokens`. Cada
negocio (`businessId`) tiene credenciales **aisladas**: el mismo email puede ser `member` en un
negocio y `customer` en otro, con contraseñas distintas. Fuente de verdad:
[`auth.service.ts`](apps/api/src/auth/auth.service.ts) y
[`auth.guard.ts`](apps/api/src/common/guards/auth.guard.ts). No proponer volver a Supabase Auth.

## Commit y push: cómo llevar un cambio a producción (OBLIGATORIO)

Cuando alguien pida "hacé commit y pusheá", "subilo", "metelo en producción" o similar, el objetivo
es que quede **en producción**, no en un preview. Este orden, sin saltear pasos:

1. **Commitear en la rama de trabajo.** Antes, `git fetch origin` y, si `origin/main` avanzó,
   `git merge origin/main` y resolver conflictos. Typecheck (`tsc --noEmit` en `apps/web` y
   `apps/api`) y tests unitarios de la API si se tocó `apps/api`.
2. **Migraciones (`apps/api/prisma/migrations/`): dos bases, dos aplicaciones.** Ahora, en la rama,
   en **dev** (`cd apps/api && pnpm exec prisma migrate deploy`) y probar ahí. La de producción, en
   el paso 5. Si es destructiva (borra o renombra), leer antes `DEPLOYMENT.md` § Rollback. Si el
   cambio toca algo que solo Postgres prueba (por ejemplo Orbi: acciones, cuota, historial),
   correr sus e2e contra dev (`DEPLOYMENT.md` § Correr los e2e contra dev; nunca contra producción).
3. **Se pushea SOLO `main`; la rama de trabajo NO.** Vercel construye cada commit una sola vez: si
   llega primero por la rama, queda como *Preview*, y cuando `main` avanza al mismo commit por
   fast-forward lo ignora y producción queda vieja.
   ```
   git checkout main && git merge --ff-only <rama> && git push origin main
   git checkout <rama>
   ```
   Pushear la rama solo si lo piden explícitamente (para un PR, por ejemplo). Si ya se pusheó antes
   que `main`: `git commit --allow-empty -m "chore: forzar deploy de producción"` en `main` y
   pushearlo. (Staging no tiene este problema: `staging.sh` no pushea nada.)
4. **Verificar que fue a producción y esperar CI verde.** "Vercel success" no alcanza (un preview
   también da success):
   ```
   gh api "repos/OrbitaCorp/Orbita/deployments?sha=<sha completo de main>" --jq '.[] | "\(.environment) \(.sha[0:5])"'
   gh api "repos/OrbitaCorp/Orbita/commits/<sha completo de main>/check-runs" --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'
   ```
   Tiene que decir `Production`, y `API — typecheck + tests` y `Web — typecheck` tienen que estar
   en `completed success` (`Web — lint (informativo)` puede fallar: no bloquea).
5. **Si se tocó `apps/api/src/` o `apps/api/prisma/`: desplegar la API RECIÉN AHORA.** Si hay
   migraciones: `./deploy/prisma-prod.sh migrate deploy` y confirmar con `migrate status`. Después
   `cd apps/api && ./deploy/deploy.sh` (sin sesión de gcloud, pedir `! gcloud auth login`), y
   verificar con `gcloud run services describe orbita-api --region southamerica-east1 --project
   orbita-api-corp` que la revisión nueva tenga el 100% del tráfico. Con este orden el frontend
   sale unos minutos antes que la API: si necesita un endpoint nuevo, correr `deploy.sh` apenas CI
   dé verde. Si ni esa ventana se tolera (el storefront rompe sin el endpoint), la excepción es
   desplegar la API primero, desde `main` ya pusheado, con `DEPLOY_SIN_PREFLIGHT=1` (lo corre una
   persona; decirlo en el reporte).
6. **Reportar:** sha en `main`, entorno del deployment de Vercel, CI, y si aplica la revisión de
   Cloud Run y si la migración quedó aplicada en **producción** (y en dev).

## El manual del panel es lo que sabe Orbi

Si tocás una pantalla del panel, actualizá su tema en
`apps/web/src/modules/ventas/panel/manual/contenido.ts` y regenerá con
`cd apps/web && pnpm manual:generar` (commiteando `apps/api/src/orbi/manual/manual.generated.ts`).
`pnpm test` de `apps/web` falla si el manual nombra un botón que no existe o si el artefacto quedó
viejo. Detalle en `.claude/rules/manual.md`.

## Prospección y videos automatizados (Superadmin → Marketing)

Dos herramientas que usan **el Claude que paga cada persona** (sin clave de API) por **un solo
conector MCP** (`apps/api/src/marketing/prospeccion/mcp/`, `https://api.orbita.site/api/v1/mcp`):
la **prospección** de tiendas de Instagram (API de Meta, puntaje, análisis y borradores de mensaje)
y la **cola de videos** (reels generados en la PC de quien los pide, aprobados en el panel y
pasados como borrador a TikTok o Instagram). **Nada se envía ni se publica solo.** Qué son, costos
y controles: [`docs/marketing/FLUJO-PROSPECCION-Y-VIDEOS.md`](docs/marketing/FLUJO-PROSPECCION-Y-VIDEOS.md).
Deploy: `DEPLOYMENT.md` § Prospección y § Cola de videos. Si tocás esa API, el conector o las
pantallas, mantené el documento al día.

## UI/UX: skill ui-ux-pro-max y MCP de shadcn/React Bits

Para **cualquier** tarea de diseño o UI/UX en `apps/web/` (pantallas, componentes, paletas,
tipografías, animaciones o layouts del panel, el storefront, las plantillas de home o la landing),
invocá primero la skill **`ui-ux-pro-max`**. Aplica a todo el equipo, no es una preferencia de una
sesión.

`.mcp.json` trae el servidor MCP `shadcn`, con el registro de **shadcn** y **React Bits**
(react-bits.dev, 171+ componentes animados: fondos, efectos de texto). En Claude Code está
disponible solo (pide aprobación la primera vez). Desde Cursor o VS Code:
`npx shadcn@latest mcp init --client <cursor|vscode>`. Usarlo antes de escribir desde cero
componentes visuales, sobre todo en la landing y las plantillas de home.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- El grafo (`graphify-out/`, ignorado por git) es local de cada máquina y se actualiza solo en cada
  commit con el hook de git de graphify. Una vez por máquina nueva: `graphify hook install` en la
  raíz del repo. Si un `graphify query` devuelve cosas que ya no existen, correr `graphify update .`.
