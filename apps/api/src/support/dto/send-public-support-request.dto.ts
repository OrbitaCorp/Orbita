import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { recortar } from './recortar';
import { SUPPORT_CATEGORIES, type SupportCategory } from './send-support-request.dto';

// Formulario de contacto de la landing: lo escribe un visitante SIN cuenta, así
// que a diferencia de SendSupportRequestDto acá sí hay que pedir nombre y email
// (en el de panel salen de la sesión). Mismas categorías y mismos largos.
export class SendPublicSupportRequestDto {
  @Transform(recortar) @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @Transform(recortar) @IsEmail() @MaxLength(254) email!: string;
  @IsIn(SUPPORT_CATEGORIES) category!: SupportCategory;
  @Transform(recortar) @IsString() @MinLength(3) @MaxLength(120) subject!: string;
  @Transform(recortar) @IsString() @MinLength(10) @MaxLength(4000) message!: string;

  // Campo trampa (honeypot): en la página está escondido, una persona nunca lo
  // llena. Un bot que completa todo lo que ve, sí. Se declara acá (y no se
  // valida con @Equals('')) para que el servicio lo descarte en silencio: si
  // devolviéramos 400, el bot aprendería qué campo lo delata.
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
