import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { MemberContext } from '../../common/types/auth-context.type';
import { PrismaService } from '../../prisma/prisma.service';
import type { RecursoDto } from '../appointments.types';
import { ESTADOS_ACTIVOS } from '../appointments.types';
import { errorSemana, leerSemana } from '../horarios/horarios';
import { AppointmentsSettingsService } from './appointments-settings.service';
import { ListResourcesQueryDto, UpsertSpaceDto } from './dto/resources.dto';
import { agendasPropias } from './lib/permisos';
import { recursoDto } from './lib/serializar';

const CAMPOS_AUDITADOS = ['name', 'roleLabel', 'color', 'workDays', 'ownSchedule', 'isActive'];

/**
 * Agendas (CONTRATO.md § P1.3). El GET lista personas y espacios; las
 * escrituras son solo de ESPACIOS (canchas, cabinas, consultorios, salas):
 * las personas se crean y editan en Equipo (P3). Soft-delete.
 */
@Injectable()
export class AppointmentResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppointmentsSettingsService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async listar(member: MemberContext, q: ListResourcesQueryDto): Promise<RecursoDto[]> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const propias = await agendasPropias(this.prisma, member, 'appointments.agenda.view_all');
    const filas = await this.prisma.appointmentResource.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.bookable ? { isBookable: true, isActive: true } : {}),
        ...(propias === null ? {} : { id: { in: propias } }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return filas.map(recursoDto);
  }

  async crear(member: MemberContext, dto: UpsertSpaceDto): Promise<RecursoDto> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const ownSchedule = this.semanaPropia(dto.ownSchedule);
    const ultimo = await this.prisma.appointmentResource.aggregate({ where: { businessId, deletedAt: null }, _max: { sortOrder: true } });
    const creado = await this.prisma.appointmentResource.create({
      data: {
        businessId,
        kind: 'SPACE',
        name: dto.name.trim(),
        roleLabel: dto.roleLabel?.trim() || null,
        color: dto.color ?? null,
        workDays: [...dto.workDays].sort((a, b) => a - b),
        ownSchedule: ownSchedule ?? Prisma.DbNull,
        isActive: dto.isActive ?? true,
        isBookable: true,
        sortOrder: (ultimo._max.sortOrder ?? -1) + 1,
      },
    });
    await this.audit?.registrar({
      businessId, memberId: member.memberId, entityType: 'appointment_resource', entityId: creado.id, action: 'CREATE',
      changes: AuditService.diferencias({}, creado as unknown as Record<string, unknown>, CAMPOS_AUDITADOS),
    });
    return recursoDto(creado);
  }

  async actualizar(member: MemberContext, id: string, dto: UpsertSpaceDto): Promise<RecursoDto> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const antes = await this.buscarEspacio(businessId, id);
    const ownSchedule = dto.ownSchedule === undefined ? undefined : this.semanaPropia(dto.ownSchedule);
    const n = await this.prisma.appointmentResource.updateMany({
      where: { id, businessId, kind: 'SPACE', deletedAt: null },
      data: {
        name: dto.name.trim(),
        roleLabel: dto.roleLabel === undefined ? undefined : dto.roleLabel?.trim() || null,
        color: dto.color === undefined ? undefined : dto.color,
        workDays: [...dto.workDays].sort((a, b) => a - b),
        ...(ownSchedule === undefined ? {} : { ownSchedule: ownSchedule ?? Prisma.DbNull }),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      },
    });
    if (n.count === 0) throw new NotFoundException('Ese espacio no existe.');
    const despues = await this.buscarEspacio(businessId, id);
    const cambios = AuditService.diferencias(antes as unknown as Record<string, unknown>, despues as unknown as Record<string, unknown>, CAMPOS_AUDITADOS);
    if (cambios.length > 0) {
      await this.audit?.registrar({ businessId, memberId: member.memberId, entityType: 'appointment_resource', entityId: id, action: 'UPDATE', changes: cambios });
    }
    return recursoDto(despues);
  }

  async borrar(member: MemberContext, id: string, ahora = new Date()): Promise<{ ok: true }> {
    const businessId = member.businessId;
    await this.settings.delNegocio(businessId);
    const espacio = await this.buscarEspacio(businessId, id);
    const porDelante = await this.prisma.appointment.count({
      where: { businessId, resourceId: id, status: { in: ESTADOS_ACTIVOS }, startsAt: { gte: ahora } },
    });
    if (porDelante > 0) {
      throw new BadRequestException(`Tiene ${porDelante} ${porDelante === 1 ? 'turno' : 'turnos'} por delante. Movelos o cancelalos antes de borrarla.`);
    }
    await this.prisma.$transaction(async (tx) => {
      const n = await tx.appointmentResource.updateMany({ where: { id, businessId, kind: 'SPACE', deletedAt: null }, data: { deletedAt: ahora, isActive: false } });
      if (n.count === 0) throw new NotFoundException('Ese espacio no existe.');
      // Quien trabajaba en ese espacio (modo RESOURCE) queda sin espacio asignado.
      await tx.appointmentResource.updateMany({ where: { businessId, assignedSpaceId: id }, data: { assignedSpaceId: null } });
    });
    await this.audit?.registrar({ businessId, memberId: member.memberId, entityType: 'appointment_resource', entityId: id, action: 'DELETE', changes: [{ field: 'name', before: espacio.name, after: null }] });
    return { ok: true };
  }

  /** Solo espacios: una persona por este camino es 404 (se edita en Equipo). */
  private async buscarEspacio(businessId: string, id: string) {
    const r = await this.prisma.appointmentResource.findFirst({ where: { id, businessId, kind: 'SPACE', deletedAt: null } });
    if (!r) throw new NotFoundException('Ese espacio no existe.');
    return r;
  }

  private semanaPropia(valor: unknown[] | null | undefined): Prisma.InputJsonValue | null {
    if (valor === null || valor === undefined) return null;
    const error = errorSemana(valor);
    if (error) throw new BadRequestException(error);
    return leerSemana(valor) as unknown as Prisma.InputJsonValue;
  }
}
