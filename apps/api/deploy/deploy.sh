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
#
# Antes de buildear corre un PREFLIGHT (ver más abajo) que exige que lo que se
# despliega sea un commit de main, con el árbol limpio, typecheck + tests en
# verde, sin migraciones pendientes y con el CI de GitHub en verde.
#   DEPLOY_SOLO_PREFLIGHT=1 ./deploy/deploy.sh   corre solo el preflight
#   DEPLOY_SIN_PREFLIGHT=1  ./deploy/deploy.sh   emergencias, pide confirmar

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

SECRETS="DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,GROQ_API_KEY=GROQ_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest,MERCADOPAGO_CLIENT_SECRET=MERCADOPAGO_CLIENT_SECRET:latest,MERCADOPAGO_TOKEN_KEY=MERCADOPAGO_TOKEN_KEY:latest,MP_ACCESS_TOKEN=MP_ACCESS_TOKEN:latest,MP_WEBHOOK_SECRET=MP_WEBHOOK_SECRET:latest,RESEND_API_KEY=RESEND_API_KEY:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,CRON_SECRET=CRON_SECRET:latest,VERCEL_TOKEN=VERCEL_TOKEN:latest"

# ---------------------------------------------------------------------------
# Preflight — hallazgo `deploy-manual` de la auditoría interna (10/09/2026).
#
# El deploy del backend es manual a propósito (DEPLOYMENT.md § Deploy: no se
# quiso sumar otro servicio con costo propio), pero "manual" no puede ser
# "lo que haya en el disco de quien corre el script". Hasta este cambio,
# deploy.sh buildeaba y publicaba el árbol local tal cual estaba: con cambios
# sin commitear, en una rama que nunca pasó por CI, o con una migración de
# Prisma sin aplicar. La regla que este bloque hace cumplir es una sola:
# a producción va SOLO lo que ya está en `main` con CI verde
# (.github/workflows/ci.yml: typecheck + tests unitarios de la API).
#
# Chequeos, en orden (el primero que falla corta con exit 1, antes del build):
#   (a) árbol de git limpio            lo que se buildea es lo que está commiteado
#   (b) HEAD contenido en origin/main  se despliega lo que ya está en main
#   (c) pnpm typecheck + pnpm test     la misma red que CI, corrida acá (~10 min)
#   (d) prisma migrate status al día   el código nuevo no puede salir antes que su
#                                      migración (la base del .env ES producción;
#                                      el chequeo es de solo lectura)
#   (e) check runs de CI del sha       si `gh` está instalado y logueado; si no,
#                                      avisa y sigue (los chequeos (c) y (d) ya
#                                      cubren lo esencial)
#
# Escapes:
#   DEPLOY_SOLO_PREFLIGHT=1  corre el preflight y termina antes del build. Sirve
#                            para probar el script o responder "¿se puede
#                            desplegar ya?" sin tocar nada.
#   DEPLOY_SIN_PREFLIGHT=1   SOLO para emergencias: un hotfix con CI caído, o la
#                            excepción documentada en el CLAUDE.md de la raíz
#                            (desplegar la API desde main ANTES de que CI termine
#                            porque el frontend ya publicado necesita un endpoint
#                            nuevo). Imprime un aviso grande y pide confirmar
#                            escribiendo "si" por stdin; sin terminal interactiva
#                            aborta, para que ningún script ni agente lo pueda
#                            usar sin que una persona lo vea y lo decida.
# ---------------------------------------------------------------------------

preflight_fallo() {
  {
    echo ""
    echo "############################################################"
    echo "#  PREFLIGHT FALLIDO: NO se despliega (nada se buildeó)    #"
    echo "############################################################"
    echo ""
    printf '%s\n' "$@"
    echo ""
    echo "Regla: a producción va solo lo que ya está en main con CI verde."
    echo "Ver CLAUDE.md (raíz) § Commit y push, y apps/api/DEPLOYMENT.md § Deploy."
    echo "Solo para una emergencia real: DEPLOY_SIN_PREFLIGHT=1 ./deploy/deploy.sh"
  } >&2
  exit 1
}

preflight() {
  local sha_completo
  sha_completo="$(git rev-parse HEAD)"
  cd "$API_DIR"

  echo "==> Preflight (hallazgo deploy-manual): a producción va solo lo que está en main con CI verde"
  echo "    Commit a desplegar: ${GIT_SHA} (${sha_completo})"

  # (a) Árbol limpio. Si hay algo sin commitear, la imagen no corresponde a
  # ningún commit y después no se puede saber qué quedó en producción.
  echo "==> [1/5] Árbol de git limpio"
  local sucio
  sucio="$(git status --porcelain)"
  if [[ -n "$sucio" ]]; then
    preflight_fallo \
      "(a) Hay cambios sin commitear o archivos sin trackear en el repo:" \
      "" \
      "$sucio" \
      "" \
      "Lo que se buildea tiene que ser exactamente un commit de main. Commiteá (o descartá)" \
      "esos cambios, llevalos a main y volvé a correr el script."
  fi

  # (b) HEAD está en origin/main. Una rama de trabajo nunca pasó por CI en
  # GitHub (ci.yml corre en push a main y en PRs), y si se despliega desde la
  # rama, main queda con código distinto al que está sirviendo.
  echo "==> [2/5] HEAD contenido en origin/main (git fetch origin)"
  git fetch origin --quiet
  if ! git merge-base --is-ancestor HEAD origin/main; then
    preflight_fallo \
      "(b) El commit actual (${GIT_SHA}) NO está contenido en origin/main." \
      "Se despliega lo que ya está en main y pasó por CI, no una rama de trabajo." \
      "Mergeá a main con fast-forward, pusheá main, esperá CI verde y recién ahí desplegá" \
      "(CLAUDE.md de la raíz, § Commit y push)."
  fi

  # (c) La misma red que CI, corrida acá. Aunque CI ya haya pasado en GitHub,
  # correrlo local cuesta ~10 minutos y garantiza que lo que se buildea compila
  # y pasa los tests con las dependencias de esta máquina.
  echo "==> [3/5] pnpm typecheck + pnpm test (la misma red que CI: tarda ~10 minutos, no lo cortes)"
  pnpm typecheck || preflight_fallo "(c) pnpm typecheck falló. Arreglalo en main antes de desplegar."
  pnpm test || preflight_fallo "(c) pnpm test falló. Un test rojo no va a producción."

  # (d) Migraciones al día. La base del .env de apps/api ES producción: si hay
  # una migración sin aplicar, el código nuevo saldría contra un schema viejo.
  # `migrate status` es de solo lectura (no aplica nada).
  echo "==> [4/5] prisma migrate status (solo lectura contra la base del .env, que es producción)"
  local salida_migrate
  if ! salida_migrate="$(pnpm exec prisma migrate status 2>&1)"; then
    if grep -q "not yet been applied" <<<"$salida_migrate"; then
      preflight_fallo \
        "(d) Hay migraciones de Prisma sin aplicar en la base de producción:" \
        "" \
        "$(sed -n '/not yet been applied/,/^$/p' <<<"$salida_migrate")" \
        "PRIMERO aplicalas con: cd apps/api && pnpm exec prisma migrate deploy" \
        "(y si la migración es destructiva, leé DEPLOYMENT.md § Rollback antes)." \
        "Después volvé a correr el script."
    fi
    preflight_fallo \
      "(d) prisma migrate status falló (no se pudo leer el estado de la base):" \
      "" \
      "$salida_migrate"
  fi

  # (e) CI verde en GitHub para este sha. Es la evidencia de que main pasó por
  # la red de contención de ci.yml. Si no está `gh`, se avisa y se sigue:
  # (c) y (d) ya cubren lo esencial y no queremos que el deploy dependa de
  # tener una herramienta más instalada.
  echo "==> [5/5] Check runs de CI en GitHub para ${sha_completo}"
  if ! command -v gh >/dev/null 2>&1; then
    echo "    AVISO: gh (GitHub CLI) no está instalado; no se pueden verificar los check runs de CI. Se sigue igual."
  elif ! gh auth status >/dev/null 2>&1; then
    echo "    AVISO: gh no está logueado (gh auth login); no se pueden verificar los check runs de CI. Se sigue igual."
  else
    local runs
    if ! runs="$(gh api "repos/OrbitaCorp/Orbita/commits/${sha_completo}/check-runs" \
        --jq '.check_runs[] | "\(.name)|\(.status)|\(.conclusion)"' 2>&1)"; then
      preflight_fallo \
        "(e) No se pudieron leer los check runs de CI de GitHub para ${sha_completo}:" \
        "$runs" \
        "¿El commit ya está pusheado en origin/main?"
    fi
    if [[ -z "$runs" ]]; then
      preflight_fallo \
        "(e) GitHub todavía no tiene ningún check run para ${sha_completo}." \
        "CI arranca al pushear main: esperá a que termine en verde y volvé a correr el script."
    fi
    local malos="" nombre estado conclusion
    while IFS='|' read -r nombre estado conclusion; do
      [[ -z "$nombre" ]] && continue
      # "Web — lint (informativo)" tiene continue-on-error en ci.yml: su check
      # run figura como failure aunque el workflow pase. No bloquea, a propósito.
      [[ "$nombre" == *informativo* ]] && continue
      if [[ "$estado" != "completed" ]]; then
        malos+="  - ${nombre}: todavía ${estado}"$'\n'
      elif [[ "$conclusion" != "success" && "$conclusion" != "skipped" ]]; then
        malos+="  - ${nombre}: ${conclusion}"$'\n'
      fi
    done <<<"$runs"
    if ! grep -q '^API' <<<"$runs"; then
      malos+="  - no aparece el job 'API — typecheck + tests' (¿cambió el nombre en ci.yml?)"$'\n'
    fi
    if [[ -n "$malos" ]]; then
      preflight_fallo \
        "(e) CI de GitHub NO está en verde para ${GIT_SHA}:" \
        "" \
        "$malos" \
        "Esperá a que termine o arreglá lo que falló en main; se despliega solo con CI verde." \
        "Ver: https://github.com/OrbitaCorp/Orbita/commit/${sha_completo}/checks"
    fi
    echo "    CI en verde:"
    sed 's/^/      /; s/|/ · /g' <<<"$runs"
  fi

  echo "==> Preflight OK: ${GIT_SHA} está en main, limpio, con tests y migraciones al día."
}

if [[ "${DEPLOY_SOLO_PREFLIGHT:-}" == "1" ]]; then
  preflight
  echo "==> DEPLOY_SOLO_PREFLIGHT=1: se termina acá, sin build ni deploy."
  exit 0
elif [[ "${DEPLOY_SIN_PREFLIGHT:-}" == "1" ]]; then
  cat >&2 <<'AVISO'

############################################################################
#                                                                          #
#   DEPLOY_SIN_PREFLIGHT=1: SE VA A DESPLEGAR A PRODUCCIÓN SIN VERIFICAR   #
#   que el commit esté en main, que el árbol esté limpio, que typecheck    #
#   y tests pasen, que no haya migraciones pendientes ni que CI esté en    #
#   verde. Esto es SOLO para una emergencia real (hallazgo deploy-manual   #
#   de la auditoría). Si no lo es, cortá con Ctrl+C y corré el script sin  #
#   la variable.                                                           #
#                                                                          #
############################################################################

AVISO
  echo "    Commit que se va a desplegar: ${GIT_SHA} ($(git rev-parse --abbrev-ref HEAD))" >&2
  if [[ ! -t 0 ]]; then
    echo "Sin terminal interactiva (stdin no es una tty): no se puede confirmar, se aborta." >&2
    echo "El escape es para una persona frente a la consola, no para scripts ni agentes." >&2
    exit 1
  fi
  read -r -p 'Escribí "si" para desplegar SIN preflight (cualquier otra cosa aborta): ' confirmacion
  if [[ "$confirmacion" != "si" ]]; then
    echo "Abortado: no se desplegó nada." >&2
    exit 1
  fi
  echo "==> Confirmado. Desplegando ${GIT_SHA} SIN preflight (quedá registrado en el resumen de la tarea)."
else
  preflight
fi

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
  --cpu-throttling \
  --min-instances 0 \
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
