import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsString, Min, ValidateNested } from 'class-validator';

// Estado del tutorial de primeros pasos del panel. Espejo de EstadoTutorial en
// apps/web/src/modules/ventas/panel/tutoriales/estado.ts — si cambia uno,
// cambia el otro. Se guarda entero en businesses.tutorial (JSONB).
export const TUTORIAL_VARIANTES = ['recorrido', 'checklist', 'tooltips', 'bienvenida', 'asistente'] as const;
export const TUTORIAL_FASES = ['activo', 'terminado'] as const;

export class TutorialStateDto {
  @IsIn(TUTORIAL_VARIANTES)
  variante!: (typeof TUTORIAL_VARIANTES)[number];

  @IsIn(TUTORIAL_FASES)
  fase!: (typeof TUTORIAL_FASES)[number];

  @IsInt()
  @Min(0)
  paso!: number;

  @IsArray()
  @IsString({ each: true })
  hechas!: string[];

  @IsBoolean()
  minimizado!: boolean;

  @IsArray()
  @IsString({ each: true })
  seccionesVistas!: string[];
}

export class UpdateTutorialDto {
  @ValidateNested()
  @Type(() => TutorialStateDto)
  tutorial!: TutorialStateDto;
}
