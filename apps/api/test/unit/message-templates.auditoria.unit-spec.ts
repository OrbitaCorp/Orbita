import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertMessageTemplateDto } from '../../src/message-templates/dto/upsert-message-template.dto';
import { MAX_PLANTILLAS_POR_NEGOCIO, MessageTemplatesService } from '../../src/message-templates/message-templates.service';

// Auditoría interna 10/09, ítem api.message-templates: largos validados, tope
// de plantillas por negocio y todo filtrado por el negocio del token.

const errores = async (body: object) =>
  (await validate(plainToInstance(UpsertMessageTemplateDto, body))).map((e) => e.property);

describe('UpsertMessageTemplateDto', () => {
  it('acepta una plantilla común y recorta espacios', async () => {
    const dto = plainToInstance(UpsertMessageTemplateDto, { name: '  Pedido listo ', text: ' Hola {nombre}! ', category: 'PEDIDO' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Pedido listo');
    expect(dto.text).toBe('Hola {nombre}!');
  });
  it('rechaza nombre o texto vacíos (o de solo espacios)', async () => {
    expect(await errores({ name: '   ', text: '', category: 'OTRO' })).toEqual(['name', 'text']);
  });
  it('rechaza nombre de más de 80 y texto de más de 5000', async () => {
    expect(await errores({ name: 'n'.repeat(81), text: 't'.repeat(5001), category: 'OTRO' })).toEqual(['name', 'text']);
  });
  it('rechaza una categoría fuera de la lista', async () => {
    expect(await errores({ name: 'a', text: 'b', category: 'SPAM' })).toEqual(['category']);
  });
});

describe('MessageTemplatesService', () => {
  const dto = { name: 'a', text: 'b', category: 'OTRO' };
  const fila = { id: 't1', name: 'a', text: 'b', category: 'OTRO', createdAt: new Date(), updatedAt: new Date() };

  function armar(cantidad: number) {
    const prisma = {
      messageTemplate: {
        count: jest.fn().mockResolvedValue(cantidad),
        create: jest.fn().mockResolvedValue(fila),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest.fn().mockResolvedValue(fila),
      },
    };
    return { svc: new MessageTemplatesService(prisma as any), prisma };
  }

  it(`no deja crear más de ${MAX_PLANTILLAS_POR_NEGOCIO} por negocio`, async () => {
    const { svc, prisma } = armar(MAX_PLANTILLAS_POR_NEGOCIO);
    await expect(svc.create('biz', dto)).rejects.toThrow('máximo');
    expect(prisma.messageTemplate.count).toHaveBeenCalledWith({ where: { businessId: 'biz' } });
    expect(prisma.messageTemplate.create).not.toHaveBeenCalled();
  });

  it('crea mientras haya lugar', async () => {
    const { svc, prisma } = armar(MAX_PLANTILLAS_POR_NEGOCIO - 1);
    await svc.create('biz', dto);
    expect(prisma.messageTemplate.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: 'biz' }) });
  });

  it('update escribe y relee filtrando por negocio', async () => {
    const { svc, prisma } = armar(0);
    await svc.update('biz', 't1', dto);
    expect(prisma.messageTemplate.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't1', businessId: 'biz' } }));
    expect(prisma.messageTemplate.findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 't1', businessId: 'biz' } });
  });
});
