import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReviewDto {
  @IsUUID() productId!: string;
  @IsUUID() orderId!: string;
  // Recortado, obligatorio y con tope (auditoría interna 10/09, ítem
  // api.reviews): antes se aceptaba vacío o de cualquier largo. Se muestra
  // escapado (React) en la tienda.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Escribí tu reseña' })
  @MaxLength(2000)
  text!: string;
}
