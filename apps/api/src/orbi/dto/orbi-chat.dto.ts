import { IsString, IsOptional, IsObject, IsArray, IsEnum, IsUUID, IsInt, MaxLength } from 'class-validator';

export enum OrbiSurface {
  WIZARD = 'wizard',
  PANEL = 'panel',
}

export class OrbiContextDto {
  @IsEnum(OrbiSurface)
  surface!: OrbiSurface;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsUUID()
  businessId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsInt()
  step?: number;

  @IsOptional()
  @IsString()
  stepName?: string;

  @IsOptional()
  @IsString()
  rubro?: string;

  @IsOptional()
  @IsArray()
  availableOptions?: { key: string; label: string; description?: string }[];

  // Identificadores anónimos de la analítica del wizard (ver
  // wizard-analytics/). Sirven para pegar lo que la persona le pregunta a Orbi
  // con el resto de su recorrido: en qué paso estaba, cuánto tardó, si
  // terminó. No identifican a nadie — los genera el navegador.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  anonId?: string;
}

export class OrbiChatDto {
  @IsString()
  message!: string;

  @IsObject()
  context!: OrbiContextDto;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  // Historial de la conversación del wizard, mandado por el cliente en cada
  // request — el wizard es público/sin businessId, así que no hay dónde
  // persistirlo del lado del servidor (a diferencia del panel, que usa
  // ConversationService). Se acota igual en el controller por si el cliente
  // manda de más.
  @IsOptional()
  @IsArray()
  history?: { role: 'user' | 'assistant'; content: string }[];
}
