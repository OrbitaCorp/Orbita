import { cuitValido, formatearCuit, limpiarCuit } from '../../src/common/utils/cuit';
import { BusinessesService } from '../../src/businesses/businesses.service';

// Hallazgo `legales-sin-cuit` (auditoría interna): el CUIT del Comercio se
// carga en Configuración → Contacto, se valida con dígito verificador y se
// guarda solo con los 11 dígitos; los legales de la tienda lo muestran con
// guiones. Vacío = borrar.

describe('CUIT: validación con dígito verificador', () => {
  it('acepta CUIT válidos y rechaza el verificador cambiado', () => {
    expect(cuitValido('20123456786')).toBe(true);
    expect(cuitValido('30712345671')).toBe(true);
    expect(cuitValido('20123456785')).toBe(false);
    expect(cuitValido('30712345670')).toBe(false);
  });

  it('rechaza lo que no son 11 dígitos', () => {
    expect(cuitValido('2012345678')).toBe(false);
    expect(cuitValido('201234567861')).toBe(false);
    expect(cuitValido('2012345678a')).toBe(false);
    expect(cuitValido('')).toBe(false);
  });

  it('limpia guiones y espacios, y formatea para mostrar', () => {
    expect(limpiarCuit('20-12345678-6')).toBe('20123456786');
    expect(limpiarCuit(' 20 12345678 6 ')).toBe('20123456786');
    expect(formatearCuit('20123456786')).toBe('20-12345678-6');
  });
});

describe('Configuración del negocio: CUIT y razón social', () => {
  function servicio() {
    const prisma = {
      businessConfig: {
        findUnique: jest.fn().mockResolvedValue({ returnsEnabled: false, cancellationsEnabled: false }),
        update: jest.fn(async ({ data }: { data: unknown }) => data),
      },
    };
    const svc = new BusinessesService(prisma as any, {} as any, {} as any);
    return { svc, prisma };
  }

  it('guarda el CUIT sin guiones y la razón social sin espacios de sobra', async () => {
    const { svc, prisma } = servicio();
    await svc.updateConfig('biz-1', { cuit: '20-12345678-6', legalName: '  Zapatos Lorena S.R.L. ' } as any);
    expect(prisma.businessConfig.update).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
      data: { cuit: '20123456786', legalName: 'Zapatos Lorena S.R.L.' },
    });
  });

  it('un CUIT con el verificador mal es 400 y no se guarda', async () => {
    const { svc, prisma } = servicio();
    await expect(svc.updateConfig('biz-1', { cuit: '20-12345678-5' } as any)).rejects.toThrow(/CUIT/);
    expect(prisma.businessConfig.update).not.toHaveBeenCalled();
  });

  it('vacío borra los dos', async () => {
    const { svc, prisma } = servicio();
    await svc.updateConfig('biz-1', { cuit: '', legalName: '   ' } as any);
    expect(prisma.businessConfig.update).toHaveBeenCalledWith({ where: { businessId: 'biz-1' }, data: { cuit: null, legalName: null } });
  });

  it('si no vienen, no se tocan', async () => {
    const { svc, prisma } = servicio();
    await svc.updateConfig('biz-1', { scheduleText: 'Lun a Vie' } as any);
    expect(prisma.businessConfig.update).toHaveBeenCalledWith({ where: { businessId: 'biz-1' }, data: { scheduleText: 'Lun a Vie' } });
  });
});
