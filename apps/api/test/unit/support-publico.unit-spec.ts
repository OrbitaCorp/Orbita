import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';
import { MailService } from '../../src/mail/mail.service';
import { SendPublicSupportRequestDto } from '../../src/support/dto/send-public-support-request.dto';
import { SupportController } from '../../src/support/support.controller';
import { SupportService } from '../../src/support/support.service';

// Formulario de contacto de la LANDING: lo manda alguien SIN cuenta (un
// visitante), a diferencia del de Configuración → Soporte que exige sesión de
// panel. Como es un endpoint público que dispara un mail, la protección son:
// throttle propio, campo trampa (honeypot), destino fijo y HTML escapado.

const errores = async (body: object) =>
  (await validate(plainToInstance(SendPublicSupportRequestDto, body))).map((e) => e.property).sort();

const valido = { name: 'Ana', email: 'ana@x.com', category: 'OTRO', subject: 'Hola', message: 'mensaje de prueba' };

describe('SendPublicSupportRequestDto', () => {
  it('acepta una consulta común y recorta los campos', async () => {
    const dto = plainToInstance(SendPublicSupportRequestDto, {
      name: ' Ana ', email: ' ana@x.com ', category: 'TECNICO', subject: ' No carga ', message: ' La tienda no carga desde ayer ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Ana');
    expect(dto.email).toBe('ana@x.com');
    expect(dto.subject).toBe('No carga');
  });

  it('exige un email válido y mide los mínimos sin contar espacios', async () => {
    expect(await errores({ name: '  a ', email: 'no-es-mail', category: 'OTRO', subject: '   a   ', message: '    corto    ' })).toEqual(
      ['email', 'message', 'name', 'subject'],
    );
  });

  it('rechaza categorías fuera de la lista', async () => {
    expect(await errores({ ...valido, category: 'ROOT' })).toEqual(['category']);
  });

  it('el campo trampa no invalida el DTO: lo resuelve el servicio en silencio', async () => {
    expect(await errores({ ...valido, website: 'http://spam.example' })).toEqual([]);
  });
});

describe('SupportService.sendPublic', () => {
  // Desde el 22/09 la consulta de la landing se GUARDA (source LANDING) y se
  // ve en el superadmin; el mail a soporte@ es un aviso. Si el email coincide
  // con un miembro de algún negocio, queda "con cuenta" y apunta a ese
  // negocio, pero sin memberId.
  const FECHA = new Date('2026-09-22T12:00:00Z');
  const guardada = (over: object = {}) => ({
    id: 'req-9', number: 9, subject: 'Hola', category: 'OTRO', status: 'OPEN', contactPhone: null,
    source: 'LANDING', hasAccount: false, contactName: 'Ana', contactEmail: 'ana@x.com',
    businessId: null, memberId: null, business: null, member: null,
    createdAt: FECHA, lastMessageAt: FECHA, _count: { messages: 1 },
    messages: [{ id: 'msg-1', author: 'MEMBER', body: 'mensaje de prueba', attachments: [], createdAt: FECHA, member: null, admin: null }],
    ...over,
  });
  function armar({ salio = true, miembro = null as null | { businessId: string } } = {}) {
    const prisma = {
      member: { findFirst: jest.fn().mockResolvedValue(miembro) },
      supportRequest: { create: jest.fn().mockImplementation(async ({ data }: { data: any }) => guardada({ hasAccount: data.hasAccount, businessId: data.businessId, business: data.businessId ? { id: data.businessId, name: 'Tienda', subdomain: 'tienda' } : null })) },
    };
    const mail = { sendPublicSupportRequest: jest.fn().mockResolvedValue(salio) };
    const svc = new SupportService(prisma as any, mail as any, {} as any);
    (svc as any).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
    return { svc, mail, prisma };
  }
  const dto = { name: 'Ana', email: 'Ana@X.com', category: 'OTRO' as const, subject: 'Hola', message: 'mensaje de prueba' };

  it('guarda la consulta como LANDING, sin cuenta si el email no es de ningún miembro, y avisa a soporte@orbita.site', async () => {
    const { svc, mail, prisma } = armar();
    await expect(svc.sendPublic(dto)).resolves.toEqual({ ok: true, number: 9 });
    expect(prisma.member.findFirst.mock.calls[0][0].where).toEqual({ email: { equals: 'ana@x.com', mode: 'insensitive' } });
    expect(prisma.supportRequest.create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      source: 'LANDING', hasAccount: false, businessId: null, memberId: null, contactName: 'Ana', contactEmail: 'ana@x.com', subject: 'Hola',
    }));
    const [destino, datos] = mail.sendPublicSupportRequest.mock.calls[0];
    expect(destino).toBe('soporte@orbita.site');
    expect(datos).toEqual(expect.objectContaining({ number: 9, name: 'Ana', email: 'ana@x.com', category: 'Otra consulta', subject: 'Hola', hasAccount: false }));
  });

  it('si el email es de un miembro, queda "con cuenta" y apunta al negocio pero SIN memberId (nadie probó ser él)', async () => {
    const { svc, mail, prisma } = armar({ miembro: { businessId: 'biz-1' } });
    await svc.sendPublic(dto);
    expect(prisma.supportRequest.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ hasAccount: true, businessId: 'biz-1', memberId: null }));
    expect(mail.sendPublicSupportRequest.mock.calls[0][1]).toEqual(expect.objectContaining({ hasAccount: true, businessName: 'Tienda' }));
  });

  it('si el campo trampa trae contenido responde ok pero NO guarda ni manda nada', async () => {
    const { svc, mail, prisma } = armar();
    await expect(svc.sendPublic({ ...dto, website: 'http://spam.example' })).resolves.toEqual({ ok: true });
    expect(prisma.supportRequest.create).not.toHaveBeenCalled();
    expect(mail.sendPublicSupportRequest).not.toHaveBeenCalled();
  });

  it('un campo trampa vacío o solo con espacios se trata como una consulta real', async () => {
    const { svc, mail } = armar();
    await svc.sendPublic({ ...dto, website: '   ' });
    expect(mail.sendPublicSupportRequest).toHaveBeenCalledTimes(1);
  });

  it('si el mail no sale, la consulta queda guardada igual y la respuesta es ok', async () => {
    const { svc, prisma } = armar({ salio: false });
    await expect(svc.sendPublic(dto)).resolves.toEqual({ ok: true, number: 9 });
    expect(prisma.supportRequest.create).toHaveBeenCalledTimes(1);
  });
});

describe('MailService.sendPublicSupportRequest', () => {
  function servicio() {
    const config = { get: (k: string) => (k === 'RESEND_API_KEY' ? 're_test' : undefined) } as any;
    const prisma = { emailLog: { create: jest.fn().mockResolvedValue({}) } };
    const svc = new MailService(config, prisma as any);
    const send = jest.fn().mockResolvedValue({ error: null });
    (svc as any)._resend = { emails: { send } };
    (svc as any).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
    return { svc, send };
  }
  const datos = { number: 7, name: 'Ana', email: 'ana@x.com', category: 'Otra consulta', subject: 'Ayuda', message: 'mensaje largo de prueba', hasAccount: false };

  it('responde directo al visitante (Reply-To) y va con asunto de una sola línea', async () => {
    const { svc, send } = servicio();
    await svc.sendPublicSupportRequest('soporte@orbita.site', { ...datos, subject: 'Ayuda\r\nBcc: otro@x.com' });
    const enviado = send.mock.calls[0][0] as { to: string; subject: string; replyTo?: string };
    expect(enviado.to).toBe('soporte@orbita.site');
    expect(enviado.subject).toBe('[Contacto landing] #7 Otra consulta — Ana: Ayuda Bcc: otro@x.com');
    expect(enviado.replyTo).toBe('ana@x.com');
  });

  it('escapa el HTML del mensaje: quien lo lee en Órbita no ejecuta nada', async () => {
    const { svc, send } = servicio();
    await svc.sendPublicSupportRequest('soporte@orbita.site', { ...datos, message: '<img src=x onerror=alert(1)> hola' });
    const html = (send.mock.calls[0][0] as { html: string }).html;
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});

describe('POST /support/public (controlador)', () => {
  it('es público (sin sesión) y el de panel sigue exigiéndola', () => {
    const reflector = new Reflector();
    expect(reflector.get(IS_PUBLIC_KEY, SupportController.prototype.sendPublic)).toBe(true);
    expect(reflector.get(IS_PUBLIC_KEY, SupportController.prototype.create)).toBeUndefined();
  });

  it('tiene throttle propio, más estricto que el de panel: 3 cada 10 minutos', () => {
    const metodo = SupportController.prototype.sendPublic;
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', metodo)).toBe(3);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', metodo)).toBe(600_000);
  });

  it('delega en el servicio sin necesitar contexto de sesión', async () => {
    const svc = { sendPublic: jest.fn().mockResolvedValue({ ok: true }) };
    const dto = { ...valido, category: 'OTRO' as const };
    await expect(new SupportController(svc as any).sendPublic(dto)).resolves.toEqual({ ok: true });
    expect(svc.sendPublic).toHaveBeenCalledWith(dto);
  });
});
