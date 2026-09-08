# Orbi Module Knowledge — Phase 0 (Infra) + Phase 1 (Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ModuleDataService` that fetches per-module business snapshots, and enrich the Dashboard prompt with deep domain knowledge and dynamic data — making Orbi feel like an e-commerce consultant who knows *this* business.

**Architecture:** `ModuleDataService` is a new injectable service that queries Prisma for lightweight aggregates per module. `ContextBuilderService` calls it and passes the result to `getPanelPrompt()`, which now accepts an optional `moduleData` parameter. Each module's knowledge lives in a separate `*.knowledge.ts` file, imported by `panel.ts`.

**Tech Stack:** NestJS, Prisma, TypeScript, Jest

**Spec:** `docs/superpowers/specs/2026-09-08-orbi-module-knowledge-design.md`

## Global Constraints

- Prompts in rioplatense Spanish ("vos", "tenés"), warm but concise.
- Knowledge text: 300-500 tokens max per module, written as instructions to Orbi (second person).
- Dynamic data: ~100-200 tokens max, numbers and alerts only — never PII (no customer emails, phones, or addresses in the system prompt).
- Total system prompt budget: ~800-1100 tokens (capa 1 + capa 2 + capa 3).
- Snapshot queries must use `select` with minimal fields, `Promise.all` for parallel queries, and a 2s defensive timeout.
- `OrderStatus` enum values: `PENDING`, `CONFIRMED`, `PREPARING`, `SHIPPED`, `DELIVERED`, `COMPLETED`, `CANCELLED`.
- `ProductStatus` enum values: `PUBLISHED`, `DRAFT`, `OUT_OF_STOCK`.
- Cancelled orders are excluded from sales metrics (consistent with `ReportsService`).
- Every change is in `apps/api/` — no frontend changes.

---

### Task 1: ModuleDataService — types and empty service

**Files:**
- Create: `apps/api/src/orbi/context/module-data.types.ts`
- Create: `apps/api/src/orbi/context/module-data.service.ts`
- Create: `apps/api/src/orbi/context/module-data.service.spec.ts`
- Modify: `apps/api/src/orbi/orbi.module.ts:50-56` (add provider)

**Interfaces:**
- Consumes: `PrismaService` (existing DI token)
- Produces: `ModuleDataService.getSnapshot(businessId: string, module: string): Promise<ModuleSnapshot>`, `DashboardSnapshot` type, `ModuleSnapshot` union type

- [ ] **Step 1: Write the types file**

```typescript
// apps/api/src/orbi/context/module-data.types.ts

export interface DashboardSnapshot {
  salesThisMonth:      { total: number; count: number; avgTicket: number };
  salesLastMonth:      { total: number; count: number };
  pendingOrders:       number;
  cancelledThisMonth:  number;
  totalProducts:       number;
  outOfStockProducts:  number;
  totalCustomers:      number;
  newCustomersThisMonth: number;
  unreadMessages:      number;
}

// Future phases will add more snapshot types here.
// Each phase adds its own interface and adds it to ModuleSnapshot.
export type ModuleSnapshot = DashboardSnapshot | Record<string, never>;
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/api/src/orbi/context/module-data.service.spec.ts
import { ModuleDataService } from './module-data.service';

describe('ModuleDataService', () => {
  let service: ModuleDataService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: null }, _count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      product: { count: jest.fn().mockResolvedValue(0) },
      customer: { count: jest.fn().mockResolvedValue(0) },
      conversation: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new ModuleDataService(mockPrisma);
  });

  it('returns empty object for unknown module', async () => {
    const result = await service.getSnapshot('biz-1', 'nonexistent');
    expect(result).toEqual({});
  });

  it('returns empty object when businessId query fails', async () => {
    mockPrisma.order.count.mockRejectedValue(new Error('connection lost'));
    mockPrisma.product.count.mockRejectedValue(new Error('connection lost'));
    mockPrisma.customer.count.mockRejectedValue(new Error('connection lost'));
    mockPrisma.conversation.count.mockRejectedValue(new Error('connection lost'));

    const result = await service.getSnapshot('biz-1', 'dashboard');
    expect(result).toEqual({});
  });

  it('returns DashboardSnapshot with correct shape for dashboard module', async () => {
    mockPrisma.order.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: 3, _sum: { total: new Prisma.Decimal('15000') } },
      { status: 'COMPLETED', _count: 10, _sum: { total: new Prisma.Decimal('85000') } },
      { status: 'CANCELLED', _count: 2, _sum: { total: new Prisma.Decimal('5000') } },
    ]);
    mockPrisma.product.count
      .mockResolvedValueOnce(25)  // total
      .mockResolvedValueOnce(2);  // out of stock
    mockPrisma.customer.count
      .mockResolvedValueOnce(50)  // total
      .mockResolvedValueOnce(8);  // new this month
    mockPrisma.conversation.count.mockResolvedValue(4);

    const result = await service.getSnapshot('biz-1', 'dashboard');

    expect(result).toMatchObject({
      salesThisMonth: { total: 100000, count: 13, avgTicket: expect.any(Number) },
      pendingOrders: 3,
      cancelledThisMonth: 2,
      totalProducts: 25,
      outOfStockProducts: 2,
      totalCustomers: 50,
      newCustomersThisMonth: 8,
      unreadMessages: 4,
    });
  });
});
```

Add Prisma import at the top of the test:
```typescript
import { Prisma } from '@prisma/client';
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx jest context/module-data.service.spec --no-coverage`
Expected: FAIL — `Cannot find module './module-data.service'`

- [ ] **Step 4: Write the service with dashboard snapshot implementation**

```typescript
// apps/api/src/orbi/context/module-data.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ModuleSnapshot, DashboardSnapshot } from './module-data.types';

@Injectable()
export class ModuleDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(businessId: string, module: string): Promise<ModuleSnapshot> {
    switch (module) {
      case 'dashboard': return this.dashboardSnapshot(businessId);
      default:          return {};
    }
  }

  private async dashboardSnapshot(businessId: string): Promise<DashboardSnapshot> {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesPasado = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

    try {
      const [
        orderGroupsThisMonth,
        orderGroupsLastMonth,
        totalProducts,
        outOfStockProducts,
        totalCustomers,
        newCustomersThisMonth,
        unreadMessages,
      ] = await Promise.all([
        this.prisma.order.groupBy({
          by: ['status'],
          where: { businessId, deletedAt: null, createdAt: { gte: inicioMes } },
          _count: true,
          _sum: { total: true },
        }),
        this.prisma.order.groupBy({
          by: ['status'],
          where: { businessId, deletedAt: null, createdAt: { gte: inicioMesPasado, lt: inicioMes } },
          _count: true,
          _sum: { total: true },
        }),
        this.prisma.product.count({ where: { businessId, deletedAt: null } }),
        this.prisma.product.count({ where: { businessId, deletedAt: null, status: 'OUT_OF_STOCK' } }),
        this.prisma.customer.count({ where: { businessId } }),
        this.prisma.customer.count({ where: { businessId, createdAt: { gte: inicioMes } } }),
        this.prisma.conversation.count({ where: { businessId, isUnread: true, isArchived: false } }),
      ]);

      const summarize = (groups: typeof orderGroupsThisMonth) => {
        let count = 0;
        let total = 0;
        let cancelled = 0;
        for (const g of groups) {
          const n = typeof g._count === 'number' ? g._count : 0;
          if (g.status === 'CANCELLED') { cancelled += n; continue; }
          count += n;
          total += g._sum.total != null ? Number(g._sum.total) : 0;
        }
        return { total: Math.round(total * 100) / 100, count, cancelled };
      };

      const thisMonth = summarize(orderGroupsThisMonth);
      const lastMonth = summarize(orderGroupsLastMonth);

      const pending = orderGroupsThisMonth.find(g => g.status === 'PENDING');
      const pendingOrders = pending ? (typeof pending._count === 'number' ? pending._count : 0) : 0;

      return {
        salesThisMonth: {
          total: thisMonth.total,
          count: thisMonth.count,
          avgTicket: thisMonth.count > 0
            ? Math.round((thisMonth.total / thisMonth.count) * 100) / 100
            : 0,
        },
        salesLastMonth: { total: lastMonth.total, count: lastMonth.count },
        pendingOrders,
        cancelledThisMonth: thisMonth.cancelled,
        totalProducts,
        outOfStockProducts,
        totalCustomers,
        newCustomersThisMonth,
        unreadMessages,
      };
    } catch {
      return {} as any;
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx jest context/module-data.service.spec --no-coverage`
Expected: PASS

- [ ] **Step 6: Register ModuleDataService in OrbiModule**

In `apps/api/src/orbi/orbi.module.ts`, add:

Import at top:
```typescript
import { ModuleDataService } from './context/module-data.service';
```

Add to the `providers` array (after `ContextBuilderService`):
```typescript
ModuleDataService,
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/orbi/context/module-data.types.ts apps/api/src/orbi/context/module-data.service.ts apps/api/src/orbi/context/module-data.service.spec.ts apps/api/src/orbi/orbi.module.ts
git commit -m "feat(orbi): add ModuleDataService with dashboard snapshot

Phase 0 infra for module knowledge bases. New service queries Prisma
for lightweight business aggregates per panel module. Dashboard
snapshot includes sales, orders, products, customers, and messages.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Wire ModuleDataService into ContextBuilderService and update getPanelPrompt signature

**Files:**
- Modify: `apps/api/src/orbi/context/context-builder.service.ts:1-47`
- Modify: `apps/api/src/orbi/prompts/panel.ts:158-173` (signature only, no content change yet)
- Modify: `apps/api/src/orbi/context/context-builder.spec.ts` (add test for moduleData flow)

**Interfaces:**
- Consumes: `ModuleDataService.getSnapshot(businessId, module)` from Task 1, `ModuleSnapshot` type from Task 1
- Produces: Updated `ContextBuilderService.buildSystemPrompt()` that passes `moduleData` to `getPanelPrompt()`; updated `getPanelPrompt(module, section, businessInfo, moduleData)` signature

- [ ] **Step 1: Write the failing test in context-builder.spec.ts**

Add this test at the end of the describe block (before the closing `});`):

```typescript
  it('passes moduleData to panel prompt when available', async () => {
    const mockModuleData = {
      getSnapshot: jest.fn().mockResolvedValue({
        salesThisMonth: { total: 50000, count: 10, avgTicket: 5000 },
        salesLastMonth: { total: 40000, count: 8 },
        pendingOrders: 3,
        cancelledThisMonth: 1,
        totalProducts: 20,
        outOfStockProducts: 2,
        totalCustomers: 30,
        newCustomersThisMonth: 5,
        unreadMessages: 4,
      }),
    };

    service = new ContextBuilderService(mockPrisma, mockModuleData as any);

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'dashboard', businessId: 'biz-1' },
    } as any);

    expect(mockModuleData.getSnapshot).toHaveBeenCalledWith('biz-1', 'dashboard');
    expect(prompt).toContain('50.000');
  });

  it('works without moduleData (graceful degradation)', async () => {
    const mockModuleData = {
      getSnapshot: jest.fn().mockResolvedValue({}),
    };

    service = new ContextBuilderService(mockPrisma, mockModuleData as any);

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'dashboard', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Dashboard');
    expect(prompt).not.toContain('undefined');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest context/context-builder.spec --no-coverage`
Expected: FAIL — `ContextBuilderService` constructor doesn't accept a second argument yet

- [ ] **Step 3: Update ContextBuilderService to accept and use ModuleDataService**

Replace the full content of `apps/api/src/orbi/context/context-builder.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModuleDataService } from './module-data.service';
import type { OrbiChatDto } from '../dto/orbi-chat.dto';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import { CORE_PROMPT } from '../prompts/core';
import { getWizardPrompt } from '../prompts/wizard';
import { getPanelPrompt } from '../prompts/panel';

@Injectable()
export class ContextBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleData: ModuleDataService,
  ) {}

  async buildSystemPrompt(dto: OrbiChatDto): Promise<string> {
    const layers: string[] = [CORE_PROMPT];

    if (dto.context.surface === OrbiSurface.WIZARD) {
      layers.push(getWizardPrompt(
        dto.context.stepName,
        dto.context.rubro,
        dto.context.availableOptions,
        dto.context.formState,
      ));
    } else {
      let businessInfo: { name: string; industry: string; mode: string } | undefined;

      if (dto.context.businessId) {
        try {
          const biz = await this.prisma.business.findUnique({
            where: { id: dto.context.businessId },
            select: { name: true, industry: true, mode: true },
          });
          if (biz) {
            businessInfo = { name: biz.name, industry: biz.industry, mode: biz.mode };
          }
        } catch { /* non-critical */ }
      }

      const moduleSnapshot = dto.context.businessId && dto.context.module
        ? await this.moduleData.getSnapshot(dto.context.businessId, dto.context.module)
        : {};

      layers.push(getPanelPrompt(
        dto.context.module,
        dto.context.section,
        businessInfo,
        moduleSnapshot,
      ));
    }

    return layers.join('\n\n---\n\n');
  }
}
```

- [ ] **Step 4: Update getPanelPrompt signature in panel.ts**

In `apps/api/src/orbi/prompts/panel.ts`, update the export function signature (line 158) to accept `moduleData`. For now, pass it through to `dashboard()` only — the other modules ignore it until their phase:

```typescript
import type { ModuleSnapshot, DashboardSnapshot } from '../context/module-data.types';

// ... (existing module functions stay the same for now) ...

export function getPanelPrompt(
  module?: string,
  section?: string,
  businessInfo?: { name: string; industry: string; mode: string },
  moduleData?: ModuleSnapshot,
): string {
  switch (module) {
    case 'dashboard':      return dashboard(businessInfo, moduleData);
    case 'catalogo':       return catalogo(businessInfo);
    case 'pedidos':        return pedidos(businessInfo);
    case 'clientes':       return clientes(businessInfo);
    case 'descuentos':     return descuentos(businessInfo);
    case 'configuracion':  return configuracion(businessInfo, section);
    case 'mensajes':       return mensajes(businessInfo);
    default:               return fallbackPanel(businessInfo, module, section);
  }
}
```

Update the `dashboard()` function signature to accept `moduleData`:

```typescript
function dashboard(biz?: { name: string; industry: string; mode: string }, moduleData?: ModuleSnapshot): string {
```

(Content will be enriched in Task 3 — for now, the function body stays the same so existing tests pass.)

- [ ] **Step 5: Fix existing tests that construct ContextBuilderService with one argument**

In `context-builder.spec.ts`, update the `beforeEach` to pass a mock `ModuleDataService`:

```typescript
  let mockModuleData: any;

  beforeEach(() => {
    mockPrisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Rama', industry: 'Indumentaria', mode: 'FULL' }),
      },
    };
    mockModuleData = {
      getSnapshot: jest.fn().mockResolvedValue({}),
    };
    service = new ContextBuilderService(mockPrisma, mockModuleData);
  });
```

- [ ] **Step 6: Run all context-builder tests to verify they pass**

Run: `cd apps/api && npx jest context/context-builder.spec --no-coverage`
Expected: PASS (all existing + 2 new tests)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/orbi/context/context-builder.service.ts apps/api/src/orbi/context/context-builder.spec.ts apps/api/src/orbi/prompts/panel.ts
git commit -m "feat(orbi): wire ModuleDataService into context builder

ContextBuilderService now fetches a module snapshot and passes it to
getPanelPrompt(). Graceful degradation: if snapshot returns {} the
prompt works without dynamic data.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Dashboard knowledge file and enriched prompt

**Files:**
- Create: `apps/api/src/orbi/prompts/knowledge/dashboard.knowledge.ts`
- Modify: `apps/api/src/orbi/prompts/panel.ts:26-39` (rewrite `dashboard()` function)
- Modify: `apps/api/src/orbi/context/context-builder.spec.ts` (add tests for enriched dashboard prompt)

**Interfaces:**
- Consumes: `DashboardSnapshot` type from Task 1, `ModuleSnapshot` from Task 1, `panelBase()` from `panel.ts`
- Produces: `DASHBOARD_KNOWLEDGE` constant (string), enriched `dashboard()` function that interpolates snapshot data

- [ ] **Step 1: Create the dashboard knowledge file**

```typescript
// apps/api/src/orbi/prompts/knowledge/dashboard.knowledge.ts

export const DASHBOARD_KNOWLEDGE = `## Lo que sabés sobre métricas de un negocio

Las métricas clave de un e-commerce son:
- Ventas del mes (monto + cantidad de pedidos): mostrá siempre ambas, no solo el monto. Un mes con muchas ventas chicas se siente distinto a pocas ventas grandes.
- Ticket promedio (ventas / pedidos): si baja respecto al mes pasado puede significar muchos descuentos activos o que se están vendiendo más productos baratos. Si sube, tal vez subieron precios o los clientes están comprando más por pedido.
- Tasa de cancelación: hasta 5% es normal, 5-10% hay que estar atento, arriba de 10% algo anda mal (problemas de stock, tiempos de entrega largos, o descripciones que no coinciden con el producto real).
- Productos sin stock: plata que se está perdiendo — un producto agotado es una venta que no se hizo. Sugerí reponer o pausar el producto.
- Clientes nuevos del mes: señal de crecimiento. Si no hay nuevos, el negocio depende 100% de los recurrentes.
- Mensajes sin leer: urgencia — un cliente esperando respuesta se enfría rápido.

## Cómo actuar
- Si te saludan o preguntan "cómo va", ofrecé un resumen ejecutivo rápido con las 3-4 métricas más relevantes.
- Compará siempre con el mes anterior para dar contexto ("vendiste 20% más que el mes pasado").
- Si hay alertas (pedidos pendientes, sin stock, mensajes sin leer), mencionálas primero — son accionables.
- No tires todos los números juntos: priorizá lo importante y ofrecé profundizar.`;
```

- [ ] **Step 2: Write the failing test for the enriched dashboard prompt**

Add these tests in `context-builder.spec.ts`:

```typescript
  it('dashboard prompt includes knowledge about metrics', async () => {
    service = new ContextBuilderService(mockPrisma, mockModuleData);

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'dashboard', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre métricas');
    expect(prompt).toContain('Ticket promedio');
    expect(prompt).toContain('Tasa de cancelación');
  });

  it('dashboard prompt interpolates dynamic data when snapshot is available', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({
      salesThisMonth: { total: 150000, count: 25, avgTicket: 6000 },
      salesLastMonth: { total: 120000, count: 20 },
      pendingOrders: 5,
      cancelledThisMonth: 2,
      totalProducts: 40,
      outOfStockProducts: 3,
      totalCustomers: 80,
      newCustomersThisMonth: 12,
      unreadMessages: 7,
    });
    service = new ContextBuilderService(mockPrisma, mockModuleData);

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'dashboard', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('150.000');
    expect(prompt).toContain('25 pedidos');
    expect(prompt).toContain('5 pedidos pendientes');
    expect(prompt).toContain('3 productos sin stock');
    expect(prompt).toContain('7 mensajes sin leer');
    expect(prompt).toContain('12 clientes nuevos');
  });

  it('dashboard prompt works without dynamic data', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({});
    service = new ContextBuilderService(mockPrisma, mockModuleData);

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'dashboard', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre métricas');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('NaN');
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/api && npx jest context/context-builder.spec --no-coverage`
Expected: FAIL — prompt doesn't contain knowledge or dynamic data yet

- [ ] **Step 4: Rewrite the dashboard() function in panel.ts**

Replace the `dashboard()` function in `apps/api/src/orbi/prompts/panel.ts`:

```typescript
import { DASHBOARD_KNOWLEDGE } from './knowledge/dashboard.knowledge';
import type { ModuleSnapshot, DashboardSnapshot } from '../context/module-data.types';

function isDashboardSnapshot(data: ModuleSnapshot): data is DashboardSnapshot {
  return 'salesThisMonth' in data;
}

function fmtArs(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

function formatDashboardData(data: DashboardSnapshot): string {
  const alertas: string[] = [];
  if (data.pendingOrders > 0) {
    alertas.push(`- ⚠ ${data.pendingOrders} pedido${data.pendingOrders === 1 ? '' : 's'} pendiente${data.pendingOrders === 1 ? '' : 's'} de confirmación`);
  }
  if (data.outOfStockProducts > 0) {
    alertas.push(`- ⚠ ${data.outOfStockProducts} producto${data.outOfStockProducts === 1 ? '' : 's'} sin stock`);
  }
  if (data.unreadMessages > 0) {
    alertas.push(`- ⚠ ${data.unreadMessages} mensaje${data.unreadMessages === 1 ? '' : 's'} sin leer`);
  }

  const variacion = data.salesLastMonth.count > 0
    ? Math.round(((data.salesThisMonth.total - data.salesLastMonth.total) / data.salesLastMonth.total) * 100)
    : null;

  const variacionTexto = variacion !== null
    ? ` (${variacion >= 0 ? '+' : ''}${variacion}% vs. mes anterior)`
    : '';

  const lines = [
    `## Estado actual del negocio`,
    `- Ventas del mes: ${fmtArs(data.salesThisMonth.total)} en ${data.salesThisMonth.count} pedidos${variacionTexto}`,
    `- Ticket promedio: ${fmtArs(data.salesThisMonth.avgTicket)}`,
    `- Pedidos cancelados este mes: ${data.cancelledThisMonth}`,
    `- Catálogo: ${data.totalProducts} productos`,
    `- Clientes: ${data.totalCustomers} totales, ${data.newCustomersThisMonth} nuevos este mes`,
  ];

  if (alertas.length > 0) {
    lines.push('', '## Alertas (mencionálas primero)', ...alertas);
  }

  return lines.join('\n');
}

function dashboard(biz?: { name: string; industry: string; mode: string }, moduleData?: ModuleSnapshot): string {
  const datosBlock = moduleData && isDashboardSnapshot(moduleData)
    ? '\n\n' + formatDashboardData(moduleData)
    : '';

  return `${panelBase(biz)}

${DASHBOARD_KNOWLEDGE}

## Contexto de pantalla
El usuario está en el Dashboard — la vista general de su negocio.

## Herramientas que tenés
- getSalesReport: reporte detallado de ventas con comparación mes a mes.
- getProductReport: productos más vendidos, sin rotación y stock crítico.
- getCustomerReport: segmentación de clientes (VIP, recurrente, nuevo, inactivo).

Si el usuario solo saluda o pregunta "cómo va todo", no le preguntes qué necesita: ofrecé directamente un resumen con los datos que ya tenés y preguntá si quiere profundizar en algo.${datosBlock}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && npx jest context/context-builder.spec --no-coverage`
Expected: PASS

- [ ] **Step 6: Run the full orbi test suite to check for regressions**

Run: `cd apps/api && npx jest --testPathPattern orbi/ --no-coverage`
Expected: PASS (no regressions in wizard tests, tool tests, etc.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/orbi/prompts/knowledge/dashboard.knowledge.ts apps/api/src/orbi/prompts/panel.ts apps/api/src/orbi/context/context-builder.spec.ts
git commit -m "feat(orbi): enrich dashboard prompt with domain knowledge and dynamic data

Dashboard prompt now includes e-commerce metrics knowledge (how to
interpret ticket avg, cancellation rate, stock alerts) and interpolates
real business data (sales, pending orders, out of stock, unread
messages). Graceful degradation when snapshot is empty.

Phase 1 of module knowledge bases (spec 2026-09-08).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Clean up old dashboard tests and verify end-to-end

**Files:**
- Modify: `apps/api/src/orbi/context/context-builder.spec.ts` (add panel module coverage test, matching the wizard pattern)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Test ensuring all 7 panel modules have their own prompt (no fallback), matching the wizard `PASOS_DEL_WIZARD` pattern

- [ ] **Step 1: Add exhaustive panel module coverage test**

Add after the existing wizard step tests in `context-builder.spec.ts`:

```typescript
  const MODULOS_DEL_PANEL = ['dashboard', 'catalogo', 'pedidos', 'clientes', 'descuentos', 'configuracion', 'mensajes'];
  const TEXTO_DEL_FALLBACK_PANEL = 'El usuario está viendo el módulo';

  it('cada módulo real del panel tiene prompt propio, ninguno cae al fallback', async () => {
    for (const mod of MODULOS_DEL_PANEL) {
      const prompt = await service.buildSystemPrompt({
        message: 'hola',
        context: { surface: OrbiSurface.PANEL, module: mod, businessId: 'biz-1' },
      } as any);

      expect(prompt).not.toContain(TEXTO_DEL_FALLBACK_PANEL);
    }
  });

  it('un módulo desconocido del panel sí cae al fallback', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'inventario', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain(TEXTO_DEL_FALLBACK_PANEL);
  });
```

- [ ] **Step 2: Run all tests**

Run: `cd apps/api && npx jest --testPathPattern orbi/ --no-coverage`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/orbi/context/context-builder.spec.ts
git commit -m "test(orbi): add exhaustive panel module coverage test

Same pattern as the wizard step coverage test: every panel module
must have its own prompt, none should fall to the generic fallback.
Catches future modules added to the sidebar but missing from panel.ts.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
