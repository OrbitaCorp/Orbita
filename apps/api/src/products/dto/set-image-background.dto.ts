import { IsBoolean } from 'class-validator';

export class SetImageBackgroundDto {
  // true: quita el fondo con el modelo local; false: vuelve a la foto original.
  @IsBoolean()
  removeBackground!: boolean;
}
