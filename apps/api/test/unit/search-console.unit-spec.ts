import { NotFoundException } from '@nestjs/common';
import { GoogleApiError } from '../../src/search-console/google-search.client';
import { SearchConsoleService, explicarErrorDeGoogle } from '../../src/search-console/search-console.service';

// Search Console: verificar los dominios propios de las tiendas y enviarle a Google
// el sitemap de cada una. Todo es "mejor esfuerzo": un fallo de Google se anota y
// nunca rompe nada.

const AHORA = new Date('2026-10-07T12:00:00Z');
const TOKEN = 'abc123_TOKEN-de-google-0123456789';

type Dominio = {
  id: string; domain: string; status: string; dnsVerified: boolean;
  gscVerificationToken: string | null; gscStatus: 'PENDIENTE' | 'VERIFICADO'; gscError: string | null;
  gscTriedAt: Date | null; gscSitemapAt: Date | null;
};

const dominio = (over: Partial<Dominio> = {}): Dominio => ({
  id: 'd-1', domain: 'tefaltacalleok.com', status: 'ACTIVE', dnsVerified: true,
  gscVerificationToken: null, gscStatus: 'PENDIENTE', gscError: null, gscTriedAt: null, gscSitemapAt: null, ...over,
});

function armar(d: Dominio | null, opts: { habilitado?: boolean } = {}) {
  const google = {
    habilitado: jest.fn().mockReturnValue(opts.habilitado ?? true),
    pedirTokenMeta: jest.fn().mockResolvedValue(TOKEN),
    verificarPorMeta: jest.fn().mockResolvedValue(undefined),
    agregarSitio: jest.fn().mockResolvedValue(undefined),
    enviarSitemap: jest.fn().mockResolvedValue(undefined),
    rendimiento: jest.fn().mockResolvedValue([]),
    inspeccionar: jest.fn().mockResolvedValue({ veredicto: 'PASS', estado: 'Submitted and indexed', ultimoRastreo: null, canonicalGoogle: null, robots: null }),
  };
  const prisma = {
    customDomain: { findUnique: jest.fn().mockResolvedValue(d), update: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    business: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
  };
  return { svc: new SearchConsoleService(prisma as any, google as any), google, prisma };
}

describe('registrarDominio', () => {
  it('apagado (sin cuenta de servicio, como en local): no toca nada', async () => {
    const { svc, google, prisma } = armar(dominio(), { habilitado: false });
    await expect(svc.registrarDominio('d-1')).resolves.toEqual({ estado: 'no_configurado' });
    expect(prisma.customDomain.findUnique).not.toHaveBeenCalled();
    expect(google.pedirTokenMeta).not.toHaveBeenCalled();
  });

  it('un dominio que todavía no está activo no se registra: Google no podría abrirlo', async () => {
    const { svc, google } = armar(dominio({ status: 'VERIFYING' }));
    await expect(svc.registrarDominio('d-1')).resolves.toEqual({ estado: 'inactivo' });
    expect(google.pedirTokenMeta).not.toHaveBeenCalled();
  });

  it('un dominio que no existe devuelve inactivo', async () => {
    const { svc } = armar(null);
    await expect(svc.registrarDominio('nada')).resolves.toEqual({ estado: 'inactivo' });
  });

  it('la primera vez pide el token y lo guarda, pero no verifica: la etiqueta todavía no está publicada', async () => {
    const { svc, google, prisma } = armar(dominio());
    const r = await svc.registrarDominio('d-1', { ahora: AHORA });
    expect(r.estado).toBe('pendiente');
    expect(google.pedirTokenMeta).toHaveBeenCalledWith('https://tefaltacalleok.com/');
    expect(prisma.customDomain.update).toHaveBeenCalledWith({ where: { id: 'd-1' }, data: expect.objectContaining({ gscVerificationToken: TOKEN }) });
    expect(google.verificarPorMeta).not.toHaveBeenCalled();
    expect(google.enviarSitemap).not.toHaveBeenCalled();
  });

  it('con la etiqueta ya publicada: verifica, agrega el sitio y le envía el sitemap', async () => {
    const { svc, google, prisma } = armar(dominio({ gscVerificationToken: TOKEN, gscTriedAt: new Date('2026-10-07T11:00:00Z') }));
    await expect(svc.registrarDominio('d-1', { ahora: AHORA })).resolves.toEqual({ estado: 'verificado' });
    expect(google.verificarPorMeta).toHaveBeenCalledWith('https://tefaltacalleok.com/');
    expect(google.agregarSitio).toHaveBeenCalledWith('https://tefaltacalleok.com/');
    expect(google.enviarSitemap).toHaveBeenCalledWith('https://tefaltacalleok.com/', 'https://tefaltacalleok.com/sitemap.xml');
    const escrituras = prisma.customDomain.update.mock.calls.map((c) => c[0].data);
    expect(escrituras).toContainEqual(expect.objectContaining({ gscStatus: 'VERIFICADO' }));
    expect(escrituras).toContainEqual(expect.objectContaining({ gscSitemapAt: AHORA, gscError: null }));
  });

  it('si Google todavía no ve la etiqueta, queda pendiente con el motivo y NO envía el sitemap', async () => {
    const { svc, google, prisma } = armar(dominio({ gscVerificationToken: TOKEN, gscTriedAt: new Date('2026-10-07T11:00:00Z') }));
    google.verificarPorMeta.mockRejectedValue(new GoogleApiError(400, 'The necessary verification token could not be found on your site.'));
    const r = await svc.registrarDominio('d-1', { ahora: AHORA });
    expect(r.estado).toBe('pendiente');
    expect(r.mensaje).toContain('verification token');
    expect(google.enviarSitemap).not.toHaveBeenCalled();
    expect(prisma.customDomain.update).toHaveBeenCalledWith({ where: { id: 'd-1' }, data: expect.objectContaining({ gscError: expect.stringContaining('verification token') }) });
  });

  it('no le insiste a Google si lo intentó hace menos de un minuto (el panel sondea seguido)', async () => {
    const { svc, google } = armar(dominio({ gscVerificationToken: TOKEN, gscTriedAt: new Date(AHORA.getTime() - 20_000), gscError: 'esperando' }));
    await expect(svc.registrarDominio('d-1', { ahora: AHORA })).resolves.toEqual({ estado: 'pendiente', mensaje: 'esperando' });
    expect(google.verificarPorMeta).not.toHaveBeenCalled();
  });

  it('"forzar" (el botón del superadmin, la corrida nocturna) se salta esa espera', async () => {
    const { svc, google } = armar(dominio({ gscVerificationToken: TOKEN, gscTriedAt: new Date(AHORA.getTime() - 20_000) }));
    await svc.registrarDominio('d-1', { ahora: AHORA, forzar: true });
    expect(google.verificarPorMeta).toHaveBeenCalled();
  });

  it('un dominio ya verificado con el sitemap reciente no vuelve a llamar a Google', async () => {
    const { svc, google } = armar(dominio({ gscVerificationToken: TOKEN, gscStatus: 'VERIFICADO', gscSitemapAt: new Date('2026-10-05T00:00:00Z') }));
    await expect(svc.registrarDominio('d-1', { ahora: AHORA })).resolves.toEqual({ estado: 'verificado' });
    expect(google.verificarPorMeta).not.toHaveBeenCalled();
    expect(google.enviarSitemap).not.toHaveBeenCalled();
  });

  it('un dominio ya verificado reenvía el sitemap a la semana, sin verificar de nuevo', async () => {
    const { svc, google } = armar(dominio({ gscVerificationToken: TOKEN, gscStatus: 'VERIFICADO', gscSitemapAt: new Date('2026-09-28T00:00:00Z') }));
    await svc.registrarDominio('d-1', { ahora: AHORA });
    expect(google.verificarPorMeta).not.toHaveBeenCalled();
    expect(google.enviarSitemap).toHaveBeenCalled();
  });

  it('nunca tira: si Google falla, devuelve el motivo y lo deja anotado', async () => {
    const { svc, google, prisma } = armar(dominio());
    google.pedirTokenMeta.mockRejectedValue(new GoogleApiError(403, 'The caller does not have permission'));
    const r = await svc.registrarDominio('d-1', { ahora: AHORA });
    expect(r.estado).toBe('pendiente');
    expect(r.mensaje).toContain('no tiene permiso');
    expect(prisma.customDomain.update).toHaveBeenCalledWith({ where: { id: 'd-1' }, data: expect.objectContaining({ gscError: expect.stringContaining('permiso') }) });
  });
});

describe('enviarSitemapDeSubdominio', () => {
  it('lo envía bajo la propiedad de dominio orbita.site y deja la fecha', async () => {
    const { svc, google, prisma } = armar(null);
    await expect(svc.enviarSitemapDeSubdominio('b-1', 'venustyle', AHORA)).resolves.toEqual({ ok: true });
    expect(google.enviarSitemap).toHaveBeenCalledWith('sc-domain:orbita.site', 'https://venustyle.orbita.site/sitemap.xml');
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'b-1' }, data: { gscSitemapAt: AHORA } });
  });

  it('si Google lo rechaza, devuelve el motivo y no marca la fecha', async () => {
    const { svc, google, prisma } = armar(null);
    google.enviarSitemap.mockRejectedValue(new GoogleApiError(403, 'forbidden'));
    const r = await svc.enviarSitemapDeSubdominio('b-1', 'venustyle', AHORA);
    expect(r.ok).toBe(false);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });
});

describe('mantenimientoNocturno', () => {
  it('apagado: no consulta nada', async () => {
    const { svc, prisma } = armar(null, { habilitado: false });
    await expect(svc.mantenimientoNocturno()).resolves.toEqual({ dominios: 0, subdominios: 0 });
    expect(prisma.customDomain.findMany).not.toHaveBeenCalled();
  });

  it('solo toma tiendas publicadas, con algo a la venta, sin ocultar y sin dominio propio activo', async () => {
    const { svc, prisma } = armar(null);
    await svc.mantenimientoNocturno({ ahora: AHORA });
    const where = prisma.business.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ isActive: true, isPaused: false, isDemo: false, hiddenFromSearch: false, deletedAt: null });
    expect(where.customDomains).toEqual({ none: { status: 'ACTIVE', dnsVerified: true } });
    expect(where.products.some.status).toEqual({ in: ['PUBLISHED', 'OUT_OF_STOCK'] });
  });

  it('envía el sitemap de cada tienda que le toca', async () => {
    const { svc, google, prisma } = armar(null);
    prisma.business.findMany.mockResolvedValue([{ id: 'b-1', subdomain: 'uno' }, { id: 'b-2', subdomain: 'dos' }]);
    await expect(svc.mantenimientoNocturno({ ahora: AHORA })).resolves.toEqual({ dominios: 0, subdominios: 2 });
    expect(google.enviarSitemap).toHaveBeenCalledTimes(2);
  });

  it('si Google no deja (la cuenta no está agregada a orbita.site), corta en la primera: no insiste con todas', async () => {
    const { svc, google, prisma } = armar(null);
    prisma.business.findMany.mockResolvedValue([{ id: 'b-1', subdomain: 'uno' }, { id: 'b-2', subdomain: 'dos' }, { id: 'b-3', subdomain: 'tres' }]);
    google.enviarSitemap.mockRejectedValue(new GoogleApiError(403, 'forbidden'));
    await expect(svc.mantenimientoNocturno({ ahora: AHORA })).resolves.toEqual({ dominios: 0, subdominios: 0 });
    expect(google.enviarSitemap).toHaveBeenCalledTimes(1);
  });

  it('reintenta los dominios propios pendientes, o con el sitemap viejo', async () => {
    const { svc, prisma } = armar(dominio({ gscVerificationToken: TOKEN }));
    prisma.customDomain.findMany.mockResolvedValue([{ id: 'd-1' }]);
    await expect(svc.mantenimientoNocturno({ ahora: AHORA })).resolves.toEqual({ dominios: 1, subdominios: 0 });
    const where = prisma.customDomain.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ gscStatus: 'PENDIENTE' }, { gscSitemapAt: null }, { gscSitemapAt: { lt: new Date('2026-09-30T12:00:00Z') } }]);
  });
});

describe('resumenDeTienda', () => {
  const tienda = (over: object = {}) => ({ subdomain: 'venustyle', gscSitemapAt: null, customDomains: [], ...over });

  it('una tienda que no existe da 404', async () => {
    const { svc, prisma } = armar(null);
    prisma.business.findUnique.mockResolvedValue(null);
    await expect(svc.resumenDeTienda('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('apagado: avisa que no está configurado y no llama a Google', async () => {
    const { svc, google, prisma } = armar(null, { habilitado: false });
    prisma.business.findUnique.mockResolvedValue(tienda());
    const r = await svc.resumenDeTienda('b-1', AHORA);
    expect(r.configurado).toBe(false);
    expect(r.aviso).toContain('no está configurado');
    expect(google.rendimiento).not.toHaveBeenCalled();
  });

  it('un subdominio se consulta en la propiedad de dominio, filtrado a su propia dirección', async () => {
    const { svc, google, prisma } = armar(null);
    prisma.business.findUnique.mockResolvedValue(tienda());
    google.rendimiento.mockResolvedValueOnce([{ clicks: 12, impressions: 340, ctr: 0.035, position: 8.2 }]);
    const r = await svc.resumenDeTienda('b-1', AHORA);
    expect(r.propiedad).toBe('sc-domain:orbita.site');
    expect(r.origen).toBe('https://venustyle.orbita.site');
    expect(r.rendimiento).toEqual({ clics: 12, impresiones: 340, ctr: 0.035, posicion: 8.2 });
    // 28 días que terminan 2 días atrás (Search Console demora en publicar los datos).
    expect(r.periodo).toEqual({ desde: '2026-09-08', hasta: '2026-10-05' });
    expect(google.rendimiento.mock.calls[0][3].filtro).toEqual({ dimension: 'page', operator: 'contains', expression: 'https://venustyle.orbita.site/' });
    expect(google.inspeccionar).toHaveBeenCalledWith('https://venustyle.orbita.site/', 'sc-domain:orbita.site');
  });

  it('un dominio propio verificado se consulta en su propia propiedad, sin filtro', async () => {
    const { svc, google, prisma } = armar(null);
    prisma.business.findUnique.mockResolvedValue(tienda({ customDomains: [{ domain: 'tefaltacalleok.com', gscStatus: 'VERIFICADO', gscError: null, gscSitemapAt: AHORA }] }));
    const r = await svc.resumenDeTienda('b-1', AHORA);
    expect(r.propiedad).toBe('https://tefaltacalleok.com/');
    expect(google.rendimiento.mock.calls[0][3].filtro).toBeUndefined();
  });

  it('un dominio propio sin verificar todavía no devuelve datos, y dice por qué', async () => {
    const { svc, google, prisma } = armar(null);
    prisma.business.findUnique.mockResolvedValue(tienda({ customDomains: [{ domain: 'tefaltacalleok.com', gscStatus: 'PENDIENTE', gscError: 'esperando', gscSitemapAt: null }] }));
    const r = await svc.resumenDeTienda('b-1', AHORA);
    expect(r.aviso).toContain('no está verificado');
    expect(r.dominioPropio).toMatchObject({ domain: 'tefaltacalleok.com', estado: 'PENDIENTE', error: 'esperando' });
    expect(google.rendimiento).not.toHaveBeenCalled();
  });

  it('si un bloque falla (la portada todavía no la visitó Google), los demás se muestran igual', async () => {
    const { svc, google, prisma } = armar(null);
    prisma.business.findUnique.mockResolvedValue(tienda());
    google.rendimiento.mockResolvedValue([{ keys: ['remeras'], clicks: 3, impressions: 40, ctr: 0.07, position: 5 }]);
    google.inspeccionar.mockRejectedValue(new GoogleApiError(400, 'URL is unknown to Google'));
    const r = await svc.resumenDeTienda('b-1', AHORA);
    expect(r.inicio).toBeNull();
    expect(r.consultas).toEqual([{ consulta: 'remeras', clics: 3, impresiones: 40, posicion: 5 }]);
    expect(r.errores).toHaveLength(1);
  });

  it('si todo falla por lo mismo (sin permiso), el motivo se dice una sola vez', async () => {
    const { svc, google, prisma } = armar(null);
    prisma.business.findUnique.mockResolvedValue(tienda());
    const sinPermiso = new GoogleApiError(403, 'forbidden');
    google.rendimiento.mockRejectedValue(sinPermiso);
    google.inspeccionar.mockRejectedValue(sinPermiso);
    const r = await svc.resumenDeTienda('b-1', AHORA);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toContain('no tiene permiso');
  });
});

describe('sincronizarTienda', () => {
  it('con dominio propio activo registra el dominio y NO envía el sitemap del subdominio (saldría vacío)', async () => {
    const { svc, google, prisma } = armar(dominio({ gscVerificationToken: TOKEN, gscStatus: 'VERIFICADO', gscSitemapAt: new Date('2026-10-05T00:00:00Z') }));
    prisma.business.findUnique.mockResolvedValue({ id: 'b-1', subdomain: 'tefaltacalle', customDomains: [{ id: 'd-1', domain: 'tefaltacalleok.com' }] });
    const r = await svc.sincronizarTienda('b-1');
    expect(r.dominios).toEqual([{ domain: 'tefaltacalleok.com', estado: 'verificado' }]);
    expect(r.subdominio).toBeNull();
    expect(google.enviarSitemap).toHaveBeenCalledWith('https://tefaltacalleok.com/', 'https://tefaltacalleok.com/sitemap.xml');
    expect(google.enviarSitemap).not.toHaveBeenCalledWith('sc-domain:orbita.site', expect.anything());
  });

  it('sin dominio propio envía el sitemap del subdominio', async () => {
    const { svc, google, prisma } = armar(null);
    prisma.business.findUnique.mockResolvedValue({ id: 'b-1', subdomain: 'venustyle', customDomains: [] });
    const r = await svc.sincronizarTienda('b-1');
    expect(r.subdominio).toEqual({ ok: true });
    expect(google.enviarSitemap).toHaveBeenCalledWith('sc-domain:orbita.site', 'https://venustyle.orbita.site/sitemap.xml');
  });
});

describe('explicarErrorDeGoogle', () => {
  it('un 403 dice que falta el permiso en Search Console', () => {
    expect(explicarErrorDeGoogle(new GoogleApiError(403, 'x'))).toContain('no tiene permiso');
  });
  it('un 429 pide esperar', () => {
    expect(explicarErrorDeGoogle(new GoogleApiError(429, 'x'))).toContain('esperar');
  });
  it('otro error de Google conserva su código y su mensaje', () => {
    expect(explicarErrorDeGoogle(new GoogleApiError(400, 'token not found'))).toBe('Google respondió 400: token not found');
  });
});
