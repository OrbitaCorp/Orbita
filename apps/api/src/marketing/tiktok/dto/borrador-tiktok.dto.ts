import { IsUrl, MaxLength } from 'class-validator';

// Mandar un video a los borradores de TikTok: solo hace falta el video; el título, la visibilidad y el resto
// los completa la persona en la app de TikTok.
export class BorradorTiktokDto {
  /** Una dirección https pública (por ejemplo, el bucket de R2). La API lo baja y lo sube a TikTok. */
  @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2000) videoUrl!: string;
}
