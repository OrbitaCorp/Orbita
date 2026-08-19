import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UpsertCustomerDto } from './dto/upsert-customer.dto';
import { FindCustomersQueryDto } from './dto/find-customers-query.dto';

// (Fase 2 — Alex) La base de clientes del negocio. Acá vive la lista con sus
// números (cuántos pedidos hizo cada uno, cuánto gastó, su ticket promedio y
// cuándo compró por última vez), el detalle con sus pedidos y direcciones, y
// el alta/edición desde el panel.
//
// Los números NO se guardan en ninguna tabla: se calculan al momento de leer,
// mirando los pedidos reales (sin contar los cancelados). Así nunca quedan
// desactualizados. Decisión del plan de backend (6.1) y del contrato.

type Metricas = { orderCount: number; totalSpent: number; avgTicket: number; lastOrderAt: Date | null };

// Lo que el panel puede ver de un cliente: el alta y la edición devuelven esto
// en vez del modelo crudo de la base (que arrastraba passwordHash y otros
// campos internos en la respuesta).
const CAMPOS_PUBLICOS = {
  id: true, firstName: true, lastName: true, email: true, phone: true,
  dni: true, createdAt: true,
} as const;

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Calcula los números de una tanda de clientes en UNA sola consulta
  // (agrupando sus pedidos), para no hacer un viaje a la base por cliente.
  private async metricasDe(businessId: string, customerIds: string[]): Promise<Map<string, Metricas>> {
    const mapa = new Map<string, Metricas>();
    if (customerIds.length === 0) return mapa;

    const grupos = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        businessId,
        deletedAt: null,
        customerId: { in: customerIds },
        status: { not: 'CANCELLED' }, // un pedido cancelado no cuenta como compra
      },
      orderBy: { customerId: 'asc' },
      _count: true,
      _sum: { total: true },
      _max: { createdAt: true },
    });

    for (const g of grupos) {
      if (!g.customerId) continue;
      const cantidad = typeof g._count === 'number' ? g._count : 0;
      const gastado = g._sum.total != null ? Number(g._sum.total) : 0;
      mapa.set(g.customerId, {
        orderCount: cantidad,
        totalSpent: gastado,
        avgTicket: cantidad > 0 ? Math.round((gastado / cantidad) * 100) / 100 : 0,
        lastOrderAt: g._max.createdAt ?? null,
      });
    }
    return mapa;
  }

  // El formato que promete el contrato para cada cliente de la lista.
  private aClienteConMetricas(
    c: { id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null; dni: string | null; passwordHash: string | null; createdAt: Date },
    m: Metricas | undefined,
  ) {
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      dni: c.dni,
      // Tiene cuenta si alguna vez se registró en la tienda con contraseña.
      hasAccount: c.passwordHash != null,
      orderCount: m?.orderCount ?? 0,
      totalSpent: m?.totalSpent ?? 0,
      avgTicket: m?.avgTicket ?? 0,
      lastOrderAt: m?.lastOrderAt ?? null,
      createdAt: c.createdAt,
    };
  }

  // ── Lista con búsqueda y números ──────────────────────────────────────────
  async findAll(businessId: string, q: FindCustomersQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const where: Prisma.CustomerWhereInput = { businessId, deletedAt: null };
    const s = q.search?.trim();
    if (s) {
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [clientes, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    const metricas = await this.metricasDe(businessId, clientes.map((c) => c.id));

    return {
      data: clientes.map((c) => this.aClienteConMetricas(c, metricas.get(c.id))),
      total,
      page,
      limit,
    };
  }

  // ── Detalle: el cliente + sus números + sus pedidos + sus direcciones ─────
  async findOne(businessId: string, id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, businessId, deletedAt: null },
      include: { addresses: { orderBy: { isDefault: 'desc' } } },
    });
    if (!c) throw new NotFoundException('Cliente no encontrado');

    const [metricas, pedidos, emails] = await Promise.all([
      this.metricasDe(businessId, [c.id]),
      this.prisma.order.findMany({
        where: { businessId, customerId: c.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { items: { select: { quantity: true, productName: true, variantLabel: true } } },
      }),
      // Los emails que le mandamos (individuales, masivos o automáticos):
      // MailService deja todos en email_logs con el customerId, y la pestaña
      // Actividad del perfil los muestra. Corrección Fase 3 del contrato.
      this.prisma.emailLog.findMany({
        where: { businessId, customerId: c.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, subject: true, template: true, status: true, createdAt: true },
      }),
    ]);

    return {
      ...this.aClienteConMetricas(c, metricas.get(c.id)),
      orders: pedidos.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        channel: o.channel,
        status: o.status,
        total: Number(o.total),
        itemCount: o.items.reduce((acc, it) => acc + it.quantity, 0),
        // Qué compró: la pestaña Pedidos y la Actividad del perfil lo
        // muestran — antes solo se veía estado y monto.
        items: o.items.map((it) => ({
          productName: it.productName,
          variantLabel: it.variantLabel,
          quantity: it.quantity,
        })),
        createdAt: o.createdAt,
      })),
      addresses: c.addresses.map((a) => ({
        id: a.id, alias: a.alias, street: a.street, floor: a.floor,
        city: a.city, zip: a.zip, isDefault: a.isDefault,
      })),
      emails,
    };
  }

  // ── Alta desde el panel ───────────────────────────────────────────────────
  // Regla del contrato (anti-duplicados): si el email ya existe en ESTE
  // negocio, no se crea otro cliente — se actualizan sus datos y se devuelve
  // el que ya estaba. Así el cliente del mostrador y el de la tienda online
  // terminan siendo la misma persona.
  async create(businessId: string, dto: UpsertCustomerDto) {
    if (dto.email) {
      const existente = await this.prisma.customer.findFirst({
        where: { businessId, deletedAt: null, email: { equals: dto.email, mode: 'insensitive' } },
      });
      if (existente) {
        return this.prisma.customer.update({
          where: { id: existente.id },
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName ?? existente.lastName,
            phone: dto.phone ?? existente.phone,
            dni: dto.dni ?? existente.dni,
          },
          select: CAMPOS_PUBLICOS,
        });
      }
    }
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
      // El findFirst de arriba y este create no son atómicos: dos altas
      // simultáneas con el mismo email (doble click en Guardar) chocan contra
      // @@unique([businessId, email]). Eso es un conflicto, no un error del
      // servidor — mismo trato que en update().
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya hay otro cliente con ese email en tu negocio.');
      }
      throw e;
    }
  }

  // ── Edición ───────────────────────────────────────────────────────────────
  async update(businessId: string, id: string, dto: UpsertCustomerDto) {
    const existente = await this.prisma.customer.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!existente) throw new NotFoundException('Cliente no encontrado');

    try {
      return await this.prisma.customer.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          dni: dto.dni ?? null,
        },
        select: CAMPOS_PUBLICOS,
      });
    } catch (e) {
      // Chocó con el email de OTRO cliente del mismo negocio.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya hay otro cliente con ese email en tu negocio.');
      }
      throw e;
    }
  }

  // ── Email individual / masivo ─────────────────────────────────────────────
  // Le escribe a los clientes elegidos. El texto admite variables que se
  // completan por persona: {nombre}, {email}, {total_gastado} y
  // {ultima_compra}. Los clientes sin email se saltean y no cuentan en el
  // resultado. Sin mail configurado en local, cada envío sale como [MAIL STUB].
  async sendEmail(businessId: string, dto: { customerIds: string[]; subject: string; body: string }) {
    const clientes = await this.prisma.customer.findMany({
      where: { id: { in: dto.customerIds }, businessId, deletedAt: null, email: { not: null } },
    });
    if (clientes.length === 0) return { sent: 0 };

    const metricas = await this.metricasDe(businessId, clientes.map((c) => c.id));

    let sent = 0;
    for (const c of clientes) {
      const m = metricas.get(c.id);
      const reemplazar = (texto: string) =>
        texto
          .replace(/\{nombre\}/g, c.firstName)
          .replace(/\{email\}/g, c.email ?? '')
          .replace(/\{total_gastado\}/g, `$${(m?.totalSpent ?? 0).toLocaleString('es-AR')}`)
          .replace(/\{ultima_compra\}/g, m?.lastOrderAt ? new Date(m.lastOrderAt).toLocaleDateString('es-AR') : 'todavía sin compras');
      try {
        const salio = await this.mail.sendCustomEmail(
          c.email as string,
          reemplazar(dto.subject),
          reemplazar(dto.body).replace(/\n/g, '<br/>'),
          { businessId, customerId: c.id },
        );
        // Solo cuenta si de verdad salió (o quedó simulado en local): un
        // rechazo del proveedor ya no se disfraza de "enviado".
        if (salio) sent++;
      } catch (e) {
        // Si un envío falla, sigo con los demás — el resultado dice cuántos
        // salieron. Pero ya no en silencio: antes un fallo sistémico (por
        // ejemplo, una plantilla faltante) desaparecía sin dejar ningún
        // rastro y solo se veía "0 clientes" sin ninguna pista de por qué.
        // Ahora al menos queda en el log del server (y, gracias al fix en
        // MailService, también en email_logs como FAILED con el error real).
        this.logger.error(`No se pudo enviar el email masivo a ${c.email}: ${e}`);
      }
    }
    return { sent };
  }
}
