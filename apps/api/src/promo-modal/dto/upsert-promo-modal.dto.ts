import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

// Todo texto libre a propósito (RBT-675): este modal es un ANUNCIO, no algo
// que el checkout ejecute — no se ata a ningún Discount/Cupón real (el
// motor no tiene "2x1" implementado, ver discount-engine.ts). El dueño es
// responsable de que lo que anuncia se pueda cumplir de verdad.
export class UpsertPromoModalDto {
  @IsString() @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(400) message?: string;
  @IsOptional() @IsString() @MaxLength(24) badge?: string;
  @IsOptional() @IsString() @MaxLength(60) code?: string;
  @IsOptional() @IsString() @MaxLength(40) ctaText?: string;
  @IsOptional() @IsString() @MaxLength(300) ctaLink?: string;
  @IsBoolean() isActive!: boolean;
  // Vigencia opcional ("desde"/"hasta") — si se manda una, hace falta la
  // otra (validado en el service, mismo criterio que UpsertGameDto). Sin
  // ninguna de las dos, el modal no tiene límite de fechas (solo isActive).
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
}
