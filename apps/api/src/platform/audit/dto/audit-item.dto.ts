import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, ValidateNested,
} from 'class-validator';

export const AUDIT_AREAS = ['BACKEND', 'FRONTEND', 'TRANSVERSAL', 'HALLAZGO'] as const;
export const AUDIT_ESTADOS = ['PENDIENTE', 'EN_CURSO', 'HECHO'] as const;
export const AUDIT_SEVERIDADES = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFO'] as const;

// Solo http(s): el informe se abre con un click desde el panel y un link
// javascript: o data: sería un XSS servido por nosotros mismos.
const URL_HTTP = /^https?:\/\/\S+$/i;

export class CheckToggleDto {
  @IsString()
  @Length(1, 64)
  id!: string;

  @IsBoolean()
  hecho!: boolean;
}

export class UpdateAuditItemDto {
  @IsOptional()
  @IsIn(AUDIT_ESTADOS)
  estado?: (typeof AUDIT_ESTADOS)[number];

  // null = sin responsable.
  @IsOptional()
  @IsString()
  responsableId?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  @Matches(URL_HTTP, { message: 'El informe tiene que ser un link http(s)' })
  informeUrl?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notas?: string | null;

  // Markdown. Tope generoso: un informe por módulo con tablas de
  // verificaciones y hallazgos entra cómodo en 80k.
  @IsOptional()
  @IsString()
  @Length(0, 80_000)
  informe?: string | null;

  // Tildes/destildes de verificaciones existentes (por id). Los ids que no
  // existan en el ítem se ignoran.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CheckToggleDto)
  checks?: CheckToggleDto[];

  // Verificaciones nuevas que el equipo suma a un ítem (texto libre).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(3, 300, { each: true })
  nuevosChecks?: string[];
}

export class CreateAuditItemDto {
  @IsIn(AUDIT_AREAS)
  area!: (typeof AUDIT_AREAS)[number];

  @IsString()
  @Length(2, 120)
  grupo!: string;

  @IsString()
  @Length(2, 160)
  titulo!: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  ruta?: string | null;

  @IsString()
  @Length(2, 1000)
  foco!: string;

  @IsOptional()
  @IsIn(AUDIT_SEVERIDADES)
  severidad?: (typeof AUDIT_SEVERIDADES)[number] | null;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Length(3, 300, { each: true })
  checks!: string[];
}
