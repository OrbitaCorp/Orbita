import { Body, Controller, ForbiddenException, Get, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { MercadopagoService } from './mercadopago.service';
import { CreateMpOrderDto } from './dto/create-mp-order.dto';

// `express` es solo dependencia transitiva — mismo motivo que en
// google-auth.controller.ts, evita sumarla como dependencia directa.
interface RedirectableResponse {
  redirect(url: string): void;
}

const PANEL_ERROR_PARAM = 'mp=error';

@Controller('mercadopago')
export class MercadopagoController {
  private readonly frontendUrl: string;

  constructor(
    private readonly mercadopagoService: MercadopagoService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
  }

  @Get('oauth/connect')
  @Roles('owner', 'admin')
  connect(@CurrentBusiness() auth: AuthContext) {
    if (auth?.type !== 'member') throw new ForbiddenException();
    const authUrl = this.mercadopagoService.getAuthorizationUrl(auth.businessId);
    return { authUrl };
  }

  @Get('oauth/callback')
  @Public()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: RedirectableResponse,
  ): Promise<void> {
    try {
      if (!code) throw new Error('Falta el code de Mercado Pago');
      const { subdomain } = await this.mercadopagoService.handleCallback(code, state);
      res.redirect(`${this.frontendUrl}/admin/${subdomain}/ventas/configuracion?mp=connected`);
    } catch {
      // El state firmado ya trae el businessId, pero si falló ANTES de poder
      // verificarlo (o el negocio no existe más) no hay a dónde volver con
      // certeza — cae al apex con el error, más seguro que adivinar un slug.
      res.redirect(`${this.frontendUrl}/login?${PANEL_ERROR_PARAM}`);
    }
  }

  @Post('oauth/disconnect')
  @Roles('owner', 'admin')
  disconnect(@CurrentBusiness() auth: AuthContext) {
    if (auth?.type !== 'member') throw new ForbiddenException();
    return this.mercadopagoService.disconnect(auth.businessId);
  }

  @Get('status')
  status(@CurrentBusiness() auth: AuthContext) {
    if (auth?.type !== 'member') throw new ForbiddenException();
    return this.mercadopagoService.getStatus(auth.businessId);
  }

  @Post('orders')
  createMpOrder(@Body() dto: CreateMpOrderDto) {
    void this.mercadopagoService;
    void dto;
    return { message: 'not implemented' };
  }
}
