import { IsOptional, IsUUID } from 'class-validator';

// Importar Excel → paso Fotos: la búsqueda se arma en el servidor con el
// nombre, la categoría y el rubro del producto ya guardado.
export class WebImageSuggestionsDto {
  /** Valor de la variante visual ("Negro") cuando se buscan las fotos de ese color. */
  @IsOptional() @IsUUID() optionValueId?: string;
}
