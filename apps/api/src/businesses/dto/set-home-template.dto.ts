import { IsIn, IsOptional, ValidateIf } from 'class-validator';

// Whitelist de plantillas realmente enganchadas al storefront — hoy Vidriera
// y Escaparate. El catálogo completo de 16 vive en
// apps/web/.../plantillas/datos.tsx (ver PLANTILLAS_ENGANCHADAS ahí, el
// mismo Set del lado del panel) pero el resto sigue siendo vitrina, sin
// lógica real detrás; no aceptar acá esos ids todavía.
export const HOME_TEMPLATES_DISPONIBLES = ['vidriera', 'escaparate'] as const;

export class SetHomeTemplateDto {
  @ValidateIf((o) => o.template !== null)
  @IsIn(HOME_TEMPLATES_DISPONIBLES, { message: `template debe ser null o uno de: ${HOME_TEMPLATES_DISPONIBLES.join(', ')}` })
  @IsOptional()
  template!: string | null;
}
