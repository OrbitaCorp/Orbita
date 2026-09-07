import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Contenido libre, mismo criterio que UpsertPromoModalDto: es un ANUNCIO, no
// algo que el checkout ejecute. Si el aviso promete un código, el dueño se
// tiene que haber ocupado de crearlo de verdad en Descuentos.
export class UpsertExitIntentDto {
  @IsString() @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(300) message?: string;
  @IsOptional() @IsString() @MaxLength(24) badge?: string;
  @IsOptional() @IsString() @MaxLength(60) code?: string;
  @IsOptional() @IsString() @MaxLength(40) ctaText?: string;
  @IsOptional() @IsString() @MaxLength(300) ctaLink?: string;

  @IsIn(['ONCE_EVER', 'ONCE_PER_DAY', 'ALWAYS']) frequency!: 'ONCE_EVER' | 'ONCE_PER_DAY' | 'ALWAYS';

  // Techo de 300s (5 min): más que eso no es "está por irse", es otra visita.
  @IsInt() @Min(0) @Max(300) minSeconds!: number;

  @IsBoolean() onMobile!: boolean;
  @IsBoolean() isActive!: boolean;
}
