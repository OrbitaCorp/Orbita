import { BadRequestException } from '@nestjs/common';
import { DisponibilidadService } from '../../src/reservas/disponibilidad.service';
import { instante } from '../../src/reservas/dominio/tiempo';

// Las sesiones de todas las clases en un solo pedido (DisponibilidadService.
// sesionesEntre): lo que usa el sitio de Gimnasio para dibujar su grilla. Sin
// base: se prueba qué arma con lo que lee y que lo lee una sola vez. Contra
// Postgres está en test/gimnasio.e2e-spec.ts.

const BIZ = 'biz-1';
const LUNES = '2026-11-09';
const AHORA = instante(LUNES, 10 * 60); // lunes 9/11 a las 10:00 de Argentina

const config = (over: Record<string, unknown> = {}) => ({
  id: 'cfg', businessId: BIZ, modulo: 'GIMNASIO', activo: true, anticipacionMinimaMinutos: 30, anticipacionMaximaDias: 7, margenMinutos: 0,
  horario: Object.fromEntries(['1', '2', '3', '4', '5', '6'].map((d) => [d, [[420, 1320]]])), ...over,
});

const clase = (id: string, over: Record<string, unknown> = {}) => ({
  id, businessId: BIZ, modulo: 'GIMNASIO', tipo: 'CLASE', nombre: id, cupo: 12, duracionMinutos: 60, margenMinutos: null,
  horario: { '1': [[1140, 1200]] }, activo: true, eliminadoEn: null, ...over,
});

// WOD: lunes a las 10:00 y a las 19:00, doce lugares. Halterofilia: miércoles a las 18:00, tres lugares.
const WOD = clase('wod', { horario: { '1': [[600, 660], [1140, 1200]] } });
const HALTERO = clase('haltero', { cupo: 3, horario: { '3': [[1080, 1140]] } });

const ocupa = (recursoId: string, fecha: string, inicio: number, cantidad = 1) => ({ recursoId, inicio: instante(fecha, inicio), fin: instante(fecha, inicio + 60), cantidad });
const bloqueo = (recursoId: string | null, desde: [string, number], hasta: [string, number], motivo: string | null = null) => ({ recursoId, inicio: instante(...desde), fin: instante(...hasta), motivo });

function armar(o: { clases?: unknown[]; bloqueos?: unknown[]; reservas?: unknown[]; config?: Record<string, unknown> } = {}) {
  const prisma = {
    reservaBloqueo: { findMany: jest.fn().mockResolvedValue(o.bloqueos ?? []) },
    reserva: { findMany: jest.fn().mockResolvedValue(o.reservas ?? []) },
  };
  const catalogo = {
    configOFalla: jest.fn().mockResolvedValue(o.config ?? config()),
    recursos: jest.fn().mockResolvedValue(o.clases ?? [WOD, HALTERO]),
  };
  return { svc: new DisponibilidadService(prisma as never, catalogo as never), prisma, catalogo };
}

const semana = { modulo: 'GIMNASIO' as const, desde: LUNES, hasta: '2026-11-15' };
const delDia = (r: Awaited<ReturnType<DisponibilidadService['sesionesEntre']>>, fecha: string) => r.dias.find((d) => d.fecha === fecha)!;

describe('DisponibilidadService · sesionesEntre (la grilla de un sitio de clases)', () => {
  it('arma la semana: cada sesión en su día, con su cupo y los lugares que quedan', async () => {
    const { svc } = armar({
      reservas: [ocupa('wod', LUNES, 1140), ocupa('haltero', '2026-11-11', 1080, 2), ocupa('haltero', '2026-11-11', 1080)],
    });
    const r = await svc.sesionesEntre(BIZ, semana, 'panel', AHORA);
    expect(r).toMatchObject({ desde: LUNES, hasta: '2026-11-15' });
    expect(r.dias.map((d) => d.fecha)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    // El lunes, las dos sesiones del WOD: la reserva de las 19 no le saca lugar a la de las 10.
    expect(delDia(r, LUNES).sesiones).toEqual([
      { recursoId: 'wod', inicioMinutos: 600, finMinutos: 660, libres: 12, cupo: 12 },
      { recursoId: 'wod', inicioMinutos: 1140, finMinutos: 1200, libres: 11, cupo: 12 },
    ]);
    // El miércoles Halterofilia quedó completa: dos lugares de una reserva y uno de otra.
    expect(delDia(r, '2026-11-11').sesiones).toEqual([{ recursoId: 'haltero', inicioMinutos: 1080, finMinutos: 1140, libres: 0, cupo: 3 }]);
    expect(delDia(r, '2026-11-10')).toEqual({ fecha: '2026-11-10', cerrado: false, motivo: null, sesiones: [] });
  });

  it('en el sitio no sale lo que ya no se puede reservar: lo que pasó, lo que empieza antes de la anticipación y lo que cae más lejos', async () => {
    // Lunes 18:45, con 30 minutos de anticipación mínima y 7 días de máxima.
    const tarde = instante(LUNES, 18 * 60 + 45);
    const rango = { modulo: 'GIMNASIO' as const, desde: LUNES, hasta: '2026-11-23' };
    const sitio = await armar().svc.sesionesEntre(BIZ, rango, 'publico', tarde);
    expect(delDia(sitio, LUNES).sesiones).toEqual([]); // la de las 10 ya pasó y la de las 19 empieza en 15 minutos
    expect(delDia(sitio, '2026-11-16').sesiones.map((s) => s.inicioMinutos)).toEqual([600, 1140]); // justo a 7 días
    expect(delDia(sitio, '2026-11-23').sesiones).toEqual([]); // a 14 días: fuera de la anticipación
    // El panel ve lo que queda de hoy y todo lo que viene.
    const panel = await armar().svc.sesionesEntre(BIZ, rango, 'panel', tarde);
    expect(delDia(panel, LUNES).sesiones.map((s) => s.inicioMinutos)).toEqual([1140]);
    expect(delDia(panel, '2026-11-23').sesiones.map((s) => s.inicioMinutos)).toEqual([600, 1140]);
  });

  it('un día sin clases sale cerrado con su motivo; un bloqueo de una sola clase o de unas horas solo tapa esas sesiones', async () => {
    const { svc } = armar({
      clases: [WOD, clase('yoga', { horario: { '1': [[1140, 1200]], '3': [[1080, 1140]] } }), HALTERO],
      bloqueos: [
        bloqueo(null, ['2026-11-11', 0], ['2026-11-12', 0], '  Feriado  '),
        bloqueo('wod', ['2026-11-16', 1080], ['2026-11-16', 1260]), // el WOD de las 19 del lunes 16
        bloqueo(null, ['2026-11-16', 540], ['2026-11-16', 630]), // de 9 a 10:30 para todos
      ],
    });
    const r = await svc.sesionesEntre(BIZ, { modulo: 'GIMNASIO', desde: LUNES, hasta: '2026-11-16' }, 'panel', AHORA);
    expect(delDia(r, '2026-11-11')).toEqual({ fecha: '2026-11-11', cerrado: true, motivo: 'Feriado', sesiones: [] });
    // El lunes 16: al WOD le taparon las dos sesiones (una por su bloqueo, otra por el de todos); Yoga sigue.
    expect(delDia(r, '2026-11-16')).toEqual({ fecha: '2026-11-16', cerrado: false, motivo: null, sesiones: [{ recursoId: 'yoga', inicioMinutos: 1140, finMinutos: 1200, libres: 12, cupo: 12 }] });
    // El lunes 9 no tiene bloqueos: salen todas, por hora y, a la misma hora, por clase.
    expect(delDia(r, LUNES).sesiones.map((s) => `${s.recursoId}@${s.inicioMinutos}`)).toEqual(['wod@600', 'wod@1140', 'yoga@1140']);
  });

  it('un día cerrado sin motivo cargado sale cerrado, con el motivo en null', async () => {
    const { svc } = armar({ bloqueos: [bloqueo(null, [LUNES, 0], ['2026-11-11', 0], '')] });
    const r = await svc.sesionesEntre(BIZ, semana, 'panel', AHORA);
    expect(delDia(r, LUNES)).toMatchObject({ cerrado: true, motivo: null, sesiones: [] });
    expect(delDia(r, '2026-11-10')).toMatchObject({ cerrado: true, motivo: null });
    expect(delDia(r, '2026-11-11')).toMatchObject({ cerrado: false, sesiones: [{ recursoId: 'haltero', libres: 3 }] });
  });

  it('lee cada cosa una vez, solo las clases y solo las reservas que ocupan lugar', async () => {
    const cancha = clase('cancha', { tipo: 'CANCHA', cupo: 1 });
    const { svc, prisma, catalogo } = armar({ clases: [WOD, cancha, HALTERO] });
    const r = await svc.sesionesEntre(BIZ, semana, 'publico', AHORA);
    expect(r.dias.flatMap((d) => d.sesiones).some((s) => s.recursoId === 'cancha')).toBe(false);
    expect(catalogo.configOFalla).toHaveBeenCalledTimes(1);
    expect(catalogo.recursos).toHaveBeenCalledTimes(1);
    expect(catalogo.recursos).toHaveBeenCalledWith(BIZ, 'GIMNASIO');
    expect(prisma.reservaBloqueo.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.reserva.findMany).toHaveBeenCalledTimes(1);
    const where = prisma.reserva.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ businessId: BIZ, recursoId: { in: ['wod', 'haltero'] } });
    // Una retenida que ya venció no ocupa lugar: se pide con su vencimiento.
    expect(where.OR).toEqual([{ estado: { in: ['PENDIENTE', 'CONFIRMADA'] } }, { estado: 'RETENIDA', retenidaHasta: { gte: AHORA } }]);
    expect(where.inicio).toEqual({ lt: instante('2026-11-15', 1440) });
    expect(where.fin).toEqual({ gt: instante(LUNES, 0) });
  });

  it('sin clases no pide reservas y devuelve los días vacíos', async () => {
    const { svc, prisma } = armar({ clases: [] });
    const r = await svc.sesionesEntre(BIZ, semana, 'publico', AHORA);
    expect(r.dias).toHaveLength(7);
    expect(r.dias.every((d) => d.sesiones.length === 0 && !d.cerrado)).toBe(true);
    expect(prisma.reserva.findMany).not.toHaveBeenCalled();
  });

  it('el rango tiene que ser de fechas que existan, en orden y de hasta 35 días', async () => {
    const { svc, catalogo } = armar();
    const pedir = (desde: string, hasta: string) => svc.sesionesEntre(BIZ, { modulo: 'GIMNASIO', desde, hasta }, 'publico', AHORA);
    await expect(pedir('2026-02-30', '2026-03-02')).rejects.toBeInstanceOf(BadRequestException);
    await expect(pedir('2026-11-15', LUNES)).rejects.toThrow('El fin del rango es anterior al inicio.');
    await expect(pedir(LUNES, '2026-12-14')).rejects.toThrow('Pedí hasta 35 días por vez.');
    expect(catalogo.configOFalla).not.toHaveBeenCalled();
    await expect(pedir(LUNES, '2026-12-13')).resolves.toMatchObject({ desde: LUNES, hasta: '2026-12-13' });
    await expect(pedir(LUNES, LUNES)).resolves.toMatchObject({ dias: [{ fecha: LUNES }] });
  });
});
