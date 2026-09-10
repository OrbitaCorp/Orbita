import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Largos acotados: antes nombre y texto no tenían límite (auditoría interna
// 10/09, ítem api.message-templates). 5000 = el mismo tope que un mensaje del
// chat (SendMessageDto), que es donde termina el texto de la plantilla.
export class UpsertMessageTemplateDto {
  @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(5000) text!: string;
  @IsIn(['PEDIDO', 'RETIRO', 'ENVIO', 'POSTVENTA', 'OTRO']) category!: string;
}
