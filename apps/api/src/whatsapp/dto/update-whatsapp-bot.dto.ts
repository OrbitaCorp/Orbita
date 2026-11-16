import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CambiosDeOrbiDto } from '../../orbi/atencion/dto/cambios-de-orbi.dto';

/** Lo común de Orbi (interruptor, modo, indicaciones, pedidos, cupo) más el menú, que es solo de WhatsApp. */
export class UpdateWhatsappBotDto extends CambiosDeOrbiDto {
  /** Cómo atiende Orbi: todo con IA, menú + IA, o solo menú (sin IA). */
  @IsOptional() @IsIn(['CONVERSACIONAL', 'MENU_Y_CONVERSACION', 'SOLO_MENU']) modalidad?: 'CONVERSACIONAL' | 'MENU_Y_CONVERSACION' | 'SOLO_MENU';
  @IsOptional() @IsIn(['LISTA', 'BOTONES']) menuEstilo?: 'LISTA' | 'BOTONES';
  /** Saludo antes del menú. null o vacío vuelve al de siempre. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(600) bienvenida?: string | null;
  /** Las opciones del menú, en orden. Se validan en el servicio (límites de WhatsApp, ids, respuestas propias). */
  @IsOptional() @IsArray() @ArrayMaxSize(10) menuOpciones?: unknown[];
}
