import { GoogleApiError } from '../../src/search-console/google-search.client';
import { SearchConsoleService, periodoParaGoogle } from '../../src/search-console/search-console.service';

// Lo que ve el dueño en Inicio → Métricas avanzadas → "Cómo te encuentran en Google".
// Solo de SU tienda, sin detalles técnicos de la conexión con Google, y sin gastar la cuota
// diaria cada vez que abre el desplegable.

const AHORA = new Date('2026-10-07T12:00:00Z');
const TOTALES = [{ clicks: 12, impressions: 340, ctr: 0.035, position: 8.2 }];

function armar(opts: { habilitado?: boolean } = {}) {
  const google = {
    habilitado: jest.fn().mockReturnValue(opts.habilitado ?? true),
    rendimiento: jest.fn().mockResolvedValue([]),
    inspeccionar: jest.fn().mockResolvedValue({ veredicto: 'PASS', estado: 'Submitted and indexed', ultimoRastreo: null, canonicalGoogle: null, robots: null }),
  };
  const prisma = { business: { findUnique: jest.fn() } };
  return { svc: new SearchConsoleService(prisma as any, google as any), google, prisma };
}

const tienda = (over: object = {}) => ({ subdomain: 'venustyle', hiddenFromSearch: false, customDomains: [], ...over });

describe('periodoParaGoogle', () => {
  it('sin fechas, los últimos 28 días terminando 2 días atrás (Google todavía no publicó lo más reciente)', () => {
    expect(periodoParaGoogle(undefined, undefined, AHORA)).toMatchObject({ desde: '2026-09-08', hasta: '2026-10-05' });
  });
  it('respeta el período del panel', () => {
    expect(periodoParaGoogle('2026-09-01', '2026-09-30', AHORA)).toMatchObject({ desde: '2026-09-01', hasta: '2026-09-30' });
  });
  it('no pide fechas que Google todavía no tiene', () => {
    expect(periodoParaGoogle('2026-10-01', '2026-10-07', AHORA).hasta).toBe('2026-10-05');
  });
  it('el período anterior es de igual largo y va pegado atrás', () => {
    expect(periodoParaGoogle('2026-09-01', '2026-09-30', AHORA)).toMatchObject({ anteriorDesde: '2026-08-02', anteriorHasta: '2026-08-31' });
  });
  it('una fecha inválida o al revés vuelve a 28 días, y nunca pasa de 90', () => {
    expect(periodoParaGoogle('basura', '2026-09-30', AHORA)).toMatchObject({ desde: '2026-09-03', hasta: '2026-09-30' });
    expect(periodoParaGoogle('2026-09-30', '2026-09-01', AHORA)).toMatchObject({ desde: '2026-08-05', hasta: '2026-09-01' });
    expect(periodoParaGoogle('2025-01-01', '2026-09-30', AHORA).desde).toBe('2026-07-03');
  });
});

describe('resumenParaDueno', () => {
  it('apagado: no disponible, y no consulta nada', async () => {
    const { svc, google, prisma } = armar({ habilitado: false });
    await expect(svc.resumenParaDueno('b-1', undefined, undefined, AHORA)).resolves.toEqual({ disponible: false, motivo: 'no_disponible' });
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
    expect(google.rendimiento).not.toHaveBeenCalled();
  });

  it('una tienda oculta por moderación no ve nada: no tiene por qué enterarse por acá', async () => {
    const { svc, google, prisma } = armar();
    prisma.business.findUnique.mockResolvedValue(tienda({ hiddenFromSearch: true }));
    await expect(svc.resumenParaDueno('b-1', undefined, undefined, AHORA)).resolves.toEqual({ disponible: false, motivo: 'no_disponible' });
    expect(google.rendimiento).not.toHaveBeenCalled();
  });

  it('un dominio propio sin verificar todavía dice que se está conectando', async () => {
    const { svc, google, prisma } = armar();
    prisma.business.findUnique.mockResolvedValue(tienda({ customDomains: [{ domain: 'tefaltacalleok.com', gscStatus: 'PENDIENTE' }] }));
    await expect(svc.resumenParaDueno('b-1', undefined, undefined, AHORA)).resolves.toEqual({ disponible: false, motivo: 'conectando' });
    expect(google.rendimiento).not.toHaveBeenCalled();
  });

  it('siempre consulta la tienda del que pregunta', async () => {
    const { svc, prisma } = armar();
    prisma.business.findUnique.mockResolvedValue(tienda());
    await svc.resumenParaDueno('b-1', undefined, undefined, AHORA);
    expect(prisma.business.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'b-1' } }));
  });

  it('un subdominio se consulta en la propiedad de dominio, filtrado a SU dirección: no ve datos de otras tiendas', async () => {
    const { svc, google, prisma } = armar();
    prisma.business.findUnique.mockResolvedValue(tienda());
    google.rendimiento.mockResolvedValue(TOTALES);
    await svc.resumenParaDueno('b-1', undefined, undefined, AHORA);
    expect(google.rendimiento).toHaveBeenCalledTimes(4);
    for (const llamada of google.rendimiento.mock.calls) {
      expect(llamada[0]).toBe('sc-domain:orbita.site');
      expect(llamada[3].filtro).toEqual({ dimension: 'page', operator: 'contains', expression: 'https://venustyle.orbita.site/' });
    }
  });

  it('un dominio propio verificado se consulta en su propia propiedad, sin filtro', async () => {
    const { svc, google, prisma } = armar();
    prisma.business.findUnique.mockResolvedValue(tienda({ customDomains: [{ domain: 'tefaltacalleok.com', gscStatus: 'VERIFICADO' }] }));
    google.rendimiento.mockResolvedValue(TOTALES);
    await svc.resumenParaDueno('b-1', undefined, undefined, AHORA);
    expect(google.rendimiento.mock.calls[0][0]).toBe('https://tefaltacalleok.com/');
    expect(google.rendimiento.mock.calls[0][3].filtro).toBeUndefined();
    expect(google.inspeccionar).toHaveBeenCalledWith('https://tefaltacalleok.com/', 'https://tefaltacalleok.com/');
  });

  it('arma el resumen: totales, período anterior, búsquedas, páginas con ruta corta y si la portada está en Google', async () => {
    const { svc, google, prisma } = armar();
    prisma.business.findUnique.mockResolvedValue(tienda());
    google.rendimiento
      .mockResolvedValueOnce(TOTALES)
      .mockResolvedValueOnce([{ clicks: 10, impressions: 300, ctr: 0.03, position: 9 }])
      .mockResolvedValueOnce([{ keys: ['venus style'], clicks: 5, impressions: 90, ctr: 0.05, position: 3 }])
      .mockResolvedValueOnce([
        { keys: ['https://venustyle.orbita.site/'], clicks: 7, impressions: 120, ctr: 0.06, position: 4 },
        { keys: ['https://venustyle.orbita.site/catalogo'], clicks: 1, impressions: 20, ctr: 0.05, position: 7 },
      ]);
    expect(await svc.resumenParaDueno('b-1', undefined, undefined, AHORA)).toEqual({
      disponible: true,
      periodo: { desde: '2026-09-08', hasta: '2026-10-05' },
      rendimiento: { clics: 12, impresiones: 340, ctr: 0.035, posicion: 8.2 },
      anterior: { clics: 10, impresiones: 300, ctr: 0.03, posicion: 9 },
      consultas: [{ consulta: 'venus style', clics: 5, impresiones: 90, posicion: 3 }],
      paginas: [{ ruta: '/', clics: 7, impresiones: 120 }, { ruta: '/catalogo', clics: 1, impresiones: 20 }],
      portadaEnGoogle: true,
    });
  });

  it('si Google todavía no conoce la portada, no se sabe, y el resto se muestra igual', async () => {
    const { svc, google, prisma } = armar();
    prisma.business.findUnique.mockResolvedValue(tienda());
    google.rendimiento.mockResolvedValue([]);
    google.inspeccionar.mockRejectedValue(new GoogleApiError(400, 'URL is unknown to Google'));
    expect(await svc.resumenParaDueno('b-1', undefined, undefined, AHORA)).toMatchObject({ disponible: true, rendimiento: null, consultas: [], portadaEnGoogle: null });
  });

  it('una portada que Google no indexó se informa como que no está', async () => {
    const { svc, google, prisma } = armar();
    prisma.business.findUnique.mockResolvedValue(tienda());
    google.rendimiento.mockResolvedValue(TOTALES);
    google.inspeccionar.mockResolvedValue({ veredicto: 'NEUTRAL', estado: 'Discovered', ultimoRastreo: null, canonicalGoogle: null, robots: null });
    expect(await svc.resumenParaDueno('b-1', undefined, undefined, AHORA)).toMatchObject({ portadaEnGoogle: false });
  });

  it('si Google falla del todo (sin permiso), el dueño ve "no disponible" y no un error técnico', async () => {
    const { svc, google, prisma } = armar();
    prisma.business.findUnique.mockResolvedValue(tienda());
    google.rendimiento.mockRejectedValue(new GoogleApiError(403, 'forbidden'));
    await expect(svc.resumenParaDueno('b-1', undefined, undefined, AHORA)).resolves.toEqual({ disponible: false, motivo: 'no_disponible' });
  });

  it('guarda el resultado 10 minutos: abrir y cerrar el desplegable no gasta la cuota de Google', async () => {
    const { svc, google, prisma } = armar();
    prisma.business.findUnique.mockResolvedValue(tienda());
    google.rendimiento.mockResolvedValue(TOTALES);
    await svc.resumenParaDueno('b-1', undefined, undefined, AHORA);
    const llamadas = google.rendimiento.mock.calls.length;
    await svc.resumenParaDueno('b-1', undefined, undefined, new Date(AHORA.getTime() + 5 * 60_000));
    expect(google.rendimiento.mock.calls.length).toBe(llamadas);
    await svc.resumenParaDueno('b-1', undefined, undefined, new Date(AHORA.getTime() + 11 * 60_000));
    expect(google.rendimiento.mock.calls.length).toBeGreaterThan(llamadas);
  });
});
