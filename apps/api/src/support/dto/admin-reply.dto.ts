import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { recortar } from './recortar';

// Respuesta del equipo de Órbita desde el superadmin. Sin adjuntos por ahora:
// lo que se explica se explica con texto, y si hace falta una captura se manda
// por mail (el Reply-To del aviso apunta al buzón de soporte).
export class AdminReplyDto {
  @Transform(recortar) @IsString() @MinLength(10) @MaxLength(5000) message!: string;
}
