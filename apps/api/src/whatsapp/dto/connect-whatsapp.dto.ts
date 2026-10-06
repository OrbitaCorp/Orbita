import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Conexión manual con credenciales de Meta. Es el camino de PRUEBAS (número de
// prueba + token temporal de API Setup); la conexión real de cada negocio va
// por Embedded Signup y no pasa por acá.
export class ConnectWhatsappDto {
  @Transform(trim) @IsString() @Matches(/^\d{5,20}$/, { message: 'El ID del número debe ser numérico' })
  phoneNumberId!: string;

  @Transform(trim) @IsString() @Matches(/^\d{5,20}$/, { message: 'El ID de la cuenta de WhatsApp Business debe ser numérico' })
  wabaId!: string;

  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(1000)
  accessToken!: string;
}
