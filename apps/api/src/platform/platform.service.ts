import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ListBusinessesQueryDto } from './dto/list-businesses-query.dto';
import { SuspendBusinessDto } from './dto/suspend-business.dto';
import { GrantCompDto } from './dto/grant-comp.dto';
import { UpsertPlatformAdminDto } from './dto/upsert-platform-admin.dto';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';
import { SeriesQueryDto } from './dto/series-query.dto';
import { CreateDiscountCodeDto, UpdateDiscountCodeDto } from './dto/discount-code.dto';

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

// Servicio del super panel (plataforma). Todo cross-tenant: NO filtra por
// businessId — es la vista de Órbita sobre TODOS los negocios. Protegido por
// PlatformAdminGuard a nivel controller.
@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ── Testeo de plantillas de email (RBT-607) — MailModule es @Global, no
  // hace falta importarlo en PlatformModule para inyectar MailService. ──────

  listMailTemplates() {
    return this.mail.listPreviewables();
  }

  previewMailTemplate(id: string) {
    return this.mail.previewTemplate(id);
  }

  async sendMailTest(id: string, to: string) {
    const sent = await this.mail.sendPreview(id, to);
    return { sent };
  }

  // ── Overview (KPIs globales) ────────────────────────────────────────────────
  async overview() {
    const now = new Date();
    const since30 = new Date(now.getTime() - DAYS_30_MS);
    const soon30 = new Date(now.getTime() + DAYS_30_MS);

    const [
      totalBusinesses,
      activeBusinesses,
      pausedBusinesses,
      draftBusinesses,
      byMode,
      byIndustry,
      subsByStatus,
      subsByOrigin,
      mrr,
      customDomainsBySource,
      domainsExpiringSoon,
      newLast30,
    ] = await this.prisma.$transaction([
      this.prisma.business.count(),
      this.prisma.business.count({ where: { isActive: true, isPaused: false } }),
      this.prisma.business.count({ where: { isActive: true, isPaused: true } }),
      this.prisma.business.count({ where: { isActive: false } }),
      this.prisma.business.groupBy({ by: ['mode'], _count: { _all: true }, orderBy: { mode: 'asc' } }),
      this.prisma.business.groupBy({ by: ['industry'], _count: { _all: true }, orderBy: { industry: 'asc' } }),
      this.prisma.subscription.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.subscription.groupBy({ by: ['origin'], _count: { _all: true }, orderBy: { origin: 'asc' } }),
      this.prisma.subscription.aggregate({ _sum: { amount: true }, where: { status: 'ACTIVE', origin: 'PAID' } }),
      this.prisma.customDomain.groupBy({ by: ['source'], _count: { _all: true }, orderBy: { source: 'asc' } }),
      this.prisma.customDomain.count({ where: { source: 'PURCHASED', expiresAt: { lte: soon30, gte: now } } }),
      this.prisma.business.count({ where: { createdAt: { gte: since30 } } }),
    ]);

    // El tipado de `_count` en groupBy dentro de $transaction se ensancha
    // (quirk de Prisma), así que se lee de forma defensiva sobre unknown[].
    const countOf = (row: unknown): number => {
      const c = (row as { _count?: { _all?: number } | number })._count;
      return typeof c === 'number' ? c : (c?._all ?? 0);
    };
    const toMap = (rows: readonly unknown[], key: string): Record<string, number> =>
      Object.fromEntries(rows.map((row) => [String((row as Record<string, unknown>)[key]), countOf(row)]));

    return {
      businesses: {
        total: totalBusinesses,
        active: activeBusinesses,
        paused: pausedBusinesses,
        draft: draftBusinesses,
        newLast30Days: newLast30,
        byMode: toMap(byMode, 'mode'),
        byIndustry: (byIndustry as readonly unknown[])
          .map((row) => ({ industry: String((row as Record<string, unknown>).industry), count: countOf(row) }))
          .sort((a, b) => b.count - a.count),
      },
      subscriptions: {
        byStatus: toMap(subsByStatus, 'status'),
        byOrigin: toMap(subsByOrigin, 'origin'),
        mrr: Number(mrr._sum.amount ?? 0),
        currency: 'ARS',
      },
      domains: {
        // Cada negocio ocupa un subdominio en orbita.site (tier gratis).
        subdomainsInUse: totalBusinesses,
        customBySource: toMap(customDomainsBySource, 'source'), // PURCHASED = vendidos por Órbita
        expiringSoon: domainsExpiringSoon,
      },
      generatedAt: now.toISOString(),
    };
  }

  // ── Lista de negocios ───────────────────────────────────────────────────────
  async listBusinesses(q: ListBusinessesQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const where: Prisma.BusinessWhereInput = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { subdomain: { contains: q.search, mode: 'insensitive' } },
        { industry: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.status === 'draft') where.isActive = false;
    if (q.status === 'active') Object.assign(where, { isActive: true, isPaused: false });
    if (q.status === 'paused') Object.assign(where, { isActive: true, isPaused: true });
    if (q.mode) where.mode = q.mode;
    if (q.subscription === 'NONE') where.subscription = { is: null };
    else if (q.subscription) where.subscription = { status: q.subscription };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          subscription: { select: { status: true, plan: true, origin: true, amount: true, currentPeriodEnd: true } },
          members: {
            where: { role: { name: 'owner' } },
            select: { name: true, email: true, lastAccessAt: true },
            take: 1,
          },
          customDomains: { select: { domain: true, status: true, source: true } },
          _count: { select: { products: true, orders: true, customers: true } },
        },
      }),
      this.prisma.business.count({ where }),
    ]);

    return {
      data: rows.map((b) => ({
        id: b.id,
        name: b.name,
        subdomain: b.subdomain,
        industry: b.industry,
        mode: b.mode,
        status: !b.isActive ? 'draft' : b.isPaused ? 'paused' : 'active',
        createdAt: b.createdAt,
        owner: b.members[0] ?? null,
        subscription: b.subscription
          ? {
              status: b.subscription.status,
              plan: b.subscription.plan,
              origin: b.subscription.origin,
              amount: Number(b.subscription.amount),
              currentPeriodEnd: b.subscription.currentPeriodEnd,
            }
          : null,
        customDomain: b.customDomains[0]?.domain ?? null,
        counts: { products: b._count.products, orders: b._count.orders, customers: b._count.customers },
      })),
      total,
      page,
      limit,
    };
  }

  // ── Detalle de un negocio ───────────────────────────────────────────────────
  async getBusiness(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        subscription: {
          include: {
            payments: { orderBy: { createdAt: 'desc' }, take: 12 },
            grantedByAdmin: { select: { name: true, email: true } },
          },
        },
        members: {
          include: { role: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        customDomains: true,
        branches: { select: { id: true, name: true, isDefault: true } },
        _count: { select: { products: true, orders: true, customers: true } },
      },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const now = new Date();
    const since30 = new Date(now.getTime() - DAYS_30_MS);
    const [salesAllTime, salesLast30, logs] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        _sum: { total: true },
        _count: true,
        where: { businessId, status: { not: 'CANCELLED' }, deletedAt: null },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        _count: true,
        where: { businessId, status: { not: 'CANCELLED' }, deletedAt: null, createdAt: { gte: since30 } },
      }),
      this.prisma.platformAdminLog.findMany({
        where: { targetType: 'business', targetId: businessId },
        include: { admin: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const sub = business.subscription;
    return {
      id: business.id,
      name: business.name,
      industry: business.industry,
      subrubros: business.subrubros,
      description: business.description,
      subdomain: business.subdomain,
      mode: business.mode,
      status: !business.isActive ? 'draft' : business.isPaused ? 'paused' : 'active',
      operatesPhysical: business.operatesPhysical,
      operatesOnline: business.operatesOnline,
      teamSize: business.teamSize,
      createdAt: business.createdAt,
      team: business.members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role.name,
        status: m.status,
        lastAccessAt: m.lastAccessAt,
        emailVerified: m.emailVerified,
      })),
      branches: business.branches,
      subscription: sub
        ? {
            status: sub.status,
            plan: sub.plan,
            origin: sub.origin,
            amount: Number(sub.amount),
            currency: sub.currency,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            grantReason: sub.grantReason,
            grantedBy: sub.grantedByAdmin,
            payments: sub.payments.map((p) => ({
              id: p.id,
              amount: Number(p.amount),
              status: p.status,
              periodStart: p.periodStart,
              periodEnd: p.periodEnd,
              paidAt: p.paidAt,
              failedReason: p.failedReason,
            })),
          }
        : null,
      customDomains: business.customDomains.map((d) => ({
        domain: d.domain,
        source: d.source,
        status: d.status,
        sslStatus: d.sslStatus,
        dnsVerified: d.dnsVerified,
        expiresAt: d.expiresAt,
        autoRenew: d.autoRenew,
      })),
      metrics: {
        products: business._count.products,
        customers: business._count.customers,
        orders: business._count.orders,
        salesAllTime: Number(salesAllTime._sum.total ?? 0),
        ordersLast30Days: salesLast30._count,
        salesLast30Days: Number(salesLast30._sum.total ?? 0),
      },
      activity: logs.map((l) => ({
        action: l.action,
        details: l.details,
        admin: l.admin,
        createdAt: l.createdAt,
      })),
    };
  }

  // ── Dominios (subdominios + dominios custom) ────────────────────────────────
  async listDomains() {
    const [businesses, customDomains] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        select: { id: true, name: true, subdomain: true, mode: true, isActive: true, isPaused: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customDomain.findMany({
        include: { business: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      // Subdominio gratis (todos los negocios ocupan uno en orbita.site).
      subdomains: businesses.map((b) => ({
        subdomain: b.subdomain,
        fullHost: `${b.subdomain}.orbita.site`,
        businessId: b.id,
        businessName: b.name,
        mode: b.mode,
        status: !b.isActive ? 'draft' : b.isPaused ? 'paused' : 'active',
      })),
      // Dominios propios: PURCHASED = vendidos/gestionados por Órbita; LINKED = traídos por el cliente.
      customDomains: customDomains.map((d) => ({
        domain: d.domain,
        businessId: d.business.id,
        businessName: d.business.name,
        source: d.source,
        status: d.status,
        sslStatus: d.sslStatus,
        dnsVerified: d.dnsVerified,
        purchasedAt: d.purchasedAt,
        expiresAt: d.expiresAt,
        autoRenew: d.autoRenew,
      })),
    };
  }

  // ── Dueños (cross-negocio) ──────────────────────────────────────────────────
  async listOwners() {
    const owners = await this.prisma.member.findMany({
      where: { role: { name: 'owner' } },
      include: { business: { select: { id: true, name: true, subdomain: true, isActive: true, isPaused: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return owners.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      emailVerified: m.emailVerified,
      lastAccessAt: m.lastAccessAt,
      business: m.business
        ? {
            id: m.business.id,
            name: m.business.name,
            subdomain: m.business.subdomain,
            status: !m.business.isActive ? 'draft' : m.business.isPaused ? 'paused' : 'active',
          }
        : null,
    }));
  }

  // ── Suscripciones (cross-negocio) ───────────────────────────────────────────
  async listSubscriptions() {
    const subs = await this.prisma.subscription.findMany({
      include: { business: { select: { id: true, name: true, subdomain: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return subs.map((s) => ({
      businessId: s.businessId,
      business: s.business,
      status: s.status,
      origin: s.origin,
      plan: s.plan,
      amount: Number(s.amount),
      currency: s.currency,
      currentPeriodEnd: s.currentPeriodEnd,
      grantReason: s.grantReason,
    }));
  }

  // ── Logs de auditoría (RBT-655) ─────────────────────────────────────────────
  async listLogs(q: ListLogsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const where: Prisma.PlatformAdminLogWhereInput = {};
    if (q.adminId) where.adminId = q.adminId;
    if (q.action) where.action = q.action;
    // targetId coincide con el businessId tanto para acciones sobre el negocio
    // (targetType 'business') como sobre su suscripción ('subscription', ver
    // grantComp) — no hace falta filtrar además por targetType.
    if (q.businessId) where.targetId = q.businessId;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.platformAdminLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { admin: { select: { name: true, email: true } } },
      }),
      this.prisma.platformAdminLog.count({ where }),
    ]);

    // Resuelve nombre de negocio para los logs cuyo target es un negocio o su
    // suscripción — un solo findMany en vez de N+1 por fila.
    const businessIds = [...new Set(
      rows.filter((r) => r.targetType === 'business' || r.targetType === 'subscription').map((r) => r.targetId),
    )];
    const businesses = businessIds.length
      ? await this.prisma.business.findMany({ where: { id: { in: businessIds } }, select: { id: true, name: true } })
      : [];
    const businessNameById = new Map(businesses.map((b) => [b.id, b.name]));

    return {
      data: rows.map((r) => ({
        id: r.id,
        admin: { id: r.adminId, name: r.admin.name, email: r.admin.email },
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        businessName: businessNameById.get(r.targetId) ?? null,
        details: r.details,
        createdAt: r.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Acciones (con auditoría en PlatformAdminLog) ────────────────────────────

  async suspendBusiness(adminId: string, businessId: string, dto: SuspendBusinessDto) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, include: { subscription: true } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    await this.prisma.$transaction(async (tx) => {
      await tx.business.update({ where: { id: businessId }, data: { isPaused: true } });
      if (business.subscription) {
        await tx.subscription.update({ where: { businessId }, data: { status: 'SUSPENDED' } });
      }
      await tx.platformAdminLog.create({
        data: {
          adminId,
          action: 'suspend_business',
          targetType: 'business',
          targetId: businessId,
          details: dto.reason ? { reason: dto.reason } : undefined,
        },
      });
    });

    // CONTRATO_API.md pide { ok: true } — no el negocio completo. El frontend
    // vuelve a pedir el detalle si necesita datos actualizados (mismo patrón
    // que removeAdmin más abajo).
    return { ok: true };
  }

  async reactivateBusiness(adminId: string, businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, include: { subscription: true } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    await this.prisma.$transaction(async (tx) => {
      await tx.business.update({ where: { id: businessId }, data: { isPaused: false } });
      if (business.subscription && business.subscription.status === 'SUSPENDED') {
        await tx.subscription.update({ where: { businessId }, data: { status: 'ACTIVE' } });
      }
      await tx.platformAdminLog.create({
        data: { adminId, action: 'reactivate_business', targetType: 'business', targetId: businessId },
      });
    });

    return { ok: true };
  }

  async grantComp(adminId: string, businessId: string, dto: GrantCompDto) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const periodEnd = new Date(dto.currentPeriodEnd);
    if (Number.isNaN(periodEnd.getTime())) throw new BadRequestException('currentPeriodEnd inválido (usar ISO 8601)');

    const now = new Date();
    const sub = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.upsert({
        where: { businessId },
        create: {
          businessId,
          origin: 'COMP',
          status: 'ACTIVE',
          plan: 'standard',
          amount: new Prisma.Decimal(0),
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          grantedBy: adminId,
          grantReason: dto.grantReason,
        },
        update: {
          origin: 'COMP',
          status: 'ACTIVE',
          amount: new Prisma.Decimal(0),
          currentPeriodEnd: periodEnd,
          grantedBy: adminId,
          grantReason: dto.grantReason,
        },
      });
      await tx.platformAdminLog.create({
        data: {
          adminId,
          action: 'grant_comp',
          targetType: 'subscription',
          targetId: businessId,
          details: { grantReason: dto.grantReason, currentPeriodEnd: periodEnd.toISOString() },
        },
      });
      return updated;
    });

    // CONTRATO_API.md:1737 pide "la Subscription" — mismo shape que
    // listSubscriptions(), no el negocio completo (eso devolvía antes).
    return {
      businessId: sub.businessId,
      status: sub.status,
      origin: sub.origin,
      plan: sub.plan,
      amount: Number(sub.amount),
      currency: sub.currency,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      grantReason: sub.grantReason,
    };
  }

  // ── Series diarias para los gráficos del dashboard ──────────────────────────
  // Mismo criterio que reports.service.ts: se trae una sola consulta con las
  // filas del rango y se bucketiza en JS por día (clave YYYY-MM-DD en UTC) —
  // nada de $queryRaw/date_trunc, para no depender de sintaxis específica de
  // Postgres en un modelo que ya se lee bien con Prisma normal.

  private dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private emptyDayBuckets(days: number): { from: Date; keys: string[] } {
    const now = new Date();
    const keys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      keys.push(this.dayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
    }
    // El "from" se ancla al inicio del día más viejo del rango (UTC) para que
    // el where >= no se coma parte del primer día por la hora actual.
    const from = new Date(`${keys[0]}T00:00:00.000Z`);
    return { from, keys };
  }

  async growthSeries(dto: SeriesQueryDto) {
    const days = dto.days ?? 30;
    const { from, keys } = this.emptyDayBuckets(days);

    const [businesses, subscriptions] = await this.prisma.$transaction([
      this.prisma.business.findMany({ where: { createdAt: { gte: from } }, select: { createdAt: true } }),
      this.prisma.subscription.findMany({ where: { createdAt: { gte: from }, origin: 'PAID' }, select: { createdAt: true } }),
    ]);

    const buckets = new Map(keys.map((k) => [k, { businesses: 0, subscriptions: 0 }]));
    for (const b of businesses) buckets.get(this.dayKey(b.createdAt))!.businesses++;
    for (const s of subscriptions) buckets.get(this.dayKey(s.createdAt))!.subscriptions++;

    return { series: keys.map((date) => ({ date, ...buckets.get(date)! })) };
  }

  async revenueSeries(dto: SeriesQueryDto) {
    const days = dto.days ?? 30;
    const { from, keys } = this.emptyDayBuckets(days);

    const payments = await this.prisma.subscriptionPayment.findMany({
      where: { status: 'APPROVED', paidAt: { gte: from } },
      select: { amount: true, paidAt: true },
    });

    const buckets = new Map(keys.map((k) => [k, 0]));
    for (const p of payments) {
      if (!p.paidAt) continue;
      const key = this.dayKey(p.paidAt);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(p.amount));
    }

    return { series: keys.map((date) => ({ date, amount: buckets.get(date)! })) };
  }

  async businessSeries(businessId: string, dto: SeriesQueryDto) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const days = dto.days ?? 30;
    const { from, keys } = this.emptyDayBuckets(days);

    const [orders, customers] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { businessId, status: { not: 'CANCELLED' }, deletedAt: null, createdAt: { gte: from } },
        select: { createdAt: true, total: true },
      }),
      this.prisma.customer.findMany({ where: { businessId, createdAt: { gte: from } }, select: { createdAt: true } }),
    ]);

    const buckets = new Map(keys.map((k) => [k, { orders: 0, sales: 0, newCustomers: 0 }]));
    for (const o of orders) {
      const bucket = buckets.get(this.dayKey(o.createdAt))!;
      bucket.orders++;
      bucket.sales += Number(o.total);
    }
    for (const c of customers) buckets.get(this.dayKey(c.createdAt))!.newCustomers++;

    return { series: keys.map((date) => ({ date, ...buckets.get(date)! })) };
  }

  // ── Catálogo y reseñas de un negocio (solo lectura, sin datos privados) ─────

  async businessProducts(businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const products = await this.prisma.product.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        category: { select: { name: true } },
        variants: { select: { stock: { select: { quantity: true } } } },
      },
    });

    return {
      data: products.map((p) => ({
        id: p.id,
        name: p.name,
        categoryName: p.category?.name ?? null,
        status: p.status,
        basePrice: Number(p.basePrice),
        totalStock: p.variants.reduce((sum, v) => sum + v.stock.reduce((s, st) => s + st.quantity, 0), 0),
      })),
    };
  }

  async businessReviews(businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const reviews = await this.prisma.review.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        product: { select: { name: true } },
        // Mismo criterio de privacidad que ya usa el storefront público: nombre
        // + inicial del apellido, nunca el apellido completo ni el email.
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    return {
      data: reviews.map((r) => ({
        id: r.id,
        productName: r.product.name,
        customerName: r.customer.lastName ? `${r.customer.firstName} ${r.customer.lastName[0]}.` : r.customer.firstName,
        text: r.text,
        status: r.status,
        isVerified: r.isVerified,
        createdAt: r.createdAt,
      })),
    };
  }

  // ── Admins de plataforma ────────────────────────────────────────────────────

  async listAdmins() {
    const admins = await this.prisma.platformAdmin.findMany({ orderBy: { createdAt: 'asc' } });
    return admins.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      isActive: a.isActive,
      hasPassword: !!a.passwordHash,
      hasGoogle: !!a.googleId,
      lastAccessAt: a.lastAccessAt,
      createdAt: a.createdAt,
    }));
  }

  async createAdmin(actingAdminId: string, dto: UpsertPlatformAdminDto) {
    const existing = await this.prisma.platformAdmin.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Ya existe un admin con ese email');

    // Sin password: el nuevo admin entra con Google (se vincula en el 1er login)
    // o vía reset de contraseña cuando ese flujo exista (ver PENDIENTES).
    const admin = await this.prisma.platformAdmin.create({
      data: { name: dto.name, email: dto.email, role: dto.role, isActive: true },
    });
    await this.prisma.platformAdminLog.create({
      data: { adminId: actingAdminId, action: 'create_admin', targetType: 'platform_admin', targetId: admin.id, details: { email: dto.email, role: dto.role } },
    });
    return { id: admin.id, name: admin.name, email: admin.email, role: admin.role, isActive: admin.isActive };
  }

  async updateAdmin(actingAdminId: string, id: string, dto: UpsertPlatformAdminDto) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin no encontrado');

    const updated = await this.prisma.platformAdmin.update({
      where: { id },
      data: { name: dto.name, role: dto.role },
    });
    await this.prisma.platformAdminLog.create({
      data: { adminId: actingAdminId, action: 'update_admin', targetType: 'platform_admin', targetId: id, details: { role: dto.role } },
    });
    return { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive };
  }

  async removeAdmin(actingAdminId: string, id: string) {
    if (actingAdminId === id) throw new ForbiddenException('No podés desactivar tu propia cuenta de admin');
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin no encontrado');

    // Soft-delete: se desactiva, no se borra (mantiene la trazabilidad de sus logs).
    await this.prisma.platformAdmin.update({ where: { id }, data: { isActive: false } });
    await this.prisma.platformAdminLog.create({
      data: { adminId: actingAdminId, action: 'deactivate_admin', targetType: 'platform_admin', targetId: id },
    });
    return { ok: true };
  }

  // ── Códigos de descuento de plataforma ────────────────────────────────────

  // El código se guarda y se busca SIEMPRE en mayúsculas: el que lo tipea no
  // tiene por qué respetar el case, y un unique sensible al case dejaría crear
  // "verano" y "VERANO" como códigos distintos.
  private static normalizarCodigo(code: string): string {
    return code.trim().toUpperCase();
  }

  async listDiscountCodes() {
    const codes = await this.prisma.platformDiscountCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { createdByAdmin: { select: { name: true } } },
    });
    return codes.map((c) => ({
      id: c.id,
      code: c.code,
      percentOff: c.percentOff,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      isActive: c.isActive,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      note: c.note,
      createdBy: c.createdByAdmin?.name ?? null,
      createdAt: c.createdAt.toISOString(),
      // Estado derivado, para que el panel no tenga que recalcular la misma
      // regla que usa el checkout.
      estado: this.estadoCodigo(c),
    }));
  }

  private estadoCodigo(c: { isActive: boolean; expiresAt: Date | null; maxUses: number | null; usedCount: number }) {
    if (!c.isActive) return 'DESACTIVADO';
    if (c.expiresAt && c.expiresAt <= new Date()) return 'VENCIDO';
    if (c.maxUses !== null && c.usedCount >= c.maxUses) return 'AGOTADO';
    return 'ACTIVO';
  }

  async getDiscountCode(id: string) {
    const c = await this.prisma.platformDiscountCode.findUnique({
      where: { id },
      include: {
        createdByAdmin: { select: { name: true } },
        redemptions: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!c) throw new NotFoundException('Código no encontrado');

    // Los canjes guardan businessId pero no el nombre: se resuelve acá para no
    // mostrar un uuid pelado en el panel.
    const ids = c.redemptions.map((r) => r.businessId).filter((x): x is string => !!x);
    const negocios = ids.length
      ? await this.prisma.business.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const nombrePorId = new Map(negocios.map((n) => [n.id, n.name]));

    return {
      id: c.id,
      code: c.code,
      percentOff: c.percentOff,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      isActive: c.isActive,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      note: c.note,
      createdBy: c.createdByAdmin?.name ?? null,
      createdAt: c.createdAt.toISOString(),
      estado: this.estadoCodigo(c),
      redemptions: c.redemptions.map((r) => ({
        id: r.id,
        email: r.email,
        businessId: r.businessId,
        businessName: r.businessId ? (nombrePorId.get(r.businessId) ?? null) : null,
        amountBase: Number(r.amountBase),
        amountFinal: Number(r.amountFinal),
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async createDiscountCode(adminId: string, dto: CreateDiscountCodeDto) {
    const code = PlatformService.normalizarCodigo(dto.code);
    const yaExiste = await this.prisma.platformDiscountCode.findUnique({ where: { code } });
    if (yaExiste) throw new BadRequestException(`Ya existe un código ${code}`);

    const expiresAt = this.parseVencimiento(dto.expiresAt);

    const creado = await this.prisma.platformDiscountCode.create({
      data: {
        code,
        percentOff: dto.percentOff,
        maxUses: dto.maxUses ?? null,
        expiresAt,
        note: dto.note?.trim() || null,
        createdBy: adminId,
      },
    });
    await this.prisma.platformAdminLog.create({
      data: {
        adminId,
        action: 'create_discount_code',
        targetType: 'discount_code',
        targetId: creado.id,
        details: { code, percentOff: dto.percentOff, maxUses: dto.maxUses ?? null },
      },
    });
    return this.getDiscountCode(creado.id);
  }

  async updateDiscountCode(adminId: string, id: string, dto: UpdateDiscountCodeDto) {
    const actual = await this.prisma.platformDiscountCode.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Código no encontrado');

    // Bajar el tope por debajo de lo ya usado dejaría el código en un estado
    // incoherente (usos > máximo), así que se rechaza con un mensaje que dice
    // exactamente cuál es el piso.
    if (dto.maxUses != null && dto.maxUses < actual.usedCount) {
      throw new BadRequestException(`El código ya se usó ${actual.usedCount} vece(s): el máximo no puede ser menor`);
    }

    await this.prisma.platformDiscountCode.update({
      where: { id },
      data: {
        ...(dto.percentOff !== undefined ? { percentOff: dto.percentOff } : {}),
        ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: this.parseVencimiento(dto.expiresAt) } : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
      },
    });
    await this.prisma.platformAdminLog.create({
      data: {
        adminId,
        action: 'update_discount_code',
        targetType: 'discount_code',
        targetId: id,
        details: { code: actual.code, ...dto },
      },
    });
    return this.getDiscountCode(id);
  }

  private parseVencimiento(valor: string | null | undefined): Date | null {
    if (valor === undefined || valor === null || valor === '') return null;
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('expiresAt inválido (usar ISO 8601)');
    return d;
  }
}
