import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { recortar } from './recortar';
import { MAX_ADJUNTOS_POR_MENSAJE, SupportAttachmentDto } from './support-attachment.dto';

// El negocio vuelve a escribir en una consulta que ya existe (POST
// /support/:id/messages). Mismos topes que el mensaje inicial.
export class ReplySupportRequestDto {
  @Transform(recortar) @IsString() @MinLength(10) @MaxLength(4000) message!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ADJUNTOS_POR_MENSAJE)
  @ValidateNested({ each: true })
  @Type(() => SupportAttachmentDto)
  attachments?: SupportAttachmentDto[];
}
