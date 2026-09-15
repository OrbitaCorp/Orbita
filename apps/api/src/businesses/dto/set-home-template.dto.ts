import { IsIn, IsOptional, ValidateIf } from 'class-validator';

// Whitelist de plantillas enganchadas al storefront: hoy son las dieciséis.
//
// Vidriera y Escaparate van con `soloCuerpo` (la tienda real pone header,
// hero y pie); las otras catorce declaran headerPropio/heroPropio/piePropio y
// se dibujan enteras con las acciones reales adentro. El catálogo con sus
// definiciones vive en apps/web/.../plantillas/datos.tsx — si se da de baja
// una, sacarla también de acá o el panel podría guardar un id que el
// storefront no sabe dibujar.
export const HOME_TEMPLATES_DISPONIBLES = [
  'vidriera',
  'escaparate',
  'mosaico',
  'premium',
  'nocturno',
  'glow',
  'papeleria',
  'corralon',
  'atleta',
  'patitas',
  'bodega',
  'crecer',
  'circuito',
  'vera',
  'cobijo',
  'nitida',
  // Las de receta (ver tipos.ts en el panel): no escriben su propio
  // bloque, declaran que secciones muestran. Igual van listadas una por
  // una -- esta lista tiene que coincidir con PLANTILLAS de datos.tsx o
  // el panel ofrece una que la API rechaza con 400.
  'lienzo',
  'pulso',
  'terracota',
  'base',
  'carbon',
  'bloque',
  'sobrio',
  'roble',
  'petalo',
  'sello',
] as const;

export class SetHomeTemplateDto {
  @ValidateIf((o) => o.template !== null)
  @IsIn(HOME_TEMPLATES_DISPONIBLES, { message: `template debe ser null o uno de: ${HOME_TEMPLATES_DISPONIBLES.join(', ')}` })
  @IsOptional()
  template!: string | null;
}
