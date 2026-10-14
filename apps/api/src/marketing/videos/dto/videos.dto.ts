import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublicarVideoInstagramDto {
  /** Si no se manda, se usa el texto sugerido que dejó Claude al registrar el video. */
  @IsOptional() @IsString() @MaxLength(2200) caption?: string;
}
