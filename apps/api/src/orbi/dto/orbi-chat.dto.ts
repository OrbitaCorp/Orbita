import { IsString, IsOptional, IsObject, IsArray, IsEnum, IsUUID, IsInt, IsBoolean, IsIn, ArrayMaxSize, MaxLength, ValidateNested } from 'class-validator';
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

/**
 * Una opción del paso actual del wizard (rubro, subrubro, tipo de local). La
 * manda el cliente y termina LISTADA EN EL SYSTEM PROMPT, bajo el título
 * "Opciones reales (las ÚNICAS que existen en Órbita)" — la posición de mayor
 * confianza que tiene el modelo (ver prompts/wizard.ts#formatOptions).
 *
 * Antes el campo era `@IsArray()` a secas: sin ValidateNested + Type,
 * class-validator no baja al objeto, así que cualquiera podía postearle al
 * endpoint público del wizard una "opción" con un label de cualquier largo y
 * escribir a gusto dentro del system prompt (auditoría interna 09/09, ítem
 * `api.common`, verificación 7).
 */
export class OrbiOptionDto {
  @IsString()
  @MaxLength(60)
  key!: string;

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class OrbiContextDto {
  @IsEnum(OrbiSurface)
  surface!: OrbiSurface;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  module?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  section?: string;

  @IsOptional()
  @IsUUID()
  businessId?: string;

  // Ya no se usa para decidir nada (los permisos salen del JWT, ver
  // orbi.controller.ts), pero sigue llegando desde el panel: se acota igual
  // para que no sea una vía libre de payload.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  permissions?: string[];

  @IsOptional()
  @IsInt()
  step?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  stepName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  rubro?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => OrbiOptionDto)
  availableOptions?: OrbiOptionDto[];

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

/** Confirmación de una acción que Orbi propuso. Solo el id: ver PendingActionStore. */
export class ConfirmActionDto {
  @IsString()
  @MaxLength(64)
  actionId!: string;
}

// Un mensaje del historial que manda el cliente. Antes el campo era
// `@IsArray()` a secas: como el array se pega al prompt tal cual, cualquiera
// podía mandar un mensaje con role 'system' al endpoint público del wizard e
// inyectar instrucciones en Gemini (auditoría interna 09/09, ítem
// `api.common`, verificación 7). El role queda restringido a los dos valores
// que el cliente puede tener, y el contenido, topeado.
export class OrbiHistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(8000)
  content!: string;
}

export class OrbiChatDto {
  // El endpoint del wizard es público: sin tope, un solo POST podía mandarle
  // al modelo los 10 MB que admite el body. 4000 caracteres es más de lo que
  // cualquiera escribe en un chat y deja acotado el costo por turno.
  @IsString()
  @MaxLength(4000)
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
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrbiHistoryMessageDto)
  history?: OrbiHistoryMessageDto[];
}
