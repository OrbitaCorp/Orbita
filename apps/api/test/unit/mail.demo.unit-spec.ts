import { MailService } from '../../src/mail/mail.service';

// La demo pública (Business.isDemo) no manda ningún mail, y nada sale a un
// dominio .invalid (las cuentas inventadas de la demo). El resto de los
// negocios, igual que siempre.

function makeService(negocios: Record<string, boolean>) {
  const config = { get: (k: string) => (k === 'RESEND_API_KEY' ? 're_prueba' : undefined) } as any;
  const findUnique = jest.fn(async ({ where }: { where: { id: string }; select?: Record<string, boolean> }) =>
    where.id in negocios ? { isDemo: negocios[where.id] } : null,
  );
  const prisma = {
    business: { findUnique },
    storefrontConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    businessConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    emailLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const svc = new MailService(config, prisma);
  const send = jest.fn().mockResolvedValue({ error: null });
  (svc as any)._resend = { emails: { send } };
  (svc as any).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  return { svc, send, findUnique };
}

describe('MailService — demo pública', () => {
  it('no manda nada de un negocio demo, y responde como enviado', async () => {
    const { svc, send } = makeService({ demo: true });
    await expect(svc.sendCustomEmail('cliente@gmail.com', 'Hola', '<p>x</p>', { businessId: 'demo' })).resolves.toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('no manda nada a un dominio .invalid, aunque no haya negocio', async () => {
    const { svc, send } = makeService({});
    await expect(svc.sendCustomEmail('dueno@demo.invalid', 'Hola', '<p>x</p>')).resolves.toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('un negocio real manda normal, y la consulta de isDemo se cachea', async () => {
    const { svc, send, findUnique } = makeService({ real: false });
    await svc.sendCustomEmail('cliente@gmail.com', 'Hola', '<p>x</p>', { businessId: 'real' });
    await svc.sendCustomEmail('otro@gmail.com', 'Hola', '<p>x</p>', { businessId: 'real' });
    expect(send).toHaveBeenCalledTimes(2);
    const consultasIsDemo = findUnique.mock.calls.filter(([a]) => a?.select?.isDemo).length;
    expect(consultasIsDemo).toBe(1);
  });
});
