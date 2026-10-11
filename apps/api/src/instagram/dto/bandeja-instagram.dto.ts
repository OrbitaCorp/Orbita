import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

// Responder un mensaje directo. Instagram corta el texto en 1000 bytes; el máximo de caracteres es una guarda
// barata, el largo exacto lo valida el servicio. La foto llega aparte (multipart, campo `file`).
export class ResponderMensajeDto {
  @IsOptional() @IsString() @MaxLength(1000) texto?: string;
}

export class MarcarLeidaDto {
  @IsBoolean() leida!: boolean;
}
