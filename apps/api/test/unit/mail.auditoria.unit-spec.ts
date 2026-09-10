import { MailService, esDestinatarioUnico, limpiarAsunto } from '../../src/mail/mail.service';
import { NotificationsService } from '../../src/notifications/notifications.service';

// Auditoría interna 10/09, ítem api.mail: asuntos de una sola línea, un solo
// destinatario por envío, links de redes sin esquemas raros y el cuerpo de
// las notificaciones escapado.

function servicio(prisma: any = {}) {
  const config = { get: (k: string) => (k === 'RESEND_API_KEY' ? 're_test' : undefined) } as any;
  const svc = new MailService(config, prisma);
  const send = jest.fn().mockResolvedValue({ error: null });
  (svc as any)._resend = { emails: { send } };
  (svc as any).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  return { svc, send };
}

const prismaConLog = () => ({ emailLog: { create: jest.fn().mockResolvedValue({}) } });

describe('limpiarAsunto', () => {
  it('saca saltos de línea y caracteres de control', () => {
    expect(limpiarAsunto('Hola\r\nBcc: otro@x.com')).toBe('Hola Bcc: otro@x.com');
    expect(limpiarAsunto(`a${String.fromCharCode(9)}b c${String.fromCharCode(1)}d`)).toBe('a b c d');
  });
  it('deja intactos los signos comunes y los acentos', () => {
    expect(limpiarAsunto('¡Ganaste 10% en Tienda (Centro) — #12!')).toBe('¡Ganaste 10% en Tienda (Centro) — #12!');
  });
  it('corta en 200 caracteres', () => {
    expect(limpiarAsunto('x'.repeat(500))).toHaveLength(200);
  });
});

describe('esDestinatarioUnico', () => {
  it('acepta una casilla común', () => {
    expect(esDestinatarioUnico('cliente.nombre+tag@dominio.com.ar')).toBe(true);
  });
  it.each(['a@x.com, b@y.com', 'a@x.com;b@y.com', 'Nombre <a@x.com>', 'a@x.com\r\nBcc: b@y.com', 'sin-arroba', 'a @x.com'])(
    'rechaza %p',
    (to) => expect(esDestinatarioUnico(to)).toBe(false),
  );
});

describe('MailService: envíos', () => {
  it('sendCustomEmail no manda a un destinatario con varias casillas y deja FAILED', async () => {
    const prisma = prismaConLog();
    const { svc, send } = servicio(prisma);
    const salio = await svc.sendCustomEmail('a@x.com, b@y.com', 'Hola', '<p>x</p>');
    expect(salio).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.emailLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'FAILED' }) });
  });

  it('sendCustomEmail manda el asunto en una sola línea', async () => {
    const { svc, send } = servicio(prismaConLog());
    (svc as any).obtenerBranding = jest.fn().mockResolvedValue((svc as any).DEFAULT_BRANDING);
    await svc.sendCustomEmail('a@x.com', 'Hola\nBcc: b@y.com', '<p>x</p>');
    expect(send.mock.calls[0][0].subject).toBe('Hola Bcc: b@y.com');
  });

  it('sendSupportRequest (usa sendOrLog) limpia el asunto que escribe el miembro', async () => {
    const { svc, send } = servicio(prismaConLog());
    await svc.sendSupportRequest('soporte@orbita.site', {
      businessName: 'Tienda', businessSlug: 't', memberName: 'Ana', memberEmail: 'ana@x.com',
      category: 'OTRO', subject: 'Ayuda\r\nX-Otro: 1', message: 'mensaje largo de prueba',
    });
    const enviado = send.mock.calls[0][0] as { subject: string; replyTo?: string };
    expect(enviado.subject).toBe('[Soporte] OTRO — Tienda: Ayuda X-Otro: 1');
    expect(enviado.replyTo).toBe('ana@x.com');
  });

  it('sendOrLog no manda a un destinatario inválido', async () => {
    const { svc, send } = servicio(prismaConLog());
    const salio = await svc.sendOrderConfirmation('Nombre <a@x.com>', {} as any);
    expect(salio).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('el branding descarta links de redes con esquemas que no son http(s)', async () => {
    const prisma = {
      storefrontConfig: { findUnique: jest.fn().mockResolvedValue({ storeName: 'T', logoUrl: null, colorPrimary: '#111111', colorBackground: '#ffffff' }) },
      businessConfig: {
        findUnique: jest.fn().mockResolvedValue({ instagram: 'javascript:alert(1)', facebook: 'https://facebook.com/t', tiktok: 'tiktok.com/@t', email: null }),
      },
    };
    const { svc } = servicio(prisma);
    const b = await (svc as any).obtenerBranding('biz');
    expect(b.instagram).toBeNull();
    expect(b.facebook).toBe('https://facebook.com/t');
    expect(b.tiktok).toBe('tiktok.com/@t');
  });
});

describe('NotificationsService: mail a los miembros', () => {
  it('escapa el nombre que escribió el cliente', async () => {
    const mail = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
    const prisma = {
      notificationConfig: { findUnique: jest.fn().mockResolvedValue({ matrix: { cliente_nuevo: { panel: false, email: true } } }) },
      member: { findMany: jest.fn().mockResolvedValue([{ email: 'duenio@x.com' }]) },
    };
    const svc = new NotificationsService(prisma as any, mail as any);
    await svc.onClienteNuevo({ businessId: 'biz', customerName: '<a href="https://malo">Clic</a>', customerId: 'c1' });
    const cuerpo = mail.sendCustomEmail.mock.calls[0][2] as string;
    expect(cuerpo).not.toContain('<a href');
    expect(cuerpo).toContain('&lt;a href=');
  });
});
