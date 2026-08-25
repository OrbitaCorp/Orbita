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
}

export class OrbiChatDto {
  @IsString()
  message!: string;

  @IsObject()
  context!: OrbiContextDto;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
