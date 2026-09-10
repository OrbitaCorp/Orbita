import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// Motivo elegido en el formulario público de "Arrepentimiento / Devolución"
// del footer (RBT-683) — dispara un texto legal distinto en el mail al
// cliente, pero NO cambia el flujo de guardado: acá no hay estados ni
// aprobación, la resolución del caso queda 100% fuera de Órbita (coordinan
// cliente y comercio por email/WhatsApp — ver ReturnRequestsService).
export enum ReturnRequestReason {
  ARREPENTIMIENTO = 'ARREPENTIMIENTO',
  GARANTIA = 'GARANTIA',
  OTRO = 'OTRO',
}

export class CreateReturnRequestDto {
  // El número correlativo del pedido (Order.orderNumber, un Int). Se acepta
  // con "#" adelante porque así figura en los mails; nueve dígitos entran
  // siempre en el Int de Postgres.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/^#\s*/, '') : value))
  @IsString()
  @Matches(/^\d{1,9}$/, { message: 'El número de pedido son solo números (ej: 1024)' })
  orderNumber!: string;

  // Requerido (a diferencia de la spec de Jira, que lo dejaba "email o
  // teléfono"): el acuse de recibo inmediato es por email — sin uno no hay
  // forma de cumplirlo. El teléfono queda como dato de contacto adicional
  // opcional. Decisión propia, comentada en RBT-683 (ver Jira).
  // Tiene que ser el mismo email con el que se hizo la compra (ver el service).
  @NormalizedEmail() email!: string;

  @IsOptional() @IsString() @MaxLength(40)
  @Matches(/^[\d\s()+.-]*$/, { message: 'El teléfono solo puede tener números, espacios y + ( ) -' })
  phone?: string;

  @IsEnum(ReturnRequestReason) reason!: ReturnRequestReason;

  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}
