import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

// Los cuatro niveles de privacidad que existen en TikTok. Cuáles puede usar la cuenta en este
// momento lo decide TikTok (creator_info): el servicio lo vuelve a chequear.
export const PRIVACIDADES_TIKTOK = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'] as const;

export class PublicarTiktokDto {
  /** El texto que acompaña al video (descripción y hashtags). TikTok acepta hasta 2200 caracteres. */
  @IsString() @MinLength(1) @MaxLength(2200) title!: string;

  /** Dónde está el video: una dirección https pública (por ejemplo, el bucket de R2). La API lo baja y lo sube a TikTok. */
  @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2000) videoUrl!: string;

  @IsIn(PRIVACIDADES_TIKTOK as unknown as string[]) privacyLevel!: string;

  @IsOptional() @IsBoolean() disableComment?: boolean;
  @IsOptional() @IsBoolean() disableDuet?: boolean;
  @IsOptional() @IsBoolean() disableStitch?: boolean;

  /** "Contenido de marca": una promoción pagada por un tercero. */
  @IsOptional() @IsBoolean() brandContent?: boolean;
  /** "Tu marca": el video promociona el propio negocio (el caso de los videos de marketing de Órbita). */
  @IsOptional() @IsBoolean() brandOrganic?: boolean;
  /** El video fue generado o editado con IA: TikTok pide marcarlo. */
  @IsOptional() @IsBoolean() isAigc?: boolean;
}
