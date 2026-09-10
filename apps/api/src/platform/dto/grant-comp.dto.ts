import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

// El motivo queda guardado en la suscripción y se muestra en el panel; el
// tope es para que no entre un texto de cualquier tamaño (auditoría interna
// 09/09, ítem `api.platform`). La fecha se valida en el servicio, que ya
// rechaza cualquier cosa que no parsee como ISO 8601.
export class GrantCompDto {
  @IsString() @MaxLength(40) currentPeriodEnd!: string;
  @IsString() @MaxLength(300) grantReason!: string;
}
