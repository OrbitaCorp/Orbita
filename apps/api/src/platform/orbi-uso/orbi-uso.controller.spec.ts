import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { OrbiUsoPlataformaController } from './orbi-uso.controller';
import { AjusteCupoDto } from './dto/ajuste-cupo.dto';

function armar() {
  const uso = { resumen: jest.fn().mockResolvedValue('r'), negocio: jest.fn(), turnos: jest.fn().mockResolvedValue('t') };
  const cupo = { ajustar: jest.fn().mockResolvedValue({ id: 'aj1' }) };
  const adminLog = { orbiCupoAjuste: jest.fn().mockResolvedValue(undefined) };
  return { uso, cupo, adminLog, ctrl: new OrbiUsoPlataformaController(uso as never, cupo as never, adminLog as never) };
}

describe('OrbiUsoPlataformaController', () => {
  it('sin mes usa el mes en curso de Argentina', async () => {
    const { ctrl, uso } = armar();
    await ctrl.resumen();
    expect(uso.resumen).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-(0[1-9]|1[0-2])$/));
  });

  it('turnos sin negocio es 400', () => {
    const { ctrl } = armar();
    expect(() => ctrl.turnos('')).toThrow(BadRequestException);
  });

  it('ajustar suma el ajuste con el admin del token y lo deja registrado', async () => {
    const { ctrl, cupo, adminLog } = armar();
    const dto = { businessId: '3f1c2a52-7a0e-4b53-9e66-0d1b6f1f2a11', mes: '2026-10', creditos: 500, motivo: 'Cortesía por demora' };
    const r = await ctrl.ajustar({ user: { adminId: 'ad1' } as never }, dto);
    expect(cupo.ajustar).toHaveBeenCalledWith({ ...dto, adminId: 'ad1' });
    expect(adminLog.orbiCupoAjuste).toHaveBeenCalledWith({ adminId: 'ad1', businessId: dto.businessId, mes: '2026-10', creditos: 500, motivo: dto.motivo, ajusteId: 'aj1' });
    expect(r).toEqual({ ok: true, id: 'aj1' });
  });
});

describe('AjusteCupoDto', () => {
  const valido = { businessId: '3f1c2a52-7a0e-4b53-9e66-0d1b6f1f2a11', mes: '2026-10', creditos: -100, motivo: 'Motivo válido' };
  const errores = async (o: object) => (await validate(plainToInstance(AjusteCupoDto, o))).map((e) => e.property);

  it('acepta un ajuste válido (también negativo)', async () => {
    expect(await errores(valido)).toEqual([]);
  });

  it('rechaza id, mes, créditos y motivo mal formados', async () => {
    expect(await errores({ ...valido, businessId: 'x' })).toContain('businessId');
    expect(await errores({ ...valido, mes: '2026-13' })).toContain('mes');
    expect(await errores({ ...valido, creditos: 1.5 })).toContain('creditos');
    expect(await errores({ ...valido, motivo: 'abc' })).toContain('motivo');
  });
});
