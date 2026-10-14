import { createHash, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { AccesoDenegadoError, McpOauthService, OAuthError, retornoPermitido } from '../../src/marketing/prospeccion/mcp/mcp-oauth.service';

// El servidor OAuth del conector MCP de la Prospección, con una base en memoria. Lo importante: solo un superadmin
// activo con correo de la organización puede conectar a Claude, los códigos y los tokens de renovación son de un solo
// uso, y un token de este conector nunca sirve como sesión del panel.

const SECRETO = 'x'.repeat(40);
const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
const MCP = 'https://api.orbita.site/api/v1/mcp/prospeccion';

type Fila = Record<string, any>;
// En una base real una columna sin valor es null, no undefined.
const coincide = (fila: Fila, where: Fila) =>
  Object.entries(where).every(([k, v]) => (v !== null && typeof v === 'object' ? true : (fila[k] ?? null) === v));

function tabla() {
  const filas: Fila[] = [];
  return {
    filas,
    create: jest.fn(async ({ data }: { data: Fila }) => { const f = { id: `id-${filas.length + 1}`, ...data }; filas.push(f); return f; }),
    findUnique: jest.fn(async ({ where }: { where: Fila }) => filas.find((f) => coincide(f, where)) ?? null),
    updateMany: jest.fn(async ({ where, data }: { where: Fila; data: Fila }) => {
      const hit = filas.filter((f) => coincide(f, where));
      hit.forEach((f) => Object.assign(f, data));
      return { count: hit.length };
    }),
    deleteMany: jest.fn(async () => ({ count: 0 })),
  };
}

function armar(admin: Partial<{ id: string; email: string; role: string; isActive: boolean }> | null = {}) {
  const adminBase = { id: 'admin-1', email: 'mateo@orbita-corp.com', role: 'SUPERADMIN', isActive: true, ...(admin ?? {}) };
  const estado = { admin: admin === null ? null : adminBase };
  const prisma = {
    marketingMcpCodigo: tabla(),
    marketingMcpRefresh: tabla(),
    platformAdmin: { findUnique: jest.fn(async () => estado.admin) },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const env: Record<string, string> = { JWT_SECRET: SECRETO };
  const svc = new McpOauthService(prisma as never, { get: (k: string) => env[k], getOrThrow: (k: string) => env[k] } as never);
  return { svc, prisma, estado, env };
}

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};

/** Recorre todo el flujo de Claude: registro, autorización, aprobación en el panel y canje del código. */
async function conectar(ctx = armar(), decision: 'aprobar' | 'cancelar' = 'aprobar') {
  const { svc } = ctx;
  const cliente = svc.registrarCliente({ redirect_uris: [CLAUDE], client_name: 'Claude' });
  const p = pkce();
  const destino = svc.iniciarAutorizacion({ response_type: 'code', client_id: cliente.client_id, redirect_uri: CLAUDE, code_challenge: p.challenge, code_challenge_method: 'S256', state: 'abc', resource: MCP });
  const req = new URL(destino).searchParams.get('req')!;
  const { redirect } = await svc.resolverSolicitud('admin-1', req, decision);
  const vuelta = new URL(redirect);
  return { ...ctx, cliente, p, req, vuelta, code: vuelta.searchParams.get('code') };
}

describe('direcciones de retorno permitidas', () => {
  it.each([CLAUDE, 'https://claude.com/api/mcp/auth_callback', 'http://localhost:6274/callback', 'http://127.0.0.1:53124/oauth/callback'])('%s sí', (u) => {
    expect(retornoPermitido(u)).toBe(true);
  });
  it.each(['https://evil.example.com/cb', 'http://claude.ai/api/mcp/auth_callback', 'http://localhost.evil.com/cb', 'javascript:alert(1)', 'http://user:pw@localhost/cb', 'no es una url', 'http://localhost/cb#frag'])('%s no', (u) => {
    expect(retornoPermitido(u)).toBe(false);
  });
  it('una dirección extra configurada se acepta exacta', () => {
    expect(retornoPermitido('https://otra.orbita.site/cb', ['https://otra.orbita.site/cb'])).toBe(true);
  });
});

describe('metadata de descubrimiento', () => {
  it('declara código + PKCE S256, cliente público y registro dinámico', () => {
    const m = armar().svc.metadataServidor();
    expect(m).toMatchObject({
      issuer: 'https://api.orbita.site',
      authorization_endpoint: 'https://api.orbita.site/api/v1/mcp/oauth/authorize',
      token_endpoint: 'https://api.orbita.site/api/v1/mcp/oauth/token',
      registration_endpoint: 'https://api.orbita.site/api/v1/mcp/oauth/register',
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
    expect(m.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
  });
  it('el recurso protegido apunta a este servidor y la dirección de metadata es la del conector', () => {
    const { svc } = armar();
    expect(svc.metadataRecurso()).toMatchObject({ resource: MCP, authorization_servers: ['https://api.orbita.site'] });
    expect(svc.urlMetadataRecurso).toBe('https://api.orbita.site/.well-known/oauth-protected-resource/api/v1/mcp/prospeccion');
  });
});

describe('registro de clientes', () => {
  it('registra a Claude y el client_id lleva firmadas sus direcciones', () => {
    const { svc } = armar();
    const c = svc.registrarCliente({ redirect_uris: [CLAUDE], client_name: 'Claude' });
    expect(c).toMatchObject({ token_endpoint_auth_method: 'none', redirect_uris: [CLAUDE] });
    expect(svc.clienteDe(c.client_id)).toEqual({ nombre: 'Claude', redirectUris: [CLAUDE] });
  });
  it('rechaza direcciones que no son de Claude y listas inválidas', () => {
    const { svc } = armar();
    expect(() => svc.registrarCliente({ redirect_uris: ['https://evil.example.com/cb'] })).toThrow(OAuthError);
    expect(() => svc.registrarCliente({ redirect_uris: [] })).toThrow(OAuthError);
    expect(() => svc.registrarCliente({})).toThrow(OAuthError);
    expect(() => svc.registrarCliente({ redirect_uris: Array.from({ length: 6 }, () => CLAUDE) })).toThrow(OAuthError);
  });
  it('un client_id alterado o de otro servidor es invalid_client (401) para que Claude se registre de nuevo', () => {
    const { svc } = armar();
    const bueno = svc.registrarCliente({ redirect_uris: [CLAUDE] }).client_id;
    const ajeno = jwt.sign({ ru: ['https://evil.example.com/cb'], n: 'x' }, 'otra-clave');
    for (const malo of [bueno + 'x', ajeno, 'basura', undefined]) {
      expect(() => svc.clienteDe(malo)).toThrow(expect.objectContaining({ codigo: 'invalid_client', status: 401 }));
    }
  });
});

describe('inicio de la autorización', () => {
  function pedido(over: Record<string, string | undefined> = {}) {
    const { svc } = armar();
    const c = svc.registrarCliente({ redirect_uris: [CLAUDE] });
    const { challenge } = pkce();
    const q = { response_type: 'code', client_id: c.client_id, redirect_uri: CLAUDE, code_challenge: challenge, code_challenge_method: 'S256', state: 's', ...over };
    return { svc, q };
  }
  it('manda a la página de consentimiento del panel con la solicitud firmada', () => {
    const { svc, q } = pedido();
    const u = new URL(svc.iniciarAutorizacion(q));
    expect(`${u.origin}${u.pathname}`).toBe('https://orbita.site/superadmin/conectar-claude');
    expect(u.searchParams.get('req')).toBeTruthy();
  });
  it('una dirección de retorno que no es la registrada NO se redirige (no hay a dónde mandar el error)', () => {
    const { svc, q } = pedido({ redirect_uri: 'https://evil.example.com/cb' });
    expect(() => svc.iniciarAutorizacion(q)).toThrow(expect.objectContaining({ codigo: 'invalid_request', redirigible: false }));
  });
  it.each([
    ['otro response_type', { response_type: 'token' }],
    ['sin PKCE', { code_challenge: undefined }],
    ['PKCE plain', { code_challenge_method: 'plain' }],
    ['un recurso que no es este conector', { resource: 'https://api.orbita.site/otro' }],
  ])('%s se rechaza avisando al cliente', (_t, over) => {
    const { svc, q } = pedido(over as Record<string, string | undefined>);
    expect(() => svc.iniciarAutorizacion(q)).toThrow(expect.objectContaining({ redirigible: true }));
  });
  it('una solicitud alterada o vencida no se puede aprobar', async () => {
    const { svc } = armar();
    await expect(svc.resolverSolicitud('admin-1', 'basura', 'aprobar')).rejects.toBeInstanceOf(OAuthError);
    const vencida = jwt.sign({ cid: 'x', ru: CLAUDE, cc: 'c', nom: 'Claude' }, 'clave-ajena', { expiresIn: '10m' });
    await expect(svc.resolverSolicitud('admin-1', vencida, 'aprobar')).rejects.toBeInstanceOf(OAuthError);
  });
});

describe('quién puede conectar a Claude', () => {
  it('un superadmin activo con correo de la organización puede (orbita-corp.com y orbita.site)', async () => {
    for (const email of ['mateo@orbita-corp.com', 'alan@orbita.site', 'ALEX@Orbita-Corp.com']) {
      const { code } = await conectar(armar({ email }));
      expect(code).toBeTruthy();
    }
  });
  it.each([
    ['un correo de otro dominio', { email: 'mateo@gmail.com' }],
    ['un subdominio parecido', { email: 'x@orbita-corp.com.evil.com' }],
    ['un operador', { role: 'OPERATOR' }],
    ['una cuenta desactivada', { isActive: false }],
    ['una cuenta que no existe', null],
  ])('%s no puede', async (_t, admin) => {
    const ctx = armar(admin as never);
    const cliente = ctx.svc.registrarCliente({ redirect_uris: [CLAUDE] });
    const { challenge } = pkce();
    const req = new URL(ctx.svc.iniciarAutorizacion({ response_type: 'code', client_id: cliente.client_id, redirect_uri: CLAUDE, code_challenge: challenge, code_challenge_method: 'S256' })).searchParams.get('req')!;
    await expect(ctx.svc.resolverSolicitud('admin-1', req, 'aprobar')).rejects.toBeInstanceOf(AccesoDenegadoError);
    expect(ctx.prisma.marketingMcpCodigo.filas).toHaveLength(0);
  });
  it('si la persona cancela, Claude recibe access_denied con su state y no se emite ningún código', async () => {
    const { vuelta, prisma } = await conectar(armar(), 'cancelar');
    expect(vuelta.searchParams.get('error')).toBe('access_denied');
    expect(vuelta.searchParams.get('state')).toBe('abc');
    expect(vuelta.searchParams.get('code')).toBeNull();
    expect(prisma.marketingMcpCodigo.filas).toHaveLength(0);
  });
});

describe('canje del código y tokens', () => {
  const canje = (c: Awaited<ReturnType<typeof conectar>>, over: Record<string, string | undefined> = {}) =>
    c.svc.token({ grant_type: 'authorization_code', client_id: c.cliente.client_id, code: c.code!, code_verifier: c.p.verifier, redirect_uri: CLAUDE, ...over });

  it('el flujo completo termina en un token de acceso que verifica y devuelve al superadmin', async () => {
    const c = await conectar();
    expect(c.vuelta.searchParams.get('state')).toBe('abc');
    const t = await canje(c);
    expect(t).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'prospeccion' });
    expect(t.refresh_token).toBeTruthy();
    await expect(c.svc.verificarAcceso(t.access_token)).resolves.toEqual({ adminId: 'admin-1', email: 'mateo@orbita-corp.com' });
  });

  it('el código y el refresh se guardan como hash, nunca en claro', async () => {
    const c = await conectar();
    const t = await canje(c);
    expect(JSON.stringify(c.prisma.marketingMcpCodigo.filas)).not.toContain(c.code!);
    expect(JSON.stringify(c.prisma.marketingMcpRefresh.filas)).not.toContain(t.refresh_token);
  });

  it('el código sirve una sola vez', async () => {
    const c = await conectar();
    await canje(c);
    await expect(canje(c)).rejects.toMatchObject({ codigo: 'invalid_grant' });
  });

  it('un code_verifier equivocado, otra dirección de retorno o un código vencido no canjean', async () => {
    const c = await conectar();
    await expect(canje(c, { code_verifier: pkce().verifier })).rejects.toMatchObject({ codigo: 'invalid_grant' });
    await expect(canje(c, { redirect_uri: 'http://localhost:1234/cb' })).rejects.toMatchObject({ codigo: 'invalid_grant' });
    c.prisma.marketingMcpCodigo.filas[0].expiraAt = new Date(Date.now() - 1000);
    await expect(canje(c)).rejects.toMatchObject({ codigo: 'invalid_grant' });
  });

  it('un código emitido para un cliente no lo canjea otro cliente', async () => {
    const c = await conectar();
    const otro = c.svc.registrarCliente({ redirect_uris: [CLAUDE], client_name: 'Otro' });
    await expect(canje(c, { client_id: otro.client_id })).rejects.toMatchObject({ codigo: 'invalid_grant' });
  });

  it('con un grant_type desconocido o sin client_id, error', async () => {
    const c = await conectar();
    await expect(c.svc.token({ grant_type: 'password', client_id: c.cliente.client_id })).rejects.toMatchObject({ codigo: 'unsupported_grant_type' });
    await expect(c.svc.token({ grant_type: 'authorization_code' })).rejects.toMatchObject({ codigo: 'invalid_client', status: 401 });
  });

  it('el refresh rota: el viejo deja de servir y reusarlo revoca toda la autorización', async () => {
    const c = await conectar();
    const t1 = await canje(c);
    const t2 = await c.svc.token({ grant_type: 'refresh_token', client_id: c.cliente.client_id, refresh_token: t1.refresh_token });
    expect(t2.refresh_token).not.toBe(t1.refresh_token);
    await expect(c.svc.verificarAcceso(t2.access_token)).resolves.toMatchObject({ adminId: 'admin-1' });
    // alguien reusa el refresh viejo → se corta la familia, incluido el nuevo
    await expect(c.svc.token({ grant_type: 'refresh_token', client_id: c.cliente.client_id, refresh_token: t1.refresh_token })).rejects.toMatchObject({ codigo: 'invalid_grant' });
    await expect(c.svc.token({ grant_type: 'refresh_token', client_id: c.cliente.client_id, refresh_token: t2.refresh_token })).rejects.toMatchObject({ codigo: 'invalid_grant' });
  });

  it('un refresh que no existe, vencido o de otro cliente no sirve', async () => {
    const c = await conectar();
    const t = await canje(c);
    const otro = c.svc.registrarCliente({ redirect_uris: [CLAUDE] });
    await expect(c.svc.token({ grant_type: 'refresh_token', client_id: c.cliente.client_id, refresh_token: 'inventado' })).rejects.toMatchObject({ codigo: 'invalid_grant' });
    await expect(c.svc.token({ grant_type: 'refresh_token', client_id: otro.client_id, refresh_token: t.refresh_token })).rejects.toMatchObject({ codigo: 'invalid_grant' });
    c.prisma.marketingMcpRefresh.filas[0].expiraAt = new Date(Date.now() - 1000);
    await expect(c.svc.token({ grant_type: 'refresh_token', client_id: c.cliente.client_id, refresh_token: t.refresh_token })).rejects.toMatchObject({ codigo: 'invalid_grant' });
  });

  it('si el superadmin deja de serlo, ni el refresh ni el token de acceso sirven más', async () => {
    const c = await conectar();
    const t = await canje(c);
    c.estado.admin = { ...c.estado.admin!, isActive: false } as never;
    await expect(c.svc.verificarAcceso(t.access_token)).rejects.toBeInstanceOf(AccesoDenegadoError);
    await expect(c.svc.token({ grant_type: 'refresh_token', client_id: c.cliente.client_id, refresh_token: t.refresh_token })).rejects.toMatchObject({ codigo: 'invalid_grant' });
  });

  it('revocarTodo desconecta todos los Claude del superadmin', async () => {
    const c = await conectar();
    const t = await canje(c);
    await expect(c.svc.revocarTodo('admin-1')).resolves.toEqual({ revocados: 1 });
    await expect(c.svc.token({ grant_type: 'refresh_token', client_id: c.cliente.client_id, refresh_token: t.refresh_token })).rejects.toMatchObject({ codigo: 'invalid_grant' });
  });
});

describe('tokens ajenos al conector', () => {
  it('un token de la sesión del panel (firmado con JWT_SECRET) no sirve en el conector', async () => {
    const { svc } = armar();
    const panel = jwt.sign({ type: 'platform_admin' }, SECRETO, { subject: 'admin-1', audience: MCP, issuer: 'https://api.orbita.site', expiresIn: 3600 });
    await expect(svc.verificarAcceso(panel)).rejects.toMatchObject({ codigo: 'invalid_token', status: 401 });
  });
  it('un token del conector no se acepta con otra audiencia ni vencido', async () => {
    const c = await conectar();
    const t = await c.svc.token({ grant_type: 'authorization_code', client_id: c.cliente.client_id, code: c.code!, code_verifier: c.p.verifier, redirect_uri: CLAUDE });
    const otraAudiencia = armar();
    otraAudiencia.env.MCP_PUBLIC_URL = 'https://otro.example.com';
    await expect(otraAudiencia.svc.verificarAcceso(t.access_token)).rejects.toMatchObject({ codigo: 'invalid_token' });
    await expect(c.svc.verificarAcceso('basura')).rejects.toMatchObject({ codigo: 'invalid_token' });
  });
});
