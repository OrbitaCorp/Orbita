# Orbi — Base de conocimiento por módulo del panel

**Fecha:** 2026-09-08
**Estado:** Aprobado para implementar
**Alcance:** Enriquecer los prompts de Orbi en el panel administrativo con conocimiento de
dominio profundo y datos dinámicos del negocio, siguiendo el mismo estándar de calidad que los
prompts del wizard.

---

## 1. Problema

Los prompts actuales del panel (`apps/api/src/orbi/prompts/panel.ts`) son fichas descriptivas:
dicen qué herramientas tiene Orbi y dan un estilo general, pero no aportan conocimiento de
dominio ni datos del negocio específico. Un usuario que entra al módulo de Pedidos y pregunta
"cómo voy" recibe una respuesta genérica; el mismo Orbi del wizard — que sabe del rubro, de
lo que ya completó, de qué falta — se siente mucho más inteligente.

**Meta:** que Orbi en cada módulo del panel se sienta como un consultor de e-commerce que
además conoce *este* negocio en particular — no como un manual de ayuda.

## 2. Decisiones tomadas

| Decisión | Valor |
|----------|-------|
| Nivel de conocimiento | Dominio profundo + datos dinámicos del negocio |
| Inyección de datos | En el system prompt (como formState del wizard), no bajo demanda |
| Orden de implementación | Por fases, siguiendo el sidebar: Dashboard → Pedidos → Clientes → Productos → Mensajes → Descuentos → Configuración |
| Estructura de archivos | Archivos `*.knowledge.ts` para dominio estático, `ModuleDataService` para datos dinámicos |

## 3. Arquitectura

### 3.1 Capas (sin cambios conceptuales)

```
┌─────────────────────────────────────────────────────┐
│ Capa 1 — CORE_PROMPT (persona, tono, reglas de tools) │
├─────────────────────────────────────────────────────┤
│ Capa 2 — panelBase() (reglas del panel, zona prohibida) │
├─────────────────────────────────────────────────────┤
│ Capa 3 — módulo(biz, moduleData)                        │
│   ├─ Conocimiento de dominio  (knowledge/*.knowledge.ts) │
│   └─ Datos dinámicos del negocio  (ModuleDataService)    │
└─────────────────────────────────────────────────────┘
```

### 3.2 Archivos nuevos y modificados

```
apps/api/src/orbi/
├── prompts/
│   ├── panel.ts                          # MODIFICAR: cada función recibe moduleData y lo interpola
│   └── knowledge/                        # NUEVO: directorio
│       ├── dashboard.knowledge.ts        # Fase 1
│       ├── pedidos.knowledge.ts          # Fase 2
│       ├── clientes.knowledge.ts         # Fase 3
│       ├── catalogo.knowledge.ts         # Fase 4
│       ├── mensajes.knowledge.ts         # Fase 5
│       ├── descuentos.knowledge.ts       # Fase 6
│       └── configuracion.knowledge.ts    # Fase 7
├── context/
│   ├── context-builder.service.ts        # MODIFICAR: llama a ModuleDataService
│   ├── context-builder.spec.ts           # MODIFICAR: tests nuevos con moduleData
│   ├── module-data.service.ts            # NUEVO: queries de datos por módulo
│   └── module-data.service.spec.ts       # NUEVO: tests del servicio de datos
```

### 3.3 Flujo actualizado

```
Frontend (useOrbiContext)
  ↓ POST /orbi/chat  { context: { surface: PANEL, module, section, businessId } }
  ↓
OrbiController
  ↓
ContextBuilderService.buildSystemPrompt(dto)
  ├── CORE_PROMPT                                    (capa 1)
  ├── businessInfo = prisma.business.findUnique(...)  (ya existe)
  ├── moduleData  = moduleDataService.getSnapshot(businessId, module)  ← NUEVO
  └── getPanelPrompt(module, section, businessInfo, moduleData)        ← MODIFICAR firma
        ├── panelBase(businessInfo)                   (capa 2, sin cambios)
        └── dashboard(businessInfo, moduleData)       (capa 3, enriquecida)
              ├── DASHBOARD_KNOWLEDGE                 (importado de knowledge/)
              └── formatDashboardData(moduleData)     (interpola datos dinámicos)
```

### 3.4 ModuleDataService

Servicio inyectable que hace queries ligeras a Prisma. Cada módulo tiene un método dedicado
que devuelve un tipo estricto con solo lo necesario para el prompt.

```typescript
// Firma pública
@Injectable()
export class ModuleDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(businessId: string, module: string): Promise<ModuleSnapshot> {
    switch (module) {
      case 'dashboard':     return this.dashboardSnapshot(businessId);
      case 'pedidos':       return this.pedidosSnapshot(businessId);
      case 'clientes':      return this.clientesSnapshot(businessId);
      case 'catalogo':      return this.catalogoSnapshot(businessId);
      case 'mensajes':      return this.mensajesSnapshot(businessId);
      case 'descuentos':    return this.descuentosSnapshot(businessId);
      case 'configuracion': return this.configuracionSnapshot(businessId);
      default:              return {};
    }
  }
}
```

**Principios:**

- Queries con `select` mínimo — solo counts y datos agregados, nunca filas completas.
- Cada snapshot se ejecuta en paralelo si tiene múltiples queries (`Promise.all`).
- Timeout defensivo: si la query tarda más de 2s, devuelve `{}` y el prompt sigue sin datos.
- Los datos son *solo lectura para el prompt* — nunca PII (emails, teléfonos, direcciones de
  clientes no viajan al system prompt).

### 3.5 Archivos knowledge/*.knowledge.ts

Cada archivo exporta una constante `string` con el conocimiento de dominio estático. Se
importa en `panel.ts` y se concatena al prompt del módulo.

```typescript
// Ejemplo: dashboard.knowledge.ts
export const DASHBOARD_KNOWLEDGE = `## Lo que sabés sobre métricas de un negocio

Las métricas clave de un e-commerce son:
- Ventas del período (monto total y cantidad de pedidos)
- Ticket promedio (ventas / pedidos): si baja puede significar que se venden más productos baratos o que hay muchos descuentos activos
- Tasa de cancelación: arriba del 10% es preocupante, puede indicar problemas de stock o tiempos de entrega
- Productos más vendidos vs. los que no rotan: los que no rotan son candidatos a descuento o a darse de baja
...`;
```

**Criterios de contenido:**

- Escrito en segunda persona ("Lo que sabés"), no en tercera — es una instrucción para Orbi,
  no documentación para humanos.
- Conocimiento de *consultor*, no de *manual*: no "el módulo de pedidos permite ver pedidos"
  sino "un pedido en PENDING más de 24h es urgente — el cliente se está enfriando".
- Específico al e-commerce argentino donde aplique (MercadoPago, costos de envío nacionales,
  temporadas de venta locales como Hot Sale, CyberMonday AR).
- Compacto: 300-500 tokens máximo por módulo. Un prompt largo no es un buen prompt.

### 3.6 Control de tokens

| Capa | Tokens estimados |
|------|-----------------|
| Capa 1 — CORE_PROMPT | ~120 |
| Capa 2 — panelBase() | ~200 |
| Capa 3 — knowledge | ~300-500 |
| Capa 3 — datos dinámicos | ~100-200 |
| **Total system prompt** | **~720-1020** |

Comparable al wizard que usa ~600-900 tokens por paso. Dentro del presupuesto sin
necesidad de truncar.

## 4. Diseño por módulo

### Fase 1 — Dashboard

**Conocimiento de dominio:**
- Cómo interpretar métricas de ventas (tendencias, comparaciones MoM)
- Qué significa un ticket promedio alto vs. bajo para distintos rubros
- Tasa de cancelación: umbrales normales, cuándo preocuparse
- Productos más vendidos / sin rotación: qué acciones tomar
- Segmentación de clientes: qué significa cada segmento para el negocio
- Comportamiento proactivo: si el usuario solo saluda, ofrecer un resumen ejecutivo

**Datos dinámicos (DashboardSnapshot):**
```typescript
{
  salesThisMonth:    { total: number; count: number; avgTicket: number };
  salesLastMonth:    { total: number; count: number };
  pendingOrders:     number;
  cancelledThisMonth: number;
  totalProducts:     number;
  outOfStockProducts: number;
  totalCustomers:    number;
  newCustomersThisMonth: number;
  unreadMessages:    number;
}
```

**Queries Prisma:**
- `order.count/aggregate` agrupado por status y mes
- `product.count` con filtro `stock = 0` y total
- `customer.count` total y con `createdAt` del mes
- `conversation.count` con `unreadByBusiness = true`

---

### Fase 2 — Pedidos

**Conocimiento de dominio:**
- Flujo de estados completo con significado de negocio de cada transición:
  - PENDING: el cliente pagó/hizo el pedido, el negocio todavía no lo vio. **Urgente si > 24h.**
  - CONFIRMED: el negocio aceptó. Siguiente paso: preparar.
  - PREPARING: en proceso de armado/empaquetado.
  - SHIPPED: despachado, el cliente espera la entrega.
  - DELIVERED: entregado, esperando confirmación del cliente.
  - COMPLETED: cerrado satisfactoriamente.
  - CANCELLED: irreversible. Revisar si hay que reintegrar stock y/o reembolsar.
- Anatomía de un pedido: items, subtotal, descuentos aplicados, costo de envío, total
- Cancelaciones: cuándo ofrecer crédito vs. reembolso, impacto en métricas
- Devoluciones: proceso, estados, notas de crédito
- Pedidos manuales (desde el panel): cuándo usarlos (venta telefónica, redes sociales)
- Buenas prácticas: confirmar rápido, notificar al cliente en cada cambio de estado

**Datos dinámicos (PedidosSnapshot):**
```typescript
{
  countByStatus: Record<OrderStatus, number>;
  oldestPendingHours: number | null;    // horas del pedido PENDING más viejo
  avgTicketThisMonth: number;
  lastOrderDate:     string | null;     // ISO, para "tu último pedido fue hace X"
  topPaymentMethod:  string | null;     // método de pago más usado
}
```

---

### Fase 3 — Clientes

**Conocimiento de dominio:**
- Segmentación: VIP (top 10% por gasto), recurrente (2+ pedidos), nuevo (1 pedido), inactivo (sin compra en 60+ días)
- Lifetime value: qué significa, cómo actuar según el segmento
- Retención: señales de que un cliente se está yendo (último pedido viejo, carrito abandonado)
- Cuándo contactar vs. cuándo esperar
- Datos de contacto: qué se puede ver, qué es privado

**Datos dinámicos (ClientesSnapshot):**
```typescript
{
  totalCustomers:    number;
  newThisMonth:      number;
  segmentation:      { vip: number; recurrent: number; new: number; inactive: number };
  topCustomerName:   string | null;     // nombre del cliente con más gasto (no PII sensible)
}
```

---

### Fase 4 — Productos (Catálogo)

**Conocimiento de dominio:**
- Anatomía de un producto: nombre, precio, variantes, stock, categoría, fotos, descripción, estado (borrador/publicado)
- Pricing: margen, precio psicológico ($999 vs $1000), precio tachado
- Fotos: la primera foto es la portada, importancia de buenas fotos
- Descripciones: estructura efectiva (beneficio > característica > especificación)
- Stock: alertas de bajo stock, productos agotados y su impacto
- Categorías: cómo organizar un catálogo, categorías vacías como señal de desorden
- SEO de producto: título y descripción para buscadores
- Borrador vs. publicado: cuándo publicar, cuándo dejar en borrador

**Datos dinámicos (CatalogoSnapshot):**
```typescript
{
  totalProducts:     number;
  publishedProducts: number;
  draftProducts:     number;
  outOfStock:        number;
  totalCategories:   number;
  emptyCategories:   number;           // categorías sin productos
  avgPrice:          number;
}
```

---

### Fase 5 — Mensajes

**Conocimiento de dominio:**
- Importancia del tiempo de respuesta (< 1h ideal, > 24h es abandono)
- Tono: amable, profesional, conciso — como lo haría un buen vendedor
- Plantillas: para qué sirven, cuándo usarlas (bienvenida, seguimiento, post-venta)
- Limitación honesta: Orbi hoy no puede leer ni responder mensajes, pero puede asesorar
- Redirección útil: si el usuario pregunta por un cliente específico, sugerir buscarlo en
  el módulo de Clientes

**Datos dinámicos (MensajesSnapshot):**
```typescript
{
  unreadCount:       number;
  totalConversations: number;
  avgResponseTimeHours: number | null;  // tiempo promedio de respuesta del negocio
}
```

---

### Fase 6 — Descuentos

**Conocimiento de dominio:**
- Descuento automático vs. cupón con código: cuándo usar cada uno
- Tipos: porcentaje vs. monto fijo, por producto/categoría/carrito
- Estrategias: lanzamiento (10-15%), liquidación (30-50%), fidelización (cupón exclusivo),
  carrito abandonado (5-10% por tiempo limitado)
- Márgenes: nunca hacer un descuento que deje margen negativo
- Combinabilidad: qué pasa si hay 2 descuentos que aplican al mismo producto
- Métricas: tasa de uso de cupones, impacto en ticket promedio, ROI del descuento
- 2x1 / NxM: cómo funciona, cuándo conviene vs. descuento directo

**Datos dinámicos (DescuentosSnapshot):**
```typescript
{
  activeDiscounts:   number;
  activeCoupons:     number;
  couponUsageRate:   number | null;     // % de cupones usados vs. emitidos
  totalSavedByCustomers: number | null; // $ ahorrados por los clientes este mes
}
```

---

### Fase 7 — Configuración

**Conocimiento de dominio:**
- Sub-secciones y qué se configura en cada una:
  - Negocio: nombre, descripción, rubro, logo, redes sociales
  - Pagos: MercadoPago (el principal en AR), transferencia bancaria, efectivo en entrega
  - Envíos: envío propio, Correo Argentino, OCA, retiro en local. Costo fijo vs. por zona.
    Envío gratis a partir de cierto monto (estrategia de ticket promedio)
  - Apariencia: colores, fuentes, banner de la tienda
  - Equipo: roles (owner, admin, staff), permisos
  - Notificaciones: qué mails manda la tienda al cliente y cuándo
- Contexto de sección: si el usuario está en "envios", hablar de envíos; si está en
  "pagos", hablar de pagos — no listar todo

**Datos dinámicos (ConfiguracionSnapshot):**
```typescript
{
  paymentMethodsActive: string[];       // ['mercadopago', 'transferencia']
  shippingMethodsActive: string[];      // ['envio_propio', 'retiro_local']
  freeShippingThreshold: number | null; // monto para envío gratis, si está configurado
  teamMembersCount:    number;
  hasCustomDomain:     boolean;
}
```

## 5. Contrato de `getPanelPrompt` (firma nueva)

```typescript
// Tipo unión discriminada para los snapshots
export type ModuleSnapshot =
  | DashboardSnapshot
  | PedidosSnapshot
  | ClientesSnapshot
  | CatalogoSnapshot
  | MensajesSnapshot
  | DescuentosSnapshot
  | ConfiguracionSnapshot
  | {};  // fallback: sin datos

export function getPanelPrompt(
  module?: string,
  section?: string,
  businessInfo?: { name: string; industry: string; mode: string },
  moduleData?: ModuleSnapshot,    // ← NUEVO parámetro
): string;
```

El parámetro es opcional: si `ModuleDataService` falla o el módulo no tiene fase
implementada, se pasa `{}` y el prompt funciona sin datos dinámicos (degradación
graceful).

## 6. Tests

### 6.1 ModuleDataService

- Cada método de snapshot devuelve el tipo correcto con datos de prueba.
- Si el businessId no existe, devuelve `{}` sin error.
- Si una query falla, devuelve `{}` sin propagar la excepción.
- No devuelve PII sensible (emails, teléfonos, direcciones de clientes).

### 6.2 Context-builder (extender los existentes)

- Con moduleData inyectado, el prompt contiene los datos dinámicos interpolados.
- Sin moduleData (o `{}`), el prompt sigue funcional (solo knowledge, sin datos).
- Cada módulo real tiene prompt propio, ninguno cae al fallback (mismo patrón que el
  test existente para wizard steps).
- Los datos dinámicos no filtran a módulos donde no corresponden.

### 6.3 Knowledge files

- Cada archivo exporta un string no vacío.
- El string no contiene placeholders sin resolver (`{{`, `TODO`, `TBD`).
- El token count del knowledge no supera 500 tokens (medido con tiktoken o similar).

## 7. Roadmap de implementación

| Fase | Módulo | Incluye | Dependencias |
|------|--------|---------|-------------|
| **0** | **Infra** | `ModuleDataService` (servicio vacío + DI), tipo `ModuleSnapshot`, firma nueva de `getPanelPrompt`, tests base | Ninguna |
| **1** | **Dashboard** | `dashboard.knowledge.ts`, `dashboardSnapshot()`, prompt enriquecido | Fase 0 |
| **2** | **Pedidos** | `pedidos.knowledge.ts`, `pedidosSnapshot()`, prompt enriquecido | Fase 0 |
| **3** | **Clientes** | `clientes.knowledge.ts`, `clientesSnapshot()`, prompt enriquecido | Fase 0 |
| **4** | **Productos** | `catalogo.knowledge.ts`, `catalogoSnapshot()`, prompt enriquecido | Fase 0 |
| **5** | **Mensajes** | `mensajes.knowledge.ts`, `mensajesSnapshot()`, prompt enriquecido | Fase 0 |
| **6** | **Descuentos** | `descuentos.knowledge.ts`, `descuentosSnapshot()`, prompt enriquecido | Fase 0 |
| **7** | **Configuración** | `configuracion.knowledge.ts`, `configuracionSnapshot()`, prompt enriquecido | Fase 0 |

Cada fase es independiente y deployable por separado. Un módulo sin fase implementada
sigue con el prompt actual.

## 8. Fuera de alcance

- **Knowledge por rubro/industria** — los prompts son genéricos de e-commerce, no varían
  por rubro (ej: "Indumentaria" vs. "Gastronomía"). Si se necesita, es un diseño aparte.
- **Historial de conversación** — Orbi ya tiene contexto de la conversación actual via
  el array de mensajes. Este spec no cambia eso.
- **Nuevas herramientas** — este spec enriquece prompts, no agrega tools. Si un módulo
  necesita tools nuevas (ej: Mensajes), eso va en su propio ticket.
- **Prompt caching** — el CORE_PROMPT y panelBase() ya son cacheables por ser prefijo
  estable. Los datos dinámicos rompen el cache de capa 3, pero son ~100-200 tokens.
  Optimizar cache es una mejora posterior.
