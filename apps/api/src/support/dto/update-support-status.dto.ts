import { IsIn } from 'class-validator';

// Solo OPEN y CLOSED a mano: ANSWERED lo pone el sistema al responder, no es
// un estado que un admin elija.
export const SUPPORT_STATUSES_MANUALES = ['OPEN', 'CLOSED'] as const;

export class UpdateSupportStatusDto {
  @IsIn(SUPPORT_STATUSES_MANUALES) status!: (typeof SUPPORT_STATUSES_MANUALES)[number];
}
