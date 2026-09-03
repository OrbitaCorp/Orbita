import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class HeroSlideDto {
  @IsString() id!: string;
  @IsString() titulo!: string;
  @IsString() subtitulo!: string;

  @ValidateIf((o: HeroSlideDto) => o.img !== null)
  @IsString()
  img!: string | null;

  @IsString() cta!: string;

  // A dónde lleva el botón del CTA — path interno o URL externa. Opcional
  // por compatibilidad con slides guardados antes de que existiera este campo.
  @IsOptional() @IsString() ctaLink?: string;

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
  @IsOptional() @IsString() bgColor?: string;
}
