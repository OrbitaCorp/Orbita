#!/usr/bin/env bash
# Corre `prisma <args>` contra la base de PRODUCCIÓN ("Orbita Produccion",
# Supabase ref dgergykdihtvsglfumsb), la misma que usa Cloud Run.
#
# Por qué existe: el `.env` local de apps/api apunta a la base de DESARROLLO
# (hhaqlzrcskmwnvhgydon) desde el corte del 2026-09-20. Un `prisma migrate
# deploy` o `migrate status` pelado NO toca producción. Este script arma las
# URLs de producción desde Secret Manager (los mismos secrets que Cloud Run
# monta con --set-secrets, versión `latest`) y se las pasa SOLO al proceso de
# prisma por variables de entorno: no se escriben a disco ni se imprimen.
#
# Uso (desde apps/api):
#   ./deploy/prisma-prod.sh migrate status    # solo lectura
#   ./deploy/prisma-prod.sh migrate deploy    # APLICA migraciones en producción
#
# Requiere gcloud autenticado (cuenta @orbita-corp.com) con
# roles/secretmanager.secretAccessor sobre DATABASE_URL y DIRECT_URL en el
# proyecto orbita-api-corp (ver DEPLOYMENT.md § Accesos necesarios).
#
# Si no puede leer los secrets, o si la URL que leyó no es la de producción,
# termina con exit 1 sin correr prisma: nunca se asume "verde".

set -euo pipefail

PROJECT_ID="orbita-api-corp"
# Ref del proyecto Supabase de producción. Si producción se muda a otro
# proyecto, hay que cambiarlo acá (es el freno contra apuntar a dev por error).
PROD_REF="dgergykdihtvsglfumsb"
DEV_REF="hhaqlzrcskmwnvhgydon"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"

if [[ $# -eq 0 ]]; then
  echo "Uso: ./deploy/prisma-prod.sh <comando de prisma>  (ej: migrate status)" >&2
  exit 1
fi

leer_secret() {
  local nombre="$1" valor
  if ! valor="$(gcloud secrets versions access latest --secret="$nombre" --project="$PROJECT_ID" 2>&1)"; then
    {
      echo "No se pudo leer el secret ${nombre} de Secret Manager (proyecto ${PROJECT_ID})."
      echo "¿gcloud está logueado con la cuenta @orbita-corp.com (gcloud auth login)?"
      echo "¿tiene roles/secretmanager.secretAccessor sobre ${nombre}?"
    } >&2
    exit 1
  fi
  # Por si el secret se cargó con CRLF desde Windows.
  printf '%s' "$valor" | tr -d '\r'
}

verificar_es_produccion() {
  local nombre="$1" url="$2"
  if [[ "$url" == *"$DEV_REF"* ]]; then
    echo "El secret ${nombre} apunta a la base de DESARROLLO (${DEV_REF}). Se aborta." >&2
    exit 1
  fi
  if [[ "$url" != *"$PROD_REF"* ]]; then
    echo "El secret ${nombre} no apunta al proyecto de producción (${PROD_REF}). Se aborta." >&2
    exit 1
  fi
}

DATABASE_URL="$(leer_secret DATABASE_URL)"
DIRECT_URL="$(leer_secret DIRECT_URL)"
verificar_es_produccion DATABASE_URL "$DATABASE_URL"
verificar_es_produccion DIRECT_URL "$DIRECT_URL"
export DATABASE_URL DIRECT_URL

echo "==> prisma $* contra PRODUCCIÓN (${PROD_REF})" >&2
cd "$API_DIR"
exec pnpm exec prisma "$@"
