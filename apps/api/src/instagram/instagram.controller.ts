import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Logger, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { describeError } from '../common/utils/describe-error.util';
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
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
  }

  @Get('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async estado(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.instagram.estado(businessId);
  }

  // Devuelve la dirección del login de Instagram: el panel redirige ahí al dueño.
  @Post('connect')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async conectar(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(member.businessId);
    return { url: this.instagram.urlDeAutorizacion(member.businessId, member.memberId) };
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
      const { subdomain, suscripta } = await this.instagram.manejarCallback(code.replace(/#_$/, ''), state);
      res.redirect(`${this.frontendUrl}/admin/${subdomain}/ventas/mensajes?ig=${suscripta ? 'conectado' : 'sin-suscripcion'}`);
    } catch (e) {
      // Sin negocio verificable no hay a dónde volver con certeza: cae al login.
      this.logger.warn(`Conexión de Instagram fallida: ${describeError(e)}`);
      res.redirect(`${this.frontendUrl}/login?ig=error`);
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
