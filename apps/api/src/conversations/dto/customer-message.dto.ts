import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, Min, IsNotEmpty, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CustomerMessageDto {
  // Mismo criterio que SendMessageDto (lado staff): trim, no vacío, tope 5000.
  // Antes un cliente podía postear "" y flipear la conversación a no-leída, o
  // mandar texto sin límite de largo.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string;
}
