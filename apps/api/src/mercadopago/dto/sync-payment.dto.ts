import { IsString, Matches } from 'class-validator';

// El `payment_id` que trae la URL cuando Mercado Pago redirige de vuelta al
// comprador tras pagar (ver MercadopagoController.syncPayment()). Es texto,
// no UUID: MP usa sus propios ids numéricos como string.
export class SyncPaymentDto {
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'Id de pago inválido' })
  mpPaymentId!: string;
}
