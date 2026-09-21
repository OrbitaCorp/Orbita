import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { recortar } from './recortar';

// Pulgar de un capítulo del Manual. `chapterId` es el id que usa el frontend
// para nombrar cada capítulo (texto libre acotado, no un enum: el manual
// cambia seguido y no tiene sentido migrar la base por cada capítulo nuevo).
export class ManualFeedbackDto {
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(64) chapterId!: string;
  @IsBoolean() helpful!: boolean;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) comment?: string;
}
