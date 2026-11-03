#!/usr/bin/env bash
# Carga (o actualiza) los secrets de STAGING en Secret Manager a partir del
# .env local de DEV. Ver docs/superpowers/specs/2026-10-24-entorno-staging-design.md.
#
# Uso:
#   cd apps/api
#   ./deploy/staging-secretos.sh
#
# - Nunca imprime un valor: lee el .env, compara un hash con la última versión y
#   sube una versión nueva solo si cambió.
# - Se niega si DATABASE_URL / DIRECT_URL no apuntan a la base de DEV.
# - JWT_SECRET y CRON_SECRET de staging se generan acá (al azar) la primera vez:
#   no se comparten con dev ni con producción.
# - Solo la cuenta de servicio de staging puede leer estos secrets; y esa cuenta
#   no puede leer los de producción.
# - Lo que NO se carga a propósito: VERCEL_TOKEN (daría de alta dominios en el
#   proyecto de PRODUCCIÓN de Vercel), Mercado Pago, WhatsApp, Instagram,
#   TikTok y Google login (apagados en staging).

set -euo pipefail

PROJECT_ID="orbita-api-corp"
SA_NAME="orbita-api-staging"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DEV_REF="hhaqlzrcskmwnvhgydon"
PROD_REF="dgergykdihtvsglfumsb"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$(dirname "$SCRIPT_DIR")/.env"

# Variables del .env de dev que staging usa tal cual.
# GOOGLE_CLIENT_SECRET y MERCADOPAGO_CLIENT_SECRET: la API no arranca sin ellos
# (getOrThrow en el constructor); en dev el de MP es un valor de relleno.
DESDE_ENV=(DATABASE_URL DIRECT_URL GEMINI_API_KEY GROQ_API_KEY CF_WORKERS_AI_API_TOKEN RESEND_API_KEY MERCADOPAGO_TOKEN_KEY MERCADOPAGO_CLIENT_SECRET GOOGLE_CLIENT_SECRET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY)
# Generadas al azar la primera vez (propias de staging).
GENERADAS=(JWT_SECRET CRON_SECRET)

valor_env() {
  # Primera aparición de KEY=... (mismo criterio que dotenv), sin comillas ni \r.
  # Vacío si no está (el `|| true` evita que set -e corte el script en silencio).
  { tr -d '\000\r' < "$ENV_FILE" | grep -a -m1 "^$1=" || true; } | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

hash() { printf '%s' "$1" | sha256sum | cut -c1-64; }

ultima_version_hash() {
  gcloud secrets versions access latest --secret "$1" --project "$PROJECT_ID" 2>/dev/null | sha256sum | cut -c1-64 || true
}

asegurar_secret() {
  local nombre="$1" valor="$2"
  if ! gcloud secrets describe "$nombre" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$nombre" --project "$PROJECT_ID" --replication-policy automatic --labels entorno=staging >/dev/null
    printf '%s' "$valor" | gcloud secrets versions add "$nombre" --project "$PROJECT_ID" --data-file=- >/dev/null
    echo "    $nombre: creado"
  elif [[ "$(ultima_version_hash "$nombre")" != "$(hash "$valor")" ]]; then
    printf '%s' "$valor" | gcloud secrets versions add "$nombre" --project "$PROJECT_ID" --data-file=- >/dev/null
    echo "    $nombre: versión nueva"
  else
    echo "    $nombre: sin cambios"
  fi
  gcloud secrets add-iam-policy-binding "$nombre" --project "$PROJECT_ID" \
    --member "serviceAccount:${SA_EMAIL}" --role roles/secretmanager.secretAccessor >/dev/null
}

[[ -f "$ENV_FILE" ]] || { echo "No encuentro $ENV_FILE" >&2; exit 1; }

for url in DATABASE_URL DIRECT_URL; do
  v="$(valor_env "$url")"
  if [[ "$v" == *"$PROD_REF"* ]]; then
    echo "ABORTADO: $url del .env apunta a PRODUCCIÓN. Staging usa la base de dev." >&2; exit 1
  fi
  if [[ "$v" != *"$DEV_REF"* ]]; then
    echo "ABORTADO: $url del .env no es la base de dev ($DEV_REF)." >&2; exit 1
  fi
done

echo "==> Cuenta de servicio ${SA_EMAIL}"
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT_ID" \
    --display-name "Órbita API staging (solo lee secrets STAGING_*)" >/dev/null
  echo "    creada"
else
  echo "    ya existe"
fi

echo "==> Secrets desde el .env de dev"
for clave in "${DESDE_ENV[@]}"; do
  v="$(valor_env "$clave")"
  if [[ -z "$v" ]]; then echo "    STAGING_$clave: vacío en el .env, se saltea"; continue; fi
  asegurar_secret "STAGING_$clave" "$v"
done

echo "==> Supabase Storage de DEV (fotos de productos, logos, adjuntos)"
# Las fotos van a Supabase Storage (supabase.service.ts), no a R2: sin la
# service role key no se puede subir ninguna. Se pide con el SUPABASE_PAT del
# .env (Management API), siempre para el proyecto de DEV. El PAT ve también el
# de producción: por eso el ref va fijo acá y la URL se valida.
supa_url="$(valor_env SUPABASE_URL)"
if [[ "$supa_url" != "https://${DEV_REF}.supabase.co" ]]; then
  echo "ABORTADO: SUPABASE_URL del .env no es el proyecto de dev." >&2; exit 1
fi
supa_key="$(valor_env SUPABASE_SERVICE_ROLE_KEY)"
if [[ -z "$supa_key" ]]; then
  pat="$(valor_env SUPABASE_PAT)"
  [[ -n "$pat" ]] || { echo "ABORTADO: falta SUPABASE_PAT en el .env para pedir la clave de Storage." >&2; exit 1; }
  supa_key="$(curl -sf -m 30 -H "Authorization: Bearer $pat" \
    "https://api.supabase.com/v1/projects/${DEV_REF}/api-keys?reveal=true" \
    | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const k=JSON.parse(d).find(x=>x.name==="service_role");process.stdout.write(k?k.api_key:"")})')"
  [[ -n "$supa_key" ]] || { echo "ABORTADO: Supabase no devolvió la service role key de dev." >&2; exit 1; }
  if [[ "${ACTUALIZAR_ENV_LOCAL:-}" == "1" ]]; then
    printf '\n# Supabase Storage de dev (fotos). La agregó deploy/staging-secretos.sh.\nSUPABASE_SERVICE_ROLE_KEY="%s"\n' "$supa_key" >> "$ENV_FILE"
    echo "    SUPABASE_SERVICE_ROLE_KEY agregada al .env local"
  fi
fi
asegurar_secret STAGING_SUPABASE_URL "$supa_url"
asegurar_secret STAGING_SUPABASE_SERVICE_ROLE_KEY "$supa_key"

echo "==> Secrets propios de staging"
for clave in "${GENERADAS[@]}"; do
  nombre="STAGING_$clave"
  if gcloud secrets describe "$nombre" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets add-iam-policy-binding "$nombre" --project "$PROJECT_ID" \
      --member "serviceAccount:${SA_EMAIL}" --role roles/secretmanager.secretAccessor >/dev/null
    echo "    $nombre: ya existe (no se regenera)"
  else
    asegurar_secret "$nombre" "$(openssl rand -hex 48)"
  fi
done

echo "==> Listo."
