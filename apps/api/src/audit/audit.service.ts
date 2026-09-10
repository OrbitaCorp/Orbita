import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';

// Registro de auditoría del negocio (tabla audit_logs): quién hizo qué
// cambio sensible y cuándo. Auditoría interna 10/09, ítem `api.audit`: hasta
// acá el módulo era un stub ("not implemented") y la tabla no la escribía
// NADIE. Ahora la escriben las acciones sensibles del panel (precios y
// estado de productos, borrados, roles, equipo, zona peligrosa del negocio,
// exportación de clientes) y el panel la puede leer con config.audit.view.
//
// Reglas:
// - Registrar NUNCA rompe la acción registrada: si falla la escritura, queda
//   en el log del servidor y la acción sigue.
// - Es de solo agregado: no hay ningún endpoint ni método que edite o borre
//   filas (lo fija audit.auditoria.unit-spec.ts barriendo src/).
// - No guarda secretos: los campos cuyo nombre huele a contraseña, token o
//   tarjeta se descartan aunque alguien los pase.

export interface CambioAuditoria {
  field: string;
  before: unknown;
  after: unknown;
}

export interface EntradaAuditoria {
  businessId: string;
  memberId?: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  changes?: CambioAuditoria[];
}

const CAMPOS_SENSIBLES = /pass|hash|token|secret|cvv|tarjeta|card/i;

// Decimal de Prisma, Date y demás no son JSON "limpio": se guardan como texto
// o número para que el registro se lea igual dentro de un año.
function aJson(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (v !== null && typeof v === 'object' && 'toFixed' in v) return Number(v as Prisma.Decimal);
  return v;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Compara dos fotos de una entidad y devuelve solo los campos que cambiaron.
  static diferencias(antes: Record<string, unknown>, despues: Record<string, unknown>, campos: string[]): CambioAuditoria[] {
    return campos
      .map((field) => ({ field, before: aJson(antes[field]), after: aJson(despues[field]) }))
      .filter((c) => JSON.stringify(c.before) !== JSON.stringify(c.after));
  }

  async registrar(entrada: EntradaAuditoria): Promise<void> {
    try {
      const cambios = (entrada.changes ?? [])
        .filter((c) => !CAMPOS_SENSIBLES.test(c.field))
        .map((c) => ({ field: c.field, before: aJson(c.before), after: aJson(c.after) }));
      const quien = entrada.memberId
        ? await this.prisma.member.findFirst({ where: { id: entrada.memberId, businessId: entrada.businessId }, select: { name: true } })
        : null;
      await this.prisma.auditLog.create({
        data: {
          businessId: entrada.businessId,
          entityType: entrada.entityType,
          entityId: entrada.entityId,
          action: entrada.action,
          memberId: entrada.memberId ?? null,
          memberName: quien?.name ?? null,
          ...(cambios.length > 0 ? { changes: cambios as Prisma.InputJsonValue } : {}),
        },
      });
    } catch (err) {
      this.logger.error(
        `No se pudo registrar ${entrada.action} ${entrada.entityType} ${entrada.entityId} (negocio ${entrada.businessId}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async listar(businessId: string, q: FindAuditLogsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const where: Prisma.AuditLogWhereInput = {
      businessId,
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.memberId ? { memberId: q.memberId } : {}),
      ...(q.from || q.to
        ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
