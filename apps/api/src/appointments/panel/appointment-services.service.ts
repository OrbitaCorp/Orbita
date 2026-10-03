import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import type { MemberContext } from '../../common/types/auth-context.type';
import { PrismaService } from '../../prisma/prisma.service';
import type { ServicioDto } from '../appointments.types';
import { AppointmentsSettingsService } from './appointments-settings.service';
import { UpsertServiceDto } from './dto/services.dto';
import { normalizarNombre, num, servicioDto } from './lib/serializar';

const CAMPOS_AUDITADOS = ['name', 'description', 'durationMin', 'price', 'bookableOnline', 'isActive'];

/** Servicios de un negocio de Turnos (CONTRATO.md § P1.2). Soft-delete: los turnos ya dados conservan `serviceName`. */
@Injectable()
export class AppointmentServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppointmentsSettingsService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async listar(businessId: string, incluirInactivos = false): Promise<ServicioDto[]> {
    await this.settings.delNegocio(businessId);
    const filas = await this.prisma.appointmentService.findMany({
      where: { businessId, deletedAt: null, ...(incluirInactivos ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return filas.map(servicioDto);
  }

  async crear(member: MemberContext, dto: UpsertServiceDto): Promise<ServicioDto> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    await this.exigirNombreLibre(businessId, dto.name);
    // Va al final de la lista.
    const ultimo = await this.prisma.appointmentService.aggregate({ where: { businessId, deletedAt: null }, _max: { sortOrder: true } });
    const creado = await this.prisma.appointmentService.create({
      data: {
        businessId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        durationMin: dto.durationMin,
        price: dto.price,
        bookableOnline: dto.bookableOnline,
        isActive: dto.isActive ?? true,
        sortOrder: (ultimo._max.sortOrder ?? -1) + 1,
      },
    });
    await this.audit?.registrar({
      businessId, memberId: member.memberId, entityType: 'appointment_service', entityId: creado.id, action: 'CREATE',
      changes: AuditService.diferencias({}, { ...creado, price: num(creado.price) }, CAMPOS_AUDITADOS),
    });
    return servicioDto(creado);
  }

  async actualizar(member: MemberContext, id: string, dto: UpsertServiceDto): Promise<ServicioDto> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const antes = await this.buscar(businessId, id);
    await this.exigirNombreLibre(businessId, dto.name, id);
    const data = {
      name: dto.name.trim(),
      description: dto.description === undefined ? antes.description : dto.description?.trim() || null,
      durationMin: dto.durationMin,
      price: dto.price,
      bookableOnline: dto.bookableOnline,
      isActive: dto.isActive ?? antes.isActive,
    };
    const n = await this.prisma.appointmentService.updateMany({ where: { id, businessId, deletedAt: null }, data });
    if (n.count === 0) throw new NotFoundException('Ese servicio no existe.');
    const despues = await this.buscar(businessId, id);
    const cambios = AuditService.diferencias({ ...antes, price: num(antes.price) }, { ...despues, price: num(despues.price) }, CAMPOS_AUDITADOS);
    if (cambios.length > 0) {
      await this.audit?.registrar({ businessId, memberId: member.memberId, entityType: 'appointment_service', entityId: id, action: 'UPDATE', changes: cambios });
    }
    return servicioDto(despues);
  }

  /** El orden de la lista: `ids` en el orden nuevo. Tienen que ser servicios (no borrados) de este negocio. */
  async ordenar(member: MemberContext, ids: string[]): Promise<ServicioDto[]> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const existentes = await this.prisma.appointmentService.count({ where: { businessId, deletedAt: null, id: { in: ids } } });
    if (existentes !== ids.length) throw new BadRequestException('Hay servicios en la lista que no existen.');
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.appointmentService.updateMany({ where: { id, businessId, deletedAt: null }, data: { sortOrder: i } })),
    );
    await this.audit?.registrar({ businessId, memberId: member.memberId, entityType: 'appointment_service', entityId: ids[0] ?? businessId, action: 'UPDATE', changes: [{ field: 'sortOrder', before: null, after: ids }] });
    return this.listar(businessId, true);
  }

  async borrar(member: MemberContext, id: string): Promise<{ ok: true }> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const servicio = await this.buscar(businessId, id);
    const [clases, paquetes] = await Promise.all([
      this.prisma.appointmentClassTemplate.count({ where: { businessId, serviceId: id, isActive: true, deletedAt: null } }),
      this.prisma.appointmentPackage.count({ where: { businessId, serviceId: id, isActive: true, deletedAt: null } }),
    ]);
    if (clases > 0) throw new BadRequestException(`Ese servicio se usa en ${clases} ${clases === 1 ? 'clase' : 'clases'} de la grilla. Sacalo de ahí primero.`);
    if (paquetes > 0) throw new BadRequestException(`Ese servicio se usa en ${paquetes} ${paquetes === 1 ? 'paquete activo' : 'paquetes activos'}. Sacalo de ahí primero.`);
    const n = await this.prisma.appointmentService.updateMany({ where: { id, businessId, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } });
    if (n.count === 0) throw new NotFoundException('Ese servicio no existe.');
    await this.audit?.registrar({ businessId, memberId: member.memberId, entityType: 'appointment_service', entityId: id, action: 'DELETE', changes: [{ field: 'name', before: servicio.name, after: null }] });
    return { ok: true };
  }

  private async buscar(businessId: string, id: string) {
    const s = await this.prisma.appointmentService.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!s) throw new NotFoundException('Ese servicio no existe.');
    return s;
  }

  /** Nombre repetido entre los no borrados, sin distinguir mayúsculas ni acentos. */
  private async exigirNombreLibre(businessId: string, nombre: string, salvo?: string): Promise<void> {
    const otros = await this.prisma.appointmentService.findMany({
      where: { businessId, deletedAt: null, ...(salvo ? { id: { not: salvo } } : {}) },
      select: { name: true },
    });
    const buscado = normalizarNombre(nombre);
    if (otros.some((o) => normalizarNombre(o.name) === buscado)) throw new BadRequestException('Ya tenés un servicio con ese nombre.');
  }
}
