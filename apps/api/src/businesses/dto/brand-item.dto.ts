import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { URL_IMAGEN, URL_IMAGEN_MENSAJE } from './url-imagen';

// Marca de la tira "Trabajamos con las mejores marcas" del home.
//
// `logoUrl` es opcional a propósito: sin logo cargado, la tira dibuja el
// `name` como tipografía (la tienda de referencia del pedido son puras
// palabras, sin imágenes). Así el dueño puede tener la sección andando
// escribiendo cuatro nombres, y subir los logos después si quiere.
//
// El nombre SIEMPRE se pide, aunque haya logo: es el `alt` de la imagen
// (accesibilidad) y lo que se ve si el archivo no carga.
export class BrandItemDto {
  @IsString() @MaxLength(64) id!: string;
  @IsString() @MaxLength(60) name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(URL_IMAGEN, { message: URL_IMAGEN_MENSAJE })
  logoUrl?: string;
}
