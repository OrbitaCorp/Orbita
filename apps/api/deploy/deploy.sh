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
# verde (los de CI, o los locales si no se puede verificar CI), sin migraciones
# pendientes EN PRODUCCIÓN y con el CI de GitHub en verde.
#
# Este script NO aplica migraciones: si el cambio trae una carpeta nueva en
# prisma/migrations, primero se aplica con ./deploy/prisma-prod.sh migrate deploy.
#   DEPLOY_SOLO_PREFLIGHT=1 ./deploy/deploy.sh   corre solo el preflight
#   DEPLOY_SIN_PREFLIGHT=1  ./deploy/deploy.sh   emergencias, pide confirmar
#   DEPLOY_TESTS_LOCALES=1  ./deploy/deploy.sh   corre typecheck + tests acá aunque CI esté verde
#   DEPLOY_ESPERA_CI=1800   ./deploy/deploy.sh   segundos máx. esperando a CI (default 900)

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

SECRETS="DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,GEMINI_IMAGE_API_KEY=GEMINI_IMAGE_API_KEY:latest,CF_WORKERS_AI_API_TOKEN=CF_WORKERS_AI_API_TOKEN:latest,GROQ_API_KEY=GROQ_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest,MERCADOPAGO_CLIENT_SECRET=MERCADOPAGO_CLIENT_SECRET:latest,MERCADOPAGO_TOKEN_KEY=MERCADOPAGO_TOKEN_KEY:latest,MP_ACCESS_TOKEN=MP_ACCESS_TOKEN:latest,MP_WEBHOOK_SECRET=MP_WEBHOOK_SECRET:latest,RESEND_API_KEY=RESEND_API_KEY:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_PAT=SUPABASE_PAT:latest,CRON_SECRET=CRON_SECRET:latest,VERCEL_TOKEN=VERCEL_TOKEN:latest,R2_ACCESS_KEY_ID=R2_ACCESS_KEY_ID:latest,R2_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY:latest,SERPER_API_KEY=SERPER_API_KEY:latest,TAVILY_API_KEY=TAVILY_API_KEY:latest,WHATSAPP_APP_SECRET=WHATSAPP_APP_SECRET:latest,WHATSAPP_VERIFY_TOKEN=WHATSAPP_VERIFY_TOKEN:latest,WHATSAPP_TOKEN_KEY=WHATSAPP_TOKEN_KEY:latest,INSTAGRAM_APP_SECRET=INSTAGRAM_APP_SECRET:latest,INSTAGRAM_VERIFY_TOKEN=INSTAGRAM_VERIFY_TOKEN:latest,INSTAGRAM_TOKEN_KEY=INSTAGRAM_TOKEN_KEY:latest"

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
#   (c) check runs de CI del sha       si `gh` está instalado y logueado. Espera
#                                      hasta DEPLOY_ESPERA_CI segundos (900) a que
#                                      CI termine; un check en rojo corta ya. Va
#                                      antes que (d) para fallar rápido.
#   (d) pnpm typecheck + pnpm test     la misma red que CI, corrida acá (~10 min).
#                                      SE OMITE si (c) vio CI en verde para este
#                                      sha (sería repetir lo mismo); se corre si
#                                      no hay gh/login o con DEPLOY_TESTS_LOCALES=1
#   (e) prisma migrate status al día   el código nuevo no puede salir antes que su
#                                      migración. Se chequea contra la base de
#                                      PRODUCCIÓN (deploy/prisma-prod.sh lee las
#                                      URLs de Secret Manager; el .env local es
#                                      la base de DEV). Solo lectura.
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

  # (c) CI verde en GitHub para este sha. Va ANTES que los tests locales por dos
  # razones: (1) falla en segundos si CI está en rojo, en vez de gastar ~10
  # minutos de tests para enterarse al final; (2) es la evidencia de que main
  # pasó por la red de contención de ci.yml (typecheck + tests de la API en un
  # checkout limpio, con Node y pnpm pinneados y --frozen-lockfile), que es
  # exactamente lo que el paso (d) volvería a correr acá. Si CI está en verde
  # para este sha, el paso (d) se omite. Si CI todavía está corriendo, se espera
  # (en vez de abortar y obligar a relanzar el script).
  echo "==> [3/5] Check runs de CI en GitHub para ${sha_completo}"
  local ci_verde=0
  if ! command -v gh >/dev/null 2>&1; then
    echo "    AVISO: gh (GitHub CLI) no está instalado; no se puede verificar CI. Se corren typecheck + tests acá."
  elif ! gh auth status >/dev/null 2>&1; then
    echo "    AVISO: gh no está logueado (gh auth login); no se puede verificar CI. Se corren typecheck + tests acá."
  else
    local espera="${DEPLOY_ESPERA_CI:-900}" intervalo=20 inicio transcurrido
    local runs malos pendientes nombre estado conclusion
    inicio="$(date +%s)"
    while true; do
      # Un mismo nombre de check puede aparecer más de una vez (reintento o
      # rerun del workflow) — GitHub conserva TODAS las corridas viejas
      # (cancelled/failure incluidas), no solo la última. Sin este filtro, un
      # commit con CI realmente verde podía cortar acá para siempre por una
      # corrida vieja cancelada que ya no importa (bug real, encontrado
      # 28/09/2026). `sort_by(started_at) | reverse | unique_by(.name)` se
      # queda con la corrida MÁS RECIENTE de cada nombre.
      if ! runs="$(gh api "repos/OrbitaCorp/Orbita/commits/${sha_completo}/check-runs" \
          --jq '[.check_runs[]] | sort_by(.started_at) | reverse | unique_by(.name)[] | "\(.name)|\(.status)|\(.conclusion)"' 2>&1)"; then
        preflight_fallo \
          "(c) No se pudieron leer los check runs de CI de GitHub para ${sha_completo}:" \
          "$runs" \
          "¿El commit ya está pusheado en origin/main?"
      fi

      malos=""
      pendientes=""
      if [[ -z "$runs" ]]; then
        # CI arranca al pushear main: puede tardar unos segundos en aparecer.
        pendientes+="  - GitHub todavía no tiene ningún check run para este commit"$'\n'
      else
        while IFS='|' read -r nombre estado conclusion; do
          [[ -z "$nombre" ]] && continue
          # "Web — lint (informativo)" tiene continue-on-error en ci.yml: su check
          # run figura como failure aunque el workflow pase. No bloquea, a propósito.
          [[ "$nombre" == *informativo* ]] && continue
          if [[ "$estado" != "completed" ]]; then
            pendientes+="  - ${nombre}: todavía ${estado}"$'\n'
          elif [[ "$conclusion" != "success" && "$conclusion" != "skipped" ]]; then
            malos+="  - ${nombre}: ${conclusion}"$'\n'
          fi
        done <<<"$runs"
        if ! grep -q '^API' <<<"$runs"; then
          pendientes+="  - no aparece el job 'API — typecheck + tests' (¿cambió el nombre en ci.yml?)"$'\n'
        fi
      fi

      # Un check en rojo corta ya, sin esperar a los que siguen corriendo.
      if [[ -n "$malos" ]]; then
        preflight_fallo \
          "(c) CI de GitHub NO está en verde para ${GIT_SHA}:" \
          "" \
          "$malos" \
          "Arreglá lo que falló en main; se despliega solo con CI verde." \
          "Ver: https://github.com/OrbitaCorp/Orbita/commit/${sha_completo}/checks"
      fi

      if [[ -z "$pendientes" ]]; then
        ci_verde=1
        echo "    CI en verde:"
        sed 's/^/      /; s/|/ · /g' <<<"$runs"
        break
      fi

      transcurrido=$(( $(date +%s) - inicio ))
      if (( transcurrido >= espera )); then
        preflight_fallo \
          "(c) CI de GitHub no terminó en verde para ${GIT_SHA} tras esperar ${espera}s:" \
          "" \
          "$pendientes" \
          "Esperá a que termine y volvé a correr el script (o subí la espera: DEPLOY_ESPERA_CI=1800)." \
          "Ver: https://github.com/OrbitaCorp/Orbita/commit/${sha_completo}/checks"
      fi
      echo "    Esperando a CI (${transcurrido}s de ${espera}s máx.):"
      sed 's/^/      /' <<<"${pendientes%$'\n'}"
      sleep "$intervalo"
    done
  fi

  # (d) typecheck + tests locales. Con CI en verde sobre este mismo sha (árbol
  # limpio y HEAD en main, pasos 1 y 2) son una repetición exacta de lo que ya
  # pasó, así que se omiten: eran ~10 minutos de los ~15 del deploy. Se corren
  # si no se pudo verificar CI (sin gh) o si se pide con DEPLOY_TESTS_LOCALES=1.
  if [[ "$ci_verde" == "1" && "${DEPLOY_TESTS_LOCALES:-}" != "1" ]]; then
    echo "==> [4/5] typecheck + tests: se omiten (CI ya los corrió en verde sobre este commit; DEPLOY_TESTS_LOCALES=1 los fuerza)"
  else
    echo "==> [4/5] pnpm typecheck + pnpm test (tarda ~10 minutos, no lo cortes)"
    pnpm typecheck || preflight_fallo "(d) pnpm typecheck falló. Arreglalo en main antes de desplegar."
    pnpm test || preflight_fallo "(d) pnpm test falló. Un test rojo no va a producción."
  fi

  # (e) Migraciones al día EN PRODUCCIÓN. El .env local de apps/api apunta a la
  # base de DEV (desde el corte del 2026-09-20), así que un `prisma migrate
  # status` pelado miraría la base equivocada y podría dar verde con una
  # migración pendiente en producción. prisma-prod.sh arma las URLs desde
  # Secret Manager (los mismos secrets que monta Cloud Run) y verifica que
  # sean las de producción. `migrate status` es de solo lectura.
  echo "==> [5/5] prisma migrate status contra la base de PRODUCCIÓN (solo lectura, URLs de Secret Manager)"
  local salida_migrate
  if ! salida_migrate="$("$SCRIPT_DIR/prisma-prod.sh" migrate status 2>&1)"; then
    if grep -q "not yet been applied" <<<"$salida_migrate"; then
      preflight_fallo \
        "(e) Hay migraciones de Prisma sin aplicar en la base de producción:" \
        "" \
        "$(sed -n '/not yet been applied/,/^$/p' <<<"$salida_migrate")" \
        "PRIMERO aplicalas con: cd apps/api && ./deploy/prisma-prod.sh migrate deploy" \
        "(y si la migración es destructiva, leé DEPLOYMENT.md § Rollback antes)." \
        "Después volvé a correr el script."
    fi
    preflight_fallo \
      "(e) No se pudo leer el estado de las migraciones de la base de PRODUCCIÓN:" \
      "" \
      "$salida_migrate"
  fi

  echo "==> Preflight OK: ${GIT_SHA} está en main, limpio, con CI/tests en verde y migraciones de producción al día."
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
