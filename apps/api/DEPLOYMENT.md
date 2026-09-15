# Deploy — apps/api en Google Cloud

Desde el 31/08/2026 el backend corre en **Google Cloud Run**, no en Railway. Este
documento es la referencia para desplegar, debuggear y mantener esa infraestructura.
Para el resumen ejecutivo (costos, comparación con Railway, recomendación) ver el
reporte que se le pasó al CTO — este documento es el runbook técnico para el equipo.

## Arquitectura

```
Vercel (frontend, orbita.site + *.orbita.site)
        │  fetch() a NEXT_PUBLIC_API_URL
        ▼
api.orbita.site  (DNS: CNAME → orbita-api-corp.web.app, gestionado en Vercel)
        │
        ▼
Firebase Hosting (proxy gratis, "orbita-api-corp" — mismo GCP project)
        │  rewrite "**" → Cloud Run
        ▼
Cloud Run "orbita-api"  (región southamerica-east1 — São Paulo)
        │  Prisma
        ▼
Supabase Postgres (aws-1-sa-east-1 — no se tocó, sigue igual que siempre)
```

**Por qué Firebase Hosting en el medio:** Cloud Run no soporta mapeo directo de
dominio custom en `southamerica-east1` (ninguna región de Sudamérica lo soporta,
es una limitación de Google). Firebase Hosting sí puede apuntar (rewrite) a un
Cloud Run de cualquier región, y da dominio + SSL gratis. La alternativa hubiera
sido un Load Balancer HTTPS externo (~US$18-19/mes fijos) — se descartó por costo,
ver el reporte del CTO para el detalle de esa decisión.

**Por qué São Paulo:** la base de datos (Supabase) está en `aws-1-sa-east-1`
(AWS São Paulo). Correr el backend ahí minimiza la latencia de cada query de
Prisma — es más determinante que la latencia navegador↔API.

## Accesos necesarios para desplegar

Cualquiera que vaya a correr `deploy/deploy.sh` necesita, en el proyecto GCP
**`orbita-api-corp`**:

| Rol IAM | Para qué |
|---|---|
| `roles/run.developer` | Desplegar revisiones, ver logs del servicio |
| `roles/artifactregistry.writer` | Subir imágenes nuevas |
| `roles/cloudbuild.builds.editor` | Lanzar builds |
| `roles/logging.viewer` | Ver logs |
| `roles/iam.serviceAccountUser` (scoped a `681215569277-compute@developer.gserviceaccount.com`) | Necesario para desplegar "en nombre de" esa service account |

**NO hace falta** `roles/secretmanager.secretAccessor` para desplegar código nuevo
— el deploy solo *referencia* los secrets por nombre (`--set-secrets`), no lee su
contenido. Ese rol se lo damos solo a quien necesite ver/rotar un secret puntual.

Herramientas locales:
- [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) instalado y autenticado
  (`gcloud auth login` con la cuenta `@orbita-corp.com`).
- `git` (el script tagea la imagen con el commit SHA y verifica que esté en `main`)
  y `pnpm` (el preflight corre typecheck, tests y `prisma migrate status`).
- `gh` (GitHub CLI) logueado, opcional: con él el preflight confirma que CI
  está en verde para el commit; sin él avisa y sigue.

## Deploy

Se despliega **lo que ya está en `main` con CI verde**, nunca una rama de
trabajo ni un árbol con cambios sin commitear. El orden completo (commit →
push de `main` → CI verde → `deploy.sh`) está en el `CLAUDE.md` de la raíz,
§ Commit y push; acá va la parte del script.

```bash
cd apps/api
git checkout main && git pull --ff-only origin main
./deploy/deploy.sh
```

Esto: corre el **preflight** (abajo), buildea la imagen con Cloud Build (no
hace falta Docker instalado localmente), la sube a Artifact Registry taggeada
con el SHA del commit actual + `:latest`, y despliega esa imagen a Cloud Run
con los recursos y secrets ya configurados. Al final imprime la URL directa de
Cloud Run y recuerda el dominio de producción.

No hay CI/CD automático (no se configuró GitHub Actions ni un Cloud Build
Trigger a propósito — decisión explícita para no sumar otro servicio con costo
propio). El deploy es manual, corriendo el script cuando haya algo nuevo para
publicar. Lo que sí hay es CI de verificación (`.github/workflows/ci.yml`:
typecheck + tests unitarios de la API en cada push a `main` y en PRs), y el
preflight del script es el puente entre las dos cosas: CI verifica, no
despliega; el script despliega, pero solo lo que CI verificó.

### Preflight: qué chequea y por qué

Hallazgo `deploy-manual` de la auditoría interna (10/09/2026). Hasta el 15/09
el script buildeaba y publicaba lo que hubiera en el disco de quien lo corría:
con cambios sin commitear, desde una rama que nunca pasó por CI, o con una
migración sin aplicar. Ahora, antes del build, verifica en este orden y corta
con `exit 1` (sin buildear nada) en el primero que falla:

| # | Chequeo | Cómo | Si falla |
|---|---|---|---|
| a | Árbol de git limpio | `git status --porcelain` vacío | lista lo sucio; commitear o descartar |
| b | HEAD está en `main` | `git fetch origin` + `git merge-base --is-ancestor HEAD origin/main` | mergear a `main` (ff), pushear, esperar CI |
| c | Misma red que CI, local | `pnpm typecheck` y `pnpm test` (**~10 minutos**) | arreglar en `main` |
| d | Migraciones al día | `pnpm exec prisma migrate status` (solo lectura, contra la base del `.env`, que es producción) | primero `pnpm exec prisma migrate deploy` (ver § Rollback si es destructiva) |
| e | CI verde en GitHub | `gh api repos/OrbitaCorp/Orbita/commits/<sha>/check-runs`: todo `completed` + `success` | esperar o arreglar; si `gh` no está o no está logueado, avisa y sigue |

`Web — lint (informativo)` tiene `continue-on-error` en `ci.yml` y su check run
figura como `failure` aunque el workflow pase: el preflight lo ignora a
propósito. El job `API — typecheck + tests` tiene que existir y estar en verde.

Variables de entorno:

- `DEPLOY_SOLO_PREFLIGHT=1 ./deploy/deploy.sh`: corre el preflight y termina
  antes del build. Para probar el script o responder "¿se puede desplegar ya?"
  sin tocar nada.
- `DEPLOY_SIN_PREFLIGHT=1 ./deploy/deploy.sh`: **solo emergencias** (un hotfix
  con CI caído, o la excepción del `CLAUDE.md` de la raíz: desplegar la API
  desde `main` ya pusheado antes de que CI termine porque el frontend, que
  Vercel publica solo, necesita un endpoint nuevo ya). Imprime un aviso grande
  y pide confirmar escribiendo `si`; sin terminal interactiva (stdin que no es
  una tty) aborta, así ningún script ni agente lo puede usar sin una persona
  adelante. Dejar constancia en el reporte de la tarea de que se usó y por qué.

## Actualizar secrets

Los valores sensibles (`DATABASE_URL`, `JWT_SECRET`, API keys, etc.) viven en
**Secret Manager**, no en el repo ni en variables de entorno planas. Para
rotar/actualizar uno:

```bash
echo -n "el-valor-nuevo" | gcloud secrets versions add NOMBRE_DEL_SECRET \
  --project=orbita-api-corp --data-file=-
```

**⚠️ Ojo con PowerShell:** si generás el valor con `$valor | gcloud secrets ...`
en PowerShell, el pipe puede insertar un **BOM (byte de orden de bytes)** al
principio del string sin que se note — rompió `RESEND_API_KEY` en la migración
inicial (crasheaba con `Cannot convert argument to a ByteString`, un error
totalmente críptico). Si usás PowerShell, escribí el valor a un archivo con
`[System.IO.File]::WriteAllText($path, $valor, (New-Object System.Text.UTF8Encoding $false))`
(el `$false` es "sin BOM") y usá `--data-file=$path`, nunca pipe directo a stdin.

Después de agregar una versión nueva, el próximo `deploy.sh` la toma automático
(los secrets están referenciados como `:latest`). Si necesitás que tome efecto
sin desplegar código nuevo, hay que forzar una revisión nueva:
```bash
gcloud run services update orbita-api --region=southamerica-east1 --project=orbita-api-corp
```

Para agregar un secret **nuevo** (una env var sensible que no existía):
1. `gcloud secrets create NOMBRE --project=orbita-api-corp --replication-policy=automatic --data-file=archivo-sin-bom.txt`
2. Agregarlo al mapeo `SECRETS=` en `deploy/deploy.sh`.
3. Dar acceso al runtime SA (una sola vez, ya está hecho para todos los actuales):
   `gcloud projects add-iam-policy-binding orbita-api-corp --member="serviceAccount:681215569277-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"`

### `BFF_IP_SECRET` — IP real del cliente detrás del BFF (pendiente de cargar)

Hallazgo `rate-limit-ip-proxy` de la auditoría interna (10/09). `TRUST_PROXY_HOPS`
(env-vars.yaml) arregla los pedidos que van del navegador a la API, pero login,
refresh, registro, alta y sesiones pasan por el BFF de Next.js en Vercel y le
llegan a la API con la IP de Vercel: todos compartían un balde de throttling y
las "sesiones activas" mostraban la IP del servidor. El BFF
(`apps/web/src/lib/auth/bff.ts`) reenvía la IP real en `X-Orbita-Client-Ip`
junto con `X-Orbita-Client-Ip-Secret`, y la API (`common/utils/proxy.ts`,
`ipDelCliente`) la usa **solo** si el secreto coincide en tiempo constante.
Es el MISMO valor en los dos lados, de 32+ caracteres (más corto se ignora).
**Mientras no esté cargado, todo sigue exactamente como hoy** (sin regresión,
solo sin el arreglo).

1. Generar el valor una sola vez (desde Git Bash, no PowerShell — ver el aviso del BOM arriba):
   ```bash
   openssl rand -hex 32 > /tmp/bff-ip-secret.txt
   ```
2. Crearlo en Secret Manager para la API:
   ```bash
   gcloud secrets create BFF_IP_SECRET --project=orbita-api-corp \
     --replication-policy=automatic --data-file=/tmp/bff-ip-secret.txt
   ```
   (el runtime SA ya tiene `secretmanager.secretAccessor` a nivel proyecto, no hace falta repetir el paso 3).
3. Sumarlo a `SECRETS=` en `deploy/deploy.sh` (`BFF_IP_SECRET=BFF_IP_SECRET:latest`)
   **recién cuando el secret exista** — si se referencia uno que no existe, el
   deploy falla — y correr `deploy.sh`.
4. Cargar el mismo valor en Vercel, proyecto web, como env var de servidor
   **`BFF_IP_SECRET`** (nunca `NEXT_PUBLIC_`), entornos Production (y Preview
   si se quiere probar ahí). Desde el panel: Settings → Environment Variables,
   o con el CLI logueado en la cuenta del proyecto:
   ```bash
   vercel env add BFF_IP_SECRET production < /tmp/bff-ip-secret.txt
   ```
   Después hace falta un deploy nuevo del frontend para que lo tome (un push a
   `main` alcanza). Borrar `/tmp/bff-ip-secret.txt` al terminar.
5. Verificar sin exponer el secreto, con `GET /api/v1/health/ip`:
   - Directo a la API desde dos redes distintas (por ejemplo wifi y 4G):
     `curl -s https://api.orbita.site/api/v1/health/ip` tiene que dar `clientIp`
     distinto en cada una e igual a la IP pública de esa red, con `viaBff: false`.
   - A través del BFF: un login desde el panel (DevTools → Network →
     `/api/auth/login`) tiene que crear en "Sesiones activas" (`/me/sessions`)
     una sesión con la IP pública real, no una de Vercel (`76.76.x.x`). Y si se
     repite el login de una cuenta desde dos redes, la segunda red NO tiene que
     recibir el 429 de la primera.
   Cuando el valor de `X-Orbita-Client-Ip-Secret` no coincide, la API ignora el
   header y sigue con `req.ip`: nunca se puede elegir la propia IP desde afuera.

## Actualizar variables NO sensibles

Editar `deploy/env-vars.yaml` (se commitea a git, no tiene secrets), llevar
el commit a `main` como cualquier otro cambio (el preflight no deja desplegar
con el árbol sucio ni desde una rama) y correr `deploy.sh` de nuevo.

## Ver logs

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="orbita-api"' \
  --project=orbita-api-corp --limit=100 --order=desc \
  --format="value(textPayload)"
```

O directo en la consola: [Cloud Run → orbita-api → Logs](https://console.cloud.google.com/run/detail/southamerica-east1/orbita-api/logs?project=orbita-api-corp).

## Rollback

Hallazgo `rollback-sin-simulacro` de la auditoría interna (10/09/2026): el
rollback estaba documentado (la variante por imagen, abajo) pero nunca se
había probado, y no decía nada de las migraciones, que son lo único que puede
hacer que "volver a la revisión anterior" no alcance. Hay dos variantes; la
primera es la que va casi siempre.

### Variante 1: mover el tráfico a una revisión anterior (sin redeploy)

Cloud Run guarda cada revisión desplegada con su imagen, env vars y secrets
tal como estaban en ese momento. Volver atrás es cambiar a qué revisión va el
100% del tráfico: tarda segundos, no rebuildea ni crea nada nuevo, y se
deshace con el mismo comando.

```bash
# 1. Ver las revisiones (la más nueva primero; ACTIVE = sirve tráfico ahora).
gcloud run revisions list --service orbita-api \
  --region southamerica-east1 --project orbita-api-corp --limit 10

# Qué commit tiene una revisión (la imagen está taggeada con el SHA corto):
gcloud run revisions describe orbita-api-000XX-abc \
  --region southamerica-east1 --project orbita-api-corp \
  --format="value(spec.containers[0].image)"

# 2. Mandar el 100% del tráfico a la revisión anterior.
gcloud run services update-traffic orbita-api \
  --region southamerica-east1 --project orbita-api-corp \
  --to-revisions orbita-api-000XX-abc=100

# 3. Verificar: reparto de tráfico y que la API responde por el dominio real.
gcloud run services describe orbita-api \
  --region southamerica-east1 --project orbita-api-corp \
  --format="yaml(status.traffic)"
curl -s -o /dev/null -w "%{http_code}\n" https://api.orbita.site/api/v1/health   # 200

# 4. Volver a la revisión más nueva cuando esté arreglada (o para deshacer el rollback).
gcloud run services update-traffic orbita-api \
  --region southamerica-east1 --project orbita-api-corp --to-latest
```

**Volver siempre con `--to-latest`, no con `--to-revisions <actual>=100`.**
Mientras el tráfico esté clavado en una revisión puntual, el servicio deja de
seguir a "la última": un `deploy.sh` posterior crea la revisión nueva pero le
manda **0%** del tráfico (gcloud lo avisa al final, fácil de pasar por alto).
`--to-latest` restablece el comportamiento normal de "cada deploy sirve el
100%". Si después de un rollback se despliega el arreglo y "no se ve", casi
seguro es esto.

### Variante 2: redesplegar una imagen anterior por tag

Cada deploy queda taggeado con el SHA del commit. Sirve cuando la revisión
que se necesita ya no está (Cloud Run conserva un número limitado de
revisiones viejas) o cuando hace falta la imagen vieja con env vars o secrets
nuevos:

```bash
gcloud run deploy orbita-api \
  --image southamerica-east1-docker.pkg.dev/orbita-api-corp/orbita-api/orbita-api:SHA_ANTERIOR \
  --region southamerica-east1 --project orbita-api-corp --quiet
```

(los flags de memoria/secrets/etc. no hace falta repetirlos — Cloud Run los
mantiene de la revisión anterior si no los especificás de nuevo). Esto crea
una revisión nueva con la imagen vieja; el rollback de código queda hecho pero
el historial de revisiones no "vuelve", avanza.

### Migraciones: un rollback de código NO revierte la base

Las dos variantes vuelven el **código** atrás; el schema de Postgres queda
como lo dejó la última `prisma migrate deploy` (Prisma no tiene migraciones
"down": deshacer una migración es escribir otra hacia adelante). Entonces el
rollback pone una **revisión vieja contra un schema nuevo**, y eso es seguro
o no según qué hizo la migración:

| Seguro (la revisión vieja no se entera) | NO seguro (la revisión vieja rompe) |
|---|---|
| columna agregada **nullable** o con `DEFAULT` | columna o tabla **borrada** |
| tabla nueva | columna o tabla **renombrada** (para el código viejo es lo mismo que borrada) |
| índice nuevo | valor de enum **quitado** o enum renombrado |
| valor de enum **agregado** (mientras ninguna fila lo use todavía: el cliente viejo de Prisma falla al leer un valor que no conoce) | columna que pasa a `NOT NULL` sin `DEFAULT` (los inserts viejos no la mandan) |
| | tipo de columna cambiado |

**Regla expand/contract: nunca borrar en la misma release que deja de usar.**
Un cambio destructivo se hace en dos releases: en la primera se agrega lo
nuevo y el código deja de leer y escribir lo viejo (queda compatible con los
dos schemas); en la segunda, cuando la primera ya está estable en producción
y no se va a volver atrás, va la migración que borra o renombra. Así, en
cualquier momento, la revisión anterior a la que está sirviendo funciona con
el schema actual, y el rollback por tráfico es siempre una opción. Si una
tarea necesita saltearse esto, hay que decirlo explícito en el reporte:
"este deploy no tiene rollback sin restaurar backup".

Antes de un rollback, confirmar que entre el commit que sirve y el commit al
que se vuelve no hubo migraciones destructivas:

```bash
git log --oneline SHA_ANTERIOR..SHA_ACTUAL -- apps/api/prisma/migrations
```

Si la lista está vacía, el rollback es seguro sin más. Si hay migraciones,
abrir cada `migration.sql` y buscar `DROP`, `RENAME`, `ALTER TYPE ... DROP`
y `SET NOT NULL`.

### Simulacro (pendiente, lo corre Ale)

Check pendiente del hallazgo: "Simulacro de rollback con `gcloud run services
update-traffic`". Necesita `gcloud` logueado con `contacto@orbita-corp.com`
(`gcloud auth list` tiene que marcarla como activa) y se hace en un horario
de poco tráfico: durante uno o dos minutos la API sirve la revisión anterior.
Elegir la revisión **inmediatamente anterior** y confirmar con el `git log`
de arriba que entre las dos no hubo migración.

```bash
# 0. Cuenta correcta y revisión que sirve ahora (anotarla: es ACTUAL).
gcloud auth list
gcloud run services describe orbita-api --region southamerica-east1 --project orbita-api-corp \
  --format="value(status.latestReadyRevisionName)"

# 1. Listar revisiones; la segunda de la lista es ANTERIOR. Anotar su nombre.
gcloud run revisions list --service orbita-api --region southamerica-east1 --project orbita-api-corp --limit 5

# 2. Mover el 100% del tráfico a ANTERIOR.
gcloud run services update-traffic orbita-api --region southamerica-east1 --project orbita-api-corp \
  --to-revisions ANTERIOR=100

# 3. Verificar que el tráfico cambió y que la API responde por el dominio real.
gcloud run services describe orbita-api --region southamerica-east1 --project orbita-api-corp \
  --format="yaml(status.traffic)"
curl -s -o /dev/null -w "%{http_code}\n" https://api.orbita.site/api/v1/health   # tiene que dar 200

# 4. Volver a la actual (con --to-latest, ver el aviso de arriba).
gcloud run services update-traffic orbita-api --region southamerica-east1 --project orbita-api-corp --to-latest

# 5. Verificar de nuevo: status.traffic con latestRevision: true y percent: 100, y health en 200.
gcloud run services describe orbita-api --region southamerica-east1 --project orbita-api-corp \
  --format="yaml(status.traffic)"
curl -s -o /dev/null -w "%{http_code}\n" https://api.orbita.site/api/v1/health
```

Al terminar, anotar acá la fecha, las dos revisiones usadas y cuánto tardó
cada `update-traffic`, y marcar el check en la pestaña Auditoría.

## Recursos configurados y por qué

| Parámetro | Valor | Motivo |
|---|---|---|
| CPU | 2 vCPU | `sharp` (procesamiento de imágenes) y `onnxruntime-node` (remoción de fondo) son CPU-intensivos |
| Memoria | 2 GiB | margen para procesar imágenes sin OOM |
| CPU throttling | **activado** (default de Cloud Run) | la CPU se apaga entre requests — es lo que mantiene el costo cerca de $0 en reposo. Antes se había desactivado por los `@Cron`, pero esos se sacaron del proceso (ver abajo), así que ya no hace falta. |
| Min instances | 0 | escala a cero sin tráfico. También revertido — ya no depende de tener una instancia siempre viva. |
| Max instances | 10 | techo de escalado, ajustable según tráfico real |
| Concurrency | 40 (default de Cloud Run es 80) | las tareas de imagen son pesadas, se bajó para que no se amontonen muchas en la misma instancia |
| Session affinity | activada | el throttler (límites por IP) y el canje del login con Google viven en memoria de cada instancia (hallazgo `auth-estado-en-memoria`). Con afinidad, Cloud Run manda las requests de un mismo cliente a la misma instancia mientras viva, así los contadores y el canje no se pierden al escalar por encima de 1. No es un storage compartido: si algún día hace falta exactitud entre instancias, va Redis/Postgres. |

Subir CPU/memoria es un solo comando (`gcloud run services update --memory=4Gi
--cpu=4 ...`), sin rebuild ni downtime. Ver el reporte del CTO para el impacto
en costo de tocar estos números.

**⚠️ No reactives `--no-cpu-throttling` + `--min-instances 1` "para estar
tranquilos"** — esa combinación fue justamente la que generaba ~US$130-190/mes
de costo fijo (instancia de 2vCPU/2GiB corriendo 24/7). Si algún endpoint
necesita evitar cold starts en el futuro, subir `min-instances` a 1 sí tiene
sentido — pero **sin** `--no-cpu-throttling` no hace falta pagar la CPU
completa todo el día, solo mientras esa instancia atiende una request.

## Cron jobs — Cloud Scheduler, no @Cron in-process

Los `@Cron(...)` que tenía el backend (sweep de suscripciones, resumen
diario, reporte semanal) **se sacaron del código**. En Railway (una VM
siempre prendida) un cron in-process andaba bien; en Cloud Run, con el
servicio escalando a 0, no hay garantía de que exista una instancia viva a
las 3am para dispararlo.

En su lugar: **3 endpoints HTTP protegidos** (`src/internal-cron/`) que hacen
exactamente lo mismo, disparados por **Cloud Scheduler** a los mismos
horarios de siempre. Cloud Run "despierta" el servicio para atender esa
request como cualquier otra.

| Job de Scheduler | Horario (UTC) | Llama a |
|---|---|---|
| `nightly-subscriptions-maintenance` | 03:00 diario | `reconcileOverdueSubscriptions()` + `cleanupExpiredPendingSignups()` (antes eran 2 `@Cron` separados a las 3am/4am — se juntaron en 1 solo disparo, sin razón de negocio para separarlos) |
| `resumen-diario` | 22:00 diario | `resumenDiario()` |
| `reporte-semanal` | 09:00 lunes | `reporteSemanal()` |

**Por qué son 3 jobs y no 4:** Cloud Scheduler regala **3 jobs gratis por
proyecto/mes**; del 4to en adelante cobra **US$0.10/job/mes**. Consolidando
los dos de la madrugada en uno, los 3 jobs actuales entran 100% en el tier
gratis. Si en el futuro hace falta un 4to o 5to job de Scheduler (para lo que
sea, no necesariamente cron de este backend), el costo es literalmente
$0.10/mes cada uno — no es un límite duro, es solo el punto donde deja de
ser gratis.

**Seguridad:** estos endpoints son `@Public()` (no piden el JWT normal de
member/customer, porque Cloud Scheduler no tiene esa sesión) pero están
protegidos por un secret compartido (`CRON_SECRET`, en Secret Manager) que
Cloud Scheduler manda en el header `x-cron-secret`. Sin ese header exacto,
devuelven 401.

**Para agregar un cron job nuevo:**
1. Sacale el `@Cron(...)` al método si lo tiene (o escribilo directo sin él).
2. Agregá un endpoint en `src/internal-cron/internal-cron.controller.ts` que lo llame.
3. Creá el job de Scheduler:
   ```bash
   gcloud scheduler jobs create http NOMBRE_DEL_JOB \
     --project=orbita-api-corp --location=southamerica-east1 \
     --schedule="CRON_EXPRESSION" --time-zone="Etc/UTC" \
     --uri="https://api.orbita.site/api/v1/internal-cron/TU_ENDPOINT" \
     --http-method=POST --headers="x-cron-secret=$(gcloud secrets versions access latest --secret=CRON_SECRET --project=orbita-api-corp)"
   ```
4. Si ya hay 3 jobs activos, el nuevo cuesta US$0.10/mes — no es necesario evitarlo a toda costa, es un costo menor.

**Para debuggear un job que no corrió:**
```bash
gcloud scheduler jobs describe NOMBRE_DEL_JOB --project=orbita-api-corp --location=southamerica-east1
gcloud scheduler jobs run NOMBRE_DEL_JOB --project=orbita-api-corp --location=southamerica-east1  # dispara ahora, a mano
```

## Troubleshooting — problemas ya resueltos (para no repetir la pelea)

- **`prisma: not found` en el build** — `pnpm install --prod` (o `pnpm prune
  --prod`) saltea `devDependencies`, pero el `postinstall` de la raíz corre
  `prisma generate`, que necesita el CLI de `prisma` (que es, correctamente,
  una devDependency). Fix: `pnpm prune --prod --ignore-scripts` en la etapa
  `prod-deps` del Dockerfile — el cliente ya se generó en la etapa `deps`, no
  hace falta regenerarlo ahí.
- **Prisma engine con la versión de OpenSSL equivocada** — `node:22-slim` no
  trae el binario `openssl` instalado, y sin él Prisma no puede detectar la
  versión real de libssl del sistema (cae a un default que no matchea). Se
  instala `openssl` vía `apt-get` tanto en la etapa de build como en runtime.
- **`allUsers` rechazado al desplegar** — la organización `orbita-corp.com`
  tiene la política `iam.allowedPolicyMemberDomains` restringida por default
  (estándar en cuentas con Google Workspace). Se creó una excepción a nivel
  proyecto (`gcloud org-policies set-policy`, `allowAll: true`) — ver
  `apps/api/deploy/` si hace falta replicar esto en otro proyecto.
- **`firebase projects:addfirebase` con 403 genérico** — la cuenta nunca había
  aceptado los Términos de Servicio de Firebase. Se resuelve entrando una vez
  a [console.firebase.google.com](https://console.firebase.google.com) con esa
  cuenta y completando el asistente de "crear proyecto" (tildar el checkbox de
  condiciones), no hay forma de aceptarlo por CLI.
- **Remover `allUsers` del IAM del servicio no bloquea nada** — Cloud Run tiene
  un toggle separado, **"Invoker IAM check"** (`--invoker-iam-check` /
  `--no-invoker-iam-check` en `gcloud run services update`), independiente de
  los bindings de IAM. Si ese chequeo está desactivado, sacar `allUsers` no
  tiene ningún efecto — el servicio sigue público igual. Es la razón por la
  que el freno de gasto (abajo) NO usa este mecanismo, usa modo mantenimiento
  por env var en su lugar, que no depende de esto.
- **`iam.serviceaccounts.actAs` denegado al actualizar un servicio de Cloud
  Run por API** — para desplegar una revisión nueva programáticamente (no con
  `gcloud`, sino llamando la REST API directo, como hace `deploy/budget-guard`)
  hace falta `roles/iam.serviceAccountUser` sobre la service account con la
  que corre el servicio (`681215569277-compute@developer.gserviceaccount.com`),
  además de `roles/run.admin` y `roles/artifactregistry.reader`. Los tres
  permisos juntos, y encima con demora de propagación de varios minutos en
  este proyecto — si algo similar falla, no asumir que el permiso está mal
  simplemente porque no funcionó al toque.
- **`deploy.sh: line 45: syntax error near unexpected token '('` corriendo
  desde Windows** — el checkout con `core.autocrlf=true` convierte el script
  a CRLF, y bash lo rompe a mitad de ejecución (justo DESPUÉS de que el build
  y el push a Artifact Registry ya corrieron — no hace falta rebuildear si
  pasa). El repo ya tiene `.gitattributes` (`*.sh text eol=lf`) que fuerza
  LF sin importar `core.autocrlf`, así que un checkout nuevo no debería
  pisarlo — si aparece igual, correr una vez
  `git rm --cached apps/api/deploy/deploy.sh && git checkout apps/api/deploy/deploy.sh`
  para forzar la renormalización. Si el script ya murió a mitad de camino,
  la imagen suele estar bien construida y subida — confirmar con
  `gcloud builds list --project=orbita-api-corp --limit=3` y, si el build
  más reciente dice `SUCCESS`, terminar los dos pasos finales a mano
  (`gcloud artifacts docker tags add ... :latest` y `gcloud run deploy ...`,
  copiando los flags tal cual están en `deploy.sh`) en vez de re-correr todo
  el script desde cero.

## Freno de gasto automático

Si el gasto mensual del proyecto llega al presupuesto configurado, el
servicio deja de procesar requests reales — corta con un 503 + mensaje de
mantenimiento antes de gastar más cómputo. No apaga el proyecto ni corta la
facturación (esa alternativa, evaluada y descartada: puede tardar hasta 24hs
en revertirse y arriesga perder datos, ver el reporte del CTO).

**Cómo está armado:**

1. **Presupuesto** (`Cloud Billing → Presupuestos`, `orbita-api-corp`, $25/mes,
   ver `gcloud billing budgets create` en el historial): 2 umbrales.
   - **80% ($20):** manda email automático a los admins de facturación
     (default de Cloud Billing, sin código de por medio).
   - **100% ($25):** publica en el tópico de Pub/Sub `budget-alerts`.
2. **Cloud Function `pauseIfOverBudget`** (`deploy/budget-guard/`, gen2, disparada
   por ese tópico): valida que el mensaje sea realmente el del 100% (Cloud
   Billing manda un mensaje por cada umbral, no todos son para actuar), y si
   corresponde, activa `MAINTENANCE_MODE=true` en el servicio (crea una
   revisión nueva vía la API v1 de Cloud Run — no hay forma de tocar un solo
   env var sin mandar el spec completo de vuelta, ver `enableMaintenanceMode`
   en el código para el patrón exacto, verificado con `--log-http`).
3. **`main.ts`** lee esa env var al arrancar: si está en `true`, corta TODAS
   las requests con 503 antes de llegar a CORS/body-parser/guards/DB — no se
   genera gasto de cómputo real por request mientras esté activo.

**Para desactivarlo manualmente** (después de resolver lo que sea que generó
el gasto, o si se disparó por error):

```bash
gcloud run services update orbita-api --region=southamerica-east1 \
  --project=orbita-api-corp --remove-env-vars=MAINTENANCE_MODE
```

**Para probarlo sin esperar a gastar $25 de verdad**, publicar un mensaje
simulado en el tópico:

```bash
gcloud pubsub topics publish budget-alerts --project=orbita-api-corp \
  --message='{"costAmount":25,"budgetAmount":25,"alertThresholdExceeded":1.0}'
```

**Service account de la función** (`budget-guard@orbita-api-corp.iam.gserviceaccount.com`)
tiene, a propósito, solo lo mínimo para esto — no puede tocar secrets, ni
nada fuera de Cloud Run:
- `roles/run.admin` (proyecto)
- `roles/artifactregistry.reader` (proyecto)
- `roles/iam.serviceAccountUser` sobre `681215569277-compute@developer.gserviceaccount.com`

## Retención de logs y registros

Hallazgo `logs-sin-retencion` de la auditoría interna (detectado el 10/09,
cerrado el 14/09). Nada crece para siempre: el mantenimiento nocturno
(`POST /internal-cron/nightly-subscriptions-maintenance`, ver § Cron jobs)
borra lo más viejo que la retención de cada tabla, justo después de la purga
de la analítica del wizard. Código:
`src/internal-cron/retencion-logs.service.ts` (`purgar()`).

### Tablas de la base

| Tabla | Variable | Default | Qué guarda |
|---|---|---|---|
| `platform_admin_logs` | `PLATFORM_ADMIN_LOGS_RETENTION_DAYS` | 365 días | acciones del super admin sobre negocios y suscripciones |
| `audit_logs` | `AUDIT_LOGS_RETENTION_DAYS` | 365 días | registro de solo agregado de cada negocio (quién cambió qué en el panel) |
| `email_logs` | `EMAIL_LOGS_RETENTION_DAYS` | 180 días | qué mail se le mandó a quién y si salió |
| `wizard_events` / `wizard_ai_turns` | `WIZARD_ANALYTICS_RETENTION_DAYS` | 180 días | analítica del wizard (ya existía, `wizard-analytics.service.ts`) |

Reglas, iguales para las tres nuevas:

- Se cuenta en días desde `created_at`, con el instante actual como referencia.
- Nunca menos de **30** días: un valor menor se sube a 30. Por debajo de un
  mes se pierde la trazabilidad de cualquier reclamo reciente.
- `0` u `off` **apaga** la purga de esa tabla sola; las otras siguen.
- Vacía o inválida (`"un año"`) = el default.
- Cada corrida loguea por tabla `Retención de <tabla> (<n> días): <k> filas
  borradas` (o `apagada por <variable>`). Una tabla que falla se anota con
  `error` y no frena a las otras ni a la corrida nocturna: mañana vuelve a
  intentar y lo que no se borró hoy cae entonces.
- `audit_logs` es de solo agregado; esta purga por antigüedad es la única
  excepción permitida y `test/unit/audit.auditoria.unit-spec.ts` la vigila
  (borra por fecha y nada más, nunca por negocio, entidad ni acción).

Las tres variables NO son sensibles: van en `deploy/env-vars.yaml`, donde
están **comentadas con su default**. Para cambiar una, descomentarla, poner el
valor y volver a desplegar (§ Actualizar variables NO sensibles).

Al 14/09 en producción: `platform_admin_logs` 20 filas, `audit_logs` 0,
`email_logs` 676 (la más vieja del 30/07). Con estos defaults la primera noche
no borra nada; `email_logs` empieza a perder filas recién a fines de enero
de 2027.

### Cloud Logging (lo que la API escribe por consola)

Lo que sale por stdout/stderr (el `Logger` de Nest, los request logs de Cloud
Run) va al bucket `_Default` de Cloud Logging del proyecto, que retiene
**30 días** por defecto. El otro bucket, `_Required` (audit logs de
administración de GCP), retiene 400 días y no se puede cambiar. Para ver la
retención actual:

```bash
gcloud logging buckets describe _Default --location=global --project orbita-api-corp
```

Para cambiarla (`N` entre 1 y 3650; retener más de 30 días se cobra por GiB
según la tarifa vigente de Cloud Logging, la ingesta hasta el free tier no):

```bash
gcloud logging buckets update _Default --location=global --project orbita-api-corp --retention-days=N
```

Decisión: se deja en 30 días. Lo que vale más que un mes (quién hizo qué, qué
mail salió) ya queda en las tablas de arriba, con retención propia y más
larga; los logs de consola sirven para diagnosticar lo reciente, nada más.
