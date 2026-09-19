import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { URL_IMAGEN, URL_IMAGEN_MENSAJE } from './url-imagen';

// Un video de la sección de video del home (ver `videos` en schema.prisma).
//
// `url` es lo único obligatorio: el resto es el texto que acompaña al video
// en los diseños que lo muestran ('alternado' y 'lista' lo usan entero;
// 'reels' solo el título; 'cine' título y texto debajo). Mismo formato de
// link que `videoUrl` del DTO de apariencia: https, sin rutas propias.
const URL_VIDEO = /^https:\/\/\S+$/;

export class VideoItemDto {
  @IsString() @MaxLength(64) id!: string;

  @IsString()
  @MaxLength(500)
  @Matches(URL_VIDEO, { message: 'Cada video tiene que ser un link https (YouTube, Vimeo, o el archivo del video)' })
  url!: string;

  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(400) text?: string;
  @IsOptional() @IsString() @MaxLength(40) ctaText?: string;
  @IsOptional() @IsString() @MaxLength(500) ctaLink?: string;

  // Portada opcional: la imagen que se ve antes de reproducir, en vez del
  // primer cuadro del video. Sirve sobre todo en el diseño 'reels' con un
  // video horizontal (Ale, 19/09: "se ve cortado").
  @IsOptional() @IsString() @MaxLength(1000) @Matches(URL_IMAGEN, { message: URL_IMAGEN_MENSAJE }) posterUrl?: string;
}
