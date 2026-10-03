import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RolesService } from '../../../roles/roles.service';
import type { MemberContext } from '../../../common/types/auth-context.type';
import type { RolTurnosDto } from '../../appointments.types';
import { alcancesDe, CODIGOS_TURNOS, normalizarCodigos, rolDeFabrica, type RolDeFabrica } from '../../catalogo/roles';
import type { RubroTurnos } from '../../catalogo/rubros';
import { GestionContextoService } from '../comun/contexto.service';
import type { UpsertTurnosRoleDto } from './dto/equipo.dto';
import { assertPuedeDar } from './escalada';

const rolInclude = {
  rolePermissions: { select: { permission: { select: { code: true } } } },
  _count: { select: { members: true } },
} satisfies Prisma.RoleInclude;

type RolFila = Prisma.RoleGetPayload<{ include: typeof rolInclude }>;

const esRolDeDueno = (r: { name: string; isDefault: boolean }) => r.name === 'owner' || (r.isDefault && r.name === 'admin');
const codigos = (r: RolFila) => r.rolePermissions.map((rp) => rp.permission.code);
const deTurnos = (cs: readonly string[]) => cs.filter((c) => CODIGOS_TURNOS.includes(c)).sort();

/** ¿Un rol de fábrica quedó distinto de como viene para el rubro? */
export function rolCambiado(
  rol: { name: string; description: string | null; takesAppointments: boolean; permisos: readonly string[] },
  fabrica: RolDeFabrica | undefined,
): boolean {
  if (!fabrica) return false;
  return rol.name !== fabrica.nombre
    || (rol.description ?? null) !== fabrica.descripcion
    || rol.takesAppointments !== fabrica.atiende
    || JSON.stringify(deTurnos(rol.permisos)) !== JSON.stringify([...fabrica.permisos].sort());
}

/**
 * Roles de Turnos (CONTRATO § P3.3) sobre `roles` + `role_permissions`. Las
 * reglas de siempre (nombres reservados y repetidos, el rol de fábrica que no
 * se borra, la validación de códigos) son las de RolesService: acá se le pasa
 * el trabajo y se suma lo propio de Turnos (`takesAppointments`, el rol de
 * fábrica del rubro y la regla anti-escalada).
 */
@Injectable()
export class RolesTurnosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: GestionContextoService,
    private readonly roles: RolesService,
  ) {}

  async listar(member: MemberContext): Promise<RolTurnosDto[]> {
    const { rubro } = await this.ctx.delNegocio(member.businessId);
    const filas = await this.prisma.role.findMany({
      where: { businessId: member.businessId },
      include: rolInclude,
      orderBy: { createdAt: 'asc' },
    });
    // Mismo criterio que RolesService.findAll: el "admin" deprecado sin nadie no se muestra.
    return filas.filter((r) => !(r.isDefault && r.name === 'admin' && r._count.members === 0)).map((r) => this.aDto(r, rubro));
  }

  async crear(member: MemberContext, dto: UpsertTurnosRoleDto): Promise<RolTurnosDto> {
    const { rubro } = await this.ctx.delNegocio(member.businessId);
    const permisos = this.permisosDeTurnos(dto.permissions);
    assertPuedeDar(member, permisos);
    const creado = await this.roles.create(member.businessId, { name: dto.name, description: dto.description, color: dto.color, permissions: permisos }, member.memberId);
    await this.prisma.role.updateMany({ where: { id: creado.id, businessId: member.businessId }, data: { takesAppointments: dto.takesAppointments } });
    return this.aDto(await this.rol(member.businessId, creado.id), rubro);
  }

  async editar(member: MemberContext, id: string, dto: UpsertTurnosRoleDto): Promise<RolTurnosDto> {
    const { rubro } = await this.ctx.delNegocio(member.businessId);
    const permisos = this.permisosDeTurnos(dto.permissions);
    return this.reemplazar(member, id, { name: dto.name, description: dto.description ?? null, color: dto.color ?? null, takesAppointments: dto.takesAppointments, permisos }, rubro);
  }

  /** Vuelve un rol de fábrica a como viene para el rubro. */
  async restablecer(member: MemberContext, id: string): Promise<RolTurnosDto> {
    const { rubro } = await this.ctx.delNegocio(member.businessId);
    const rol = await this.rol(member.businessId, id);
    const fabrica = rubro && rol.appointmentsRoleKey ? rolDeFabrica(rubro, rol.appointmentsRoleKey) : undefined;
    if (!fabrica) throw new BadRequestException('Este rol no es de fábrica: no hay cómo volverlo atrás.');
    return this.reemplazar(member, id, { name: fabrica.nombre, description: fabrica.descripcion, color: rol.color, takesAppointments: fabrica.atiende, permisos: fabrica.permisos }, rubro);
  }

  async borrar(member: MemberContext, id: string): Promise<{ ok: true }> {
    await this.ctx.delNegocio(member.businessId);
    const rol = await this.rol(member.businessId, id);
    if (esRolDeDueno(rol)) throw new BadRequestException('El rol del dueño no se borra.');
    if (rol._count.members > 0) {
      throw new BadRequestException(`Hay ${rol._count.members} ${rol._count.members === 1 ? 'persona' : 'personas'} con este rol. Pasalas a otro antes de borrarlo.`);
    }
    return this.roles.remove(member.businessId, id, member.memberId) as Promise<{ ok: true }>;
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  private async reemplazar(
    member: MemberContext, id: string,
    nuevo: { name: string; description: string | null; color: string | null; takesAppointments: boolean; permisos: string[] },
    rubro: RubroTurnos | undefined,
  ): Promise<RolTurnosDto> {
    const rol = await this.rol(member.businessId, id);
    if (esRolDeDueno(rol)) throw new BadRequestException('El rol del dueño no se cambia.');
    const actuales = codigos(rol);
    // Ni darle a un rol lo que uno no tiene, ni tocar un rol que tiene más que uno.
    assertPuedeDar(member, [...deTurnos(actuales), ...nuevo.permisos]);
    // Los códigos que no son de Turnos (si el rol tuviera alguno) se conservan.
    const ajenos = actuales.filter((c) => !CODIGOS_TURNOS.includes(c));
    await this.roles.update(member.businessId, id, {
      name: nuevo.name,
      description: nuevo.description ?? undefined,
      color: nuevo.color ?? undefined,
      permissions: [...ajenos, ...nuevo.permisos],
      // Sin esto, RolesService los pisaría con null ("todos los avisos").
      notificationEvents: (rol.notificationEvents as string[] | null) ?? null,
    }, member.memberId);
    await this.prisma.role.updateMany({ where: { id, businessId: member.businessId }, data: { takesAppointments: nuevo.takesAppointments } });
    return this.aDto(await this.rol(member.businessId, id), rubro);
  }

  /** Solo códigos `appointments.*`, dejados coherentes con normalizarCodigos. */
  private permisosDeTurnos(entrada: string[]): string[] {
    const ajenos = [...new Set(entrada.filter((c) => !CODIGOS_TURNOS.includes(c)))];
    if (ajenos.length > 0) throw new BadRequestException(`Solo se pueden usar permisos de Turnos: ${ajenos.join(', ')} no es uno.`);
    return normalizarCodigos(entrada);
  }

  private async rol(businessId: string, id: string): Promise<RolFila> {
    const r = await this.prisma.role.findFirst({ where: { id, businessId }, include: rolInclude });
    if (!r) throw new NotFoundException('Rol no encontrado');
    return r;
  }

  private aDto(r: RolFila, rubro: RubroTurnos | undefined): RolTurnosDto {
    const isOwner = esRolDeDueno(r);
    // El dueño pasa por todo sin mirar filas de permisos (PermissionsGuard).
    const permissions = isOwner ? [...CODIGOS_TURNOS] : deTurnos(codigos(r));
    const fabrica = rubro && r.appointmentsRoleKey ? rolDeFabrica(rubro, r.appointmentsRoleKey) : undefined;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      color: r.color,
      isOwner,
      factoryKey: r.appointmentsRoleKey,
      changed: rolCambiado({ name: r.name, description: r.description, takesAppointments: r.takesAppointments, permisos: permissions }, fabrica),
      takesAppointments: r.takesAppointments,
      permissions,
      scopes: alcancesDe(permissions),
      members: r._count.members,
    };
  }
}
