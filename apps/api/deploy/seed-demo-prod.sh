#!/usr/bin/env bash
# Corre `pnpm seed:demo <args>` contra PRODUCCIÓN: base "Orbita Produccion"
# (Supabase ref dgergykdihtvsglfumsb), Storage de ese mismo proyecto y el
# bucket de R2 de producción. Es lo que sube fotos y videos y BORRA y vuelve a
# sembrar el contenido del negocio demo elegido (y de ninguno más: ver
# prisma/demo/sembrar.ts, que exige isDemo).
#
# Mismo criterio que prisma-prod.sh: lee los secrets de Secret Manager (los
# que Cloud Run monta con --set-secrets), verifica que sean los de producción
# y se los pasa SOLO al proceso del seed por variables de entorno. No se
# escriben a disco ni se imprimen. Las variables de entorno le ganan al .env
# local (process.loadEnvFile no pisa las que ya están).
#
# Uso (desde apps/api):
#   ./deploy/seed-demo-prod.sh --tienda moda          # Nébula Moda (demo-moda)
#   ./deploy/seed-demo-prod.sh                         # Nébula Tech (demo)
#   ./deploy/seed-demo-prod.sh --tienda moda --solo-apariencia
#
# La primera vez de una tienda hace falta DEMO_OWNER_PASSWORD en el entorno
# (la del dueño que la cura desde el panel). Después NO pasarla salvo para
# cambiarla: si viene, el seed la pisa.

set -euo pipefail

PROJECT_ID="orbita-api-corp"
PROD_REF="dgergykdihtvsglfumsb"
DEV_REF="hhaqlzrcskmwnvhgydon"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"

leer_secret() {
  local nombre="$1" valor
  if ! valor="$(gcloud secrets versions access latest --secret="$nombre" --project="$PROJECT_ID" 2>/dev/null)"; then
    {
      echo "No se pudo leer el secret ${nombre} de Secret Manager (proyecto ${PROJECT_ID})."
      echo "¿gcloud está logueado con la cuenta @orbita-corp.com (gcloud auth login)?"
    } >&2
    exit 1
  fi
  printf '%s' "$valor" | tr -d '\r'
}

verificar_es_produccion() {
  local nombre="$1" valor="$2"
  if [[ "$valor" == *"$DEV_REF"* || "$valor" != *"$PROD_REF"* ]]; then
    echo "El secret ${nombre} no apunta al proyecto de producción (${PROD_REF}). Se aborta." >&2
    exit 1
  fi
}

# Valor no secreto de deploy/env-vars.yaml (lo mismo que recibe Cloud Run).
leer_var() {
  sed -n "s/^$1: *\"\(.*\)\"/\1/p" "$SCRIPT_DIR/env-vars.yaml" | head -1
}

DATABASE_URL="$(leer_secret DATABASE_URL)"
DIRECT_URL="$(leer_secret DIRECT_URL)"
SUPABASE_URL="$(leer_secret SUPABASE_URL)"
verificar_es_produccion DATABASE_URL "$DATABASE_URL"
verificar_es_produccion DIRECT_URL "$DIRECT_URL"
verificar_es_produccion SUPABASE_URL "$SUPABASE_URL"
SUPABASE_SERVICE_ROLE_KEY="$(leer_secret SUPABASE_SERVICE_ROLE_KEY)"
R2_ACCESS_KEY_ID="$(leer_secret R2_ACCESS_KEY_ID)"
R2_SECRET_ACCESS_KEY="$(leer_secret R2_SECRET_ACCESS_KEY)"
R2_ACCOUNT_ID="$(leer_var R2_ACCOUNT_ID)"
R2_BUCKET="$(leer_var R2_BUCKET)"
R2_PUBLIC_URL="$(leer_var R2_PUBLIC_URL)"
if [[ "$R2_BUCKET" != "orbita" ]]; then
  echo "El bucket de R2 de env-vars.yaml no es el de producción (orbita). Se aborta." >&2
  exit 1
fi
export DATABASE_URL DIRECT_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ACCOUNT_ID R2_BUCKET R2_PUBLIC_URL
# Sin DEMO_OWNER_PASSWORD en el entorno, que tampoco la tome del .env local.
export DEMO_OWNER_PASSWORD="${DEMO_OWNER_PASSWORD:-}"

echo "==> seed:demo $* contra PRODUCCIÓN (${PROD_REF}, bucket ${R2_BUCKET})" >&2
cd "$API_DIR"
exec pnpm seed:demo -- "$@"
