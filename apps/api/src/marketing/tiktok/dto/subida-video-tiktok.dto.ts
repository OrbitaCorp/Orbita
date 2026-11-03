import { IsIn } from 'class-validator';

// Los formatos de video que acepta TikTok. Se valida el tipo que dice el navegador que va a subir: es la misma
// confianza que en la subida de videos de Apariencia (el servidor no mira los bytes), y TikTok vuelve a validar el archivo.
export const VIDEOS_TIKTOK = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export class SubidaVideoTiktokDto {
  @IsIn(VIDEOS_TIKTOK as unknown as string[]) mimetype!: string;
}
