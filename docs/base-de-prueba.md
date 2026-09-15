# Base de prueba: copia saneada de producción

Una copia del backup de producción, restaurada en **otro** proyecto de Supabase y saneada, para
desarrollar sin tocar producción.

## Por qué existe

- **`hallazgo.base-prueba`** (ALTA, 04/09) y el ítem **`trans.base-prueba`**: la única base es
  producción. El `.env` local, los scripts y los e2e escriben ahí.
- **`hallazgo.backups-sin-verificar`** (ALTA, 10/09) y el ítem **`trans.backups`**: nunca se probó
  que un backup restaure.

Armar la copia desde un backup avanza los dos a la vez: prueba la restauración y deja una base para
desarrollar. **No los cierra solo**: los e2e y CI contra esta base, el `.env` por defecto de cada dev,
el RPO/RTO y la copia de claves siguen abiertos.

> **Regla de toda la guía: producción solo se lee.** `pg_dump` y `--verificar` leen. Lo que escribe
> (`pg_restore`, `--sanear --si`, el SQL Editor, crear buckets) va al proyecto **de prueba**. Antes de
> cada paso que escribe, mirá el **ref** del proyecto. El host del pooler
> (`aws-1-sa-east-1.pooler.supabase.com`) es compartido: lo que distingue una base de otra es el
> usuario `postgres.<ref>`.

Piezas:

| Archivo | Qué hace |
|---|---|
| `apps/api/scripts/base-prueba/preparar-base-prueba.cjs` | Guardas, `--verificar` (compara la copia con producción) y `--sanear` |
| `apps/api/scripts/base-prueba/sanear.sql` | El saneo: solo UPDATE/DELETE, idempotente, comentado bloque por bloque |
| `apps/api/.env.prueba` | Tu configuración local contra la copia. No se versiona ni sube a Cloud Build |
| `apps/api/test/unit/base-prueba.unit-spec.ts` | Corre el validador del script contra `sanear.sql` **sin ninguna base**: que sean solo UPDATE/DELETE, que la lista de tiendas del equipo coincida en todos lados, y que lo que no está acotado a las tiendas de afuera sea lo intencional |

El script se puede `require` desde un test sin que conecte a nada (el bloque principal corre solo
con `require.main === module`).

## 1. Crear el proyecto de prueba

Con el método A del paso 2 este paso lo hace el propio restore: saltealo y revisá lo mismo en el
proyecto que se crea.

En Supabase, organización de Órbita → **New project**:

- Nombre: `orbita-prueba`.
- Región: **South America (São Paulo)**, la misma que producción (`sa-east-1`).
- Contraseña de la base: generada, **distinta de producción**, guardada en el gestor de claves del
  equipo.
- Versión: **Postgres 17**. Confirmala en *Project Settings → Infrastructure* antes de restaurar.
- Anotá el **ref** (*Project Settings → General*, también figura en la URL del panel).

## 2. Restaurar el backup

### Opción A: desde el panel de Supabase (si el plan la ofrece)

Proyecto de **producción** → *Database → Backups* → elegir el backup diario (o un punto en el tiempo
si hay PITR) → **Restore to a new project**.

- ⚠️ El botón **Restore** a secas, sin "new project", **pisa producción** con el backup. Nunca se usa
  para esto.
- Copia la base entera: también `auth.*` y los metadatos de `storage.*`, pero **no** los archivos de
  Storage.
- Si la opción no aparece, el plan no la incluye: usá la B.

### Opción B: `pg_dump` / `pg_restore`

Hacen falta las herramientas cliente de **PostgreSQL 17**. En Windows: instalador de EDB, marcando
solo *Command Line Tools*. `pg_dump --version` tiene que decir `17.x`: un `pg_dump` más viejo que el
servidor falla.

**El dump es producción entera sin sanear**: hashes de contraseñas, tokens de Mercado Pago cifrados y
altas con contraseñas en claro. Va **fuera del repo** (por ejemplo `D:\Orbita-2026\backups-base\`,
que está fuera de `Orbita-Frontend`). Nunca en una carpeta sincronizada (OneDrive, Drive) ni por chat.
`apps/api/.gitignore` ignora `*.dump`, `*.backup`, `*.sql.gz` y `backups/` solo como última barrera.

La contraseña se pide por teclado y nunca va en la URL, así no queda en el historial. En Git Bash:

```bash
mkdir -p /d/Orbita-2026/backups-base && cd /d/Orbita-2026/backups-base
POOLER=aws-1-sa-east-1.pooler.supabase.com
REF_PROD=<ref de producción>
REF_PRUEBA=<ref del proyecto de prueba>

# 1) Dump de PRODUCCIÓN: solo lee (pg_dump trabaja en una transacción de solo lectura).
read -rsp "Contraseña de la base de PRODUCCIÓN: " PGPASSWORD; echo; export PGPASSWORD
pg_dump "postgresql://postgres.$REF_PROD@$POOLER:5432/postgres?sslmode=require" \
  --schema=public --format=custom \
  --file="orbita-prod-$(date +%Y%m%d-%H%M).dump"
unset PGPASSWORD

# 2) Índice del dump sin el esquema public, que ya existe en el proyecto nuevo.
DUMP=orbita-prod-AAAAMMDD-HHMM.dump
pg_restore --list "$DUMP" | grep -v -E 'SCHEMA - public|COMMENT - SCHEMA public|ACL - SCHEMA public' > lista.txt

# 3) Restore en la base de PRUEBA: todo o nada. Mirá dos veces que diga $REF_PRUEBA.
read -rsp "Contraseña de la base de PRUEBA: " PGPASSWORD; echo; export PGPASSWORD
pg_restore --dbname="postgresql://postgres.$REF_PRUEBA@$POOLER:5432/postgres?sslmode=require" \
  --use-list=lista.txt --no-owner --single-transaction --exit-on-error "$DUMP"
unset PGPASSWORD
```

- `--single-transaction --exit-on-error`: si algo falla no queda nada a medias. Y si por error apuntara
  a una base que ya tiene las tablas, corta en la primera sentencia sin escribir nada. Es una segunda
  barrera: la primera es mirar el ref.
- **Nunca** `--clean`: son `DROP`, y con una URL equivocada borran producción.
- El dump incluye `_prisma_migrations`, RLS y permisos de `public`. No incluye `auth.*` ni `storage.*`.

## 3. Buckets de Storage

En el proyecto **de prueba** → *Storage → New bucket*, los dos **públicos** (las URLs salen de
`getPublicUrl`):

- `product-images`: fotos de productos.
- `business-logos`: logos e imágenes del negocio, y avatares de clientes (`avatars/<customerId>/`).

Las URLs que trae la copia siguen apuntando al Storage de producción. Se ven porque es lectura
pública, y no hace falta copiarlas. Lo que subas o borres desde local va al proyecto de prueba solo si
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son las de prueba (paso 6). Con las de producción,
borrar una foto en la copia **borra el archivo real**: `extractStoragePath` toma el path e ignora el
host.

## 4. Verificar y sanear la copia

Agregá al final de `apps/api/.env` (el de producción, que es el ORIGEN; ya lo ignoran git y Cloud
Build) la conexión **de sesión** a la base de prueba:

```dotenv
DESTINO_URL="postgresql://postgres.<REF_PRUEBA>:<contraseña de prueba>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
```

Desde `apps/api`, con Node 22 y **siempre con `--env-file=.env`**:

```bash
node --env-file=.env scripts/base-prueba/preparar-base-prueba.cjs                  # 1. solo guardas, no conecta
node --env-file=.env scripts/base-prueba/preparar-base-prueba.cjs --verificar      # 2. compara (lee las dos)
node --env-file=.env scripts/base-prueba/preparar-base-prueba.cjs --sanear         # 3. prueba en seco: ROLLBACK
node --env-file=.env scripts/base-prueba/preparar-base-prueba.cjs --sanear --si    # 4. aplica: COMMIT
node --env-file=.env scripts/base-prueba/preparar-base-prueba.cjs --sanear         # 5. otra vez: todo en 0 filas
```

**Guardas.** El script corta **antes de conectar** en estos casos:

- falta `DESTINO_URL`;
- `DESTINO_URL` es igual a `DIRECT_URL` o `DATABASE_URL`, aunque cambie el puerto, las mayúsculas o
  `?pgbouncer=true`;
- el ref de producción aparece en cualquier parte de `DESTINO_URL`;
- está cargado `.env.prueba`.

Después de conectar, también corta si las dos conexiones llegan al mismo servidor de Postgres. A
producción solo le hace `SELECT`, dentro de transacciones `READ ONLY`.

**`--verificar`** (correlo **antes** de sanear, así los conteos son comparables):

- Tablas de `public` y migraciones aplicadas en las dos bases. Si falta una tabla o las migraciones no
  coinciden, exit 1.
- Filas por tabla, con la diferencia. Las diferencias **no son error**, porque producción sigue
  escribiendo. Se marca `revisar` donde la copia tiene menos del 90%.
- RLS y permisos de `anon`/`authenticated`. Si la copia quedó más abierta que producción, en el
  **SQL Editor del proyecto de prueba** corré el contenido de
  `apps/api/prisma/migrations/20260910110000_rls_tablas_publicas/migration.sql`.
- Filas de `auth.users` y `storage.objects`. Si la copia tiene usuarios en `auth.users` (quedaron de
  cuando se usaba Supabase Auth), borralos en el proyecto de prueba: *Authentication → Users*.
- Al final imprime un bloque para el tablero (paso 5).

Después de `--sanear --si` estas tablas dan distinto a propósito: `refresh_tokens`,
`password_reset_tokens`, `platform_admin_login_codes`, `pending_signups`, `mp_credentials` y
`orbi_conversations`.

**`--sanear`** corre `sanear.sql` en **una** transacción sobre la copia y muestra las filas afectadas
por sentencia. Después cuenta lo que no debería quedar (tokens, ids externos, emails reales de
clientes, compradores, miembros, proveedores y `email_logs` fuera del equipo). Sin `--si` hace
ROLLBACK. Con `--si` hace COMMIT solo si todos los chequeos dan 0.

| Qué | Dónde | Cómo |
|---|---|---|
| Sesiones, códigos de recuperación y de 2FA, altas pendientes, `mp_credentials` | todas las tiendas | se borran las filas |
| Tokens de invitación, `payments.mp_payment_id`, `subscriptions.mp_preapproval_id` | todas | `NULL` |
| `custom_domains.domain` y `domain_purchase_orders.domain` | todas | `<id>.dominio-prueba.invalid` |
| Compras de dominio `PENDING_PAYMENT` | todas | pasan a `FAILED` |
| Nombre y subdominio de la tienda, contacto, CUIT, CBU, redes, dirección del local | fuera del equipo | anonimizado / `NULL` |
| Miembros, clientes, direcciones, proveedores, compradores, WHOIS | fuera del equipo | emails `<tipo>-<id>@prueba.orbita.test`, sin contraseñas ni Google |
| Notas, chats, reseñas, motivos, `audit_logs.changes`, `email_logs` | fuera del equipo | texto de prueba |
| Chats con Orbi | fuera del equipo | se borran |
| IPs y emails del log del super panel, notas de códigos, preguntas del wizard | todas | anonimizado |

Tiendas del equipo: `negocio`, `zapatoslorena`, `alex` y `asd`. Se conservan, igual que los
`platform_admins`. Para sumar una, hay que cambiar **todas** las listas de `sanear.sql` y
`SUBDOMINIOS_EQUIPO` del script, que verifica que coincidan.

Cómo queda la copia:

- **Tiendas del equipo**: se entra con las contraseñas de siempre. Las sesiones se cerraron.
- **Super panel**: mismo usuario. El código de 2FA sale en la consola de la API (mail en STUB).
- **Otras tiendas**:
  - Subdominio `prueba-<id sin guiones>`, sin contraseñas.
  - Para entrar: "olvidé mi contraseña" con `miembro-<id>@prueba.orbita.test`. El código sale en la
    consola.
- **Mercado Pago** desconectado en todas. Para probarlo, conectá un usuario de prueba de MP.
- **Compradores reales en tiendas del equipo**: el saneo los cuenta ("Para revisar a mano") pero no
  los toca. Decidilo aparte.

## 5. Constancia en el tablero de auditoría

En *Super admin → Auditoría*, en las notas de `hallazgo.backups-sin-verificar`, `trans.backups`,
`hallazgo.base-prueba` y `trans.base-prueba`, dejá:

- fecha y quién lo hizo, y el método (A o B);
- fecha del backup (la línea "Último registro en la copia" de `--verificar`);
- ref del proyecto de prueba y versión de Postgres;
- el bloque final de `--verificar`: migraciones, tablas, filas, tablas `revisar` y por qué;
- fecha del `--sanear --si` y que los chequeos dieron 0.

Nunca pegues URLs con contraseña ni el dump. Checks que esto respalda:

- "Restauración de prueba en un proyecto aparte" y "Se hizo al menos una prueba de restauración a una
  base aparte".
- "Base de prueba creada" y "Existe una base/rama de Supabase para tests y CI".

Marcarlos como hechos lo decide Ale.

## 6. `apps/api/.env.prueba` y cómo alternar

**Cómo carga la API.** `ConfigModule.forRoot({ isGlobal: true })` lee primero `process.env`, y el
`.env` solo completa las claves que **no** estén definidas. El cliente de Prisma también carga el
`.env` sin pisar nada.

- `nest start --env-file .env.prueba` mete `.env.prueba` en `process.env`.
- Cualquier clave que esté en `.env` y falte en `.env.prueba` se toma **de producción**.
- Por eso `.env.prueba` tiene que tener **todas** las claves del `.env`, aunque sea vacías:
  `CLAVE=` cuenta como definida.

Plantilla: reemplazá lo que va entre `< >`.

```dotenv
# Marca: preparar-base-prueba.cjs se niega a correr con este archivo cargado.
BASE_DE_PRUEBA=1
DESTINO_URL=
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001

# Base de PRUEBA: usuario postgres.<REF_PRUEBA> en las dos, nunca el ref de producción.
DATABASE_URL="postgresql://postgres.<REF_PRUEBA>:<contraseña>@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<REF_PRUEBA>:<contraseña>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"

# Storage del proyecto de PRUEBA (con los dos buckets del paso 3).
SUPABASE_URL="https://<REF_PRUEBA>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service_role del proyecto de prueba>"

# Claves NUEVAS, distintas de producción: openssl rand -hex 32.
# Así ni los JWT ni los tokens de MP de producción sirven acá, ni al revés.
JWT_SECRET=<generar>
JWT_EXPIRES_IN=15m
MERCADOPAGO_TOKEN_KEY=<generar>

# Mails: vacía = modo STUB (salen por consola y quedan SIMULATED). Exige NODE_ENV distinto de production.
RESEND_API_KEY=
MAIL_FROM=onboarding@resend.dev

# Mercado Pago de plataforma: vacío = no hay preapprovals, cobros, reembolsos ni consultas a MP.
MP_ACCESS_TOKEN=
MP_PLAN_OVERRIDE=false
# Vacío = los tres webhooks responden 503 sin procesar (el comentario de .env.example está desactualizado).
MP_WEBHOOK_SECRET=

# OAuth de MP: obligatorias al arrancar. Ficticias, o las de una app de prueba de MP.
MERCADOPAGO_CLIENT_ID=prueba-sin-mp
MERCADOPAGO_CLIENT_SECRET=prueba-sin-mp
# De acá sale el notification_url de pedidos y dominios: con la de producción, MP avisaría a la API real.
MERCADOPAGO_REDIRECT_URI=http://localhost:3000/api/v1/mercadopago/oauth/callback

# Vercel: sin token no se llama a Vercel. Nunca un token real: el proyecto por defecto es el de producción.
VERCEL_TOKEN=
VERCEL_PROJECT_ID=prueba-sin-vercel
VERCEL_TEAM_ID=prueba-sin-vercel

# Vacío = /internal-cron/* rechaza todo.
CRON_SECRET=

# IA: vacías salvo keys de desarrollo con cuota propia (con keys, Orbi manda datos del negocio al LLM).
GEMINI_API_KEY=
GROQ_API_KEY=

# Login con Google: obligatorias al arrancar. Ficticias si no lo usás; si no, un cliente de desarrollo.
GOOGLE_CLIENT_ID=prueba-sin-google
GOOGLE_CLIENT_SECRET=prueba-sin-google
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback
```

Antes de usarlo, dos chequeos desde `apps/api`. Muestran nombres y hosts, nunca valores secretos.

```bash
# a) Claves del .env que faltan en .env.prueba. Tiene que salir VACÍO: lo que aparezca se agrega
#    a .env.prueba con un valor seguro (vacío si es un secreto).
comm -23 <(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' .env | sort -u) <(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' .env.prueba | sort -u)

# b) Las dos URLs de base tienen que decir postgres.<REF_PRUEBA>.
node --env-file=.env.prueba -e "for (const k of ['DATABASE_URL','DIRECT_URL']) { const u = new URL(process.env[k]); console.log(k, u.hostname, u.port, decodeURIComponent(u.username)) }"
```

Alternar entre las dos bases. Los dos archivos quedan fijos, no se renombra nada:

| Para | Desde `apps/api` |
|---|---|
| API contra la **base de prueba** | `pnpm exec nest start --watch --env-file .env.prueba` |
| API contra producción (como hasta hoy) | `pnpm dev` |
| Migraciones nuevas en la copia (después del chequeo b) | `node --env-file=.env.prueba node_modules/prisma/build/index.js migrate deploy` |
| `preparar-base-prueba.cjs` | siempre `node --env-file=.env ...` |

- Para confirmar contra qué base corre la API, pedí
  `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/storefront/tefaltacalle`:
  **404** en la copia (la tienda quedó anonimizada), **200** en producción.
- `apps/web` no cambia: sigue apuntando a `http://localhost:3000/api/v1`. Revisá que
  `apps/web/.env.local` no pise `NEXT_PUBLIC_API_URL` con la API de producción.
- `apps/api/.env` sigue siendo producción a propósito: los scripts de `scripts/auditoria/`, las
  migraciones del procedimiento de deploy y `DEPLOYMENT.md` lo asumen. Pasar la base de prueba a
  default (check de `trans.base-prueba`) es una decisión aparte.

## Nunca

- **Restore** sobre el proyecto de producción, o `pg_restore` / SQL Editor sin mirar el ref.
- Poner en `.env.prueba` valores reales de `RESEND_API_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`,
  `VERCEL_TOKEN` o `CRON_SECRET`, ni `SUPABASE_*` de producción.
- Registrar un webhook o un túnel hacia local en la app de Mercado Pago de producción. La copia tiene
  los mismos UUID: un pago real con el `external_reference` de un pedido de la copia confirmaría el
  pedido real.
- Apuntar Cloud Scheduler a la copia.
- Refrescar la copia con `--clean`. Para refrescarla, se hace un proyecto de prueba nuevo (o se borra
  el viejo) y se repiten los pasos 2 a 5.
- Dejar el dump suelto. Cuando la copia esté verificada, se guarda como backup en un lugar seguro o se
  borra.
