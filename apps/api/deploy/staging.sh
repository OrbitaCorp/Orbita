#!/usr/bin/env bash
# Sube lo que tenés en el disco (cualquier rama, con o sin commitear) al
# entorno de STAGING: API en Cloud Run (orbita-api-staging) y frontend en
# Vercel (proyecto orbita-staging). No pushea nada a GitHub y NUNCA toca
# producción (servicio orbita-api, proyecto de Vercel de producción).
# Diseño: docs/superpowers/specs/2026-10-24-entorno-staging-design.md
#
# Uso:
#   cd apps/api
#   ./deploy/staging.sh              API + frontend
#   ./deploy/staging.sh --solo-api
#   ./deploy/staging.sh --solo-web
#   STAGING_SIN_TYPECHECK=1 ./deploy/staging.sh   saltea el typecheck
#
# Base: la de DEV (la misma del .env local). Si la rama trae migraciones nuevas,
# se aplican en dev antes de desplegar, igual que en el paso 2 del flujo del
# CLAUDE.md de la raíz.
#
# Secrets: STAGING_* en Secret Manager (los carga ./deploy/staging-secretos.sh).

set -euo pipefail

PROJECT_ID="orbita-api-corp"
REGION="southamerica-east1"
SERVICE="orbita-api-staging"
SA_EMAIL="orbita-api-staging@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/orbita-api/orbita-api"
VERCEL_PROYECTO="orbita-staging"
VERCEL_PROYECTO_ID="prj_Kn76jP70VpnWT7YSCRoIxp6itHEa"
VERCEL_EQUIPO_ID="team_GDb8FqCjzYMRIVrvwuGIgG0S" # "OrbitaCorp's projects"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$(cd "$API_DIR/../web" && pwd)"
ENV_FILE="${SCRIPT_DIR}/env-vars.staging.yaml"

# Mismo nombre de variable adentro del contenedor que en producción; solo cambia
# el secret del que sale. Google y Mercado Pago van con los valores de dev (la
# API no arranca sin ellos); sin WhatsApp, Instagram, TikTok ni VERCEL_TOKEN
# (ver env-vars.staging.yaml).
SECRETS="DATABASE_URL=STAGING_DATABASE_URL:latest,DIRECT_URL=STAGING_DIRECT_URL:latest,JWT_SECRET=STAGING_JWT_SECRET:latest,CRON_SECRET=STAGING_CRON_SECRET:latest,GEMINI_API_KEY=STAGING_GEMINI_API_KEY:latest,GROQ_API_KEY=STAGING_GROQ_API_KEY:latest,CF_WORKERS_AI_API_TOKEN=STAGING_CF_WORKERS_AI_API_TOKEN:latest,RESEND_API_KEY=STAGING_RESEND_API_KEY:latest,MERCADOPAGO_TOKEN_KEY=STAGING_MERCADOPAGO_TOKEN_KEY:latest,MERCADOPAGO_CLIENT_SECRET=STAGING_MERCADOPAGO_CLIENT_SECRET:latest,GOOGLE_CLIENT_SECRET=STAGING_GOOGLE_CLIENT_SECRET:latest,SUPABASE_URL=STAGING_SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=STAGING_SUPABASE_SERVICE_ROLE_KEY:latest,R2_ACCESS_KEY_ID=STAGING_R2_ACCESS_KEY_ID:latest,R2_SECRET_ACCESS_KEY=STAGING_R2_SECRET_ACCESS_KEY:latest"

HACER_API=1
HACER_WEB=1
case "${1:-}" in
  --solo-api) HACER_WEB=0 ;;
  --solo-web) HACER_API=0 ;;
  "") ;;
  *) echo "Opción desconocida: $1" >&2; exit 1 ;;
esac

GIT_SHA="$(git -C "$API_DIR" rev-parse --short HEAD)"
RAMA="$(git -C "$API_DIR" rev-parse --abbrev-ref HEAD)"
SUCIO=""
[[ -n "$(git -C "$API_DIR" status --porcelain)" ]] && SUCIO="-sucio"
TAG="staging-${GIT_SHA}${SUCIO}"

echo "==> Staging desde la rama '${RAMA}' (${GIT_SHA}${SUCIO:+, con cambios sin commitear})"

if [[ "${STAGING_SIN_TYPECHECK:-}" != "1" ]]; then
  if [[ "$HACER_API" == "1" ]]; then
    echo "==> Typecheck de apps/api"
    (cd "$API_DIR" && pnpm typecheck)
  fi
  # apps/web no se chequea acá: `next build` en Vercel ya chequea los tipos, en
  # Linux. En Windows el tsc local falla por Markdown.tsx / markdown.ts (misma
  # carpeta, solo cambia la mayúscula), que en Linux no es un problema.
fi

if [[ "$HACER_API" == "1" ]]; then
  echo "==> Migraciones en la base de DEV"
  # El .env local es dev (CLAUDE.md § Dos bases). staging-secretos.sh se niega a
  # cargar una URL que no sea la de dev, así que acá migra lo mismo que lee staging.
  (cd "$API_DIR" && pnpm exec prisma migrate deploy)

  echo "==> Buildeando imagen ${IMAGE_BASE}:${TAG}"
  (cd "$API_DIR" && gcloud builds submit \
    --tag "${IMAGE_BASE}:${TAG}" \
    --project "$PROJECT_ID" \
    --gcs-log-dir "gs://${PROJECT_ID}-build-logs/logs" \
    .)

  echo "==> Desplegando ${SERVICE} (producción, orbita-api, no se toca)"
  gcloud run deploy "$SERVICE" \
    --image "${IMAGE_BASE}:${TAG}" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --service-account "$SA_EMAIL" \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --cpu-throttling \
    --min-instances 0 \
    --max-instances 2 \
    --concurrency 40 \
    --timeout 300 \
    --port 8080 \
    --labels entorno=staging \
    --env-vars-file "$ENV_FILE" \
    --set-secrets "$SECRETS" \
    --quiet
fi

if [[ "$HACER_WEB" == "1" ]]; then
  echo "==> Frontend a Vercel (proyecto ${VERCEL_PROYECTO})"
  # Por IDs y no con `vercel link`: link puede conectar el repo de GitHub al
  # proyecto, y entonces staging se construiría solo en cada push. El proyecto
  # de staging NO tiene git conectado a propósito. Lo que sube lo filtra
  # apps/web/.vercelignore. Las variables del proyecto (NEXT_PUBLIC_API_URL,
  # NEXT_PUBLIC_ROOT_DOMAIN, NOINDEX) se configuran una vez en Vercel, no acá.
  (cd "$WEB_DIR" && VERCEL_ORG_ID="$VERCEL_EQUIPO_ID" VERCEL_PROJECT_ID="$VERCEL_PROYECTO_ID" vercel deploy --prod --yes)
fi

echo ""
echo "==> Listo."
if [[ "$HACER_API" == "1" ]]; then
  echo "    API:  $(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')/api/v1"
fi
echo "    Web:  https://caudaliguazu.com.ar  ·  tiendas: https://<subdominio>.caudaliguazu.com.ar"
