import { BadRequestException } from '@nestjs/common';
import {
  clasificarLeadAutomatico,
  claveConsultaBusqueda,
  detectarLocalidadReal,
  esCadenaOInstitucionExcluida,
  esDeMisionesArgentina,
  extraerWebEInstagram,
  generarPlanBusquedas,
} from '../../src/marketing/leads/leads-discovery.catalogo';
import { LeadsDiscoveryService } from '../../src/marketing/leads/leads-discovery.service';
import { LeadsService } from '../../src/marketing/leads/leads.service';

describe('Marketing → Leads Discovery (automático e incremental en Misiones)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('acepta negocios de Misiones y rechaza frontera extranjera u otras provincias', () => {
    expect(esDeMisionesArgentina('Av. Brasil 100, N3370 Puerto Iguazú, Misiones, Argentina', '+54 3757 42-1000', 'Puerto Iguazú')).toBe(true);
    expect(esDeMisionesArgentina('Av. San Martín 1071, N3334 Puerto Rico, Misiones, Argentina', '+54 3743 47-2900', 'Puerto Rico')).toBe(true);
    expect(esDeMisionesArgentina('Corrientes 392, Puerto Iguazú, Misiones', '011 5057-2110', 'Puerto Iguazú')).toBe(true);

    expect(esDeMisionesArgentina('Av. Brasil 500, Foz do Iguaçu - PR, Brasil', '+55 45 3523-0000', 'Puerto Iguazú')).toBe(false);
    expect(esDeMisionesArgentina('Av. San Blas, Ciudad del Este, Paraguay', '+595 61 500-000', 'Puerto Iguazú')).toBe(false);
    expect(esDeMisionesArgentina('Av. Japón, Encarnación, Paraguay', '+595 71 200-000', 'Posadas')).toBe(false);
    expect(esDeMisionesArgentina('Av. Corrientes 1200, Ituzaingó, Corrientes, Argentina', '+54 3786 42-0000', 'Posadas')).toBe(false);
  });

  it('detecta la localidad real desde la dirección de Google Maps y excluye cadenas o entes públicos', () => {
    expect(detectarLocalidadReal('Av. San Martín 1500, Oberá, Misiones', 'Posadas')).toBe('Oberá');
    expect(detectarLocalidadReal('Ruta 12 km 1550, Eldorado, Misiones', 'Montecarlo')).toBe('Eldorado');
    expect(detectarLocalidadReal('Paraje sin nombre, Misiones', 'San Vicente')).toBe('San Vicente');

    expect(esCadenaOInstitucionExcluida('YPF Full Posadas', 'Estación de servicio')).toBe(true);
    expect(esCadenaOInstitucionExcluida('Banco Macro Sucursal Oberá', 'Banco')).toBe(true);
    expect(esCadenaOInstitucionExcluida('Barbería Don Julio', 'Barbería')).toBe(false);
  });

  it('extrae Instagram o canal web y nunca asigna PILOTO automáticamente', () => {
    expect(extraerWebEInstagram('https://www.instagram.com/BarberClub_Misiones/?hl=es')).toEqual({
      instagram: '@barberclub_misiones',
      webActual: 'Solo Instagram',
    });
    expect(extraerWebEInstagram('https://www.instagram.com/reel/abc123/')).toEqual({
      instagram: null,
      webActual: 'instagram.com/reel/abc123',
    });

    expect(clasificarLeadAutomatico('TURNOS', 'Puerto Iguazú')).toBe('POTENCIAL_LOCAL');
    expect(clasificarLeadAutomatico('GIMNASIO', 'Posadas')).toBe('LEAD');
    expect(clasificarLeadAutomatico('POS', 'Puerto Iguazú')).toBe('POTENCIAL_LOCAL');
  });

  it('saltea consultas ya ejecutadas y deduplica por placeId, whatsappUrl, instagram y nombre+localidad', async () => {
    const planTurnosIguazu = generarPlanBusquedas('TURNOS', 'Puerto Iguazú');
    const yaHecha = planTurnosIguazu[0];
    const siguiente = planTurnosIguazu[1];

    const prisma = {
      marketingLeadBusqueda: {
        findMany: jest.fn().mockResolvedValue([{ claveConsulta: yaHecha.claveConsulta }]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      marketingLead: {
        findMany: jest.fn().mockResolvedValue([
          {
            clave: 'turnos::puerto-iguazu::ya-por-nombre',
            placeId: 'ChIJ_EXISTENTE',
            rubro: 'TURNOS',
            localidad: 'Puerto Iguazú',
            negocio: 'Ya por nombre',
            whatsappUrl: 'https://wa.me/5493757400001',
            instagram: '@ya_registrado',
          },
        ]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      platformAdmin: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Mateo' }),
      },
    };

    const leadsSvc = { asegurarSemilla: jest.fn().mockResolvedValue(undefined) } as unknown as LeadsService;
    const config = { get: jest.fn().mockReturnValue('fake-serper-key') };

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            title: 'Duplicado por PlaceId',
            address: 'Av. Victoria Aguirre 10, Puerto Iguazú, Misiones',
            phoneNumber: '03757 49-9999',
            placeId: 'ChIJ_EXISTENTE',
          },
          {
            title: 'Duplicado por WhatsApp',
            address: 'Av. Brasil 20, Puerto Iguazú, Misiones',
            phoneNumber: '03757 40-0001',
            placeId: 'ChIJ_OTRO',
          },
          {
            title: 'Duplicado por IG',
            address: 'Av. Misiones 30, Puerto Iguazú, Misiones',
            website: 'https://instagram.com/ya_registrado/',
            placeId: 'ChIJ_OTRO_2',
          },
          {
            title: 'Churrascaria Foz',
            address: 'Av. Brasil 40, Foz do Iguaçu, Brasil',
            phoneNumber: '+55 45 99999-0000',
            placeId: 'ChIJ_BRASIL',
          },
          {
            title: 'Nuevo Salón Cataratas',
            address: 'Av. República Argentina 450, N3370 Puerto Iguazú, Misiones, Argentina',
            phoneNumber: '03757 55-1234',
            website: 'https://instagram.com/saloncito_cataratas',
            rating: 4.9,
            ratingCount: 31,
            placeId: 'ChIJ_NUEVO_IGUAZU',
          },
        ],
      }),
    } as Response);

    const service = new LeadsDiscoveryService(prisma as never, leadsSvc, config as never);
    const res = await service.buscarMas('admin-1', {
      rubro: 'TURNOS',
      localidad: 'Puerto Iguazú',
      maxConsultas: 1,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.consultasEjecutadas).toBe(1);
    expect(res.consultasOmitidas).toBe(1);
    expect(res.nuevos).toBe(1);
    expect(res.duplicados).toBe(3);
    expect(res.detalle[0].claveConsulta).toBe(siguiente.claveConsulta);

    expect(prisma.marketingLead.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          rubro: 'TURNOS',
          localidad: 'Puerto Iguazú',
          clasificacion: 'POTENCIAL_LOCAL',
          placeId: 'ChIJ_NUEVO_IGUAZU',
          instagram: '@saloncito_cataratas',
          whatsappUrl: 'https://wa.me/5493757551234',
        }),
      ],
    });
    expect(prisma.marketingLeadBusqueda.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { claveConsulta: siguiente.claveConsulta },
      }),
    );
  });

  it('falla claro si no hay SERPER_API_KEY configurada', async () => {
    const prisma = {} as never;
    const leadsSvc = { asegurarSemilla: jest.fn() } as unknown as LeadsService;
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const prevPrimary = process.env.SERPER_API_KEY;
    const prevBackup = process.env.SERPER_API_KEY_RESPALDO;
    delete process.env.SERPER_API_KEY;
    delete process.env.SERPER_API_KEY_RESPALDO;

    try {
      const service = new LeadsDiscoveryService(prisma, leadsSvc, config as never);
      await expect(service.buscarMas('admin-1', {})).rejects.toThrow(BadRequestException);
    } finally {
      if (prevPrimary !== undefined) process.env.SERPER_API_KEY = prevPrimary;
      if (prevBackup !== undefined) process.env.SERPER_API_KEY_RESPALDO = prevBackup;
    }
  });

  it('claveConsultaBusqueda es determinista y sin tildes', () => {
    expect(claveConsultaBusqueda('TURNOS', 'Puerto Iguazú', 'barbería', 1)).toBe(
      'turnos::puerto-iguazu::barberia::p1',
    );
  });
});
