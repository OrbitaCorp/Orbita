import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { MemberContext } from '../../../common/types/auth-context.type';
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import type { PackCompradoDto, PaqueteDto, Paginado } from '../../appointments.types';
import { ClienteResuelto, resolverCliente } from '../comun/clientes';
import { COBRO_ONLINE_TURNOS, CobroOnlineTurnos, sitioDe } from '../comun/cobro-online';
import { AvanzadoContextoService, Db, exigirPermiso } from '../comun/contexto.service';
import { aNumero } from '../comun/dinero';
import { CompradorPublicoDto } from '../comun/dtos-comunes';
import { paginacion } from '../comun/paginado';
import { normalizarTelefonoBasico } from '../comun/telefono';
import { bloquear, enTransaccion } from '../comun/transacciones';
import { ListPurchasesQuery, SellPackageDto, UpsertPackageDto } from './dto/paquetes.dto';

const DIA_MS = 24 * 3600 * 1000;
/** Turnos e inscripciones que "tienen reservada" una sesión del pack. */
const TURNOS_ACTIVOS = ['PENDING', 'CONFIRMED'] as const;
const INSCRIPCIONES_ACTIVAS = ['ENROLLED', 'WAITLIST'] as const;

type CompraConPaquete = Prisma.AppointmentPackagePurchaseGetPayload<{ include: { package: { include: { service: { select: { name: true } } } } } }>;

const compraADto = (c: CompraConPaquete): PackCompradoDto => ({
  id: c.id,
  packageId: c.packageId,
  serviceName: c.package.service.name,
  customerName: c.customerName,
  sessionsTotal: c.sessionsTotal,
  sessionsUsed: c.sessionsUsed,
  paid: !!c.paidAt,
  expiresAt: c.expiresAt?.toISOString() ?? null,
});

export interface CanjePaquete {
  packagePurchaseId: string;
  /** Sesiones que le quedan libres DESPUÉS de este turno. */
  sessionsLeft: number;
}

/**
 * Paquetes y bonos (P4.1). Además del CRUD y la venta, exporta lo que se
 * enchufa en la reserva y en los cambios de estado del turno:
 *
 * - `canjearSesionDePaquete`: al reservar con `packagePurchaseId`. Valida y
 *   reserva la sesión (bajo lock). La sesión queda "tomada" por el turno
 *   activo que guarda `packagePurchaseId`: el lugar libre se cuenta como
 *   `sessionsTotal - sessionsUsed - turnos activos con ese pack`.
 * - `consumirSesionDePaquete`: al pasar el turno a COMPLETED o NO_SHOW
 *   (`sessionsUsed + 1`, una sola vez: lo llama la transición, que es final).
 * - `devolverSesionDePaquete`: al cancelar. A tiempo la sesión se libera sola
 *   (el turno deja de estar activo); fuera de plazo se pierde (= consumir).
 */
@Injectable()
export class PaquetesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: AvanzadoContextoService,
    private readonly audit: AuditService,
    @Inject(COBRO_ONLINE_TURNOS) private readonly cobro: CobroOnlineTurnos,
  ) {}

  // ── Catálogo ─────────────────────────────────────────────────────────────

  async listar(businessId: string): Promise<PaqueteDto[]> {
    await this.contexto.delNegocio(businessId);
    const paquetes = await this.prisma.appointmentPackage.findMany({
      where: { businessId, deletedAt: null },
      include: { service: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const vendidos = await this.prisma.appointmentPackagePurchase.groupBy({
      by: ['packageId'],
      where: { businessId, paidAt: { not: null } },
      _count: { _all: true },
    });
    const porPaquete = new Map(vendidos.map((v) => [v.packageId, v._count._all]));
    return paquetes.map((p) => ({
      id: p.id, serviceId: p.serviceId, serviceName: p.service.name, sessions: p.sessions, price: aNumero(p.price),
      validDays: p.validDays, isActive: p.isActive, sold: porPaquete.get(p.id) ?? 0,
    }));
  }

  async crear(businessId: string, memberId: string, dto: UpsertPackageDto): Promise<PaqueteDto> {
    await this.contexto.delNegocio(businessId);
    const servicio = await this.servicioDelNegocio(businessId, dto.serviceId);
    const p = await this.prisma.appointmentPackage.create({
      data: { businessId, serviceId: dto.serviceId, sessions: dto.sessions, price: dto.price, validDays: dto.validDays, isActive: dto.isActive ?? true },
    });
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_package', entityId: p.id, action: 'CREATE' });
    return { id: p.id, serviceId: p.serviceId, serviceName: servicio.name, sessions: p.sessions, price: aNumero(p.price), validDays: p.validDays, isActive: p.isActive, sold: 0 };
  }

  async editar(businessId: string, memberId: string, id: string, dto: UpsertPackageDto): Promise<PaqueteDto> {
    await this.contexto.delNegocio(businessId);
    const antes = await this.prisma.appointmentPackage.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!antes) throw new NotFoundException('Ese paquete no existe.');
    await this.servicioDelNegocio(businessId, dto.serviceId);
    const data = { serviceId: dto.serviceId, sessions: dto.sessions, price: new Prisma.Decimal(dto.price), validDays: dto.validDays, isActive: dto.isActive ?? antes.isActive };
    const { count } = await this.prisma.appointmentPackage.updateMany({ where: { id, businessId, deletedAt: null }, data });
    if (count === 0) throw new NotFoundException('Ese paquete no existe.');
    // Las compras ya hechas no cambian: guardan sus sesiones, su precio y su vencimiento.
    await this.audit.registrar({
      businessId, memberId, entityType: 'appointment_package', entityId: id, action: 'UPDATE',
      changes: AuditService.diferencias(antes, { ...antes, ...data }, ['serviceId', 'sessions', 'price', 'validDays', 'isActive']),
    });
    return (await this.listar(businessId)).find((p) => p.id === id)!;
  }

  async borrar(businessId: string, memberId: string, id: string): Promise<{ ok: true }> {
    await this.contexto.delNegocio(businessId);
    // Soft-delete: las compras hechas siguen andando hasta que se usen o venzan.
    const { count } = await this.prisma.appointmentPackage.updateMany({ where: { id, businessId, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } });
    if (count === 0) throw new NotFoundException('Ese paquete no existe.');
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_package', entityId: id, action: 'DELETE' });
    return { ok: true };
  }

  // ── Compras ──────────────────────────────────────────────────────────────

  async listarCompras(businessId: string, q: ListPurchasesQuery): Promise<Paginado<PackCompradoDto>> {
    await this.contexto.delNegocio(businessId);
    const { page, limit, skip } = paginacion(q);
    const where: Prisma.AppointmentPackagePurchaseWhereInput = { businessId, ...(q.customerId ? { customerId: q.customerId } : {}) };
    if (q.active === 'true') {
      Object.assign(where, {
        paidAt: { not: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        sessionsUsed: { lt: this.prisma.appointmentPackagePurchase.fields.sessionsTotal },
      });
    }
    const [total, filas] = await Promise.all([
      this.prisma.appointmentPackagePurchase.count({ where }),
      this.prisma.appointmentPackagePurchase.findMany({
        where, include: { package: { include: { service: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
    ]);
    return { data: filas.map(compraADto), total, page, limit };
  }

  /** Venta en el local: la compra nace paga, con su AppointmentPayment PACKAGE APPROVED. */
  async vender(member: MemberContext, dto: SellPackageDto): Promise<PackCompradoDto> {
    const { businessId, memberId } = member;
    exigirPermiso(member, 'appointments.cash.charge');
    const negocio = await this.contexto.delNegocio(businessId);
    this.contexto.exigirPrendida(negocio.settings, 'paquetes');
    const paquete = await this.paqueteVendible(businessId, dto.packageId);

    const compra = await this.prisma.$transaction(async (tx) => {
      const cliente = await resolverCliente(tx, businessId, dto);
      const ahora = new Date();
      const c = await tx.appointmentPackagePurchase.create({
        data: this.datosCompra(businessId, paquete, cliente, ahora, ahora),
        include: { package: { include: { service: { select: { name: true } } } } },
      });
      await tx.appointmentPayment.create({
        data: {
          businessId, kind: 'PACKAGE', packagePurchaseId: c.id, method: dto.method, status: 'APPROVED',
          amount: paquete.price, paidAt: ahora, registeredByMemberId: memberId,
        },
      });
      return c;
    });
    await this.audit.registrar({
      businessId, memberId, entityType: 'appointment_package_purchase', entityId: compra.id, action: 'CREATE',
      changes: [{ field: 'pricePaid', before: null, after: compra.pricePaid }, { field: 'method', before: null, after: dto.method }],
    });
    return compraADto(compra);
  }

  // ── Sitio público ────────────────────────────────────────────────────────

  /** Paquetes que se ofrecen en el sitio: [] si la función no actúa (sin add-on o apagada). */
  async listarPublicos(businessId: string): Promise<Omit<PaqueteDto, 'sold'>[]> {
    const { on } = await this.contexto.activa(businessId, 'paquetes');
    if (!on) return [];
    const paquetes = await this.prisma.appointmentPackage.findMany({
      where: { businessId, deletedAt: null, isActive: true, service: { deletedAt: null, isActive: true } },
      include: { service: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return paquetes.map((p) => ({ id: p.id, serviceId: p.serviceId, serviceName: p.service.name, sessions: p.sessions, price: aNumero(p.price), validDays: p.validDays, isActive: true }));
  }

  /**
   * Compra desde el sitio: crea la compra SIN pagar + el pago PENDING y la
   * preferencia de MP. `paidAt` lo pone el webhook (AvanzadoPagosService).
   * Con sesión de cliente de este negocio, la compra queda en su ficha.
   */
  async comprarPublico(businessId: string, packageId: string, dto: CompradorPublicoDto, customerIdSesion: string | null) {
    const { on, negocio } = await this.contexto.activa(businessId, 'paquetes');
    if (!on || !negocio.isActive || negocio.isPaused) throw new NotFoundException('Ese paquete no existe.');
    const paquete = await this.paqueteVendible(businessId, packageId);
    const paymentId = randomUUID();
    const purchaseId = randomUUID();
    const amount = aNumero(paquete.price);
    const pref = await this.cobro.crearPreferencia({
      businessId, paymentId, amount,
      title: `Pack de ${paquete.sessions} sesiones · ${paquete.service.name}`,
      volverA: `${sitioDe(negocio.subdomain)}/paquetes?compra=${purchaseId}`,
    });
    if (!pref) throw new BadRequestException('Este negocio no cobra online. Coordiná el pago con ellos.');

    await this.prisma.$transaction(async (tx) => {
      const cliente = customerIdSesion
        ? await resolverCliente(tx, businessId, { customerId: customerIdSesion })
        : await resolverCliente(tx, businessId, { customer: { name: dto.name, phone: dto.phone, email: dto.email } });
      await tx.appointmentPackagePurchase.create({
        data: { id: purchaseId, ...this.datosCompra(businessId, paquete, { ...cliente, name: cliente.name || dto.name, phone: cliente.phone || normalizarTelefonoBasico(dto.phone) }, null, new Date()) },
      });
      await tx.appointmentPayment.create({
        data: {
          id: paymentId, businessId, kind: 'PACKAGE', packagePurchaseId: purchaseId, method: 'MERCADOPAGO', status: 'PENDING',
          amount: paquete.price, mpPreferenceId: pref.preferenceId,
        },
      });
    });
    return { purchaseId, payment: { paymentId, amount, initPoint: pref.initPoint } };
  }

  // ── Para enchufar en la reserva ──────────────────────────────────────────

  /**
   * Valida que el turno se pueda pagar con este pack y lo reserva bajo lock.
   * Llamarlo ADENTRO de la transacción que crea el turno (con su `tx`) y
   * guardar `packagePurchaseId` en el turno: así dos reservas simultáneas no
   * usan la última sesión dos veces. `aPagar` del turno pasa a 0 y no hay seña.
   */
  async canjearSesionDePaquete(
    p: { businessId: string; packagePurchaseId: string; customerId: string | null; serviceId: string; startsAt: Date },
    tx?: Db,
  ): Promise<CanjePaquete> {
    return enTransaccion(this.prisma, tx, async (t) => {
      const { on } = await this.contexto.activa(p.businessId, 'paquetes', t);
      if (!on) throw new BadRequestException('Este negocio no acepta paquetes ahora.');
      // Fuera de alcance por ahora (CONTRATO § P4.1): un pack se usa solo con cuenta.
      if (!p.customerId) throw new BadRequestException('Iniciá sesión para usar tu paquete.');
      await bloquear(t, `appt-pack:${p.packagePurchaseId}`);
      const compra = await t.appointmentPackagePurchase.findFirst({
        where: { id: p.packagePurchaseId, businessId: p.businessId, customerId: p.customerId },
        include: { package: { select: { serviceId: true } } },
      });
      if (!compra) throw new NotFoundException('Ese paquete no existe.');
      if (compra.package.serviceId !== p.serviceId) throw new BadRequestException('Ese paquete es de otro servicio.');
      if (!compra.paidAt) throw new BadRequestException('Ese paquete todavía no está pago.');
      if (compra.expiresAt && compra.expiresAt.getTime() <= p.startsAt.getTime()) {
        throw new BadRequestException(`Ese paquete vence el ${fechaArgentina(compra.expiresAt)}: no cubre un turno de después.`);
      }
      const enUso = await this.sesionesEnUso(t, p.businessId, compra.id);
      const libres = compra.sessionsTotal - compra.sessionsUsed - enUso;
      if (libres <= 0) throw new ConflictException('Ese paquete ya no tiene sesiones libres.');
      return { packagePurchaseId: compra.id, sessionsLeft: libres - 1 };
    });
  }

  /** Turno atendido o ausente: la sesión se gasta. false si el pack ya estaba completo. */
  async consumirSesionDePaquete(businessId: string, packagePurchaseId: string, tx: Db = this.prisma): Promise<boolean> {
    const { count } = await tx.appointmentPackagePurchase.updateMany({
      where: { id: packagePurchaseId, businessId, sessionsUsed: { lt: this.prisma.appointmentPackagePurchase.fields.sessionsTotal } },
      data: { sessionsUsed: { increment: 1 } },
    });
    return count > 0;
  }

  /**
   * Turno cancelado. A tiempo la sesión vuelve sola (el turno ya no está
   * activo, no hay nada que escribir); fuera de plazo se pierde.
   */
  async devolverSesionDePaquete(
    businessId: string, packagePurchaseId: string, opciones: { aTiempo: boolean }, tx: Db = this.prisma,
  ): Promise<{ liberada: boolean }> {
    if (opciones.aTiempo) return { liberada: true };
    await this.consumirSesionDePaquete(businessId, packagePurchaseId, tx);
    return { liberada: false };
  }

  /** Los packs pagos, vigentes y con sesiones libres de un cliente (para "Mis turnos" y la ficha). */
  async packsDelCliente(businessId: string, customerId: string, tx: Db = this.prisma): Promise<PackCompradoDto[]> {
    const compras = await tx.appointmentPackagePurchase.findMany({
      where: { businessId, customerId, paidAt: { not: null }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { package: { include: { service: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return compras.filter((c) => c.sessionsUsed < c.sessionsTotal).map(compraADto);
  }

  // ── Internos ─────────────────────────────────────────────────────────────

  private async sesionesEnUso(tx: Db, businessId: string, packagePurchaseId: string): Promise<number> {
    const [turnos, clases] = await Promise.all([
      tx.appointment.count({ where: { businessId, packagePurchaseId, status: { in: [...TURNOS_ACTIVOS] } } }),
      tx.appointmentClassEnrollment.count({ where: { businessId, packagePurchaseId, status: { in: [...INSCRIPCIONES_ACTIVAS] } } }),
    ]);
    return turnos + clases;
  }

  private async servicioDelNegocio(businessId: string, serviceId: string) {
    const s = await this.prisma.appointmentService.findFirst({ where: { id: serviceId, businessId, deletedAt: null }, select: { id: true, name: true } });
    if (!s) throw new BadRequestException('Ese servicio no existe.');
    return s;
  }

  private async paqueteVendible(businessId: string, id: string) {
    const p = await this.prisma.appointmentPackage.findFirst({
      where: { id, businessId, deletedAt: null, isActive: true },
      include: { service: { select: { name: true, deletedAt: true } } },
    });
    if (!p || p.service.deletedAt) throw new NotFoundException('Ese paquete no existe.');
    return p;
  }

  private datosCompra(
    businessId: string,
    paquete: { id: string; sessions: number; price: Prisma.Decimal; validDays: number },
    cliente: Pick<ClienteResuelto, 'id' | 'name' | 'phone'>,
    paidAt: Date | null,
    desde: Date,
  ) {
    return {
      businessId, packageId: paquete.id, customerId: cliente.id, customerName: cliente.name.slice(0, 120), customerPhone: cliente.phone.slice(0, 40),
      sessionsTotal: paquete.sessions, pricePaid: paquete.price, paidAt,
      // El vencimiento corre desde la compra (en el sitio se corrige al aprobarse el pago).
      expiresAt: paquete.validDays > 0 ? new Date(desde.getTime() + paquete.validDays * DIA_MS) : null,
    };
  }
}
