import { IsBoolean } from 'class-validator';

// PUT /countdown/settings — el interruptor de la tarjeta "Oferta relámpago"
// de Avanzado. Solo prende o apaga: la oferta en sí (porcentaje, productos,
// hasta cuándo) se configura en Descuentos como cualquier otro tipo.
export class UpdateCountdownSettingsDto {
  @IsBoolean() enabled!: boolean;
}
