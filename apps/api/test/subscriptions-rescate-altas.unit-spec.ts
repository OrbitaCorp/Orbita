import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';

// Rescate de altas pagadas (24/09): una clienta pagó, no volvió a la pantalla de
// retorno, el webhook no llegó y el barrido nocturno le borró el alta sin mirar
// si Mercado Pago había cobrado. Estos tests fijan que un cobro nunca se pierda
// en silencio.

function armar(config: Record<string, string | undefined> = { MP_ACCESS_TOKEN: 'tok' }) {
  const prisma: any = {
    pendingSignup: {
      findMany: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const mail: any = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
  const cfg: any = { get: jest.fn((k: string) => config[k]) };
  const service = new SubscriptionsService(prisma, cfg, {} as any, {} as any, {} as any, {} as any, mail);
  return { service, prisma, mail };
}

const pend = (ref: string, email = 'a@b.com') => ({ preapprovalId: ref, payload: { account: { email } } });

describe('SubscriptionsService.cleanupExpiredPendingSignups — rescate de altas pagadas', () => {
  it('crea la cuenta de una alta con pago aprobado, avisa y no la protege del borrado', async () => {
    const { service, prisma, mail } = armar();
    prisma.pendingSignup.findMany.mockResolvedValue([pend('PEND-1')]);
    jest.spyOn(service, 'confirmAndCreate').mockResolvedValue({ activated: true, subdomain: 'tienda' } as any);

    await service.cleanupExpiredPendingSignups();

    expect(service.confirmAndCreate).toHaveBeenCalledWith('PEND-1');
    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendCustomEmail.mock.calls[0][0]).toBe('contacto@orbita-corp.com');
    expect(mail.sendCustomEmail.mock.calls[0][1]).toContain('recuperada');
    expect(prisma.pendingSignup.deleteMany.mock.calls[0][0].where.preapprovalId).toBeUndefined();
  });

  it('no borra ni avisa cuando MP no respondió (no se sabe si pagó)', async () => {
    const { service, prisma, mail } = armar();
    prisma.pendingSignup.findMany.mockResolvedValue([pend('PEND-2')]);
    jest.spyOn(service, 'confirmAndCreate').mockResolvedValue({ activated: false, status: 'search_failed' } as any);

    await service.cleanupExpiredPendingSignups();

    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
    expect(prisma.pendingSignup.deleteMany.mock.calls[0][0].where.preapprovalId).toEqual({ notIn: ['PEND-2'] });
  });

  it('conserva y avisa cuando hay pago aprobado pero el monto no coincide', async () => {
    const { service, prisma, mail } = armar();
    prisma.pendingSignup.findMany.mockResolvedValue([pend('PEND-3', 'x@y.com')]);
    jest.spyOn(service, 'confirmAndCreate').mockResolvedValue({ activated: false, status: 'monto_no_coincide' } as any);

    await service.cleanupExpiredPendingSignups();

    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendCustomEmail.mock.calls[0][1]).toContain('requiere revisión');
    expect(mail.sendCustomEmail.mock.calls[0][2]).toContain('x@y.com');
    expect(prisma.pendingSignup.deleteMany.mock.calls[0][0].where.preapprovalId).toEqual({ notIn: ['PEND-3'] });
  });

  it('conserva y avisa cuando crear la cuenta tira un error', async () => {
    const { service, prisma, mail } = armar();
    prisma.pendingSignup.findMany.mockResolvedValue([pend('PEND-4')]);
    jest.spyOn(service, 'confirmAndCreate').mockRejectedValue(new Error('boom'));

    await service.cleanupExpiredPendingSignups();

    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendCustomEmail.mock.calls[0][2]).toContain('boom');
    expect(prisma.pendingSignup.deleteMany.mock.calls[0][0].where.preapprovalId).toEqual({ notIn: ['PEND-4'] });
  });

  it('un pago rechazado o pendiente no se protege ni avisa: sigue el TTL de siempre', async () => {
    const { service, prisma, mail } = armar();
    prisma.pendingSignup.findMany.mockResolvedValue([pend('PEND-5'), pend('PEND-6')]);
    jest
      .spyOn(service, 'confirmAndCreate')
      .mockResolvedValueOnce({ activated: false, status: 'rejected' } as any)
      .mockResolvedValueOnce({ activated: false, status: 'pending' } as any);

    await service.cleanupExpiredPendingSignups();

    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
    expect(prisma.pendingSignup.deleteMany.mock.calls[0][0].where.preapprovalId).toBeUndefined();
  });

  it('solo mira altas con referencia PEND- y con más de 15 minutos', async () => {
    const { service, prisma } = armar();
    prisma.pendingSignup.findMany.mockResolvedValue([]);

    await service.cleanupExpiredPendingSignups();

    const where = prisma.pendingSignup.findMany.mock.calls[0][0].where;
    expect(where.preapprovalId).toEqual({ startsWith: 'PEND-' });
    const edadMs = Date.now() - where.createdAt.lt.getTime();
    expect(edadMs).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);
    expect(edadMs).toBeLessThan(16 * 60 * 1000);
  });

  it('sin MercadoPago configurado (dev) no consulta nada y solo aplica el TTL', async () => {
    const { service, prisma } = armar({});
    jest.spyOn(service, 'confirmAndCreate');

    await service.cleanupExpiredPendingSignups();

    expect(prisma.pendingSignup.findMany).not.toHaveBeenCalled();
    expect(service.confirmAndCreate).not.toHaveBeenCalled();
    expect(prisma.pendingSignup.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('el destinatario del aviso se puede cambiar con ALERTAS_PLATAFORMA_EMAIL', async () => {
    const { service, prisma, mail } = armar({ MP_ACCESS_TOKEN: 'tok', ALERTAS_PLATAFORMA_EMAIL: 'ale@orbita-corp.com' });
    prisma.pendingSignup.findMany.mockResolvedValue([pend('PEND-7')]);
    jest.spyOn(service, 'confirmAndCreate').mockResolvedValue({ activated: true, subdomain: 't' } as any);

    await service.cleanupExpiredPendingSignups();

    expect(mail.sendCustomEmail.mock.calls[0][0]).toBe('ale@orbita-corp.com');
  });
});

describe('SubscriptionsService — notification_url del pago de bienvenida', () => {
  const url = (redirect?: string) => (armar({ MERCADOPAGO_REDIRECT_URI: redirect }).service as any).urlWebhookAltas;

  it('se deriva de MERCADOPAGO_REDIRECT_URI', () => {
    expect(url('https://api.orbita.site/api/v1/mercadopago/oauth/callback')).toBe(
      'https://api.orbita.site/api/v1/webhooks/mercadopago/preapproval?source_news=webhooks',
    );
  });

  it('no se manda en local (http) ni si la variable falta', () => {
    expect(url('http://localhost:3000/api/v1/mercadopago/oauth/callback')).toBeUndefined();
    expect(url(undefined)).toBeUndefined();
  });
});

describe('SubscriptionsService.handleWebhook — pago de bienvenida', () => {
  it('no deja la sesión del dueño (accessToken/refreshToken) en el log', async () => {
    const { WebhookSignatureValidator } = jest.requireActual('mercadopago');
    jest.spyOn(WebhookSignatureValidator, 'validate').mockImplementation(() => undefined as any);

    const { service } = armar({ MP_ACCESS_TOKEN: 'tok', MP_WEBHOOK_SECRET: 'secreto' });
    (service as any)._payment = { get: jest.fn().mockResolvedValue({ external_reference: 'PEND-9' }) };
    jest.spyOn(service, 'confirmAndCreate').mockResolvedValue({
      activated: true, subdomain: 'mateo', businessId: 'b1', free: false,
      accessToken: 'ACCESS-SECRETO', refreshToken: 'REFRESH-SECRETO',
    } as any);
    const log = jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);

    await service.handleWebhook({ type: 'payment', data: { id: '123' } }, { 'x-signature': 'x', 'x-request-id': 'y' }, {});

    const todo = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(todo).toContain('"activated":true');
    expect(todo).toContain('"subdomain":"mateo"');
    expect(todo).not.toContain('SECRETO');
    expect(todo).not.toContain('accessToken');
    expect(todo).not.toContain('refreshToken');
  });
});
