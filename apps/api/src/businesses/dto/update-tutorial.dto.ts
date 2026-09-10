import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

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

  // Topes (auditoría interna 10/09, ítem `api.businesses`): lo escribe
  // cualquier member y va entero a un JSONB, así que antes aceptaba arrays de
  // cualquier tamaño. La Checklist tiene 6 tareas; en producción, 6 como mucho.
  @IsInt()
  @Min(0)
  @Max(100)
  paso!: number;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  hechas!: string[];

  @IsBoolean()
  minimizado!: boolean;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  seccionesVistas!: string[];
}

export class UpdateTutorialDto {
  @ValidateNested()
  @Type(() => TutorialStateDto)
  tutorial!: TutorialStateDto;
}
