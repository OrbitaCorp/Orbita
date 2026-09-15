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

### Backend: Google Cloud Run, NO Railway — y el deploy es manual

El backend (`apps/api/`) **ya no corre en Railway**, corre en **Google Cloud Run**
desde el 2026-08-31. Un push a `main` despliega el FRONTEND solo (Vercel) — el
backend **no tiene CI/CD**, hay que desplegarlo a mano con `cd apps/api &&
./deploy/deploy.sh` cada vez que se toque algo en `apps/api/src/` o
`apps/api/prisma/`, y **solo después de que el cambio esté en `main` con CI verde**:
el script tiene un preflight que lo exige (hallazgo `deploy-manual` de la auditoría
interna). Ver [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) y
[`apps/api/DEPLOYMENT.md`](apps/api/DEPLOYMENT.md) para el detalle completo
antes de asumir que "pushear alcanza" o de mencionar Railway.

## Commit y push: cómo llevar un cambio a producción (OBLIGATORIO)

Cuando Ale (o quien sea) pida "hacé commit y pusheá", "subilo", "metelo en producción" o
similar, el objetivo SIEMPRE es que el cambio quede en producción, no en un preview. Seguir
este orden exacto, sin saltear pasos:

1. **Commitear en la rama de trabajo.** Antes, `git fetch origin` y, si `origin/main` avanzó,
   `git merge origin/main` en la rama y resolver conflictos. Correr typecheck (`tsc --noEmit`
   en `apps/web` y `apps/api`) y los tests unitarios de la API si se tocó `apps/api`.
2. **Si el cambio toca `apps/api/prisma/migrations/`:** aplicar la migración en producción con
   `cd apps/api && pnpm exec prisma migrate deploy` ANTES de desplegar la API. La base local
   ES la de producción, así que esto ya es producción. `deploy.sh` se niega a desplegar si
   quedó alguna migración sin aplicar. Si la migración es destructiva (borra o renombra
   algo), leer antes `apps/api/DEPLOYMENT.md` § Rollback: se hace en dos releases.
3. **Frontend: se pushea SOLO `main`. La rama de trabajo NO se pushea.** Vercel construye
   cada commit UNA sola vez. Si el commit llega primero por la rama de feature, Vercel lo
   despliega como *Preview*, y cuando `main` avanza al mismo commit por fast-forward lo
   ignora: producción queda vieja. Y pushear la rama después de `main` tampoco sirve: es el
   mismo commit dos veces en GitHub, parece un duplicado. Un solo push:
   ```
   git checkout main && git merge --ff-only <rama> && git push origin main
   git checkout <rama>
   ```
   La rama queda solo local (o desactualizada en origin, da igual). Pushearla únicamente si
   Ale lo pide explícito, por ejemplo para abrir un PR o compartirla.
   Si por error la rama ya se pusheó antes que `main`, hacer un commit vacío en `main`
   (`git commit --allow-empty -m "chore: forzar deploy de producción"`) y pushearlo.
4. **Verificar que fue a producción, no a preview, y esperar CI verde.** El estado "Vercel
   success" en el commit NO alcanza (también es success en un preview). Chequear el entorno
   del deployment y los check runs de CI (`.github/workflows/ci.yml`, corre en cada push a
   `main`):
   ```
   gh api "repos/OrbitaCorp/Orbita/deployments?sha=<sha completo de main>" --jq '.[] | "\(.environment) \(.sha[0:5])"'
   gh api "repos/OrbitaCorp/Orbita/commits/<sha completo de main>/check-runs" --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'
   ```
   Tiene que decir `Production`, y `API — typecheck + tests` y `Web — typecheck` tienen que
   estar `completed success` (`Web — lint (informativo)` puede estar en failure: no bloquea).
   Esperar a que el commit status pase de `pending` a `success` y recién ahí seguir. El
   Vercel CLI de esta máquina está logueado con una cuenta personal que no ve el proyecto
   de Órbita: no sirve para esto.
5. **Si el cambio toca `apps/api/src/` o `apps/api/prisma/`: desplegar la API a Cloud Run
   RECIÉN AHORA**, con `main` pusheado y CI verde, con `cd apps/api && ./deploy/deploy.sh`
   (necesita `gcloud auth login` con `contacto@orbita-corp.com`; si no hay cuenta logueada,
   pedirle a Ale que corra `! gcloud auth login` y recién después correr el script). Un push
   a `main` NO despliega la API. Verificar con `gcloud run services describe orbita-api
   --region southamerica-east1 --project orbita-api-corp` que la revisión nueva esté
   sirviendo el 100% del tráfico.
   **Por qué la API va después de `main` y no antes** (hallazgo `deploy-manual` de la
   auditoría interna): a producción va solo lo que ya está en `main` con CI verde, y
   `deploy.sh` ahora lo exige con un preflight (árbol limpio, HEAD contenido en
   `origin/main`, typecheck + tests, sin migraciones pendientes, check runs de CI en
   success): si se corre desde la rama o antes del push, corta con exit 1 sin buildear.
   **Trade-off:** con este orden Vercel publica el frontend unos minutos antes de que la API
   nueva esté sirviendo. Si el frontend necesita un endpoint nuevo, correr `deploy.sh` apenas
   CI da verde (el preflight tarda ~10 minutos por los tests: avisar que está corriendo). Si
   un cambio no tolera ni esa ventana (el storefront rompe sin el endpoint), la excepción
   documentada es desplegar la API PRIMERO, desde `main` ya pusheado, con
   `DEPLOY_SIN_PREFLIGHT=1 ./deploy/deploy.sh`: imprime un aviso grande y pide confirmar
   escribiendo `si` en la consola (sin tty aborta), así que lo tiene que correr Ale, y hay
   que decirlo en el reporte. `DEPLOY_SOLO_PREFLIGHT=1` corre solo el preflight, sin
   desplegar, para responder "¿se puede desplegar ya?".
6. **Reportar** en el mensaje final: sha en `main`, entorno del deployment de Vercel, si CI
   quedó en verde, y (si aplica) la revisión de Cloud Run y si la migración quedó aplicada.

## Skill de UI/UX: ui-ux-pro-max

Para **cualquier** tarea de diseño o UI/UX en `apps/web/` — crear, mejorar, revisar o
refactorizar pantallas, componentes, paletas, tipografías, animaciones o layouts del panel,
el storefront, las plantillas de home o la landing (`orbita.site`) — invocá siempre la skill
**`ui-ux-pro-max`** antes de ponerte a diseñar o tocar estilos. Aplica para todo el equipo que
la tenga disponible, no es una preferencia personal de una sesión puntual.

### MCP server de shadcn/React Bits

El repo tiene configurado un servidor MCP (`.mcp.json`, server `shadcn`) que da acceso al
registro de componentes de **shadcn** y de **React Bits** (react-bits.dev — 171+ componentes
animados: fondos interactivos, efectos de texto, backgrounds, etc.) directo desde Claude Code
o Cursor. Cualquiera del equipo que abra el repo con Claude Code lo tiene disponible
automáticamente (pide aprobación la primera vez) — no hace falta instalar nada aparte, ya
quedó commiteado en `.mcp.json`. Si alguien lo usa desde otro cliente (Cursor, VS Code) y no
lo tiene, correr `npx shadcn@latest mcp init --client <cursor|vscode>` una vez en el repo.

Usarlo para tareas de UI que necesiten componentes visuales ya armados (animaciones de texto,
fondos, bloques de landing) en vez de escribirlos desde cero — sobre todo en la landing
(`orbita.site`) y las plantillas de home.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
