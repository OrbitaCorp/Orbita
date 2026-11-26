// El alta de Turnos deja el negocio con su agenda: config (horario y seña),
// primera agenda y servicios, una sola vez (OnboardingService.sembrarTurnos).
import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from '../../src/onboarding/onboarding.service';
import type { AltaTurnosDto } from '../../src/onboarding/dto/alta-turnos.dto';

function armar(configExistente: unknown = null) {
  const tx = {
    reservaConfig: { findUnique: jest.fn().mockResolvedValue(configExistente), create: jest.fn().mockResolvedValue({}) },
    reservaRecurso: { create: jest.fn().mockResolvedValue({}) },
    reservaServicio: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const prisma = { $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
  const service = new OnboardingService(prisma as never, {} as never, {} as never);
  return { service, tx, prisma };
}

const alta = (extra: Partial<AltaTurnosDto> = {}): AltaTurnosDto => ({
  rubro: 'barberia',
  horario: { '1': [[540, 780], [900, 1200]], '6': [[540, 780]] },
  senaPorcentaje: 30,
  agenda: { tipo: 'PROFESIONAL', nombre: ' Martín Ríos ', rol: 'Barbero', color: '#3B82F6' },
  servicios: [{ nombre: 'Corte', duracionMinutos: 30, precio: 12000 }, { nombre: ' Barba ', duracionMinutos: 20, precio: 8000 }],
  ...extra,
});

describe('alta de Turnos', () => {
  it('crea la config con el horario y la seña, la agenda del dueño y los servicios en orden', async () => {
    const { service, tx } = armar();
    await expect(service.sembrarTurnos('b1', 'm1', alta())).resolves.toEqual({ creado: true });
    expect(tx.reservaConfig.create).toHaveBeenCalledWith({
      data: { businessId: 'b1', modulo: 'TURNOS', activo: true, horario: alta().horario, senaPorcentaje: 30 },
    });
    expect(tx.reservaRecurso.create).toHaveBeenCalledWith({
      data: {
        businessId: 'b1', modulo: 'TURNOS', tipo: 'PROFESIONAL', nombre: 'Martín Ríos', cupo: 1, orden: 0,
        datos: { rol: 'Barbero', color: '#3B82F6', rolId: 'dueno' }, memberId: 'm1',
      },
    });
    expect(tx.reservaServicio.createMany).toHaveBeenCalledWith({
      data: [
        { businessId: 'b1', modulo: 'TURNOS', nombre: 'Corte', duracionMinutos: 30, precio: 12000, orden: 0 },
        { businessId: 'b1', modulo: 'TURNOS', nombre: 'Barba', duracionMinutos: 20, precio: 8000, orden: 1 },
      ],
    });
  });

  it('en un rubro por sala la agenda es un espacio, sin dueño', async () => {
    const { service, tx } = armar();
    await service.sembrarTurnos('b1', 'm1', alta({ agenda: { tipo: 'ESPACIO', nombre: 'Cabina 1', rol: 'Espacio', color: '#3B82F6' } }));
    const data = tx.reservaRecurso.create.mock.calls[0][0].data;
    expect(data.tipo).toBe('ESPACIO');
    expect(data.memberId).toBeUndefined();
    expect(data.datos).toEqual({ rol: 'Espacio', color: '#3B82F6' });
  });

  it('si el negocio ya tiene config de Turnos no toca nada (reintento del pago)', async () => {
    const { service, tx } = armar({ id: 'c1' });
    await expect(service.sembrarTurnos('b1', 'm1', alta())).resolves.toEqual({ creado: false });
    expect(tx.reservaConfig.create).not.toHaveBeenCalled();
    expect(tx.reservaRecurso.create).not.toHaveBeenCalled();
    expect(tx.reservaServicio.createMany).not.toHaveBeenCalled();
  });

  it('rechaza un horario que el motor no entiende', async () => {
    const { service, prisma } = armar();
    await expect(service.sembrarTurnos('b1', 'm1', alta({ horario: { '7': [[540, 600]] } }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.sembrarTurnos('b1', 'm1', alta({ horario: { '1': [[600, 540]] } }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
