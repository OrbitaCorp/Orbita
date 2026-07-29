import { IsOptional, IsString, ValidateIf } from 'class-validator';

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
}
