import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AUDIENCIA_OFERTA, ListaEsperaService } from '../../src/appointments/avanzado/lista-espera/lista-espera.service';
import { CrearTurno } from '../../src/appointments/avanzado/comun/nucleo-turnos';
import { instanteDe, sumarDias } from '../../src/appointments/horarios/horarios';
import { fechaArgentina } from '../../src/common/utils/hora-argentina';
import { BIZ, OWNER, auditor, conTransaccion, contexto, empleado } from './appointments.p4.helpers';

// Lista de espera de turnos (CONTRATO § P4.8): anotarse solo si el día está
// lleno, ofrecer el lugar liberado al primero que lo pidió, y la oferta como
// token firmado (JWT HS256, aud appointments-waitlist).

const SECRETO = 'secreto-de-prueba-de-al-menos-32-caracteres!!';
const config = { getOrThrow: () => SECRETO };
const proximoLunes = (() => { let f = sumarDias(fechaArgentina(new Date()), 2); while (new Date(`${f}T12:00:00Z`).getUTCDay() !== 1) f = sumarDias(f, 1); return f; })();
const SRV = '11111111-1111-4111-8111-111111111111';
const RES = '22222222-2222-4222-8222-222222222222';

const entrada = (over: Record<string, unknown> = {}) => ({
  id: 'w-1', businessId: BIZ, customerId: 'c-1', customerName: 'Sofía Ramírez', customerPhone: '1155550101', customerEmail: 'sofi@mail.com',
  serviceId: SRV, resourceId: null, date: proximoLunes, fromMin: null, toMin: null, status: 'WAITING', offeredAt: null, offerExpiresAt: null,
  offeredStartsAt: null, appointmentId: null, createdAt: new Date(), service: { name: 'Corte', durationMin: 30 }, ...over,
});

function armar(opts: { turnos?: { resourceId: string; startsAt: Date; endsAt: Date }[]; entradas?: Record<string, unknown>[]; waitlist?: boolean; nucleo?: boolean } = {}) {
  const ctx = contexto({ settings: { waitlistEnabled: opts.waitlist ?? true } });
  const lista = opts.entradas ?? [entrada()];
  const prisma = conTransaccion({
    business: ctx.business,
    appointmentSpecialDay: { findMany: jest.fn().mockResolvedValue([]) },
    appointmentResource: { findMany: jest.fn().mockResolvedValue([{ id: RES, workDays: [0, 1, 2, 3, 4, 5], ownSchedule: null, assignedSpaceId: null }]) },
    appointment: { findMany: jest.fn().mockResolvedValue(opts.turnos ?? []) },
    appointmentService: { findFirst: jest.fn().mockResolvedValue({ id: SRV, durationMin: 30 }) },
    appointmentWaitlistEntry: {
      findFirst: jest.fn(async ({ where }: { where: { id?: string } }) => lista.find((e) => !where.id || e.id === where.id) ?? null),
      findMany: jest.fn().mockResolvedValue(lista),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'w-nueva', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    customer: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'c-nuevo', firstName: 'Sofía', lastName: 'Ramírez', phone: '1155550101', email: null, passwordHash: null, googleId: null }),
    },
  });
  const mensajeria = { despachar: jest.fn().mockResolvedValue([]) };
  const crearTurno = jest.fn<ReturnType<CrearTurno>, Parameters<CrearTurno>>(async () => ({ id: 'turno-1', startsAt: instanteDe(proximoLunes, 600) }));
  const svc = new ListaEsperaService(prisma as never, ctx.svc, auditor() as never, config as never, mensajeria, opts.nucleo === false ? undefined : { crearTurno });
  return { svc, prisma, mensajeria, crearTurno };
}

/** Un turno que ocupa todo el horario del lunes (9 a 20). */
const diaLleno = [{ resourceId: RES, startsAt: instanteDe(proximoLunes, 9 * 60), endsAt: instanteDe(proximoLunes, 20 * 60) }];
const pedido = (over: Record<string, unknown> = {}) => ({ serviceId: SRV, date: proximoLunes, name: 'Sofía Ramírez', phone: '11 5555-0101', ...over });

describe('Anotarse desde el sitio', () => {
  it('si ese día todavía hay horarios para lo que pide: 400', async () => {
    await expect(armar().svc.anotarse(BIZ, pedido(), null)).rejects.toThrow('Ese día todavía tiene horarios.');
  });

  it('día lleno: queda WAITING, con el teléfono normalizado y la ficha del cliente', async () => {
    const { svc, prisma } = armar({ turnos: diaLleno, entradas: [] });
    await expect(svc.anotarse(BIZ, pedido(), null)).resolves.toEqual({ id: 'w-nueva', date: proximoLunes, status: 'WAITING' });
    expect(prisma.appointmentWaitlistEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, customerId: 'c-nuevo', customerPhone: '1155550101', serviceId: SRV, resourceId: null, date: proximoLunes }) });
    // El motor leyó turnos de ESE negocio y solo agenda + instantes.
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true, resourceId: true, startsAt: true, endsAt: true }, where: expect.objectContaining({ businessId: BIZ }) }));
  });

  it('con franja: cuenta solo los horarios libres dentro de lo que pidió', async () => {
    // Libre solo a la tarde; pide la mañana → se puede anotar.
    const manana = [{ resourceId: RES, startsAt: instanteDe(proximoLunes, 9 * 60), endsAt: instanteDe(proximoLunes, 13 * 60) }];
    const { svc } = armar({ turnos: manana, entradas: [] });
    await expect(svc.anotarse(BIZ, pedido({ fromMin: 540, toMin: 780 }), null)).resolves.toMatchObject({ status: 'WAITING' });
    await expect(armar({ turnos: manana, entradas: [] }).svc.anotarse(BIZ, pedido({ fromMin: 960, toMin: 1200 }), null)).rejects.toThrow('Ese día todavía tiene horarios.');
  });

  it('reglas: lista apagada (404), teléfono de 10 dígitos, franja completa, ya anotado', async () => {
    await expect(armar({ waitlist: false }).svc.anotarse(BIZ, pedido(), null)).rejects.toBeInstanceOf(NotFoundException);
    await expect(armar({ turnos: diaLleno }).svc.anotarse(BIZ, pedido({ phone: '11 5555 010' }), null)).rejects.toThrow('Faltan dígitos: son 10 con el código de área.');
    await expect(armar({ turnos: diaLleno }).svc.anotarse(BIZ, pedido({ fromMin: 600 }), null)).rejects.toThrow('Elegí desde y hasta qué hora te sirve.');
    await expect(armar({ turnos: diaLleno }).svc.anotarse(BIZ, pedido(), null)).rejects.toThrow('Ya estás en la lista de espera de ese día.');
    await expect(armar({ turnos: diaLleno }).svc.anotarse(BIZ, pedido({ date: '2020-01-06' }), null)).rejects.toThrow('Esa fecha ya pasó.');
  });
});

describe('Ofrecer el lugar liberado', () => {
  const liberado = instanteDe(proximoLunes, 10 * 60);

  it('al primero que esperaba y cuyo pedido lo contiene: OFFERED con plazo, mensaje con el enlace firmado', async () => {
    const tarde = entrada({ id: 'w-tarde', fromMin: 960, toMin: 1200 });
    const manana = entrada({ id: 'w-manana', fromMin: 540, toMin: 720 });
    const { svc, prisma, mensajeria } = armar({ entradas: [tarde, manana] });
    const r = await svc.ofrecerLugarLiberado({ businessId: BIZ, resourceId: RES, startsAt: liberado });
    expect(r?.entryId).toBe('w-manana');
    expect(r!.offerExpiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);
    expect(prisma.appointmentWaitlistEntry.updateMany).toHaveBeenCalledWith({
      where: { id: 'w-manana', businessId: BIZ, status: { in: ['WAITING'] } },
      data: expect.objectContaining({ status: 'OFFERED', offeredStartsAt: liberado }),
    });
    const destino = mensajeria.despachar.mock.calls[0][1];
    expect(mensajeria.despachar.mock.calls[0][0]).toBe('espera');
    expect(destino.variables).toMatchObject({ servicio: 'Corte', hora: '10:00' });
    const token = decodeURIComponent(destino.variables.link.split('oferta=')[1]);
    const payload = jwt.verify(token, SECRETO, { audience: AUDIENCIA_OFERTA }) as jwt.JwtPayload;
    expect(payload).toMatchObject({ sub: 'w-manana', rid: RES, st: liberado.toISOString() });
    expect(payload.exp! * 1000).toBeLessThanOrEqual(r!.offerExpiresAt.getTime() + 1000);
  });

  it('si el lugar no está libre para ese servicio (otro turno lo tapa), no ofrece', async () => {
    const tapado = [{ resourceId: RES, startsAt: liberado, endsAt: instanteDe(proximoLunes, 10 * 60 + 30) }];
    await expect(armar({ turnos: tapado }).svc.ofrecerLugarLiberado({ businessId: BIZ, resourceId: RES, startsAt: liberado })).resolves.toBeNull();
  });

  it('con la lista de espera apagada no hace nada', async () => {
    const { svc, prisma } = armar({ waitlist: false });
    await expect(svc.ofrecerLugarLiberado({ businessId: BIZ, resourceId: RES, startsAt: liberado })).resolves.toBeNull();
    expect(prisma.appointmentWaitlistEntry.findMany).not.toHaveBeenCalled();
  });
});

describe('Aceptar la oferta', () => {
  const inicio = instanteDe(proximoLunes, 600);
  const ofrecida = (over: Record<string, unknown> = {}) => entrada({ status: 'OFFERED', offeredStartsAt: inicio, offerExpiresAt: new Date(Date.now() + 20 * 60_000), ...over });
  const firmar = (claims: Record<string, unknown> = {}, opciones: jwt.SignOptions = {}) =>
    jwt.sign({ rid: RES, st: inicio.toISOString(), ...claims }, SECRETO, { audience: AUDIENCIA_OFERTA, subject: 'w-1', expiresIn: 600, ...opciones });

  it('crea el turno con el núcleo (§ 1.1) y marca ACCEPTED en la misma transacción', async () => {
    const { svc, prisma, crearTurno } = armar({ entradas: [ofrecida()] });
    await expect(svc.aceptar(BIZ, firmar())).resolves.toEqual({ appointmentId: 'turno-1', startsAt: inicio.toISOString() });
    expect(crearTurno).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, serviceId: SRV, resourceId: RES, date: proximoLunes, startMin: 600, customerId: 'c-1', origin: 'STOREFRONT' }), prisma);
    expect(prisma.appointmentWaitlistEntry.updateMany).toHaveBeenCalledWith({ where: { id: 'w-1', businessId: BIZ, status: 'OFFERED' }, data: { status: 'ACCEPTED', appointmentId: 'turno-1' } });
  });

  it('un token de sesión, uno de otra audiencia o uno adulterado: 404 sin decir por qué', async () => {
    const { svc, crearTurno } = armar({ entradas: [ofrecida()] });
    const sesion = jwt.sign({ sub: 'w-1', type: 'customer' }, SECRETO);
    await expect(svc.aceptar(BIZ, sesion)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.aceptar(BIZ, firmar({}, { audience: 'otra-cosa' }))).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.aceptar(BIZ, jwt.sign({ rid: RES, st: inicio.toISOString() }, 'otro-secreto-cualquiera-de-32-caracteres', { audience: AUDIENCIA_OFERTA, subject: 'w-1' }))).rejects.toBeInstanceOf(NotFoundException);
    // Un enlace de una oferta anterior (otro horario) ya no sirve.
    await expect(svc.aceptar(BIZ, firmar({ st: new Date(inicio.getTime() + 3600_000).toISOString() }))).rejects.toBeInstanceOf(NotFoundException);
    expect(crearTurno).not.toHaveBeenCalled();
  });

  it('una entrada de otro negocio no existe', async () => {
    const { svc, prisma } = armar({ entradas: [ofrecida()] });
    prisma.appointmentWaitlistEntry.findFirst.mockResolvedValueOnce(null);
    await expect(svc.aceptar(BIZ, firmar())).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.appointmentWaitlistEntry.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'w-1', businessId: BIZ } }));
  });

  it('vencida (token o plazo): 400 y la oferta pasa al siguiente', async () => {
    const { svc, prisma } = armar({ entradas: [ofrecida({ offerExpiresAt: new Date(Date.now() - 1000) })] });
    await expect(svc.aceptar(BIZ, firmar())).rejects.toThrow('La oferta venció: el lugar pasó al siguiente de la lista.');
    expect(prisma.appointmentWaitlistEntry.updateMany).toHaveBeenCalledWith({ where: { id: 'w-1', businessId: BIZ, status: 'OFFERED' }, data: { status: 'EXPIRED' } });
    const vencido = jwt.sign({ rid: RES, st: inicio.toISOString(), exp: Math.floor(Date.now() / 1000) - 10 }, SECRETO, { audience: AUDIENCIA_OFERTA, subject: 'w-1' });
    await expect(armar({ entradas: [ofrecida()] }).svc.aceptar(BIZ, vencido)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('si el horario se ocupó (409 del núcleo), sigue esperando', async () => {
    const { svc, prisma, crearTurno } = armar({ entradas: [ofrecida()] });
    crearTurno.mockRejectedValueOnce(new ConflictException('Ese horario se acaba de ocupar. Elegí otro.'));
    await expect(svc.aceptar(BIZ, firmar())).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.appointmentWaitlistEntry.updateMany).toHaveBeenCalledWith({ where: { id: 'w-1', businessId: BIZ, status: 'OFFERED' }, data: { status: 'WAITING', offerExpiresAt: null } });
  });

  it('sin el núcleo de turnos: 503', async () => {
    await expect(armar({ entradas: [ofrecida()], nucleo: false }).svc.aceptar(BIZ, firmar())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('aceptar dos veces la misma oferta devuelve el mismo turno (idempotente)', async () => {
    const { svc, crearTurno } = armar({ entradas: [ofrecida({ status: 'ACCEPTED', appointmentId: 'turno-1' })] });
    await expect(svc.aceptar(BIZ, firmar())).resolves.toMatchObject({ appointmentId: 'turno-1' });
    expect(crearTurno).not.toHaveBeenCalled();
  });
});

describe('Panel', () => {
  it('sin view_all: solo lo pedido para sus agendas o para "cualquiera"; teléfono tapado sin clients.contact', async () => {
    const { svc, prisma } = armar();
    prisma.appointmentResource.findMany.mockResolvedValueOnce([{ id: RES, assignedSpaceId: 'espacio-1' }]);
    const [e] = await svc.listar(empleado(['appointments.agenda.view']) as never, {});
    expect(prisma.appointmentWaitlistEntry.findMany.mock.calls.at(-1)![0].where).toMatchObject({
      businessId: BIZ, OR: [{ resourceId: null }, { resourceId: { in: [RES, 'espacio-1'] } }],
    });
    expect(e.customer).toEqual({ id: 'c-1', name: 'Sofía Ramírez', phone: '••••••••01', email: null });
  });

  it('el dueño ve todo y con contacto', async () => {
    const { svc, prisma } = armar();
    const [e] = await svc.listar(OWNER as never, {});
    expect(prisma.appointmentWaitlistEntry.findMany.mock.calls.at(-1)![0].where.OR).toBeUndefined();
    expect(e.customer.phone).toBe('1155550101');
  });
});
