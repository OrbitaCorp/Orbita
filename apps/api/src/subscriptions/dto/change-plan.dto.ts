import { IsIn } from 'class-validator';

export class ChangePlanDto {
  // Las 6 keys siguen disponibles ACÁ (cambio de plan desde el panel), a
  // diferencia de StartPendingCheckoutDto que desde el rediseño "Base"/"Base
  // + Avanzado" (RBT, 2026-09) solo ofrece 2 en el alta — un cliente ya
  // activo puede pasarse a semestral/anual o sumar/sacar Avanzado en
  // cualquier momento. Las dos con Avanzado y período largo se sumaron el
  // 2026-09-15 (ver PLANES en subscriptions.service.ts).
  @IsIn(['mensual', 'semestral', 'anual', 'mensualAvanzado', 'semestralAvanzado', 'anualAvanzado'])
  plan!: 'mensual' | 'semestral' | 'anual' | 'mensualAvanzado' | 'semestralAvanzado' | 'anualAvanzado';
}
