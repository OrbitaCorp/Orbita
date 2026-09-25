import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditService } from '../../src/audit/audit.service';
import { FindAuditLogsQueryDto } from '../../src/audit/dto/find-audit-logs-query.dto';
import { RolesService } from '../../src/roles/roles.service';
import { MembersService } from '../../src/members/members.service';
import { BusinessesService } from '../../src/businesses/businesses.service';
import { ProductsService } from '../../src/products/products.service';

// Auditoría interna 2026-09-10, ítem `api.audit`.
//
// El módulo era un stub ("not implemented") y la tabla audit_logs no la
// escribía nadie. Ahora: AuditService.registrar() desde las acciones
// sensibles, GET /audit-logs con config.audit.view, registro de solo agregado
// y sin secretos.

const BIZ = 'biz-1';

function prismaAudit(opts: { falla?: boolean } = {}) {
  return {
    member: { findFirst: jest.fn().mockResolvedValue({ name: 'Dueña' }) },
    auditLog: {
      create: opts.falla ? jest.fn().mockRejectedValue(new Error('db caída')) : jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('AuditService', () => {
  it('registra con el nombre del actor y cambios en JSON limpio (Decimal → número)', async () => {
    const prisma = prismaAudit();
    await new AuditService(prisma as any).registrar({
      businessId: BIZ, memberId: 'm-1', entityType: 'product', entityId: 'p-1', action: 'UPDATE',
      changes: [{ field: 'basePrice', before: new Prisma.Decimal('1500.50'), after: 1800 }],
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        businessId: BIZ, entityType: 'product', entityId: 'p-1', action: 'UPDATE', memberId: 'm-1', memberName: 'Dueña',
        changes: [{ field: 'basePrice', before: 1500.5, after: 1800 }],
      },
    });
    expect(prisma.member.findFirst).toHaveBeenCalledWith({ where: { id: 'm-1', businessId: BIZ }, select: { name: true } });
  });

  it('nunca guarda campos que huelen a secreto', async () => {
    const prisma = prismaAudit();
    await new AuditService(prisma as any).registrar({
      businessId: BIZ, entityType: 'member', entityId: 'm-2', action: 'UPDATE',
      changes: [
        { field: 'passwordHash', before: 'x', after: 'y' },
        { field: 'tempPassword', before: null, after: 'Abc123' },
        { field: 'refreshToken', before: null, after: 't' },
        { field: 'name', before: 'A', after: 'B' },
      ],
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data.changes).toEqual([{ field: 'name', before: 'A', after: 'B' }]);
  });

  it('si la escritura falla, la acción registrada NO se rompe', async () => {
    const prisma = prismaAudit({ falla: true });
    await expect(
      new AuditService(prisma as any).registrar({ businessId: BIZ, entityType: 'role', entityId: 'r-1', action: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  it('diferencias() devuelve solo lo que cambió', () => {
    expect(
      AuditService.diferencias(
        { name: 'Remera', basePrice: new Prisma.Decimal(1000), status: 'PUBLISHED' },
        { name: 'Remera', basePrice: 1200, status: 'PUBLISHED' },
        ['name', 'basePrice', 'status'],
      ),
    ).toEqual([{ field: 'basePrice', before: 1000, after: 1200 }]);
  });

  it('listar filtra por el negocio del token y por los filtros del query', async () => {
    const prisma = prismaAudit();
    await new AuditService(prisma as any).listar(BIZ, { entityType: 'product', page: 2, limit: 10 });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { businessId: BIZ, entityType: 'product' }, orderBy: { createdAt: 'desc' }, skip: 10, take: 10,
    });
  });

  it('el query valida filtros y topes', async () => {
    const props = async (body: object) => (await validate(plainToInstance(FindAuditLogsQueryDto, body))).map((e) => e.property);
    expect(await props({ entityType: 'product', limit: '50' })).toEqual([]);
    expect(await props({ entityType: "x'; DROP" })).toContain('entityType');
    expect(await props({ limit: '1000' })).toContain('limit');
    expect(await props({ from: 'ayer' })).toContain('from');
  });
});

describe('El registro es de solo agregado', () => {
  // Única excepción permitida: la purga por antigüedad del mantenimiento
  // nocturno (hallazgo logs-sin-retencion, 14/09). Borra por fecha de creación
  // y nada más — nunca por negocio, entidad, acción ni actor — así que no
  // sirve para hacer desaparecer un rastro puntual: lo que se va, se va parejo
  // para todos y recién pasado el año (AUDIT_LOGS_RETENTION_DAYS, mínimo 30).
  // Segunda excepción (16/09, hallazgo `businesses-sin-baja` check c1): la
  // purga de datos personales del borrado definitivo de un negocio, a los 60
  // días de la baja. OJO CON EL ALCANCE DE LA DECISIÓN: el CEO decidió el
  // 16/09 que en la baja los datos personales se BORRAN y no se anonimizan;
  // que eso incluyera a `audit_logs` se dedujo de ahí, no se le preguntó
  // puntualmente. Si alguien quiere el registro intacto aunque el negocio ya
  // no exista, se saca esta excepción y listo. Pasa el mismo filtro que la
  // primera: no sirve para hacer desaparecer un rastro puntual. Borra por
  // `businessId` y únicamente dentro de la transacción que deja el negocio
  // como no existente — se va el registro entero junto con los clientes, los
  // miembros y las sesiones, no una fila incómoda. El motivo de borrarlo es
  // que `audit_logs` guarda `member_name`: el nombre de cada empleado que
  // hizo cada cosa, o sea un dato personal de gente que ya no trabaja en una
  // tienda que ya no existe (ver DEPLOYMENT.md § Baja de un negocio).
  //
  // Cualquier otro borrado o edición de audit_logs es un bug y este test lo
  // tiene que agarrar; si aparece una tercera excepción, se discute acá antes
  // de sumarla a la lista.
  const EXCEPCIONES = [
    join('internal-cron', 'retencion-logs.service.ts'),
    join('subscriptions', 'subscriptions.service.ts'),
  ];
  const SRC = join(__dirname, '../../src');
  const MUTACION = /auditLog\.(update|updateMany|upsert|delete|deleteMany)\(/;

  it('ningún archivo de src/ edita ni borra filas de audit_logs, salvo la purga por retención', () => {
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) recorrer(p);
        else if (p.endsWith('.ts')) archivos.push(p);
      }
    };
    recorrer(SRC);
    const esExcepcion = (f: string) => EXCEPCIONES.some((e) => f.endsWith(e));
    const culpables = archivos.filter((f) => !esExcepcion(f) && MUTACION.test(readFileSync(f, 'utf8')));
    expect(culpables).toEqual([]);
  });

  it('la purga por retención solo borra por antigüedad: un deleteMany por created_at y ninguna otra mutación', () => {
    const fuente = readFileSync(join(SRC, EXCEPCIONES[0]), 'utf8');
    expect(fuente).not.toMatch(/auditLog\.(update|updateMany|upsert|delete)\(/);
    const borrados = fuente.match(/auditLog\.deleteMany\([^)]*\)/g) ?? [];
    expect(borrados).toHaveLength(1);
    expect(borrados[0]).toBe('auditLog.deleteMany({ where: { createdAt: { lt: corte } } })');
  });
});

describe('Las acciones sensibles quedan registradas', () => {
  const auditMock = () => ({ registrar: jest.fn().mockResolvedValue(undefined) });

  it('crear y borrar un rol', async () => {
    const audit = auditMock();
    const prisma = {
      role: {
        findFirst: jest.fn(({ where }: { where: { name?: unknown } }) => Promise.resolve(where.name ? null : { id: 'r-1', name: 'Encargado', isDefault: false })),
        create: jest.fn().mockResolvedValue({ id: 'r-1', name: 'Encargado', rolePermissions: [], _count: { members: 0 } }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      permission: { findMany: jest.fn().mockResolvedValue([{ code: 'catalog.view' }]) },
    };
    const svc = new RolesService(prisma as any, audit as any);
    await svc.create(BIZ, { name: 'Encargado', permissions: ['catalog.view'] }, 'm-owner');
    await svc.remove(BIZ, 'r-1', 'm-owner');
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'role', action: 'CREATE', memberId: 'm-owner' }));
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'role', action: 'DELETE', entityId: 'r-1' }));
  });

  it('sacar a alguien del equipo', async () => {
    const audit = auditMock();
    const prisma = {
      member: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm-2', name: 'Juan', role: { id: 'r', name: 'empleado' } }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      passwordResetToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    await new MembersService(prisma as any, {} as any, audit as any).remove(BIZ, 'm-2', 'm-owner');
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'member', action: 'DELETE', memberId: 'm-owner',
      changes: [{ field: 'name', before: 'Juan', after: null }, { field: 'role', before: 'empleado', after: null }],
    }));
  });

  it('pausar la tienda', async () => {
    const audit = auditMock();
    const prisma = {
      platformAdminLog: { findFirst: jest.fn() },
      subscription: { findUnique: jest.fn() },
      business: { update: jest.fn().mockResolvedValue({ isPaused: true }) },
    };
    await new BusinessesService(prisma as any, {} as any, {} as any, {} as any, audit as any).pause(BIZ, true, 'm-owner');
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'business', action: 'DEACTIVATE', memberId: 'm-owner' }));
  });

  it('borrar un producto', async () => {
    const audit = auditMock();
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Remera' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    await new ProductsService(prisma as any, {} as any, {} as any, audit as any).remove(BIZ, 'p-1', 'm-1');
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'product', action: 'DELETE', changes: [{ field: 'name', before: 'Remera', after: null }],
    }));
  });
});
