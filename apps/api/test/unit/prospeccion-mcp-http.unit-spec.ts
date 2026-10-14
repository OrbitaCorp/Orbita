import { BadRequestException, ForbiddenException, INestApplication, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { createHash, randomBytes } from 'crypto';
import request from 'supertest';
import { AuthService } from '../../src/auth/auth.service';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { AuthGuard } from '../../src/common/guards/auth.guard';
import { McpConsentimientoController, McpController, McpDescubrimientoController, McpOauthController } from '../../src/marketing/prospeccion/mcp/mcp.controller';
import { AccesoDenegadoError, McpOauthService } from '../../src/marketing/prospeccion/mcp/mcp-oauth.service';
import { ProspeccionService } from '../../src/marketing/prospeccion/prospeccion.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// La capa HTTP del conector MCP, con Nest de verdad (rutas, prefijo api/v1, guard global de autenticación, filtro de
// errores) pero con la base y el servicio de prospección simulados. Verifica lo que Claude ve por la red.

const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
type Fila = Record<string, any>;
const coincide = (fila: Fila, where: Fila) => Object.entries(where).every(([k, v]) => (v !== null && typeof v === 'object' ? true : (fila[k] ?? null) === v));
function tabla() {
  const filas: Fila[] = [];
  return {
    filas,
    create: async ({ data }: { data: Fila }) => { const f = { id: `id-${filas.length + 1}`, ...data }; filas.push(f); return f; },
    findUnique: async ({ where }: { where: Fila }) => filas.find((f) => coincide(f, where)) ?? null,
    updateMany: async ({ where, data }: { where: Fila; data: Fila }) => { const hit = filas.filter((f) => coincide(f, where)); hit.forEach((f) => Object.assign(f, data)); return { count: hit.length }; },
    deleteMany: async () => ({ count: 0 }),
  };
}

describe('conector MCP por HTTP', () => {
  let app: INestApplication;
  let oauth: McpOauthService;
  const prospeccion = {
    criterio: jest.fn().mockReturnValue({ version: 'v1' }),
    listarLotes: jest.fn().mockResolvedValue([]),
    listarProspectos: jest.fn(),
    consultar: jest.fn(),
    obtenerLoteParaClaude: jest.fn(),
    guardarAnalisis: jest.fn(),
  };

  beforeAll(async () => {
    const prisma = {
      marketingMcpCodigo: tabla(),
      marketingMcpRefresh: tabla(),
      platformAdmin: { findUnique: async () => ({ id: 'admin-1', email: 'mateo@orbita-corp.com', role: 'SUPERADMIN', isActive: true }) },
      platformAdminLog: { create: async () => ({}) },
    };
    const env: Record<string, string> = { JWT_SECRET: 'x'.repeat(40) };
    const modulo = await Test.createTestingModule({
      controllers: [McpController, McpOauthController, McpDescubrimientoController, McpConsentimientoController],
      providers: [
        McpOauthService,
        { provide: ProspeccionService, useValue: prospeccion },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (k: string) => env[k], getOrThrow: (k: string) => env[k] } },
        { provide: AuthService, useValue: { verifyToken: () => { throw new Error('token inválido'); } } },
        { provide: APP_GUARD, useClass: AuthGuard }, // el guard global de la app real
      ],
    }).compile();
    app = modulo.createNestApplication();
    // Igual que main.ts
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: '.well-known/oauth-authorization-server', method: RequestMethod.GET },
        { path: '.well-known/oauth-protected-resource', method: RequestMethod.GET },
        { path: '.well-known/oauth-protected-resource/api/v1/mcp/prospeccion', method: RequestMethod.GET },
      ],
    });
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    oauth = app.get(McpOauthService);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('descubrimiento', () => {
    it('las metadata están en la raíz del dominio, sin autenticación', async () => {
      const as = await http().get('/.well-known/oauth-authorization-server').expect(200);
      expect(as.body).toMatchObject({ issuer: 'https://api.orbita.site', code_challenge_methods_supported: ['S256'] });
      const rec = await http().get('/.well-known/oauth-protected-resource/api/v1/mcp/prospeccion').expect(200);
      expect(rec.body).toMatchObject({ resource: 'https://api.orbita.site/api/v1/mcp/prospeccion', authorization_servers: ['https://api.orbita.site'] });
      await http().get('/.well-known/oauth-protected-resource').expect(200);
    });
    it('y NO cuelgan de api/v1', async () => {
      await http().get('/api/v1/.well-known/oauth-authorization-server').expect(404);
    });
  });

  describe('sin autenticación', () => {
    it('el conector responde 401 con el encabezado que le dice a Claude dónde está la metadata', async () => {
      const r = await http().post('/api/v1/mcp/prospeccion').send({ jsonrpc: '2.0', id: 1, method: 'ping' }).expect(401);
      expect(r.headers['www-authenticate']).toContain('resource_metadata="https://api.orbita.site/.well-known/oauth-protected-resource/api/v1/mcp/prospeccion"');
    });
    it('un token inválido también es 401 y lo marca como invalid_token', async () => {
      const r = await http().post('/api/v1/mcp/prospeccion').set('Authorization', 'Bearer basura').send({ jsonrpc: '2.0', id: 1, method: 'ping' }).expect(401);
      expect(r.headers['www-authenticate']).toContain('invalid_token');
    });
    it('GET y DELETE responden 405: no hay canal de eventos ni sesiones', async () => {
      const g = await http().get('/api/v1/mcp/prospeccion').expect(405);
      expect(g.headers.allow).toBe('POST');
      await http().delete('/api/v1/mcp/prospeccion').expect(405);
    });
    it('las rutas de consentimiento del panel exigen sesión de superadmin', async () => {
      await http().get('/api/v1/platform/mcp/solicitud?req=x').expect(401);
      await http().post('/api/v1/platform/mcp/resolver').send({ req: 'x', decision: 'aprobar' }).expect(401);
      await http().delete('/api/v1/platform/mcp/conexiones').expect(401);
    });
  });

  describe('registro y autorización', () => {
    it('registra a Claude (201) y rechaza una dirección ajena con el formato de error de OAuth', async () => {
      const ok = await http().post('/api/v1/mcp/oauth/register').send({ redirect_uris: [CLAUDE], client_name: 'Claude' }).expect(201);
      expect(ok.body.client_id).toBeTruthy();
      const mal = await http().post('/api/v1/mcp/oauth/register').send({ redirect_uris: ['https://evil.example.com/cb'] }).expect(400);
      expect(mal.body).toMatchObject({ error: 'invalid_redirect_uri' });
    });

    it('authorize manda al panel; con una dirección ajena responde 400 sin redirigir; con otro error, redirige al cliente', async () => {
      const { body: c } = await http().post('/api/v1/mcp/oauth/register').send({ redirect_uris: [CLAUDE] });
      const challenge = createHash('sha256').update(randomBytes(32)).digest('base64url');
      const base = { response_type: 'code', client_id: c.client_id, redirect_uri: CLAUDE, code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz' };
      const bien = await http().get('/api/v1/mcp/oauth/authorize').query(base).expect(302);
      expect(bien.headers.location).toMatch(/^https:\/\/orbita\.site\/superadmin\/conectar-claude\?req=/);
      const ajena = await http().get('/api/v1/mcp/oauth/authorize').query({ ...base, redirect_uri: 'https://evil.example.com/cb' }).expect(400);
      expect(ajena.headers.location).toBeUndefined();
      const sinPkce = await http().get('/api/v1/mcp/oauth/authorize').query({ ...base, code_challenge: undefined }).expect(302);
      const vuelta = new URL(sinPkce.headers.location);
      expect(`${vuelta.origin}${vuelta.pathname}`).toBe(CLAUDE);
      expect(vuelta.searchParams.get('error')).toBe('invalid_request');
      expect(vuelta.searchParams.get('state')).toBe('xyz');
    });
  });

  describe('el flujo completo, como lo hace Claude', () => {
    it('registro → autorización → aprobación en el panel → token (formulario) → conector → renovación', async () => {
      const { body: c } = await http().post('/api/v1/mcp/oauth/register').send({ redirect_uris: [CLAUDE], client_name: 'Claude' });
      const verifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const red = await http().get('/api/v1/mcp/oauth/authorize').query({ response_type: 'code', client_id: c.client_id, redirect_uri: CLAUDE, code_challenge: challenge, code_challenge_method: 'S256', state: 'st', resource: 'https://api.orbita.site/api/v1/mcp/prospeccion' }).expect(302);
      const req = new URL(red.headers.location).searchParams.get('req')!;
      // La persona aprueba en el panel (esa llamada lleva su sesión; acá se invoca el servicio que ejecuta):
      const { redirect } = await oauth.resolverSolicitud('admin-1', req, 'aprobar');
      const code = new URL(redirect).searchParams.get('code')!;

      const tok = await http().post('/api/v1/mcp/oauth/token').type('form')
        .send({ grant_type: 'authorization_code', client_id: c.client_id, code, code_verifier: verifier, redirect_uri: CLAUDE }).expect(200);
      expect(tok.headers['cache-control']).toBe('no-store');
      expect(tok.body).toMatchObject({ token_type: 'Bearer', expires_in: 3600 });

      const auth = { Authorization: `Bearer ${tok.body.access_token}` };
      const ini = await http().post('/api/v1/mcp/prospeccion').set(auth).send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }).expect(200);
      expect(ini.body.result.serverInfo.name).toBe('orbita-prospeccion');
      const lista = await http().post('/api/v1/mcp/prospeccion').set(auth).send({ jsonrpc: '2.0', id: 2, method: 'tools/list' }).expect(200);
      expect(lista.body.result.tools).toHaveLength(6);
      await http().post('/api/v1/mcp/prospeccion').set(auth).send({ jsonrpc: '2.0', method: 'notifications/initialized' }).expect(202);
      const lote = await http().post('/api/v1/mcp/prospeccion').set(auth).send([{ jsonrpc: '2.0', id: 3, method: 'ping' }, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'prospeccion_criterio' } }]).expect(200);
      expect(lote.body.map((r: { id: number }) => r.id)).toEqual([3, 4]);
      expect(prospeccion.criterio).toHaveBeenCalled();

      // El código no se puede canjear dos veces, y el error tiene el formato de OAuth
      const repetido = await http().post('/api/v1/mcp/oauth/token').type('form')
        .send({ grant_type: 'authorization_code', client_id: c.client_id, code, code_verifier: verifier, redirect_uri: CLAUDE }).expect(400);
      expect(repetido.body).toMatchObject({ error: 'invalid_grant' });

      // Renovación
      const nuevo = await http().post('/api/v1/mcp/oauth/token').type('form')
        .send({ grant_type: 'refresh_token', client_id: c.client_id, refresh_token: tok.body.refresh_token }).expect(200);
      expect(nuevo.body.refresh_token).not.toBe(tok.body.refresh_token);
    });

    it('la página de consentimiento recibe el motivo como 400 / 403, no un 500 genérico', async () => {
      const consentimiento = app.get(McpConsentimientoController);
      const ctx = { user: { adminId: 'admin-1' } } as never;
      await expect(consentimiento.solicitud(ctx, 'vencida')).rejects.toBeInstanceOf(BadRequestException);
      await expect(consentimiento.resolver(ctx, { req: 'vencida', decision: 'aprobar' })).rejects.toMatchObject({ message: expect.stringContaining('venció') });
      const { body: c } = await http().post('/api/v1/mcp/oauth/register').send({ redirect_uris: [CLAUDE] });
      const challenge = createHash('sha256').update('x').digest('base64url');
      const red = await http().get('/api/v1/mcp/oauth/authorize').query({ response_type: 'code', client_id: c.client_id, redirect_uri: CLAUDE, code_challenge: challenge, code_challenge_method: 'S256' }).expect(302);
      const req = new URL(red.headers.location).searchParams.get('req')!;
      const ok: any = await consentimiento.solicitud(ctx, req);
      expect(ok).toMatchObject({ usuario: 'mateo@orbita-corp.com', retorno: 'claude.ai' });
      jest.spyOn(oauth, 'adminAutorizado').mockRejectedValueOnce(new AccesoDenegadoError('Solo un superadmin'));
      await expect(consentimiento.solicitud(ctx, req)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un client_id que no es de este servidor da 401 invalid_client: Claude se vuelve a registrar', async () => {
      const r = await http().post('/api/v1/mcp/oauth/token').type('form').send({ grant_type: 'refresh_token', client_id: 'inventado', refresh_token: 'x' }).expect(401);
      expect(r.body).toMatchObject({ error: 'invalid_client' });
    });
  });
});
