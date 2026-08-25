import { IsNotEmpty, IsString } from 'class-validator';

// El `payment_id` que trae la URL cuando Mercado Pago redirige de vuelta al
// comprador tras pagar (ver MercadopagoController.syncPayment()). Es texto,
// no UUID: MP usa sus propios ids numéricos como string.
export class SyncPaymentDto {
  @IsString() @IsNotEmpty() mpPaymentId!: string;
}
