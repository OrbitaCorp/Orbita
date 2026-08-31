#!/usr/bin/env bash
# Deploy manual de apps/api a Cloud Run (proyecto orbita-api-corp, región
# southamerica-east1). Ver ../DEPLOYMENT.md para el contexto completo.
#
# Uso:
#   cd apps/api
#   ./deploy/deploy.sh
#
# Requiere: gcloud CLI autenticado (gcloud auth login) con permisos sobre
# el proyecto orbita-api-corp (ver DEPLOYMENT.md § Accesos necesarios).

set -euo pipefail

PROJECT_ID="orbita-api-corp"
REGION="southamerica-east1"
SERVICE="orbita-api"
REPO="orbita-api"
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/orbita-api"

# Tag con el SHA corto del commit actual, para poder identificar y hacer
# rollback a una imagen puntual más adelante (ver DEPLOYMENT.md § Rollback).
GIT_SHA="$(git rev-parse --short HEAD)"
IMAGE_TAGGED="${IMAGE_BASE}:${GIT_SHA}"
IMAGE_LATEST="${IMAGE_BASE}:latest"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${SCRIPT_DIR}/env-vars.yaml"

SECRETS="DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GROQ_API_KEY=GROQ_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest,MERCADOPAGO_CLIENT_SECRET=MERCADOPAGO_CLIENT_SECRET:latest,MERCADOPAGO_TOKEN_KEY=MERCADOPAGO_TOKEN_KEY:latest,MP_ACCESS_TOKEN=MP_ACCESS_TOKEN:latest,MP_WEBHOOK_SECRET=MP_WEBHOOK_SECRET:latest,RESEND_API_KEY=RESEND_API_KEY:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest"

echo "==> Buildeando y subiendo imagen: ${IMAGE_TAGGED}"
cd "$API_DIR"
gcloud builds submit \
  --tag "$IMAGE_TAGGED" \
  --project "$PROJECT_ID" \
  --gcs-log-dir "gs://${PROJECT_ID}-build-logs/logs" \
  .

echo "==> Tageando también como :latest"
gcloud artifacts docker tags add "$IMAGE_TAGGED" "$IMAGE_LATEST" --project "$PROJECT_ID"

echo "==> Desplegando a Cloud Run (servicio: ${SERVICE}, región: ${REGION})"
gcloud run deploy "$SERVICE" \
  --image "$IMAGE_TAGGED" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --no-cpu-throttling \
  --min-instances 1 \
  --max-instances 10 \
  --concurrency 40 \
  --port 8080 \
  --env-vars-file "$ENV_FILE" \
  --set-secrets "$SECRETS" \
  --quiet

echo ""
echo "==> Listo. Imagen desplegada: ${IMAGE_TAGGED}"
echo "==> URL directa de Cloud Run:"
gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format="value(status.url)"
echo "==> Dominio de producción: https://api.orbita.site (vía Firebase Hosting proxy)"
