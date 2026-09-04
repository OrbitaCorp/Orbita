import { IsString, IsOptional, IsObject, IsArray, IsEnum, IsUUID, IsInt, IsBoolean, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum OrbiSurface {
  WIZARD = 'wizard',
  PANEL = 'panel',
}

/**
 * Lo que la persona ya completó en el formulario del alta. Sin esto Orbi sabe
 * en qué paso está pero no qué hay escrito, así que vuelve a sugerir nombres
 * cuando ya eligió uno, no puede opinar sobre el subdominio que puso, y el
 * "mini resumen" que le pide su propio prompt no lo puede armar con nada.
 *
 * Es una lista cerrada a propósito, no un objeto libre: esto termina metido en
 * el SYSTEM prompt, que es una posición de confianza mucho mayor que el mensaje
 * del usuario, y el endpoint del wizard es público. Cada campo va con su tope
 * de largo, y los datos que Orbi no necesita para ayudar (teléfono, dirección)
 * viajan como un booleano de "ya está cargado" en vez del valor.
 */
export class OrbiWizardFormStateDto {
  @IsOptional() @IsString() @MaxLength(120)
  nombre?: string;

  @IsOptional() @IsString() @MaxLength(400)
  descripcion?: string;

  @IsOptional() @IsString() @MaxLength(80)
  subdominio?: string;

  @IsOptional() @IsString() @MaxLength(40)
  modoVenta?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(60, { each: true })
  subrubros?: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(30, { each: true })
  tipoLocal?: string[];

  @IsOptional() @IsBoolean()
  telefonoCargado?: boolean;

  @IsOptional() @IsBoolean()
  logoCargado?: boolean;

  @IsOptional() @IsBoolean()
  direccionCargada?: boolean;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => OrbiWizardFormStateDto)
  formState?: OrbiWizardFormStateDto;

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

  // @IsObject() solo no alcanza: sin ValidateNested + Type, class-validator no
  // baja al objeto y NINGÚN decorador de OrbiContextDto se aplica — los
  // @MaxLength de sessionId/anonId, por ejemplo, nunca se estaban cumpliendo, y
  // con whitelist:true tampoco se limpiaban las claves de más. Importa acá
  // porque /orbi/chat/wizard es público y parte de este contexto termina
  // interpolada en el system prompt.
  @IsObject()
  @ValidateNested()
  @Type(() => OrbiContextDto)
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
