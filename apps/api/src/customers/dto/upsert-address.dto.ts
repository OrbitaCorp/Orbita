import { IsString, IsOptional, IsBoolean, IsNotEmpty, MaxLength } from 'class-validator';

// Topes (auditoría interna 10/09, ítem `api.customers`): la dirección la
// escribe el cliente desde la tienda y después la ven el panel, las etiquetas
// de envío y los mails de pedido.
export class UpsertAddressDto {
  @IsOptional() @IsString() @MaxLength(40) alias?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) street!: string;
  @IsOptional() @IsString() @MaxLength(20) floor?: string;
  @IsOptional() @IsString() @MaxLength(20) depto?: string;
  @IsOptional() @IsString() @MaxLength(300) referencia?: string;
  @IsOptional() @IsString() @MaxLength(60) provincia?: string;
  @IsString() @IsNotEmpty() @MaxLength(100) city!: string;
  @IsOptional() @IsString() @MaxLength(20) zip?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
