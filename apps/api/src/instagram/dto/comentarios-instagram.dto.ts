import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

// Responder un comentario de Instagram: 2200 es el máximo de caracteres de un comentario.
export class ResponderComentarioDto {
  @IsString() @MinLength(1) @MaxLength(2200) texto!: string;
}

// Ocultar (true) o volver a mostrar (false) un comentario.
export class OcultarComentarioDto {
  @IsBoolean() oculto!: boolean;
}
