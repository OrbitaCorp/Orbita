import { UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomersService } from '../../src/customers/customers.service';
import { CustomersController } from '../../src/customers/customers.controller';
import { AddressesService } from '../../src/customers/addresses.service';
import { FindCustomersQueryDto } from '../../src/customers/dto/find-customers-query.dto';
import { UpsertAddressDto } from '../../src/customers/dto/upsert-address.dto';
import { escaparHtml } from '../../src/common/utils/html';
import { AuditService } from '../../src/audit/audit.service';

// Auditoría interna 2026-09-10, ítem `api.customers`.
//
// - Exportar la lista de clientes (email, teléfono, DNI) no dejaba ningún
//   registro: el panel la armaba paginando GET /customers.
// - El mail masivo metía el texto del dueño y las variables (incluido el
//   nombre que escribe el CLIENTE) crudos en el HTML.
// - Topes en la búsqueda y las direcciones; escrituras con el dueño en el where.

const BIZ = 'biz-1';
const cliente = (extra: Record<string, unknown> = {}) => ({
  id: 'c-1', firstName: 'Ana', lastName: 'Paz', email: 'ana@x.com', phone: null, dni: null,
  passwordHash: '$argon2id$secreto', createdAt: new Date('2026-09-01'), ...extra,
});

function clientes(lista: unknown[] = [cliente()]) {
  const prisma = {
    customer: {
      findMany: jest.fn().mockResolvedValue(lista),
      findFirst: jest.fn().mockResolvedValue(cliente()),
      update: jest.fn().mockResolvedValue({ id: 'c-1' }),
    },
    order: { groupBy: jest.fn().mockResolvedValue([]) },
    member: { findFirst: jest.fn().mockResolvedValue({ name: 'Dueña' }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const mail = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
  const svc = new CustomersService(prisma as any, mail as any, { emit: jest.fn() } as any, new AuditService(prisma as any));
  return { svc, prisma, mail };
}

describe('Exportar clientes deja registro', () => {
  it('devuelve la lista del negocio sin el hash de la contraseña y registra quién la bajó', async () => {
    const { svc, prisma } = clientes();
    const r = await svc.exportAll(BIZ, 'm-1');
    expect(r.total).toBe(1);
    expect(r.data[0]).not.toHaveProperty('passwordHash');
    expect(r.data[0]).toMatchObject({ hasAccount: true, email: 'ana@x.com' });
    expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ, deletedAt: null } }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BIZ, entityType: 'customer_export', action: 'CREATE', memberId: 'm-1', memberName: 'Dueña',
        changes: [{ field: 'clientes_exportados', before: null, after: 1 }],
      }),
    });
  });

  it('con búsqueda exporta lo mismo que se ve y la búsqueda queda en el registro', async () => {
    const { svc, prisma } = clientes();
    await svc.exportAll(BIZ, 'm-1', 'ana');
    expect(prisma.customer.findMany.mock.calls[0][0].where).toMatchObject({ businessId: BIZ, OR: expect.any(Array) });
    expect(prisma.auditLog.create.mock.calls[0][0].data.changes).toContainEqual({ field: 'busqueda', before: null, after: 'ana' });
  });

  it('la ruta /customers/export está declarada antes que /customers/:id (si no, "export" sería un id)', () => {
    const metodos = Object.getOwnPropertyNames(CustomersController.prototype);
    expect(metodos.indexOf('exportAll')).toBeLessThan(metodos.indexOf('findOne'));
  });
});

describe('Mail a clientes: nada crudo en el HTML', () => {
  it('el nombre que escribió el cliente y el texto del dueño llegan escapados; los saltos de línea como <br/>', async () => {
    const { svc, mail } = clientes([cliente({ firstName: '<a href="https://phishing.test">Ana</a>' })]);
    await svc.sendEmail(BIZ, { customerIds: ['c-1'], subject: 'Hola {nombre}', body: 'Hola {nombre}\n<b>oferta</b>' });
    const [, asunto, cuerpo] = mail.sendCustomEmail.mock.calls[0];
    expect(cuerpo).toBe(`Hola ${escaparHtml('<a href="https://phishing.test">Ana</a>')}<br/>&lt;b&gt;oferta&lt;/b&gt;`);
    expect(cuerpo).not.toContain('<a href');
    // El asunto es texto plano (encabezado del mail): lo escapa MailService al meterlo en el HTML.
    expect(asunto).toBe('Hola <a href="https://phishing.test">Ana</a>');
  });

  it('escaparHtml cubre los cinco caracteres', () => {
    expect(escaparHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('Escrituras con el dueño en el where', () => {
  it('editar un cliente escribe con { id, businessId }', async () => {
    const { svc, prisma } = clientes();
    await svc.update(BIZ, 'c-1', { firstName: 'Ana' });
    expect(prisma.customer.update.mock.calls[0][0].where).toEqual({ id: 'c-1', businessId: BIZ });
  });

  function direcciones(guardadas: number) {
    const prisma = {
      address: {
        count: jest.fn().mockResolvedValue(guardadas),
        findFirst: jest.fn().mockResolvedValue({ id: 'a-1' }),
        create: jest.fn().mockResolvedValue({ id: 'a-nueva' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    return { svc: new AddressesService(prisma as any), prisma };
  }

  it('un cliente no guarda más de 20 direcciones', async () => {
    const { svc, prisma } = direcciones(20);
    await expect(svc.create('c-1', { street: 'Calle 1', city: 'CABA' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.address.create).not.toHaveBeenCalled();
  });

  it('editar y borrar una dirección escriben con { id, customerId }', async () => {
    const { svc, prisma } = direcciones(1);
    await svc.update('c-1', 'a-1', { street: 'Calle 2', city: 'CABA' });
    await svc.remove('c-1', 'a-1');
    expect(prisma.address.update.mock.calls[0][0].where).toEqual({ id: 'a-1', customerId: 'c-1' });
    expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 'a-1', customerId: 'c-1' } });
  });
});

describe('DTOs', () => {
  const props = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('la búsqueda y la dirección tienen topes', async () => {
    expect(await props(FindCustomersQueryDto, { search: 'x'.repeat(101) })).toContain('search');
    expect(await props(UpsertAddressDto, { street: 'x'.repeat(201), city: 'CABA' })).toContain('street');
    expect(await props(UpsertAddressDto, { street: '', city: 'CABA' })).toContain('street');
    expect(await props(UpsertAddressDto, { street: 'Av. Corrientes 1234', city: 'CABA', zip: '1043' })).toEqual([]);
  });
});
