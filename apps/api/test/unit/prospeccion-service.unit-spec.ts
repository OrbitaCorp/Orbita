import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ProspeccionService } from '../../src/marketing/prospeccion/prospeccion.service';

// El servicio de Prospección con Meta y la base simulados: nada sale a internet ni toca datos reales.

const LOTE_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN = 'admin-1';

function respuestaMeta(usuario: string) {
  if (usuario === 'personal') return { error: { message: 'Invalid user id', code: 100 } };
  if (usuario === 'token_malo') return { error: { message: 'Error validating access token', code: 190 } };
  return {
    business_discovery: {
      username: usuario,
      biography: 'Zapatillas 📍 Puerto Iguazú',
      website: 'https://wa.me/5493757000000',
      followers_count: 2000,
      media_count: 100,
      media: {
        data: Array.from({ length: 8 }, (_, i) => ({
          caption: 'Nuevo ingreso, consultá talle y precio por mensaje',
          like_count: 40,
          comments_count: 3,
          timestamp: new Date(Date.now() - (i + 1) * 2 * 86_400_000).toISOString(),
        })),
      },
    },
  };
}

function armar(env: Record<string, string | undefined> = { META_PROSPECCION_TOKEN: 'token-de-prueba' }) {
  const prisma = {
    marketingProspecto: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'p-1', usuario: 'tienda_a', estado: 'NUEVO' }),
      update: jest.fn().mockImplementation(async (a) => ({ id: 'p-1', ...a.data })),
    },
    marketingProspeccionLote: {
      create: jest.fn().mockImplementation(async (a) => ({ id: LOTE_ID, createdAt: new Date('2026-10-14T00:00:00Z'), ...a.data })),
      findUnique: jest.fn().mockResolvedValue({ id: LOTE_ID, createdAt: new Date(), usuarios: ['tienda_a', 'tienda_b'], sinDatos: [], versionCriterio: '2026-10-13', creadoPor: ADMIN }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const svc = new ProspeccionService(prisma as never, { get: (k: string) => env[k] } as never);
  const fetchFn = jest.fn(async (url: string) => {
    const usuario = decodeURIComponent(String(url)).match(/username\(([^)]+)\)/)?.[1] ?? '';
    return { json: async () => respuestaMeta(usuario) };
  });
  svc.opciones = { fetchFn: fetchFn as never, pausaMs: 0 };
  return { svc, prisma, fetchFn };
}

describe('consultar cuentas', () => {
  it('sin token de Meta configurado responde que la prospección no está lista', async () => {
    const { svc } = armar({});
    await expect(svc.consultar(ADMIN, ['tienda_a'])).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rechaza una lista sin cuentas válidas y una con más del máximo', async () => {
    const { svc } = armar();
    await expect(svc.consultar(ADMIN, ['???', ''])).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.consultar(ADMIN, Array.from({ length: 21 }, (_, i) => `cuenta${i}`))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('guarda las cuentas con datos, anota las que no y crea el lote', async () => {
    const { svc, prisma, fetchFn } = armar();
    const r = await svc.consultar(ADMIN, ['@Tienda_A', 'https://instagram.com/personal/', 'tienda_a']); // repetida: se consulta una vez
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(r.conDatos).toBe(1);
    expect(r.sinDatos).toEqual([{ usuario: 'personal', motivo: 'cuenta personal, privada o inexistente' }]);
    expect(r.resumen[0]).toMatchObject({ usuario: 'tienda_a', nivel: expect.stringMatching(/[ABCD]/) });
    expect(prisma.marketingProspeccionLote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ creadoPor: ADMIN, usuarios: ['tienda_a'], versionCriterio: expect.any(String) }),
    });
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ adminId: ADMIN, action: 'prospeccion_consultar', targetType: 'prospeccion' }) });
  });

  it('volver a consultar una cuenta NO pisa su estado, responsable ni notas', async () => {
    const { svc, prisma } = armar();
    await svc.consultar(ADMIN, ['tienda_a']);
    const llamada = prisma.marketingProspecto.upsert.mock.calls[0][0];
    expect(Object.keys(llamada.update).sort()).toEqual(['datos', 'evaluacion', 'ultimaConsultaAt']);
  });

  it('manda el token en el encabezado y no en la dirección', async () => {
    const { svc, fetchFn } = armar();
    await svc.consultar(ADMIN, ['tienda_a']);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).not.toContain('token-de-prueba');
    expect(init.headers.Authorization).toBe('Bearer token-de-prueba');
  });

  it('si el token venció desde el principio, falla con un aviso claro', async () => {
    const { svc } = armar();
    await expect(svc.consultar(ADMIN, ['token_malo'])).rejects.toThrow(/token de Meta venció/);
  });

  it('si el token vence a mitad de camino, conserva lo que ya consultó y avisa', async () => {
    const { svc, prisma } = armar();
    const r = await svc.consultar(ADMIN, ['tienda_a', 'token_malo', 'tienda_b']);
    expect(r.conDatos).toBe(1);
    expect(r.aviso).toMatch(/Se guardaron las 1 cuentas/);
    expect(prisma.marketingProspecto.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('guardar el análisis de Claude', () => {
  const valido = { usuario: '@tienda_a', subrubro: 'Calzado', confianza: 'alta', vende_productos: true, canal_venta: 'WhatsApp', senales_dolor: ['pide talles por mensaje'], nivel_final: 'A', motivo: 'activa', angulo: 'catálogo', mensaje_sugerido: 'Hola, vi tu catálogo…' };

  it('guarda el análisis de una cuenta del lote y lo registra', async () => {
    const { svc, prisma } = armar();
    const r = await svc.guardarAnalisis(ADMIN, LOTE_ID, [valido]);
    expect(r).toEqual({ guardadas: 1 });
    expect(prisma.marketingProspecto.update).toHaveBeenCalledWith({
      where: { usuario: 'tienda_a' },
      data: expect.objectContaining({ analizadoPor: ADMIN, analisis: expect.objectContaining({ usuario: 'tienda_a', nivel_final: 'A', subrubro: 'Calzado' }) }),
    });
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'prospeccion_analisis' }) });
  });

  it.each([
    ['una cuenta que no está en el lote', { ...valido, usuario: 'otra' }, /no está en el lote/],
    ['un nivel inválido', { ...valido, nivel_final: 'Z' }, /nivel_final/],
    ['una confianza inválida', { ...valido, confianza: 'muy alta' }, /confianza/],
    ['un mensaje demasiado largo', { ...valido, mensaje_sugerido: 'x'.repeat(701) }, /demasiado largo/],
  ])('rechaza %s y no guarda nada', async (_titulo, item, error) => {
    const { svc, prisma } = armar();
    await expect(svc.guardarAnalisis(ADMIN, LOTE_ID, [valido, item])).rejects.toThrow(error);
    expect(prisma.marketingProspecto.update).not.toHaveBeenCalled();
  });

  it('rechaza un identificador de lote que no es un UUID y un lote que no existe', async () => {
    const { svc, prisma } = armar();
    await expect(svc.guardarAnalisis(ADMIN, '../../etc/passwd', [valido])).rejects.toBeInstanceOf(BadRequestException);
    prisma.marketingProspeccionLote.findUnique.mockResolvedValueOnce(null);
    await expect(svc.guardarAnalisis(ADMIN, LOTE_ID, [valido])).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('actualizar un prospecto', () => {
  it('cambia el estado y deja registro', async () => {
    const { svc, prisma } = armar();
    await svc.actualizarProspecto(ADMIN, 'p-1', { estado: 'CONTACTADO', notas: 'le escribí por IG' });
    expect(prisma.marketingProspecto.update).toHaveBeenCalledWith({ where: { id: 'p-1' }, data: { estado: 'CONTACTADO', notas: 'le escribí por IG' } });
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'prospeccion_actualizar' }) });
  });

  it('rechaza un estado inventado y un prospecto inexistente', async () => {
    const { svc, prisma } = armar();
    await expect(svc.actualizarProspecto(ADMIN, 'p-1', { estado: 'VENDIDO' })).rejects.toBeInstanceOf(BadRequestException);
    prisma.marketingProspecto.findUnique.mockResolvedValueOnce(null);
    await expect(svc.actualizarProspecto(ADMIN, 'nada', { estado: 'DEMO' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('lo que lee Claude', () => {
  it('trae el lote acotado, con las publicaciones recortadas y la guía de mensajes', async () => {
    const { svc, prisma } = armar();
    const largas = Array.from({ length: 12 }, () => ({ fecha: '2026-10-01', texto: 'x'.repeat(280), likes: 1, comentarios: 0 }));
    const prospecto = (usuario: string, nivel: string, puntaje: number) => ({
      usuario, estado: 'NUEVO', analisis: null, datos: { ultimasPublicaciones: largas }, evaluacion: { nivel, puntaje },
    });
    prisma.marketingProspecto.findMany.mockResolvedValue([prospecto('tienda_a', 'B', 60), prospecto('tienda_b', 'A', 80)]);
    const r = await svc.obtenerLoteParaClaude(LOTE_ID, { limite: 1 });
    expect(r.totalQueCumple).toBe(2);
    expect(r.devueltas).toBe(1);
    expect(r.prospectos[0].usuario).toBe('tienda_b'); // el de mayor puntaje primero
    expect(r.prospectos[0].datos.ultimasPublicaciones).toHaveLength(8);
    expect(r.prospectos[0].datos.ultimasPublicaciones[0].texto).toHaveLength(200);
    expect(r.guiaDeMensajes).toContain('nunca se envían mensajes');
    const soloA = await svc.obtenerLoteParaClaude(LOTE_ID, { niveles: ['A'] });
    expect(soloA.prospectos.map((p) => p.usuario)).toEqual(['tienda_b']);
  });
});
