import { IsString, IsArray, IsUUID, ArrayNotEmpty, ArrayMaxSize, IsNotEmpty, MaxLength } from 'class-validator';

export class CustomerEmailDto {
  // Límite de destinatarios: sin tope, un POST podía disparar miles de envíos
  // secuenciales por Resend (request colgado, cuota consumida, rechazos).
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  customerIds!: string[];

  @IsString() @IsNotEmpty() @MaxLength(150) subject!: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
}
