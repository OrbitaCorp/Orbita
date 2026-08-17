import { Body, Controller, ForbiddenException, Get, Headers, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
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
  // checkout online del storefront. Con sesión de cliente, solo puede pedir
  // la preferencia de SU PROPIO pedido: findOneForCustomer ya tira 404 si el
  // pedido no es suyo o no es de este negocio, antes de tocar nada de MP.
  //
  // @OptionalAuth() (2026-08-14, guest checkout) — NO @Public(): ese salta el
  // AuthGuard entero y ni siquiera procesa un Bearer válido si vino uno,
  // dejando `ctx` siempre undefined (bug encontrado en la verificación de
  // esta entrega — ver auth.guard.ts). Con sesión de cliente, sigue exigiendo
  // que el pedido sea SUYO (findOneForCustomer). Sin sesión, la única "prueba
  // de pertenencia" disponible es conocer el orderId — un UUID al azar que
  // checkout() le devolvió al navegador hace instantes, mismo modelo de
  // confianza que usa la mayoría de los e-commerce para el redirect de pago
  // inmediatamente posterior al checkout. resolveAnonymousOrderBusinessId()
  // 404-ea (nunca 403) para cualquier pedido que SÍ tenga customerId, así que
  // un invitado nunca puede tocar el pedido de un cliente real ni adivinando
  // el id.
  @Post('orders')
  @OptionalAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createMpOrder(
    @CurrentUser() ctx: AuthContext | undefined,
    @Body() dto: CreateMpOrderDto,
    // Header de browser, no un campo del body: nunca lo puede pisar JS de la
    // página (a diferencia de un campo del JSON) — se usa para que MP
    // redirija de vuelta al mismo host desde el que se abrió el checkout
    // (subdominio real O el host de un preview/deploy), en vez de siempre
    // volver al FRONTEND_URL fijo — ver createOrderPreference() para la
    // validación contra el negocio antes de confiar en este valor.
    @Headers('origin') origin: string | undefined,
  ) {
    if (ctx) {
      const { customerId, businessId } = assertCustomerContext(ctx);
      await this.ordersService.findOneForCustomer(businessId, customerId, dto.orderId);
      return this.mercadopagoService.createOrderPreference(businessId, dto.orderId, origin);
    }
    const businessId = await this.ordersService.resolveAnonymousOrderBusinessId(dto.orderId);
    return this.mercadopagoService.createOrderPreference(businessId, dto.orderId, origin);
  }
}
