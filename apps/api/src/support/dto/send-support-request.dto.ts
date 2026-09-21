import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { recortar } from './recortar';
import { MAX_ADJUNTOS_POR_MENSAJE, SupportAttachmentDto } from './support-attachment.dto';

// Categorías cerradas (no texto libre) — ayudan a Órbita a priorizar sin
// tener que leer el mensaje entero primero, y le dan a "Dominios" un valor
// exacto para que Dominios.tsx pueda linkear acá con la categoría
// precargada (ver el aviso de .com.ar en esa pantalla).
export const SUPPORT_CATEGORIES = ['DOMINIO', 'FACTURACION', 'TECNICO', 'CUENTA', 'OTRO'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export class SendSupportRequestDto {
  @IsIn(SUPPORT_CATEGORIES) category!: SupportCategory;
  @Transform(recortar) @IsString() @MinLength(3) @MaxLength(120) subject!: string;
  @Transform(recortar) @IsString() @MinLength(10) @MaxLength(4000) message!: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(30) contactPhone?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ADJUNTOS_POR_MENSAJE)
  @ValidateNested({ each: true })
  @Type(() => SupportAttachmentDto)
  attachments?: SupportAttachmentDto[];
}
