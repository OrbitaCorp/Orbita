import { IsString, MaxLength } from 'class-validator';

// Pedido de acceso anticipado a Instagram: el @usuario de la cuenta que se va a conectar.
// El formato (letras, números, puntos y guiones bajos) lo valida el servicio, que también
// le saca la @ y pasa a minúsculas.
export class SolicitarAccesoDto {
  @IsString() @MaxLength(60) username!: string;
}
