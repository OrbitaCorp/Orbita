# Cost Control Dashboard — Design Spec

**Fecha:** 2026-09-23
**Alcance:** Nueva pantalla "Costos" en el Super Admin para monitorear gastos de plataformas SaaS.

## Decisiones tomadas

| Decisión | Elección | Razón |
|----------|----------|-------|
| Arquitectura de datos | Metering interno + sync externo (Enfoque A) | Granularidad real por negocio desde día 1 |
| Layout | Vista unificada scrolleable | Consistente con TabResumen existente |
| Gráfico principal | Sparklines por servicio (dentro de cada tarjeta) | Cada servicio tiene rangos de costo muy distintos; un chart con todos aplasta los chicos |
| UI principal | Grid de tarjetas tipo "Account Balance" | Cada servicio como tarjeta con logo, costo, delta, sparkline — inspirado en Veltrix dashboard |
| KPI pills | Eliminadas | Se sentían genéricas; el total va integrado en el header del bloque Servicios |
| Acceso | Solo SUPERADMIN | Para ver y configurar |
| Moneda | USD | Todo se muestra en dólares |
| Ciclo | Mensual (1 al 30/31) | Todos los servicios facturan así |

## Servicios monitoreados (v1)

| Servicio | API | Adaptador |
|----------|-----|-----------|
| Google Cloud | Cloud Billing API | `gcloud.adapter.ts` |
| Cloudflare | GraphQL Analytics + R2 API | `cloudflare.adapter.ts` |
| Supabase | Management API `/v1/projects/{ref}/usage` | `supabase.adapter.ts` |
| Gemini | Billing via Google Cloud | `gemini.adapter.ts` |
| Groq | `/usage` endpoint | `groq.adapter.ts` |
| Vercel | REST API `/v1/usage` | `vercel.adapter.ts` |
| Resend | Usage stats endpoint | `resend.adapter.ts` |

Escalable: agregar servicio = nuevo registro en `CostProvider` + adaptador.

## Modelo de datos (Prisma)

### CostProvider
Catálogo de servicios. Campos: `id`, `slug` (unique), `name`, `icon`, `apiType` (AUTO|MANUAL|HYBRID), `color`, `active`, `createdAt`.

### CostSnapshot
Costo mensual real por proveedor. Campos: `id`, `providerId` (FK), `month` ("2026-09"), `amountUsd` (Decimal), `breakdown` (Json), `source` (API|MANUAL|CSV_IMPORT), `fetchedAt`, `createdAt`. Unique: `(providerId, month)`.

### UsageEvent
Metering interno por operación. Campos: `id`, `providerId` (FK), `businessId` (FK nullable), `category`, `quantity` (Decimal), `unit`, `estimatedCostUsd` (Decimal nullable), `metadata` (Json nullable), `timestamp`. Índices: `(providerId, timestamp)`, `(businessId, timestamp)`.

### CostLimit
Límites configurables. Campos: `id`, `providerId` (FK nullable = global), `type` (SPEND|USAGE), `category` (nullable), `threshold` (Decimal), `unit`, `alertAtPercent` (Int[]), `period` (MONTHLY), `active`, `createdAt`.

### CostAlert
Alertas disparadas. Campos: `id`, `limitId` (FK), `percentReached` (Int), `currentValue` (Decimal), `notifiedAt`, `acknowledgedAt` (nullable).

## Backend

### Estructura de archivos
```
apps/api/src/platform/costs/
├── costs.module.ts
├── costs.service.ts
├── costs.controller.ts
├── usage-metering.service.ts
├── cost-alerts.service.ts
├── adapters/
│   ├── adapter.interface.ts
│   ├── gcloud.adapter.ts
│   ├── cloudflare.adapter.ts
│   ├── supabase.adapter.ts
│   ├── resend.adapter.ts
│   ├── gemini.adapter.ts
│   ├── groq.adapter.ts
│   └── vercel.adapter.ts
└── costs.cron.ts
```

### Interfaz del adaptador
```ts
interface CostAdapter {
  slug: string
  fetchMonthlyCost(month: string): Promise<{
    amountUsd: number
    breakdown: Record<string, number>
  }>
  fetchCurrentUsage?(): Promise<{
    items: { category: string; value: number; unit: string; limit?: number }[]
  }>
}
```

### Cron job diario (06:00 UTC)
1. Para cada provider AUTO/HYBRID: `adapter.fetchMonthlyCost()` → upsert `CostSnapshot`
2. Evaluar `CostLimit` activos contra snapshots
3. Si umbral cruzado sin alert previo → crear `CostAlert` + enviar email vía Resend

### Usage Metering Service
Inyectable en servicios existentes. `track({ providerSlug, businessId?, category, quantity, unit, estimatedCostUsd?, metadata? })`. Insert asíncrono, no bloquea el flujo principal.

Instrumentación:
- AI service → `gemini`/`groq` | `ai_call`
- Email service → `resend` | `email_sent`
- Storage R2 → `cloudflare` | `storage_upload`/`storage_read`
- Workers AI (backgrounds) → `cloudflare` | `worker_invocation`

### Endpoints REST (`/platform/costs/*`, @SoloSuperadmin)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/costs/overview` | Resumen: total, por proveedor, delta vs mes anterior, sparklines |
| GET | `/costs/history?months=N` | Historial mensual |
| GET | `/costs/provider/:slug?month=YYYY-MM` | Detalle de un proveedor |
| GET | `/costs/by-business?month=YYYY-MM` | Desglose por negocio |
| GET | `/costs/usage-current` | Uso actual en tiempo real |
| POST | `/costs/snapshot` | Carga manual |
| POST | `/costs/snapshot/csv` | Import CSV |
| GET | `/costs/limits` | Lista de límites |
| POST | `/costs/limits` | Crear/editar límite |
| DELETE | `/costs/limits/:id` | Borrar límite |
| GET | `/costs/alerts?month=YYYY-MM` | Alertas del mes |
| PATCH | `/costs/alerts/:id/ack` | Marcar alerta como vista |
| POST | `/costs/sync` | Forzar sync manual |

### Credenciales
Env vars en backend: `COST_GCLOUD_SA_KEY`, `COST_CLOUDFLARE_TOKEN`, `COST_SUPABASE_KEY`, `COST_RESEND_KEY`, `COST_GEMINI_KEY`, `COST_GROQ_KEY`, `COST_VERCEL_TOKEN`. Si falta → adaptador se marca MANUAL.

## Frontend

### Tab en SuperAdmin
- ID: `costos`
- Label: `Costos`
- Icono: `DollarSign` (lucide)
- Grupo: `Interno`
- Archivo: `apps/web/src/modules/superadmin/Costos.tsx`
- Solo visible si `user.admin.role === 'SUPERADMIN'`

### Layout de la pantalla (de arriba a abajo)

**1. Header**
- Título "Control de Costos" + subtítulo
- RangePicker (1M / 3M / 6M / 12M)
- Botón "↻ Sync" (fuerza fetch de adaptadores)

**2. Bloque "Servicios" (estilo Account Balance)**
- Card contenedora con header: "Servicios" + "Gasto total = $X" + delta + botón "+ Cargar manual"
- Grid 4 columnas con una tarjeta por servicio:
  - Logo/ícono con colores de marca del servicio
  - Nombre del servicio
  - Costo del mes actual (font-weight 800, tabular-nums)
  - Delta vs mes anterior (verde ▼ / rojo ▲ / gris = igual)
  - Sparkline SVG propio (cada servicio tiene su propia escala)
  - Menú "⋮" (ver detalle, cargar manual, editar)
- Tarjeta "+" para agregar servicio (dashed border)

**3. Dos columnas**
- **Izquierda: Límites activos** — progress bars con estado visual (warning amber si >80%, red si >95%). Botón "+ Nuevo límite" abre modal.
- **Derecha: Top negocios por consumo** — tabla con columnas: Negocio, IA, Storage, Total, % del total con mini-bar.

**4. Alertas recientes**
- Lista cronológica de alertas disparadas.
- Alertas pendientes: fondo amber, botón "Marcar como vista".
- Alertas acknowledged: fondo gris, opacity reducida.

### Interacciones

| Acción | Resultado |
|--------|-----------|
| Click en tarjeta de servicio | Drawer lateral (560px) con: sub-breakdown del mes, uso actual (gauges), historial del servicio (line chart), botón carga manual |
| Click en "⋮" de tarjeta | Menú: Ver detalle, Cargar manual, Configurar límite |
| Click en negocio (tabla) | Drawer con consumo del negocio desglosado por categoría y por servicio |
| "+ Nuevo límite" | Modal (460px): select servicio, tipo (gasto/uso), categoría, umbral, unidad, % de alerta (chips editables) |
| "↻ Sync" | Spinner en el botón, fetch de todos los adaptadores, refresca overview al terminar |
| "Marcar como vista" | PATCH alert, atenúa visualmente la alerta |
| "+ Cargar manual" | Modal con: select servicio, mes, monto USD, desglose JSON opcional, o upload CSV |
| "+ Agregar servicio" | Modal con: nombre, slug, color, tipo (auto/manual) |

### Componentes nuevos
- `ServiceCard` — tarjeta de servicio con logo, costo, delta, sparkline
- `SparklineSvg` — SVG inline para sparklines (recibe array de números, color)
- `LimitBar` — progress bar con estado visual (ok/warning/danger)
- `ServiceDrawer` — drawer lateral de detalle de servicio
- `BusinessCostDrawer` — drawer de consumo por negocio
- `LimitModal` — formulario de crear/editar límite
- `ManualEntryModal` — carga manual de snapshot

### API client (platformApi)
Agregar a `apps/web/src/lib/platform/api.ts`:
- `platformApi.costsOverview(months)` → GET `/costs/overview`
- `platformApi.costsHistory(months)` → GET `/costs/history`
- `platformApi.costsProvider(slug, month)` → GET `/costs/provider/:slug`
- `platformApi.costsByBusiness(month)` → GET `/costs/by-business`
- `platformApi.costsLimits()` → GET `/costs/limits`
- `platformApi.costsCreateLimit(body)` → POST `/costs/limits`
- `platformApi.costsDeleteLimit(id)` → DELETE `/costs/limits/:id`
- `platformApi.costsAlerts(month)` → GET `/costs/alerts`
- `platformApi.costsAckAlert(id)` → PATCH `/costs/alerts/:id/ack`
- `platformApi.costsSync()` → POST `/costs/sync`
- `platformApi.costsManualSnapshot(body)` → POST `/costs/snapshot`

## Alertas por email
- Template: "Órbita — Alerta de costos"
- Contenido: servicio, métrica, valor actual, umbral, % alcanzado
- Se envía via Resend (ya integrado en el proyecto)
- Destinatarios: todos los platform admins con rol SUPERADMIN
