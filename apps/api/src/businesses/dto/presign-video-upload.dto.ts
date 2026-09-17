import { IsIn } from 'class-validator';
import { MIME_VIDEO_PERMITIDOS } from '../../common/utils/subida-video';

// Lo que el frontend manda ANTES de tener el archivo subido: solo el
// Content-Type que va a declarar en el PUT directo a R2 (ver
// businesses.service.ts#presignStorefrontVideo). El nombre del archivo no
// hace falta — la key en R2 es un uuid propio, no el nombre original.
export class PresignVideoUploadDto {
  @IsIn(MIME_VIDEO_PERMITIDOS)
  mimetype!: string;
}
