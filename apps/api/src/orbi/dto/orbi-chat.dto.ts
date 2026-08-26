import { IsString, IsOptional, IsObject, IsArray, IsEnum, IsUUID, IsInt } from 'class-validator';

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
