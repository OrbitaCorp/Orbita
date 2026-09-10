import { IsString, IsOptional, MaxLength } from 'class-validator';

// `subdomain` y `mode` NO se editan acá — son de setup inicial / zona peligrosa
// (ver decisión documentada: CONTRATO_API.md permite editar `mode` en este mismo
// endpoint, pero esta fase lo excluye deliberadamente).
//
// Topes de largo (auditoría interna 10/09, ítem `api.businesses`): holgados
// contra lo que hay en producción (nombre más largo: 32; descripción: 59).
export class UpdateBusinessDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(60) industry?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
