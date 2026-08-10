import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UnprocessableEntityException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { StorefrontService } from './storefront.service';
import { OrdersService } from '../orders/orders.service';
import { CheckoutDto } from './dto/checkout.dto';
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

  // Ya NO es @Public(): el checkout necesita saber a qué CLIENTE pertenece el
  // pedido (para que "Mis pedidos" lo muestre y para poder validar de quién
  // es la dirección de envío) — AuthGuard exige un token válido de acá en
  // adelante, y abajo se confirma que sea de tipo cliente.
  @Post(':slug/checkout')
  @FullModeOnly()
  async checkout(@Param('slug') slug: string, @Body() dto: CheckoutDto, @CurrentUser() ctx?: AuthContext) {
    if (!ctx) throw new ForbiddenException('Necesitás iniciar sesión para comprar');
    const { customerId, businessId } = assertCustomerContext(ctx);

    // El slug de la URL y el negocio del token tienen que ser el mismo —
    // mismo criterio de aislamiento multi-tenant que el resto del proyecto
    // (un token de otra tienda no puede colarse acá con la URL de esta).
    const businessIdDelSlug = await this.storefrontService.resolveBusinessId(slug);
    if (businessIdDelSlug !== businessId) throw new ForbiddenException('Negocio no encontrado');

    await this.storefrontService.assertBusinessOperativo(businessId);

    if (dto.shippingAddressId) {
      await this.storefrontService.assertAddressBelongsToCustomer(dto.shippingAddressId, customerId);
    }

    // Nunca se confía en qué método de pago dice el cliente que puede usar —
    // se valida contra lo que el negocio activó de verdad en Configuración.
    // MERCADOPAGO nunca está habilitado acá: sin la conexión OAuth real (fase
    // separada, ver comentario en StorefrontService.getConfig) no hay forma
    // de procesar ese pago, así que ofrecerlo sería mentirle al cliente.
    const pago = await this.storefrontService.getPaymentConfig(businessId);
    const habilitado: Record<string, boolean> = {
      MERCADOPAGO: false,
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

    return this.ordersService.create(businessId, {
      channel: 'ONLINE',
      customerId,
      items: dto.items,
      buyer: dto.buyer,
      shippingAddressId: dto.shippingAddressId,
      discountCode: dto.couponCode,
      manualDiscountPercent,
      // TODO: falta una columna dedicada para el método de pago elegido —
      // por ahora queda en notes, legible por el dueño en el detalle del
      // pedido. Documentado en Jira (RBT-619).
      notes: `Método de pago elegido: ${ETIQUETA_METODO[dto.paymentMethod] ?? dto.paymentMethod}.`,
    });
  }

  @Get(':slug/orders/:orderNumber/tracking')
  @Public()
  @FullModeOnly()
  tracking(@Param('slug') slug: string, @Param('orderNumber') orderNumber: string) {
    void this.storefrontService;
    return { message: 'not implemented' };
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
