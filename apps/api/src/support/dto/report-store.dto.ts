import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { recortar } from './recortar';

// "Denunciar esta tienda": lo escribe un visitante cualquiera de la tienda,
// sin cuenta, así que (igual que el formulario de contacto de la landing) hay
// que pedir nombre y email para poder contestarle. Los motivos son una lista
// cerrada: le sirven al equipo para priorizar sin leer todo primero.
export const MOTIVOS_DENUNCIA = ['PRODUCTO_PROHIBIDO', 'FALSIFICACION', 'ESTAFA', 'DATOS_PERSONALES', 'OTRO'] as const;
export type MotivoDenuncia = (typeof MOTIVOS_DENUNCIA)[number];

export class ReportStoreDto {
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(63) slug!: string;
  @IsIn(MOTIVOS_DENUNCIA) reason!: MotivoDenuncia;
  @Transform(recortar) @IsString() @MinLength(10) @MaxLength(3000) details!: string;
  @Transform(recortar) @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @Transform(recortar) @IsEmail() @MaxLength(254) email!: string;

  // Campo trampa (honeypot), igual que en SendPublicSupportRequestDto: una
  // persona nunca lo llena, un bot sí. El servicio lo descarta en silencio.
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
