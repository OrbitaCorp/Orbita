import { IsIn, IsOptional, ValidateIf } from 'class-validator';

// Whitelist de plantillas realmente enganchadas al storefront — hoy solo
// Vidriera (prueba de concepto). El catálogo completo de 20 vive en
// apps/web/.../plantillas/datos.tsx pero el resto sigue siendo vitrina, sin
// lógica real detrás; no aceptar acá esos ids todavía.
export const HOME_TEMPLATES_DISPONIBLES = ['vidriera'] as const;

export class SetHomeTemplateDto {
  @ValidateIf((o) => o.template !== null)
  @IsIn(HOME_TEMPLATES_DISPONIBLES, { message: `template debe ser null o uno de: ${HOME_TEMPLATES_DISPONIBLES.join(', ')}` })
  @IsOptional()
  template!: string | null;
}
