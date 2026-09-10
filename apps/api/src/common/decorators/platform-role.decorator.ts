import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ROLE_KEY = 'platformRole';

/**
 * Restringe un endpoint del super admin a los SUPERADMIN, dejando afuera a los
 * OPERATOR — ver `PlatformAdminGuard`.
 *
 * Los dos roles existen en el schema desde siempre (`PlatformAdminRole`:
 * "SUPERADMIN — acceso total (fundadores)" / "OPERATOR — soporte /
 * operaciones (acceso acotado)") y el rol viaja en el JWT y llega al contexto
 * como `adminRole`, pero hasta la auditoría interna del 09/09 (ítem
 * `api.platform`, verificación 3) no se leía en ningún lado: un OPERATOR
 * podía hacer exactamente lo mismo que un fundador, incluido crear y borrar
 * otros admins de plataforma y regalar suscripciones.
 *
 * El corte, decidido en esa auditoría: **leer, todos; lo que toca plata,
 * accesos o el estado de un negocio, solo SUPERADMIN.**
 */
export const PlatformRole = (...roles: ('SUPERADMIN' | 'OPERATOR')[]) => SetMetadata(PLATFORM_ROLE_KEY, roles);

/** Atajo para el caso normal: solo fundadores. */
export const SoloSuperadmin = () => PlatformRole('SUPERADMIN');
