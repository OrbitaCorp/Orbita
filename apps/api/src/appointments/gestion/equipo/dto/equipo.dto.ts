import { Transform } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min,
} from 'class-validator';
import { NormalizedEmail } from '../../../../common/decorators/normalized-email.decorator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const COLOR = /^#[0-9a-fA-F]{6}$/;

/** POST appointments/team/invite: mismos topes que InviteMemberDto de Tienda. */
export class InvitePersonDto {
  @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @NormalizedEmail() email!: string;
  @IsUUID('4') roleId!: string;
}

/** POST appointments/team (persona sin login) y PUT appointments/team/:resourceId. */
export class UpsertPersonDto {
  @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsUUID('4') roleId?: string;
  @IsOptional() @NormalizedEmail() email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @Matches(COLOR, { message: 'color tiene que ser #RRGGBB' }) color?: string | null;
  @IsOptional() @IsString() @MaxLength(500) photoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(400) bio?: string | null;
  @IsBoolean() isBookable!: boolean;
  @IsArray() @ArrayMinSize(1, { message: 'Elegí al menos un día.' }) @ArrayMaxSize(7) @ArrayUnique() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  workDays!: number[];
  /** Semana propia (7 días de tramos) o null = sigue al negocio. Se valida con errorSemana. */
  @IsOptional() @IsArray() ownSchedule?: unknown[] | null;
  /** Modo RESOURCE: el espacio donde atiende. */
  @IsOptional() @IsUUID('4') assignedSpaceId?: string | null;
}

/** PUT appointments/team/:resourceId/pay */
export class PayFormDto {
  @IsIn(['COMMISSION', 'SALARY', 'MIXED', 'RENT', 'PER_CLASS']) payForm!: 'COMMISSION' | 'SALARY' | 'MIXED' | 'RENT' | 'PER_CLASS';
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) commissionPercent?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) salary?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) rent?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) perClass?: number;
  @IsIn(['WEEK', 'FORTNIGHT', 'MONTH']) payEvery!: 'WEEK' | 'FORTNIGHT' | 'MONTH';
}

/** POST/PUT appointments/roles */
export class UpsertTurnosRoleDto {
  @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(40) @Matches(/^.{2,}$/s, { message: 'El nombre tiene que tener al menos 2 letras.' }) name!: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @Matches(COLOR, { message: 'color tiene que ser #RRGGBB' }) color?: string;
  @IsBoolean() takesAppointments!: boolean;
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(60, { each: true }) permissions!: string[];
}
