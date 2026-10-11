import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

// Pedirle a Orbi un texto para una publicación. Todo es opcional: sin producto ni idea escribe uno general.
export class RedactarTextoDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsString() @MaxLength(600) idea?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) elementos?: number;
  @IsOptional() @IsBoolean() hayVideo?: boolean;
}

// Pedirle a Orbi cómo responder un comentario (con su texto) o un mensaje directo (por la conversación).
export class SugerirRespuestaDto {
  @IsIn(['comentario', 'mensaje']) tipo!: 'comentario' | 'mensaje';
  @IsOptional() @IsString() @MaxLength(1000) texto?: string;
  @IsOptional() @IsString() @MaxLength(500) publicacion?: string;
  @IsOptional() @IsUUID() conversationId?: string;
}
