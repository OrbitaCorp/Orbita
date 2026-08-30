import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
  @IsString() @IsNotEmpty() @MaxLength(100) orderNumber!: string;

  // Requerido (a diferencia de la spec de Jira, que lo dejaba "email o
  // teléfono"): el acuse de recibo inmediato es por email — sin uno no hay
  // forma de cumplirlo. El teléfono queda como dato de contacto adicional
  // opcional. Decisión propia, comentada en RBT-683 (ver Jira).
  @IsEmail() email!: string;

  @IsOptional() @IsString() @MaxLength(40) phone?: string;

  @IsEnum(ReturnRequestReason) reason!: ReturnRequestReason;

  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}
