import { IsIn, IsOptional } from 'class-validator';

// Pantalla del panel desde la que se pide la conexión: al terminar el login de Instagram se vuelve ahí.
export const PANTALLAS_DE_RETORNO = ['mensajes', 'difusion', 'publicaciones', 'comentarios', 'estadisticas'] as const;
export type PantallaDeRetorno = (typeof PANTALLAS_DE_RETORNO)[number];

export class ConectarInstagramDto {
  @IsOptional() @IsIn(PANTALLAS_DE_RETORNO) seccion?: PantallaDeRetorno;
  // 'kit' = además de los mensajes, pedirle a Instagram los permisos del kit de difusión (publicar, comentarios y estadísticas).
  @IsOptional() @IsIn(['kit']) permisos?: 'kit';
}
