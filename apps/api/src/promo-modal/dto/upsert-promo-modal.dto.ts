import { IsBoolean, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Una página de la propia tienda ("/catalogo", "/descuentos/CODIGO"). Antes se
// aceptaba cualquier URL y la tienda hacía window.location.href: el botón del
// modal podía sacar al cliente hacia cualquier sitio (auditoría interna 10/09,
// ítem api.promo-modal; hallazgo bajo del 04/09).
export const RUTA_DE_LA_TIENDA = /^\/(?!\/)[A-Za-z0-9/_?=&.#%-]*$/;

// Todo texto libre a propósito: este modal es un ANUNCIO, no algo que el
// checkout ejecute — no se ata a ningún Discount/Cupón real, ni siquiera
// ahora que existe el 2x1 de verdad (BUY_X_PAY_Y, RBT-675, ver
// TwoForOneService). El dueño es responsable de que lo que anuncia se pueda
// cumplir de verdad.
export class UpsertPromoModalDto {
  @IsString() @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(400) message?: string;
  @IsOptional() @IsString() @MaxLength(24) badge?: string;
  @IsOptional() @IsString() @MaxLength(60) code?: string;
  @IsOptional() @IsString() @MaxLength(40) ctaText?: string;
  @IsOptional() @IsString() @MaxLength(300)
  @Matches(RUTA_DE_LA_TIENDA, { message: 'El link del botón tiene que ser una página de la tienda (por ejemplo /catalogo)' })
  ctaLink?: string;
  @IsBoolean() isActive!: boolean;
  // Vigencia opcional ("desde"/"hasta") — si se manda una, hace falta la
  // otra (validado en el service, mismo criterio que UpsertGameDto). Sin
  // ninguna de las dos, el modal no tiene límite de fechas (solo isActive).
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
}
