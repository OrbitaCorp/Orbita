import { IsIn } from 'class-validator';

export class ChangePlanDto {
  @IsIn(['mensual', 'semestral', 'anual'])
  plan!: 'mensual' | 'semestral' | 'anual';
}
