import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Categorías cerradas (no texto libre) — ayudan a Órbita a priorizar sin
// tener que leer el mensaje entero primero, y le dan a "Dominios" un valor
// exacto para que Dominios.tsx pueda linkear acá con la categoría
// precargada (ver el aviso de .com.ar en esa pantalla).
export const SUPPORT_CATEGORIES = ['DOMINIO', 'FACTURACION', 'TECNICO', 'CUENTA', 'OTRO'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export class SendSupportRequestDto {
  @IsIn(SUPPORT_CATEGORIES) category!: SupportCategory;
  @IsString() @MinLength(3) @MaxLength(120) subject!: string;
  @IsString() @MinLength(10) @MaxLength(4000) message!: string;
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string;
}
