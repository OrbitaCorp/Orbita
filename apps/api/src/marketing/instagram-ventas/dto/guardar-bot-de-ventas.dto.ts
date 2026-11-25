import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

// PUT /platform/marketing/instagram/bot: la configuración del bot de ventas de la cuenta de Instagram de la empresa.
export class GuardarBotDeVentasDto {
  @IsBoolean() activo!: boolean;
  @IsBoolean() usarIa!: boolean;
  @IsBoolean() responderComentarios!: boolean;
  @IsBoolean() todosLosComentarios!: boolean;

  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(40, { each: true })
  palabrasClave!: string[];

  // Respuestas públicas al comentario: se alternan para no repetir siempre la misma (Instagram castiga el spam).
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(150, { each: true })
  respuestasPublicas!: string[];

  // El único mensaje privado que Instagram deja mandar por comentario: tiene que invitar a responder.
  @IsOptional() @IsString() @MaxLength(900)
  saludoComentario?: string;

  @IsArray() @ArrayMaxSize(10) @IsEmail({}, { each: true, message: 'Uno de los correos no es válido' })
  correosAviso!: string[];
}
