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
`apps/api/prisma/`. Ver [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) y
[`apps/api/DEPLOYMENT.md`](apps/api/DEPLOYMENT.md) para el detalle completo
antes de asumir que "pushear alcanza" o de mencionar Railway.

## Skill de UI/UX: ui-ux-pro-max

Para **cualquier** tarea de diseño o UI/UX en `apps/web/` — crear, mejorar, revisar o
refactorizar pantallas, componentes, paletas, tipografías, animaciones o layouts del panel,
el storefront, las plantillas de home o la landing (`orbita.site`) — invocá siempre la skill
**`ui-ux-pro-max`** antes de ponerte a diseñar o tocar estilos. Aplica para todo el equipo que
la tenga disponible, no es una preferencia personal de una sesión puntual.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
