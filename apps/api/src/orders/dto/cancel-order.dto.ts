import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Cancelación por el propio cliente (storefront). El motivo es opcional —
// distinto del panel, donde cancelar un pedido siempre pide un motivo.
// `refundMethod` solo aplica cuando la cancelación pasa a ser una SOLICITUD
// (CONFIRMED/PREPARING, ver CancellationsService.requestOrCancel) — un
// PENDING se autocancela directo y no hay nada que reembolsar todavía.
export class CancelOrderDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @IsIn(['CREDIT_NOTE', 'REFUND']) refundMethod?: string;
}
