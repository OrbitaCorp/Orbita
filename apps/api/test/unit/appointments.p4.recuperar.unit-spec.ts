import { BadRequestException, ConflictException } from '@nestjs/common';
import { RecuperarService } from '../../src/appointments/avanzado/recuperar/recuperar.service';
import { BIZ, auditor, avanzado, contexto } from './appointments.p4.helpers';

// Recuperar clientes (CONTRATO § P4.7): a quién se le escribe, que nadie
// reciba dos veces la misma campaña, y el cupón personal.

const DIA = 24 * 3600 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);

const campania = (over: Record<string, unknown> = {}) => ({
  id: 'camp-1', businessId: BIZ, inactiveDays: 60, message: 'Hola {nombre}, te extrañamos en {negocio}.', couponEnabled: true,
  couponPercent: 15, couponValidDays: 15, mode: 'manual', isActive: true, sentCount: 0, lastRunAt: null, createdAt: new Date(), ...over,
});

function armar(opts: { campania?: Record<string, unknown> | null; addon?: boolean; on?: boolean } = {}) {
  const ctx = contexto({ addon: opts.addon ?? true, settings: { advanced: opts.on === false ? null : avanzado({ recuperar: true }) } });
  const prisma = {
    business: ctx.business,
    appointment: {
      groupBy: jest.fn().mockResolvedValue([
        { customerId: 'c-viejo', _max: { startsAt: hace(120) }, _count: { _all: 4 } },
        { customerId: 'c-ok', _max: { startsAt: hace(70) }, _count: { _all: 2 } },
        { customerId: 'c-reciente', _max: { startsAt: hace(10) }, _count: { _all: 9 } },
        { customerId: 'c-con-turno', _max: { startsAt: hace(90) }, _count: { _all: 1 } },
        { customerId: 'c-sin-promos', _max: { startsAt: hace(90) }, _count: { _all: 1 } },
        { customerId: 'c-ya-recibio', _max: { startsAt: hace(90) }, _count: { _all: 1 } },
        { customerId: 'c-borrado', _max: { startsAt: hace(90) }, _count: { _all: 1 } },
      ]),
      findMany: jest.fn(async ({ where }: { where: { status: unknown } }) =>
        where.status === 'COMPLETED' ? [{ customerId: 'c-ok', serviceName: 'Corte' }] : [{ customerId: 'c-con-turno' }]),
    },
    appointmentCustomerProfile: { findMany: jest.fn().mockResolvedValue(['c-viejo', 'c-ok', 'c-con-turno', 'c-ya-recibio', 'c-borrado'].map((customerId) => ({ customerId }))) },
    appointmentWinbackSend: {
      findMany: jest.fn().mockResolvedValue([{ customerId: 'c-ya-recibio' }]),
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    customer: {
      findMany: jest.fn().mockResolvedValue(['c-viejo', 'c-ok', 'c-reciente', 'c-con-turno', 'c-sin-promos', 'c-ya-recibio'].map((id) => ({ id, firstName: id.toUpperCase(), lastName: null, phone: '+54 9 11 5555-0101', email: null }))),
    },
    appointmentWinbackCampaign: {
      findFirst: jest.fn().mockResolvedValue(opts.campania === null ? null : campania(opts.campania ?? {})),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
    },
  };
  const mensajeria = { despachar: jest.fn().mockResolvedValue([{ canal: 'WHATSAPP', estado: 'SIMULATED' }]) };
  const svc = new RecuperarService(prisma as never, ctx.svc, auditor() as never, mensajeria);
  return { svc, prisma, mensajeria };
}

describe('clientesInactivos', () => {
  it('última visita hace N días o más, sin turnos por delante, con acceptsPromos, sin la campaña, sin borrados; del que hace más que no viene', async () => {
    const { svc, prisma } = armar();
    const r = await svc.clientesInactivos(BIZ, 60, { campaignId: 'camp-1' });
    expect(r.map((x) => x.customerId)).toEqual(['c-viejo', 'c-ok']);
    expect(r[1]).toMatchObject({ visits: 2, lastServiceName: 'Corte', phone: '1155550101' });
    // Todas las consultas, con businessId.
    expect(prisma.appointment.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ, status: 'COMPLETED', customerId: { not: null } } }));
    for (const m of [prisma.appointment.findMany, prisma.appointmentCustomerProfile.findMany, prisma.appointmentWinbackSend.findMany, prisma.customer.findMany]) {
      for (const [arg] of m.mock.calls) expect(arg.where.businessId).toBe(BIZ);
    }
  });

  it('el umbral importa: a 90 días solo queda el de hace 120', async () => {
    expect((await armar().svc.clientesInactivos(BIZ, 90, { campaignId: 'camp-1' })).map((x) => x.customerId)).toEqual(['c-viejo']);
  });
});

describe('Enviar la campaña', () => {
  it('crea la fila de envío ANTES de mandar (unique campaña+cliente) y manda con cupón personal', async () => {
    const { svc, prisma, mensajeria } = armar();
    await expect(svc.enviar(BIZ, 'm')).resolves.toEqual({ sent: 2, skipped: 0 });
    const filas = prisma.appointmentWinbackSend.create.mock.calls.map((c) => c[0].data);
    expect(filas.map((f) => f.customerId)).toEqual(['c-viejo', 'c-ok']);
    for (const f of filas) {
      expect(f).toMatchObject({ businessId: BIZ, campaignId: 'camp-1' });
      expect(f.couponCode).toMatch(/^[A-Z2-9]{8}$/);
      expect(f.couponExpiresAt.getTime()).toBeGreaterThan(Date.now() + 14 * DIA);
    }
    expect(filas[0].couponCode).not.toBe(filas[1].couponCode);
    const [plantilla, destino] = mensajeria.despachar.mock.calls[0];
    expect(plantilla).toBe('extranamos');
    expect(destino).toMatchObject({ businessId: BIZ, customerId: 'c-viejo', clave: 'camp-1:c-viejo' });
    expect(destino.texto).toContain(filas[0].couponCode);
    expect(destino.texto).toContain('15% de descuento');
    expect(prisma.appointmentWinbackCampaign.updateMany).toHaveBeenCalledWith({ where: { id: 'camp-1', businessId: BIZ }, data: { sentCount: { increment: 2 }, lastRunAt: expect.any(Date) } });
  });

  it('si otra corrida ya le escribió (P2002 en el unique), NO le manda de nuevo', async () => {
    const { svc, prisma, mensajeria } = armar();
    prisma.appointmentWinbackSend.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(svc.enviar(BIZ, 'm')).resolves.toEqual({ sent: 1, skipped: 1 });
    expect(mensajeria.despachar).toHaveBeenCalledTimes(1);
    expect(mensajeria.despachar.mock.calls[0][1].customerId).toBe('c-ok');
  });

  it('sin cupón, el mensaje va tal cual y la fila no tiene código', async () => {
    const { svc, prisma, mensajeria } = armar({ campania: { couponEnabled: false } });
    await svc.enviar(BIZ, 'm');
    expect(prisma.appointmentWinbackSend.create.mock.calls[0][0].data.couponCode).toBeNull();
    expect(mensajeria.despachar.mock.calls[0][1].texto).toBe('Hola {nombre}, te extrañamos en {negocio}.');
  });

  it('función apagada, sin campaña o campaña apagada: 400 y no manda nada', async () => {
    for (const o of [{ on: false }, { campania: null }, { campania: { isActive: false } }]) {
      const { svc, mensajeria } = armar(o);
      await expect(svc.enviar(BIZ, 'm')).rejects.toBeInstanceOf(BadRequestException);
      expect(mensajeria.despachar).not.toHaveBeenCalled();
    }
  });

  it('guardar: una variable que no existe → 400 con la lista de las que sí', async () => {
    const { svc } = armar();
    await expect(svc.guardar(BIZ, 'm', { inactiveDays: 60, message: 'Hola {apodo}', couponEnabled: false, couponPercent: 10, couponValidDays: 15, mode: 'auto', isActive: true }))
      .rejects.toThrow('La variable {apodo} no existe. Podés usar: {nombre}, {negocio}, {servicio}, {link}.');
  });
});

describe('Cupón de la campaña al reservar', () => {
  const envio = (over: Record<string, unknown> = {}) => ({ id: 'send-1', businessId: BIZ, customerId: 'c-ok', couponCode: 'ABCD2345', couponExpiresAt: new Date(Date.now() + DIA), couponUsedAt: null, campaign: { couponEnabled: true, couponPercent: 15 }, ...over });

  it('es personal: de otro cliente o sin cliente, no vale', async () => {
    const { svc, prisma } = armar();
    prisma.appointmentWinbackSend.findFirst.mockResolvedValue(envio());
    await expect(svc.canjearCuponRecuperar({ businessId: BIZ, code: 'abcd2345', customerId: 'c-otro' })).rejects.toThrow('Ese cupón no es válido.');
    await expect(svc.canjearCuponRecuperar({ businessId: BIZ, code: 'abcd2345', customerId: null })).rejects.toThrow('Ese cupón no es válido.');
    expect(prisma.appointmentWinbackSend.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ, couponCode: 'ABCD2345' } }));
  });

  it('vencido: 400; ya usado (la condición del update no encuentra la fila): 409', async () => {
    const { svc, prisma } = armar();
    prisma.appointmentWinbackSend.findFirst.mockResolvedValueOnce(envio({ couponExpiresAt: new Date(Date.now() - 1000) }));
    await expect(svc.canjearCuponRecuperar({ businessId: BIZ, code: 'ABCD2345', customerId: 'c-ok' })).rejects.toThrow(/venció/);
    prisma.appointmentWinbackSend.findFirst.mockResolvedValueOnce(envio());
    prisma.appointmentWinbackSend.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.canjearCuponRecuperar({ businessId: BIZ, code: 'ABCD2345', customerId: 'c-ok' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('válido: marca couponUsedAt condicionado y devuelve el %', async () => {
    const { svc, prisma } = armar();
    prisma.appointmentWinbackSend.findFirst.mockResolvedValueOnce(envio());
    await expect(svc.canjearCuponRecuperar({ businessId: BIZ, code: 'ABCD2345', customerId: 'c-ok' })).resolves.toEqual({ percent: 15, sendId: 'send-1' });
    expect(prisma.appointmentWinbackSend.updateMany).toHaveBeenCalledWith({ where: { id: 'send-1', businessId: BIZ, couponUsedAt: null }, data: { couponUsedAt: expect.any(Date) } });
  });

  it('sin add-on el cupón no vale', async () => {
    await expect(armar({ addon: false }).svc.canjearCuponRecuperar({ businessId: BIZ, code: 'ABCD2345', customerId: 'c-ok' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
