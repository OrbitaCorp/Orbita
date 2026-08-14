# Motor de Notificaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el motor que genera, persiste y despacha las notificaciones del panel de Órbita (RBT-645) — campana del panel (polling), email (`sendCustomEmail`), WhatsApp (stub).

**Architecture:** `@nestjs/event-emitter` como bus interno. Los servicios de dominio (orders, inventory, returns, mercadopago, customers) emiten eventos tipados; `NotificationsService` los escucha, consulta `NotificationConfig.matrix`, y despacha por los canales habilitados. `dispatch()` es el único entry point — preparado para migrar a una cola externa sin tocar los emisores. Resumen diario/reporte semanal via `@Cron`.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL (Supabase), `@nestjs/event-emitter`, `@nestjs/schedule` (ya instalado), Next.js/React (frontend).

**Spec:** [docs/superpowers/specs/2026-08-14-motor-notificaciones-design.md](../specs/2026-08-14-motor-notificaciones-design.md)

## Global Constraints

- Notificaciones son **por negocio**, no por miembro individual.
- Canal WhatsApp es **stub** (solo `logger.log`, sin envío real).
- Email reutiliza `MailService.sendCustomEmail(to, subject, htmlBody, meta?)` — sin plantillas `.hbs` nuevas.
- Entrega en panel es **polling 15s** (mismo patrón que `getUnreadConversationsCount()`), no WebSockets.
- `dispatch()` en `NotificationsService` es el único punto de entrada para despachar — no llamar a Prisma/Mail directamente desde los listeners.
- Todas las rutas de `/notifications` requieren auth de `member` (usar `assertMemberContext`, patrón de `ConversationsController`).
- Migraciones de Prisma son aditivas — nunca tocar tablas existentes.
- Todo texto de usuario (títulos, cuerpos de notificación) en español, mismo tono que el resto del panel.

---

### Task 1: Modelo de datos — tabla `notifications`

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (agregar modelo `Notification`, enum `NotificationLevel`, relación inversa en `Business`)
- Create: migración vía `prisma migrate dev`

**Interfaces:**
- Produces: modelo Prisma `Notification` con campos `id, businessId, event, title, body, level, isRead, resourceType, resourceId, createdAt` — usado por todas las tareas siguientes.

- [ ] **Step 1: Agregar el modelo al schema**

En `apps/api/prisma/schema.prisma`, después del modelo `NotificationConfig` (línea ~206), agregar:

```prisma
model Notification {
  id           String            @id @default(uuid())
  businessId   String            @map("business_id")
  event        String
  title        String
  body         String
  level        NotificationLevel @default(INFO)
  isRead       Boolean           @default(false) @map("is_read")
  resourceType String?           @map("resource_type")
  resourceId   String?           @map("resource_id")
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

- [ ] **Step 2: Agregar la relación inversa en `Business`**

En el modelo `Business` (línea ~15-39 de `schema.prisma`), en el bloque de relaciones inversas (junto a `notificationConfig NotificationConfig?`), agregar:

```prisma
  notifications      Notification[]
```

- [ ] **Step 3: Validar el schema**

Run: `cd apps/api && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Generar la migración**

Run: `cd apps/api && npx prisma migrate dev --name add_notifications`
Expected: migración creada en `prisma/migrations/<timestamp>_add_notifications/migration.sql`, aplicada sin error, cliente Prisma regenerado.

- [ ] **Step 5: Verificar que el cliente generado tiene el tipo nuevo**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores de tipos relacionados a `Notification`/`NotificationLevel` (pueden existir errores preexistentes no relacionados — confirmar que no aumentan).

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): agrega modelo Notification para el motor de notificaciones (RBT-645)"
```

---

### Task 2: Instalar y registrar EventEmitter2

**Files:**
- Modify: `apps/api/package.json` (dependencia nueva)
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `EventEmitterModule` disponible globalmente — cualquier servicio puede inyectar `EventEmitter2` de `@nestjs/event-emitter` sin importar el módulo localmente (con `isGlobal: true`).

- [ ] **Step 1: Instalar el paquete**

Run: `cd apps/api && pnpm add @nestjs/event-emitter`
Expected: se agrega a `dependencies` en `package.json`, instala sin error de peer deps (compatible con NestJS 11).

- [ ] **Step 2: Registrar el módulo globalmente en `AppModule`**

En `apps/api/src/app.module.ts`, agregar el import junto a `ScheduleModule`:

```typescript
import { EventEmitterModule } from '@nestjs/event-emitter';
```

Y en el array `imports`, justo después de `ScheduleModule.forRoot(),`:

```typescript
    EventEmitterModule.forRoot(),
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificar que el server levanta**

Run: `cd apps/api && npx nest build`
Expected: build exitoso, sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/app.module.ts
git commit -m "feat(api): registra EventEmitterModule global para el motor de notificaciones"
```

---

### Task 3: `NotificationsModule` — servicio central (`dispatch`) + endpoints CRUD

**Files:**
- Create: `apps/api/src/notifications/notifications.module.ts`
- Create: `apps/api/src/notifications/notifications.service.ts`
- Create: `apps/api/src/notifications/notifications.controller.ts`
- Create: `apps/api/src/notifications/dto/list-notifications-query.dto.ts`
- Modify: `apps/api/src/app.module.ts` (registrar `NotificationsModule`)
- Test: `apps/api/test/notifications.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (de `../prisma/prisma.service`), `MailService.sendCustomEmail(to, subject, htmlBody, meta?)` (de `../mail/mail.service`), modelo `Notification`/`NotificationLevel` (Task 1).
- Produces:
  - `NotificationsService.dispatch(event: string, businessId: string, payload: { title: string; body: string; level?: 'INFO'|'WARNING'|'DANGER'; resourceType?: string; resourceId?: string; emailSubject?: string; emailBody?: string }): Promise<void>` — único entry point de despacho, usado por Task 4 y Task 5.
  - `NotificationsService.findAll(businessId, query)`, `.unreadCount(businessId)`, `.markRead(businessId, id)`, `.markAllRead(businessId)` — usados por el controller.
  - Endpoints: `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`.

- [ ] **Step 1: Crear el DTO de filtros de listado**

Create `apps/api/src/notifications/dto/list-notifications-query.dto.ts`:

```typescript
import { IsOptional, IsInt, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListNotificationsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsIn(['true', 'false']) unreadOnly?: string;
}
```

- [ ] **Step 2: Crear `NotificationsService` con `dispatch()` y el CRUD de lectura**

Create `apps/api/src/notifications/notifications.service.ts`:

```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

export type NotificationChannels = { panel: boolean; email: boolean; whatsapp: boolean };

export type DispatchPayload = {
  title: string;
  body: string;
  level?: NotificationLevel;
  resourceType?: string;
  resourceId?: string;
  // Si el canal email está habilitado y no se pasa emailSubject/emailBody,
  // se reusa title/body como asunto y cuerpo del mail.
  emailSubject?: string;
  emailBody?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ── Motor de despacho — único punto de entrada ────────────────────────────
  // Lee las preferencias del negocio para este evento y despacha por cada
  // canal habilitado. Si el negocio no tiene el evento configurado, no hace
  // nada (ni panel ni email) — evento desconocido/deshabilitado = silencio.
  async dispatch(event: string, businessId: string, payload: DispatchPayload): Promise<void> {
    const config = await this.prisma.notificationConfig.findUnique({ where: { businessId } });
    const matrix = (config?.matrix ?? {}) as Record<string, NotificationChannels>;
    const prefs = matrix[event];
    if (!prefs) return;

    const level = payload.level ?? NotificationLevel.INFO;

    if (prefs.panel) {
      await this.prisma.notification.create({
        data: {
          businessId,
          event,
          title: payload.title,
          body: payload.body,
          level,
          resourceType: payload.resourceType ?? null,
          resourceId: payload.resourceId ?? null,
        },
      });
    }

    if (prefs.email) {
      await this.sendEmailToMembers(businessId, payload.emailSubject ?? payload.title, payload.emailBody ?? payload.body);
    }

    if (prefs.whatsapp) {
      this.logger.log(`[WhatsApp stub] evento="${event}" negocio=${businessId}: ${payload.title}`);
    }
  }

  // El email de notificación va a todos los members activos del negocio —
  // no hay preferencia por miembro individual en esta fase (ver spec, §2.2).
  private async sendEmailToMembers(businessId: string, subject: string, htmlBody: string): Promise<void> {
    const members = await this.prisma.member.findMany({
      where: { businessId, status: 'ACTIVE' },
      select: { email: true },
    });
    for (const m of members) {
      try {
        await this.mail.sendCustomEmail(m.email, subject, `<p>${htmlBody}</p>`, { businessId });
      } catch (e) {
        // Un email caído no puede voltear el despacho — mismo criterio que
        // el resto de MailService (best-effort, nunca rompe el flujo llamador).
        this.logger.warn(`No se pudo mandar la notificación por email a ${m.email}: ${e}`);
      }
    }
  }

  // ── Lectura (campana del panel) ───────────────────────────────────────────

  async findAll(businessId: string, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { businessId, ...(query.unreadOnly === 'true' ? { isRead: false } : {}) };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async unreadCount(businessId: string) {
    const count = await this.prisma.notification.count({ where: { businessId, isRead: false } });
    return { count };
  }

  async markRead(businessId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, businessId } });
    if (!n) throw new NotFoundException('Notificación no encontrada');
    await this.prisma.notification.update({ where: { id }, data: { isRead: true } });
    return { ok: true };
  }

  async markAllRead(businessId: string) {
    await this.prisma.notification.updateMany({ where: { businessId, isRead: false }, data: { isRead: true } });
    return { ok: true };
  }
}
```

- [ ] **Step 3: Crear el controller**

Create `apps/api/src/notifications/notifications.controller.ts`:

```typescript
import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

// Campana del panel — cualquier miembro del negocio ve las mismas
// notificaciones (no hay preferencia por miembro individual, ver spec).
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: ListNotificationsQueryDto) {
    const member = assertMemberContext(ctx);
    return this.notificationsService.findAll(member.businessId, query);
  }

  // Contador liviano para el polling de la campana (cada 15s) — separado de
  // findAll() a propósito, mismo criterio que unread-count de conversations.
  @Get('unread-count')
  unreadCount(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.notificationsService.unreadCount(member.businessId);
  }

  @Patch(':id/read')
  markRead(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.notificationsService.markRead(member.businessId, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.notificationsService.markAllRead(member.businessId);
  }
}
```

- [ ] **Step 4: Crear el módulo**

Create `apps/api/src/notifications/notifications.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // lo usan orders/inventory/returns/mercadopago/customers (Task 4)
})
export class NotificationsModule {}
```

- [ ] **Step 5: Registrar el módulo en `AppModule`**

En `apps/api/src/app.module.ts`, agregar el import:

```typescript
import { NotificationsModule } from './notifications/notifications.module';
```

Y en `imports`, después de `MessageTemplatesModule,`:

```typescript
    NotificationsModule,
```

- [ ] **Step 6: Verificar que compila**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 7: Escribir el test e2e — endpoints de lectura**

Create `apps/api/test/notifications.e2e-spec.ts`:

```typescript
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;
    businessId = ownerRes.body.business.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { businessId, title: { startsWith: '[e2e-notif]' } } });
    await closeTestApp();
  });

  describe('GET /api/v1/notifications', () => {
    it('sin token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });

    it('con token → 200, lista paginada', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/notifications').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toMatchObject({ page: 1, limit: 20 });
    });
  });

  describe('GET /api/v1/notifications/unread-count', () => {
    it('devuelve un contador numérico', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/notifications/unread-count').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(typeof res.body.count).toBe('number');
    });
  });

  describe('PATCH /api/v1/notifications/:id/read y /read-all', () => {
    it('marca una notificación como leída', async () => {
      const n = await prisma.notification.create({
        data: { businessId, event: 'nuevo_pedido', title: '[e2e-notif] test', body: 'body', isRead: false },
      });
      const res = await request(app.getHttpServer()).patch(`/api/v1/notifications/${n.id}/read`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const updated = await prisma.notification.findUnique({ where: { id: n.id } });
      expect(updated?.isRead).toBe(true);
    });

    it('notificación de otro negocio → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/notifications/00000000-0000-0000-0000-000000000000/read')
        .set(auth(ownerToken));
      expect(res.status).toBe(404);
    });

    it('marca todas como leídas', async () => {
      await prisma.notification.create({
        data: { businessId, event: 'nuevo_pedido', title: '[e2e-notif] test2', body: 'body', isRead: false },
      });
      const res = await request(app.getHttpServer()).patch('/api/v1/notifications/read-all').set(auth(ownerToken));
      expect(res.status).toBe(200);
      const count = await prisma.notification.count({ where: { businessId, isRead: false, title: { startsWith: '[e2e-notif]' } } });
      expect(count).toBe(0);
    });
  });
});
```

- [ ] **Step 8: Correr el test y verificar que pasa**

Run: `cd apps/api && npx jest --config test/jest-e2e.json notifications.e2e-spec.ts`
Expected: todos los tests en verde (5 tests).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/notifications apps/api/src/app.module.ts apps/api/test/notifications.e2e-spec.ts
git commit -m "feat(api): motor de notificaciones — dispatch() central + endpoints de la campana (RBT-645)"
```

---

### Task 4: Event listeners — los 8 eventos + crons de resumen/reporte

**Files:**
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Modify: `apps/api/src/notifications/notifications.module.ts` (importar `PrismaModule` si hace falta agregaciones fuera de lo ya disponible; ya tiene acceso vía `PrismaService`)

**Interfaces:**
- Consumes: `dispatch()` (Task 3).
- Produces: listeners `@OnEvent('notification.<evento>')` para los 8 eventos — Task 5 emite hacia estos nombres exactos.

- [ ] **Step 1: Agregar los listeners de eventos de negocio a `NotificationsService`**

En `apps/api/src/notifications/notifications.service.ts`, agregar el import y los métodos:

```typescript
import { OnEvent } from '@nestjs/event-emitter';
```

Agregar estos métodos a la clase `NotificationsService` (después de `dispatch()`):

```typescript
  // ── Listeners de eventos de negocio ───────────────────────────────────────

  @OnEvent('notification.nuevo_pedido')
  async onNuevoPedido(p: { businessId: string; orderNumber: number; customerName: string; total: number; orderId: string }) {
    await this.dispatch('nuevo_pedido', p.businessId, {
      title: `Nuevo pedido #${p.orderNumber}`,
      body: `${p.customerName} — $${p.total.toFixed(2)}`,
      resourceType: 'order',
      resourceId: p.orderId,
    });
  }

  @OnEvent('notification.pedido_cancelado')
  async onPedidoCancelado(p: { businessId: string; orderNumber: number; orderId: string }) {
    await this.dispatch('pedido_cancelado', p.businessId, {
      title: `Pedido #${p.orderNumber} cancelado`,
      body: `El pedido #${p.orderNumber} fue cancelado.`,
      level: 'WARNING',
      resourceType: 'order',
      resourceId: p.orderId,
    });
  }

  @OnEvent('notification.stock_critico')
  async onStockCritico(p: { businessId: string; productName: string; variantLabel: string | null; currentStock: number; variantId: string }) {
    const nombre = p.variantLabel ? `${p.productName} · ${p.variantLabel}` : p.productName;
    await this.dispatch('stock_critico', p.businessId, {
      title: `Stock crítico: ${nombre}`,
      body: `Quedan ${p.currentStock} unidades.`,
      level: 'DANGER',
      resourceType: 'variant',
      resourceId: p.variantId,
    });
  }

  @OnEvent('notification.devolucion')
  async onDevolucion(p: { businessId: string; orderNumber: number; returnId: string }) {
    await this.dispatch('devolucion', p.businessId, {
      title: `Nueva devolución — Pedido #${p.orderNumber}`,
      body: `Se inició una devolución sobre el pedido #${p.orderNumber}.`,
      level: 'WARNING',
      resourceType: 'return',
      resourceId: p.returnId,
    });
  }

  @OnEvent('notification.pago_confirmado')
  async onPagoConfirmado(p: { businessId: string; orderNumber: number; orderId: string; total: number }) {
    await this.dispatch('pago_confirmado', p.businessId, {
      title: `Pago confirmado — Pedido #${p.orderNumber}`,
      body: `Se acreditó el pago de $${p.total.toFixed(2)}.`,
      resourceType: 'order',
      resourceId: p.orderId,
    });
  }

  @OnEvent('notification.cliente_nuevo')
  async onClienteNuevo(p: { businessId: string; customerName: string; customerId: string }) {
    await this.dispatch('cliente_nuevo', p.businessId, {
      title: `Nuevo cliente: ${p.customerName}`,
      body: `${p.customerName} se registró en tu negocio.`,
      resourceType: 'customer',
      resourceId: p.customerId,
    });
  }
```

- [ ] **Step 2: Agregar los crons de resumen diario y reporte semanal**

Agregar el import de `@nestjs/schedule` y los métodos con cron:

```typescript
import { Cron } from '@nestjs/schedule';
```

Agregar estos métodos a la clase (usan agregaciones directas de Prisma, sin depender de `ReportsService` para no crear una dependencia circular):

```typescript
  // ── Resumen diario / reporte semanal ──────────────────────────────────────
  // Itera los negocios activos que tengan el evento habilitado en al menos un
  // canal y les despacha un resumen agregado. No depende de ReportsModule
  // (evita import circular) — agrega directo sobre Prisma.

  @Cron('0 22 * * *')
  async resumenDiario() {
    const negocios = await this.negociosConEventoHabilitado('resumen_diario');
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const ayer = new Date(desde);
    ayer.setDate(ayer.getDate() - 1);

    for (const businessId of negocios) {
      const [hoy, ayerAgg, clientesNuevos, stockCriticoCount] = await Promise.all([
        this.agregarVentas(businessId, desde, new Date()),
        this.agregarVentas(businessId, ayer, desde),
        this.prisma.customer.count({ where: { businessId, createdAt: { gte: desde }, deletedAt: null } }),
        this.contarStockCritico(businessId),
      ]);
      const cambio = ayerAgg.total > 0 ? Math.round(((hoy.total - ayerAgg.total) / ayerAgg.total) * 100) : null;
      const cambioTexto = cambio === null ? '' : ` (${cambio >= 0 ? '+' : ''}${cambio}% vs. ayer)`;

      await this.dispatch('resumen_diario', businessId, {
        title: `Resumen del día — ${desde.toLocaleDateString('es-AR')}`,
        body: `Ventas: $${hoy.total.toFixed(2)}${cambioTexto}. Pedidos: ${hoy.pedidos}. Clientes nuevos: ${clientesNuevos}. Stock crítico: ${stockCriticoCount} producto(s).`,
      });
    }
  }

  @Cron('0 9 * * 1')
  async reporteSemanal() {
    const negocios = await this.negociosConEventoHabilitado('reporte_semanal');
    const hoy = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - 7);
    const inicioSemanaAnterior = new Date(inicioSemana);
    inicioSemanaAnterior.setDate(inicioSemana.getDate() - 7);

    for (const businessId of negocios) {
      const [semana, semanaAnterior] = await Promise.all([
        this.agregarVentas(businessId, inicioSemana, hoy),
        this.agregarVentas(businessId, inicioSemanaAnterior, inicioSemana),
      ]);
      const cambio = semanaAnterior.total > 0
        ? Math.round(((semana.total - semanaAnterior.total) / semanaAnterior.total) * 100)
        : null;
      const cambioTexto = cambio === null ? '' : ` (${cambio >= 0 ? '+' : ''}${cambio}% vs. semana anterior)`;

      await this.dispatch('reporte_semanal', businessId, {
        title: `Reporte semanal`,
        body: `Ventas de la semana: $${semana.total.toFixed(2)}${cambioTexto}. Pedidos: ${semana.pedidos}.`,
      });
    }
  }

  private async negociosConEventoHabilitado(event: string): Promise<string[]> {
    const configs = await this.prisma.notificationConfig.findMany({
      where: { business: { isActive: true } },
      select: { businessId: true, matrix: true },
    });
    return configs
      .filter((c) => {
        const prefs = (c.matrix as Record<string, NotificationChannels>)[event];
        return prefs && (prefs.panel || prefs.email || prefs.whatsapp);
      })
      .map((c) => c.businessId);
  }

  private async agregarVentas(businessId: string, desde: Date, hasta: Date) {
    const agg = await this.prisma.order.aggregate({
      where: { businessId, createdAt: { gte: desde, lt: hasta }, deletedAt: null, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: true,
    });
    return { total: Number(agg._sum.total ?? 0), pedidos: agg._count };
  }

  private async contarStockCritico(businessId: string): Promise<number> {
    const rows = await this.prisma.variantStock.findMany({
      where: { variant: { product: { businessId, deletedAt: null } } },
      select: { quantity: true, stockMin: true },
    });
    return rows.filter((r) => r.quantity <= r.stockMin).length;
  }
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 4: Escribir un test unitario para `dispatch()` y los listeners**

Create `apps/api/src/notifications/notifications.service.unit-spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

describe('NotificationsService.dispatch', () => {
  let service: NotificationsService;
  let prisma: { notificationConfig: any; notification: any; member: any };
  let mail: { sendCustomEmail: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notificationConfig: { findUnique: jest.fn() },
      notification: { create: jest.fn() },
      member: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mail = { sendCustomEmail: jest.fn().mockResolvedValue(true) };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('evento sin configurar → no hace nada', async () => {
    prisma.notificationConfig.findUnique.mockResolvedValue({ matrix: {} });
    await service.dispatch('nuevo_pedido', 'biz-1', { title: 't', body: 'b' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });

  it('canal panel habilitado → persiste la notificación', async () => {
    prisma.notificationConfig.findUnique.mockResolvedValue({
      matrix: { nuevo_pedido: { panel: true, email: false, whatsapp: false } },
    });
    await service.dispatch('nuevo_pedido', 'biz-1', { title: 't', body: 'b' });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessId: 'biz-1', event: 'nuevo_pedido', title: 't' }) }),
    );
  });

  it('canal email habilitado → manda a los members activos', async () => {
    prisma.notificationConfig.findUnique.mockResolvedValue({
      matrix: { nuevo_pedido: { panel: false, email: true, whatsapp: false } },
    });
    prisma.member.findMany.mockResolvedValue([{ email: 'a@test.com' }, { email: 'b@test.com' }]);
    await service.dispatch('nuevo_pedido', 'biz-1', { title: 't', body: 'b' });
    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(2);
  });

  it('canal whatsapp habilitado → no llama a mail ni prisma.notification (stub)', async () => {
    prisma.notificationConfig.findUnique.mockResolvedValue({
      matrix: { nuevo_pedido: { panel: false, email: false, whatsapp: true } },
    });
    await service.dispatch('nuevo_pedido', 'biz-1', { title: 't', body: 'b' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Correr el test unitario**

Run: `cd apps/api && npx jest --config test/jest-unit.json notifications.service.unit-spec.ts`
Expected: 4 tests en verde.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/notifications
git commit -m "feat(api): listeners de los 8 eventos + crons de resumen diario/semanal (RBT-645)"
```

---

### Task 5: Hooks de emisión en los servicios de dominio

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts` (constructor + 3 emisiones: nuevo_pedido, pedido_cancelado ×2, stock_critico)
- Modify: `apps/api/src/orders/orders.module.ts`
- Modify: `apps/api/src/inventory/inventory.service.ts` (constructor + 1 emisión: stock_critico)
- Modify: `apps/api/src/inventory/inventory.module.ts`
- Modify: `apps/api/src/returns/returns.service.ts` (constructor + 1 emisión: devolucion)
- Modify: `apps/api/src/returns/returns.module.ts`
- Modify: `apps/api/src/mercadopago/mercadopago.service.ts` (constructor + 1 emisión: pago_confirmado)
- Modify: `apps/api/src/mercadopago/mercadopago.module.ts`
- Modify: `apps/api/src/customers/customers.service.ts` (constructor + 1 emisión: cliente_nuevo)
- Modify: `apps/api/src/customers/customers.module.ts`

**Interfaces:**
- Consumes: `EventEmitter2` de `@nestjs/event-emitter` (Task 2), nombres de evento definidos en Task 4 (`notification.nuevo_pedido`, `notification.pedido_cancelado`, `notification.stock_critico`, `notification.devolucion`, `notification.pago_confirmado`, `notification.cliente_nuevo`).
- Produces: nada nuevo — cierra el circuito evento → listener → dispatch.

- [ ] **Step 1: `OrdersService` — inyectar EventEmitter2**

En `apps/api/src/orders/orders.service.ts`, agregar el import:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
```

En el constructor de `OrdersService`, agregar el parámetro (ver el constructor actual para mantener el orden existente de otras dependencias):

```typescript
    private readonly eventEmitter: EventEmitter2,
```

- [ ] **Step 2: `OrdersService.create()` — emitir `nuevo_pedido`**

En `create()` (línea ~581), justo antes del `return this.findOne(businessId, creado.id);` dentro del bloque `try`, agregar:

```typescript
        this.eventEmitter.emit('notification.nuevo_pedido', {
          businessId,
          orderNumber: creado.orderNumber,
          customerName: buyerName,
          total,
          orderId: creado.id,
        });
        return this.findOne(businessId, creado.id);
```

- [ ] **Step 3: `OrdersService.updateStatus()` — emitir `pedido_cancelado` y `stock_critico`**

En `updateStatus()`, después de la transacción (línea ~726, antes del `if (nuevo === 'DELIVERED')`), agregar:

```typescript
    if (nuevo === 'CANCELLED') {
      this.eventEmitter.emit('notification.pedido_cancelado', {
        businessId,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }

    if (nuevo === 'CONFIRMED') {
      const stockRows = await this.prisma.variantStock.findMany({
        where: { variantId: { in: renglonesConStock.map((it) => it.variantId) }, branchId: order.branchId },
        include: { variant: { include: { product: { select: { name: true } }, optionValues: { include: { optionValue: true } } } } },
      });
      for (const row of stockRows) {
        if (row.quantity <= row.stockMin) {
          const variantLabel = row.variant.optionValues.length > 0
            ? row.variant.optionValues.map((ov) => ov.optionValue.value).join(' / ')
            : null;
          this.eventEmitter.emit('notification.stock_critico', {
            businessId,
            productName: row.variant.product.name,
            variantLabel,
            currentStock: row.quantity,
            variantId: row.variantId,
          });
        }
      }
    }
```

- [ ] **Step 4: `OrdersService.cancelByCustomer()` — emitir `pedido_cancelado`**

En `cancelByCustomer()`, después de `this.logger.log(...)` (línea ~323), antes del `return`, agregar:

```typescript
    this.eventEmitter.emit('notification.pedido_cancelado', { businessId, orderNumber: order.id, orderId: order.id });
```

Nota: `cancelByCustomer()` selecciona solo `{ id, status, notes }` de la orden — no tiene `orderNumber` cargado. Modificar el `select` en la query de esa función (línea ~291) para incluir `orderNumber: true`:

```typescript
      select: { id: true, status: true, notes: true, orderNumber: true },
```

Y usar `order.orderNumber` en vez de `order.id` en el emit de arriba:

```typescript
    this.eventEmitter.emit('notification.pedido_cancelado', { businessId, orderNumber: order.orderNumber, orderId: order.id });
```

- [ ] **Step 5: Registrar `EventEmitterModule` en `orders.module.ts`**

En `apps/api/src/orders/orders.module.ts`, agregar el import y registrarlo:

```typescript
import { EventEmitterModule } from '@nestjs/event-emitter';
```

En `imports`, agregar `EventEmitterModule` junto a `DiscountsModule, ReturnsModule` (nota: como `EventEmitterModule.forRoot()` ya se registró globalmente en `AppModule` con `isGlobal` implícito de Nest — en realidad `@nestjs/event-emitter` inyecta `EventEmitter2` globalmente sin necesitar reimportar el módulo en cada feature module. **Confirmar en Step 6** si hace falta explícitamente o si la inyección funciona directo; si `tsc`/Nest se queja de provider no encontrado, agregar `EventEmitterModule` a los `imports` de cada módulo tocado).

- [ ] **Step 6: Verificar que compila y el server levanta**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json && npx nest build`
Expected: sin errores. Si aparece un error de "Nest can't resolve dependencies of OrdersService (... EventEmitter2 ...)", agregar `EventEmitterModule` al array `imports` de `orders.module.ts` (y de cada módulo de las tareas siguientes) — `@nestjs/event-emitter` requiere que `EventEmitterModule.forRoot()` corra una sola vez en el root, pero el token `EventEmitter2` se resuelve por DI estándar de Nest, así que puede necesitar el import local si el módulo no es global de forma transitiva. Confirmar empíricamente y ajustar.

- [ ] **Step 7: `InventoryService` — inyectar EventEmitter2 y emitir `stock_critico`**

En `apps/api/src/inventory/inventory.service.ts`, agregar el import y el parámetro al constructor:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
```

```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
```

En `applyMovement()` (línea ~128-169), después de calcular `stock` (dentro de la transacción, línea ~144), antes del `return`, agregar la emisión (fuera del `tx`, ya que el evento no debe emitirse si la transacción falla — mover el chequeo después del `$transaction(...)` completo). Modificar así:

```typescript
  private async applyMovement(
    businessId: string,
    memberId: string,
    input: {
      variantId: string;
      branchId: string;
      type: 'ENTRADA' | 'AJUSTE';
      quantity: number;
      reason: string;
      supplierId: string | null;
    },
  ) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.variantStock.findUnique({
        where: { variantId_branchId: { variantId: input.variantId, branchId: input.branchId } },
      });

      const newQuantity = (existing?.quantity ?? 0) + input.quantity;
      if (newQuantity < 0) {
        throw new UnprocessableEntityException(
          `El ajuste dejaría el stock en negativo (actual: ${existing?.quantity ?? 0}, movimiento: ${input.quantity})`,
        );
      }

      const stock = existing
        ? await tx.variantStock.update({ where: { id: existing.id }, data: { quantity: newQuantity } })
        : await tx.variantStock.create({
            data: { variantId: input.variantId, branchId: input.branchId, quantity: newQuantity, stockMin: 0 },
          });

      const movement = await tx.stockMovement.create({
        data: {
          businessId,
          branchId: input.branchId,
          variantId: input.variantId,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason,
          supplierId: input.supplierId,
          createdBy: memberId,
        },
      });

      const variant = await tx.productVariant.findUnique({
        where: { id: input.variantId },
        include: { product: { select: { name: true } }, optionValues: { include: { optionValue: true } } },
      });

      return {
        id: movement.id,
        variantId: movement.variantId,
        type: movement.type,
        quantity: movement.quantity,
        reason: movement.reason,
        supplierId: movement.supplierId,
        createdAt: movement.createdAt.toISOString(),
        newQuantity: stock.quantity,
        stockMin: stock.stockMin,
        productName: variant?.product.name ?? '',
        variantLabel: variant && variant.optionValues.length > 0
          ? variant.optionValues.map((ov) => ov.optionValue.value).join(' / ')
          : null,
      };
    });

    if (resultado.newQuantity <= resultado.stockMin) {
      this.eventEmitter.emit('notification.stock_critico', {
        businessId,
        productName: resultado.productName,
        variantLabel: resultado.variantLabel,
        currentStock: resultado.newQuantity,
        variantId: resultado.variantId,
      });
    }

    const { stockMin, productName, variantLabel, ...respuesta } = resultado;
    return respuesta;
  }
```

- [ ] **Step 8: Registrar `EventEmitterModule` en `inventory.module.ts` (si Step 6 lo requirió)**

En `apps/api/src/inventory/inventory.module.ts`, mismo patrón que Step 5 si hizo falta.

- [ ] **Step 9: Verificar que compila**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 10: `ReturnsService` — inyectar EventEmitter2 y emitir `devolucion`**

En `apps/api/src/returns/returns.service.ts`, agregar el import:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
```

Agregar al constructor:

```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
```

En `create()` (línea ~225), justo antes de `return this.aReturn(r);`, agregar:

```typescript
    this.eventEmitter.emit('notification.devolucion', {
      businessId,
      orderNumber: r.order.orderNumber,
      returnId: r.id,
    });
    return this.aReturn(r);
```

- [ ] **Step 11: Registrar `EventEmitterModule` en `returns.module.ts` (si hizo falta en Step 6)**

- [ ] **Step 12: `MercadopagoService` — inyectar EventEmitter2 y emitir `pago_confirmado`**

En `apps/api/src/mercadopago/mercadopago.service.ts`, agregar el import y el parámetro al constructor (revisar el constructor actual del archivo para mantener el orden de las dependencias existentes — agregar `EventEmitter2` al final).

En `handlePaymentWebhook()`, dentro del bloque `if (aprobado && order.status === 'PENDING')` (línea ~482-487), después de `await this.orders.updateStatus(...)`, agregar:

```typescript
      this.eventEmitter.emit('notification.pago_confirmado', {
        businessId: order.businessId,
        orderNumber: (await this.prisma.order.findUnique({ where: { id: order.id }, select: { orderNumber: true } }))?.orderNumber ?? 0,
        orderId: order.id,
        total: Number(order.total),
      });
```

Nota: si `order` (del `select` de línea ~437) ya no trae `orderNumber` en su selección original, agregarlo al `select` inicial de `handlePaymentWebhook()` (línea ~437) en vez de hacer una query extra:

```typescript
      select: { id: true, businessId: true, status: true, total: true, channel: true, orderNumber: true },
```

Y simplificar el emit:

```typescript
      this.eventEmitter.emit('notification.pago_confirmado', {
        businessId: order.businessId,
        orderNumber: order.orderNumber,
        orderId: order.id,
        total: Number(order.total),
      });
```

- [ ] **Step 13: Registrar `EventEmitterModule` en `mercadopago.module.ts` (si hizo falta en Step 6)**

- [ ] **Step 14: `CustomersService` — inyectar EventEmitter2 y emitir `cliente_nuevo`**

En `apps/api/src/customers/customers.service.ts`, agregar el import y el parámetro al constructor (mantener el orden existente, agregar al final).

En `create()`, en el branch del `try` que hace `await this.prisma.customer.create(...)` (línea ~197), envolver el resultado para emitir después de crear exitosamente:

```typescript
    try {
      const nuevo = await this.prisma.customer.create({
        data: {
          businessId,
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          dni: dto.dni ?? null,
        },
        select: CAMPOS_PUBLICOS,
      });
      this.eventEmitter.emit('notification.cliente_nuevo', {
        businessId,
        customerName: `${dto.firstName}${dto.lastName ? ' ' + dto.lastName : ''}`,
        customerId: nuevo.id,
      });
      return nuevo;
    } catch (e) {
```

Nota: confirmar que `CAMPOS_PUBLICOS` incluye `id` (necesario para `nuevo.id` arriba) — revisar la constante en el archivo antes de aplicar el cambio; si no lo incluye, usarlo en el `select` sin afectar la respuesta pública (Prisma permite seleccionar más campos de los que se exponen, ajustando el tipo de retorno).

- [ ] **Step 15: Registrar `EventEmitterModule` en `customers.module.ts` (si hizo falta en Step 6)**

- [ ] **Step 16: Verificar compilación completa**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json && npx nest build`
Expected: build exitoso, sin errores.

- [ ] **Step 17: Correr toda la suite e2e para descartar regresiones**

Run: `cd apps/api && npx jest --config test/jest-e2e.json --runInBand`
Expected: todos los tests en verde (o el mismo estado que antes de este plan — comparar contra el baseline si algo ya fallaba antes de empezar).

- [ ] **Step 18: Commit**

```bash
git add apps/api/src/orders apps/api/src/inventory apps/api/src/returns apps/api/src/mercadopago apps/api/src/customers
git commit -m "feat(api): conecta los servicios de dominio al motor de notificaciones (RBT-645)"
```

---

### Task 6: Frontend — conectar la campana del panel

**Files:**
- Modify: `apps/web/src/lib/api.ts` (agregar 4 funciones + tipo `ApiNotification`)
- Modify: `apps/web/src/layouts/components/Header.tsx` (reemplazar mock por polling real)

**Interfaces:**
- Consumes: `panelRequest<T>()` (helper existente en `api.ts`).
- Produces: `panelGetNotifications`, `panelGetUnreadNotificationsCount`, `panelMarkNotificationRead`, `panelMarkAllNotificationsRead`, tipo `ApiNotification` — consumidos por `Header.tsx`.

- [ ] **Step 1: Agregar los endpoints y el tipo a `api.ts`**

En `apps/web/src/lib/api.ts`, al final del archivo (después de las funciones de `message-templates`, línea ~1784), agregar:

```typescript
// ── Notificaciones (RBT-645 — motor de notificaciones) ──────────────────────

export type ApiNotification = {
  id: string
  event: string
  title: string
  body: string
  level: 'INFO' | 'WARNING' | 'DANGER'
  isRead: boolean
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}

export function panelGetNotifications(params?: { page?: number; limit?: number; unreadOnly?: boolean }) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.unreadOnly) qs.set('unreadOnly', 'true')
  const suffix = qs.toString() ? `?${qs}` : ''
  return panelRequest<{ data: ApiNotification[]; total: number; page: number; limit: number }>(`/notifications${suffix}`)
}

export function panelGetUnreadNotificationsCount() {
  return panelRequest<{ count: number }>('/notifications/unread-count')
}

export function panelMarkNotificationRead(id: string) {
  return panelRequest<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' })
}

export function panelMarkAllNotificationsRead() {
  return panelRequest<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' })
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Reemplazar el mock en `Header.tsx` por polling real**

En `apps/web/src/layouts/components/Header.tsx`:

Reemplazar el import (línea ~7) para incluir las funciones nuevas:

```typescript
import { ApiError, panelSearch, panelGetProfile, panelGetUnreadNotificationsCount, panelGetNotifications, panelMarkNotificationRead, panelMarkAllNotificationsRead, type ApiSearchResults, type ApiNotification } from '@/lib/api'
```

Reemplazar el bloque de tipo/constante mock (líneas 38-43):

```typescript
interface Notif { id: string; nivel: 'danger' | 'warning' | 'info'; titulo: string; desc: string; tiempo: string; leida: boolean }

const nivelDe = (level: ApiNotification['level']): Notif['nivel'] =>
    level === 'DANGER' ? 'danger' : level === 'WARNING' ? 'warning' : 'info'

const tiempoRelativo = (iso: string): string => {
    const diffMs = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diffMs / 60000)
    if (min < 1) return 'ahora'
    if (min < 60) return `hace ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `hace ${h} h`
    return `hace ${Math.floor(h / 24)} d`
}
```

Reemplazar `const [notifs, setNotifs] = useState<Notif[]>(NOTIFS)` (línea 100) por:

```typescript
    const [notifs,          setNotifs]           = useState<Notif[]>([])
    const [unreadCount,     setUnreadCount]       = useState(0)
```

Agregar el `useEffect` de polling (después del `useEffect` de tema, alrededor de la línea 75), condicionado a que el usuario sea `member` (mismo criterio que el resto del header):

```typescript
    useEffect(() => {
        if (user?.type !== 'member') return
        let cancelado = false
        const cargar = () => {
            panelGetUnreadNotificationsCount()
                .then(r => { if (!cancelado) setUnreadCount(r.count) })
                .catch(() => {})
        }
        cargar()
        const interval = setInterval(cargar, 15000)
        return () => { cancelado = true; clearInterval(interval) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.type])
```

Agregar la carga de la lista al abrir la campana — modificar el handler del botón de la campana. Buscar `onClick={() => setNotifOpen(o => !o)}` (línea ~266) y reemplazar por:

```typescript
                            onClick={() => {
                                setNotifOpen(o => {
                                    const next = !o
                                    if (next) {
                                        panelGetNotifications({ limit: 20 })
                                            .then(r => setNotifs(r.data.map(n => ({
                                                id: n.id, nivel: nivelDe(n.level), titulo: n.title, desc: n.body,
                                                tiempo: tiempoRelativo(n.createdAt), leida: n.isRead,
                                            }))))
                                            .catch(() => {})
                                    }
                                    return next
                                })
                            }}
```

Reemplazar el badge (línea ~276) para usar `unreadCount` en vez de `notifs.length`:

```typescript
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: -4, right: -4,
                                    minWidth: 17, height: 17, borderRadius: 9,
                                    background: 'var(--color-error)', color: '#fff',
                                    fontSize: 10, fontWeight: 700, fontFamily: '"Geist Mono", monospace',
                                    display: 'grid', placeItems: 'center', padding: '0 3px',
                                    border: '2px solid var(--color-bg)', lineHeight: 1,
                                }}>
                                    {unreadCount}
                                </span>
                            )}
```

Reemplazar el título del popover (línea ~301) para usar `unreadCount`:

```typescript
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                                            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Sin notificaciones'}
                                        </span>
```

Reemplazar el botón "Limpiar todas" (línea ~305) para llamar al backend:

```typescript
                                    {notifs.length > 0 && (
                                        <button onClick={() => {
                                            panelMarkAllNotificationsRead().then(() => {
                                                setNotifs(ns => ns.map(n => ({ ...n, leida: true })))
                                                setUnreadCount(0)
                                            }).catch(() => {})
                                        }} style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            Limpiar todas
                                        </button>
                                    )}
```

Reemplazar el ícono por nivel (línea ~314) para soportar `'info'`:

```typescript
                                        const Icon = n.nivel === 'danger' ? AlertCircle : n.nivel === 'warning' ? AlertTriangle : Bell
                                        const col  = n.nivel === 'danger' ? 'var(--color-error)' : n.nivel === 'warning' ? 'var(--color-warning)' : 'var(--color-primary)'
```

Reemplazar el botón de dismiss individual (línea ~327) para marcar como leída en el backend en vez de solo remover del state local:

```typescript
                                                <button onClick={() => {
                                                    panelMarkNotificationRead(n.id).then(() => {
                                                        setNotifs(ns => ns.filter(x => x.id !== n.id))
                                                        setUnreadCount(c => Math.max(0, c - (n.leida ? 0 : 1)))
                                                    }).catch(() => {})
                                                }} style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                                    <X size={11} strokeWidth={2} />
                                                </button>
```

- [ ] **Step 4: Verificar que compila**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Verificación visual en el browser**

Levantar el dev server del frontend (via `preview_start` con la config del proyecto, o `pnpm dev` en `apps/web` si no hay `.claude/launch.json` configurado) y en el panel:
1. Confirmar que la campana no rompe (sin notificaciones al inicio, badge ausente).
2. Generar un evento real (ej. crear un pedido de prueba desde el panel) y confirmar que, tras el próximo poll (máx 15s) o al reabrir la campana, aparece la notificación.
3. Click en "Limpiar todas" y confirmar que el badge desaparece.
Si el entorno de browser no permite completar login/flujo real (limitación ya documentada en `PENDIENTES.md` para rutas dinámicas de Next.js), documentar qué se pudo verificar y qué no, sin bloquear el resto del plan.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/layouts/components/Header.tsx
git commit -m "feat(web): conecta la campana del panel al motor de notificaciones (RBT-645)"
```

---

### Task 7: Verificación final y comentario en Jira

**Files:** ninguno nuevo — solo verificación.

- [ ] **Step 1: Correr la suite e2e completa del backend**

Run: `cd apps/api && npx jest --config test/jest-e2e.json --forceExit --detectOpenHandles --runInBand`
Expected: todos los tests en verde (o mismo baseline que antes de empezar el plan).

- [ ] **Step 2: Correr el build completo de ambas apps**

Run: `cd apps/api && npx nest build`
Run: `cd apps/web && npx tsc --noEmit`
Expected: ambos sin errores.

- [ ] **Step 3: Actualizar el grafo de graphify**

Run: `graphify update .` (desde la raíz del repo)
Expected: grafo actualizado con los archivos nuevos/modificados, sin costo de API.

- [ ] **Step 4: Comentar en el ticket RBT-645 de Jira**

Usar `addCommentToJiraIssue` sobre RBT-645 con un resumen de lo implementado (motor con EventEmitter2, endpoints de la campana, hooks en los 6 servicios, crons de resumen/reporte, WhatsApp como stub, frontend conectado con polling 15s) y cualquier decisión tomada sin especificación explícita durante la implementación (ej. si `EventEmitterModule` necesitó importarse localmente en cada módulo, o cualquier ajuste hecho sobre la marcha).

- [ ] **Step 5: Commit final (si quedó algo pendiente) y push**

```bash
git status
git add -A
git commit -m "chore: ajustes finales del motor de notificaciones (RBT-645)"  # solo si hay cambios pendientes
git push
```

Expected: `git push` exitoso contra `origin/main`.
