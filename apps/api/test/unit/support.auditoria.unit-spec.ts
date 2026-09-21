// @Type() de los adjuntos necesita Reflect.getMetadata antes de importar el DTO.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendSupportRequestDto } from '../../src/support/dto/send-support-request.dto';
import { SupportService } from '../../src/support/support.service';

// Auditoría interna 10/09, ítem api.support: el destino es fijo, el miembro
// se resuelve dentro de su negocio y los largos se miden sin espacios.
//
// Desde el 21/09 la consulta se guarda en la base y el mail es un aviso: lo
// que antes era "si el mail no sale → 422" ahora es "la consulta queda igual"
// (ver support.historial.unit-spec.ts para el resto del flujo nuevo).

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

const FECHA = new Date('2026-09-21T10:00:00.000Z');
const consultaGuardada = () => ({
  id: 'req-1',
  number: 12,
  category: 'OTRO',
  subject: 'Hola',
  status: 'OPEN',
  contactPhone: null,
  businessId: 'biz',
  memberId: 'm1',
  createdAt: FECHA,
  lastMessageAt: FECHA,
  business: { id: 'biz', name: 'Tienda', subdomain: 'tienda' },
  member: { id: 'm1', name: 'Ana', email: 'ana@x.com' },
  _count: { messages: 1 },
  messages: [{ id: 'msg-1', author: 'MEMBER', body: 'mensaje de prueba', attachments: [], createdAt: FECHA, member: { name: 'Ana' }, admin: null }],
});

describe('SupportService.create', () => {
  function armar(salio = true) {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ name: 'Tienda', subdomain: 'tienda' }) },
      member: { findFirst: jest.fn().mockResolvedValue({ name: 'Ana', email: 'ana@x.com' }) },
      supportRequest: { create: jest.fn().mockResolvedValue(consultaGuardada()) },
    };
    const mail = { sendSupportRequest: jest.fn().mockResolvedValue(salio) };
    const supabase = { adminClient: { storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/business-logos/${p}` } }) }) } } };
    return { svc: new SupportService(prisma as any, mail as any, supabase as any), prisma, mail };
  }
  const dto = { category: 'OTRO' as const, subject: 'Hola', message: 'mensaje de prueba' };

  it('manda siempre a soporte@orbita.site y resuelve el miembro dentro del negocio', async () => {
    const { svc, prisma, mail } = armar();
    await svc.create('biz', 'm1', dto);
    expect(prisma.member.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'm1', businessId: 'biz' } }));
    expect(mail.sendSupportRequest.mock.calls[0][0]).toBe('soporte@orbita.site');
    // El aviso lleva el número de la consulta guardada y Reply-To al miembro
    // lo arma MailService a partir de memberEmail.
    expect(mail.sendSupportRequest.mock.calls[0][1]).toEqual(expect.objectContaining({ number: 12, memberEmail: 'ana@x.com', isReply: false }));
  });

  it('un miembro de otro negocio no se resuelve → 404, sin guardar ni mandar mail', async () => {
    const { svc, prisma, mail } = armar();
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(svc.create('biz', 'm-ajeno', dto)).rejects.toThrow('No se pudo resolver');
    expect(prisma.supportRequest.create).not.toHaveBeenCalled();
    expect(mail.sendSupportRequest).not.toHaveBeenCalled();
  });

  it('si el mail no sale, la consulta queda guardada igual (antes era un 422 y se perdía)', async () => {
    const { svc, prisma } = armar(false);
    const detalle = await svc.create('biz', 'm1', dto);
    expect(prisma.supportRequest.create).toHaveBeenCalledTimes(1);
    expect(detalle).toEqual(expect.objectContaining({ id: 'req-1', number: 12, status: 'OPEN' }));
  });
});
