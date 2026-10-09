import { IsIn, IsOptional } from 'class-validator';

// Pantalla del panel desde la que se pide la conexión: al terminar el login de Instagram se vuelve ahí.
export const PANTALLAS_DE_RETORNO = ['mensajes', 'difusion'] as const;
export type PantallaDeRetorno = (typeof PANTALLAS_DE_RETORNO)[number];

export class ConectarInstagramDto {
  @IsOptional() @IsIn(PANTALLAS_DE_RETORNO) seccion?: PantallaDeRetorno;
}
