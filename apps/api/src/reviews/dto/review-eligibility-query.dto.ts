import { IsUUID } from 'class-validator';

// Para saber si el cliente logueado puede dejar una reseña de ESTE producto
// ahora mismo — sirve para mostrar u ocultar el formulario en ProductoDetalle.
export class ReviewEligibilityQueryDto {
  @IsUUID() productId!: string;
}
