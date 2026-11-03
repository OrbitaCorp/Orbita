import { BadRequestException, ConflictException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { WhatsappService } from '../../src/whatsapp/whatsapp.service';

// Conexión por Embedded Signup (el botón de Meta dentro del panel): que el código se canjee con las credenciales de la
// app, que nadie pueda conectar un número que no es suyo mandando ids inventados, que un código vencido no deje nada
// guardado, y que un número que no se pudo registrar no corte una conexión que sí es válida.

const BIZ = 'biz-1';
const WABA = '222333444';
const PHONE = '555666777';
const TOKEN = 'token-del-negocio';

function respuesta(json: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => json } as any;
}

interface Opciones {
  canje?: any;
  numeros?: any;
  registro?: any;
  suscripcion?: any;
  config?: Record<string, string>;
  errorAlGuardar?: Error;
}

function armar(op: Opciones = {}) {
  const valores: Record<string, string> = {
    WHATSAPP_APP_ID: 'app-1', WHATSAPP_APP_SECRET: 'secreto', WHATSAPP_TOKEN_KEY: 'clave', ...op.config,
  };
  const prisma: any = {
    $executeRaw: op.errorAlGuardar ? jest.fn().mockRejectedValue(op.errorAlGuardar) : jest.fn().mockResolvedValue(1),
  };
  const svc = new WhatsappService(prisma, { get: (k: string) => valores[k] } as any);
  const llamadas: { url: string; init?: any }[] = [];
  jest.spyOn(global, 'fetch').mockImplementation((async (url: string, init?: any) => {
    llamadas.push({ url: String(url), init });
    const u = String(url);
    if (u.includes('/oauth/access_token')) return op.canje ?? respuesta({ access_token: TOKEN });
    if (u.includes(`/${WABA}/phone_numbers`)) return op.numeros ?? respuesta({ data: [{ id: PHONE, display_phone_number: '+54 9 11 5555-0000' }] });
    if (u.includes(`/${PHONE}/register`)) return op.registro ?? respuesta({ success: true });
    if (u.includes(`/${WABA}/subscribed_apps`)) return op.suscripcion ?? respuesta({ success: true });
    throw new Error(`url inesperada ${u}`);
  }) as any);
  return { svc, prisma, llamadas };
}

const dto = { code: 'codigo-de-meta', phoneNumberId: PHONE, wabaId: WABA };

afterEach(() => jest.restoreAllMocks());

describe('conectarConEmbeddedSignup', () => {
  it('canjea el código con las credenciales de la app, registra el número, guarda y suscribe', async () => {
    const { svc, prisma, llamadas } = armar();
    const r = await svc.conectarConEmbeddedSignup(BIZ, dto);
    expect(r).toEqual({ connected: true, displayPhone: '+54 9 11 5555-0000', suscripta: true, coexistencia: false });

    const canje = new URL(llamadas[0].url);
    expect(canje.pathname).toMatch(/\/oauth\/access_token$/);
    expect(Object.fromEntries(canje.searchParams)).toEqual({ client_id: 'app-1', client_secret: 'secreto', code: 'codigo-de-meta' });

    const registro = llamadas.find((l) => l.url.includes('/register'));
    expect(JSON.parse(registro?.init.body)).toMatchObject({ messaging_product: 'whatsapp', pin: expect.stringMatching(/^\d{6}$/) });
    expect(registro?.init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(llamadas.some((l) => l.url.includes(`/${WABA}/subscribed_apps`) && l.init.method === 'POST')).toBe(true);
  });

  it('el PIN del número es siempre el mismo (no hay que guardarlo) y distinto entre números', async () => {
    const pin = (id: string) => JSON.parse(JSON.stringify((armar().svc as any).pinDelNumero(id)));
    expect(pin(PHONE)).toBe(pin(PHONE));
    expect(pin(PHONE)).toMatch(/^\d{6}$/);
    expect(pin(PHONE)).not.toBe(pin('999888777'));
  });

  it('un código vencido o ya usado se rechaza y no queda nada guardado', async () => {
    const { svc, prisma, llamadas } = armar({ canje: respuesta({ error: { message: 'Invalid verification code', code: 100 } }, false, 400) });
    await expect(svc.conectarConEmbeddedSignup(BIZ, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(llamadas).toHaveLength(1);
  });

  it('un número que no es de esa cuenta no se conecta (ids inventados)', async () => {
    const { svc, prisma, llamadas } = armar({ numeros: respuesta({ data: [{ id: 'otro-numero' }] }) });
    await expect(svc.conectarConEmbeddedSignup(BIZ, dto)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(llamadas.some((l) => l.url.includes('/register'))).toBe(false);
  });

  it('si el token no puede ver la cuenta que se dice (cuenta ajena), tampoco se conecta', async () => {
    const { svc, prisma } = armar({ numeros: respuesta({ error: { message: 'Unsupported get request', code: 100 } }, false, 400) });
    await expect(svc.conectarConEmbeddedSignup(BIZ, dto)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('si no se pudo registrar el número (ya estaba registrado) la conexión sigue', async () => {
    const { svc, prisma } = armar({ registro: respuesta({ error: { message: 'already registered', code: 80007 } }, false, 400) });
    await expect(svc.conectarConEmbeddedSignup(BIZ, dto)).resolves.toMatchObject({ connected: true, suscripta: true });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('si no se pudo suscribir la app, la conexión queda pero se avisa que no va a recibir mensajes', async () => {
    const { svc } = armar({ suscripcion: respuesta({ error: { message: 'nope', code: 100 } }, false, 400) });
    await expect(svc.conectarConEmbeddedSignup(BIZ, dto)).resolves.toMatchObject({ connected: true, suscripta: false });
  });

  it('un número que ya usa otro negocio da un conflicto claro', async () => {
    const { svc } = armar({ errorAlGuardar: new Error('Unique constraint failed on the fields: (`phone_number_id`)') });
    await expect(svc.conectarConEmbeddedSignup(BIZ, dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('sin el id de la app configurado no intenta nada', async () => {
    const { svc, llamadas } = armar({ config: { WHATSAPP_APP_ID: '' } });
    await expect(svc.conectarConEmbeddedSignup(BIZ, dto)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(llamadas).toHaveLength(0);
  });
});

describe('asegurarHabilitado con "*"', () => {
  it('"*" habilita a cualquier negocio, también en producción, sin consultar la base', async () => {
    const prisma: any = { business: { findUnique: jest.fn() } };
    const svc = new WhatsappService(prisma, { get: (k: string) => ({ WHATSAPP_NEGOCIOS_HABILITADOS: '*', NODE_ENV: 'production' } as Record<string, string>)[k] } as any);
    await expect(svc.asegurarHabilitado(BIZ)).resolves.toBeUndefined();
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
  });
});
