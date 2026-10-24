import { IsIn } from 'class-validator';

export class ChatBotDto {
  /** ON: Orbi atiende este chat (también reactiva uno pausado o derivado). OFF: lo atiende una persona. */
  @IsIn(['ON', 'OFF']) estado!: 'ON' | 'OFF';
}
