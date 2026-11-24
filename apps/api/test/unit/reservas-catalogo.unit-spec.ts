import { BadRequestException } from '@nestjs/common';
import { ReservasCatalogoService } from '../../src/reservas/reservas-catalogo.service';
import { ReservasMantenimientoService } from '../../src/reservas/reservas-mantenimiento.service';
import { instante } from '../../src/reservas/dominio/tiempo';

// Lo que el catálogo cuida de lo reservado al editar o borrar una clase, sin
// base. Antes lo cuidaba solo el panel de Gimnasio, con los datos que tenía en
// pantalla; acá va con el recurso tomado. La carrera de verdad (alguien
// reserva mientras se edita) está en test/reservas.e2e-spec.ts.

const BIZ = 'biz-1';
const AHORA = instante('2026-11-09', 10 * 60); // lunes 9/11 a las 10:00 de Argentina

const config = () => ({ id: 'cfg', businessId: BIZ, modulo: 'GIMNASIO', horario: { '1': [[420, 1320]], '3': [[420, 1320]] }, margenMinutos: 0 });

// Una clase los lunes y los miércoles a las 19:00, con cupo 12.
const clase = (over: Record<string, unknown> = {}) => ({
  id: 'r-clase', businessId: BIZ, modulo: 'GIMNASIO', tipo: 'CLASE', nombre: 'WOD', descripcion: null, cupo: 12, duracionMinutos: 60, pasoMinutos: null,
  margenMinutos: null, maximoSeguidos: 1, precio: 0, horario: { '1': [[1140, 1200]], '3': [[1140, 1200]] }, datos: null, memberId: null, orden: 0,
  activo: true, eliminadoEn: null, ...over,
});

const reservada = (fecha: string, inicio: number, cantidad: number) => ({ inicio: instante(fecha, inicio), fin: instante(fecha, inicio + 60), cantidad });

function armar(opts: { recurso?: Record<string, unknown>; porDelante?: ReturnType<typeof reservada>[] } = {}) {
  const fila = opts.recurso ?? clase();
  const prisma: Record<string, unknown> = {
    reservaRecurso: {
      findFirst: jest.fn().mockResolvedValue(fila),
      findFirstOrThrow: jest.fn().mockResolvedValue(fila),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    reservaConfig: { findUnique: jest.fn().mockResolvedValue(config()), findFirst: jest.fn().mockResolvedValue(config()) },
    reserva: { findMany: jest.fn().mockResolvedValue(opts.porDelante ?? []), count: jest.fn().mockResolvedValue((opts.porDelante ?? []).length) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'r-clase', cupo: fila.cupo, activo: true, nombre: fila.nombre }]),
  };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const svc = new ReservasCatalogoService(prisma as never, audit as never);
  const tabla = prisma.reservaRecurso as Record<string, jest.Mock>;
  return { svc, prisma, audit, tabla, reservas: prisma.reserva as Record<string, jest.Mock> };
}

const cambio = (over: Record<string, unknown> = {}) => ({ modulo: 'GIMNASIO' as const, tipo: 'CLASE' as const, nombre: 'WOD', ...over });

describe('ReservasCatalogoService · editar una clase con lugares tomados por delante', () => {
  it('toma el candado del recurso antes de contar y de guardar', async () => {
    const { svc, prisma, tabla, reservas } = armar({ porDelante: [reservada('2026-11-11', 1140, 3)] });
    await svc.editarRecurso(BIZ, 'm-1', 'r-clase', cambio({ cupo: 10 }), AHORA);
    const candado = (prisma.$queryRaw as jest.Mock).mock.invocationCallOrder[0];
    expect(candado).toBeLessThan(reservas.findMany.mock.invocationCallOrder[0]);
    expect(candado).toBeLessThan(tabla.updateMany.mock.invocationCallOrder[0]);
    // Cuenta lo que ocupa lugar de acá en adelante, en este negocio y este recurso.
    expect(reservas.findMany.mock.calls[0][0].where).toMatchObject({ businessId: BIZ, recursoId: 'r-clase', fin: { gt: AHORA } });
    expect(tabla.updateMany).toHaveBeenCalledWith({ where: { id: 'r-clase', businessId: BIZ }, data: expect.objectContaining({ cupo: 10 }) });
  });

  it('el cupo no baja de lo que ya está tomado en alguna fecha; hasta ahí, sí', async () => {
    // El miércoles 11 hay 5 lugares tomados (una reserva de 2 y otra de 3); el lunes 16, 1.
    const porDelante = [reservada('2026-11-11', 1140, 2), reservada('2026-11-11', 1140, 3), reservada('2026-11-16', 1140, 1)];
    const corto = armar({ porDelante });
    await expect(corto.svc.editarRecurso(BIZ, 'm-1', 'r-clase', cambio({ cupo: 4 }), AHORA)).rejects.toThrow(/El cupo no puede bajar a 4: la clase del miércoles,? 11 de noviembre de 19:00 a 20:00 ya tiene 5 lugares tomados/);
    expect(corto.tabla.updateMany).not.toHaveBeenCalled();
    expect(corto.audit.registrar).not.toHaveBeenCalled();

    const justo = armar({ porDelante });
    await expect(justo.svc.editarRecurso(BIZ, 'm-1', 'r-clase', cambio({ cupo: 5 }), AHORA)).resolves.toBeDefined();
    expect(justo.tabla.updateMany).toHaveBeenCalled();
  });

  it('subir el cupo, o cambiar otra cosa, no mira las reservas', async () => {
    const { svc, reservas, tabla } = armar({ porDelante: [reservada('2026-11-11', 1140, 12)] });
    await svc.editarRecurso(BIZ, 'm-1', 'r-clase', cambio({ cupo: 15, datos: { gimnasio: { sala: 'Box' } } }), AHORA);
    expect(reservas.findMany).not.toHaveBeenCalled();
    expect(tabla.updateMany).toHaveBeenCalled();
  });

  it('no se saca ni se mueve una sesión que tiene reservas; una sin reservas, sí', async () => {
    // Hay reservas el miércoles 11; el lunes no tiene ninguna.
    const porDelante = [reservada('2026-11-11', 1140, 2), reservada('2026-11-18', 1140, 1)];
    const sacaMiercoles = armar({ porDelante });
    await expect(sacaMiercoles.svc.editarRecurso(BIZ, 'm-1', 'r-clase', cambio({ horario: { '1': [[1140, 1200]] } }), AHORA))
      .rejects.toThrow(/tiene 2 reservas por delante en un horario que estás sacando o moviendo \(la primera, el miércoles,? 11 de noviembre de 19:00 a 20:00\)/);
    expect(sacaMiercoles.tabla.updateMany).not.toHaveBeenCalled();

    const mueveMiercoles = armar({ porDelante });
    await expect(mueveMiercoles.svc.editarRecurso(BIZ, 'm-1', 'r-clase', cambio({ horario: { '1': [[1140, 1200]], '3': [[1200, 1260]] } }), AHORA)).rejects.toThrow(BadRequestException);

    const sacaLunes = armar({ porDelante });
    await expect(sacaLunes.svc.editarRecurso(BIZ, 'm-1', 'r-clase', cambio({ horario: { '3': [[1140, 1200]] } }), AHORA)).resolves.toBeDefined();
    expect(sacaLunes.tabla.updateMany).toHaveBeenCalled();
  });

  it('una reserva que el negocio cargó fuera de las sesiones no frena el cambio de horario', async () => {
    // El martes 10 a las 08:00 no hay sesión: es una reserva cargada "fuera de horario" desde el panel.
    const { svc, tabla } = armar({ porDelante: [reservada('2026-11-10', 480, 1)] });
    await expect(svc.editarRecurso(BIZ, 'm-1', 'r-clase', cambio({ horario: { '1': [[1140, 1200]] } }), AHORA)).resolves.toBeDefined();
    expect(tabla.updateMany).toHaveBeenCalled();
  });

  it('un recurso que no es una clase se edita como siempre', async () => {
    const cancha = clase({ modulo: 'ALQUILERES', tipo: 'CANCHA', nombre: 'Cancha 1', cupo: 1, horario: null });
    const { svc, reservas, tabla } = armar({ recurso: cancha, porDelante: [reservada('2026-11-11', 1140, 1)] });
    await svc.editarRecurso(BIZ, 'm-1', 'r-clase', { modulo: 'ALQUILERES', tipo: 'CANCHA', nombre: 'Cancha 1', horario: { '1': [[540, 1080]] } }, AHORA);
    expect(reservas.findMany).not.toHaveBeenCalled();
    expect(tabla.updateMany).toHaveBeenCalled();
  });
});

describe('ReservasCatalogoService · borrar un recurso', () => {
  it('con reservas por delante no se borra, y la cuenta va con el recurso tomado', async () => {
    const { svc, prisma, reservas, tabla, audit } = armar({ porDelante: [reservada('2026-11-11', 1140, 1), reservada('2026-11-16', 1140, 1)] });
    await expect(svc.borrarRecurso(BIZ, 'm-1', 'r-clase', AHORA)).rejects.toThrow(/Tiene 2 reservas por delante/);
    expect((prisma.$queryRaw as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(reservas.count.mock.invocationCallOrder[0]);
    expect(tabla.updateMany).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('sin reservas por delante queda borrado (blando) y registrado', async () => {
    const { svc, tabla, audit } = armar();
    await expect(svc.borrarRecurso(BIZ, 'm-1', 'r-clase', AHORA)).resolves.toEqual({ ok: true });
    expect(tabla.updateMany).toHaveBeenCalledWith({ where: { id: 'r-clase', businessId: BIZ }, data: { eliminadoEn: AHORA, activo: false } });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'reserva_recurso', action: 'DELETE' }));
  });
});

describe('ReservasMantenimientoService · esperas de horarios que ya empezaron', () => {
  it('las saca de la lista sin tocar a quien justo tomó su lugar', async () => {
    const prisma = {
      reservaEspera: {
        findMany: jest.fn().mockResolvedValue([{ id: 'e1', businessId: BIZ }, { id: 'e2', businessId: 'biz-2' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const svc = new ReservasMantenimientoService(prisma as never);
    await expect(svc.cerrarEsperasPasadas(AHORA)).resolves.toEqual({ cerradas: 2 });
    expect(prisma.reservaEspera.findMany.mock.calls[0][0].where).toEqual({ estado: 'ESPERANDO', inicio: { lte: AHORA } });
    // El update repite el estado y la hora: una fila que cambió entre la lectura y acá no se toca.
    expect(prisma.reservaEspera.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['e1', 'e2'] }, estado: 'ESPERANDO', inicio: { lte: AHORA } }, data: { estado: 'CANCELADA' } });
  });

  it('sin nada para cerrar no escribe', async () => {
    const prisma = { reservaEspera: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() } };
    const svc = new ReservasMantenimientoService(prisma as never);
    await expect(svc.cerrarEsperasPasadas(AHORA)).resolves.toEqual({ cerradas: 0 });
    expect(prisma.reservaEspera.updateMany).not.toHaveBeenCalled();
  });
});
