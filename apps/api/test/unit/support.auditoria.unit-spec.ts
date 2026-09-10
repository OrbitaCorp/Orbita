import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendSupportRequestDto } from '../../src/support/dto/send-support-request.dto';
import { SupportService } from '../../src/support/support.service';

// Auditoría interna 10/09, ítem api.support: el destino es fijo, el miembro
// se resuelve dentro de su negocio y los largos se miden sin espacios.

const errores = async (body: object) =>
  (await validate(plainToInstance(SendSupportRequestDto, body))).map((e) => e.property);

describe('SendSupportRequestDto', () => {
  it('mide los mínimos sin contar espacios', async () => {
    expect(await errores({ category: 'OTRO', subject: '   a   ', message: '    corto    ' })).toEqual(['subject', 'message']);
  });
  it('acepta una consulta común y la recorta', async () => {
    const dto = plainToInstance(SendSupportRequestDto, { category: 'TECNICO', subject: ' No carga ', message: ' La tienda no carga desde ayer ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.subject).toBe('No carga');
  });
  it('rechaza categorías fuera de la lista', async () => {
    expect(await errores({ category: 'ROOT', subject: 'Hola', message: 'mensaje de prueba' })).toEqual(['category']);
  });
});

describe('SupportService.send', () => {
  function armar(salio = true) {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ name: 'Tienda', subdomain: 'tienda' }) },
      member: { findFirst: jest.fn().mockResolvedValue({ name: 'Ana', email: 'ana@x.com' }) },
    };
    const mail = { sendSupportRequest: jest.fn().mockResolvedValue(salio) };
    return { svc: new SupportService(prisma as any, mail as any), prisma, mail };
  }
  const dto = { category: 'OTRO' as const, subject: 'Hola', message: 'mensaje de prueba' };

  it('manda siempre a soporte@orbita.site y resuelve el miembro dentro del negocio', async () => {
    const { svc, prisma, mail } = armar();
    await svc.send('biz', 'm1', dto);
    expect(prisma.member.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'm1', businessId: 'biz' } }));
    expect(mail.sendSupportRequest.mock.calls[0][0]).toBe('soporte@orbita.site');
  });

  it('un miembro de otro negocio no se resuelve → 404, sin mail', async () => {
    const { svc, prisma, mail } = armar();
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(svc.send('biz', 'm-ajeno', dto)).rejects.toThrow('No se pudo resolver');
    expect(mail.sendSupportRequest).not.toHaveBeenCalled();
  });

  it('si el mail no sale → 422 genérico', async () => {
    const { svc } = armar(false);
    await expect(svc.send('biz', 'm1', dto)).rejects.toThrow('No se pudo enviar tu consulta');
  });
});
