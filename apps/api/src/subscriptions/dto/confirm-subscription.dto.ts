import { IsString, Matches } from 'class-validator';

export class ConfirmSubscriptionDto {
  // Id del preapproval que MP devuelve en la URL de vuelta. Se usa solo para
  // ir a preguntarle a MP el estado real — nunca se toma como prueba de pago.
  // Hoy es nuestra referencia PEND-/FREE- + UUID, pero pago-retorno.tsx cae a
  // otros ids de MP si no la encuentra: se acota a un id alfanumérico.
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,64}$/, { message: 'Referencia de pago inválida' })
  preapprovalId!: string;
}
