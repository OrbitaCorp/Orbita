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
  // comentado en el schema como "venta anónima (POS)"). Un invitado SIGUE sin
  // poder mandar `shippingAddressId` (no hay Customer al que colgarle un
  // Address) — pero ahora sí puede pedir envío a domicilio, tipeando la
  // dirección a mano en `shippingAddress` (se guarda como snapshot en el
  // pedido, ver OrdersService.create()).
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

    // Se necesita antes para validar `carrier` contra lo que el negocio
    // habilitó de verdad (ver más abajo) — se sigue usando también para
    // validar el método de pago un poco más adelante.
    const pago = await this.storefrontService.getPaymentConfig(businessId);

    // Envío a domicilio vs. retiro en local — independiente del método de
    // pago (antes 'PICKUP' era un valor de `paymentMethod`, ver checkout.dto.ts).
    const esEnvioADomicilio = dto.shippingMethod === 'DELIVERY';
    if (esEnvioADomicilio) {
      if (dto.shippingAddressId) {
        if (!customerId) {
          throw new UnprocessableEntityException(
            'Guardar una dirección de envío requiere iniciar sesión — como invitado, cargá la dirección a mano.',
          );
        }
        await this.storefrontService.assertAddressBelongsToCustomer(dto.shippingAddressId, customerId);
      } else if (!dto.shippingAddress) {
        throw new UnprocessableEntityException(
          'Para envío a domicilio hace falta una dirección — elegí una guardada o cargá una nueva.',
        );
      }
      // Todavía no hay cotización real (ver Jira) — esto es solo la
      // preferencia del cliente sobre con quién coordinar el envío, pero con
      // domicilio sí o sí tiene que elegir uno.
      if (!dto.carrier) {
        throw new UnprocessableEntityException('Elegí con qué transportista coordinar el envío.');
      }
      // Nunca se confía en qué transportista dice el cliente que puede
      // elegir — igual criterio que con paymentMethod más abajo. Lista
      // vacía = todos habilitados (retrocompatible).
      if (pago.enabledCarriers.length && !pago.enabledCarriers.includes(dto.carrier)) {
        throw new UnprocessableEntityException('Ese transportista no está disponible en esta tienda');
      }
      // Con el transportista ya elegido, además: a domicilio o retira en una
      // sucursal DE ESE TRANSPORTISTA (distinto del "Retiro en local" de la
      // tienda, que es `shippingMethod === 'PICKUP'` de arriba). No aplica a
      // DELIVERY_APP (delivery local en moto/app): no tiene red de
      // sucursales propia, siempre es a domicilio.
      if (dto.carrier !== 'DELIVERY_APP' && !dto.carrierDeliveryMode) {
        throw new UnprocessableEntityException('Elegí si lo recibís a domicilio o en una sucursal del transportista.');
      }
    }
    // Con retiro en local, cualquier dirección que haya llegado (de un draft
    // viejo, por ejemplo) se ignora — nunca hace falta y nunca se valida.

    // Las notas de crédito son siempre de un Customer real (ver
    // ReturnsService.createForCustomer/createCreditNote) — un invitado nunca
    // puede tener ninguna, así que sin sesión ni intentamos resolverlas.
    if (dto.creditNoteIds?.length && !customerId) {
      throw new UnprocessableEntityException(
        'Para usar tus notas de crédito hace falta iniciar sesión.',
      );
    }
    // "Coordinar el pago después" es un flujo excluyente, no un método más:
    // si el negocio lo activó, no se acepta ningún otro (ni Mercado Pago, ni
    // Efectivo, ni "Coordinar por WhatsApp") — el checkout no le pregunta
    // nada al cliente sobre cómo pagar. Se ignora cualquier `paymentMethod`
    // que haya mandado el frontend (no debería mandar ninguno, pero nunca se
    // confía en eso) y se fuerza acá.
    const coordinarDespues = pago.acceptsCoordinateLater;
    const metodoEfectivo = coordinarDespues ? 'COORDINATE_LATER' : dto.paymentMethod;

    // Sin un método de pago Y sin notas de crédito no hay forma de cubrir el
    // pedido — salvo que el negocio tenga "coordinar el pago después"
    // activado, ahí no hace falta ninguno de los dos. Con notas de crédito
    // puede alcanzar solo (cubre el 100%) — eso se termina de confirmar en
    // OrdersService.create(), que es quien conoce el total real; acá solo se
    // descarta el caso obviamente incompleto.
    if (!coordinarDespues && !dto.paymentMethod && !dto.creditNoteIds?.length) {
      throw new UnprocessableEntityException(
        'Elegí un método de pago o aplicá una nota de crédito que cubra el total.',
      );
    }

    // Nunca se confía en qué método de pago dice el cliente que puede usar —
    // se valida contra lo que el negocio activó de verdad en Configuración.
    // MERCADOPAGO exige, además del toggle, la conexión OAuth real (Fase 8).
    // 'PICKUP' ya no es un método de pago acá (es `shippingMethod`). Estas
    // validaciones solo corren si SE ELIGIÓ un método de verdad — con notas
    // de crédito cubriendo todo, o con "coordinar después" activado, no hay
    // ninguno que validar. (`pago` ya se resolvió más arriba, para validar
    // `carrier`.)
    if (dto.shippingMethod === 'PICKUP' && !pago.acceptsPickup) {
      throw new UnprocessableEntityException('Esta tienda no ofrece retiro en local');
    }
    if (dto.paymentMethod && !coordinarDespues) {
      const habilitado: Record<string, boolean> = {
        MERCADOPAGO: await this.storefrontService.isMercadopagoAvailable(businessId, pago.acceptsMercadopago),
        CASH: pago.acceptsCash,
        TRANSFER: pago.acceptsTransfer,
      };
      if (!habilitado[dto.paymentMethod]) {
        throw new UnprocessableEntityException('Ese método de pago no está disponible en esta tienda');
      }
      // Efectivo solo tiene sentido pagando al retirar — con envío a domicilio
      // no hay nadie a quien pagarle en mano.
      if (dto.paymentMethod === 'CASH' && esEnvioADomicilio) {
        throw new UnprocessableEntityException('Efectivo solo está disponible para retiro en local');
      }
    }

    const manualDiscountPercent =
      metodoEfectivo === 'CASH' && pago.cashDiscountPercent != null
        ? Number(pago.cashDiscountPercent)
        : undefined;

    // TRANSFER ahora se llama "Coordinar por WhatsApp" en el checkout (ya no
    // pide CBU/alias) — la etiqueta acá es solo para las notas del pedido.
    const ETIQUETA_METODO: Record<string, string> = {
      CASH: 'Efectivo', TRANSFER: 'Coordinar por WhatsApp', MERCADOPAGO: 'Mercado Pago',
      COORDINATE_LATER: 'A coordinar con el vendedor',
    };
    const ETIQUETA_ENTREGA = esEnvioADomicilio ? 'Envío a domicilio' : 'Retiro en local';
    // Si no vino método efectivo es porque las notas de crédito cubren todo
    // (validado arriba) — OrdersService.create() agrega el detalle real del
    // monto cubierto/restante a estas mismas notas.
    const notaMetodo = metodoEfectivo
      ? `Método de pago elegido: ${ETIQUETA_METODO[metodoEfectivo] ?? metodoEfectivo}.`
      : 'Pedido cubierto con notas de crédito.';

    // Costo de envío real — según el transportista elegido (si el negocio
    // cargó un costo específico para ese) o el general, con "envío gratis
    // desde" aplicado. Nunca se confía en ningún monto que mande el cliente.
    const shippingCost = await this.storefrontService.resolveShippingCost(
      businessId, esEnvioADomicilio, dto.carrier, dto.items, pago,
    );

    return this.ordersService.create(
      businessId,
      {
        channel: 'ONLINE',
        customerId: customerId ?? undefined,
        items: dto.items,
        buyer: dto.buyer,
        shippingMethod: dto.shippingMethod as 'DELIVERY' | 'PICKUP',
        shippingAddressId: esEnvioADomicilio ? dto.shippingAddressId : undefined,
        shippingAddress: esEnvioADomicilio ? dto.shippingAddress : undefined,
        carrier: esEnvioADomicilio ? dto.carrier : undefined,
        // DELIVERY_APP no tiene sucursal propia — siempre a domicilio,
        // aunque el frontend ya ni pregunte y nunca mande el campo.
        carrierDeliveryMode: esEnvioADomicilio
          ? (dto.carrier === 'DELIVERY_APP' ? 'DOMICILIO' : dto.carrierDeliveryMode)
          : undefined,
        shippingCost,
        discountCode: dto.couponCode,
        manualDiscountPercent,
        creditNoteIds: dto.creditNoteIds,
        // TODO: falta una columna dedicada para el método de pago elegido —
        // por ahora queda en notes, legible por el dueño en el detalle del
        // pedido. Documentado en Jira (RBT-619). La forma de entrega SÍ tiene
        // columna propia (shippingMethod) — no hace falta repetirla acá, pero
        // se deja igual para que las notas se lean completas de un vistazo.
        notes: `${notaMetodo} Entrega: ${ETIQUETA_ENTREGA}.`,
      },
      // Con "coordinar el pago después" activado, no hay ningún método
      // elegido de verdad — pero tampoco hay que exigir que el total quede
      // cubierto por otra vía: es justamente el punto de este flujo.
      { publicCheckout: true, paymentMethodChosen: coordinarDespues ? true : !!dto.paymentMethod },
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

  // @OptionalAuth() (no @Public(), mismo motivo que checkout()/tracking()
  // arriba): el carrito vive en localStorage sin sesión — revalidarlo (con o
  // sin cupón tipeado) sigue sin exigir cuenta — pero si HAY sesión de
  // cliente, se necesita su customerId para poder chequear el límite de usos
  // por cliente de un cupón (maxUsesPerCustomer). Un token de otra tienda no
  // se usa (mismo criterio de aislamiento que el resto): sin businessId
  // coincidente, se revalida como invitado.
  @Post(':slug/cart/validate')
  @OptionalAuth()
  @FullModeOnly()
  async validateCart(@Param('slug') slug: string, @Body() dto: ValidateCartDto, @CurrentUser() ctx?: AuthContext) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    const customerId = ctx?.type === 'customer' && ctx.businessId === businessId ? ctx.customerId : undefined;
    return this.storefrontService.validateCart(slug, dto.items, { couponCode: dto.couponCode, customerId });
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

  @Get(':slug/discounts/:id')
  @Public()
  @FullModeOnly()
  discountLanding(@Param('slug') slug: string, @Param('id') id: string) {
    return this.storefrontService.discountLanding(slug, id);
  }
}
