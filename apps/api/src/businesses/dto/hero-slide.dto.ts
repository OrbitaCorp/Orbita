import { IsIn, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { URL_IMAGEN, URL_IMAGEN_MENSAJE } from './url-imagen';

// Topes de largo (auditoría interna 10/09, ítem `api.businesses`): holgados
// contra producción (título más largo hoy: 32; subtítulo: 39).
export class HeroSlideDto {
  @IsString() @MaxLength(64) id!: string;
  @IsString() @MaxLength(150) titulo!: string;
  @IsString() @MaxLength(400) subtitulo!: string;

  @ValidateIf((o: HeroSlideDto) => o.img !== null)
  @IsString()
  @MaxLength(1000)
  @Matches(URL_IMAGEN, { message: URL_IMAGEN_MENSAJE })
  img!: string | null;

  @IsString() @MaxLength(60) cta!: string;

  // A dónde lleva el botón del CTA — path interno o URL externa. Opcional
  // por compatibilidad con slides guardados antes de que existiera este campo.
  // No hace falta filtrar el esquema acá: la tienda solo sigue http(s) o una
  // ruta propia (Inicio.tsx#irACta), un "javascript:" termina como ruta interna.
  @IsOptional() @IsString() @MaxLength(500) ctaLink?: string;

  // Personalización del slide (todos opcionales — retrocompatibles con slides
  // guardados antes de que existieran estos campos):
  // 'full' = la imagen ocupa todo el slide (comportamiento de siempre);
  // 'centered' = imagen a tamaño natural, posicionada junto al texto, con un
  // fondo de color sólido + patrón decorativo detrás (pensado para fotos con
  // el fondo ya quitado).
  @IsOptional() @IsIn(['full', 'centered']) imageStyle?: string;
  @IsOptional() @IsIn(['left', 'center', 'right']) imagePosition?: string;
  // Velo sobre la foto en modo 'full' — separado de bgPattern (que es el
  // patrón de fondo del modo 'centered', sin foto). Opcional/retrocompatible
  // igual que el resto: 'tint' (tinte oscuro + puntos) es el comportamiento
  // de siempre y lo que el frontend asume si un slide viejo no lo trae.
  @IsOptional() @IsIn(['tint', 'none', 'diagonal', 'bottom', 'top', 'radial', 'marca', 'blanco']) imageOverlay?: string;
  @IsOptional() @IsIn(['none', 'rings', 'dots', 'waves', 'diagonal', 'grid', 'stripes', 'confetti', 'halo', 'arc', 'plus', 'bubbles', 'sparkle', 'orbit']) bgPattern?: string;
  // 'image' = el patrón sigue a la imagen (posición izq/centro/derecha);
  // 'full' = cubre el slide entero parejo. Opcional por retrocompatibilidad
  // con slides guardados antes de que existiera este campo.
  @IsOptional() @IsIn(['image', 'full']) bgPatternScope?: string;
  // '' = degradé del tema. El selector del panel deja guardar un hex a medio
  // escribir ("#12"), por eso {0,6} y no el HEX_COLOR estricto de los colores
  // de marca; lo que importa es que no entre nada que no sea un color.
  @IsOptional() @Matches(/^(#[0-9a-fA-F]{0,6})?$/, { message: 'bgColor debe ser un color hex' }) bgColor?: string;
}
