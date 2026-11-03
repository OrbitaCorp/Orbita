# Entorno de staging

**Fecha:** 2026-10-24 · **Estado:** implementado y funcionando (2026-10-24). Uso: `apps/api/DEPLOYMENT.md` § Staging

## Para qué

Probar features nuevas en la nube (servidor, dominio y HTTPS reales) sin tocar producción ni a
los negocios reales. Es "el entorno local de desarrollo, pero en la nube": misma base de dev,
claves de prueba y nada que le llegue a un cliente real.

Fuera de alcance: copiar datos de producción (ya existe la herramienta en
`docs/base-de-prueba.md` si después hace falta), feature flags por negocio y deploy gradual de
producción.

## Arquitectura

```
negocio.caudaliguazu.com.ar / caudaliguazu.com.ar   (Vercel, proyecto "orbita-staging")
        │ fetch NEXT_PUBLIC_API_URL
        ▼
orbita-api-staging-<hash>.southamerica-east1.run.app   (Cloud Run, proyecto GCP orbita-api-corp)
        │ Prisma (secrets STAGING_*)
        ▼
Supabase DEV "orbitiando al backend" (hhaqlzrcskmwnvhgydon)
```

- **Dominio aparte** (`caudaliguazu.com.ar`, DNS en Cloudflare): ninguna cookie de
  `.orbita.site` llega a staging ni al revés. `ROOT_DOMAIN=caudaliguazu.com.ar`.
- **DNS en Cloudflare, sin mover nameservers** (método de Vercel para DNS externo):
  - `@` → A `76.76.21.21` (apex = plataforma/panel) · `www` → CNAME a Vercel
  - `*` → CNAME `cname.vercel-dns-0.com` (tiendas)
  - `_acme-challenge` → NS `ns1.vercel-dns.com` y `ns2.vercel-dns.com` (certificado comodín)
  - Todos en **DNS only** (nube gris): Cloudflare no hace de proxy.
- **API sin dominio propio**: la URL `*.run.app` alcanza. Las cookies las pone el frontend
  (BFF), no la API, así que el host de la API no importa.

## Configuración que difiere de producción

| Pieza | Staging |
|---|---|
| Servicio | `orbita-api-staging`, 1 vCPU, 1 GiB, min 0 / max 2 instancias |
| Base | dev, vía secrets `STAGING_DATABASE_URL` / `STAGING_DIRECT_URL` |
| Secrets | prefijo `STAGING_` en Secret Manager, cargados desde el `.env` de dev sin imprimirlos |
| `env-vars` | `deploy/env-vars.staging.yaml` (se commitea, sin secretos) |
| `NODE_ENV` | `production` (igual que prod: mismo build, mismas compuertas) |
| `TRUST_PROXY_HOPS` | `1` (no hay Firebase delante; con 2 se puede falsear la IP) |
| `FRONTEND_URL` | `https://caudaliguazu.com.ar` |
| `VERCEL_TOKEN` | **no se monta**: daría de alta dominios de tiendas en el proyecto de PRODUCCIÓN |
| Fotos | Supabase Storage del proyecto de dev (`STAGING_SUPABASE_URL` / `STAGING_SUPABASE_SERVICE_ROLE_KEY`) |
| Videos (R2) | bucket `orbita-dev` (cuenta Cloudflare de Órbita), compartido con el entorno local; la clave solo puede tocar ese bucket |
| Resend | remitente `onboarding@resend.dev`: solo entrega al dueño de la cuenta |
| WhatsApp / Instagram / TikTok | apagados: lista de habilitados vacía y sin secrets |
| Google login | valores de dev (la API no arranca sin ellos); el login con Google no anda porque el redirect de staging no está registrado |
| Mercado Pago | valores de relleno de dev (`local-dev-placeholder`), por la misma razón |
| Cuenta de servicio | `orbita-api-staging@`, solo lee los secrets `STAGING_*` |
| Crons | ninguno automático; se disparan a mano con `CRON_SECRET` de staging |
| Buscadores | `X-Robots-Tag: noindex` en todo el frontend de staging |

## Flujo de uso

`./deploy/staging.sh` desde **cualquier rama, sin push**:

1. Preflight liviano: typecheck de api (el de web lo hace `next build` en Vercel). No exige `main` ni CI, porque staging es justamente
   para probar lo que todavía no está en `main`.
2. Migraciones: avisa si hay pendientes en dev y las aplica con `prisma migrate deploy` (el
   `.env` local es dev).
3. API: `gcloud builds submit` con tag `staging-<sha>[-dirty]` y `gcloud run deploy
   orbita-api-staging`.
4. Frontend: `vercel deploy --prod` al proyecto `orbita-staging` (subida desde el disco, sin git).
5. Imprime las URLs.

No se pushea nada a GitHub, así que no puede repetirse el problema de "Vercel ya construyó este
commit como preview" del CLAUDE.md. El proyecto Vercel `orbita-staging` no se conecta a git.

## Riesgos / verificar al implementar

- `deploy.sh` de producción no cambia. `staging.sh` es un script aparte y nunca toca
  `orbita-api`.
- El `.env` de dev tiene bytes nulos al final (una línea `GEMINI_API_KEY` duplicada, guardada en
  UTF-16): limpiarlo antes de leerlo.
- Mercado Pago: en dev solo hay valores de relleno para OAuth; `MP_ACCESS_TOKEN` (APP_USR) no se monta en staging.
- El freno de gasto (`budget-guard`) cubre el proyecto GCP entero, staging incluido.

## Pruebas

- `curl` a `/api/v1/health` (o el endpoint de salud que exista) de la URL de staging.
- Abrir `negocio.caudaliguazu.com.ar` y `caudaliguazu.com.ar` en el navegador: certificado
  válido, login de dueño, panel y storefront contra la base de dev.
- Comprobar en Cloud Run que `orbita-api` (producción) sigue en la misma revisión.
