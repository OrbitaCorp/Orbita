import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, Min, Max, MaxLength, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

// Topes (auditoría interna 10/09, ítem `api.orders`): antes no había cantidad
// máxima de renglones ni de unidades, ni largo en notas, comprador o
// dirección. Una cantidad enorme desbordaba el Int de Postgres (500). Holgados
// contra producción (el pedido más grande al 10/09: 2 renglones, 15 unidades).
class OrderItemInput {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) @Max(10_000) quantity!: number;
  // No implementados: OrdersService.create() los rechaza con un mensaje claro.
  @IsOptional() @IsNumber() editedPrice?: number;
  @IsOptional() @IsBoolean() isConcept?: boolean;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
// Cobro ya hecho, para la venta presencial (channel POS): uno o varios
// renglones que tienen que sumar exactamente el total (ej. "mitad efectivo,
// mitad transferencia"). Nunca MERCADOPAGO ni QR acá: esos tienen su propio
// flujo de pasarela. Un pedido online no los manda (se cobra después).
class OrderPaymentInput {
  @IsIn(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER']) method!: string;
  @IsNumber() @Min(0.01) @Max(1_000_000_000) amount!: number;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
}
// (Fase 2 — Alex) Datos del comprador para pedidos manuales/online sin cliente
// registrado: el pedido necesita saber a nombre de quién va y a qué email avisar.
class OrderBuyerInput {
  @IsString() @MaxLength(150) name!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) dni?: string;
}
// Dirección tipeada a mano (invitados del checkout público, o un cliente que
// no quiere guardarla) — se guarda como snapshot en el pedido, nunca crea una
// fila de Address. Mismo shape que CheckoutShippingAddressInput
// (storefront/dto/checkout.dto.ts, mismo criterio de obligatoriedad ahí
// también) — se repite en vez de importar entre módulos, mismo criterio que
// el resto de los DTOs de este archivo.
class OrderShippingAddressInput {
  @IsString() @MaxLength(200) street!: string;
  @IsOptional() @IsString() @MaxLength(20) floor?: string;
  @IsOptional() @IsString() @MaxLength(20) depto?: string;
  @IsOptional() @IsString() @MaxLength(300) referencia?: string;
  @IsString() @MaxLength(60) provincia!: string;
  @IsString() @MaxLength(100) city!: string;
  @IsString() @MaxLength(20) zip!: string;
}
export class CreateOrderDto {
  // ONLINE = pedido con ciclo de estados (nace pendiente): el checkout de la
  // tienda y la modalidad "Pedido online" del alta manual del panel. POS =
  // venta presencial cargada desde el panel: se cobró y entregó en el
  // momento, nace COMPLETED, descuenta stock y registra el cobro al crearse
  // (exige `paymentMethod`). El checkout público nunca puede mandar POS.
  @IsIn(['POS', 'ONLINE']) channel!: 'POS' | 'ONLINE';
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OrderItemInput) items!: OrderItemInput[];
  @IsOptional() @IsString() @MaxLength(50) discountCode?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  // Solo venta presencial (POS): cómo se cobró, cuando fue con más de un
  // medio. Alternativa a `paymentMethod` (que es "todo con este medio").
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => OrderPaymentInput) payments?: OrderPaymentInput[];
  // Opcionales los dos: el alta manual del panel no tiene este concepto
  // todavía — solo los manda el checkout del storefront (ver
  // StorefrontController.checkout()).
  @IsOptional() @IsIn(['DELIVERY', 'PICKUP']) shippingMethod?: 'DELIVERY' | 'PICKUP';
  @IsOptional() @IsUUID() shippingAddressId?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => OrderShippingAddressInput) shippingAddress?: OrderShippingAddressInput;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => OrderBuyerInput) buyer?: OrderBuyerInput;
  // No puede ser negativo: un envío negativo bajaba el total (hasta $0) y
  // dejaba pasar pedidos con total falso que igual descuentan stock.
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000) shippingCost?: number;
  // Descuento por método de pago (ej: efectivo) — distinto de un cupón: no
  // referencia ningún Discount, se calcula sobre el subtotal directo. Hoy lo
  // usa el checkout del storefront con BusinessConfig.cashDiscountPercent.
  @IsOptional() @IsNumber() @Min(0) @Max(100) manualDiscountPercent?: number;
  // Notas de crédito del cliente a canjear en este pedido — solo las manda
  // el checkout del storefront (mismo criterio que shippingMethod arriba);
  // el alta manual del panel no tiene este concepto todavía. Requiere
  // `customerId`: una nota de crédito siempre pertenece a un Customer real.
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) creditNoteIds?: string[];
  // Transportista preferido por el cliente para coordinar el envío — solo lo
  // manda el checkout del storefront (mismo criterio que shippingMethod
  // arriba); el alta manual del panel no lo exige. Mismo enum que
  // UpdateOrderShippingDto.
  @IsOptional() @IsIn(['CORREO_ARGENTINO', 'OCA', 'ANDREANI', 'VIA_CARGO', 'DELIVERY_APP', 'OTRO']) carrier?: string;
  // A domicilio o en sucursal DEL TRANSPORTISTA elegido — mismo criterio que
  // `carrier`: opcional acá, solo lo manda el checkout del storefront.
  @IsOptional() @IsIn(['DOMICILIO', 'SUCURSAL']) carrierDeliveryMode?: string;
  // Medio de pago elegido por el cliente para pagar OFFLINE (efectivo,
  // transferencia coordinada por WhatsApp, o débito/crédito con posnet al
  // retirar) — distinto de `payments` (que ya viene resuelto/aprobado, hoy
  // bloqueado más abajo). Con esto, create() deja un Payment PENDING que se
  // aprueba solo al confirmar el pedido (ver updateStatus()). Nunca
  // MERCADOPAGO acá: ese tiene su propio flujo de preferencia + webhook.
  // Solo lo manda el checkout del storefront (mismo criterio que
  // shippingMethod arriba) — el alta manual del panel no lo usa todavía.
  @IsOptional() @IsIn(['CASH', 'TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD']) paymentMethod?: string;
  // Alta manual del panel: avisarle al comprador por email que el pedido
  // quedó cargado (con el detalle). Solo si el pedido tiene un email (cliente
  // registrado o comprador con email). El checkout público lo ignora: ahí
  // los avisos salen con los cambios de estado, como siempre.
  @IsOptional() @IsBoolean() notifyCustomer?: boolean;
}
