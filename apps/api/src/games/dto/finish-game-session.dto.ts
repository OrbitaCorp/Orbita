import { IsInt, IsUUID, Min } from 'class-validator';

export class FinishGameSessionDto {
  @IsUUID() sessionId!: string;
  // El servidor igual lo cappea contra el techo del juego (ver GamesPlayService)
  // — esto solo valida forma, no confía en el número para pagar de más.
  @IsInt() @Min(0) hits!: number;
}
