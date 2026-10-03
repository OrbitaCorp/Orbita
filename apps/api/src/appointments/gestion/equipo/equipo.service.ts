import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AppointmentAgendaMode } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { MembersService } from '../../../members/members.service';
import type { MemberContext } from '../../../common/types/auth-context.type';
import type { PersonaDto } from '../../appointments.types';
import { diasAbiertos, errorSemana, leerSemana } from '../../horarios/horarios';
import { esDueno, tiene } from '../comun/alcance';
import { GestionContextoService } from '../comun/contexto.service';
import { formaDePagoDto } from '../ganancias/liquidacion';
import type { InvitePersonDto, PayFormDto, UpsertPersonDto } from './dto/equipo.dto';
import { assertNoEsRolDeDueno, assertPuedeDar } from './escalada';
import { COLORES_EQUIPO, formasDe, pagoInicialDe } from './pago';

const personaInclude = {
  member: { select: { id: true, email: true, status: true, roleId: true, role: { select: { name: true } } } },
} satisfies Prisma.AppointmentResourceInclude;

type PersonaFila = Prisma.AppointmentResourceGetPayload<{ include: typeof personaInclude }>;

const esDeDueno = (r: PersonaFila) => r.member?.role.name === 'owner';

/**
 * Equipo de Turnos (CONTRATO § P3.3). Reutiliza `members` (MembersService:
 * invitar con el mismo mail y la misma contraseña temporal, cambiar el rol,
 * sacar a alguien) y guarda lo propio de Turnos —la agenda y cómo cobra— en
 * `appointment_resources` con `kind = PERSON`.
 */
@Injectable()
export class EquipoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: GestionContextoService,
    private readonly members: MembersService,
    private readonly audit?: AuditService,
  ) {}

  async listar(member: MemberContext): Promise<PersonaDto[]> {
    await this.ctx.delNegocio(member.businessId);
    const todo = tiene(member, 'appointments.agenda.view_all');
    const filas = await this.prisma.appointmentResource.findMany({
      where: { businessId: member.businessId, kind: 'PERSON', deletedAt: null, ...(todo ? {} : { memberId: member.memberId }) },
      include: personaInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return filas.map((r) => this.aDto(member, r));
  }

  async invitar(member: MemberContext, dto: InvitePersonDto): Promise<{ person: PersonaDto; tempPassword?: string }> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const rol = await this.rolDelNegocio(businessId, dto.roleId);
    assertNoEsRolDeDueno(member, rol);
    assertPuedeDar(member, rol.permisos);

    // MembersService: mismo mail, misma contraseña temporal y mismo vencimiento que Tienda.
    const invitado = await this.members.invite(businessId, member.roleName, { name: dto.name, email: dto.email, roleId: dto.roleId }, member.memberId);
    let recurso: PersonaFila;
    try {
      recurso = await this.prisma.appointmentResource.create({
        data: {
          businessId,
          kind: 'PERSON',
          name: dto.name,
          memberId: invitado.id,
          isBookable: rol.takesAppointments,
          roleLabel: rol.name,
          workDays: this.diasQueAbre(settings.weekSchedule),
          color: await this.colorLibre(businessId),
          ...pagoInicialDe(settings.agendaMode, rol.name === 'owner'),
        },
        include: personaInclude,
      });
    } catch (err) {
      // Sin la agenda la invitación queda a medias: se deshace el miembro (el
      // mail ya salió, pero el enlace deja de servir).
      await this.prisma.member.deleteMany({ where: { id: invitado.id, businessId } });
      throw err;
    }
    await this.audit?.registrar({
      businessId, memberId: member.memberId, entityType: 'appointment_resource', entityId: recurso.id, action: 'CREATE',
      changes: [{ field: 'name', before: null, after: recurso.name }, { field: 'role', before: null, after: rol.name }],
    });
    return { person: this.aDto(member, recurso), tempPassword: invitado.tempPassword };
  }

  /** Una persona SIN login: solo agenda y forma de pago. */
  async crear(member: MemberContext, dto: UpsertPersonDto): Promise<PersonaDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const rol = dto.roleId ? await this.rolDelNegocio(businessId, dto.roleId) : null;
    await this.validar(businessId, settings.agendaMode, dto);
    const recurso = await this.prisma.appointmentResource.create({
      data: {
        businessId,
        kind: 'PERSON',
        name: dto.name,
        roleLabel: rol?.name ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        color: dto.color ?? (await this.colorLibre(businessId)),
        photoUrl: dto.photoUrl ?? null,
        bio: dto.bio ?? null,
        isBookable: dto.isBookable,
        workDays: dto.workDays,
        ownSchedule: (dto.ownSchedule as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
        assignedSpaceId: dto.assignedSpaceId ?? null,
        ...pagoInicialDe(settings.agendaMode),
      },
      include: personaInclude,
    });
    await this.audit?.registrar({
      businessId, memberId: member.memberId, entityType: 'appointment_resource', entityId: recurso.id, action: 'CREATE',
      changes: [{ field: 'name', before: null, after: recurso.name }],
    });
    return this.aDto(member, recurso);
  }

  async editar(member: MemberContext, resourceId: string, dto: UpsertPersonDto): Promise<PersonaDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const antes = await this.persona(businessId, resourceId);
    if (esDeDueno(antes) && !esDueno(member)) throw new ForbiddenException('Solo el dueño puede editar su ficha.');
    await this.validar(businessId, settings.agendaMode, dto, antes);

    let roleLabel = antes.roleLabel;
    if (dto.roleId) {
      const rol = await this.rolDelNegocio(businessId, dto.roleId);
      if (rol.id !== antes.member?.roleId) {
        assertNoEsRolDeDueno(member, rol);
        assertPuedeDar(member, rol.permisos);
      }
      roleLabel = rol.name;
    }
    // Con login, el nombre y el rol viven en `members`: se cambian por
    // MembersService (que además no deja tocar al dueño ni cambiarse el propio rol).
    if (antes.memberId && antes.member) {
      const cambiaRol = !!dto.roleId && dto.roleId !== antes.member.roleId;
      if (cambiaRol || dto.name !== antes.name) {
        await this.members.update(businessId, member.memberId, member.roleName, antes.memberId, {
          name: dto.name.slice(0, 80),
          ...(cambiaRol ? { roleId: dto.roleId } : {}),
        });
      }
    }

    const data = {
      name: dto.name,
      roleLabel,
      // Con login, el contacto es el del member.
      email: antes.memberId ? null : dto.email === undefined ? antes.email : dto.email,
      phone: dto.phone === undefined ? antes.phone : dto.phone,
      color: dto.color === undefined ? antes.color : dto.color,
      photoUrl: dto.photoUrl === undefined ? antes.photoUrl : dto.photoUrl,
      bio: dto.bio === undefined ? antes.bio : dto.bio,
      isBookable: dto.isBookable,
      workDays: dto.workDays,
      ownSchedule: dto.ownSchedule === undefined ? (antes.ownSchedule ?? Prisma.DbNull) : dto.ownSchedule === null ? Prisma.DbNull : (dto.ownSchedule as Prisma.InputJsonValue),
      assignedSpaceId: dto.assignedSpaceId === undefined ? antes.assignedSpaceId : dto.assignedSpaceId,
    };
    const { count } = await this.prisma.appointmentResource.updateMany({ where: { id: resourceId, businessId, kind: 'PERSON', deletedAt: null }, data: data as Prisma.AppointmentResourceUpdateManyMutationInput });
    if (count === 0) throw new NotFoundException('Persona no encontrada');

    const despues = await this.persona(businessId, resourceId);
    const campos = ['name', 'roleLabel', 'email', 'phone', 'color', 'isBookable', 'workDays', 'ownSchedule', 'assignedSpaceId'];
    const cambios = AuditService.diferencias(antes as unknown as Record<string, unknown>, despues as unknown as Record<string, unknown>, campos);
    if (cambios.length > 0) {
      await this.audit?.registrar({ businessId, memberId: member.memberId, entityType: 'appointment_resource', entityId: resourceId, action: 'UPDATE', changes: cambios });
    }
    return this.aDto(member, despues);
  }

  async cambiarPago(member: MemberContext, resourceId: string, dto: PayFormDto): Promise<PersonaDto> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const antes = await this.persona(businessId, resourceId);
    if (esDeDueno(antes)) throw new BadRequestException('El dueño no se liquida: lo que factura queda para el negocio.');
    if (!formasDe(settings.agendaMode).includes(dto.payForm)) {
      throw new BadRequestException('Esa forma de pago no se usa en este tipo de negocio.');
    }
    const data = {
      payForm: dto.payForm,
      commissionPercent: dto.commissionPercent ?? 0,
      salary: dto.salary ?? 0,
      rent: dto.rent ?? 0,
      perClass: dto.perClass ?? 0,
      payEvery: dto.payEvery,
    };
    const { count } = await this.prisma.appointmentResource.updateMany({ where: { id: resourceId, businessId, kind: 'PERSON', deletedAt: null }, data });
    if (count === 0) throw new NotFoundException('Persona no encontrada');
    const despues = await this.persona(businessId, resourceId);
    await this.audit?.registrar({
      businessId, memberId: member.memberId, entityType: 'appointment_resource', entityId: resourceId, action: 'UPDATE',
      changes: [{ field: 'pay', before: formaDePagoDto(antes), after: formaDePagoDto(despues) }],
    });
    return this.aDto(member, despues);
  }

  async borrar(member: MemberContext, resourceId: string, ahora = new Date()): Promise<{ ok: true }> {
    const { settings } = await this.ctx.delNegocio(member.businessId);
    const businessId = member.businessId;
    const r = await this.persona(businessId, resourceId);
    if (esDeDueno(r)) throw new BadRequestException('Al dueño no se lo puede sacar del equipo.');
    // Sacar a alguien con login borra su acceso al panel: hoy eso es solo del dueño (MembersController.remove).
    if (r.memberId && !esDueno(member)) throw new ForbiddenException('Solo el dueño puede sacar a alguien que entra al panel.');
    const futuros = await this.prisma.appointment.count({
      where: { businessId, resourceId, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gt: ahora } },
    });
    if (futuros > 0) throw new BadRequestException(`Tiene ${futuros} turnos por delante. Movelos o cancelalos antes de borrarla.`);
    if (r.isBookable) await this.assertQuedaAlguien(businessId, settings.agendaMode, resourceId);

    if (r.memberId) await this.members.remove(businessId, r.memberId, member.memberId);
    await this.prisma.$transaction([
      this.prisma.appointmentResource.updateMany({
        where: { id: resourceId, businessId, deletedAt: null },
        data: { deletedAt: ahora, isActive: false, isBookable: false, memberId: null },
      }),
      // Sus clases quedan sin profe (como el onDelete: SetNull de un borrado de verdad).
      this.prisma.appointmentClassTemplate.updateMany({ where: { businessId, instructorResourceId: resourceId }, data: { instructorResourceId: null } }),
    ]);
    await this.audit?.registrar({
      businessId, memberId: member.memberId, entityType: 'appointment_resource', entityId: resourceId, action: 'DELETE',
      changes: [{ field: 'name', before: r.name, after: null }],
    });
    return { ok: true };
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  private aDto(member: MemberContext, r: PersonaFila): PersonaDto {
    const propia = !!r.memberId && r.memberId === member.memberId;
    const vePago = tiene(member, 'appointments.earnings.view_all') || (propia && tiene(member, 'appointments.earnings.view'));
    const veContacto = propia || tiene(member, 'appointments.team.manage');
    return {
      id: r.id,
      kind: 'PERSON',
      name: r.name,
      roleLabel: r.roleLabel,
      color: r.color,
      photoUrl: r.photoUrl,
      bio: r.bio,
      isBookable: r.isBookable,
      assignedSpaceId: r.assignedSpaceId,
      workDays: r.workDays,
      ownSchedule: r.ownSchedule === null ? null : leerSemana(r.ownSchedule),
      isActive: r.isActive,
      sortOrder: r.sortOrder,
      member: r.member
        ? { id: r.member.id, email: veContacto ? r.member.email : '', status: r.member.status, roleId: r.member.roleId, roleName: r.member.role.name, isOwner: r.member.role.name === 'owner' }
        : null,
      email: veContacto ? (r.member?.email ?? r.email) : null,
      phone: veContacto ? r.phone : null,
      pay: vePago ? formaDePagoDto(r) : null,
    };
  }

  private async persona(businessId: string, id: string): Promise<PersonaFila> {
    const r = await this.prisma.appointmentResource.findFirst({ where: { id, businessId, kind: 'PERSON', deletedAt: null }, include: personaInclude });
    if (!r) throw new NotFoundException('Persona no encontrada');
    return r;
  }

  private async rolDelNegocio(businessId: string, roleId: string) {
    const rol = await this.prisma.role.findFirst({
      where: { id: roleId, businessId },
      include: { rolePermissions: { select: { permission: { select: { code: true } } } } },
    });
    if (!rol) throw new BadRequestException('Rol inválido');
    return { ...rol, permisos: rol.rolePermissions.map((rp) => rp.permission.code) };
  }

  private async validar(businessId: string, modo: AppointmentAgendaMode, dto: UpsertPersonDto, antes?: PersonaFila) {
    if (dto.ownSchedule !== undefined && dto.ownSchedule !== null) {
      const error = errorSemana(dto.ownSchedule);
      if (error) throw new BadRequestException(error);
    }
    if (dto.assignedSpaceId) {
      if (modo !== 'RESOURCE') throw new BadRequestException('Asignar un espacio es solo para agendas por sala o cabina.');
      const espacio = await this.prisma.appointmentResource.findFirst({ where: { id: dto.assignedSpaceId, businessId, kind: 'SPACE', deletedAt: null }, select: { id: true } });
      if (!espacio) throw new BadRequestException('Ese espacio no existe.');
    }
    if (antes?.isBookable && !dto.isBookable) await this.assertQuedaAlguien(businessId, modo, antes.id);
  }

  /** Modo PROFESSIONAL: el negocio no puede quedarse sin nadie que atienda. */
  private async assertQuedaAlguien(businessId: string, modo: AppointmentAgendaMode, sinId: string) {
    if (modo !== 'PROFESSIONAL') return;
    const otros = await this.prisma.appointmentResource.count({
      where: { businessId, kind: 'PERSON', deletedAt: null, isActive: true, isBookable: true, id: { not: sinId } },
    });
    if (otros === 0) throw new BadRequestException('Tiene que quedar al menos una persona que atienda.');
  }

  /** Por defecto trabaja los días que abre el negocio (o todos, si la semana está vacía). */
  private diasQueAbre(weekSchedule: unknown): number[] {
    const dias = diasAbiertos(leerSemana(weekSchedule));
    return dias.length > 0 ? dias : [0, 1, 2, 3, 4, 5, 6];
  }

  private async colorLibre(businessId: string): Promise<string> {
    const usados = await this.prisma.appointmentResource.findMany({ where: { businessId, deletedAt: null }, select: { color: true } });
    const set = new Set(usados.map((u) => u.color));
    return COLORES_EQUIPO.find((c) => !set.has(c)) ?? COLORES_EQUIPO[usados.length % COLORES_EQUIPO.length];
  }
}
