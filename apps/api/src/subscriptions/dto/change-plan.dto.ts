import { IsIn } from 'class-validator';

export class ChangePlanDto {
  // Las 4 keys siguen disponibles ACÁ (cambio de plan desde el panel), a
  // diferencia de StartPendingCheckoutDto que desde el rediseño "Base"/"Base
  // + Avanzado" (RBT, 2026-09) solo ofrece 2 en el alta — un cliente ya
  // activo puede pasarse a semestral/anual o sumar/sacar Avanzado en
  // cualquier momento.
  @IsIn(['mensual', 'semestral', 'anual', 'mensualAvanzado'])
  plan!: 'mensual' | 'semestral' | 'anual' | 'mensualAvanzado';
}
