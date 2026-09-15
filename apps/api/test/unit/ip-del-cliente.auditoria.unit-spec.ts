import {
  ipDelCliente,
  ipReenviadaPorBff,
  HEADER_IP_CLIENTE,
  HEADER_SECRETO_IP_CLIENTE,
  LARGO_MINIMO_SECRETO_BFF,
} from '../../src/common/utils/proxy';
import { ClientIpThrottlerGuard } from '../../src/common/guards/client-ip-throttler.guard';
import { AuthThrottlerGuard } from '../../src/common/guards/auth-throttler.guard';
import { AppController } from '../../src/app.controller';
import { AuthController } from '../../src/auth/auth.controller';
import { ipDelClienteDelContexto } from '../../src/common/decorators/ip-del-cliente.decorator';

// Auditoría interna 10/09, hallazgo rate-limit-ip-proxy (segunda mitad): los
// pedidos que pasan por el BFF de Next.js en Vercel llegaban todos con la IP
// de Vercel. El BFF reenvía la IP real con un secreto compartido y la API la
// usa solo si el secreto coincide; sin secret configurado, todo sigue igual.

const SECRETO = 'a'.repeat(LARGO_MINIMO_SECRETO_BFF);
const IP_VERCEL = '76.76.21.21';
const IP_REAL = '190.190.1.2';

function pedido(headers: Record<string, string | string[]> = {}, ip = IP_VERCEL) {
  return { ip, headers };
}

function porBff(ip = IP_REAL, secreto = SECRETO) {
  return pedido({ [HEADER_IP_CLIENTE]: ip, [HEADER_SECRETO_IP_CLIENTE]: secreto });
}

type ConTracker = { getTracker(req: Record<string, unknown>): Promise<string> };
function guard<T>(Clase: new (...args: never[]) => T): ConTracker {
  // ThrottlerGuard guarda (options, storage, reflector) en el constructor y
  // recién los usa en onModuleInit/canActivate — para getTracker alcanza así.
  return new (Clase as unknown as new (...a: unknown[]) => ConTracker)({}, {}, {});
}

describe('ipDelCliente: la IP que reenvía el BFF solo con el secreto correcto', () => {
  it('sin BFF_IP_SECRET configurado devuelve req.ip aunque vengan los headers', () => {
    expect(ipDelCliente(porBff(), {} as NodeJS.ProcessEnv)).toBe(IP_VERCEL);
    expect(ipReenviadaPorBff(porBff(), {} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('con el secreto correcto devuelve la IP del header', () => {
    expect(ipDelCliente(porBff(), { BFF_IP_SECRET: SECRETO } as NodeJS.ProcessEnv)).toBe(IP_REAL);
    expect(ipReenviadaPorBff(porBff(), { BFF_IP_SECRET: SECRETO } as NodeJS.ProcessEnv)).toBe(IP_REAL);
  });

  it('con un secreto distinto (mismo largo o no) devuelve req.ip', () => {
    const env = { BFF_IP_SECRET: SECRETO } as NodeJS.ProcessEnv;
    expect(ipDelCliente(porBff(IP_REAL, 'b'.repeat(LARGO_MINIMO_SECRETO_BFF)), env)).toBe(IP_VERCEL);
    expect(ipDelCliente(porBff(IP_REAL, 'corto'), env)).toBe(IP_VERCEL);
    expect(ipDelCliente(porBff(IP_REAL, ''), env)).toBe(IP_VERCEL);
  });

  it('si la IP del header no es una IP, devuelve req.ip', () => {
    const env = { BFF_IP_SECRET: SECRETO } as NodeJS.ProcessEnv;
    expect(ipDelCliente(porBff('no-es-ip'), env)).toBe(IP_VERCEL);
    expect(ipDelCliente(porBff('1.2.3.4, 5.6.7.8'), env)).toBe(IP_VERCEL);
    expect(ipDelCliente(porBff(''), env)).toBe(IP_VERCEL);
    // IPv6 sí es una IP.
    expect(ipDelCliente(porBff('2800:810:4ea:2c4::1'), env)).toBe('2800:810:4ea:2c4::1');
  });

  it('un secret configurado demasiado corto se ignora por completo', () => {
    const corto = 'x'.repeat(LARGO_MINIMO_SECRETO_BFF - 1);
    expect(ipDelCliente(porBff(IP_REAL, corto), { BFF_IP_SECRET: corto } as NodeJS.ProcessEnv)).toBe(IP_VERCEL);
  });

  it('solo la IP sin el secreto, o solo el secreto sin IP, no cambian nada', () => {
    const env = { BFF_IP_SECRET: SECRETO } as NodeJS.ProcessEnv;
    expect(ipDelCliente(pedido({ [HEADER_IP_CLIENTE]: IP_REAL }), env)).toBe(IP_VERCEL);
    expect(ipDelCliente(pedido({ [HEADER_SECRETO_IP_CLIENTE]: SECRETO }), env)).toBe(IP_VERCEL);
  });

  it('nunca lee X-Forwarded-For a mano: sin headers propios es req.ip', () => {
    const env = { BFF_IP_SECRET: SECRETO } as NodeJS.ProcessEnv;
    expect(ipDelCliente(pedido({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8' }), env)).toBe(IP_VERCEL);
    expect(ipDelCliente({ headers: {} }, env)).toBeUndefined();
  });
});

describe('guards de throttling: el balde es por IP real del cliente', () => {
  const original = process.env.BFF_IP_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.BFF_IP_SECRET;
    else process.env.BFF_IP_SECRET = original;
  });

  it('ClientIpThrottlerGuard: dos IPs distintas por el BFF no comparten balde', async () => {
    process.env.BFF_IP_SECRET = SECRETO;
    const g = guard(ClientIpThrottlerGuard);
    expect(await g.getTracker(porBff('190.190.1.2'))).toBe('190.190.1.2');
    expect(await g.getTracker(porBff('181.1.1.1'))).toBe('181.1.1.1');
  });

  it('ClientIpThrottlerGuard: sin secret configurado trackea por req.ip como el guard original', async () => {
    delete process.env.BFF_IP_SECRET;
    const g = guard(ClientIpThrottlerGuard);
    expect(await g.getTracker(porBff())).toBe(IP_VERCEL);
    expect(await g.getTracker({ headers: {} })).toBe('unknown');
  });

  it('AuthThrottlerGuard: por email si hay, y si no por la IP real del cliente', async () => {
    process.env.BFF_IP_SECRET = SECRETO;
    const g = guard(AuthThrottlerGuard);
    expect(await g.getTracker({ ...porBff(), body: { email: ' Ana@Mail.com ' } })).toBe('ana@mail.com');
    expect(await g.getTracker({ ...porBff(), body: {} })).toBe(IP_REAL);
    expect(await g.getTracker({ ...porBff(IP_REAL, 'otro'), body: {} })).toBe(IP_VERCEL);
  });
});

describe('dónde se usa la IP real', () => {
  const original = process.env.BFF_IP_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.BFF_IP_SECRET;
    else process.env.BFF_IP_SECRET = original;
  });

  it('/health/ip informa clientIp y viaBff sin exponer el secreto', () => {
    process.env.BFF_IP_SECRET = SECRETO;
    const c = new AppController({} as never);
    const conBff = c.ip({ ...porBff(), headers: { ...porBff().headers, 'x-forwarded-for': `${IP_REAL}, 10.0.0.1` } } as never);
    expect(conBff).toEqual({ ip: IP_VERCEL, xForwardedFor: `${IP_REAL}, 10.0.0.1`, clientIp: IP_REAL, viaBff: true });
    expect(JSON.stringify(conBff)).not.toContain(SECRETO);

    const directo = c.ip(pedido({}, IP_REAL) as never);
    expect(directo).toEqual({ ip: IP_REAL, xForwardedFor: null, clientIp: IP_REAL, viaBff: false });
  });

  it('@IpDelCliente (wizard de Orbi) resuelve la misma IP que el throttler', () => {
    process.env.BFF_IP_SECRET = SECRETO;
    const ctx = (req: unknown) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as never;
    expect(ipDelClienteDelContexto(ctx(porBff()))).toBe(IP_REAL);
    expect(ipDelClienteDelContexto(ctx(porBff(IP_REAL, 'otro')))).toBe(IP_VERCEL);
  });

  it('la sesión guarda la IP real del cliente como deviceInfo, no la de Vercel', async () => {
    process.env.BFF_IP_SECRET = SECRETO;
    const svc = { login: jest.fn().mockResolvedValue({}) };
    const req = { ...porBff(), headers: { ...porBff().headers, 'user-agent': 'UA' } };
    await new AuthController(svc as never).login({ email: 'a@b.c', password: 'x' } as never, req as never, 'tienda');
    expect(svc.login).toHaveBeenCalledWith(expect.anything(), 'tienda', { userAgent: 'UA', ip: IP_REAL });
  });
});
