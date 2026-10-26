import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, ValidateNested,
} from 'class-validator';

export const AUDIT_AREAS = ['BACKEND', 'FRONTEND', 'TRANSVERSAL', 'HALLAZGO'] as const;
export const AUDIT_ESTADOS = ['PENDIENTE', 'EN_CURSO', 'HECHO'] as const;
export const AUDIT_SEVERIDADES = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFO'] as const;
// Qué se hace con un ítem que no se destraba con código. Se manda null para
// volver a "sin decidir" (ver UpdateAuditItemDto.decision).
export const AUDIT_DECISIONES = ['HACER', 'NO_HACER', 'HABLAR'] as const;

// Solo http(s): el informe se abre con un click desde el panel y un link
// javascript: o data: sería un XSS servido por nosotros mismos.
const URL_HTTP = /^https?:\/\/\S+$/i;

export class CheckToggleDto {
  @IsString()
  @Length(1, 64)
  id!: string;

  @IsBoolean()
  hecho!: boolean;

  // Solo en los planes de Módulos: key de la entrada de auditoría
  // (auditoria.<slug>.*) que documenta la tarea. El servicio exige una
  // entrada que exista para marcarla hecha; con hecho: false solo la vincula.
  @IsOptional()
  @IsString()
  @Length(3, 160)
  auditoria?: string;
}

// Keys que se pueden elegir a mano al crear: las entradas de Módulos
// (auditoria.<slug>.<fecha>-<titulo>) y, por si hace falta cargar un plan sin
// seed, los planes (modulo.<slug>.plan). Cualquier otro ítem sigue naciendo
// como custom.<uuid>.
export const KEY_PERMITIDA = /^(auditoria|modulo)\.[a-z0-9][a-z0-9.-]{2,140}$/;

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

  // Qué se hace con el ítem. `null` lo devuelve a "sin decidir" y borra la
  // nota, el autor y la fecha: es un "me retracto", no un estado intermedio.
  @IsOptional()
  @IsIn([...AUDIT_DECISIONES, null])
  decision?: (typeof AUDIT_DECISIONES)[number] | null;

  // Por qué se decidió eso. Corta a propósito: si necesita más, va en `notas`.
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  decisionNota?: string | null;

  // Verificaciones nuevas que el equipo suma a un ítem (texto libre).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(3, 300, { each: true })
  nuevosChecks?: string[];
}

export class CreateAuditItemDto {
  @IsOptional()
  @IsString()
  @Matches(KEY_PERMITIDA, { message: 'La key solo puede ser auditoria.<slug>.<nombre> o modulo.<slug>.<nombre>, en minúsculas' })
  key?: string;

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

  // Las entradas de Módulos nacen con su informe (qué se hizo, archivos,
  // capturas), el responsable de la tarea y sus datos en `notas` (JSON con
  // quién, tipo y tarea). Nacen PENDIENTE y pasan a HECHO cuando el
  // responsable las confirma; el estado se puede mandar igual por si alguien
  // carga algo ya revisado.
  @IsOptional()
  @IsString()
  @Length(0, 80_000)
  informe?: string;

  @IsOptional()
  @IsIn(AUDIT_ESTADOS)
  estado?: (typeof AUDIT_ESTADOS)[number];

  @IsOptional()
  @IsString()
  responsableId?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notas?: string | null;
}
