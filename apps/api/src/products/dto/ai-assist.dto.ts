import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AiAssistDto {
  @IsString() @MaxLength(80) name!: string;
  // Descripción ya escrita por el usuario, si la hay — se usa como contexto
  // para que Orbi la mejore/extienda en vez de ignorarla.
  @IsOptional() @IsString() @MaxLength(2000) existingDescription?: string;
}
