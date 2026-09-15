import 'reflect-metadata';
import { HttpException, UnprocessableEntityException } from '@nestjs/common';
import { InventoryService } from '../../src/inventory/inventory.service';
import { BranchesService } from '../../src/branches/branches.service';
import { CategoriesService } from '../../src/categories/categories.service';
import { TagsService } from '../../src/tags/tags.service';
import { CustomersService, topeDiarioMailMasivo } from '../../src/customers/customers.service';
import { CustomersController } from '../../src/customers/customers.controller';

// Hallazgo `auditoria-acciones-sin-registro` (MEDIA), parte 2 de 3, y hallazgo
// `mail-masivo-sin-tope` (BAJA).
//
// Entradas y ajustes de stock, sucursales, categorías, etiquetas y la edición
// de clientes no dejaban rastro en audit_logs (stock_movements guarda el
// movimiento, pero no aparece en la pestaña Auditoría). Acá se verifica que
// cada servicio registra con el entityType/action que corresponde, con el
// actor y solo cuando algo cambió de verdad.
//
// Y el mail a clientes: el DTO cortaba cada POST en 500 destinatarios, pero
// nada impedía repetirlo. Ahora hay un tope por negocio y por día de
// Argentina (contando email_logs), un throttle propio en el endpoint y el
// envío queda en audit_logs (destinatarios y asunto, sin el cuerpo).

const BIZ = 'biz-1';
const ACTOR = 'm-1';

const auditMock = () => ({ registrar: jest.fn().mockResolvedValue(undefined) });
type AuditMock = ReturnType<typeof auditMock>;
const entradas = (audit: AuditMock) => audit.registrar.mock.calls.map((c) => c[0]);

// ── Inventario ───────────────────────────────────────────────────────────────

const VAR = '11111111-1111-4111-8111-111111111111';
const SUC = '22222222-2222-4222-8222-222222222222';

function inventario(opts: { existente?: { id: string; quantity: number } | null; despues?: number; count?: number } = {}) {
  const tx = {
    variantStock: {
      findUnique: jest.fn().mockResolvedValue(opts.existente === undefined ? { id: 'vs-1', quantity: 4, stockMin: 0 } : opts.existente),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'vs-1', quantity: opts.despues ?? 14, stockMin: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: opts.count ?? 1 }),
      create: jest.fn().mockResolvedValue({ id: 'vs-nuevo', quantity: 5, stockMin: 0 }),
    },
    stockMovement: { create: jest.fn().mockResolvedValue({ id: 'mov-1', variantId: VAR, type: 'ENTRADA', quantity: 10, reason: 'r', supplierId: null, createdAt: new Date() }) },
    productVariant: { findUnique: jest.fn().mockResolvedValue({ product: { name: 'Remera' }, optionValues: [{ optionValue: { value: 'Roja' } }] }) },
  };
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: SUC }) },
    productVariant: { findFirst: jest.fn().mockResolvedValue({ id: VAR }) },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  const audit = auditMock();
  const emitter = { emit: jest.fn() };
  return { svc: new InventoryService(prisma as any, emitter as any, audit as any), tx, audit, emitter };
}

describe('Inventario: entradas y ajustes de stock', () => {
  it('una entrada registra UPDATE sobre la variante con la cantidad antes → después, el tipo y el motivo', async () => {
    const { svc, audit } = inventario();
    await svc.entry(BIZ, ACTOR, { variantId: VAR, quantity: 10, reason: 'Llegó pedido' });
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'inventory', entityId: VAR, action: 'UPDATE',
      changes: [
        { field: 'quantity', before: 4, after: 14 },
        { field: 'type', before: null, after: 'ENTRADA' },
        { field: 'reason', before: null, after: 'r' },
        { field: 'product', before: null, after: 'Remera / Roja' },
        { field: 'branchId', before: null, after: SUC },
        { field: 'movementId', before: null, after: 'mov-1' },
      ],
    });
  });

  it('sin fila de stock previa, el "antes" es 0', async () => {
    const { svc, audit } = inventario({ existente: null });
    await svc.entry(BIZ, ACTOR, { variantId: VAR, quantity: 5 });
    expect(entradas(audit)[0].changes[0]).toEqual({ field: 'quantity', before: 0, after: 5 });
  });

  it('un ajuste negativo que no pudo aplicarse (stock insuficiente) no registra nada', async () => {
    const { svc, tx, audit } = inventario({ count: 0 });
    await expect(svc.adjustment(BIZ, ACTOR, { variantId: VAR, quantity: -1, reason: 'rotura' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('la respuesta al panel no cambia: el "antes" es solo para el registro', async () => {
    const { svc } = inventario();
    const r = await svc.entry(BIZ, ACTOR, { variantId: VAR, quantity: 10 });
    expect(r).not.toHaveProperty('quantityBefore');
    expect(r).toMatchObject({ id: 'mov-1', newQuantity: 14 });
  });
});

// ── Sucursales ───────────────────────────────────────────────────────────────

const SUCURSAL = { id: 'b-1', businessId: BIZ, name: 'Centro', address: 'Av. Siempreviva 742', latitude: null, longitude: null, isActive: true, isDefault: false };

function sucursales(opts: { existente?: Partial<typeof SUCURSAL>; actualizada?: Partial<typeof SUCURSAL> } = {}) {
  const fila = { ...SUCURSAL, ...opts.existente };
  const prisma = {
    branch: {
      findFirst: jest.fn().mockResolvedValueOnce(fila).mockResolvedValue({ ...fila, ...opts.actualizada }),
      create: jest.fn().mockResolvedValue(fila),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const audit = auditMock();
  return { svc: new BranchesService(prisma as any, audit as any), prisma, audit };
}

describe('Sucursales: alta, edición y baja', () => {
  it('crear registra CREATE con el actor, el nombre y la dirección', async () => {
    const { svc, audit } = sucursales();
    await svc.create(BIZ, { name: 'Centro', address: 'Av. Siempreviva 742' }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'branch', entityId: 'b-1', action: 'CREATE',
      changes: [
        { field: 'name', before: null, after: 'Centro' },
        { field: 'address', before: null, after: 'Av. Siempreviva 742' },
        { field: 'isActive', before: null, after: true },
      ],
    });
  });

  it('editar registra UPDATE solo con lo que cambió', async () => {
    const { svc, audit } = sucursales({ actualizada: { name: 'Centro 2', isActive: false } });
    await svc.update(BIZ, 'b-1', { name: 'Centro 2', isActive: false }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'branch', entityId: 'b-1', action: 'UPDATE',
      changes: [{ field: 'name', before: 'Centro', after: 'Centro 2' }, { field: 'isActive', before: true, after: false }],
    });
  });

  it('editar sin cambiar nada no suma una fila', async () => {
    const { svc, audit } = sucursales();
    await svc.update(BIZ, 'b-1', { name: 'Centro' }, ACTOR);
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('borrar registra DELETE con el nombre que se fue', async () => {
    const { svc, audit } = sucursales();
    await svc.remove(BIZ, 'b-1', ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'branch', entityId: 'b-1', action: 'DELETE',
      changes: [{ field: 'name', before: 'Centro', after: null }],
    });
  });

  it('la principal no se puede borrar y no queda registro', async () => {
    const { svc, prisma, audit } = sucursales({ existente: { isDefault: true } });
    await expect(svc.remove(BIZ, 'b-1', ACTOR)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.branch.deleteMany).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });
});

// ── Categorías ───────────────────────────────────────────────────────────────

const CATEGORIA = { id: 'cat-1', businessId: BIZ, name: 'Remeras', slug: 'remeras', icon: null, color: null, imageUrl: null, parentId: null, isActive: true, position: 0 };

function categorias(opts: { actualizada?: Partial<typeof CATEGORIA>; productos?: number } = {}) {
  const prisma = {
    category: {
      findFirst: jest.fn().mockResolvedValueOnce(CATEGORIA).mockResolvedValue({ ...CATEGORIA, ...opts.actualizada }),
      findMany: jest.fn().mockResolvedValue([{ id: 'cat-1', parentId: null }]),
      create: jest.fn().mockResolvedValue(CATEGORIA),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    product: { count: jest.fn().mockResolvedValue(opts.productos ?? 0) },
  };
  const audit = auditMock();
  return { svc: new CategoriesService(prisma as any, audit as any), prisma, audit };
}

describe('Categorías: alta, edición y baja', () => {
  it('crear registra CREATE con el actor, nombre y slug', async () => {
    const { svc, audit } = categorias();
    await svc.create(BIZ, { name: 'Remeras' }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'category', entityId: 'cat-1', action: 'CREATE',
      changes: [{ field: 'name', before: null, after: 'Remeras' }, { field: 'slug', before: null, after: 'remeras' }, { field: 'isActive', before: null, after: true }],
    });
  });

  it('editar registra UPDATE solo con lo que cambió (nombre y slug)', async () => {
    const { svc, audit } = categorias({ actualizada: { name: 'Remeras lisas', slug: 'remeras-lisas' } });
    await svc.update(BIZ, 'cat-1', { name: 'Remeras lisas' }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'category', entityId: 'cat-1', action: 'UPDATE',
      changes: [{ field: 'name', before: 'Remeras', after: 'Remeras lisas' }, { field: 'slug', before: 'remeras', after: 'remeras-lisas' }],
    });
  });

  it('editar sin cambiar nada no suma una fila', async () => {
    const { svc, audit } = categorias();
    await svc.update(BIZ, 'cat-1', { name: 'Remeras' }, ACTOR);
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('borrar registra DELETE; si tiene productos no se borra ni se registra', async () => {
    const { svc, audit } = categorias();
    await svc.remove(BIZ, 'cat-1', ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'category', entityId: 'cat-1', action: 'DELETE',
      changes: [{ field: 'name', before: 'Remeras', after: null }],
    });

    const conProductos = categorias({ productos: 3 });
    await expect(conProductos.svc.remove(BIZ, 'cat-1', ACTOR)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(conProductos.prisma.category.deleteMany).not.toHaveBeenCalled();
    expect(conProductos.audit.registrar).not.toHaveBeenCalled();
  });
});

// ── Etiquetas ────────────────────────────────────────────────────────────────

function etiquetas() {
  const fila = { id: 't-1', businessId: BIZ, name: 'Verano', createdAt: new Date() };
  const prisma = {
    tag: {
      // Primera lectura: el existente; la segunda (chequeo de nombre repetido): nada.
      findFirst: jest.fn().mockResolvedValueOnce(fila).mockResolvedValueOnce(null).mockResolvedValue(fila),
      create: jest.fn().mockResolvedValue(fila),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const audit = auditMock();
  return { svc: new TagsService(prisma as any, audit as any), prisma, audit };
}

describe('Etiquetas: alta, edición y baja', () => {
  it('crear registra CREATE con el nombre', async () => {
    const { svc, prisma, audit } = etiquetas();
    prisma.tag.findFirst.mockReset().mockResolvedValue(null); // sin repetida
    await svc.create(BIZ, { name: 'Verano' }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'tag', entityId: 't-1', action: 'CREATE',
      changes: [{ field: 'name', before: null, after: 'Verano' }],
    });
  });

  it('renombrar registra UPDATE con antes y después; el mismo nombre no registra', async () => {
    const { svc, audit } = etiquetas();
    await svc.update(BIZ, 't-1', { name: 'Verano 2026' }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'tag', entityId: 't-1', action: 'UPDATE',
      changes: [{ field: 'name', before: 'Verano', after: 'Verano 2026' }],
    });

    const igual = etiquetas();
    await igual.svc.update(BIZ, 't-1', { name: 'Verano' }, ACTOR);
    expect(igual.audit.registrar).not.toHaveBeenCalled();
  });

  it('borrar registra DELETE con el nombre que se fue', async () => {
    const { svc, audit } = etiquetas();
    await svc.remove(BIZ, 't-1', ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'tag', entityId: 't-1', action: 'DELETE',
      changes: [{ field: 'name', before: 'Verano', after: null }],
    });
  });
});

// ── Clientes: edición ────────────────────────────────────────────────────────

const CLIENTE = {
  id: 'c-1', businessId: BIZ, firstName: 'Ana', lastName: 'Paz', email: 'ana@x.com', phone: null, dni: null,
  passwordHash: '$argon2id$secreto', createdAt: new Date('2026-09-01'), deletedAt: null,
};

function clientes(opts: { lista?: unknown[]; enviadosHoy?: number; salio?: boolean } = {}) {
  const prisma = {
    customer: {
      findMany: jest.fn().mockResolvedValue(opts.lista ?? [CLIENTE]),
      findFirst: jest.fn().mockResolvedValue(CLIENTE),
      update: jest.fn().mockResolvedValue({ id: 'c-1' }),
    },
    order: { groupBy: jest.fn().mockResolvedValue([]) },
    emailLog: { count: jest.fn().mockResolvedValue(opts.enviadosHoy ?? 0) },
  };
  const mail = { sendCustomEmail: jest.fn().mockResolvedValue(opts.salio ?? true) };
  const audit = auditMock();
  const svc = new CustomersService(prisma as any, mail as any, { emit: jest.fn() } as any, audit as any);
  return { svc, prisma, mail, audit };
}

describe('Clientes: edición desde el panel', () => {
  it('cambiar email y teléfono registra UPDATE con antes y después, sin el hash', async () => {
    const { svc, audit } = clientes();
    await svc.update(BIZ, 'c-1', { firstName: 'Ana', lastName: 'Paz', email: 'ana@nuevo.com', phone: '1155556666' }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'customer', entityId: 'c-1', action: 'UPDATE',
      changes: [{ field: 'email', before: 'ana@x.com', after: 'ana@nuevo.com' }, { field: 'phone', before: null, after: '1155556666' }],
    });
    expect(JSON.stringify(entradas(audit))).not.toContain('argon2id');
  });

  it('guardar sin cambios no suma una fila', async () => {
    const { svc, audit } = clientes();
    await svc.update(BIZ, 'c-1', { firstName: 'Ana', lastName: 'Paz', email: 'ana@x.com' }, ACTOR);
    expect(audit.registrar).not.toHaveBeenCalled();
  });
});

// ── Mail masivo: tope diario, throttle y registro ────────────────────────────

const muchos = (n: number) => Array.from({ length: n }, (_, i) => ({ ...CLIENTE, id: `c-${i}`, email: `c${i}@x.com` }));

describe('Mail a clientes: tope diario por negocio (hallazgo mail-masivo-sin-tope)', () => {
  const TOPE = process.env.MAIL_MASIVO_TOPE_DIARIO;
  afterEach(() => {
    if (TOPE === undefined) delete process.env.MAIL_MASIVO_TOPE_DIARIO;
    else process.env.MAIL_MASIVO_TOPE_DIARIO = TOPE;
  });

  it('el tope sale de MAIL_MASIVO_TOPE_DIARIO, con 500 por defecto y nunca menos de 50', () => {
    delete process.env.MAIL_MASIVO_TOPE_DIARIO;
    expect(topeDiarioMailMasivo()).toBe(500);
    process.env.MAIL_MASIVO_TOPE_DIARIO = '1000';
    expect(topeDiarioMailMasivo()).toBe(1000);
    process.env.MAIL_MASIVO_TOPE_DIARIO = '5';
    expect(topeDiarioMailMasivo()).toBe(50);
    process.env.MAIL_MASIVO_TOPE_DIARIO = 'cualquier cosa';
    expect(topeDiarioMailMasivo()).toBe(500);
  });

  it('cuenta los mails personalizados del negocio desde las 00:00 de Argentina de hoy', async () => {
    const { svc, prisma } = clientes();
    await svc.sendEmail(BIZ, { customerIds: ['c-1'], subject: 'Hola', body: 'x' }, ACTOR);
    const where = prisma.emailLog.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ businessId: BIZ, template: null });
    const desde: Date = where.createdAt.gte;
    // 00:00 de Buenos Aires es 03:00 UTC, y es de hoy (no más de 24 h atrás).
    expect(desde.getUTCHours()).toBe(3);
    expect(desde.getUTCMinutes()).toBe(0);
    expect(Date.now() - desde.getTime()).toBeGreaterThanOrEqual(0);
    expect(Date.now() - desde.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it('tope alcanzado: 429 con un mensaje claro, no sale ningún mail ni se registra nada', async () => {
    delete process.env.MAIL_MASIVO_TOPE_DIARIO;
    const { svc, mail, audit } = clientes({ lista: muchos(20), enviadosHoy: 490 });
    const err = await svc.sendEmail(BIZ, { customerIds: ['x'], subject: 'Oferta', body: 'x' }, ACTOR).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect((err as HttpException).message).toContain('20 clientes');
    expect((err as HttpException).message).toContain('490');
    expect((err as HttpException).message).toContain('quedan 10');
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('justo en el tope pasa; uno más, no', async () => {
    delete process.env.MAIL_MASIVO_TOPE_DIARIO;
    const justo = clientes({ lista: muchos(10), enviadosHoy: 490 });
    await expect(justo.svc.sendEmail(BIZ, { customerIds: ['x'], subject: 'Oferta', body: 'x' }, ACTOR)).resolves.toEqual({ sent: 10 });
    const unoMas = clientes({ lista: muchos(11), enviadosHoy: 490 });
    await expect(unoMas.svc.sendEmail(BIZ, { customerIds: ['x'], subject: 'Oferta', body: 'x' }, ACTOR)).rejects.toBeInstanceOf(HttpException);
  });

  it('el tope configurado por env se respeta', async () => {
    process.env.MAIL_MASIVO_TOPE_DIARIO = '100';
    const { svc, mail } = clientes({ lista: muchos(5), enviadosHoy: 98 });
    await expect(svc.sendEmail(BIZ, { customerIds: ['x'], subject: 'Oferta', body: 'x' }, ACTOR)).rejects.toBeInstanceOf(HttpException);
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });

  it('por debajo del tope manda y registra CREATE customer_email con destinatarios, enviados y asunto, sin el cuerpo', async () => {
    delete process.env.MAIL_MASIVO_TOPE_DIARIO;
    const { svc, mail, audit } = clientes({ lista: muchos(3), enviadosHoy: 10 });
    await expect(svc.sendEmail(BIZ, { customerIds: ['x'], subject: 'Oferta de {nombre}', body: 'Cuerpo secreto del mail' }, ACTOR)).resolves.toEqual({ sent: 3 });
    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(3);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'customer_email', entityId: BIZ, action: 'CREATE',
      changes: [
        { field: 'destinatarios', before: null, after: 3 },
        { field: 'enviados', before: null, after: 3 },
        { field: 'asunto', before: null, after: 'Oferta de {nombre}' },
      ],
    });
    expect(JSON.stringify(entradas(audit))).not.toContain('Cuerpo secreto');
  });

  it('si el proveedor rechaza, "enviados" refleja lo que salió de verdad', async () => {
    const { svc, audit } = clientes({ lista: muchos(2), salio: false });
    await svc.sendEmail(BIZ, { customerIds: ['x'], subject: 'Oferta', body: 'x' }, ACTOR);
    expect(entradas(audit)[0].changes).toContainEqual({ field: 'enviados', before: null, after: 0 });
  });

  it('sin destinatarios con email no consulta el tope ni registra', async () => {
    const { svc, prisma, audit } = clientes({ lista: [] });
    await expect(svc.sendEmail(BIZ, { customerIds: ['x'], subject: 'Oferta', body: 'x' }, ACTOR)).resolves.toEqual({ sent: 0 });
    expect(prisma.emailLog.count).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('POST /customers/email tiene throttle propio: 30 por hora', () => {
    const metodo = CustomersController.prototype.sendEmail;
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', metodo)).toBe(30);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', metodo)).toBe(3600000);
  });
});
