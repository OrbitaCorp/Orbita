import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';

// Fin del precio congelado de una campaña (2026-10). Dos cosas que no pueden
// fallar en silencio:
//   - al cobrarse el último mes congelado, al dueño se le avisa por mail que
//     el próximo débito sale al precio de lista;
//   - si el aviso de un cobro de Mercado Pago se pierde, el barrido nocturno
//     le pregunta a MP cuántos cobros hizo y sube el precio igual.

const LISTA = 16500;
const CONGELADO = 10000;
const DIA = 86_400_000;

const fila = (extra: Record<string, unknown> = {}) => ({
  id: 'd1', businessId: 'b1', preapprovalId: 'PRE-1', codeId: null, campaignId: 'camp-1', plan: 'mensual',
  amountList: LISTA, amountFinal: CONGELADO, chargesTotal: 2, status: 'ACTIVE',
  createdAt: new Date(Date.now() - 40 * DIA), activatedAt: new Date(Date.now() - 40 * DIA), updatedAt: new Date(),
  ...extra,
});

function armar(laFila = fila()) {
  const prisma: any = {
    subscription: {
      findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE', mpPreapprovalId: 'PRE-1', currentPeriodEnd: new Date('2027-02-06T15:00:00Z') }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    subscriptionActivationDiscount: {
      findMany: jest.fn().mockResolvedValue([laFila]),
      findFirst: jest.fn().mockResolvedValue(laFila),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...laFila, ...data })),
    },
    subscriptionPayment: { count: jest.fn().mockResolvedValue(0) },
    business: { findUnique: jest.fn().mockResolvedValue({ name: 'Mi Tienda', subdomain: 'mitienda' }) },
    member: { findMany: jest.fn().mockResolvedValue([{ email: 'dueno@test.com' }]) },
  };
  const cfg: any = { get: jest.fn((k: string) => ({ MP_ACCESS_TOKEN: 'tok' } as Record<string, string>)[k]) };
  const mail: any = { sendFrozenPriceEnded: jest.fn().mockResolvedValue(undefined), sendCustomEmail: jest.fn().mockResolvedValue(true) };
  const service = new SubscriptionsService(prisma, cfg, {} as any, {} as any, {} as any, {} as any, mail);
  const preapproval = { get: jest.fn(), update: jest.fn().mockResolvedValue({}) };
  (service as any)._preapproval = preapproval;
  return { service, prisma, mail, preapproval };
}

describe('aviso al dueño cuando termina el precio congelado', () => {
  it('con el último cobro congelado registrado: sube el precio y le avisa cuánto y desde cuándo', async () => {
    const { service, prisma, mail, preapproval } = armar();
    prisma.subscriptionPayment.count.mockResolvedValue(2);

    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');

    expect(preapproval.update).toHaveBeenCalledTimes(1);
    expect(mail.sendFrozenPriceEnded).toHaveBeenCalledWith(
      'dueno@test.com',
      expect.objectContaining({ businessName: 'Mi Tienda', frozenAmount: '$10.000', listAmount: '$16.500', nextChargeDate: '06/02/2027' }),
      { businessId: 'b1' },
    );
  });

  it('mientras le quedan meses congelados no manda nada', async () => {
    const { service, prisma, mail } = armar();
    prisma.subscriptionPayment.count.mockResolvedValue(1);
    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');
    expect(mail.sendFrozenPriceEnded).not.toHaveBeenCalled();
  });

  it('si Mercado Pago rechaza la suba, no avisa todavía (se reintenta a la noche)', async () => {
    const { service, prisma, mail, preapproval } = armar();
    prisma.subscriptionPayment.count.mockResolvedValue(2);
    preapproval.update.mockRejectedValue(new Error('mp caído'));
    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');
    expect(mail.sendFrozenPriceEnded).not.toHaveBeenCalled();
  });

  it('un código de descuento de un solo cobro no dispara este mail', async () => {
    const { service, prisma, mail, preapproval } = armar(fila({ codeId: 'code1', campaignId: null, chargesTotal: 1 }));
    prisma.subscriptionPayment.count.mockResolvedValue(1);
    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');
    expect(preapproval.update).toHaveBeenCalledTimes(1);
    expect(mail.sendFrozenPriceEnded).not.toHaveBeenCalled();
  });

  it('si el mail falla, el precio igual queda restaurado', async () => {
    const { service, prisma, mail } = armar();
    prisma.subscriptionPayment.count.mockResolvedValue(2);
    mail.sendFrozenPriceEnded.mockRejectedValue(new Error('resend caído'));
    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');
    const estados = prisma.subscriptionActivationDiscount.update.mock.calls.map((c: any) => c[0].data.status);
    expect(estados).toEqual(['PAID', 'RESTORED']);
  });
});

describe('respaldo: se perdió el aviso de un cobro', () => {
  const autorizada = (extra: Record<string, unknown> = {}) => ({ status: 'authorized', ...extra });

  it('MP informa que ya hizo los cobros congelados: el barrido sube el precio y avisa al equipo', async () => {
    const { service, mail, preapproval } = armar();
    preapproval.get.mockResolvedValue(autorizada({ summarized: { charged_quantity: 2 } }));

    await service.reconciliarDescuentosDeActivacion();

    expect(preapproval.update).toHaveBeenCalledWith({
      id: 'PRE-1',
      body: { auto_recurring: { transaction_amount: LISTA, currency_id: 'ARS' } },
    });
    expect(mail.sendCustomEmail.mock.calls[0][1]).toContain('Se perdió el aviso');
    expect(mail.sendFrozenPriceEnded).toHaveBeenCalledTimes(1);
  });

  it('MP informa menos cobros que los congelados: no se toca el precio', async () => {
    const { service, preapproval } = armar();
    preapproval.get.mockResolvedValue(autorizada({ summarized: { charged_quantity: 1 } }));
    await service.reconciliarDescuentosDeActivacion();
    expect(preapproval.update).not.toHaveBeenCalled();
  });

  it('MP no informa cantidad: se decide por fecha, pasado el último cobro congelado más el margen', async () => {
    // 2 cobros: el segundo cae un mes después de autorizar. A los 40 días ya pasó.
    const { service, preapproval } = armar();
    preapproval.get.mockResolvedValue(autorizada());
    await service.reconciliarDescuentosDeActivacion();
    expect(preapproval.update).toHaveBeenCalledTimes(1);
  });

  it('MP no informa cantidad y todavía no llegó la fecha: espera', async () => {
    const reciente = fila({ createdAt: new Date(Date.now() - 10 * DIA), activatedAt: new Date(Date.now() - 10 * DIA) });
    const { service, preapproval } = armar(reciente);
    preapproval.get.mockResolvedValue(autorizada());
    await service.reconciliarDescuentosDeActivacion();
    expect(preapproval.update).not.toHaveBeenCalled();
  });

  it('por fecha solo vale si MP sigue teniendo el débito autorizado', async () => {
    const { service, preapproval } = armar();
    preapproval.get.mockResolvedValue({ status: 'paused' });
    await service.reconciliarDescuentosDeActivacion();
    expect(preapproval.update).not.toHaveBeenCalled();
  });

  it('si no se puede consultar a MP, no se le sube el precio a nadie', async () => {
    const { service, preapproval } = armar();
    preapproval.get.mockRejectedValue(new Error('mp caído'));
    await service.reconciliarDescuentosDeActivacion();
    expect(preapproval.update).not.toHaveBeenCalled();
  });

  it('el registro de un cobro normal (webhook) no consulta a MP: el respaldo es solo del barrido', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscriptionPayment.count.mockResolvedValue(1);
    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');
    expect(preapproval.get).not.toHaveBeenCalled();
  });
});
