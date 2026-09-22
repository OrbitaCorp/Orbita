import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SupportService } from '../../src/support/support.service';
import { SendSupportRequestDto } from '../../src/support/dto/send-support-request.dto';
import { ReplySupportRequestDto } from '../../src/support/dto/reply-support-request.dto';
import { ManualFeedbackDto } from '../../src/support/dto/manual-feedback.dto';
import { ListSupportQueryDto } from '../../src/support/dto/list-support-query.dto';
import { AdminReplyDto } from '../../src/support/dto/admin-reply.dto';
import { UpdateSupportStatusDto } from '../../src/support/dto/update-support-status.dto';

// Soporte con historial y adjuntos (21/09): la consulta vive en la base, el
// negocio y Órbita se escriben en un hilo, y el mail es un aviso que nunca
// hace fallar la operación.

const PUBLICO = 'https://x.supabase.co/storage/v1/object/public/business-logos';
const FECHA = new Date('2026-09-21T10:00:00.000Z');
const BIZ = 'biz-1';

const consulta = (over: Record<string, unknown> = {}) => ({
  id: 'req-1',
  number: 12,
  category: 'TECNICO',
  subject: 'No carga',
  status: 'OPEN',
  contactPhone: null,
  businessId: BIZ,
  memberId: 'm1',
  source: 'PANEL',
  hasAccount: true,
  contactName: null,
  contactEmail: null,
  createdAt: FECHA,
  lastMessageAt: FECHA,
  business: { id: BIZ, name: 'Tienda', subdomain: 'tienda' },
  member: { id: 'm1', name: 'Ana', email: 'ana@x.com' },
  _count: { messages: 1 },
  messages: [
    { id: 'msg-1', author: 'MEMBER', body: 'La tienda no carga desde ayer', attachments: [], createdAt: FECHA, member: { name: 'Ana' }, admin: null },
  ],
  ...over,
});

function armar() {
  const prisma = {
    business: { findUnique: jest.fn().mockResolvedValue({ name: 'Tienda', subdomain: 'tienda' }) },
    member: { findFirst: jest.fn().mockResolvedValue({ name: 'Ana', email: 'ana@x.com' }) },
    platformAdmin: { findUnique: jest.fn().mockResolvedValue({ name: 'Mateo', jobTitle: 'CTO' }) },
    supportRequest: {
      create: jest.fn().mockResolvedValue(consulta()),
      findMany: jest.fn().mockResolvedValue([consulta()]),
      findFirst: jest.fn().mockResolvedValue(consulta()),
      findUnique: jest.fn().mockResolvedValue(consulta()),
      update: jest.fn().mockResolvedValue(consulta()),
      count: jest.fn().mockResolvedValue(1),
      groupBy: jest.fn().mockResolvedValue([{ status: 'OPEN', _count: { _all: 2 } }, { status: 'CLOSED', _count: { _all: 1 } }]),
    },
    supportMessage: { create: jest.fn().mockResolvedValue({ id: 'msg-2' }) },
    platformAdminLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    manualFeedback: { upsert: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    // Forma array de $transaction: cada operación ya es una promesa resuelta
    // por su mock, alcanza con esperarlas todas.
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const mail = {
    sendSupportRequest: jest.fn().mockResolvedValue(true),
    sendSupportReply: jest.fn().mockResolvedValue(true),
  };
  const upload = jest.fn().mockResolvedValue({ error: null });
  const supabase = {
    adminClient: {
      storage: {
        from: () => ({
          getPublicUrl: (p: string) => ({ data: { publicUrl: `${PUBLICO}/${p}` } }),
          upload,
        }),
      },
    },
  };
  return { svc: new SupportService(prisma as any, mail as any, supabase as any), prisma, mail, upload };
}

const dtoNueva = { category: 'TECNICO' as const, subject: 'No carga', message: 'La tienda no carga desde ayer' };

describe('Panel: crear una consulta', () => {
  it('se guarda aunque el mail tire una excepción', async () => {
    const { svc, prisma, mail } = armar();
    mail.sendSupportRequest.mockRejectedValue(new Error('Resend caído'));
    const detalle = await svc.create(BIZ, 'm1', dtoNueva);
    expect(prisma.supportRequest.create).toHaveBeenCalledTimes(1);
    expect(detalle.messages).toHaveLength(1);
    expect(detalle.messages[0]).toEqual(expect.objectContaining({ author: 'MEMBER', authorName: 'Ana', attachments: [] }));
  });

  it('un adjunto con URL ajena (otro negocio o cualquier lado) → 400 y no se guarda nada', async () => {
    const { svc, prisma } = armar();
    const ajeno = { url: `${PUBLICO}/otro-negocio/soporte/a.webp`, name: 'a.webp' };
    await expect(svc.create(BIZ, 'm1', { ...dtoNueva, attachments: [ajeno] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create(BIZ, 'm1', { ...dtoNueva, attachments: [{ url: 'https://evil.example/x.png', name: 'x' }] })).rejects.toBeInstanceOf(BadRequestException);
    // Ni con el prefijo correcto y nada después, ni subiendo de carpeta.
    await expect(svc.create(BIZ, 'm1', { ...dtoNueva, attachments: [{ url: `${PUBLICO}/${BIZ}/soporte/`, name: 'x' }] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create(BIZ, 'm1', { ...dtoNueva, attachments: [{ url: `${PUBLICO}/${BIZ}/soporte/../logo.webp`, name: 'x' }] })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.supportRequest.create).not.toHaveBeenCalled();
  });

  it('un adjunto propio queda en el primer mensaje y va como link en el mail', async () => {
    const { svc, prisma, mail } = armar();
    const propio = { url: `${PUBLICO}/${BIZ}/soporte/abc.webp`, name: 'captura.png', size: 1234, type: 'image/webp' };
    await svc.create(BIZ, 'm1', { ...dtoNueva, attachments: [propio] });
    const data = prisma.supportRequest.create.mock.calls[0][0].data;
    expect(data.messages.create.attachments).toEqual([propio]);
    expect(mail.sendSupportRequest.mock.calls[0][1].attachments).toEqual([{ url: propio.url, name: 'captura.png' }]);
  });
});

describe('Panel: listar, leer y repreguntar', () => {
  it('el listado y el detalle filtran por el negocio del token', async () => {
    const { svc, prisma } = armar();
    const { data } = await svc.list(BIZ);
    expect(prisma.supportRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ } }));
    expect(data[0]).toEqual(expect.objectContaining({ number: 12, messagesCount: 1, member: { id: 'm1', name: 'Ana' } }));
    expect(data[0].lastMessage).toEqual({ author: 'MEMBER', excerpt: 'La tienda no carga desde ayer', createdAt: FECHA.toISOString() });
    // La fila del panel no lleva el negocio ni el email (eso es del admin).
    expect(data[0]).not.toHaveProperty('business');

    await svc.get(BIZ, 'req-1');
    expect(prisma.supportRequest.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'req-1', businessId: BIZ } }));
  });

  it('una consulta de otro negocio → 404', async () => {
    const { svc, prisma } = armar();
    prisma.supportRequest.findFirst.mockResolvedValue(null);
    await expect(svc.get(BIZ, 'req-de-otro')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.addMessage(BIZ, 'm1', 'req-de-otro', { message: 'sigue sin andar, che' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
  });

  it('repreguntar agrega un mensaje MEMBER, vuelve a OPEN y avisa con "Re:"', async () => {
    const { svc, prisma, mail } = armar();
    prisma.supportRequest.findFirst.mockResolvedValue({ id: 'req-1', number: 12, subject: 'No carga', category: 'TECNICO', contactPhone: null });
    await svc.addMessage(BIZ, 'm1', 'req-1', { message: 'Sigue sin andar desde hoy' });
    expect(prisma.supportMessage.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ requestId: 'req-1', author: 'MEMBER', memberId: 'm1' }));
    expect(prisma.supportRequest.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ status: 'OPEN', closedAt: null, lastMessageAt: expect.any(Date) }));
    expect(mail.sendSupportRequest.mock.calls[0][1]).toEqual(expect.objectContaining({ number: 12, isReply: true }));
  });

  it('el extracto del listado corta a 120 caracteres', async () => {
    const { svc, prisma } = armar();
    const largo = 'x'.repeat(300);
    prisma.supportRequest.findMany.mockResolvedValue([consulta({ messages: [{ author: 'ADMIN', body: largo, createdAt: FECHA }] })]);
    const { data } = await svc.list(BIZ);
    expect(data[0].lastMessage?.excerpt).toHaveLength(120);
    expect(data[0].lastMessage?.author).toBe('ADMIN');
  });
});

describe('Panel: subir un adjunto', () => {
  it('rechaza lo que no es imagen sin tocar Storage', async () => {
    const { svc, upload } = armar();
    await expect(svc.uploadAttachment(BIZ, { buffer: Buffer.from('%PDF'), mimetype: 'application/pdf', originalname: 'a.pdf' })).rejects.toBeInstanceOf(BadRequestException);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('Panel: opinión sobre el Manual', () => {
  it('upsertea por miembro y capítulo', async () => {
    const { svc, prisma } = armar();
    await svc.saveManualFeedback(BIZ, 'm1', { chapterId: 'pedidos', helpful: false, comment: '  No explica los envíos  ' });
    expect(prisma.manualFeedback.upsert).toHaveBeenCalledWith({
      where: { memberId_chapterId: { memberId: 'm1', chapterId: 'pedidos' } },
      create: { businessId: BIZ, memberId: 'm1', chapterId: 'pedidos', helpful: false, comment: 'No explica los envíos' },
      update: { helpful: false, comment: 'No explica los envíos' },
    });
    await svc.listManualFeedback(BIZ, 'm1');
    expect(prisma.manualFeedback.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { memberId: 'm1', businessId: BIZ } }));
  });
});

describe('Superadmin', () => {
  it('el listado busca en asunto y nombre del negocio, pagina y devuelve openCount global', async () => {
    const { svc, prisma } = armar();
    const r = await svc.adminList({ q: 'carga', status: 'OPEN', page: 2, limit: 10 });
    const args = prisma.supportRequest.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      status: 'OPEN',
      OR: [
        { subject: { contains: 'carga', mode: 'insensitive' } },
        { business: { name: { contains: 'carga', mode: 'insensitive' } } },
        { member: { is: { OR: [{ name: { contains: 'carga', mode: 'insensitive' } }, { email: { contains: 'carga', mode: 'insensitive' } }] } } },
        { contactName: { contains: 'carga', mode: 'insensitive' } },
        { contactEmail: { contains: 'carga', mode: 'insensitive' } },
      ],
    });
    expect(args).toEqual(expect.objectContaining({ skip: 10, take: 10, orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }] }));
    expect(prisma.supportRequest.count).toHaveBeenLastCalledWith({ where: { status: 'OPEN' } });
    expect(r).toEqual(expect.objectContaining({ total: 1, page: 2, limit: 10, openCount: 1 }));
    expect(r.data[0]).toEqual(expect.objectContaining({ source: 'PANEL', hasAccount: true, business: { id: BIZ, name: 'Tienda', subdomain: 'tienda' }, contact: { name: 'Ana', email: 'ana@x.com', memberId: 'm1' } }));
  });

  it('el resumen cuenta por estado y agrupa la opinión del manual por capítulo', async () => {
    const { svc, prisma } = armar();
    prisma.manualFeedback.findMany.mockResolvedValue([
      { chapterId: 'pedidos', helpful: true, comment: null, createdAt: FECHA, business: { name: 'Tienda' } },
      { chapterId: 'pedidos', helpful: false, comment: 'No explica envíos', createdAt: FECHA, business: { name: 'Otra' } },
      { chapterId: 'productos', helpful: true, comment: null, createdAt: FECHA, business: { name: 'Tienda' } },
    ]);
    const s = await svc.adminSummary();
    expect(s).toEqual(expect.objectContaining({ open: 2, answered: 0, closed: 1 }));
    expect(s.manual).toEqual([
      { chapterId: 'pedidos', helpful: 1, notHelpful: 1, comments: [{ businessName: 'Otra', comment: 'No explica envíos', helpful: false, createdAt: FECHA.toISOString() }] },
      { chapterId: 'productos', helpful: 1, notHelpful: 0, comments: [] },
    ]);
  });

  it('responder crea un mensaje ADMIN, pasa a ANSWERED, avisa al miembro y deja PlatformAdminLog', async () => {
    const { svc, prisma, mail } = armar();
    prisma.supportRequest.findUnique.mockResolvedValue({
      id: 'req-1', number: 12, subject: 'No carga', businessId: BIZ, source: 'PANEL', contactName: null, contactEmail: null,
      member: { id: 'm1', name: 'Ana', email: 'ana@x.com' }, business: { subdomain: 'tienda' },
    });
    prisma.supportRequest.update.mockResolvedValue(consulta({
      status: 'ANSWERED',
      messages: [
        ...consulta().messages,
        { id: 'msg-2', author: 'ADMIN', body: 'Ya lo arreglamos', attachments: [], createdAt: FECHA, member: null, admin: { name: 'Mateo', jobTitle: 'CTO' } },
      ],
    }));
    const detalle = await svc.adminReply('adm-1', 'req-1', { message: 'Ya lo arreglamos, probá de nuevo' });

    expect(prisma.supportMessage.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ requestId: 'req-1', author: 'ADMIN', adminId: 'adm-1' }));
    expect(prisma.supportRequest.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ status: 'ANSWERED', answeredAt: expect.any(Date), lastMessageAt: expect.any(Date) }));
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({
      data: { adminId: 'adm-1', action: 'support_reply', targetType: 'support_request', targetId: 'req-1', details: { businessId: BIZ, number: 12 } },
    });
    expect(mail.sendSupportReply.mock.calls[0][0]).toBe('ana@x.com');
    expect(mail.sendSupportReply.mock.calls[0][1]).toEqual(expect.objectContaining({
      number: 12,
      adminName: 'Mateo',
      adminTitle: 'CTO',
      supportEmail: 'soporte@orbita.site',
      panelUrl: 'https://tienda.orbita.site/admin/ventas/configuracion?vista=soporte&consulta=req-1',
    }));
    expect(detalle.messages[1]).toEqual(expect.objectContaining({ author: 'ADMIN', authorName: 'Mateo', authorTitle: 'CTO' }));
  });

  it('si el mail al miembro falla, la respuesta queda guardada igual', async () => {
    const { svc, prisma, mail } = armar();
    prisma.supportRequest.findUnique.mockResolvedValue({
      id: 'req-1', number: 12, subject: 'No carga', businessId: BIZ, source: 'PANEL', contactName: null, contactEmail: null,
      member: { id: 'm1', name: 'Ana', email: 'ana@x.com' }, business: { subdomain: 'tienda' },
    });
    mail.sendSupportReply.mockRejectedValue(new Error('Resend caído'));
    await expect(svc.adminReply('adm-1', 'req-1', { message: 'Ya lo arreglamos, probá de nuevo' })).resolves.toBeDefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('una consulta inexistente → 404 sin escribir nada', async () => {
    const { svc, prisma } = armar();
    prisma.supportRequest.findUnique.mockResolvedValue(null);
    await expect(svc.adminReply('adm-1', 'nada', { message: 'Ya lo arreglamos, probá de nuevo' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.adminSetStatus('adm-1', 'nada', { status: 'CLOSED' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('CLOSED setea closedAt, OPEN lo limpia, y las dos dejan log support_status', async () => {
    const { svc, prisma } = armar();
    prisma.supportRequest.findUnique.mockResolvedValue({ id: 'req-1', number: 12, businessId: BIZ });
    await svc.adminSetStatus('adm-1', 'req-1', { status: 'CLOSED' });
    expect(prisma.supportRequest.update.mock.calls[0][0].data).toEqual({ status: 'CLOSED', closedAt: expect.any(Date) });
    await svc.adminSetStatus('adm-1', 'req-1', { status: 'OPEN' });
    expect(prisma.supportRequest.update.mock.calls[1][0].data).toEqual({ status: 'OPEN', closedAt: null });
    expect(prisma.platformAdminLog.create.mock.calls.map((c) => c[0].data.details.status)).toEqual(['CLOSED', 'OPEN']);
    expect(prisma.platformAdminLog.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ action: 'support_status', targetType: 'support_request', targetId: 'req-1' }));
  });
});

describe('DTOs nuevos', () => {
  const props = async (cls: new () => object, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('SendSupportRequestDto: hasta 3 adjuntos, cada uno con url y name', async () => {
    const adj = { url: `${PUBLICO}/${BIZ}/soporte/a.webp`, name: 'a' };
    expect(await props(SendSupportRequestDto, { ...dtoNueva, attachments: [adj, adj, adj] })).toEqual([]);
    expect(await props(SendSupportRequestDto, { ...dtoNueva, attachments: [adj, adj, adj, adj] })).toEqual(['attachments']);
    expect(await props(SendSupportRequestDto, { ...dtoNueva, attachments: [{ url: adj.url }] })).toEqual(['attachments']);
  });

  it('ReplySupportRequestDto mide el mensaje sin espacios', async () => {
    expect(await props(ReplySupportRequestDto, { message: '   corto   ' })).toEqual(['message']);
    const dto = plainToInstance(ReplySupportRequestDto, { message: '  Sigue sin andar desde hoy  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.message).toBe('Sigue sin andar desde hoy');
  });

  it('ManualFeedbackDto: chapterId acotado, helpful booleano, comentario opcional', async () => {
    expect(await props(ManualFeedbackDto, { chapterId: 'pedidos', helpful: true })).toEqual([]);
    expect(await props(ManualFeedbackDto, { chapterId: 'x'.repeat(65), helpful: 'si' })).toEqual(['chapterId', 'helpful']);
    expect(await props(ManualFeedbackDto, { chapterId: 'pedidos', helpful: false, comment: 'x'.repeat(1001) })).toEqual(['comment']);
  });

  it('ListSupportQueryDto: estados y categorías cerrados, limit hasta 100, page numérica desde la query', async () => {
    const dto = plainToInstance(ListSupportQueryDto, { page: '2', limit: '50', status: 'OPEN', category: 'DOMINIO' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(await props(ListSupportQueryDto, { limit: 101, status: 'PENDIENTE', category: 'ROOT' })).toEqual(['status', 'category', 'limit']);
  });

  it('AdminReplyDto: 10 a 5000 caracteres sin contar espacios', async () => {
    expect(await props(AdminReplyDto, { message: '  hola    ' })).toEqual(['message']);
    expect(await props(AdminReplyDto, { message: 'x'.repeat(5001) })).toEqual(['message']);
    expect(await props(AdminReplyDto, { message: 'Ya lo arreglamos, probá de nuevo' })).toEqual([]);
  });

  it('UpdateSupportStatusDto: solo OPEN o CLOSED (ANSWERED lo pone el sistema)', async () => {
    expect(await props(UpdateSupportStatusDto, { status: 'CLOSED' })).toEqual([]);
    expect(await props(UpdateSupportStatusDto, { status: 'ANSWERED' })).toEqual(['status']);
  });
});
