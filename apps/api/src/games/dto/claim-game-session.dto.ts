import { IsUUID } from 'class-validator';

export class ClaimGameSessionDto {
  @IsUUID() sessionId!: string;
}
