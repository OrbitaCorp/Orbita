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
    reservaBloqueo: {
      findMany: jest.fn().mockResolvedValue(opts.bloqueos ?? []),
      // Lo que mira la lista de espera antes de darle el lugar a alguien (trabaDeLugar).
      findFirst: jest.fn().mockResolvedValue((opts.bloqueos ?? []).length ? { id: 'blq-1' } : null),
    },
    reservaEspera: { findFirst: jest.fn().mockResolvedValue(null) },
    customer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'c-1' }) },
    $transaction: jest.fn(async (fn: ((tx: unknown) => unknown) | Promise<unknown>[]) => (Array.isArray(fn) ? Promise.all(fn) : fn(prisma))),
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

  it('una estadía se cobra noche por noche: temporada, recargo de fin de semana y limpieza, y la seña sale de ese total', async () => {
    const cabana = cancha({
      id: 'r-cab', tipo: 'ALOJAMIENTO', duracionMinutos: null, maximoSeguidos: 1, precio: 60_000,
      datos: { tarifa: { temporadas: [{ id: 'alta', nombre: 'Temporada alta', desde: '2026-11-20', hasta: '2026-11-30', precioNoche: 95_000 }], finDeSemanaPct: 20, limpieza: 25_000 } },
    });
    const { svc } = armar({ recurso: cabana });
    // 13/11 viernes (+20 %), 14/11 sábado (+20 %), 15/11 domingo (base): 72.000 + 72.000 + 60.000 + 25.000 de limpieza
    const p = await svc.resolverPedido(BIZ, { modulo: 'ALQUILERES', recursoId: 'r-cab', fecha: '2026-11-13', fechaHasta: '2026-11-16' }, 'publico', AHORA);
    expect(p.precio).toBe(229_000);
    expect(p.sena).toBe(114_500);
    // Adentro de la temporada manda su precio: lunes 23 y martes 24 a 95.000, más la limpieza
    const alta = await svc.resolverPedido(BIZ, { modulo: 'ALQUILERES', recursoId: 'r-cab', fecha: '2026-11-23', fechaHasta: '2026-11-25' }, 'publico', AHORA);
    expect(alta.precio).toBe(215_000);
    // El precio que pone el negocio a mano desde el panel sigue mandando
    const manual = await svc.resolverPedido(BIZ, { modulo: 'ALQUILERES', recursoId: 'r-cab', fecha: '2026-11-13', fechaHasta: '2026-11-16' }, 'panel', AHORA, { precioManual: 150_000 });
    expect(manual.precio).toBe(150_000);
  });

  it('noches bloqueadas de un alojamiento (por el dueño o por Airbnb): se dice en noches, no en horarios', async () => {
    const cabana = cancha({ id: 'r-cab', tipo: 'ALOJAMIENTO', duracionMinutos: null, maximoSeguidos: 1, precio: 60_000 });
    const { svc } = armar({ recurso: cabana, bloqueos: [{ inicio: instante('2026-11-14', 840), fin: instante('2026-11-16', 600) }] });
    await expect(svc.resolverPedido(BIZ, { modulo: 'ALQUILERES', recursoId: 'r-cab', fecha: '2026-11-13', fechaHasta: '2026-11-15' }, 'publico', AHORA))
      .rejects.toThrow('Esas noches no están disponibles. Elegí otras fechas.');
  });

  it('lo que el dueño cerró a mano en Airbnb no le impide cargar una reserva en su panel; una reserva de Airbnb sí', async () => {
    const cabana = cancha({ id: 'r-cab', tipo: 'ALOJAMIENTO', duracionMinutos: null, maximoSeguidos: 1, precio: 60_000 });
    const pedidoCab = { modulo: 'ALQUILERES' as const, recursoId: 'r-cab', fecha: '2026-11-13', fechaHasta: '2026-11-15' };
    const cerrado = { inicio: instante('2026-11-12', 840), fin: instante('2026-11-16', 600), origen: 'ICAL', externoTipo: 'CERRADO' };
    // El dueño cerró esas noches en Airbnb para anotar una reserva que le pidieron por teléfono.
    await expect(armar({ recurso: cabana, bloqueos: [cerrado] }).svc.resolverPedido(BIZ, pedidoCab, 'panel', AHORA)).resolves.toMatchObject({ precio: 120_000 });
    // Desde el sitio, esas noches siguen sin poder reservarse.
    await expect(armar({ recurso: cabana, bloqueos: [cerrado] }).svc.resolverPedido(BIZ, pedidoCab, 'publico', AHORA)).rejects.toThrow('Esas noches no están disponibles. Elegí otras fechas.');
    // Una reserva hecha en Airbnb no se pisa ni desde el panel, y se dice por qué.
    const reservado = { ...cerrado, externoTipo: 'RESERVADO' };
    await expect(armar({ recurso: cabana, bloqueos: [reservado] }).svc.resolverPedido(BIZ, pedidoCab, 'panel', AHORA)).rejects.toThrow('Esas noches están reservadas en Airbnb.');
    // Un bloqueo que cargó el propio dueño sigue tapando también al panel: lo quita él.
    const propio = { inicio: cerrado.inicio, fin: cerrado.fin, origen: 'DUENO', externoTipo: null };
    await expect(armar({ recurso: cabana, bloqueos: [propio] }).svc.resolverPedido(BIZ, pedidoCab, 'panel', AHORA)).rejects.toThrow('Esas noches no están disponibles. Elegí otras fechas.');
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

  it('guarda el `datos` del pedido tal cual, sin interpretarlo; sin datos queda en null', async () => {
    const { svc, prisma } = armar();
    const create = jest.fn().mockResolvedValue(reserva({ id: 'nueva', estado: 'RETENIDA' }));
    (prisma.reserva as Record<string, jest.Mock>).create = create;
    await svc.crear(BIZ, pedido({ datos: { huespedes: 3, canal: 'sitio' } }), { estado: 'RETENIDA', origen: 'TIENDA', actor: 'CLIENTE', clave: 'k3' }, AHORA);
    expect(create.mock.calls[0][0].data.datos).toEqual({ huespedes: 3, canal: 'sitio' });
    await svc.crear(BIZ, pedido(), { estado: 'RETENIDA', origen: 'TIENDA', actor: 'CLIENTE', clave: 'k4' }, AHORA);
    // Prisma.DbNull: la columna queda en NULL de SQL, no en el null de JSON.
    expect(create.mock.calls[1][0].data.datos).not.toEqual(expect.objectContaining({ huespedes: expect.anything() }));
    expect(JSON.stringify(create.mock.calls[1][0].data.datos)).not.toContain('huespedes');
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

describe('ReservasService · lista de espera desde el panel', () => {
  // La clase de los lunes a las 10:30 y los martes a las 10:30, con dos lugares.
  const clase = () => cancha({ id: 'r-clase', modulo: 'GIMNASIO', tipo: 'CLASE', nombre: 'Funcional', cupo: 2, maximoSeguidos: 1, precio: 2500, datos: null, horario: { '1': [[630, 690]], '2': [[630, 690]] } });
  const espera = (over: Record<string, unknown> = {}) => ({
    id: 'esp-1', businessId: BIZ, modulo: 'GIMNASIO', recursoId: 'r-clase', inicio: instante('2026-11-10', 630), fin: instante('2026-11-10', 690),
    clienteId: null, clienteNombre: 'Lu Paz', clienteTelefono: '11 5555 0000', clienteEmail: null, tokenAcceso: 'e'.repeat(32),
    estado: 'ESPERANDO', reservaId: null, createdAt: AHORA, updatedAt: AHORA, ...over,
  });
  const conEspera = (fila: Record<string, unknown> | null, recurso = clase(), cfg = config({ modulo: 'GIMNASIO', senaPorcentaje: 0 })) => {
    const armado = armar({ recurso, config: cfg });
    const p = armado.prisma as Record<string, Record<string, jest.Mock> | jest.Mock>;
    p.reservaEspera = {
      findFirst: jest.fn().mockResolvedValue(fila),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'esp-nueva', estado: 'ESPERANDO', reservaId: null, createdAt: AHORA, ...data })),
    };
    (p.reserva as Record<string, jest.Mock>).create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'res-nueva', ...data }));
    (p.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'r-clase', cupo: 2, activo: true, nombre: 'Funcional' }]);
    return { ...armado, espera: p.reservaEspera as Record<string, jest.Mock>, reservas: p.reserva as Record<string, jest.Mock> };
  };

  it('Turnos: se anota con su servicio y, al darle el lugar, la reserva sale con el precio y la seña de ese servicio', async () => {
    const { svc, espera: tabla, reservas, prisma } = conEspera(null);
    const delDia = jest.spyOn((svc as unknown as { disponibilidad: { delDia: (...a: unknown[]) => unknown } }).disponibilidad, 'delDia')
      .mockResolvedValue({ fecha: '2026-11-10', franjas: [{ inicioMinutos: 630, finMinutos: 690, libres: 0, cupo: 1 }] } as never);
    const pedido = { modulo: 'TURNOS' as const, recursoId: 'r-clase', fecha: '2026-11-10', inicioMinutos: 630, servicioId: 'srv-corte', cliente: { nombre: 'Lu Paz', telefono: '11 5555 0000' } };
    await svc.anotarseEnEspera(BIZ, pedido, undefined, AHORA, { modo: 'panel', memberId: 'm-1' });
    expect(delDia).toHaveBeenCalledWith(BIZ, expect.objectContaining({ servicioId: 'srv-corte' }), 'panel', AHORA);
    expect(tabla.create.mock.calls[0][0].data).toMatchObject({ servicioId: 'srv-corte' });

    // Darle el lugar: la reserva toma el servicio guardado en la espera.
    tabla.findFirst.mockResolvedValue(espera({ modulo: 'TURNOS', servicioId: 'srv-corte' }));
    (prisma as unknown as { reservaServicio: Record<string, jest.Mock> }).reservaServicio = {
      findFirst: jest.fn().mockResolvedValue({ id: 'srv-corte', nombre: 'Corte', duracionMinutos: 60, precio: 12000 }),
    };
    reservas.findMany.mockResolvedValue([]);
    await svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA);
    expect(reservas.create.mock.calls.at(-1)![0].data).toMatchObject({ servicioId: 'srv-corte', precio: 12000, servicio: { nombre: 'Corte', precio: 12000 } });
  });

  it('el negocio anota en la espera una clase de hoy que el sitio ya no ofrece por la anticipación', async () => {
    const { svc, espera: tabla, reservas, audit, prisma } = conEspera(null);
    // Lunes 10:00; la clase de las 10:30 está llena (dos lugares tomados). Con 60 minutos de anticipación, el sitio ya no la muestra.
    reservas.findMany.mockResolvedValue([{ inicio: instante('2026-11-09', 630), fin: instante('2026-11-09', 690), cantidad: 2 }]);
    const pedidoEspera = { modulo: 'GIMNASIO' as const, recursoId: 'r-clase', fecha: '2026-11-09', inicioMinutos: 630, cliente: { nombre: 'Lu Paz', telefono: '11 5555 0000' } };
    await expect(svc.anotarseEnEspera(BIZ, pedidoEspera, undefined, AHORA)).rejects.toThrow(/no existe o ya pasó/);
    const { espera: anotada, yaEstaba } = await svc.anotarseEnEspera(BIZ, pedidoEspera, undefined, AHORA, { modo: 'panel', memberId: 'm-1' });
    expect(yaEstaba).toBe(false);
    expect(anotada).toMatchObject({ id: 'esp-nueva', clienteNombre: 'Lu Paz', estado: 'ESPERANDO' });
    expect(tabla.create.mock.calls[0][0].data).toMatchObject({ recursoId: 'r-clase', inicio: instante('2026-11-09', 630), fin: instante('2026-11-09', 690) });
    // El alta va con el recurso tomado: la búsqueda de "ya estaba" se repite adentro, antes de crear.
    const candado = (prisma.$queryRaw as jest.Mock).mock.invocationCallOrder.at(-1)!;
    expect(candado).toBeLessThan(tabla.create.mock.invocationCallOrder[0]);
    expect(tabla.findFirst).toHaveBeenCalledTimes(2);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'reserva_espera', action: 'CREATE', memberId: 'm-1' }));
  });

  it('con lugar, la persona pasa a una reserva confirmada del panel y la espera queda tomada', async () => {
    const { svc, espera: tabla, reservas, prisma, avisos, audit } = conEspera(espera());
    // vencerRetenidasDe no encuentra nada; después hay un lugar tomado de dos.
    reservas.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ cantidad: 1 }]);
    const r = await svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA);
    expect(r.id).toBe('res-nueva');
    // Primero se reclama la fila de la espera (compare-and-set) y recién después se crea la reserva.
    expect(tabla.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'esp-1', estado: 'ESPERANDO' }, data: { estado: 'TOMADA' } });
    expect(tabla.updateMany.mock.invocationCallOrder[0]).toBeLessThan(reservas.create.mock.invocationCallOrder[0]);
    expect(reservas.create.mock.calls[0][0].data).toMatchObject({ estado: 'CONFIRMADA', origen: 'PANEL', cantidad: 1, clienteNombre: 'Lu Paz', creadaPorMemberId: 'm-1', precio: 2500, sena: 0 });
    expect(tabla.updateMany.mock.calls[1][0]).toMatchObject({ where: { id: 'esp-1' }, data: { reservaId: 'res-nueva' } });
    expect((prisma.reservaHistorial as Record<string, jest.Mock>).create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ a: 'CONFIRMADA', quien: 'NEGOCIO', memberId: 'm-1' }) }));
    expect(avisos.lugarTomado).toHaveBeenCalledWith(expect.objectContaining({ id: 'res-nueva' }), 'Funcional');
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'reserva', action: 'CREATE' }));
  });

  it('sin lugar: 409 y la persona sigue esperando (no se reclama ni se crea nada)', async () => {
    const { svc, espera: tabla, reservas } = conEspera(espera());
    reservas.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ cantidad: 2 }]);
    await expect(svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA)).rejects.toThrow(ConflictException);
    expect(tabla.updateMany).not.toHaveBeenCalled();
    expect(reservas.create).not.toHaveBeenCalled();
  });

  it('si salió de la lista en el medio (el compare-and-set no la encuentra), no se crea ninguna reserva', async () => {
    const { svc, espera: tabla, reservas } = conEspera(espera());
    reservas.findMany.mockResolvedValue([]);
    tabla.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA)).rejects.toThrow(/salió de la lista/);
    expect(reservas.create).not.toHaveBeenCalled();
  });

  it('repetirlo devuelve la reserva que ya tomó; fuera de la lista es 409 y una clase que ya empezó, 400', async () => {
    const tomada = conEspera(espera({ estado: 'TOMADA', reservaId: 'res-1' }));
    await expect(tomada.svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA)).resolves.toMatchObject({ id: 'res-1' });
    expect(tomada.reservas.create).not.toHaveBeenCalled();
    const fuera = conEspera(espera({ estado: 'CANCELADA' }));
    await expect(fuera.svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA)).rejects.toThrow(ConflictException);
    const empezada = conEspera(espera({ inicio: instante('2026-11-09', 570), fin: instante('2026-11-09', 630) }));
    await expect(empezada.svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA)).rejects.toThrow(BadRequestException);
    const nadie = conEspera(null);
    await expect(nadie.svc.darLugarDesdeEspera(BIZ, 'esp-x', 'm-1', AHORA)).rejects.toThrow(/no está en la lista/);
  });

  it('para anotar hace falta un teléfono o un email; quien ya esperaba recibe la misma fila y no se repite el alta', async () => {
    const lleno = [{ inicio: instante('2026-11-10', 630), fin: instante('2026-11-10', 690), cantidad: 2 }];
    const pedidoEspera = (cliente: { nombre: string; telefono?: string }) => ({ modulo: 'GIMNASIO' as const, recursoId: 'r-clase', fecha: '2026-11-10', inicioMinutos: 630, cliente });
    const sinContacto = conEspera(null);
    await expect(sinContacto.svc.anotarseEnEspera(BIZ, pedidoEspera({ nombre: 'Lu Paz' }), undefined, AHORA, { modo: 'panel', memberId: 'm-1' })).rejects.toThrow(/teléfono o un email/);
    expect(sinContacto.espera.create).not.toHaveBeenCalled();

    const yaEsperaba = conEspera(espera());
    yaEsperaba.reservas.findMany.mockResolvedValue(lleno);
    const r = await yaEsperaba.svc.anotarseEnEspera(BIZ, pedidoEspera({ nombre: 'Lu', telefono: '11 5555 0000' }), undefined, AHORA, { modo: 'panel', memberId: 'm-1' });
    expect(r).toMatchObject({ yaEstaba: true, espera: { id: 'esp-1' } });
    expect(yaEsperaba.espera.create).not.toHaveBeenCalled();
    expect(yaEsperaba.audit.registrar).not.toHaveBeenCalled();
    // Se la busca por el teléfono que llegó, en ese negocio, ese recurso y ese horario.
    expect(yaEsperaba.espera.findFirst.mock.calls[0][0].where).toMatchObject({
      businessId: BIZ, recursoId: 'r-clase', inicio: instante('2026-11-10', 630), estado: 'ESPERANDO', OR: [{ clienteTelefono: '11 5555 0000' }],
    });
  });

  it('dos pedidos a la vez de la misma persona: el segundo la encuentra con el recurso tomado y no crea otra fila', async () => {
    const { svc, espera: tabla, reservas, audit } = conEspera(null);
    reservas.findMany.mockResolvedValue([{ inicio: instante('2026-11-10', 630), fin: instante('2026-11-10', 690), cantidad: 2 }]);
    // Afuera del candado todavía no estaba; adentro, el otro pedido ya la anotó.
    tabla.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(espera());
    const r = await svc.anotarseEnEspera(BIZ, { modulo: 'GIMNASIO', recursoId: 'r-clase', fecha: '2026-11-10', inicioMinutos: 630, cliente: { nombre: 'Lu Paz', telefono: '11 5555 0000' } }, undefined, AHORA, { modo: 'panel', memberId: 'm-1' });
    expect(r).toMatchObject({ yaEstaba: true, espera: { id: 'esp-1' } });
    expect(tabla.create).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('darle el lugar pide lo mismo que una reserva nueva: ni en un horario bloqueado ni con la clase pausada', async () => {
    const bloqueada = conEspera(espera());
    bloqueada.reservas.findMany.mockResolvedValue([]);
    const bloqueos = bloqueada.prisma.reservaBloqueo as Record<string, jest.Mock>;
    bloqueos.findFirst.mockResolvedValue({ id: 'blq-1' });
    await expect(bloqueada.svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA)).rejects.toThrow(/bloqueado por el negocio/);
    expect(bloqueada.espera.updateMany).not.toHaveBeenCalled();
    expect(bloqueada.reservas.create).not.toHaveBeenCalled();
    // El bloqueo se busca en el negocio, el módulo y el horario de la espera (del recurso o de todo el negocio).
    expect(bloqueos.findFirst.mock.calls[0][0].where).toMatchObject({
      businessId: BIZ, modulo: 'GIMNASIO', OR: [{ recursoId: null }, { recursoId: 'r-clase' }],
      inicio: { lt: instante('2026-11-10', 690) }, fin: { gt: instante('2026-11-10', 630) },
    });

    const pausada = conEspera(espera());
    pausada.reservas.findMany.mockResolvedValue([]);
    (pausada.prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'r-clase', cupo: 2, activo: false, nombre: 'Funcional' }]);
    await expect(pausada.svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA)).rejects.toThrow(/Funcional no está disponible/);
    expect(pausada.espera.updateMany).not.toHaveBeenCalled();
    expect(pausada.reservas.create).not.toHaveBeenCalled();
  });

  it('cuenta contra el cupo de la fila tomada con el candado, no contra el que se leyó antes', async () => {
    // El catálogo todavía dice cupo 2; con el candado puesto la fila ya dice 3 (le acaban de subir el cupo).
    const { svc, reservas, prisma } = conEspera(espera());
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'r-clase', cupo: 3, activo: true, nombre: 'Funcional' }]);
    reservas.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ cantidad: 2 }]);
    await expect(svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA)).resolves.toMatchObject({ id: 'res-nueva' });
    expect(reservas.create.mock.calls[0][0].data).toMatchObject({ exclusivo: false });
  });

  it('donde hay margen entre reservas, darle el lugar también lo cuenta', async () => {
    // Un salón con 30 minutos de margen: la espera es de 10:30 a 11:30 y la cuenta mira de 10:00 a 12:00.
    const salon = cancha({ id: 'r-clase', tipo: 'SALON', nombre: 'Salón', margenMinutos: 30, maximoSeguidos: 1 });
    const { svc, reservas, espera: tabla, prisma } = conEspera(espera({ modulo: 'ALQUILERES' }), salon, config({ senaPorcentaje: 0 }));
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'r-clase', cupo: 1, activo: true, nombre: 'Salón' }]);
    // vencerRetenidasDe no encuentra nada; la cuenta encuentra la reserva de al lado, la que termina justo cuando empieza esta.
    reservas.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ cantidad: 1 }]);
    await expect(svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA)).rejects.toThrow(/No queda lugar/);
    const cuenta = reservas.findMany.mock.calls[1][0].where;
    expect(cuenta.inicio).toEqual({ lt: instante('2026-11-10', 720) });
    expect(cuenta.fin).toEqual({ gt: instante('2026-11-10', 600) });
    expect(tabla.updateMany).not.toHaveBeenCalled();
  });

  it('si la reserva que había tomado se canceló después, repetir "darle el lugar" avisa en vez de darla por anotada', async () => {
    const armado = conEspera(espera({ estado: 'TOMADA', reservaId: 'res-1' }));
    armado.filas.set('res-1', reserva({ estado: 'CANCELADA' }));
    await expect(armado.svc.darLugarDesdeEspera(BIZ, 'esp-1', 'm-1', AHORA)).rejects.toThrow(/ya tuvo su lugar/);
    expect(armado.reservas.create).not.toHaveBeenCalled();
  });

  it('salir de la lista: repetirlo no falla ni deja registro; quien ya tomó su lugar no "sale" (409)', async () => {
    const esperando = conEspera(espera());
    await expect(esperando.svc.salirDeEspera(BIZ, { id: 'esp-1' }, 'm-1')).resolves.toEqual({ ok: true });
    expect(esperando.espera.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'esp-1', businessId: BIZ, estado: 'ESPERANDO' }, data: { estado: 'CANCELADA' } });
    expect(esperando.audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'reserva_espera', action: 'DELETE' }));

    const yaSalio = conEspera(espera({ estado: 'CANCELADA' }));
    yaSalio.espera.updateMany.mockResolvedValue({ count: 0 });
    await expect(yaSalio.svc.salirDeEspera(BIZ, { id: 'esp-1' }, 'm-1')).resolves.toEqual({ ok: true });
    expect(yaSalio.audit.registrar).not.toHaveBeenCalled();

    const conLugar = conEspera(espera({ estado: 'TOMADA', reservaId: 'res-1' }));
    conLugar.espera.updateMany.mockResolvedValue({ count: 0 });
    await expect(conLugar.svc.salirDeEspera(BIZ, { id: 'esp-1' }, 'm-1')).rejects.toThrow(/ya tiene su lugar/);
    await expect(conLugar.svc.salirDeEspera(BIZ, { token: 'e'.repeat(32) })).rejects.toThrow(/Ya tenés tu lugar/);
    expect(conLugar.audit.registrar).not.toHaveBeenCalled();

    const nadie = conEspera(null);
    nadie.espera.updateMany.mockResolvedValue({ count: 0 });
    await expect(nadie.svc.salirDeEspera(BIZ, { id: 'esp-x' }, 'm-1')).rejects.toThrow(/ninguna lista de espera/);
  });

  it('la lista sin día trae a quienes esperan de hoy en adelante; con un día, los de ese día; con uno que no existe, 400', async () => {
    const { svc, espera: tabla } = conEspera(null);
    tabla.findMany = jest.fn().mockResolvedValue([]);
    await svc.listarEspera(BIZ, 'GIMNASIO', undefined, undefined, AHORA);
    expect(tabla.findMany.mock.calls[0][0].where).toEqual({ businessId: BIZ, modulo: 'GIMNASIO', estado: 'ESPERANDO', inicio: { gte: instante('2026-11-09', 0) } });
    await svc.listarEspera(BIZ, 'GIMNASIO', 'r-clase', '2026-11-03', AHORA);
    expect(tabla.findMany.mock.calls[1][0].where).toEqual({
      businessId: BIZ, modulo: 'GIMNASIO', estado: 'ESPERANDO', recursoId: 'r-clase', inicio: { gte: instante('2026-11-03', 0), lt: instante('2026-11-03', 1440) },
    });
    await expect(svc.listarEspera(BIZ, 'GIMNASIO', undefined, '2026-13-45', AHORA)).rejects.toThrow(/no existe/);
  });
});

describe('ReservasService · al cancelar, el primero de la espera toma el lugar', () => {
  const clase = () => cancha({ id: 'r-clase', modulo: 'GIMNASIO', tipo: 'CLASE', nombre: 'Funcional', cupo: 2, maximoSeguidos: 1, precio: 2500, datos: null, horario: { '1': [[570, 630], [630, 690]], '2': [[630, 690]] } });
  // Anotada en la clase del martes 10/11 a las 10:30 (mañana, visto desde AHORA).
  const anotada = (over: Record<string, unknown> = {}) => reserva({
    modulo: 'GIMNASIO', recursoId: 'r-clase', inicio: instante('2026-11-10', 630), fin: instante('2026-11-10', 690), fecha: '2026-11-10', exclusivo: false, ...over,
  });
  const esperando = (id: string, inicio = instante('2026-11-10', 630), fin = instante('2026-11-10', 690)) => ({
    id, businessId: BIZ, modulo: 'GIMNASIO', recursoId: 'r-clase', inicio, fin, clienteId: null, clienteNombre: 'Persona ' + id, clienteTelefono: '11 5555 0000',
    clienteEmail: null, tokenAcceso: 'e'.repeat(32), estado: 'ESPERANDO', reservaId: null, createdAt: AHORA, updatedAt: AHORA,
  });
  function conLista(lista: Record<string, unknown>[], r = anotada()) {
    const armado = armar({ reservas: [r], recurso: clase(), config: config({ modulo: 'GIMNASIO', senaPorcentaje: 0, cancelacionHastaHoras: 0 }) });
    const p = armado.prisma as Record<string, Record<string, jest.Mock> | jest.Mock>;
    const cola = [...lista];
    p.reservaEspera = { findFirst: jest.fn(async () => cola[0] ?? null), updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
    (p.reserva as Record<string, jest.Mock>).create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'res-promovida', ...data }));
    (p.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'r-clase', cupo: 2, activo: true, nombre: 'Funcional' }]);
    return { ...armado, cola, espera: p.reservaEspera as Record<string, jest.Mock>, reservas: p.reserva as Record<string, jest.Mock>, bloqueos: p.reservaBloqueo as Record<string, jest.Mock> };
  }
  const cancelar = (svc: ReservasService) => svc.cancelar(BIZ, { id: 'res-1' }, { actor: 'NEGOCIO', memberId: 'm-1' }, AHORA);

  it('pasa el primero: reserva confirmada con sus datos, la espera queda tomada y se le avisa', async () => {
    const { svc, espera: tabla, reservas, avisos } = conLista([esperando('e1'), esperando('e2')]);
    const r = await cancelar(svc);
    expect(r.promovida).toMatchObject({ id: 'res-promovida', estado: 'CONFIRMADA', origen: 'TIENDA', clienteNombre: 'Persona e1', cantidad: 1 });
    expect(tabla.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'e1', businessId: BIZ, estado: 'ESPERANDO' }, data: { estado: 'TOMADA' } });
    expect(tabla.updateMany.mock.invocationCallOrder[0]).toBeLessThan(reservas.create.mock.invocationCallOrder[0]);
    expect(avisos.lugarTomado).toHaveBeenCalledWith(expect.objectContaining({ id: 'res-promovida' }), 'Funcional');
  });

  it('si el primero salió de la lista en ese momento, pasa el siguiente', async () => {
    const { svc, espera: tabla, reservas, cola } = conLista([esperando('e1'), esperando('e2')]);
    // El compare-and-set de e1 no encuentra la fila (salió de la lista): la próxima búsqueda ya no la trae.
    tabla.updateMany.mockImplementationOnce(async () => { cola.shift(); return { count: 0 }; });
    const r = await cancelar(svc);
    expect(r.promovida).toMatchObject({ clienteNombre: 'Persona e2' });
    expect(reservas.create).toHaveBeenCalledTimes(1);
    expect(tabla.updateMany.mock.calls[1][0]).toMatchObject({ where: { id: 'e2', estado: 'ESPERANDO' }, data: { estado: 'TOMADA' } });
  });

  it('en una clase que ya empezó no pasa nadie: la reserva se cancela y la lista queda como estaba', async () => {
    // Lunes 10:00: la clase de las 09:30 está en curso. El negocio saca a quien no vino.
    const enCurso = anotada({ inicio: instante('2026-11-09', 570), fin: instante('2026-11-09', 630), fecha: '2026-11-09' });
    const { svc, espera: tabla, reservas, avisos } = conLista([esperando('e1', instante('2026-11-09', 570), instante('2026-11-09', 630))], enCurso);
    const r = await cancelar(svc);
    expect(r.reserva).toBeDefined();
    expect(r.promovida).toBeNull();
    expect(tabla.findFirst).not.toHaveBeenCalled();
    expect(reservas.create).not.toHaveBeenCalled();
    expect(avisos.lugarTomado).not.toHaveBeenCalled();
  });

  it('en un día que el negocio bloqueó, o con la clase pausada, tampoco pasa nadie', async () => {
    const bloqueado = conLista([esperando('e1')]);
    bloqueado.bloqueos.findFirst.mockResolvedValue({ id: 'blq-1' });
    expect((await cancelar(bloqueado.svc)).promovida).toBeNull();
    expect(bloqueado.reservas.create).not.toHaveBeenCalled();
    expect(bloqueado.avisos.lugarTomado).not.toHaveBeenCalled();

    const pausada = conLista([esperando('e1')]);
    (pausada.prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'r-clase', cupo: 2, activo: false, nombre: 'Funcional' }]);
    expect((await cancelar(pausada.svc)).promovida).toBeNull();
    expect(pausada.reservas.create).not.toHaveBeenCalled();
  });
});

describe('ReservasService · la agenda', () => {
  it('se pagina con un orden total: el id desempata las reservas que empiezan a la misma hora', async () => {
    const { svc, prisma } = armar();
    await svc.listar(BIZ, { modulo: 'ALQUILERES', desde: '2026-11-01', hasta: '2026-11-30', page: 2, limit: 500 }, AHORA);
    expect((prisma.reserva as Record<string, jest.Mock>).findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ inicio: 'asc' }, { id: 'asc' }], skip: 500, take: 500 }));
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
