import { IsString, IsOptional, IsInt, IsUUID, IsEmail, IsArray, IsIn, IsNotEmpty, MaxLength, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class CheckoutItemInput {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) quantity!: number;
}
class CheckoutBuyerInput {
  // `@IsString()` solo no alcanza — un string vacío "" sigue siendo un
  // string válido, así que sin `@IsNotEmpty()` un `name: ''` pasaba la
  // validación (el frontend ya lo bloqueaba antes de mandar la request,
  // pero eso no cubre a alguien pegándole directo a la API).
  @IsString() @IsNotEmpty() @MaxLength(150) name!: string;
  @IsEmail() email!: string;
  // Obligatorio desde que el checkout coordina el envío por WhatsApp — sin
  // teléfono no hay forma de contactar al comprador para eso.
  @IsString() @IsNotEmpty() phone!: string;
}
// Dirección de envío tipeada a mano — mismo shape que UpsertAddressDto
// (Me/Addresses, RBT-629), y mismo criterio de obligatoriedad: calle,
// provincia, ciudad y CP son necesarios para poder ubicar y coordinar el
// envío; piso/depto/referencia quedan opcionales (no todo domicilio tiene
// piso o depto). NO crea una fila de Address: es lo que usa un invitado
// (sin Customer al que colgarle una dirección guardada) para cargar dónde
// entregar SIN necesidad de cuenta. Se guarda como snapshot en el pedido
// (ver OnlineOrderDetails.shippingStreet/etc.).
class CheckoutShippingAddressInput {
  @IsString() @IsNotEmpty() street!: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsString() depto?: string;
  @IsOptional() @IsString() referencia?: string;
  @IsString() @IsNotEmpty() provincia!: string;
  @IsString() @IsNotEmpty() city!: string;
  @IsString() @IsNotEmpty() zip!: string;
}
export class CheckoutDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CheckoutItemInput) items!: CheckoutItemInput[];
  @ValidateNested() @Type(() => CheckoutBuyerInput) buyer!: CheckoutBuyerInput;
  // Envío a domicilio vs. retiro en el local — antes esto vivía mezclado
  // adentro de `paymentMethod` ('PICKUP' era uno de los "métodos de pago").
  @IsIn(['DELIVERY', 'PICKUP']) shippingMethod!: string;
  // Solo tiene sentido con shippingMethod === 'DELIVERY'. Dos formas
  // mutuamente exclusivas de indicar la dirección — el controller exige
  // exactamente una de las dos cuando hay envío a domicilio:
  //  - shippingAddressId: una dirección YA guardada del cliente con sesión
  //    (Me/Addresses) — el checkout no arma direcciones sueltas ahí, así
  //    "Mis pedidos" y "Mis direcciones" siempre hablan de las mismas.
  //  - shippingAddress: tipeada a mano, para invitados (o un cliente que
  //    prefiere no guardarla).
  @IsOptional() @IsUUID() shippingAddressId?: string;
  @IsOptional() @ValidateNested() @Type(() => CheckoutShippingAddressInput) shippingAddress?: CheckoutShippingAddressInput;
  // 'MERCADOPAGO' está en el modelo desde antes pero el checkout todavía no
  // la ofrece como opción real (ver comentario en StorefrontService.getConfig) —
  // queda documentada acá para cuando exista la conexión OAuth.
  // 'PICKUP' YA NO es un método de pago (ver shippingMethod arriba) — con
  // envío a domicilio, además, 'CASH' queda descartado por el controller
  // (efectivo solo tiene sentido pagando al retirar).
  // Opcional: si `creditNoteIds` cubre el total del pedido, no hace falta
  // ningún otro método — el controller exige uno de los dos (ver checkout()).
  @IsOptional() @IsIn(['MERCADOPAGO', 'CASH', 'TRANSFER']) paymentMethod?: string;
  @IsOptional() @IsString() couponCode?: string;
  // Notas de crédito del cliente logueado a aplicar como parte del pago —
  // se pueden combinar varias (se suman) y con un cupón (son cosas
  // distintas: el cupón baja el precio real de la venta, la nota de crédito
  // paga parte de lo que queda). Se validan server-side igual que todo lo
  // demás acá — nunca se confía en el monto, solo en los ids. Requiere
  // sesión de cliente (ver checkout(): las notas son siempre de un
  // `Customer` real, un invitado no puede tener ninguna).
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) creditNoteIds?: string[];
}
