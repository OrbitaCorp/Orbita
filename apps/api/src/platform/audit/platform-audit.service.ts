import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PlatformAuditArea, PlatformAuditEstado, PlatformAuditSeveridad } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_SEED, SeedItem } from './audit-seed';
import { CreateAuditItemDto, UpdateAuditItemDto } from './dto/audit-item.dto';

// Auditoría interna (super admin → Auditoría). Todo cross-tenant y protegido
// por PlatformAdminGuard en el controller. Ver PlatformAuditItem en
// schema.prisma para el modelo y audit-seed.ts para la lista base.

export interface AuditCheck {
  id: string;
  texto: string;
  hecho: boolean;
}

const ADMIN_SELECT = { select: { id: true, name: true } } as const;

const ITEM_INCLUDE = {
  responsable: ADMIN_SELECT,
  hechoPor: ADMIN_SELECT,
  actualizadoPor: ADMIN_SELECT,
} as const;

type ItemConInclude = Prisma.PlatformAuditItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

// Los checks viven en un Json: se normalizan al leer para que el front nunca
// reciba algo con forma rara aunque alguien haya tocado la fila a mano.
export function normalizarChecks(raw: unknown): AuditCheck[] {
  if (!Array.isArray(raw)) return [];
  const out: AuditCheck[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const { id, texto, hecho } = c as Record<string, unknown>;
    if (typeof id !== 'string' || typeof texto !== 'string') continue;
    out.push({ id, texto, hecho: hecho === true });
  }
  return out;
}

export function checksDesdeSeed(item: Pick<SeedItem, 'checks' | 'checksHechos'>): AuditCheck[] {
  return item.checks.map((texto, i) => ({ id: `c${i + 1}`, texto, hecho: item.checksHechos === true }));
}

@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Lectura ───────────────────────────────────────────────────────────────

  async listar() {
    await this.asegurarSeed();
    const [items, admins] = await Promise.all([
      this.prisma.platformAuditItem.findMany({ orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }], include: ITEM_INCLUDE }),
      this.prisma.platformAdmin.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);
    const filas = items.map((i) => this.serializar(i));
    return { items: filas, resumen: resumir(filas), admins };
  }

  // Crea los ítems del seed que todavía no existen (por key). Nunca toca los
  // que ya están: lo que cargó el equipo es la fuente de verdad.
  async asegurarSeed() {
    const existentes = await this.prisma.platformAuditItem.findMany({ select: { key: true } });
    const keys = new Set(existentes.map((e) => e.key));
    const faltan = AUDIT_SEED.map((item, orden) => ({ item, orden })).filter(({ item }) => !keys.has(item.key));
    if (faltan.length === 0) return 0;
    await this.prisma.platformAuditItem.createMany({
      data: faltan.map(({ item, orden }) => ({
        key: item.key,
        area: item.area as PlatformAuditArea,
        grupo: item.grupo,
        titulo: item.titulo,
        ruta: item.ruta ?? null,
        foco: item.foco,
        severidad: (item.severidad ?? null) as PlatformAuditSeveridad | null,
        estado: (item.estado ?? 'PENDIENTE') as PlatformAuditEstado,
        checks: checksDesdeSeed(item) as unknown as Prisma.InputJsonValue,
        orden,
        informeUrl: item.informeUrl ?? null,
        notas: item.notas ?? null,
        hechoAt: item.estado === 'HECHO' ? new Date() : null,
      })),
      skipDuplicates: true,
    });
    return faltan.length;
  }

  // ── Escritura ─────────────────────────────────────────────────────────────

  async actualizar(adminId: string, id: string, dto: UpdateAuditItemDto) {
    const actual = await this.prisma.platformAuditItem.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Ítem de auditoría no encontrado');

    if (dto.responsableId) {
      const admin = await this.prisma.platformAdmin.findUnique({ where: { id: dto.responsableId }, select: { isActive: true } });
      if (!admin || !admin.isActive) throw new BadRequestException('Ese responsable no existe o está inactivo');
    }

    let checks = normalizarChecks(actual.checks);
    if (dto.checks) {
      const toggles = new Map(dto.checks.map((c) => [c.id, c.hecho]));
      checks = checks.map((c) => (toggles.has(c.id) ? { ...c, hecho: toggles.get(c.id)! } : c));
    }
    if (dto.nuevosChecks?.length) {
      for (const texto of dto.nuevosChecks) checks.push({ id: `u${randomUUID().slice(0, 8)}`, texto: texto.trim(), hecho: false });
    }

    const data: Prisma.PlatformAuditItemUpdateInput = {
      checks: checks as unknown as Prisma.InputJsonValue,
      actualizadoPor: { connect: { id: adminId } },
    };
    if (dto.responsableId !== undefined) {
      data.responsable = dto.responsableId ? { connect: { id: dto.responsableId } } : { disconnect: true };
    }
    if (dto.informeUrl !== undefined) data.informeUrl = dto.informeUrl?.trim() || null;
    if (dto.notas !== undefined) data.notas = dto.notas?.trim() || null;

    if (dto.estado && dto.estado !== actual.estado) {
      data.estado = dto.estado;
      if (dto.estado === 'HECHO') {
        data.hechoPor = { connect: { id: adminId } };
        data.hechoAt = new Date();
      } else if (actual.estado === 'HECHO') {
        data.hechoPor = { disconnect: true };
        data.hechoAt = null;
      }
    }

    const [item] = await this.prisma.$transaction([
      this.prisma.platformAuditItem.update({ where: { id }, data, include: ITEM_INCLUDE }),
      this.prisma.platformAdminLog.create({
        data: {
          adminId,
          action: 'audit_item_update',
          targetType: 'audit_item',
          targetId: id,
          details: {
            key: actual.key,
            titulo: actual.titulo,
            ...(dto.estado && dto.estado !== actual.estado ? { estado: dto.estado } : {}),
            ...(dto.responsableId !== undefined ? { responsableId: dto.responsableId } : {}),
            ...(dto.informeUrl !== undefined ? { informeUrl: dto.informeUrl } : {}),
            ...(dto.checks?.length ? { checks: dto.checks.map((c) => ({ id: c.id, hecho: c.hecho })) } : {}),
            ...(dto.nuevosChecks?.length ? { nuevosChecks: dto.nuevosChecks.length } : {}),
          } as Prisma.InputJsonObject,
        },
      }),
    ]);
    return this.serializar(item);
  }

  async crear(adminId: string, dto: CreateAuditItemDto) {
    const max = await this.prisma.platformAuditItem.aggregate({ _max: { orden: true } });
    const checks: AuditCheck[] = dto.checks.map((texto, i) => ({ id: `c${i + 1}`, texto: texto.trim(), hecho: false }));
    const [item] = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.platformAuditItem.create({
        data: {
          key: `custom.${randomUUID()}`,
          area: dto.area,
          grupo: dto.grupo.trim(),
          titulo: dto.titulo.trim(),
          ruta: dto.ruta?.trim() || null,
          foco: dto.foco.trim(),
          severidad: dto.severidad ?? null,
          checks: checks as unknown as Prisma.InputJsonValue,
          orden: (max._max.orden ?? 0) + 1,
          esPersonalizado: true,
          actualizadoPor: { connect: { id: adminId } },
        },
        include: ITEM_INCLUDE,
      });
      await tx.platformAdminLog.create({
        data: { adminId, action: 'audit_item_create', targetType: 'audit_item', targetId: creado.id, details: { titulo: creado.titulo, area: creado.area } },
      });
      return [creado];
    });
    return this.serializar(item);
  }

  async borrar(adminId: string, id: string) {
    const actual = await this.prisma.platformAuditItem.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Ítem de auditoría no encontrado');
    // Los del seed no se borran: si ya no aplica, se marca HECHO con una nota.
    // Así nadie pierde por accidente lo que otro cargó.
    if (!actual.esPersonalizado) throw new ForbiddenException('Los ítems de la lista base no se pueden borrar; marcalo como hecho con una nota');
    await this.prisma.$transaction([
      this.prisma.platformAuditItem.delete({ where: { id } }),
      this.prisma.platformAdminLog.create({
        data: { adminId, action: 'audit_item_delete', targetType: 'audit_item', targetId: id, details: { titulo: actual.titulo } },
      }),
    ]);
    return { ok: true as const };
  }

  // ── Serialización ─────────────────────────────────────────────────────────

  private serializar(i: ItemConInclude) {
    const checks = normalizarChecks(i.checks);
    return {
      id: i.id,
      key: i.key,
      area: i.area,
      grupo: i.grupo,
      titulo: i.titulo,
      ruta: i.ruta,
      foco: i.foco,
      severidad: i.severidad,
      estado: i.estado,
      checks,
      checksHechos: checks.filter((c) => c.hecho).length,
      orden: i.orden,
      esPersonalizado: i.esPersonalizado,
      responsable: i.responsable,
      informeUrl: i.informeUrl,
      notas: i.notas,
      hechoPor: i.hechoPor,
      hechoAt: i.hechoAt,
      actualizadoPor: i.actualizadoPor,
      updatedAt: i.updatedAt,
    };
  }
}

export type AuditItemSerializado = ReturnType<PlatformAuditService['serializar']>;

export function resumir(items: AuditItemSerializado[]) {
  const porArea: Record<string, { total: number; hechos: number; enCurso: number }> = {};
  let hechos = 0;
  let enCurso = 0;
  let sinResponsable = 0;
  let hallazgosAbiertos = 0;
  for (const it of items) {
    const a = (porArea[it.area] ??= { total: 0, hechos: 0, enCurso: 0 });
    a.total += 1;
    if (it.estado === 'HECHO') { hechos += 1; a.hechos += 1; }
    if (it.estado === 'EN_CURSO') { enCurso += 1; a.enCurso += 1; }
    if (!it.responsable && it.estado !== 'HECHO') sinResponsable += 1;
    if (it.area === 'HALLAZGO' && it.estado !== 'HECHO' && it.severidad !== 'INFO') hallazgosAbiertos += 1;
  }
  return { total: items.length, hechos, enCurso, pendientes: items.length - hechos - enCurso, sinResponsable, hallazgosAbiertos, porArea };
}
