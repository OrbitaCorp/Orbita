import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { describeError } from '../common/utils/describe-error.util';
import { ConectarInstagramDto } from './dto/conectar-instagram.dto';
import { PublicarInstagramDto } from './dto/publicar-instagram.dto';
import { SolicitarAccesoDto } from './dto/solicitar-acceso.dto';
import { InstagramPublicacionesService } from './instagram-publicaciones.service';
import { InstagramService } from './instagram.service';

// `express` es solo dependencia transitiva — mismo motivo que en
// mercadopago.controller.ts.
interface RedirectableResponse {
  redirect(url: string): void;
}

// Conexión de Instagram del negocio, desde el panel. Conectar y desconectar son
// cosa de propietario/admin (igual que WhatsApp y Mercado Pago): cambian a dónde
// llegan los mensajes de los clientes.
@Controller('instagram')
export class InstagramController {
  private readonly logger = new Logger(InstagramController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly instagram: InstagramService,
    private readonly publicaciones: InstagramPublicacionesService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
  }

  // Historial de lo publicado desde Órbita (Difusión → Publicaciones).
  @Get('posts')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async historial(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.publicaciones.listar(businessId);
  }

  // Publica en Instagram la foto de un producto con el texto que escribió el dueño. Es una acción con
  // efecto afuera de Órbita (queda a la vista de los seguidores): solo propietario/admin.
  @Post('posts')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async publicar(@CurrentBusiness() ctx: AuthContext, @Body() dto: PublicarInstagramDto) {
    const { businessId, memberId } = assertMemberContext(ctx);
    return this.publicaciones.publicarProducto(businessId, memberId, dto.productId, dto.caption);
  }

  @Get('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async estado(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    // Sin acceso todavía no es un error: el panel muestra "pedir acceso anticipado".
    return this.instagram.estadoParaPanel(businessId);
  }

  // El dueño deja su @usuario para que el equipo lo sume como evaluador de la app.
  @Post('access-request')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async pedirAcceso(@CurrentBusiness() ctx: AuthContext, @Body() dto: SolicitarAccesoDto) {
    const { businessId, memberId } = assertMemberContext(ctx);
    return this.instagram.solicitarAcceso(businessId, dto.username, memberId);
  }

  // Devuelve la dirección del login de Instagram: el panel redirige ahí al dueño.
  @Post('connect')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async conectar(@CurrentBusiness() ctx: AuthContext, @Req() req: { headers: { origin?: string } }, @Body() dto: ConectarInstagramDto) {
    const member = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(member.businessId);
    // El Origin del navegador dice desde qué dirección se está usando el panel: al terminar el login se
    // vuelve a ese mismo lugar, donde está la sesión.
    return { url: this.instagram.urlDeAutorizacion(member.businessId, member.memberId, req.headers.origin, dto?.seccion, dto?.permisos) };
  }

  @Delete('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async desconectar(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.instagram.desconectar(businessId);
  }

  // Vuelta del login: Instagram redirige acá sin sesión (el negocio viaja en el
  // `state` firmado). Siempre termina redirigiendo al panel, con el resultado.
  @Get('oauth/callback')
  @Public()
  @SkipThrottle()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: RedirectableResponse,
  ): Promise<void> {
    try {
      if (error || !code) throw new Error(error ?? 'Falta el code de Instagram');
      // Instagram agrega "#_" al final del code en algunos redirects.
      const { suscripta, retorno } = await this.instagram.manejarCallback(code.replace(/#_$/, ''), state);
      res.redirect(`${retorno}${retorno.includes('?') ? '&' : '?'}ig=${suscripta ? 'conectado' : 'sin-suscripcion'}`);
    } catch (e) {
      this.logger.warn(`Conexión de Instagram fallida: ${describeError(e)}`);
      // Con el state válido se sabe a qué negocio y a qué panel volver: se vuelve ahí y el modal explica qué
      // hacer. Sin negocio verificable no hay a dónde volver con certeza: cae al login.
      const retorno = await this.instagram.retornoDelState(state);
      res.redirect(retorno ? `${retorno}${retorno.includes('?') ? '&' : '?'}ig=error` : `${this.frontendUrl}/login?ig=error`);
    }
  }

  // "Desautorización": Instagram lo llama cuando el dueño quita la app desde su
  // cuenta (llega un signed_request firmado con el App Secret).
  @Post('deauthorize')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  async desautorizar(@Body() body: { signed_request?: string }) {
    if (!body?.signed_request) throw new ForbiddenException();
    await this.instagram.desautorizar(body.signed_request);
    return { ok: true };
  }
}
