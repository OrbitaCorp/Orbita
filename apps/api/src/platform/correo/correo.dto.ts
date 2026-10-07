import { IsEmail, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class UpsertCasillaDto {
  @IsEmail({}, { message: 'El email de la casilla no es válido' })
  email!: string;

  @IsString()
  @Length(2, 60, { message: 'El nombre tiene que tener entre 2 y 60 caracteres' })
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 60)
  jobTitle?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  phone?: string | null;

  // La URL que devolvió POST /platform/correo/firma-imagen. Solo https: termina
  // como <img> en un correo que lee un tercero.
  @IsOptional()
  @IsString()
  @Length(0, 500)
  @Matches(/^(https:\/\/\S+)?$/i, { message: 'La imagen de la firma tiene que ser un link https' })
  signatureImageUrl?: string | null;
}

export class VistaPreviaCorreoDto {
  @IsUUID()
  senderId!: string;

  @IsString()
  @Length(0, 20000)
  body!: string;
}

export class EnviarCorreoDto {
  @IsUUID()
  senderId!: string;

  @IsEmail({}, { message: 'El destinatario no es un email válido' })
  to!: string;

  @IsString()
  @Length(3, 200, { message: 'El asunto tiene que tener entre 3 y 200 caracteres' })
  subject!: string;

  @IsString()
  @Length(10, 20000, { message: 'El mensaje tiene que tener entre 10 y 20.000 caracteres' })
  body!: string;
}
