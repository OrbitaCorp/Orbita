import { NotFoundException } from '@nestjs/common';
import { MessageTemplatesService } from '../../src/message-templates/message-templates.service';

// Unit test del CRUD de plantillas de mensaje (RBT-657) — antes un stub que
// devolvía { message: 'not implemented' } en los 4 endpoints.

function svcCon() {
  const template = { id: 't-1', name: 'Pedido confirmado', text: 'Hola {nombre}!', category: 'PEDIDO', createdAt: new Date(), updatedAt: new Date() };
  const prisma = {
    messageTemplate: {
      findMany: jest.fn().mockResolvedValue([template]),
      create: jest.fn().mockResolvedValue(template),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...template, name: 'Actualizada' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const svc = new MessageTemplatesService(prisma as any);
  return { svc, prisma };
}

describe('MessageTemplatesService (unit)', () => {
  it('findAll() lista las plantillas del negocio', async () => {
    const { svc, prisma } = svcCon();
    const result = await svc.findAll('biz-1');
    expect(prisma.messageTemplate.findMany.mock.calls[0][0].where).toEqual({ businessId: 'biz-1' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Pedido confirmado');
  });

  it('create() crea la plantilla scopeada al negocio', async () => {
    const { svc, prisma } = svcCon();
    await svc.create('biz-1', { name: 'Nueva', text: 'Hola', category: 'OTRO' } as any);
    expect(prisma.messageTemplate.create.mock.calls[0][0].data).toMatchObject({ businessId: 'biz-1', name: 'Nueva' });
  });

  it('update() tira 404 si la plantilla no existe (o es de otro negocio)', async () => {
    const { svc, prisma } = svcCon();
    prisma.messageTemplate.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.update('biz-1', 't-ajena', { name: 'X', text: 'Y', category: 'OTRO' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove() tira 404 si la plantilla no existe (o es de otro negocio)', async () => {
    const { svc, prisma } = svcCon();
    prisma.messageTemplate.deleteMany.mockResolvedValue({ count: 0 });
    await expect(svc.remove('biz-1', 't-ajena')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove() confirma ok cuando sí borra', async () => {
    const { svc } = svcCon();
    await expect(svc.remove('biz-1', 't-1')).resolves.toEqual({ ok: true });
  });
});
