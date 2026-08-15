import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UnprocessableEntityException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { StorefrontService } from './storefront.service';
import { OrdersService } from '../orders/orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { ValidateCartDto } from './dto/validate-cart.dto';
import { StorefrontProductsQueryDto } from './dto/storefront-products-query.dto';

@Controller('storefront')
export class StorefrontController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get(':slug')
  @Public()
  config(@Param('slug') slug: string) {
    return this.storefrontService.getConfig(slug);
  }

  @Get(':slug/products')
  @Public()
  products(@Param('slug') slug: string, @Query() query: StorefrontProductsQueryDto) {
    return this.storefrontService.listProducts(slug, query);
  }

  @Get(':slug/products/:id')
  @Public()
  productDetail(@Param('slug') slug: string, @Param('id') id: string) {
    return this.storefrontService.getProduct(slug, id);
  }

  @Get(':slug/categories')
  @Public()
  categories(@Param('slug') slug: string) {
    return this.storefrontService.listCategories(slug);
  }

  // @OptionalAuth() (2026-08-14, no @Public()): comprar sin cuenta es un flujo
  // válido — el carrito ya vive sin sesión (localStorage), así que forzar
  // login recién acá era el único punto que lo impedía. OJO con @Public():
  // ese salta el AuthGuard entero y NUNCA lee el header, así que un Bearer
  // válido tampoco se procesaría — se necesita @OptionalAuth() específicamente
  // para que `ctx` siga poblándose cuando SÍ hay sesión (bug encontrado en la
  // verificación de esta misma entrega). Con token de cliente, `customerId`
  // se resuelve igual que antes (mismo chequeo de aislamiento multi-tenant y
  // de ownership de `shippingAddressId` — ESO no cambió); sin sesión,
  // `customerId` queda en null y el pedido nace "anónimo" — mismo concepto
  // que ya existe para las ventas de mostrador (Order.customerId nullable,
  // comentado en el schema como "venta anónima (POS)"). Un invitado NO puede
  // mandar `shippingAddressId` (no hay Customer al que colgarle un Address):
  // se coordina por WhatsApp después de confirmar.
  @Post(':slug/checkout')
  @OptionalAuth()
  @FullModeOnly()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async checkout(@Param('slug') slug: string, @Body() dto: CheckoutDto, @CurrentUser() ctx?: AuthContext) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);

    let customerId: string | null = null;
    if (ctx) {
      const asserted = assertCustomerContext(ctx);
      // El slug de la URL y el negocio del token tienen que ser el mismo —
      // mismo criterio de aislamiento multi-tenant que el resto del proyecto
      // (un token de otra tienda no puede colarse acá con la URL de esta).
      if (asserted.businessId !== businessId) throw new ForbiddenException('Negocio no encontrado');
      customerId = asserted.customerId;
    }

    await this.storefrontService.assertBusinessOperativo(businessId);

    if (dto.shippingAddressId) {
      if (!customerId) {
        throw new UnprocessableEntityException(
          'Guardar una dirección de envío requiere iniciar sesión — como invitado, coordinamos el envío por WhatsApp después de confirmar el pedido.',
        );
      }
      await this.storefrontService.assertAddressBelongsToCustomer(dto.shippingAddressId, customerId);
    }

    // Nunca se confía en qué método de pago dice el cliente que puede usar —
    // se valida contra lo que el negocio activó de verdad en Configuración.
    // MERCADOPAGO exige, además del toggle, la conexión OAuth real (Fase 8).
    const pago = await this.storefrontService.getPaymentConfig(businessId);
    const habilitado: Record<string, boolean> = {
      MERCADOPAGO: await this.storefrontService.isMercadopagoAvailable(businessId, pago.acceptsMercadopago),
      CASH: pago.acceptsCash,
      TRANSFER: pago.acceptsTransfer,
      PICKUP: pago.acceptsPickup,
    };
    if (!habilitado[dto.paymentMethod]) {
      throw new UnprocessableEntityException('Ese método de pago no está disponible en esta tienda');
    }

    const manualDiscountPercent =
      dto.paymentMethod === 'CASH' && pago.cashDiscountPercent != null
        ? Number(pago.cashDiscountPercent)
        : undefined;

    const ETIQUETA_METODO: Record<string, string> = {
      CASH: 'Efectivo', TRANSFER: 'Transferencia', PICKUP: 'Retiro en local', MERCADOPAGO: 'Mercado Pago',
    };

    return this.ordersService.create(
      businessId,
      {
        channel: 'ONLINE',
        customerId: customerId ?? undefined,
        items: dto.items,
        buyer: dto.buyer,
        shippingAddressId: dto.shippingAddressId,
        discountCode: dto.couponCode,
        manualDiscountPercent,
        // TODO: falta una columna dedicada para el método de pago elegido —
        // por ahora queda en notes, legible por el dueño en el detalle del
        // pedido. Documentado en Jira (RBT-619).
        notes: `Método de pago elegido: ${ETIQUETA_METODO[dto.paymentMethod] ?? dto.paymentMethod}.`,
      },
      { publicCheckout: true },
    );
  }

  // Seguimiento/confirmación de UN pedido sin exigir sesión (guest checkout,
  // 2026-08-14) — indexado por id (UUID), no por orderNumber: es lo que el
  // frontend ya tiene a mano apenas termina checkout() o vuelve de Mercado
  // Pago (ver el `volverA` en mercadopago.service.ts). @OptionalAuth() (no
  // @Public(), mismo motivo que checkout() arriba): un cliente logueado pasa
  // por su propio customerId (no necesita `email`); un invitado tiene que
  // mandar el mismo email que usó al comprar — findOneForTracking() 404-ea
  // en cualquier mismatch, nunca revela que el id existe pero es de otro.
  @Get(':slug/orders/:id/tracking')
  @OptionalAuth()
  @FullModeOnly()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async tracking(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Query('email') email: string | undefined,
    @CurrentUser() ctx?: AuthContext,
  ) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    const customerId = ctx?.type === 'customer' && ctx.businessId === businessId ? ctx.customerId : undefined;
    return this.ordersService.findOneForTracking(businessId, id, { customerId, email });
  }

  // Público a propósito: el carrito vive en localStorage sin sesión (ni
  // siquiera hace falta estar logueado para tenerlo armado) — revalidarlo es
  // el paso previo a mostrar el checkout, no algo que dependa de una cuenta.
  @Post(':slug/cart/validate')
  @Public()
  @FullModeOnly()
  validateCart(@Param('slug') slug: string, @Body() dto: ValidateCartDto) {
    return this.storefrontService.validateCart(slug, dto.items);
  }

  @Get(':slug/coupons')
  @Public()
  @FullModeOnly()
  coupons(@Param('slug') slug: string) {
    return this.storefrontService.listCoupons(slug);
  }

  @Get(':slug/exclusive-discount/:code')
  @Public()
  @FullModeOnly()
  exclusiveDiscount(@Param('slug') slug: string, @Param('code') code: string) {
    return this.storefrontService.exclusiveDiscount(slug, code);
  }
}
