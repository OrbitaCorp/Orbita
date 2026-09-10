import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Topes desde la auditoría interna del 10/09 (ítem api.discounts): antes las
// fechas eran cualquier string (una fecha inválida llegaba a Prisma como
// Invalid Date y salía un 500), las horas no se validaban (se comparan como
// texto "HH:MM", así que "9:00" nunca coincidía), los días no se chequeaban
// uno por uno y los límites de usos aceptaban 0 o negativos.
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpsertDiscountDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(64) code?: string;
  @IsIn(['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET', 'BUY_X_PAY_Y']) type!: string;
  // Porcentaje, monto o "pagá Y": el rango fino por tipo lo valida el service.
  @IsNumber() @Min(0) @Max(1_000_000_000) value!: number;
  @IsIn(['PRODUCT', 'CATEGORY', 'TICKET']) scope!: string;
  @IsOptional() @IsIn(['padre', 'variante']) productLevel?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) minQuantity?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000) minAmount?: number;
  @IsOptional() @IsIn(['AUTOMATIC', 'MANUAL']) application?: string;
  @IsDateString() startDate!: string;
  // "YYYY-MM-DD" (medianoche UTC) para un descuento común, o un instante ISO
  // completo cuando es una oferta relámpago: el reloj de la portada necesita
  // la hora exacta en la que termina, no solo el día.
  @IsOptional() @IsDateString() endDate?: string;
  // Días y horario en hora de Argentina (ver common/utils/hora-argentina.ts).
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) activeDays?: number[];
  @IsOptional() @IsString() @Matches(HORA, { message: 'La hora de inicio va como HH:MM (24 h)' }) startTime?: string;
  @IsOptional() @IsString() @Matches(HORA, { message: 'La hora de fin va como HH:MM (24 h)' }) endTime?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10_000_000) maxUsesTotal?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10_000) maxUsesPerCustomer?: number;
  @IsOptional() @IsBoolean() isPrivate?: boolean;
  @IsOptional() @IsInt() @Min(-1000) @Max(1000) priority?: number;
  // Link compartible (RBT-613-bis) — a diferencia del cupón, sin destino
  // configurable: un descuento ya define su propio alcance (producto/
  // categoría), el link siempre lleva a esos productos. Se identifica por
  // `id`, nunca por código — un descuento no tiene (ver DiscountsService,
  // `code` siempre null acá).
  @IsOptional() @IsBoolean() linkActive?: boolean;
  // "Oferta relámpago" (paquete Avanzado, RBT-675): en el panel es un TIPO
  // más del selector de descuento; para la API es un PERCENT_PRODUCT con esta
  // marca. Prende la cuenta regresiva en la portada: un reloj con lo que falta
  // para `endDate` y los productos del descuento con su precio rebajado. Solo
  // un descuento por negocio la puede tener; prenderla acá se la saca al que
  // la tenía. Ausente = no tocar lo que ya estaba. Ver DiscountCountdownService.
  @IsOptional() @IsBoolean() countdown?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsUUID('4', { each: true }) productIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true }) categoryIds?: string[];
}
