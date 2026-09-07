import { IsBoolean } from 'class-validator';

// PATCH /discounts/:id/countdown — prende o apaga la cuenta regresiva de un
// descuento ya guardado desde el listado (la píldora de cada fila), sin
// mandar el descuento entero como hace PUT. Ver DiscountCountdownService.
export class SetDiscountCountdownDto {
  @IsBoolean() countdown!: boolean;
}
