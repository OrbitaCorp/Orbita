import { IsOptional, IsString, MaxLength } from 'class-validator';

// Cancelación por el propio cliente (storefront). El motivo es opcional —
// distinto del panel, donde cancelar un pedido siempre pide un motivo.
export class CancelOrderDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
