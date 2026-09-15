import { Logger } from '@nestjs/common';
import {
  candidatosDeHost,
  crearOrigenPermitido,
  hostDeOrigenHttps,
  OrigenDeCors,
  TTL_CACHE_MS,
} from '../../src/common/cors/origen-permitido';

// Auditoría interna 10/09, hallazgo `hallazgo.cors-dominios-propios`.
//
// El CORS de main.ts aceptaba orbita.site y sus subdominios pero no los
// dominios propios: la tienda en "tefaltacalleok.com" llama a la API desde
// el navegador con credenciales, así que carrito, checkout y juegos quedaban
// bloqueados en cuanto se activara el primer dominio. La función de origen se
// prueba acá con una consulta falsa en lugar de Prisma.

const FIJOS = ['https://orbita.site', /^https:\/\/([a-z0-9-]+\.)?orbita\.site$/];
const ACTIVOS = new Set(['tefaltacalleok.com', 'www.lenteslindos.store']);

function armar(opts: { ttlMs?: number; maxEntradas?: number; consulta?: jest.Mock } = {}) {
  const consulta =
    opts.consulta ?? jest.fn((host: string) => Promise.resolve(ACTIVOS.has(host)));
  const origin = crearOrigenPermitido({
    fijos: FIJOS,
    esDominioPropioActivo: consulta,
    ttlMs: opts.ttlMs,
    maxEntradas: opts.maxEntradas,
  });
  return { origin, consulta };
}

// El paquete `cors` llama a origin(origin, cb) y sigue en el callback; acá se
// envuelve en una promesa para poder esperar el resultado.
const decidir = (origin: OrigenDeCors, valor: string | undefined) =>
  new Promise<{ err: Error | null; permitido: boolean | undefined }>((resolve) =>
    origin(valor, (err, permitido) => resolve({ err, permitido })),
  );

describe('CORS — orígenes fijos', () => {
  it('sin Origin (curl, same-origin) pasa sin consultar la base', async () => {
    const { origin, consulta } = armar();
    await expect(decidir(origin, undefined)).resolves.toEqual({ err: null, permitido: true });
    expect(consulta).not.toHaveBeenCalled();
  });

  it('un string exacto y un RegExp de la lista fija pasan sin consultar la base', async () => {
    const { origin, consulta } = armar();
    await expect(decidir(origin, 'https://orbita.site')).resolves.toEqual({ err: null, permitido: true });
    await expect(decidir(origin, 'https://tienda.orbita.site')).resolves.toEqual({ err: null, permitido: true });
    expect(consulta).not.toHaveBeenCalled();
  });

  it('el string fijo es igualdad exacta: un prefijo o un sufijo no pasan por ahí', async () => {
    const { origin, consulta } = armar();
    await expect(decidir(origin, 'https://orbita.site.evil.com')).resolves.toMatchObject({ permitido: false });
    expect(consulta).toHaveBeenCalledWith('orbita.site.evil.com');
  });
});

describe('CORS — dominios propios', () => {
  it('un CustomDomain ACTIVE con DNS verificado pasa', async () => {
    const { origin, consulta } = armar();
    await expect(decidir(origin, 'https://tefaltacalleok.com')).resolves.toEqual({ err: null, permitido: true });
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(consulta).toHaveBeenCalledWith('tefaltacalleok.com');
  });

  it('un dominio que no existe (o no está activo) se rechaza con cb(null, false), sin error', async () => {
    const { origin } = armar();
    await expect(decidir(origin, 'https://otratienda.com')).resolves.toEqual({ err: null, permitido: false });
  });

  it('"www." del apex guardado pasa; el apex de un dominio guardado con www no', async () => {
    const { origin, consulta } = armar();
    await expect(decidir(origin, 'https://www.tefaltacalleok.com')).resolves.toMatchObject({ permitido: true });
    expect(consulta.mock.calls.map((c) => c[0])).toEqual(['www.tefaltacalleok.com', 'tefaltacalleok.com']);

    consulta.mockClear();
    await expect(decidir(origin, 'https://www.lenteslindos.store')).resolves.toMatchObject({ permitido: true });
    expect(consulta).toHaveBeenCalledTimes(1);

    await expect(decidir(origin, 'https://lenteslindos.store')).resolves.toMatchObject({ permitido: false });
  });

  it('http, puerto, path, barra final, mayúsculas o un host inválido se rechazan sin consultar', async () => {
    const { origin, consulta } = armar();
    for (const malo of [
      'http://tefaltacalleok.com',
      'https://tefaltacalleok.com:8443',
      'https://tefaltacalleok.com/tienda',
      'https://tefaltacalleok.com/',
      'https://TefaltaCalleOk.com',
      'https://tefaltacalleok',
      'https://-mala.com',
      'https://mala-.com',
      'https://tienda..com',
      'https://tienda.com.',
      'https://user@tefaltacalleok.com',
      'null',
      'file://',
      '*',
    ]) {
      await expect(decidir(origin, malo)).resolves.toEqual({ err: null, permitido: false });
    }
    expect(consulta).not.toHaveBeenCalled();
  });

  it('si la consulta falla, rechaza sin lanzar, loguea y NO cachea el error', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const consulta = jest
      .fn<Promise<boolean>, [string]>()
      .mockRejectedValueOnce(new Error('la base no responde'))
      .mockResolvedValueOnce(true);
    const { origin } = armar({ consulta });

    await expect(decidir(origin, 'https://tefaltacalleok.com')).resolves.toEqual({ err: null, permitido: false });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('tefaltacalleok.com'));

    await expect(decidir(origin, 'https://tefaltacalleok.com')).resolves.toMatchObject({ permitido: true });
    expect(consulta).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});

describe('CORS — caché', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-09-14T12:00:00-03:00') }));
  afterEach(() => jest.useRealTimers());

  it('la segunda llamada al mismo host no consulta la base (positivo y negativo)', async () => {
    const { origin, consulta } = armar();
    await decidir(origin, 'https://tefaltacalleok.com');
    await decidir(origin, 'https://otratienda.com');
    expect(consulta).toHaveBeenCalledTimes(2);

    await expect(decidir(origin, 'https://tefaltacalleok.com')).resolves.toMatchObject({ permitido: true });
    await expect(decidir(origin, 'https://otratienda.com')).resolves.toMatchObject({ permitido: false });
    expect(consulta).toHaveBeenCalledTimes(2);
  });

  it('varias requests a la vez del mismo host hacen UNA consulta', async () => {
    const { origin, consulta } = armar();
    const resultados = await Promise.all([
      decidir(origin, 'https://tefaltacalleok.com'),
      decidir(origin, 'https://tefaltacalleok.com'),
      decidir(origin, 'https://tefaltacalleok.com'),
    ]);
    expect(resultados.every((r) => r.permitido === true)).toBe(true);
    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it('vencido el TTL (5 minutos) vuelve a consultar, y ve el cambio', async () => {
    const activos = new Set<string>();
    const consulta = jest.fn((host: string) => Promise.resolve(activos.has(host)));
    const { origin } = armar({ consulta });

    await expect(decidir(origin, 'https://tefaltacalleok.com')).resolves.toMatchObject({ permitido: false });
    activos.add('tefaltacalleok.com'); // el negocio verifica el DNS

    jest.advanceTimersByTime(TTL_CACHE_MS - 1);
    await expect(decidir(origin, 'https://tefaltacalleok.com')).resolves.toMatchObject({ permitido: false });
    expect(consulta).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    await expect(decidir(origin, 'https://tefaltacalleok.com')).resolves.toMatchObject({ permitido: true });
    expect(consulta).toHaveBeenCalledTimes(2);
  });

  it('al llegar al tope descarta primero las vencidas y después la más vieja', async () => {
    const { origin, consulta } = armar({ maxEntradas: 2 });
    await decidir(origin, 'https://a.com');
    await decidir(origin, 'https://b.com');
    await decidir(origin, 'https://c.com'); // tope: sale a.com (la más vieja)
    expect(consulta).toHaveBeenCalledTimes(3);

    await decidir(origin, 'https://b.com'); // sigue en caché
    await decidir(origin, 'https://c.com');
    expect(consulta).toHaveBeenCalledTimes(3);

    await decidir(origin, 'https://a.com'); // ya no estaba: consulta y saca b.com
    expect(consulta).toHaveBeenCalledTimes(4);
    await decidir(origin, 'https://b.com');
    expect(consulta).toHaveBeenCalledTimes(5);

    // Con entradas vencidas, se limpian esas en vez de sacar una viva.
    jest.advanceTimersByTime(TTL_CACHE_MS);
    await decidir(origin, 'https://d.com'); // a.com y b.com vencidas: se van las dos
    expect(consulta).toHaveBeenCalledTimes(6);
    await decidir(origin, 'https://e.com'); // entra sin sacar a d.com
    await decidir(origin, 'https://d.com');
    expect(consulta).toHaveBeenCalledTimes(7);
  });
});

describe('CORS — helpers', () => {
  it('hostDeOrigenHttps acepta solo https://<host> y devuelve el host', () => {
    expect(hostDeOrigenHttps('https://tefaltacalleok.com')).toBe('tefaltacalleok.com');
    expect(hostDeOrigenHttps('https://xn--tefalta-9za.com.ar')).toBe('xn--tefalta-9za.com.ar');
    expect(hostDeOrigenHttps('https://tienda.orbita.site')).toBe('tienda.orbita.site');
    expect(hostDeOrigenHttps('http://tefaltacalleok.com')).toBeNull();
    expect(hostDeOrigenHttps('https://tefaltacalleok.com:443')).toBeNull();
    expect(hostDeOrigenHttps('https://1.2.3.4')).toBeNull();
    const largo = ['a', 'b', 'c', 'd'].map((l) => l.repeat(63)).join('.') + '.com';
    expect(hostDeOrigenHttps(`https://${largo}`)).toBeNull();
  });

  it('candidatosDeHost agrega el apex cuando el host viene con www.', () => {
    expect(candidatosDeHost('www.tefaltacalleok.com')).toEqual(['www.tefaltacalleok.com', 'tefaltacalleok.com']);
    expect(candidatosDeHost('tefaltacalleok.com')).toEqual(['tefaltacalleok.com']);
    expect(candidatosDeHost('www.')).toEqual(['www.']);
  });
});
