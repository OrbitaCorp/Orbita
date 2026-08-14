# Motor de Notificaciones — Spec de Diseño (RBT-645)

> **Fecha:** 2026-08-14
> **Fase:** 4 (Globales)
> **Ticket:** RBT-645 — Infraestructura - Globales: Motor de notificaciones
> **Dependencias:** NotificationConfig (RBT-642, resuelta), MailService (RBT-607, resuelta)

---

## Objetivo

Implementar el sistema que genera, persiste y entrega las notificaciones del panel de Orbita.
Cuando ocurre un evento de negocio (nuevo pedido, stock crítico, etc.), el motor consulta las
preferencias configuradas por el negocio y despacha la notificación por los canales habilitados:
campana del panel, email, o WhatsApp (stub en esta fase).

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Bus de eventos | `@nestjs/event-emitter` (EventEmitter2) | Desacoplado, sin infra extra. `dispatch()` como único entry point permite migrar a Bull/Redis sin cambiar emisores |
| Entrega en panel | Polling 15s | Mismo patrón que `getUnreadConversationsCount()`. Delay imperceptible para eventos de comercio |
| Canal email | `sendCustomEmail()` existente | Reutiliza el diseño de marca por negocio. Sin plantillas .hbs nuevas |
| Canal WhatsApp | Stub (log only) | Sin proveedor integrado. La preferencia se guarda pero no se envía nada real |
| Alcance notificaciones | Por negocio | Todos los members ven las mismas notificaciones. Consistente con `NotificationConfig` |
| Resumen/reporte | `@Cron` en NotificationsService | Ya existe `@nestjs/schedule` en AppModule |

---

## 1. Modelo de datos

### Nueva tabla: `notifications`

```prisma
model Notification {
  id           String            @id @default(uuid())
  businessId   String            @map("business_id")
  event        String            // 'nuevo_pedido', 'stock_critico', etc.
  title        String            // "Nuevo pedido #1042"
  body         String            // "Juan Pérez — $12.500"
  level        NotificationLevel @default(INFO)
  isRead       Boolean           @default(false) @map("is_read")
  resourceType String?           @map("resource_type") // 'order', 'customer', 'product'
  resourceId   String?           @map("resource_id")   // UUID del recurso
  createdAt    DateTime          @default(now()) @map("created_at")

  business Business @relation(fields: [businessId], references: [id])

  @@index([businessId, isRead, createdAt(sort: Desc)])
  @@map("notifications")
}

enum NotificationLevel {
  INFO
  WARNING
  DANGER
}
```

**Notas:**
- Sin `updatedAt` — solo-inserción + flag `isRead`.
- `resourceType`/`resourceId` polimórficos — la campana linkea a "Ver pedido", "Ver producto", etc.
- Índice compuesto optimiza: contar no leídas + listar recientes.
- Agregar relación inversa `notifications Notification[]` en `Business`.

---

## 2. Módulo backend: `NotificationsModule`

### Estructura de archivos

```
apps/api/src/notifications/
├── notifications.module.ts
├── notifications.service.ts
├── notifications.controller.ts
└── dto/
    └── list-notifications.dto.ts
```

### 2.1 Flujo de despacho (`dispatch()`)

```
Evento ocurre → Service emite evento → EventEmitter2 →
  @OnEvent handler en NotificationsService →
    dispatch(event, businessId, data) →
      1. Leer NotificationConfig.matrix[event]
      2. Si canal panel habilitado → INSERT en notifications
      3. Si canal email habilitado → sendCustomEmail() a los members del negocio
      4. Si canal whatsapp habilitado → log (stub)
```

El método `dispatch()` es el **único punto de entrada** para despachar notificaciones. Si se
migra a Bull/Redis en el futuro, solo se cambia este método.

### 2.2 Destinatarios del email

Cuando el canal email está habilitado para un evento, se envía a **todos los members activos**
del negocio que tengan email (query `members WHERE businessId AND status = 'ACTIVE'`). No hay
preferencia por miembro individual — es por negocio.

### 2.3 Event listeners

Un `@OnEvent('notification.<evento>')` por cada uno de los 8 eventos. Cada listener recibe
el payload tipado y llama a `dispatch()` con el título, cuerpo, nivel y recurso correspondientes.

| Evento | Título ejemplo | Nivel |
|--------|---------------|-------|
| `nuevo_pedido` | "Nuevo pedido #1042" | INFO |
| `pedido_cancelado` | "Pedido #1042 cancelado" | WARNING |
| `stock_critico` | "Stock crítico: Remera XL" | DANGER |
| `devolucion` | "Nueva devolución — Pedido #1042" | WARNING |
| `pago_confirmado` | "Pago confirmado — Pedido #1042" | INFO |
| `cliente_nuevo` | "Nuevo cliente: Juan Pérez" | INFO |
| `resumen_diario` | "Resumen del día — 14/08/2026" | INFO |
| `reporte_semanal` | "Reporte semanal — Semana 33" | INFO |

### 2.4 Crons

```typescript
@Cron('0 22 * * *')   // Todos los días a las 22:00 (hora server)
async resumenDiario()

@Cron('0 9 * * 1')    // Lunes a las 9:00
async reporteSemanal()
```

Ambos iteran los negocios activos que tengan el evento habilitado y agregan:

**Resumen diario:**
- Ventas totales del día
- Cantidad de pedidos nuevos
- Clientes nuevos
- Productos con stock crítico
- Top 5 productos vendidos
- Comparación con el día anterior (% de cambio)

**Reporte semanal:**
- Mismos KPIs pero de la semana (lunes a domingo)
- Comparación con la semana anterior
- Tendencia (sube/baja/estable)

El contenido se envía como email vía `sendCustomEmail()` y se persiste como notificación
en la campana (título + cuerpo resumido).

### 2.5 Endpoints (controller)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET /notifications` | member | Listar paginado (`page`, `limit`, `unreadOnly`) — `createdAt DESC` |
| `GET /notifications/unread-count` | member | `{ count: number }` — lo que pollea la campana |
| `PATCH /notifications/:id/read` | member | Marcar una como leída |
| `PATCH /notifications/read-all` | member | Marcar todas las del negocio como leídas |

---

## 3. Puntos de emisión (hooks en servicios existentes)

Cada servicio agrega `EventEmitter2` al constructor y emite un evento con una línea, después
de que la operación principal haya completado exitosamente. Es la **única** modificación a los
servicios existentes.

| Evento | Servicio | Método | Línea aprox. |
|--------|----------|--------|--------------|
| `nuevo_pedido` | `OrdersService` | `create()` | ~L581 (post-transacción) |
| `pedido_cancelado` | `OrdersService` | `updateStatus()` | ~L726 (si nuevo === CANCELLED) |
| `pedido_cancelado` | `OrdersService` | `cancelByCustomer()` | ~L323 (post-transacción) |
| `stock_critico` | `InventoryService` | `applyMovement()` | ~L168 (post-movimiento, si qty <= stockMin) |
| `stock_critico` | `OrdersService` | `updateStatus()` | ~L698 (post-decremento en CONFIRMED) |
| `devolucion` | `ReturnsService` | `create()` | ~L225 (post-transacción) |
| `pago_confirmado` | `MercadopagoService` | `handlePaymentWebhook()` | ~L487 (dentro de `if aprobado`) |
| `cliente_nuevo` | `CustomersService` | `create()` | ~L197 (solo branch de prisma.create, no upsert) |

**Forma del emit:**

```typescript
this.eventEmitter.emit('notification.nuevo_pedido', {
  businessId,
  order: { id, orderNumber, customerName, total },
});
```

**Detección de stock crítico:** después de `applyMovement()` o del decremento de stock en
`updateStatus()`, se compara `resultingQuantity <= variant.stockMin`. Si cruza el umbral,
se emite `notification.stock_critico` con `productName`, `variantLabel` y `currentStock`.

---

## 4. Frontend

### 4.1 Nuevos endpoints en `api.ts`

```typescript
export type ApiNotification = {
  id: string; event: string; title: string; body: string;
  level: 'INFO' | 'WARNING' | 'DANGER';
  isRead: boolean; resourceType?: string; resourceId?: string;
  createdAt: string;
}

panelGetNotifications(params?)        → GET /notifications
panelGetUnreadNotificationsCount()    → GET /notifications/unread-count
panelMarkNotificationRead(id)         → PATCH /notifications/:id/read
panelMarkAllNotificationsRead()       → PATCH /notifications/read-all
```

### 4.2 Cambios en `Header.tsx`

- Reemplazar `NOTIFS: Notif[] = []` (constante vacía) por polling real cada 15s
  de `panelGetUnreadNotificationsCount()` — mismo patrón que `Sidebar.tsx` usa para mensajes
- Al abrir la campana: cargar `panelGetNotifications({ limit: 20 })` las más recientes
- "Limpiar todas" → `panelMarkAllNotificationsRead()` + refrescar
- Click en notificación → `panelMarkNotificationRead(id)` + navegar al recurso
- Badge muestra `count` real del endpoint
- Mapeo de level a iconos existentes: DANGER → `AlertCircle` rojo, WARNING → `AlertTriangle`
  ámbar, INFO → icono neutro azul

### 4.3 Cambios en `Sidebar.tsx`

- Agregar badge numérico en el módulo correspondiente usando el mismo `count` de notificaciones
  (reusar el dato del polling del Header, no duplicar requests — state compartido o context)

### 4.4 Lo que NO cambia

- `Notificaciones.tsx` (config de preferencias) — ya funciona al 100%
- No se crea página nueva "todas las notificaciones" — la campana muestra las 20 más recientes
- El diseño visual del popover de la campana se mantiene (markup existente)

---

## 5. Módulos que se tocan

| Módulo | Tipo de cambio |
|--------|----------------|
| `notifications/` | **NUEVO** — service, controller, dto, module |
| `prisma/schema.prisma` | Agregar modelo `Notification` + enum + relación en `Business` |
| `prisma/migrations/` | Migración aditiva (nueva tabla, no toca existentes) |
| `orders/orders.service.ts` | +1 inyección EventEmitter2, +2 emit (create, updateStatus) |
| `orders/orders.module.ts` | +1 import EventEmitterModule |
| `inventory/inventory.service.ts` | +1 inyección, +1 emit post-movimiento |
| `inventory/inventory.module.ts` | +1 import EventEmitterModule |
| `returns/returns.service.ts` | +1 inyección, +1 emit |
| `returns/returns.module.ts` | +1 import EventEmitterModule |
| `mercadopago/mercadopago.service.ts` | +1 inyección, +1 emit |
| `mercadopago/mercadopago.module.ts` | +1 import EventEmitterModule |
| `customers/customers.service.ts` | +1 inyección, +1 emit |
| `customers/customers.module.ts` | +1 import EventEmitterModule |
| `app.module.ts` | +1 import EventEmitterModule.forRoot(), +1 import NotificationsModule |
| `apps/web/src/lib/api.ts` | +4 funciones nuevas |
| `apps/web/.../Header.tsx` | Conectar campana con polling real |
| `apps/web/.../Sidebar.tsx` | Badge de notificaciones |

---

## 6. Testing

- **E2E:** `test/notifications.e2e-spec.ts` — CRUD de notificaciones + dispatch real
  (crear pedido → verificar que se creó notificación en DB)
- **Crons:** test manual o unitario que llama al método directamente (los crons son difíciles
  de testear en e2e sin control del reloj)
- **Frontend:** verificación visual en el browser — polling, badge, popover, mark as read

---

## 7. Fuera de alcance (explícito)

- Canal WhatsApp real (requiere proveedor externo)
- Preferencias de notificación por miembro individual (hoy es por negocio)
- Página dedicada "Ver todas las notificaciones" (la campana muestra las 20 más recientes)
- Push notifications (browser/mobile)
- Migración a Bull/Redis (el código queda preparado, pero no se implementa)
