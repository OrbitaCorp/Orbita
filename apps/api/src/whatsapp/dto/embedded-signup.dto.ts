import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Lo que le llega al panel cuando el cliente termina la incorporación integrada de Meta (Embedded Signup): un
// código de un solo uso (vale unos segundos) y los ids de la cuenta y el número que eligió. El panel los manda
// tal cual; la API canjea el código por el token del negocio y comprueba contra Meta que esos ids sean suyos.
export class EmbeddedSignupDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(2000)
  code!: string;

  // Con la coexistencia (el número sigue en la app WhatsApp Business) Meta no devuelve el id del número, solo el de la
  // cuenta: se busca en la cuenta.
  @IsOptional() @Transform(trim) @IsString() @Matches(/^\d{5,20}$/, { message: 'El ID del número debe ser numérico' })
  phoneNumberId?: string;

  @Transform(trim) @IsString() @Matches(/^\d{5,20}$/, { message: 'El ID de la cuenta de WhatsApp Business debe ser numérico' })
  wabaId!: string;

  /** Portfolio de negocio de Meta del cliente (solo informativo). */
  @IsOptional() @Transform(trim) @IsString() @Matches(/^\d{5,25}$/)
  businessId?: string;
}
