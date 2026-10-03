import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';
import { NormalizedEmail } from '../../../../common/decorators/normalized-email.decorator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** POST/PUT appointments/class-templates */
export class UpsertClassTemplateDto {
  @IsUUID('4') serviceId!: string;
  /** 0 = lunes … 6 = domingo. */
  @IsInt() @Min(0) @Max(6) weekday!: number;
  @IsInt() @Min(0) @Max(1439) startMin!: number;
  @IsInt() @Min(15) @Max(600) durationMin!: number;
  @IsOptional() @IsUUID('4') instructorResourceId?: string | null;
  @IsOptional() @IsUUID('4') roomResourceId?: string | null;
  @IsInt() @Min(1) @Max(500) capacity!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** PUT appointments/classes/:templateId/:date */
export class UpdateClassSessionDto {
  /** null = vuelve al cupo de la plantilla. */
  @IsOptional() @IsInt() @Min(1) @Max(500) capacity?: number | null;
  @IsOptional() @IsBoolean() cancelled?: boolean;
  @IsOptional() @IsString() @MaxLength(300) cancelReason?: string;
}

export class NuevoClienteDto {
  @Transform(recortar) @IsString() @MinLength(3, { message: 'El nombre tiene que tener al menos 3 letras.' }) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @NormalizedEmail() email?: string;
}

/** POST appointments/classes/:templateId/:date/enrollments: un cliente existente O uno nuevo. */
export class EnrollDto {
  @IsOptional() @IsUUID('4') customerId?: string;
  @IsOptional() @ValidateNested() @Type(() => NuevoClienteDto) customer?: NuevoClienteDto;
}

/** PATCH appointments/class-enrollments/:id/attendance. null = todavía no se tomó. */
export class AttendanceDto {
  @ValidateIf((o: AttendanceDto) => o.attended !== null) @IsBoolean() attended!: boolean | null;
}

/** POST storefront/:slug/appointments/classes/enroll */
export class PublicEnrollDto {
  @IsUUID('4') templateId!: string;
  @Matches(RE_FECHA, { message: 'date tiene que ser una fecha AAAA-MM-DD' }) date!: string;
  @Transform(recortar) @IsString() @MinLength(3, { message: 'Escribí tu nombre y apellido.' }) @MaxLength(120) name!: string;
  @IsString() @MaxLength(40) phone!: string;
  @IsOptional() @NormalizedEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsBoolean() wantsReminder?: boolean;
}
