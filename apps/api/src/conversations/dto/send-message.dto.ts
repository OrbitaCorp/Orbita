import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, Min, IsNotEmpty, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SendMessageDto {
  // trim + no vacío + tope de largo: sin esto un mensaje "" o de solo espacios
  // pasaba y prendía isUnread igual, y el texto no tenía límite. 5000 = mismo
  // criterio que el body de los emails a clientes (customer-email.dto.ts).
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string;

  @IsOptional() @IsUUID() orderId?: string;
}
