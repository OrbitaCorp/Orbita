import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GimnasioService } from '../../src/gimnasio/gimnasio.service';
import { instante } from '../../src/reservas/dominio/tiempo';

// Lo que Gimnasio decide sin la base: qué se guarda de un plan, cuándo
// arranca el que se asigna, con qué se paga un lugar y qué se le pide al
// motor. La cuenta fina de los packs está en src/gimnasio/dominio/planes.spec.ts
// y lo que solo Postgres prueba (los filtros sobre `datos` y dos pedidos a la
// vez por la última clase) en test/gimnasio.e2e-spec.ts.

const BIZ = 'biz-1';
const MIEMBRO = 'm-1';
const AHORA = instante('2026-11-24', 10 * 60); // martes 24/11 a las 10:00 de Argentina
const HOY = '2026-11-24';
const CLAVE = '6f1d6d3e-6f0a-4e0e-9d2b-1f6a4a1b2c3d';

const plan = (over: Record<string, unknown> = {}) => ({
  id: 'pl-pack', businessId: BIZ, tipo: 'PACK', nombre: 'Pack de 8', precio: new Prisma.Decimal(40000), clases: 8, porSemana: null, vigenciaDias: 30,
  activo: true, orden: 0, eliminadoEn: null, createdAt: AHORA, updatedAt: AHORA, ...over,
});
const membresia = (over: Record<string, unknown> = {}) => plan({ id: 'pl-mem', tipo: 'MEMBRESIA', nombre: '2 por semana', precio: new Prisma.Decimal(30000), clases: null, porSemana: 2, ...over });
const suscripcion = (over: Record<string, unknown> = {}) => ({
  id: 's-1', businessId: BIZ, alumnoId: 'a-1', planId: 'pl-pack', tipo: 'PACK', nombre: 'Pack de 8', precio: new Prisma.Decimal(40000), clases: 8, porSemana: null,
  desde: '2026-11-10', hasta: '2026-12-10', estado: 'VIGENTE', renuevaId: null, creadaPorMemberId: MIEMBRO, createdAt: AHORA, updatedAt: AHORA, ...over,
});
const alumno = (over: Record<string, unknown> = {}) => ({ id: 'a-1', businessId: BIZ, clienteId: 'c-1', nota: null, alta: '2026-11-01', createdAt: AHORA, updatedAt: AHORA, ...over });
const ficha = { firstName: 'Lu', lastName: 'Paz', phone: '3757 55-0101', email: null };
const reserva = (over: Record<string, unknown> = {}) => ({
  id: 'res-1', businessId: BIZ, modulo: 'GIMNASIO', recursoId: 'r-1', estado: 'CONFIRMADA', fecha: '2026-11-25', cantidad: 1, clienteId: 'c-1', datos: null, ...over,
});
/** Una reserva pagada con un plan, como la devuelve la cuenta de usos. */
const usada = (suscripcionId: string, fecha: string, cantidad = 1) => ({ clienteId: 'c-1', fecha, cantidad, datos: { gimnasio: { pago: 'plan', suscripcionId } } });

function armar(o: {
  planes?: ReturnType<typeof plan>[]; alumnos?: ReturnType<typeof alumno>[]; suscripciones?: ReturnType<typeof suscripcion>[];
  usadas?: ReturnType<typeof usada>[]; reservaConClave?: ReturnType<typeof reserva> | null; reservaPorId?: ReturnType<typeof reserva> | null; yaProbo?: boolean;
} = {}) {
  const planes = o.planes ?? [plan(), membresia()];
  const alumnos = o.alumnos ?? [alumno()];
  const suscripciones = o.suscripciones ?? [];
  const conFicha = (a: ReturnType<typeof alumno>) => ({ ...a, cliente: ficha, suscripciones: suscripciones.filter((s) => s.alumnoId === a.id) });
  const prisma: Record<string, any> = {
    gimnasioPlan: {
      findMany: jest.fn(async ({ where }: any) => planes.filter((p) => !p.eliminadoEn && (where.activo === undefined || p.activo === where.activo))),
      findFirst: jest.fn(async ({ where }: any) => planes.find((p) => !p.eliminadoEn && (where.id ? p.id === where.id : p.tipo === where.tipo)) ?? null),
      updateMany: jest.fn(async () => ({ count: 1 })),
      create: jest.fn(async ({ data }: any) => ({ id: 'pl-nuevo', ...data })),
    },
    gimnasioAlumno: {
      findMany: jest.fn(async () => alumnos.map(conFicha)),
      findFirst: jest.fn(async ({ where, include }: any) => {
        const a = alumnos.find((x) => (where.id ? x.id === where.id : x.clienteId === where.clienteId));
        return a ? (include ? conFicha(a) : a) : null;
      }),
      create: jest.fn(async ({ data }: any) => ({ id: 'a-nuevo', nota: null, ...data })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    gimnasioSuscripcion: {
      findMany: jest.fn(async ({ where }: any) => suscripciones.filter((s) => (!where.alumnoId || s.alumnoId === where.alumnoId) && (!where.estado || s.estado === where.estado))),
      findFirst: jest.fn(async ({ where }: any) => suscripciones.find((s) => s.id === where.id) ?? null),
      create: jest.fn(async ({ data }: any) => ({ id: 's-nueva', estado: 'VIGENTE', ...data })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    reserva: {
      findUnique: jest.fn(async () => o.reservaConClave ?? null),
      findFirst: jest.fn(async () => o.reservaPorId ?? null),
      findMany: jest.fn(async ({ where }: any) => (where.datos?.equals === 'plan' ? o.usadas ?? [] : [])),
      count: jest.fn(async () => (o.yaProbo ? 1 : 0)),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    customer: { findFirst: jest.fn(async ({ where }: any) => (where.id === 'c-1' ? { id: 'c-1' } : null)) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    $queryRaw: jest.fn(async () => [{ id: 'a-1' }]),
  };
  const catalogo = { configOFalla: jest.fn(async () => ({ modulo: 'GIMNASIO' })) };
  const motor = {
    // (negocio, pedido, opciones, ahora): lo que Gimnasio le pide al motor.
    crear: jest.fn(async (_b: string, pedido: any, _opciones?: any, _ahora?: Date) => reserva({ id: 'res-nueva', fecha: pedido.fecha, cantidad: pedido.cantidad, datos: pedido.datos })),
    fichaDe: jest.fn(async () => 'c-nueva'),
  };
  const audit = { registrar: jest.fn(async () => undefined) };
  const svc = new GimnasioService(prisma as never, catalogo as never, motor as never, audit as never);
  return { svc, prisma, catalogo, motor, audit };
}

const planNuevo = (over: Record<string, unknown> = {}) => ({ tipo: 'PACK' as const, nombre: 'Pack de 12', precio: 55000, clases: 12, vigenciaDias: 45, activo: true, ...over });

describe('GimnasioService · planes', () => {
  it('guarda la lista entera en una transacción: cambia los que traen id, crea los nuevos y quita los que ya no vienen', async () => {
    const { svc, prisma, audit } = armar();
    await svc.guardarPlanes(BIZ, MIEMBRO, { planes: [{ id: 'pl-pack', ...planNuevo({ nombre: 'Pack de 8', clases: 8, precio: 42000 }) }, planNuevo()] }, AHORA);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // La membresía ya no vino: borrado blando, y deja de ofrecerse.
    expect(prisma.gimnasioPlan.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ, id: { in: ['pl-mem'] } }, data: { eliminadoEn: AHORA, activo: false } });
    expect(prisma.gimnasioPlan.updateMany).toHaveBeenCalledWith({ where: { id: 'pl-pack', businessId: BIZ }, data: expect.objectContaining({ precio: 42000, clases: 8, porSemana: null, orden: 0 }) });
    expect(prisma.gimnasioPlan.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, nombre: 'Pack de 12', clases: 12, orden: 1 }) });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, memberId: MIEMBRO, entityType: 'gimnasio_planes', action: 'UPDATE' }));
  });

  it('las clases se guardan solo en un pack y el tope semanal solo en una membresía (sin dato, libre)', async () => {
    const { svc, prisma } = armar({ planes: [] });
    await svc.guardarPlanes(BIZ, MIEMBRO, { planes: [
      planNuevo({ tipo: 'MEMBRESIA', nombre: 'Pase libre', clases: 99, porSemana: undefined }),
      planNuevo({ tipo: 'SUELTA', nombre: 'Clase suelta', clases: 5, porSemana: 3 }),
      planNuevo({ tipo: 'MEMBRESIA', nombre: '3 por semana', clases: undefined, porSemana: 3 }),
    ] }, AHORA);
    const guardados = prisma.gimnasioPlan.create.mock.calls.map(([{ data }]: any) => [data.nombre, data.clases, data.porSemana]);
    expect(guardados).toEqual([['Pase libre', null, 0], ['Clase suelta', null, null], ['3 por semana', null, 3]]);
  });

  it('no guarda nada si un plan ya no existe, si viene dos veces o si un pack no dice cuántas clases trae', async () => {
    const { svc, prisma } = armar();
    await expect(svc.guardarPlanes(BIZ, MIEMBRO, { planes: [{ id: 'pl-borrado', ...planNuevo() }] }, AHORA)).rejects.toThrow(/ya no existe/);
    await expect(svc.guardarPlanes(BIZ, MIEMBRO, { planes: [{ id: 'pl-pack', ...planNuevo() }, { id: 'pl-pack', ...planNuevo() }] }, AHORA)).rejects.toThrow(/dos veces/);
    await expect(svc.guardarPlanes(BIZ, MIEMBRO, { planes: [planNuevo({ clases: undefined })] }, AHORA)).rejects.toThrow(/cuántas clases trae/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('un negocio sin Gimnasio configurado no guarda planes', async () => {
    const { svc, catalogo, prisma } = armar();
    catalogo.configOFalla.mockRejectedValueOnce(new NotFoundException('Este negocio no tiene reservas configuradas para ese módulo.'));
    await expect(svc.guardarPlanes(BIZ, MIEMBRO, { planes: [] }, AHORA)).rejects.toThrow(NotFoundException);
    expect(prisma.gimnasioPlan.findMany).not.toHaveBeenCalled();
  });
});

describe('GimnasioService · alumnos', () => {
  it('dar de alta con nombre y celular busca o crea la ficha por el motor y deja al alumno con el día de hoy', async () => {
    const { svc, prisma, motor, audit } = armar({ alumnos: [] });
    prisma.gimnasioAlumno.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...alumno({ id: 'a-nuevo', clienteId: 'c-nueva', alta: HOY }), cliente: ficha, suscripciones: [] });
    const a = await svc.alta(BIZ, MIEMBRO, { cliente: { nombre: 'Lu Paz', telefono: '3757 55-0101' }, nota: 'Viene de mañana' }, AHORA);
    expect(motor.fichaDe).toHaveBeenCalledWith(BIZ, { nombre: 'Lu Paz', telefono: '3757 55-0101' });
    expect(prisma.gimnasioAlumno.create).toHaveBeenCalledWith({ data: { businessId: BIZ, clienteId: 'c-nueva', nota: 'Viene de mañana', alta: HOY } });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'gimnasio_alumno', action: 'CREATE' }));
    expect(a).toMatchObject({ id: 'a-nuevo', nombre: 'Lu Paz', telefono: '3757 55-0101', alta: HOY, planes: [], ultimo: null, probo: false });
  });

  it('sin celular ni email no hay cómo reconocerlo después: no se da de alta', async () => {
    const { svc, motor } = armar();
    await expect(svc.alta(BIZ, MIEMBRO, { cliente: { nombre: 'Lu Paz' } }, AHORA)).rejects.toThrow(/celular o un email/);
    await expect(svc.alta(BIZ, MIEMBRO, {}, AHORA)).rejects.toThrow(/Elegí a alguien/);
    expect(motor.fichaDe).not.toHaveBeenCalled();
  });

  it('quien ya era alumno no se duplica: devuelve el mismo, también si dos altas llegan a la vez', async () => {
    const { svc, prisma } = armar();
    const a = await svc.alta(BIZ, MIEMBRO, { clienteId: 'c-1' }, AHORA);
    expect(a.id).toBe('a-1');
    expect(prisma.gimnasioAlumno.create).not.toHaveBeenCalled();
    // La otra alta ganó entre la búsqueda y el alta: la base frena la segunda (único por negocio y ficha) y se devuelve la que quedó.
    const carrera = armar();
    carrera.prisma.gimnasioAlumno.findFirst.mockResolvedValueOnce(null);
    carrera.prisma.gimnasioAlumno.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('repetido', { code: 'P2002', clientVersion: 'x' }));
    expect((await carrera.svc.alta(BIZ, MIEMBRO, { clienteId: 'c-1' }, AHORA)).id).toBe('a-1');
  });

  it('una ficha de otro negocio no sirve', async () => {
    const { svc } = armar();
    await expect(svc.alta(BIZ, MIEMBRO, { clienteId: 'c-de-otro' }, AHORA)).rejects.toThrow(/ficha de cliente no existe/);
  });

  it('la lista trae cada alumno con sus planes, lo que usó y si ya tomó la clase de prueba', async () => {
    const { svc, prisma } = armar({ suscripciones: [suscripcion()], usadas: [usada('s-1', '2026-11-17', 2), usada('s-1', '2026-11-19'), usada('s-de-otro', '2026-11-19')] });
    prisma.reserva.findMany.mockImplementation(async ({ where }: any) => (where.datos.equals === 'plan' ? [usada('s-1', '2026-11-17', 2), usada('s-1', '2026-11-19'), usada('s-de-otro', '2026-11-19')] : [{ clienteId: 'c-1' }]));
    const [a] = await svc.alumnos(BIZ, AHORA);
    expect(a).toMatchObject({ id: 'a-1', clienteId: 'c-1', probo: true, ultimo: null });
    expect(a.planes).toEqual([expect.objectContaining({ id: 's-1', nombre: 'Pack de 8', precio: 40000, hasta: '2026-12-10', usadas: 3, restantes: 5 })]);
    // Las dos cuentas miran solo las reservas de Gimnasio de este negocio que cuentan (ni canceladas ni vencidas).
    for (const [{ where }] of prisma.reserva.findMany.mock.calls) {
      expect(where).toMatchObject({ businessId: BIZ, modulo: 'GIMNASIO', clienteId: { in: ['c-1'] }, estado: { in: ['PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'AUSENTE'] } });
    }
  });

  it('quien no tiene ningún plan vigente muestra el último que tuvo', async () => {
    const { svc } = armar({ suscripciones: [suscripcion({ id: 's-vieja', desde: '2026-09-01', hasta: '2026-10-01' }), suscripcion({ id: 's-ultima', desde: '2026-10-05', hasta: '2026-11-05' })] });
    const [a] = await svc.alumnos(BIZ, AHORA);
    expect(a.planes).toEqual([]);
    expect(a.ultimo).toMatchObject({ id: 's-ultima', hasta: '2026-11-05' });
  });
});

describe('GimnasioService · asignar o renovar un plan', () => {
  it('toma el candado del alumno antes de mirar lo que tiene, y guarda una foto del plan', async () => {
    const { svc, prisma } = armar();
    await svc.asignarPlan(BIZ, MIEMBRO, 'a-1', 'pl-pack', AHORA);
    const candado = prisma.$queryRaw.mock.invocationCallOrder[0];
    expect(candado).toBeLessThan(prisma.gimnasioSuscripcion.findMany.mock.invocationCallOrder[0]);
    expect(candado).toBeLessThan(prisma.gimnasioSuscripcion.create.mock.invocationCallOrder[0]);
    expect(prisma.gimnasioSuscripcion.create).toHaveBeenCalledWith({ data: {
      businessId: BIZ, alumnoId: 'a-1', planId: 'pl-pack', tipo: 'PACK', nombre: 'Pack de 8', precio: new Prisma.Decimal(40000), clases: 8, porSemana: null,
      desde: HOY, hasta: '2026-12-24', renuevaId: null, creadaPorMemberId: MIEMBRO,
    } });
  });

  it('renovar la misma membresía antes de que venza la continúa: arranca al día siguiente y dice cuál renueva', async () => {
    const { svc, prisma } = armar({ suscripciones: [suscripcion({ id: 's-mem', planId: 'pl-mem', tipo: 'MEMBRESIA', clases: null, porSemana: 2, desde: '2026-11-01', hasta: '2026-12-01' })] });
    await svc.asignarPlan(BIZ, MIEMBRO, 'a-1', 'pl-mem', AHORA);
    expect(prisma.gimnasioSuscripcion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ desde: '2026-12-02', hasta: '2027-01-01', renuevaId: 's-mem' }) });
    // No se cancela nada: es el mismo plan.
    expect(prisma.gimnasioSuscripcion.updateMany).not.toHaveBeenCalled();
  });

  it('pasar a otra membresía reemplaza a la que tenía (no se superponen dos); un pack convive con lo que tenga', async () => {
    const otra = suscripcion({ id: 's-otra', planId: 'pl-otra-mem', tipo: 'MEMBRESIA', clases: null, porSemana: 0, hasta: '2026-12-15' });
    const elPack = suscripcion({ id: 's-pack' });
    const cambio = armar({ suscripciones: [otra, elPack] });
    await cambio.svc.asignarPlan(BIZ, MIEMBRO, 'a-1', 'pl-mem', AHORA);
    expect(cambio.prisma.gimnasioSuscripcion.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ, id: { in: ['s-otra'] } }, data: { estado: 'CANCELADA' } });
    expect(cambio.prisma.gimnasioSuscripcion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ desde: HOY, renuevaId: null }) });
    const sumaPack = armar({ suscripciones: [otra, elPack] });
    await sumaPack.svc.asignarPlan(BIZ, MIEMBRO, 'a-1', 'pl-pack', AHORA);
    expect(sumaPack.prisma.gimnasioSuscripcion.updateMany).not.toHaveBeenCalled();
    expect(sumaPack.prisma.gimnasioSuscripcion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ desde: HOY, renuevaId: 's-pack' }) });
  });

  it('la clase de prueba y la clase suelta no se asignan; un plan que se quitó, tampoco', async () => {
    const { svc, prisma } = armar({ planes: [plan({ id: 'pl-prueba', tipo: 'PRUEBA', clases: null })] });
    await expect(svc.asignarPlan(BIZ, MIEMBRO, 'a-1', 'pl-prueba', AHORA)).rejects.toThrow(BadRequestException);
    await expect(svc.asignarPlan(BIZ, MIEMBRO, 'a-1', 'pl-que-no-esta', AHORA)).rejects.toThrow(NotFoundException);
    expect(prisma.gimnasioSuscripcion.create).not.toHaveBeenCalled();
  });

  it('quitar un plan asignado por error lo cancela; repetirlo no falla, y uno que no es de ese alumno es 404', async () => {
    const { svc, prisma, audit } = armar({ suscripciones: [suscripcion()] });
    await svc.quitarPlan(BIZ, MIEMBRO, 'a-1', 's-1', AHORA);
    expect(prisma.gimnasioSuscripcion.updateMany).toHaveBeenCalledWith({ where: { id: 's-1', businessId: BIZ, alumnoId: 'a-1', estado: 'VIGENTE' }, data: { estado: 'CANCELADA' } });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'gimnasio_suscripcion', action: 'DELETE' }));
    prisma.gimnasioSuscripcion.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.quitarPlan(BIZ, MIEMBRO, 'a-1', 's-1', AHORA)).resolves.toMatchObject({ id: 'a-1' });
    prisma.gimnasioSuscripcion.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.quitarPlan(BIZ, MIEMBRO, 'a-1', 's-de-otro', AHORA)).rejects.toThrow(NotFoundException);
  });
});

describe('GimnasioService · anotar diciendo cómo se paga', () => {
  const pedido = (over: Record<string, unknown> = {}) => ({ recursoId: 'r-1', fecha: '2026-11-25', inicioMinutos: 1080, alumnoId: 'a-1', pago: 'plan' as const, clave: CLAVE, ...over });

  it('con plan: toma el candado del alumno, elige la suscripción y le pide la reserva al motor con el pago adentro', async () => {
    const { svc, prisma, motor } = armar({ suscripciones: [suscripcion()], usadas: [usada('s-1', '2026-11-17', 7)] });
    const r = await svc.reservar(BIZ, MIEMBRO, pedido(), AHORA);
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(motor.crear.mock.invocationCallOrder[0]);
    expect(motor.crear).toHaveBeenCalledWith(
      BIZ,
      { modulo: 'GIMNASIO', recursoId: 'r-1', fecha: '2026-11-25', inicioMinutos: 1080, cantidad: 1, datos: { gimnasio: { pago: 'plan', suscripcionId: 's-1', planId: 'pl-pack' } } },
      { estado: 'CONFIRMADA', origen: 'PANEL', actor: 'NEGOCIO', memberId: MIEMBRO, clienteId: 'c-1', cliente: undefined, clave: CLAVE },
      AHORA,
    );
    expect(r.reserva.id).toBe('res-nueva');
    expect(r.pago.pago).toBe('plan');
  });

  it('sin clases en el pack no se reserva: 409 con el motivo, y al motor no se le pide nada', async () => {
    const { svc, motor } = armar({ suscripciones: [suscripcion()], usadas: [usada('s-1', '2026-11-17', 8)] });
    await expect(svc.reservar(BIZ, MIEMBRO, pedido(), AHORA)).rejects.toThrow(new ConflictException('No le quedan clases en el pack. Renovalo desde su ficha, o anotalo y cobrale la clase aparte.'));
    expect(motor.crear).not.toHaveBeenCalled();
  });

  it('sin plan, con el plan vencido o con el tope de la semana usado, tampoco; cada uno con su motivo', async () => {
    await expect(armar().svc.reservar(BIZ, MIEMBRO, pedido(), AHORA)).rejects.toThrow(/No tiene un plan/);
    await expect(armar({ suscripciones: [suscripcion({ hasta: '2026-11-20' })] }).svc.reservar(BIZ, MIEMBRO, pedido(), AHORA)).rejects.toThrow(/venció el 20\/11/);
    const conTope = armar({
      suscripciones: [suscripcion({ id: 's-mem', planId: 'pl-mem', tipo: 'MEMBRESIA', clases: null, porSemana: 2 })],
      usadas: [usada('s-mem', '2026-11-23'), usada('s-mem', '2026-11-24')],
    });
    await expect(conTope.svc.reservar(BIZ, MIEMBRO, pedido(), AHORA)).rejects.toThrow(/Ya usó sus 2 clases de esa semana/);
  });

  it('la cuenta de lo usado mira solo las reservas de esa persona, de Gimnasio, pagadas con plan y que cuentan', async () => {
    const { svc, prisma } = armar({ suscripciones: [suscripcion()] });
    await svc.reservar(BIZ, MIEMBRO, pedido(), AHORA);
    expect(prisma.reserva.findMany.mock.calls[0][0].where).toEqual({
      businessId: BIZ, modulo: 'GIMNASIO', clienteId: 'c-1', estado: { in: ['PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'AUSENTE'] }, datos: { path: ['gimnasio', 'pago'], equals: 'plan' },
    });
  });

  it('repetir el pedido con la misma clave devuelve la misma reserva y no descuenta de nuevo', async () => {
    const hecha = reserva({ id: 'res-hecha', datos: { gimnasio: { pago: 'plan', suscripcionId: 's-1' } } });
    const { svc, prisma, motor } = armar({ suscripciones: [suscripcion()], usadas: [usada('s-1', '2026-11-25', 8)], reservaConClave: hecha });
    const r = await svc.reservar(BIZ, MIEMBRO, pedido(), AHORA);
    expect(r.reserva.id).toBe('res-hecha');
    expect(prisma.reserva.findUnique).toHaveBeenCalledWith({ where: { businessId_claveIdempotencia: { businessId: BIZ, claveIdempotencia: CLAVE } } });
    expect(motor.crear).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    // Y dice cómo quedó el pack: las 8 usadas, con esta adentro.
    expect(r.pago).toMatchObject({ pago: 'plan', plan: { id: 's-1', usadas: 8, restantes: 0 } });
  });

  it('aparte: se cobra en el gimnasio como clase suelta, con su precio por lugar, y no mira ningún plan', async () => {
    const { svc, prisma, motor } = armar({ planes: [plan(), plan({ id: 'pl-suelta', tipo: 'SUELTA', nombre: 'Clase suelta', precio: new Prisma.Decimal(6000), clases: null })] });
    await svc.reservar(BIZ, MIEMBRO, pedido({ pago: 'aparte', cantidad: 2 }), AHORA);
    expect(motor.crear).toHaveBeenCalledWith(BIZ, expect.objectContaining({ cantidad: 2, datos: { gimnasio: { pago: 'aparte', planId: 'pl-suelta' } } }), expect.objectContaining({ precioManual: 12000 }), AHORA);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    // Sin clase suelta cargada, se anota igual y sin precio.
    const sinSuelta = armar();
    await sinSuelta.svc.reservar(BIZ, MIEMBRO, pedido({ pago: 'aparte' }), AHORA);
    expect(sinSuelta.motor.crear.mock.calls[0][1].datos).toEqual({ gimnasio: { pago: 'aparte' } });
    expect(sinSuelta.motor.crear.mock.calls[0][2].precioManual).toBeUndefined();
  });

  it('la clase de prueba es una vez por persona, de un lugar, y solo si el negocio la tiene cargada', async () => {
    const conPrueba = { planes: [plan({ id: 'pl-prueba', tipo: 'PRUEBA', nombre: 'Clase de prueba', precio: new Prisma.Decimal(0), clases: null })] };
    const ok = armar(conPrueba);
    await ok.svc.reservar(BIZ, MIEMBRO, pedido({ pago: 'prueba' }), AHORA);
    expect(ok.motor.crear.mock.calls[0][1].datos).toEqual({ gimnasio: { pago: 'prueba', planId: 'pl-prueba' } });
    await expect(armar({ ...conPrueba, yaProbo: true }).svc.reservar(BIZ, MIEMBRO, pedido({ pago: 'prueba' }), AHORA)).rejects.toThrow(/una sola vez por persona/);
    await expect(armar(conPrueba).svc.reservar(BIZ, MIEMBRO, pedido({ pago: 'prueba', cantidad: 2 }), AHORA)).rejects.toThrow(/un solo lugar/);
    await expect(armar().svc.reservar(BIZ, MIEMBRO, pedido({ pago: 'prueba' }), AHORA)).rejects.toThrow(/no tiene una clase de prueba/);
  });

  it('alguien nuevo se anota con los datos que se cargaron, y queda como alumno', async () => {
    const { svc, prisma, motor } = armar({ alumnos: [] });
    await svc.reservar(BIZ, MIEMBRO, pedido({ alumnoId: undefined, cliente: { nombre: 'Tomi Paz', telefono: '3757 55-0101' }, pago: 'aparte' }), AHORA);
    expect(motor.fichaDe).toHaveBeenCalledWith(BIZ, { nombre: 'Tomi Paz', telefono: '3757 55-0101' });
    // El nombre que se cargó viaja con la reserva aunque la ficha (por el celular) sea de otra persona.
    expect(motor.crear.mock.calls[0][2]).toMatchObject({ clienteId: 'c-nueva', cliente: { nombre: 'Tomi Paz', telefono: '3757 55-0101' } });
    expect(prisma.gimnasioAlumno.create).toHaveBeenCalledWith({ data: { businessId: BIZ, clienteId: 'c-nueva', nota: null, alta: HOY } });
  });

  it('si el motor dice que no queda lugar, el error sube tal cual', async () => {
    const { svc, motor } = armar({ suscripciones: [suscripcion()] });
    motor.crear.mockRejectedValueOnce(new ConflictException('No queda lugar en ese horario.'));
    await expect(svc.reservar(BIZ, MIEMBRO, pedido(), AHORA)).rejects.toThrow('No queda lugar en ese horario.');
  });
});

describe('GimnasioService · decir cómo se paga un lugar ya reservado', () => {
  it('pasarlo al plan descuenta con las mismas reglas, sin contarse a sí mismo, y conserva lo demás de datos', async () => {
    const r = reserva({ datos: { nota: 'se queda', gimnasio: { pago: 'aparte' } } });
    const { svc, prisma } = armar({ suscripciones: [suscripcion()], usadas: [usada('s-1', '2026-11-17', 7)], reservaPorId: r });
    await svc.definirPago(BIZ, MIEMBRO, 'res-1', { pago: 'plan' }, AHORA);
    expect(prisma.reserva.findMany.mock.calls[0][0].where).toMatchObject({ clienteId: 'c-1', id: { not: 'res-1' } });
    expect(prisma.reserva.updateMany).toHaveBeenCalledWith({
      where: { id: 'res-1', businessId: BIZ, estado: { in: ['PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'AUSENTE'] } },
      data: { datos: { nota: 'se queda', gimnasio: { pago: 'plan', suscripcionId: 's-1', planId: 'pl-pack' } } },
    });
  });

  it('sin clases en el pack no se pasa al plan, y la reserva queda como estaba', async () => {
    const { svc, prisma } = armar({ suscripciones: [suscripcion()], usadas: [usada('s-1', '2026-11-17', 8)], reservaPorId: reserva() });
    await expect(svc.definirPago(BIZ, MIEMBRO, 'res-1', { pago: 'plan' }, AHORA)).rejects.toThrow(/No le quedan clases en el pack/);
    expect(prisma.reserva.updateMany).not.toHaveBeenCalled();
  });

  it('un lugar cancelado, una reserva que no existe o una sin los datos de la persona no se tocan', async () => {
    await expect(armar({ reservaPorId: reserva({ estado: 'CANCELADA' }) }).svc.definirPago(BIZ, MIEMBRO, 'res-1', { pago: 'plan' }, AHORA)).rejects.toThrow(/ya no está reservado/);
    await expect(armar().svc.definirPago(BIZ, MIEMBRO, 'res-1', { pago: 'plan' }, AHORA)).rejects.toThrow(NotFoundException);
    await expect(armar({ reservaPorId: reserva({ clienteId: null }) }).svc.definirPago(BIZ, MIEMBRO, 'res-1', { pago: 'plan' }, AHORA)).rejects.toThrow(/no tiene los datos de la persona/);
    // "Aparte" no necesita saber quién es.
    const sinFicha = armar({ reservaPorId: reserva({ clienteId: null }) });
    await sinFicha.svc.definirPago(BIZ, MIEMBRO, 'res-1', { pago: 'aparte' }, AHORA);
    expect(sinFicha.prisma.reserva.updateMany.mock.calls[0][0].data).toEqual({ datos: { gimnasio: { pago: 'aparte' } } });
  });

  it('si el lugar se canceló justo antes de guardar, avisa en vez de darlo por hecho', async () => {
    const { svc, prisma } = armar({ suscripciones: [suscripcion()], reservaPorId: reserva() });
    prisma.reserva.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.definirPago(BIZ, MIEMBRO, 'res-1', { pago: 'plan' }, AHORA)).rejects.toThrow(/ya no está reservado/);
  });
});
