import { MailService } from '../../src/mail/mail.service';

// Unit test del reintento de emails (auditoría #4). Mockea Resend: reintenta los
// fallos de transporte (excepción) y NO reintenta los rechazos del proveedor
// (que vienen en `error`, permanentes).

function makeService(send: jest.Mock) {
  const config = { get: () => undefined } as any; // isConfigured=false, no importa acá
  const svc = new MailService(config, {} as any);
  (svc as any)._resend = { emails: { send } };
  // Silencia el logger para no ensuciar la salida del test.
  (svc as any).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  return svc;
}

const payload = { from: 'a@x.com', to: 'b@y.com', subject: 's', html: '<p>h</p>' };
const call = (svc: MailService) => (svc as any).enviarConReintento(payload);

describe('MailService.enviarConReintento (unit)', () => {
  it('reintenta ante fallo de transporte y devuelve OK si un reintento sale bien', async () => {
    const send = jest.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ error: null });
    const svc = makeService(send);

    const res = await call(svc);

    expect(res).toEqual({ error: null });
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('NO reintenta un rechazo del proveedor (error permanente): una sola llamada', async () => {
    const send = jest.fn().mockResolvedValue({ error: { message: 'Domain not verified' } });
    const svc = makeService(send);

    const res = await call(svc);

    expect(res).toEqual({ error: { message: 'Domain not verified' } });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('relanza tras agotar los reintentos si el transporte siempre falla', async () => {
    const send = jest.fn().mockRejectedValue(new Error('network down'));
    const svc = makeService(send);

    await expect(call(svc)).rejects.toThrow('network down');
    expect(send).toHaveBeenCalledTimes(3);
  });
});
