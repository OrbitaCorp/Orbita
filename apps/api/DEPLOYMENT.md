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
| CPU throttling | **desactivado** (`--no-cpu-throttling`) | **crítico**: `subscriptions.service.ts` y `notifications.service.ts` tienen `@Cron(...)` (sweep de suscripciones, recordatorios) que corren en horarios fijos sin tráfico entrante. Cloud Run por default apaga la CPU entre requests — con eso activado, esos cron jobs simplemente no correrían. |
| Min instances | 1 | consecuencia directa de lo anterior: sin al menos 1 instancia siempre viva, no hay dónde correr el scheduler. También evita cold starts en el storefront. |
| Max instances | 10 | techo de escalado, ajustable según tráfico real |
| Concurrency | 40 (default de Cloud Run es 80) | las tareas de imagen son pesadas, se bajó para que no se amontonen muchas en la misma instancia |

Subir CPU/memoria es un solo comando (`gcloud run services update --memory=4Gi
--cpu=4 ...`), sin rebuild ni downtime. Ver el reporte del CTO para el impacto
en costo de tocar estos números.

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
