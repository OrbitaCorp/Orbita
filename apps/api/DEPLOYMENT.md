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
- `git` (el script tagea la imagen con el commit SHA).

## Deploy

```bash
cd apps/api
./deploy/deploy.sh
```

Esto: buildea la imagen con Cloud Build (no hace falta Docker instalado
localmente), la sube a Artifact Registry taggeada con el SHA del commit actual
+ `:latest`, y despliega esa imagen a Cloud Run con los recursos y secrets ya
configurados. Al final imprime la URL directa de Cloud Run y recuerda el dominio
de producción.

No hay CI/CD automático (no se configuró GitHub Actions ni un Cloud Build
Trigger a propósito — decisión explícita para no sumar otro servicio con costo
propio). El deploy es manual, corriendo el script cuando haya algo nuevo para
publicar.

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

## Actualizar variables NO sensibles

Editar `deploy/env-vars.yaml` (se commitea a git, no tiene secrets) y correr
`deploy.sh` de nuevo.

## Ver logs

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="orbita-api"' \
  --project=orbita-api-corp --limit=100 --order=desc \
  --format="value(textPayload)"
```

O directo en la consola: [Cloud Run → orbita-api → Logs](https://console.cloud.google.com/run/detail/southamerica-east1/orbita-api/logs?project=orbita-api-corp).

## Rollback

Cada deploy queda taggeado con el SHA del commit. Para volver a una versión
anterior sin rebuildear:

```bash
gcloud run deploy orbita-api \
  --image southamerica-east1-docker.pkg.dev/orbita-api-corp/orbita-api/orbita-api:SHA_ANTERIOR \
  --region southamerica-east1 --project orbita-api-corp --quiet
```

(los flags de memoria/secrets/etc. no hace falta repetirlos — Cloud Run los
mantiene de la revisión anterior si no los especificás de nuevo).

## Recursos configurados y por qué

| Parámetro | Valor | Motivo |
|---|---|---|
| CPU | 2 vCPU | `sharp` (procesamiento de imágenes) y `onnxruntime-node` (remoción de fondo) son CPU-intensivos |
| Memoria | 2 GiB | margen para procesar imágenes sin OOM |
| CPU throttling | **activado** (default de Cloud Run) | la CPU se apaga entre requests — es lo que mantiene el costo cerca de $0 en reposo. Antes se había desactivado por los `@Cron`, pero esos se sacaron del proceso (ver abajo), así que ya no hace falta. |
| Min instances | 0 | escala a cero sin tráfico. También revertido — ya no depende de tener una instancia siempre viva. |
| Max instances | 10 | techo de escalado, ajustable según tráfico real |
| Concurrency | 40 (default de Cloud Run es 80) | las tareas de imagen son pesadas, se bajó para que no se amontonen muchas en la misma instancia |

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
