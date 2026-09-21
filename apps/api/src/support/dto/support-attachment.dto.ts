import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { recortar } from './recortar';

// Una captura adjunta a un mensaje. La URL la devuelve POST /support/attachments
// y el frontend la manda de vuelta tal cual: el service verifica que apunte a
// la carpeta soporte/ de ESE negocio en el bucket (no acá — el DTO no sabe de
// qué negocio es el token). El resto son datos de muestra para el hilo.
export class SupportAttachmentDto {
  @Transform(recortar) @IsString() @MinLength(10) @MaxLength(600) url!: string;
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @IsInt() @Min(0) size?: number;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(100) type?: string;
}

// Tope por mensaje: alcanza para mostrar un problema y evita que un hilo se
// convierta en un álbum (cada una pesa hasta 10 MB antes de recodificar).
export const MAX_ADJUNTOS_POR_MENSAJE = 3;
