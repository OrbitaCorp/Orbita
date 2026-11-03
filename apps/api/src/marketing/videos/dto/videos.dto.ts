import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PublicarVideoInstagramDto {
  /** Si no se manda, se usa el texto sugerido que dejó Claude al registrar el video. */
  @IsOptional() @IsString() @MaxLength(2200) caption?: string;
}

export class ActualizarTutorialDto {
  /** EN_REVISION no se pone a mano: lo decide el sistema según haya o no un video esperando. */
  @IsOptional() @IsIn(['FALTA', 'EN_PROCESO', 'HECHO']) estado?: string;
  @IsOptional() @IsIn(['ALAN', 'MATEO', 'ALE']) asignadoA?: string;
  @IsOptional() @IsString() @MaxLength(1000) notas?: string;
  /** Link (o id) del video en YouTube; vacío para quitarlo. La validación fina está en TutorialesService. */
  @IsOptional() @IsString() @MaxLength(300) youtube?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) pantallas?: string[];
}

export class ComentarVideoDto {
  @IsString() @MinLength(1) @MaxLength(1000) texto!: string;
}
