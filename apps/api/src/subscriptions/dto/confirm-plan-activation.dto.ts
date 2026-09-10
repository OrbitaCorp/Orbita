import { IsString, Matches } from 'class-validator';

export class ConfirmPlanActivationDto {
  // Id de la preapproval que MP devuelve en la URL de vuelta (activatePlan).
  // Se usa solo para ir a preguntarle a MP el estado real — nunca se toma
  // como prueba de que se autorizó.
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,64}$/, { message: 'Id de suscripción inválido' })
  mpPreapprovalId!: string;
}
