import { IsArray, IsBoolean, IsIn, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// El contenido del cartel es texto libre; el DESCUENTO, no. Cuando
// `conDescuento` está en true, este módulo crea y mantiene un `Discount` real
// —igual que hace el 2x1 (ver UpsertTwoForOneDto)— y la fecha de fin del
// countdown pasa a ser la del descuento. Las validaciones cruzadas (porcentaje
// entre 1 y 100, alcance con al menos un id, pertenencia al negocio) viven en
// el service, mismo criterio que DiscountsService#validarReglas.
export class UpsertCountdownDto {
  @IsString() @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(160) subtitle?: string;

  // Obligatoria: sin fecha límite no hay cuenta regresiva que mostrar. Si hay
  // descuento asociado, es también su vencimiento.
  @IsISO8601() endDate!: string;

  // Qué decir cuando el reloj llega a cero. Vacío = el countdown se esconde
  // solo, sin que el dueño tenga que entrar a apagarlo.
  @IsOptional() @IsString() @MaxLength(120) finishedMessage?: string;

  @IsOptional() @IsString() @MaxLength(40) ctaText?: string;
  @IsOptional() @IsString() @MaxLength(300) ctaLink?: string;

  @IsIn(['HOME', 'ALL_PAGES']) placement!: 'HOME' | 'ALL_PAGES';
  @IsBoolean() isActive!: boolean;

  // ── Descuento gestionado (opcional) ───────────────────────────────────────
  // Opcional a propósito: el countdown también sirve para anunciar algo que no
  // es un descuento porcentual ("el 2x1 termina el viernes", "último día de
  // envío gratis"). Sin esto, el módulo es solo un cartel, como era antes.
  @IsOptional() @IsBoolean() conDescuento?: boolean;
  // Sección de la portada con los productos en oferta. Solo tiene efecto junto
  // con `conDescuento` — el service la fuerza en false sin descuento, porque
  // sin descuento no hay productos que listar. Ausente = true (es el default
  // de la columna: quien elige a qué productos aplica espera verlos).
  @IsOptional() @IsBoolean() showProductsOnHome?: boolean;
  @IsOptional() @IsIn(['PERCENT', 'AMOUNT']) descuentoTipo?: 'PERCENT' | 'AMOUNT';
  @IsOptional() @IsNumber() descuentoValor?: number;
  @IsOptional() @IsIn(['PRODUCT', 'CATEGORY']) descuentoAlcance?: 'PRODUCT' | 'CATEGORY';
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) productIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) categoryIds?: string[];
}
