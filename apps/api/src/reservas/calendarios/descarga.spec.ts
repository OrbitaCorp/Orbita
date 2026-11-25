import { ESPERA_MS, MAXIMO_BYTES, descargarCalendario, errorDeUrl } from './descarga';

const PROD = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;
const BUENA = 'https://www.airbnb.com.ar/calendar/ical/123.ics?s=abc';
const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';

describe('reservas · qué enlace de calendario se acepta', () => {
  it.each([
    'https://www.airbnb.com/calendar/ical/123.ics?s=abc',
    'https://www.airbnb.com.ar/calendar/ical/123.ics?s=abc',
    'https://www.airbnb.es/calendar/ical/123.ics',
    '  https://www.airbnb.com/calendar/ical/123.ics?s=abc  ',
  ])('acepta %s', (u) => expect(errorDeUrl(u, PROD)).toBeNull());

  it.each([
    'http://www.airbnb.com/calendar/ical/1.ics', // sin https
    'https://airbnb.evil.com/calendar/ical/1.ics', // otro dominio
    'https://www.airbnb.com.evil.io/calendar/ical/1.ics',
    'https://evilairbnb.com/calendar/ical/1.ics',
    'https://www.airbnb.com/rooms/1', // no es .ics
    'https://user:pw@www.airbnb.com/a.ics',
    'https://www.airbnb.com:8443/a.ics',
    'https://localhost/a.ics',
    'https://169.254.169.254/a.ics',
    'file:///etc/passwd.ics',
    'no es una url',
    '',
    `https://www.airbnb.com/${'a'.repeat(600)}.ics`, // más de 600 caracteres
  ])('rechaza %s', (u) => expect(errorDeUrl(u, PROD)).toMatch(/enlace de Airbnb/));

  it('el host de prueba vale solo fuera de producción', () => {
    const local = 'http://localhost:4010/ejemplo.ics';
    expect(errorDeUrl(local, { NODE_ENV: 'development', RESERVAS_ICAL_HOST_DE_PRUEBA: 'localhost:4010' } as NodeJS.ProcessEnv)).toBeNull();
    expect(errorDeUrl(local, { NODE_ENV: 'production', RESERVAS_ICAL_HOST_DE_PRUEBA: 'localhost:4010' } as NodeJS.ProcessEnv)).toMatch(/enlace de Airbnb/);
    expect(errorDeUrl(local, { NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toMatch(/enlace de Airbnb/);
    expect(errorDeUrl('http://localhost:9999/ejemplo.ics', { NODE_ENV: 'development', RESERVAS_ICAL_HOST_DE_PRUEBA: 'localhost:4010' } as NodeJS.ProcessEnv)).toMatch(/enlace de Airbnb/);
  });
});

describe('reservas · bajar el calendario', () => {
  const con = (respuesta: () => Response | Promise<Response>) => {
    const fetchFalso = jest.fn(async () => respuesta());
    return { fetchFalso, bajar: () => descargarCalendario(BUENA, { fetch: fetchFalso as unknown as typeof fetch, env: PROD }) };
  };

  it('baja el archivo sin seguir redirecciones y con tiempo máximo', async () => {
    const { fetchFalso, bajar } = con(() => new Response(ICS, { status: 200 }));
    expect(await bajar()).toEqual({ ok: true, texto: ICS });
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(BUENA);
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeDefined();
    expect(ESPERA_MS).toBe(8000);
  });

  it('una URL que no es de Airbnb ni se pide', async () => {
    const fetchFalso = jest.fn();
    const r = await descargarCalendario('https://169.254.169.254/a.ics', { fetch: fetchFalso as unknown as typeof fetch, env: PROD });
    expect(r).toMatchObject({ ok: false });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('no sigue redirecciones: una redirección no es el calendario', async () => {
    const r = await con(() => new Response(null, { status: 302, headers: { location: 'https://www.airbnb.com/login' } })).bajar();
    expect(r).toEqual({ ok: false, motivo: 'Airbnb no respondió con el calendario. Volvé a copiar el enlace desde Airbnb.' });
  });

  it('una página HTML o un archivo sin BEGIN:VCALENDAR no es un calendario', async () => {
    const r = await con(() => new Response('<html><body>Algo salió mal</body></html>', { status: 200 })).bajar();
    expect(r).toEqual({ ok: false, motivo: 'Airbnb no respondió con el calendario. Volvé a copiar el enlace desde Airbnb.' });
  });

  it('un 403 o un 500 de Airbnb se cuenta con su número', async () => {
    expect(await con(() => new Response('no', { status: 403 })).bajar()).toEqual({ ok: false, motivo: 'Airbnb respondió 403.' });
    expect(await con(() => new Response('no', { status: 500 })).bajar()).toEqual({ ok: false, motivo: 'Airbnb respondió 500.' });
  });

  it('más de 1 MB se corta', async () => {
    const r = await con(() => new Response('BEGIN:VCALENDAR' + 'x'.repeat(MAXIMO_BYTES + 1), { status: 200 })).bajar();
    expect(r).toEqual({ ok: false, motivo: 'El calendario es demasiado grande.' });
    expect(MAXIMO_BYTES).toBe(1_000_000);
  });

  it('si no responde a tiempo, se corta y se dice', async () => {
    const r = await con(() => Promise.reject(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }))).bajar();
    expect(r).toEqual({ ok: false, motivo: 'Airbnb no respondió a tiempo.' });
  });

  it('si no hay conexión, no tira', async () => {
    const r = await con(() => Promise.reject(new TypeError('fetch failed'))).bajar();
    expect(r).toEqual({ ok: false, motivo: 'No se pudo conectar con Airbnb.' });
  });
});
