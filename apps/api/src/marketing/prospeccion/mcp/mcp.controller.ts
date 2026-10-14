import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { SoloSuperadmin } from '../../../common/decorators/platform-role.decorator';
import { PlatformAdminContext } from '../../../common/types/auth-context.type';
import { ProspeccionService } from '../prospeccion.service';
import { McpProspeccion } from './mcp-prospeccion';
import { AccesoDenegadoError, McpOauthService, OAuthError } from './mcp-oauth.service';

// Lo mínimo de la respuesta de Express (`express` es solo dependencia transitiva, como en tiktok.controller.ts).
interface Respuesta {
  status(code: number): Respuesta;
  json(body: unknown): void;
  setHeader(nombre: string, valor: string): void;
  redirect(url: string): void;
  send(body?: string): void;
}

interface RequestConAdmin {
  user: PlatformAdminContext;
}

const SIN_CACHE = 'no-store';

function errorOauth(res: Respuesta, e: OAuthError) {
  res.setHeader('Cache-Control', SIN_CACHE);
  res.status(e.status).json({ error: e.codigo, error_description: e.message });
}

// ── Descubrimiento (público, en la raíz del dominio: se excluye del prefijo api/v1 en main.ts) ──────────────────

@Public()
@SkipThrottle()
@Controller()
export class McpDescubrimientoController {
  constructor(private readonly oauth: McpOauthService) {}

  @Get('.well-known/oauth-protected-resource/api/v1/mcp/prospeccion')
  recurso() {
    return this.oauth.metadataRecurso();
  }

  @Get('.well-known/oauth-protected-resource')
  recursoRaiz() {
    return this.oauth.metadataRecurso();
  }

  @Get('.well-known/oauth-authorization-server')
  servidor() {
    return this.oauth.metadataServidor();
  }
}

// ── OAuth (público: lo llama Claude y el navegador de la persona) ───────────────────────────────────────────────

@Public()
@SkipThrottle()
@Controller('mcp/oauth')
export class McpOauthController {
  constructor(private readonly oauth: McpOauthService) {}

  @Post('register')
  @HttpCode(201)
  registrar(@Body() body: Record<string, unknown>, @Res() res: Respuesta) {
    try {
      res.setHeader('Cache-Control', SIN_CACHE);
      res.status(201).json(this.oauth.registrarCliente(body ?? {}));
    } catch (e) {
      if (e instanceof OAuthError) return errorOauth(res, e);
      throw e;
    }
  }

  // La persona llega acá desde Claude con el navegador: se valida el pedido y se la manda al panel a aprobar.
  @Get('authorize')
  autorizar(@Query() q: Record<string, string | undefined>, @Res() res: Respuesta) {
    try {
      res.setHeader('Cache-Control', SIN_CACHE);
      res.redirect(this.oauth.iniciarAutorizacion(q));
    } catch (e) {
      if (!(e instanceof OAuthError)) throw e;
      // Si el cliente o su dirección de retorno son inválidos no se redirige a ningún lado: se muestra el error.
      if (!e.redirigible) return errorOauth(res, e);
      const u = new URL(q.redirect_uri!);
      u.searchParams.set('error', e.codigo);
      u.searchParams.set('error_description', e.message);
      if (q.state) u.searchParams.set('state', q.state);
      res.redirect(u.toString());
    }
  }

  @Post('token')
  @HttpCode(200)
  async token(@Body() body: Record<string, string | undefined>, @Res() res: Respuesta) {
    try {
      res.setHeader('Cache-Control', SIN_CACHE);
      res.setHeader('Pragma', 'no-cache');
      res.status(200).json(await this.oauth.token(body ?? {}));
    } catch (e) {
      if (e instanceof OAuthError) return errorOauth(res, e);
      throw e;
    }
  }
}

// ── Consentimiento (lo usa la página del panel, con la sesión del superadmin) ───────────────────────────────

@UseGuards(PlatformAdminGuard)
@SoloSuperadmin()
@Controller('platform/mcp')
export class McpConsentimientoController {
  constructor(private readonly oauth: McpOauthService) {}

  // Los errores de OAuth y de acceso no son HttpException: se traducen para que la página muestre el motivo
  // (si no, el filtro global los devuelve como un 500 genérico).
  private async traducir<T>(accion: () => T | Promise<T>): Promise<T> {
    try {
      return await accion();
    } catch (e) {
      if (e instanceof OAuthError) throw new BadRequestException(e.message);
      if (e instanceof AccesoDenegadoError) throw new ForbiddenException(e.message);
      throw e;
    }
  }

  @Get('solicitud')
  solicitud(@Req() req: RequestConAdmin, @Query('req') solicitud?: string) {
    return this.traducir(async () => {
      const detalle = this.oauth.detalleSolicitud(solicitud ?? '');
      const admin = await this.oauth.adminAutorizado(req.user.adminId);
      return { ...detalle, usuario: admin.email };
    });
  }

  @Post('resolver')
  @HttpCode(200)
  resolver(@Req() req: RequestConAdmin, @Body() body: { req?: string; decision?: string }) {
    return this.traducir(() => this.oauth.resolverSolicitud(req.user.adminId, body.req ?? '', body.decision === 'aprobar' ? 'aprobar' : 'cancelar'));
  }

  // Desconecta a Claude de TU cuenta en todos lados (los que se conectaron con tu usuario).
  @Delete('conexiones')
  desconectar(@Req() req: RequestConAdmin) {
    return this.oauth.revocarTodo(req.user.adminId);
  }
}

// ── El conector (Streamable HTTP, sin sesión) ───────────────────────────────────────────────────────────────

@Public()
@SkipThrottle()
@Controller('mcp/prospeccion')
export class McpController {
  private readonly protocolo: McpProspeccion;

  constructor(
    private readonly oauth: McpOauthService,
    prospeccion: ProspeccionService,
  ) {
    this.protocolo = new McpProspeccion(prospeccion);
  }

  private sinToken(res: Respuesta, motivo?: string) {
    res.setHeader('WWW-Authenticate', `Bearer realm="orbita-prospeccion", resource_metadata="${this.oauth.urlMetadataRecurso}"${motivo ? `, error="invalid_token"` : ''}`);
    res.status(401).json({ error: 'unauthorized', error_description: motivo ?? 'Falta autenticación' });
  }

  @Post()
  @HttpCode(200)
  async mensaje(@Headers('authorization') autorizacion: string | undefined, @Body() body: unknown, @Res() res: Respuesta) {
    const token = /^Bearer (.+)$/i.exec(autorizacion ?? '')?.[1];
    if (!token) return this.sinToken(res);
    let ctx: { adminId: string };
    try {
      ctx = await this.oauth.verificarAcceso(token);
    } catch (e) {
      if (e instanceof OAuthError) return this.sinToken(res, e.message);
      if (e instanceof AccesoDenegadoError) return void res.status(403).json({ error: 'forbidden', error_description: e.message });
      throw e;
    }
    res.setHeader('Cache-Control', SIN_CACHE);
    if (Array.isArray(body)) {
      const respuestas = (await Promise.all(body.map((m) => this.protocolo.manejar(m, ctx)))).filter((r) => r !== null);
      return respuestas.length ? void res.status(200).json(respuestas) : void res.status(202).send();
    }
    const r = await this.protocolo.manejar(body, ctx);
    return r ? void res.status(200).json(r) : void res.status(202).send();
  }

  // Este servidor no ofrece el canal de eventos del servidor al cliente: el protocolo permite contestar 405.
  @Get()
  noEventos(@Res() res: Respuesta) {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
  }

  @Delete()
  noSesiones(@Res() res: Respuesta) {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
  }
}
