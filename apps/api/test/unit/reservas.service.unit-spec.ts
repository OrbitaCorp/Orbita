import { BadRequestException, ConflictException } from '@nestjs/common';
import { ReservasService } from '../../src/reservas/reservas.service';
import { DisponibilidadService } from '../../src/reservas/disponibilidad.service';
import { instante } from '../../src/reservas/dominio/tiempo';

// El motor sin base: lo que decide ANTES de tocar Postgres (política, ventana,
// apertura, grilla, bloqueos) y cómo reacciona cuando el compare-and-set no
// encuentra la fila en el estado que esperaba. La concurrencia de verdad está
// en test/reservas.e2e-spec.ts.

const BIZ = 'biz-1';
const AHORA = instante('2026-11-09', 10 * 60); // lunes 9/11 a las 10:00 de Argentina

const config = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'cfg', businessId: BIZ, modulo: 'ALQUILERES', activo: true, confirmacion: 'AUTOMATICA', retencionMinutos: 10,
  anticipacionMinimaMinutos: 60, anticipacionMaximaDias: 30, cancelacionHastaHoras: 24, reprogramacionHastaHoras: 24, reprogramacionesMaximas: 2,
  senaPorcentaje: 50, senaReembolsable: true, maximoActivasPorCliente: 3, listaDeEspera: true, margenMinutos: 0,
  horario: { '1': [[540, 1080]], '2': [[540, 1080]] }, ...over,
});

const cancha = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'r-cancha', businessId: BIZ, modulo: 'ALQUILERES', tipo: 'CANCHA', nombre: 'Cancha 1', cupo: 1, duracionMinutos: 60, pasoMinutos: null,
  margenMinutos: null, maximoSeguidos: 2, precio: 8000, horario: null, datos: { extras: [{ id: 'pelotas', nombre: 'Pelotas', precio: 1000 }] },
  memberId: null, orden: 0, activo: true, eliminadoEn: null, ...over,
});

const reserva = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'res-1', businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cancha', servicioId: null, codigo: 'ABC234', tokenAcceso: 't'.repeat(32),
  estado: 'CONFIRMADA', origen: 'TIENDA', inicio: instante('2026-11-10', 600), fin: instante('2026-11-10', 660), fecha: '2026-11-10', cantidad: 1,
  exclusivo: true, retenidaHasta: null, clienteId: null, clienteNombre: 'Ana', clienteTelefono: null, clienteEmail: 'ana@test', notas: null,
  notaInterna: null, servicio: null, extras: null, precio: 8000, sena: 4000, pagado: 0, pagoMetodo: null, confirmadaEn: AHORA, completadaEn: null,
  canceladaEn: null, canceladaPor: null, motivoCancelacion: null, reprogramaciones: 0, claveIdempotencia: null, version: 1, creadaPorMemberId: null,
  createdAt: AHORA, updatedAt: AHORA, ...over,
});

function armar(opts: { reservas?: Record<string, unknown>[]; config?: Record<string, unknown>; recurso?: Record<string, unknown>; bloqueos?: unknown[] } = {}) {
  const filas = new Map((opts.reservas ?? [reserva()]).map((r) => [r.id as string, r]));
  const prisma: Record<string, unknown> = {
    reserva: {
      findFirst: jest.fn(async ({ where }: { where: { id?: string; tokenAcceso?: string } }) => {
        for (const r of filas.values()) if ((where.id && r.id === where.id) || (where.tokenAcceso && r.tokenAcceso === where.tokenAcceso)) return r;
        return null;
      }),
      findFirstOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => filas.get(where.id)),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    reservaHistorial: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    reservaBloqueo: { findMany: jest.fn().mockResolvedValue(opts.bloqueos ?? []) },
    reservaEspera: { findFirst: jest.fn().mockResolvedValue(null) },
    customer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'c-1' }) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'r-cancha', cupo: 1, activo: true, nombre: 'Cancha 1' }]),
  };
  const catalogo = {
    configOFalla: jest.fn().mockResolvedValue(opts.config ?? config()),
    recurso: jest.fn().mockResolvedValue(opts.recurso ?? cancha()),
    servicio: jest.fn(),
  };
  const disponibilidad = new DisponibilidadService(prisma as never, catalogo as never);
  const avisos = { confirmada: jest.fn(), pendiente: jest.fn(), cancelada: jest.fn(), reprogramada: jest.fn(), lugarTomado: jest.fn() };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const svc = new ReservasService(prisma as never, catalogo as never, disponibilidad, avisos as never, audit as never);
  return { svc, prisma, catalogo, avisos, audit, filas };
}

const pedido = (over: Record<string, unknown> = {}) => ({ modulo: 'ALQUILERES' as const, recursoId: 'r-cancha', fecha: '2026-11-10', inicioMinutos: 600, ...over });

describe('ReservasService · resolverPedido (lo que se verifica antes del candado)', () => {
  it('un pedido bien formado sale con su rango, su precio y su seña', async () => {
    const { svc } = armar();
    const p = await svc.resolverPedido(BIZ, pedido({ extras: ['pelotas', 'inventado'] }), 'publico', AHORA);
    expect(p.inicio.toISOString()).toBe(instante('2026-11-10', 600).toISOString());
    expect(p.fin.toISOString()).toBe(instante('2026-11-10', 660).toISOString());
    expect(p.precio).toBe(9000); // 8000 + pelotas
    expect(p.sena).toBe(4500);
    expect(p.extras).toEqual([{ id: 'pelotas', nombre: 'Pelotas', precio: 1000 }]);
  });

  it('dos franjas seguidas valen el doble; tres son más del máximo', async () => {
    const { svc } = armar();
    const p = await svc.resolverPedido(BIZ, pedido({ duracionMinutos: 120 }), 'publico', AHORA);
    expect(p.precio).toBe(16_000);
    await expect(svc.resolverPedido(BIZ, pedido({ duracionMinutos: 180 }), 'publico', AHORA)).rejects.toThrow(/hasta 2 franjas/);
    await expect(svc.resolverPedido(BIZ, pedido({ duracionMinutos: 90 }), 'publico', AHORA)).rejects.toThrow(/múltiplo de 60/);
  });

  it('fuera de la apertura, un día cerrado o fuera de la grilla: 400', async () => {
    const { svc } = armar();
    await expect(svc.resolverPedido(BIZ, pedido({ inicioMinutos: 1050 }), 'publico', AHORA)).rejects.toThrow(/fuera de la apertura/);
    await expect(svc.resolverPedido(BIZ, pedido({ fecha: '2026-11-14' }), 'publico', AHORA)).rejects.toThrow(/cerrado/);
    await expect(svc.resolverPedido(BIZ, pedido({ inicioMinutos: 615 }), 'publico', AHORA)).rejects.toThrow(/cada 60 minutos/);
    // El panel puede saltarse la apertura (un turno excepcional), no la grilla ni los bloqueos.
    const p = await svc.resolverPedido(BIZ, pedido({ inicioMinutos: 1050 }), 'panel', AHORA, { fueraDeHorario: true });
    expect(p.fin.toISOString()).toBe(instante('2026-11-10', 1110).toISOString());
  });

  it('la anticipación mínima y máxima valen solo para el sitio', async () => {
    const { svc } = armar();
    // Lunes 9/11 a las 10:00 con 60 minutos de anticipación: las 10:00 de hoy ya no.
    await expect(svc.resolverPedido(BIZ, pedido({ fecha: '2026-11-09', inicioMinutos: 600 }), 'publico', AHORA)).rejects.toThrow(/anticipación|ya pasó/);
    await expect(svc.resolverPedido(BIZ, pedido({ fecha: '2026-12-15' }), 'publico', AHORA)).rejects.toThrow(/30 días/);
    // El panel registra algo de hoy a la mañana (ya pasó, pero hasta un día atrás vale).
    const p = await svc.resolverPedido(BIZ, pedido({ fecha: '2026-11-09', inicioMinutos: 540 }), 'panel', AHORA);
    expect(p.fecha).toBe('2026-11-09');
  });

  it('un bloqueo del negocio tapa el horario, también para el panel', async () => {
    const { svc } = armar({ bloqueos: [{ inicio: instante('2026-11-10', 590), fin: instante('2026-11-10', 620) }] });
    await expect(svc.resolverPedido(BIZ, pedido(), 'panel', AHORA, { fueraDeHorario: true })).rejects.toThrow(/bloqueado/);
  });

  it('una clase solo se reserva en una sesión que existe, y hasta su cupo', async () => {
    const clase = cancha({ id: 'r-clase', modulo: 'GIMNASIO', tipo: 'CLASE', cupo: 10, maximoSeguidos: 1, horario: { '2': [[1140, 1200]] }, precio: 2500, datos: null });
    const { svc } = armar({ recurso: clase, config: config({ modulo: 'GIMNASIO' }) });
    const p = await svc.resolverPedido(BIZ, { modulo: 'GIMNASIO', recursoId: 'r-clase', fecha: '2026-11-10', inicioMinutos: 1140, cantidad: 2 }, 'publico', AHORA);
    expect(p.fin.toISOString()).toBe(instante('2026-11-10', 1200).toISOString());
    expect(p.precio).toBe(5000); // dos lugares
    await expect(svc.resolverPedido(BIZ, { modulo: 'GIMNASIO', recursoId: 'r-clase', fecha: '2026-11-10', inicioMinutos: 1170 }, 'publico', AHORA)).rejects.toThrow(/no hay clase/);
    await expect(svc.resolverPedido(BIZ, { modulo: 'GIMNASIO', recursoId: 'r-clase', fecha: '2026-11-10', inicioMinutos: 1140, cantidad: 11 }, 'publico', AHORA)).rejects.toThrow(/10 lugares/);
  });

  it('un alojamiento se reserva por noches, con su mínimo y su check-in/check-out', async () => {
    const cabana = cancha({ id: 'r-cab', tipo: 'ALOJAMIENTO', duracionMinutos: null, maximoSeguidos: 1, precio: 30_000, datos: { checkIn: 900, checkOut: 600, nochesMinimas: 2 } });
    const { svc } = armar({ recurso: cabana });
    const p = await svc.resolverPedido(BIZ, { modulo: 'ALQUILERES', recursoId: 'r-cab', fecha: '2026-11-13', fechaHasta: '2026-11-16' }, 'publico', AHORA);
    expect(p.inicio.toISOString()).toBe(instante('2026-11-13', 900).toISOString());
    expect(p.fin.toISOString()).toBe(instante('2026-11-16', 600).toISOString());
    expect(p.precio).toBe(90_000);
    await expect(svc.resolverPedido(BIZ, { modulo: 'ALQUILERES', recursoId: 'r-cab', fecha: '2026-11-13', fechaHasta: '2026-11-14' }, 'publico', AHORA)).rejects.toThrow(/mínima es de 2 noches/);
    await expect(svc.resolverPedido(BIZ, { modulo: 'ALQUILERES', recursoId: 'r-cab', fecha: '2026-11-13' }, 'publico', AHORA)).rejects.toThrow(/check-out/);
  });

  it('con las reservas online pausadas el sitio no reserva, pero el panel sí', async () => {
    const { svc } = armar({ config: config({ activo: false }) });
    await expect(svc.resolverPedido(BIZ, pedido(), 'publico', AHORA)).rejects.toThrow(/pausadas/);
    await expect(svc.resolverPedido(BIZ, pedido(), 'panel', AHORA)).resolves.toBeDefined();
  });
});

describe('ReservasService · crear', () => {
  it('con una clave ya usada devuelve la reserva existente sin abrir una transacción', async () => {
    const { svc, prisma } = armar();
    (prisma.reserva as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(reserva({ claveIdempotencia: 'k1' }));
    const r = await svc.crear(BIZ, pedido(), { estado: 'RETENIDA', origen: 'TIENDA', actor: 'CLIENTE', clave: 'k1' }, AHORA);
    expect(r.id).toBe('res-1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('toma el candado del recurso, vence las retenidas pasadas y cuenta antes de insertar', async () => {
    const { svc, prisma } = armar();
    const creada = reserva({ id: 'nueva', estado: 'RETENIDA' });
    (prisma.reserva as Record<string, jest.Mock>).create = jest.fn().mockResolvedValue(creada);
    const r = await svc.crear(BIZ, pedido(), { estado: 'RETENIDA', origen: 'TIENDA', actor: 'CLIENTE', clave: 'k2' }, AHORA);
    expect(r.id).toBe('nueva');
    const sql = (prisma.$queryRaw as jest.Mock).mock.calls[0][0].join('?');
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/business_id/);
    // Vencer retenidas: findMany por recurso + estado RETENIDA (hubo 0, así que no hay updateMany por eso).
    const findMany = (prisma.reserva as Record<string, jest.Mock>).findMany.mock.calls.map((c) => c[0].where);
    expect(findMany.some((w) => w.estado === 'RETENIDA' && w.recursoId === 'r-cancha' && w.businessId === BIZ)).toBe(true);
    const datos = (prisma.reserva as Record<string, jest.Mock>).create.mock.calls[0][0].data;
    expect(datos).toMatchObject({ businessId: BIZ, estado: 'RETENIDA', exclusivo: true, claveIdempotencia: 'k2', precio: 8000, sena: 4000 });
    expect(datos.retenidaHasta.toISOString()).toBe(new Date(AHORA.getTime() + 10 * 60_000).toISOString());
    expect(datos.codigo).toMatch(/^[A-Z2-9]{6}$/);
    expect(datos.tokenAcceso).toHaveLength(32);
  });

  it('si el lugar ya está tomado adentro de la transacción responde 409 y no inserta', async () => {
    const { svc, prisma } = armar();
    const p = prisma.reserva as Record<string, jest.Mock>;
    p.create = jest.fn();
    p.findMany.mockImplementation(async ({ where }: { where: { estado?: unknown; OR?: unknown } }) => (where.OR ? [{ cantidad: 1 }] : []));
    await expect(svc.crear(BIZ, pedido(), { estado: 'CONFIRMADA', origen: 'PANEL', actor: 'NEGOCIO', memberId: 'm-1', cliente: { nombre: 'Ana' } }, AHORA))
      .rejects.toThrow(ConflictException);
    expect(p.create).not.toHaveBeenCalled();
  });

  it('una reserva firme necesita los datos del cliente', async () => {
    const { svc } = armar();
    await expect(svc.crear(BIZ, pedido(), { estado: 'CONFIRMADA', origen: 'PANEL', actor: 'NEGOCIO', memberId: 'm-1' }, AHORA)).rejects.toThrow(/cliente/);
  });

  it('la restricción de exclusión de la base (23P01) se traduce a 409', async () => {
    const { svc, prisma } = armar();
    (prisma.reserva as Record<string, jest.Mock>).create = jest.fn().mockRejectedValue(new Error('ERROR: conflicting key value violates exclusion constraint "reservas_sin_solapamiento" (SQLSTATE 23P01)'));
    await expect(svc.crear(BIZ, pedido(), { estado: 'RETENIDA', origen: 'TIENDA', actor: 'CLIENTE', clave: 'k3' }, AHORA)).rejects.toThrow(/se acaba de ocupar/);
  });
});

describe('ReservasService · transiciones', () => {
  it('cancelar desde el sitio respeta el plazo; con la seña paga a tiempo se devuelve', async () => {
    const { svc, prisma, avisos } = armar({ reservas: [reserva({ pagado: 4000 })] });
    const r = await svc.cancelar(BIZ, { token: 't'.repeat(32) }, { actor: 'CLIENTE', motivo: 'No puedo' }, AHORA);
    expect(r.sena).toBe('DEVUELTA');
    const upd = (prisma.reserva as Record<string, jest.Mock>).updateMany.mock.calls[0][0];
    expect(upd.where).toMatchObject({ id: 'res-1', businessId: BIZ, estado: { in: ['RETENIDA', 'PENDIENTE', 'CONFIRMADA'] } });
    expect(upd.data).toMatchObject({ estado: 'CANCELADA', canceladaPor: 'CLIENTE', motivoCancelacion: 'No puedo' });
    expect(avisos.cancelada).toHaveBeenCalled();
  });

  it('cancelar desde el sitio fuera del plazo: 400 con el motivo', async () => {
    const cerca = reserva({ inicio: instante('2026-11-09', 20 * 60), fin: instante('2026-11-09', 21 * 60), fecha: '2026-11-09' });
    const { svc, prisma } = armar({ reservas: [cerca] });
    await expect(svc.cancelar(BIZ, { id: 'res-1' }, { actor: 'CLIENTE' }, AHORA)).rejects.toThrow(/24 horas antes/);
    expect((prisma.reserva as Record<string, jest.Mock>).updateMany).not.toHaveBeenCalled();
  });

  it('el negocio cancela siempre; mantenerSena deja la seña como perdida', async () => {
    const { svc } = armar({ reservas: [reserva({ pagado: 4000, inicio: instante('2026-11-09', 11 * 60), fin: instante('2026-11-09', 12 * 60) })] });
    const r = await svc.cancelar(BIZ, { id: 'res-1' }, { actor: 'NEGOCIO', memberId: 'm-1', mantenerSena: true }, AHORA);
    expect(r.sena).toBe('PERDIDA');
  });

  it('cancelar lo ya cancelado no hace nada; cancelar lo completado es 409', async () => {
    const { svc, prisma } = armar({ reservas: [reserva({ id: 'c', estado: 'CANCELADA' }), reserva({ id: 'k', estado: 'COMPLETADA' })] });
    const r = await svc.cancelar(BIZ, { id: 'c' }, { actor: 'NEGOCIO' }, AHORA);
    expect(r.reserva.estado).toBe('CANCELADA');
    expect((prisma.reserva as Record<string, jest.Mock>).updateMany).not.toHaveBeenCalled();
    await expect(svc.cancelar(BIZ, { id: 'k' }, { actor: 'NEGOCIO' }, AHORA)).rejects.toThrow(/completada y no puede pasar a cancelada/);
  });

  it('si otro la cambió antes (el compare-and-set no encuentra la fila), 409 y nada más', async () => {
    const { svc, prisma, filas } = armar();
    const p = prisma.reserva as Record<string, jest.Mock>;
    p.updateMany.mockImplementation(async () => {
      filas.set('res-1', reserva({ estado: 'COMPLETADA', version: 2 })); // alguien la completó en el medio
      return { count: 0 };
    });
    await expect(svc.cancelar(BIZ, { id: 'res-1' }, { actor: 'NEGOCIO', version: 1 }, AHORA)).rejects.toThrow(/cambió mientras la mirabas/);
    expect((prisma.reservaHistorial as Record<string, jest.Mock>).create).not.toHaveBeenCalled();
  });

  it('completar antes de la hora es 400; después, pasa y queda en el historial', async () => {
    const { svc, prisma } = armar();
    await expect(svc.transicionPanel(BIZ, 'res-1', 'm-1', 'COMPLETADA', {}, AHORA)).rejects.toThrow(BadRequestException);
    const despues = instante('2026-11-10', 700);
    await svc.transicionPanel(BIZ, 'res-1', 'm-1', 'COMPLETADA', {}, despues);
    const upd = (prisma.reserva as Record<string, jest.Mock>).updateMany.mock.calls[0][0];
    expect(upd.where.estado).toEqual({ in: ['CONFIRMADA'] });
    expect(upd.data).toMatchObject({ estado: 'COMPLETADA' });
    expect((prisma.reservaHistorial as Record<string, jest.Mock>).create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ de: 'CONFIRMADA', a: 'COMPLETADA', quien: 'NEGOCIO' }) }));
  });

  it('confirmar una retenida vencida la vence y responde 409', async () => {
    const { svc, prisma } = armar({ reservas: [reserva({ estado: 'RETENIDA', retenidaHasta: new Date(AHORA.getTime() - 1000) })] });
    await expect(svc.confirmarRetenida(BIZ, 't'.repeat(32), { nombre: 'Ana', email: 'ana@test' }, undefined, undefined, AHORA)).rejects.toThrow(/venció el tiempo/);
    expect((prisma.reserva as Record<string, jest.Mock>).updateMany.mock.calls[0][0].data.estado).toBe('VENCIDA');
  });

  it('el pago no se pasa del total y se acumula', async () => {
    const { svc, prisma } = armar({ reservas: [reserva({ pagado: 3000 })] });
    await expect(svc.registrarPago(BIZ, 'res-1', 'm-1', { monto: 6000, metodo: 'EFECTIVO' }, AHORA)).rejects.toThrow(/se pasa del total/);
    await svc.registrarPago(BIZ, 'res-1', 'm-1', { monto: 5000, metodo: 'TRANSFERENCIA' }, AHORA);
    expect((prisma.reserva as Record<string, jest.Mock>).updateMany.mock.calls[0][0].data).toMatchObject({ pagado: 8000, pagoMetodo: 'TRANSFERENCIA' });
  });
});

describe('ReservasService · política', () => {
  const { svc } = armar();
  const reglas = { cancelacionHastaHoras: 24, reprogramacionHastaHoras: 12, reprogramacionesMaximas: 1, senaReembolsable: true };

  it('con tiempo puede todo; con la seña paga, se devuelve', () => {
    const p = svc.politica(reserva({ pagado: 4000 }) as never, reglas, AHORA);
    expect(p).toMatchObject({ puedeCancelar: true, puedeReprogramar: true, reprogramacionesRestantes: 1, senaSiCancela: 'DEVUELTA', motivo: null });
  });

  it('a 20 horas ya no cancela pero sí reprograma; la seña se perdería', () => {
    const r = reserva({ pagado: 4000, inicio: instante('2026-11-10', 360), fin: instante('2026-11-10', 420) });
    const p = svc.politica(r as never, reglas, AHORA);
    expect(p).toMatchObject({ puedeCancelar: false, puedeReprogramar: true, senaSiCancela: 'PERDIDA' });
  });

  it('ya reprogramada una vez, no se reprograma más', () => {
    const p = svc.politica(reserva({ reprogramaciones: 1 }) as never, reglas, AHORA);
    expect(p).toMatchObject({ puedeCancelar: true, puedeReprogramar: false, motivo: 'Ya se reprogramó las veces permitidas.' });
  });

  it('cancelada o pasada: nada', () => {
    expect(svc.politica(reserva({ estado: 'CANCELADA' }) as never, reglas, AHORA)).toMatchObject({ puedeCancelar: false, puedeReprogramar: false, cancelarHasta: null });
    expect(svc.politica(reserva() as never, reglas, instante('2026-11-10', 700))).toMatchObject({ puedeCancelar: false, motivo: 'La reserva ya empezó.' });
  });
});
