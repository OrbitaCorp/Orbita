import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AppointmentCustomerProfile, type Customer } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import type { MemberContext } from '../../../common/types/auth-context.type';
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import type { AvanzadoTurnos, ClienteDto, ClienteFichaDto, MembresiaDto, PackCompradoDto, Paginado } from '../../appointments.types';
import { contactoSegun, montoSegun, pesos } from '../comun/alcance';
import { GestionContextoService } from '../comun/contexto.service';
import { nombreDe, partirNombre } from '../comun/ficha-cliente';
import { aTurnoDto } from '../comun/mapeos';
import { normalizarTelefono } from '../comun/telefono';
import type { CreateClientDto, ListClientsQueryDto, UpdateClientDto } from './dto/clientes.dto';

const VER_TODO = 'appointments.clients.view_all';
const FRECUENTE = 5;

// Para buscar por nombre sin acentos del lado de Postgres (sin depender de la
// extensión unaccent, que no está instalada).
const CON_ACENTO = 'áàäâãéèëêíìïîóòöôõúùüûñç';
const SIN_ACENTO = 'aaaaaeeeeiiiiooooouuuunc';
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

interface Estadistica { visits: number; lastVisit: Date | null; spent: number }

type ClienteConPerfil = Customer & { appointmentProfile: AppointmentCustomerProfile | null };

/**
 * Clientes de Turnos (CONTRATO § P3.2): los mismos `customers` de Tienda más
 * `appointment_customer_profiles`. No usa CustomersService: ese pide permisos
 * `customers.*` y expone columnas que acá no van.
 *
 * Alcance: sin `appointments.clients.view_all`, solo los clientes que tienen
 * algún turno no cancelado en una agenda propia (o una inscripción a una
 * clase que da o que se da en su espacio). Fuera de alcance = 404.
 */
@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: GestionContextoService,
    private readonly audit?: AuditService,
  ) {}

  async listar(member: MemberContext, q: ListClientsQueryDto): Promise<Paginado<ClienteDto>> {
    await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const condiciones: Prisma.CustomerWhereInput[] = [{ businessId, deletedAt: null }];

    const propias = await this.ctx.propias(member, VER_TODO);
    if (propias) condiciones.push({ id: { in: await this.idsEnAlcance(businessId, propias) } });
    if (q.q?.trim()) condiciones.push({ id: { in: await this.idsPorTexto(businessId, q.q) } });
    if (q.filter === 'frecuentes' || q.filter === 'nuevos') {
      const visitas = await this.visitasDeTodos(businessId);
      const ids = [...visitas].filter(([, n]) => n >= (q.filter === 'frecuentes' ? FRECUENTE : 2)).map(([id]) => id);
      condiciones.push(q.filter === 'frecuentes' ? { id: { in: ids } } : { id: { notIn: ids } });
    }

    const where: Prisma.CustomerWhereInput = { AND: condiciones };
    const [total, filas] = await Promise.all([
      this.prisma.customer.count({ where: { businessId, ...where } }),
      this.prisma.customer.findMany({
        where: { businessId, ...where },
        include: { appointmentProfile: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const stats = await this.estadisticas(businessId, filas.map((f) => f.id));
    // Datos de salud (obra social) solo en la ficha, nunca en listados (CONTRATO § P3.2).
    return { data: filas.map((c) => ({ ...this.aDto(member, c, stats.get(c.id)), insuranceName: null })), total, page, limit };
  }

  async ficha(member: MemberContext, id: string, ahora = new Date()): Promise<ClienteFichaDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const propias = await this.ctx.propias(member, VER_TODO);
    const c = await this.clienteVisible(member, id, propias);

    const turnosWhere: Prisma.AppointmentWhereInput = { businessId, customerId: id, ...(propias ? { resourceId: { in: propias } } : {}) };
    const [stats, card, proximo, historial, packs, membresia] = await Promise.all([
      this.estadisticas(businessId, [id]),
      this.prisma.appointmentLoyaltyCard.findFirst({ where: { businessId, customerId: id } }),
      this.prisma.appointment.findFirst({
        where: { ...turnosWhere, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gt: ahora } },
        orderBy: { startsAt: 'asc' },
        include: { resource: { select: { name: true } } },
      }),
      this.prisma.appointment.findMany({
        where: turnosWhere,
        orderBy: { startsAt: 'desc' },
        take: 50,
        include: { resource: { select: { name: true } } },
      }),
      this.prisma.appointmentPackagePurchase.findMany({
        where: { businessId, customerId: id },
        orderBy: { createdAt: 'desc' },
        include: { package: { select: { service: { select: { name: true } } } } },
      }),
      this.prisma.appointmentMembership.findFirst({
        where: { businessId, customerId: id, status: { not: 'CANCELLED' } },
        orderBy: { startedAt: 'desc' },
        include: { plan: { select: { name: true } } },
      }),
    ]);

    const fidelidad = (settings.advanced as AvanzadoTurnos | null)?.fidelidad;
    const needed = fidelidad?.on && fidelidad.config?.sellos ? fidelidad.config.sellos : settings.loyaltyStamps;
    const perfil = c.appointmentProfile;
    const packages: PackCompradoDto[] = packs.map((p) => ({
      id: p.id, packageId: p.packageId, serviceName: p.package.service.name, customerName: p.customerName,
      sessionsTotal: p.sessionsTotal, sessionsUsed: p.sessionsUsed, paid: p.paidAt !== null, expiresAt: p.expiresAt?.toISOString() ?? null,
    }));
    const membership: MembresiaDto | null = membresia ? {
      id: membresia.id, planId: membresia.planId, planName: membresia.plan.name, customerName: membresia.customerName, status: membresia.status,
      startedAt: membresia.startedAt.toISOString(), pausedUntil: membresia.pausedUntil?.toISOString() ?? null, nextChargeAt: membresia.nextChargeAt?.toISOString() ?? null,
    } : null;

    return {
      ...this.aDto(member, c, stats.get(id)),
      insuranceNumber: perfil?.insuranceNumber ?? null,
      dni: c.dni,
      depositCredit: pesos(perfil?.depositCredit),
      loyalty: needed > 0 || card ? { stamps: card?.stamps ?? 0, needed, rewardsAvailable: card ? card.rewardsEarned - card.rewardsRedeemed : 0 } : null,
      next: proximo ? aTurnoDto(proximo, member, ahora) : null,
      history: historial.map((t) => aTurnoDto(t, member, ahora)),
      packages,
      membership,
    };
  }

  async crear(member: MemberContext, dto: CreateClientDto): Promise<ClienteDto> {
    await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const phone = this.telefono(dto.phone);
    const email = dto.email ?? null;
    await this.assertNoRepetido(businessId, phone, email);

    const creado = await this.prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({ data: { businessId, ...partirNombre(dto.name), phone, email } });
      const perfil = await tx.appointmentCustomerProfile.create({
        data: { businessId, customerId: c.id, note: dto.note ?? null, insuranceName: dto.insuranceName ?? null },
      });
      return { ...c, appointmentProfile: perfil };
    });
    await this.audit?.registrar({
      businessId, memberId: member.memberId, entityType: 'customer', entityId: creado.id, action: 'CREATE',
      changes: [
        { field: 'name', before: null, after: nombreDe(creado) },
        { field: 'origen', before: null, after: 'turnos' },
      ],
    });
    return this.aDto(member, creado, undefined);
  }

  async editar(member: MemberContext, id: string, dto: UpdateClientDto, ahora = new Date()): Promise<ClienteFichaDto> {
    await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const propias = await this.ctx.propias(member, VER_TODO);
    const antes = await this.clienteVisible(member, id, propias);

    // undefined = no cambia; null o '' = se borra.
    const phone = dto.phone === undefined ? antes.phone : this.telefono(dto.phone);
    const email = dto.email === undefined ? antes.email : dto.email || null;
    const conCuenta = !!(antes.passwordHash || antes.googleId);
    if (conCuenta && email !== antes.email) {
      throw new BadRequestException('Ese cliente tiene cuenta: el email lo cambia desde su perfil.');
    }
    await this.assertNoRepetido(businessId, phone !== antes.phone ? phone : null, email !== antes.email ? email : null, id);

    const nombre = partirNombre(dto.name);
    const dni = dto.dni === undefined ? antes.dni : dto.dni || null;
    const perfilAntes = antes.appointmentProfile;
    const perfil = {
      note: dto.note === undefined ? perfilAntes?.note ?? null : dto.note || null,
      insuranceName: dto.insuranceName === undefined ? perfilAntes?.insuranceName ?? null : dto.insuranceName || null,
      insuranceNumber: dto.insuranceNumber === undefined ? perfilAntes?.insuranceNumber ?? null : dto.insuranceNumber || null,
    };

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.customer.updateMany({ where: { id, businessId, deletedAt: null }, data: { ...nombre, phone, email, dni } });
      if (count === 0) throw new NotFoundException('Cliente no encontrado');
      await tx.appointmentCustomerProfile.upsert({
        where: { customerId: id },
        create: { businessId, customerId: id, ...perfil },
        update: perfil,
      });
    });

    const cambios = AuditService.diferencias(
      { name: nombreDe(antes), phone: antes.phone, email: antes.email, note: perfilAntes?.note ?? null },
      { name: nombreDe(nombre), phone, email, note: perfil.note },
      ['name', 'phone', 'email', 'note'],
    );
    // Obra social y DNI son datos sensibles: al registro va que cambiaron, no el valor.
    for (const [campo, a, d] of [
      ['insurance', `${perfilAntes?.insuranceName ?? ''}|${perfilAntes?.insuranceNumber ?? ''}`, `${perfil.insuranceName ?? ''}|${perfil.insuranceNumber ?? ''}`],
      ['dni', antes.dni ?? '', dni ?? ''],
    ] as const) {
      if (a !== d) cambios.push({ field: campo, before: null, after: 'cambió' });
    }
    if (cambios.length > 0) {
      await this.audit?.registrar({ businessId, memberId: member.memberId, entityType: 'customer', entityId: id, action: 'UPDATE', changes: cambios });
    }
    return this.ficha(member, id, ahora);
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  private aDto(member: MemberContext, c: ClienteConPerfil, s: Estadistica | undefined): ClienteDto {
    return {
      id: c.id,
      name: nombreDe(c),
      ...contactoSegun(member, c.phone, c.email),
      hasAccount: !!(c.passwordHash || c.googleId),
      visits: s?.visits ?? 0,
      lastVisit: s?.lastVisit ? fechaArgentina(s.lastVisit) : null,
      spent: montoSegun(member, s?.spent ?? 0),
      noShows: c.appointmentProfile?.noShowCount ?? 0,
      note: c.appointmentProfile?.note ?? null,
      insuranceName: c.appointmentProfile?.insuranceName ?? null,
    };
  }

  private telefono(valor: string | null | undefined): string | null {
    if (!valor) return null;
    const d = normalizarTelefono(valor);
    if (d.length < 8) throw new BadRequestException('El teléfono tiene que tener al menos 8 dígitos.');
    return d;
  }

  private async assertNoRepetido(businessId: string, phone: string | null, email: string | null, exceptoId?: string) {
    const otro = exceptoId ? { id: { not: exceptoId } } : {};
    if (phone) {
      const c = await this.prisma.customer.findFirst({ where: { businessId, phone, deletedAt: null, ...otro }, select: { firstName: true, lastName: true } });
      if (c) throw new BadRequestException(`Ya tenés un cliente con ese teléfono: ${nombreDe(c)}.`);
    }
    if (email) {
      const c = await this.prisma.customer.findFirst({ where: { businessId, email, ...otro }, select: { firstName: true, lastName: true } });
      if (c) throw new BadRequestException(`Ya tenés un cliente con ese email: ${nombreDe(c)}.`);
    }
  }

  private async clienteVisible(member: MemberContext, id: string, propias: string[] | null): Promise<ClienteConPerfil> {
    const c = await this.prisma.customer.findFirst({
      where: { id, businessId: member.businessId, deletedAt: null },
      include: { appointmentProfile: true },
    });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    if (propias && !(await this.idsEnAlcance(member.businessId, propias, id)).includes(id)) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return c;
  }

  /** Clientes con algún turno o inscripción no cancelados en esas agendas. */
  private async idsEnAlcance(businessId: string, propias: string[], soloId?: string): Promise<string[]> {
    if (propias.length === 0) return [];
    const cliente = soloId ? { customerId: soloId } : { customerId: { not: null } };
    const [turnos, inscripciones] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { businessId, resourceId: { in: propias }, status: { not: 'CANCELLED' }, ...cliente },
        select: { customerId: true },
        distinct: ['customerId'],
      }),
      this.prisma.appointmentClassEnrollment.findMany({
        where: {
          businessId, status: { not: 'CANCELLED' }, ...cliente,
          session: { template: { OR: [{ instructorResourceId: { in: propias } }, { roomResourceId: { in: propias } }] } },
        },
        select: { customerId: true },
        distinct: ['customerId'],
      }),
    ]);
    return [...new Set([...turnos, ...inscripciones].map((x) => x.customerId).filter((x): x is string => !!x))];
  }

  /** Clientes cuyo nombre (sin acentos, sin mayúsculas) o teléfono contiene lo buscado. */
  private async idsPorTexto(businessId: string, q: string): Promise<string[]> {
    const texto = sinAcentos(q.trim().toLowerCase());
    const digitos = q.replace(/\D/g, '');
    const porTelefono = digitos.length >= 3
      ? Prisma.sql`OR position(${digitos} in regexp_replace(coalesce(phone, ''), ${'[^0-9]'}, '', 'g')) > 0`
      : Prisma.empty;
    const filas = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM customers
      WHERE business_id = ${businessId} AND deleted_at IS NULL
        AND (position(${texto} in translate(lower(first_name || ' ' || coalesce(last_name, '')), ${CON_ACENTO}, ${SIN_ACENTO})) > 0
             ${porTelefono})`;
    return filas.map((f) => f.id);
  }

  /** Visitas de todos los clientes del negocio: turnos atendidos + clases con asistencia. */
  private async visitasDeTodos(businessId: string): Promise<Map<string, number>> {
    const [turnos, clases] = await Promise.all([
      this.prisma.appointment.groupBy({ by: ['customerId'], where: { businessId, status: 'COMPLETED', customerId: { not: null } }, _count: { _all: true } }),
      this.prisma.appointmentClassEnrollment.groupBy({ by: ['customerId'], where: { businessId, attended: true, customerId: { not: null } }, _count: { _all: true } }),
    ]);
    const m = new Map<string, number>();
    for (const f of [...turnos, ...clases]) if (f.customerId) m.set(f.customerId, (m.get(f.customerId) ?? 0) + f._count._all);
    return m;
  }

  private async estadisticas(businessId: string, ids: string[]): Promise<Map<string, Estadistica>> {
    const m = new Map<string, Estadistica>();
    if (ids.length === 0) return m;
    const [turnos, clases] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['customerId'],
        where: { businessId, status: 'COMPLETED', customerId: { in: ids } },
        _count: { _all: true },
        _max: { startsAt: true },
        _sum: { price: true, discountAmount: true },
      }),
      this.prisma.appointmentClassEnrollment.findMany({
        where: { businessId, attended: true, customerId: { in: ids } },
        select: { customerId: true, session: { select: { startsAt: true } } },
      }),
    ]);
    const mas = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);
    for (const t of turnos) {
      if (!t.customerId) continue;
      m.set(t.customerId, { visits: t._count._all, lastVisit: t._max.startsAt, spent: pesos(Number(t._sum.price ?? 0) - Number(t._sum.discountAmount ?? 0)) });
    }
    for (const e of clases) {
      if (!e.customerId) continue;
      const s = m.get(e.customerId) ?? { visits: 0, lastVisit: null, spent: 0 };
      m.set(e.customerId, { ...s, visits: s.visits + 1, lastVisit: mas(s.lastVisit, e.session.startsAt) });
    }
    return m;
  }
}
