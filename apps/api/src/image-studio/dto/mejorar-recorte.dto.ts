import { IsOptional, IsUrl } from 'class-validator';

export class MejorarRecorteDto {
  // Alternativa a subir el archivo: URL de una foto YA GUARDADA (edición de
  // producto) — mismo criterio y mismo chequeo anti-SSRF que
  // GenerateBackgroundDto#imageUrl (ImageStudioService#resolverImagenPorUrl).
  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;
}
