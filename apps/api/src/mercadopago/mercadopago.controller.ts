import { Body, Controller, ForbiddenException, Get, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { MercadopagoService } from './mercadopago.service';
import { OrdersService } from '../orders/orders.service';
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
    private readonly ordersService: OrdersService,
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

  // Point (deviceId) sigue sin implementar — este endpoint hoy solo cubre el
  // checkout online del storefront. Solo un cliente autenticado puede pedir
  // la preferencia de SU PROPIO pedido: findOneForCustomer ya tira 404 si el
  // pedido no es suyo o no es de este negocio, antes de tocar nada de MP.
  @Post('orders')
  async createMpOrder(@CurrentUser() ctx: AuthContext, @Body() dto: CreateMpOrderDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    await this.ordersService.findOneForCustomer(businessId, customerId, dto.orderId);
    return this.mercadopagoService.createOrderPreference(businessId, dto.orderId);
  }
}
