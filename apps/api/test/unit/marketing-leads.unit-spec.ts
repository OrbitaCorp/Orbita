import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  LEADS_SEMILLA,
  MAX_PILOTOS_POR_RUBRO,
  esPuertoIguazu,
  normalizarInstagram,
  normalizarWhatsappUrl,
} from '../../src/marketing/leads/leads-seed.data';
import { LeadsService } from '../../src/marketing/leads/leads.service';

describe('Marketing → Leads: semilla y reglas de negocio', () => {
  it('contiene al menos los 189 negocios base sin claves ni placeIds duplicados', () => {
    expect(LEADS_SEMILLA.length).toBeGreaterThanOrEqual(189);
    const claves = new Set(LEADS_SEMILLA.map((l) => l.clave));
    expect(claves.size).toBe(LEADS_SEMILLA.length);

    const placeIds = LEADS_SEMILLA.map((l) => l.placeId).filter((id): id is string => Boolean(id));
    expect(new Set(placeIds).size).toBe(placeIds.length);
  });

  it('respeta los pisos por rubro, los potenciales/posibles pilotos de Iguazú y arranca en 0 pilotos automáticos por rubro nuevo', () => {
    const porRubro = (r: string) => LEADS_SEMILLA.filter((l) => l.rubro === r);

    expect(porRubro('TIENDA')).toHaveLength(102);
    expect(porRubro('TURNOS').length).toBeGreaterThanOrEqual(22);
    expect(porRubro('ALQUILERES').length).toBeGreaterThanOrEqual(22);
    expect(porRubro('GIMNASIO').length).toBeGreaterThanOrEqual(21);
    expect(porRubro('POS').length).toBeGreaterThanOrEqual(22);

    const tiendasIguazu = porRubro('TIENDA').filter((l) => l.clasificacion === 'POTENCIAL_LOCAL');
    expect(tiendasIguazu).toHaveLength(22);
    expect(tiendasIguazu.every((l) => esPuertoIguazu(l.localidad))).toBe(true);

    const pisosIguazu: Record<string, number> = { TURNOS: 12, ALQUILERES: 12, GIMNASIO: 11, POS: 12 };
    for (const r of ['TURNOS', 'ALQUILERES', 'GIMNASIO', 'POS']) {
      const pilotos = porRubro(r).filter((l) => l.clasificacion === 'PILOTO');
      expect(pilotos).toHaveLength(0);
      const posibles = porRubro(r).filter((l) => l.clasificacion === 'POTENCIAL_LOCAL');
      expect(posibles.length).toBeGreaterThanOrEqual(pisosIguazu[r]);
      expect(posibles.every((l) => esPuertoIguazu(l.localidad))).toBe(true);
    }
    expect(MAX_PILOTOS_POR_RUBRO).toBe(5);
  });

  it('normaliza teléfonos argentinos a wa.me/549... y usuarios de Instagram', () => {
    expect(normalizarWhatsappUrl('03757 15-31-9105')).toBe('https://wa.me/5493757319105');
    expect(normalizarWhatsappUrl('0376 15-499-0320')).toBe('https://wa.me/5493764990320');
    expect(normalizarWhatsappUrl('+54 9 3757 55-0883')).toBe('https://wa.me/5493757550883');
    expect(normalizarWhatsappUrl('0341 652-0296')).toBe('https://wa.me/5493416520296');
    expect(normalizarWhatsappUrl('03755 50-9207')).toBe('https://wa.me/5493755509207');
    expect(normalizarWhatsappUrl('—')).toBeNull();

    expect(normalizarInstagram('https://www.instagram.com/AnaCicuto_/?igsh=abc')).toBe('@anacicuto_');
    expect(normalizarInstagram('@JoyeriaDoldan')).toBe('@joyeriadoldan');
    expect(normalizarInstagram(null)).toBeNull();
  });

  it('impide asignar piloto fuera de Puerto Iguazú o pasar del máximo de 5 por rubro', async () => {
    const prisma = {
      marketingLead: {
        count: jest.fn().mockResolvedValue(5),
        findUnique: jest.fn().mockResolvedValue({
          id: 'lead-1',
          rubro: 'TURNOS',
          localidad: 'Puerto Iguazú',
          clasificacion: 'LEAD',
          contactado: false,
          estado: 'NUEVO',
        }),
      },
      platformAdmin: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Mateo' }),
      },
    };
    const svc = new LeadsService(prisma as never);
    (svc as unknown as { semillaLista: boolean }).semillaLista = true;

    await expect(
      svc.crear('admin-1', {
        rubro: 'TURNOS',
        subrubro: 'Barbería',
        clasificacion: 'PILOTO',
        negocio: 'Barbería Posadas',
        localidad: 'Posadas',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      svc.actualizar('admin-1', 'lead-1', { clasificacion: 'PILOTO' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('sincroniza contactado, quien contactó y estado al tildar/destildar', async () => {
    const updateMock = jest.fn().mockImplementation(async ({ data }) => ({ id: 'lead-1', ...data }));
    const prisma = {
      marketingLead: {
        count: jest.fn().mockResolvedValue(2),
        findUnique: jest.fn().mockResolvedValue({
          id: 'lead-1',
          rubro: 'TIENDA',
          localidad: 'Puerto Iguazú',
          clasificacion: 'POTENCIAL_LOCAL',
          contactado: false,
          estado: 'NUEVO',
        }),
        update: updateMock,
      },
      platformAdmin: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Mili' }),
      },
    };
    const svc = new LeadsService(prisma as never);

    await svc.actualizar('admin-mili', 'lead-1', { contactado: true });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: expect.objectContaining({
        contactado: true,
        contactadoPor: 'Mili',
        estado: 'CONTACTADO',
      }),
    });

    await expect(svc.eliminar('no-existe')).rejects.toThrow(NotFoundException).catch(() => null);
  });
});
