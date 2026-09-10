import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

// Categorías cerradas (no texto libre) — ayudan a Órbita a priorizar sin
// tener que leer el mensaje entero primero, y le dan a "Dominios" un valor
// exacto para que Dominios.tsx pueda linkear acá con la categoría
// precargada (ver el aviso de .com.ar en esa pantalla).
export const SUPPORT_CATEGORIES = ['DOMINIO', 'FACTURACION', 'TECNICO', 'CUENTA', 'OTRO'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

// Recorta antes de validar: el mínimo de largo se medía con los espacios
// incluidos, así que "   a" pasaba como asunto (auditoría interna 10/09,
// ítem api.support).
const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SendSupportRequestDto {
  @IsIn(SUPPORT_CATEGORIES) category!: SupportCategory;
  @Transform(recortar) @IsString() @MinLength(3) @MaxLength(120) subject!: string;
  @Transform(recortar) @IsString() @MinLength(10) @MaxLength(4000) message!: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(30) contactPhone?: string;
}
