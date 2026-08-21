import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertRoleDto } from './dto/upsert-role.dto';

const roleInclude = {
  rolePermissions: { include: { permission: true } },
  _count: { select: { members: true } },
} satisfies Prisma.RoleInclude;

type RoleWithRelations = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Roles ────────────────────────────────────────────────────────────────

  async findAll(businessId: string) {
    const roles = await this.prisma.role.findMany({
      where: { businessId },
      include: roleInclude,
      orderBy: { createdAt: 'asc' },
    });
    // El rol de fábrica "admin" quedó deprecado: tenía los MISMOS permisos que
    // owner, así que para el negocio eran un solo rol ("Propietario") con dos
    // nombres. Los negocios nuevos ya no lo crean (ver onboarding.service); a
    // los que lo tienen de antes se lo escondemos SI no hay nadie asignado —
    // si alguien todavía lo usa se sigue mostrando, para no dejar a un miembro
    // con un rol fantasma que el panel no sabe nombrar.
    const visibles = roles.filter(
      (r) => !(r.isDefault && r.name === 'admin' && r._count.members === 0),
    );
    return visibles.map((r) => this.toResponse(r));
  }

  async create(businessId: string, dto: UpsertRoleDto) {
    await this.validatePermissionCodes(dto.permissions);

    const role = await this.prisma.role.create({
      data: {
        businessId,
        name: dto.name,
        description: dto.description ?? null,
        color: dto.color ?? null,
        isDefault: false,
        rolePermissions: {
          create: dto.permissions.map((code) => ({ permission: { connect: { code } } })),
        },
      },
      include: roleInclude,
    });
    return this.toResponse(role);
  }

  async update(businessId: string, id: string, dto: UpsertRoleDto) {
    const role = await this.findOneRaw(businessId, id);
    // El rol de DUEÑO no se toca nunca: sacarle permisos al owner es la
    // receta para que un negocio se deje afuera de su propio panel.
    if (role.isDefault && (role.name === 'owner' || role.name === 'admin')) {
      throw new UnprocessableEntityException('El rol de propietario no se puede editar');
    }
    await this.validatePermissionCodes(dto.permissions);

    // Reemplazo completo de permisos: más simple y predecible que un diff
    // incremental, y el volumen por rol (~19 permisos máx.) lo hace barato.
    const updated = await this.prisma.$transaction(async (tx) => {
      // El update de campos escalares va scopeado por businessId acá mismo — no
      // depende del findOneRaw de arriba para el aislamiento.
      //
      // Para un rol DE FÁBRICA (admin/empleado) solo se editan los PERMISOS:
      // el nombre y el color son identidad del sistema y quedan como están
      // (se reescribe el mismo nombre solo para conservar el chequeo de
      // tenencia por count). Un rol custom edita todo.
      const { count } = await tx.role.updateMany({
        where: { id, businessId },
        data: role.isDefault
          ? { name: role.name }
          : { name: dto.name, description: dto.description ?? null, color: dto.color ?? null },
      });
      if (count === 0) throw new NotFoundException('Rol no encontrado');

      // rolePermissions es un nested write: Prisma solo lo acepta contra un
      // `where` por clave única, no admite updateMany con relaciones anidadas.
      // Usar `id` solo acá es seguro porque el updateMany de arriba, en la misma
      // transacción, ya confirmó que este `id` pertenece a `businessId` — y
      // businessId de un Role nunca se reasigna (ningún endpoint lo modifica),
      // así que no queda ventana de carrera real.
      return tx.role.update({
        where: { id },
        data: {
          rolePermissions: {
            deleteMany: {},
            create: dto.permissions.map((code) => ({ permission: { connect: { code } } })),
          },
        },
        include: roleInclude,
      });
    });

    return this.toResponse(updated);
  }

  async remove(businessId: string, id: string) {
    const role = await this.findOneRaw(businessId, id);
    if (role.isDefault) {
      throw new UnprocessableEntityException('No se puede eliminar un rol por defecto');
    }

    let result: Prisma.BatchPayload;
    try {
      result = await this.prisma.role.deleteMany({ where: { id, businessId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new UnprocessableEntityException(
          'No se puede eliminar: hay miembros con este rol asignado',
        );
      }
      throw err;
    }
    if (result.count === 0) throw new NotFoundException('Rol no encontrado');

    return { ok: true };
  }

  // ── Permissions (catálogo global) ───────────────────────────────────────

  findAllPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { label: 'asc' }] });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async findOneRaw(businessId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, businessId } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  private async validatePermissionCodes(codes: string[]) {
    if (codes.length === 0) return;
    const found = await this.prisma.permission.findMany({ where: { code: { in: codes } } });
    const foundCodes = new Set(found.map((p) => p.code));
    const invalid = codes.filter((c) => !foundCodes.has(c));
    if (invalid.length > 0) {
      throw new BadRequestException(`Permisos inválidos: ${invalid.join(', ')}`);
    }
  }

  private toResponse(role: RoleWithRelations) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      color: role.color,
      isDefault: role.isDefault,
      permissions: role.rolePermissions.map((rp) => rp.permission.code),
      memberCount: role._count.members,
    };
  }
}
